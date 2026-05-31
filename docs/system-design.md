# System Design: Release Owl

## Table of Contents

1. [System Overview](#1-system-overview)
2. [System Requirements](#2-system-requirements)
3. [Constraints](#3-constraints)
4. [Load Estimation](#4-load-estimation)
5. [High-Level Architecture](#5-high-level-architecture)
6. [Detailed Component Design](#6-detailed-component-design)
7. [Data Model](#7-data-model)
8. [API Integration](#8-api-integration)
9. [Observability](#9-observability)
10. [Testing and CI](#10-testing-and-ci)
11. [Future Work](#11-future-work)

---

## 1. System Overview

**Release Owl** is an HTTP service that allows users to subscribe to email notifications about new releases of GitHub repositories. The service periodically polls the GitHub API and sends emails to subscribers when a new release tag is detected.

```mermaid
flowchart TD
    subgraph Sub["Subscription Flow (on demand)"]
        A[User] -->|POST /api/subscribe| B[Repository validation\nGitHub API]
        B --> C[Persist to PostgreSQL]
        C --> D[Send confirmation email]
        D --> E[User confirms subscription]
    end

    subgraph Scan["Scanner Flow (scheduled, every hour)"]
        F["[cron] Scheduler"] --> G[Fetch all confirmed subscriptions]
        G --> H[GitHub API — check latest release]
        H -->|new release detected| I[Email notification to all subscribers]
        H -->|no new release| J[Skip]
    end
```

---

## 2. System Requirements

### 2.1 Functional Requirements

| #    | Requirement                                                                                          |
| ---- | ---------------------------------------------------------------------------------------------------- |
| F-01 | A user can subscribe to notifications by providing an email and an `owner/repo` slug                 |
| F-02 | The system validates repository existence via the GitHub REST API before persisting the subscription |
| F-03 | A subscription is activated only after email confirmation (double opt-in)                            |
| F-04 | The system sends a confirmation email with a verification link after a subscription is registered    |
| F-05 | The system sends email notifications to all confirmed subscribers when a new release is detected     |
| F-06 | Every notification email contains an unsubscribe link with a one-time token                          |
| F-07 | A user can unsubscribe at any time by following their unique unsubscribe link                        |
| F-08 | The system exposes an API to list all subscriptions (pending and confirmed) for a given email        |
| F-09 | The `(email, repo)` pair is unique — a duplicate subscription returns 409                            |
| F-10 | A static landing page allows subscribing without calling the API directly                            |
| F-11 | Swagger UI is available at `/api/docs` for interactive API testing                                   |

### 2.2 Non-Functional Requirements

| Category            | Requirement                          | Target                                                            |
| ------------------- | ------------------------------------ | ----------------------------------------------------------------- |
| **Availability**    | Service uptime                       | ≥ 99% (single-instance EC2)                                       |
| **Scalability**     | Number of monitored repositories     | Up to 1,000 without architectural changes                         |
| **Reliability**     | Single email send failure            | Does not stop processing other subscribers (`Promise.allSettled`) |
| **Reliability**     | Scanner crash                        | Does not affect HTTP request handling (graceful logging)          |
| **Security**        | Brute-force protection               | Rate limiting: 100 req / 15 min / IP                              |
| **Security**        | API endpoint protection              | Optional `X-API-Key` with timing-safe comparison                  |
| **Security**        | Transport                            | TLS via Caddy (Let's Encrypt) in production                       |
| **Configurability** | Start without required env variables | Fail-fast on startup                                              |
| **Maintainability** | Structured JSON logging              | Pino, DEBUG/INFO/ERROR levels                                     |
| **Testability**     | Unit + integration test coverage     | Jest + Supertest                                                  |

---

## 3. Constraints

### Technical Constraints

- **GitHub API rate limit without a token:** 60 requests/hour per IP. With N unique repositories on an hourly cron schedule, the system can process at most 60 repos without `GITHUB_TOKEN`. With a token — 5,000 requests/hour.
- **In-process scheduler:** `node-cron` runs in the same Event Loop as the HTTP server. A long scan cycle can delay HTTP request handling with a large number of repositories.
- **No retry mechanism** for emails or GitHub requests: transient SMTP or GitHub API failures result in a missed notification until the next cron tick.
- **No horizontal scaling:** single process + single DB instance. Running multiple instances will cause duplicate notifications (see [future work](#duplicate-notifications-under-horizontal-scaling)).

### Business Constraints

- The service monitors only **public GitHub repositories** (no OAuth for private repos).
- Only **official GitHub releases** (`/releases/latest`) are tracked — not tags or pre-releases.
- Only **one active subscription** per `(email, repo)` pair is supported.

### Infrastructure Constraints

- Deployed on a **single EC2 instance** (no load balancer, no auto-scaling).
- Database — **single-node PostgreSQL** with no replicas and no backup beyond the Docker volume.

---

## 4. Load Estimation

### 4.1 Users and Traffic

| Metric                     | Estimate | Note                                       |
| -------------------------- | -------- | ------------------------------------------ |
| Active subscribers         | ~1,000   | MVP target audience                        |
| Unique repositories        | ~300     | Some subscribers follow the same repo      |
| New subscriptions / day    | ~20      | `POST /api/subscribe`                      |
| Confirmations / day        | ~18      | ~90% conversion rate                       |
| Subscription lookups / day | ~10      | `GET /api/subscriptions`                   |
| GitHub API requests / hour | ~300     | 1 request × 300 repos × 1 time/hour        |
| Email notifications / hour | ~50      | ~5% of repos having a new release per hour |

### 4.2 Data

| Table           | Row size (estimate) | Rows  | Volume  |
| --------------- | ------------------- | ----- | ------- |
| `repositories`  | ~100 bytes          | 300   | ~30 KB  |
| `subscriptions` | ~300 bytes          | 1,000 | ~300 KB |

**Growth:** +20 subscriptions/day = 6 KB/day → **2 MB/year**. PostgreSQL thresholds are not a concern at any realistic volume.

### 4.3 Bandwidth

| Direction                    | Estimate          | Calculation                   |
| ---------------------------- | ----------------- | ----------------------------- |
| Inbound HTTP traffic         | ~5 KB/hour        | ~20 req × ~250 bytes/req      |
| Outbound to GitHub API       | ~90 KB/hour       | 300 req × ~300 bytes response |
| Outbound email notifications | ~50 KB/hour       | 50 emails × ~1 KB/email       |
| **Total**                    | **< 200 KB/hour** | Not a bottleneck              |

---

## 5. High-Level Architecture

```mermaid
flowchart TB
    subgraph EC2["EC2 Instance"]
        Caddy["Caddy (TLS)\n:80 / :443"]
        App["Node.js App"]
        PG[("PostgreSQL 16")]
        Filebeat["Filebeat"]
        ES[("Elasticsearch")]
        Kibana["Kibana\n(/kibana)"]
        ESInit["es-init\n(one-shot)"]
        Caddy <-->|":3000"| App
        Caddy <-->|":5601"| Kibana
        Caddy <-->|":3000/grafana"| Grafana["Grafana\n(/grafana)"]
        App --> PG
        Filebeat -->|"JSON logs"| ES
        Kibana --> ES
        ESInit -->|"PUT /_index_template"| ES
        Prometheus["Prometheus"] -->|"scrape /metrics"| App
        Grafana --> Prometheus
    end
    GitHub["GitHub REST API"]
    SMTP["SMTP Server"]
    Docker["Docker log files"]
    App --> GitHub
    App --> SMTP
    Docker -->|"container logs"| Filebeat
```

### Subscription Flow (Happy Path)

```mermaid
sequenceDiagram
    participant Client
    participant Express
    participant subscriptionService
    participant GitHubAPI as GitHub API
    participant DB
    participant SMTP

    Client->>Express: POST /subscribe
    Express->>subscriptionService: subscribe(email, repo)
    subscriptionService->>GitHubAPI: GET /repos/{repo}
    GitHubAPI-->>subscriptionService: 200 OK
    subscriptionService->>DB: INSERT subscription
    subscriptionService->>SMTP: sendConfirmEmail
    Express-->>Client: 200 OK

    Client->>Express: GET /confirm/:token
    Express->>subscriptionService: confirm(token)
    subscriptionService->>DB: UPDATE status=confirmed
    Express-->>Client: 200 OK
```

---

## 6. Detailed Component Design

### 6.1 HTTP Server (Express 5)

**Middleware pipeline** (in execution order):

```
express.static(public/)        → static landing page
helmet()                        → security headers
cors({ origin, methods })       → CORS allowlist
rateLimit(100/15min/IP)         → brute-force protection
pinoHttp()                      → structured request logging
express.json()                  → JSON body parsing
express.urlencoded()            → form body parsing
swagger-ui (/api/docs)          → OpenAPI documentation
subscriptionRoutes (/api)       → business endpoints
errorHandler()                  → centralized error handling
```

**Error handling:**

- `ZodError` → 400 Bad Request with validation details
- `AppError` (custom: `RepositoryNotFoundError`, `DuplicateSubscriptionError`, `InvalidTokenError`, `TokenNotFoundError`) → corresponding HTTP status codes
- Unexpected errors → 500 Internal Server Error (no stack trace leaked)

### 6.2 Subscription Service

Coordinates the full subscription lifecycle:

| Method                    | Action                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `subscribe(email, repo)`  | Validates repo → checks for duplicate → generates tokens (`crypto.randomBytes(32)`) → persists → sends confirmation email |
| `confirm(token)`          | Validates token format (hex 64) → updates status to `confirmed`                                                           |
| `unsubscribe(token)`      | Validates format → deletes the subscription row                                                                           |
| `getSubscriptions(email)` | Returns all subscriptions for the given email                                                                             |

### 6.3 Scanner Service

Cron job with a configurable schedule (`SCANNER_CRON_SCHEDULE`, default: `0 * * * *`):

1. Loads all `confirmed` subscriptions with `last_seen_tag` in a single query
2. Groups subscriptions by `repo` → 1 GitHub API call per repository regardless of subscriber count
3. Compares `release.tag_name` against `last_seen_tag`
4. On a new release: sends email to all subscribers via `Promise.allSettled` (one failure does not stop the rest)
5. Updates `last_seen_tag` in the `repositories` table

**Key detail:** using `Promise.allSettled` instead of `Promise.all` ensures that an SMTP failure for one subscriber does not interrupt notifications to others.

### 6.4 GitHub Service

Thin wrapper around GitHub REST API v2022-11-28:

| Method                   | Endpoint                                    | Behavior                                                                        |
| ------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------- |
| `repositoryExists(repo)` | `GET /repos/{owner}/{repo}`                 | `200` → true, `404` → false, `429`/`403` → throw `GitHubRateLimitError`         |
| `getLatestRelease(repo)` | `GET /repos/{owner}/{repo}/releases/latest` | `200` → `{tag_name, html_url}`, `404` → null (no releases), `429`/`403` → throw |

**Rate limit handling:** both primary and secondary rate limits can return either `403` or `429`. The `handleRateLimit` method determines `resetAt` using the following priority (per GitHub docs):

1. `Retry-After` header (seconds) — present on secondary rate limit responses; takes priority.
2. `X-RateLimit-Reset` header (Unix seconds) — present when the primary rate limit is exhausted.
3. Fallback: `now + 60 s`.

Without `GITHUB_TOKEN` — 60 req/hour; with token — 5,000 req/hour.

### 6.5 Email Service (Nodemailer)

Uses SMTP transport. Two email types:

| Type         | Subject                     | Content                                                              |
| ------------ | --------------------------- | -------------------------------------------------------------------- |
| Confirmation | `Confirm your subscription` | Link `{BASE_URL}/api/confirm/{token}`                                |
| Notification | `New release: {repo} {tag}` | Release link + unsubscribe link `{BASE_URL}/api/unsubscribe/{token}` |

### 6.6 Config Module

Fail-fast validation of env variables on startup:

```
DATABASE_URL          → required
SMTP_HOST             → required
SMTP_PORT             → optional (default: 587)
SMTP_USER             → required
SMTP_PASS             → required
SMTP_FROM             → required
BASE_URL              → optional (default: http://localhost:3000)
GITHUB_TOKEN          → optional (increases rate limit to 5,000/hour)
API_KEY               → optional (enables X-API-Key auth)
SCANNER_CRON_SCHEDULE → optional (default: '0 * * * *')
ALLOWED_ORIGIN        → optional (default: '*')
PORT                  → optional (default: 3000)
```

---

## 7. Data Model

### Database Schema

```sql
-- Tracked repositories
CREATE TABLE repositories (
  repo          TEXT PRIMARY KEY,        -- 'owner/repo', e.g. 'golang/go'
  last_seen_tag TEXT                     -- last known release tag, NULL if never checked
);

-- User subscriptions
CREATE TABLE subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT NOT NULL,
  repo              TEXT NOT NULL REFERENCES repositories(repo) ON DELETE CASCADE,
  confirm_token     TEXT NOT NULL UNIQUE,      -- hex 64 chars, crypto.randomBytes(32)
  unsubscribe_token TEXT NOT NULL UNIQUE,      -- hex 64 chars, crypto.randomBytes(32)
  status            TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'confirmed'

  UNIQUE (email, repo)
);
```

### ER Diagram

```mermaid
erDiagram
    repositories {
        TEXT repo PK
        TEXT last_seen_tag
    }
    subscriptions {
        UUID id PK
        TEXT email
        TEXT repo FK
        TEXT confirm_token "UNIQUE"
        TEXT unsubscribe_token "UNIQUE"
        TEXT status
    }
    repositories ||--o{ subscriptions : "has"
```

### Migrations

Managed via Knex migrations (`src/db/migrations/`). Applied automatically on container start via `docker-entrypoint.sh`:

```sh
node dist/migrate.js   # knex migrate:latest
node dist/index.js     # start the service
```

---

## 8. API Integration

### 8.1 REST API Reference

**Base URL:** `/api`  
**Content-Type:** `application/json` or `application/x-www-form-urlencoded`  
**Auth:** `X-API-Key: <key>` (if `API_KEY` is set in `.env`)

---

#### `POST /api/subscribe`

Subscribe to release notifications for a repository.

**Request:**

```json
{ "email": "user@example.com", "repo": "golang/go" }
```

**Responses:**

| Status             | Description                                         |
| ------------------ | --------------------------------------------------- |
| `200 OK`           | Subscription created, confirmation email sent       |
| `400 Bad Request`  | Invalid email or repo format                        |
| `401 Unauthorized` | Missing or invalid API key                          |
| `404 Not Found`    | Repository not found on GitHub                      |
| `409 Conflict`     | This email is already subscribed to this repository |

---

#### `GET /api/confirm/:token`

Confirm a subscription using the token from the confirmation email.

**Path param:** `token` — 64-character hex string

**Responses:**

| Status            | Description            |
| ----------------- | ---------------------- |
| `200 OK`          | Subscription confirmed |
| `400 Bad Request` | Invalid token format   |
| `404 Not Found`   | Token not found        |

> **Note on HTTP semantics:** RFC 9110 requires `GET` to be safe and idempotent (no state mutation). This endpoint intentionally violates that constraint because confirmation links are opened directly by the browser from an email — there is no opportunity to use `POST` without serving an intermediate HTML page. The trade-off is accepted for simplicity at the MVP stage. A stricter alternative would be: `GET /api/confirm/:token` renders an HTML page with a "Confirm" button, which submits `POST /api/confirm/:token` to perform the actual state change.

---

#### `GET /api/unsubscribe/:token`

Unsubscribe using the token from a notification email.

**Path param:** `token` — 64-character hex string

**Responses:**

| Status            | Description               |
| ----------------- | ------------------------- |
| `200 OK`          | Successfully unsubscribed |
| `400 Bad Request` | Invalid token format      |
| `404 Not Found`   | Token not found           |

> **Note on HTTP semantics:** same trade-off as `GET /api/confirm/:token` above — the unsubscribe link is embedded in notification emails and must work with a single browser `GET`. A fully RFC-compliant design would serve an HTML confirmation page first and perform the deletion via `POST`.

---

#### `GET /api/subscriptions?email=...`

Get all active subscriptions for an email address.

**Query param:** `email` — email address

**Response `200`:**

```json
[
  {
    "email": "user@example.com",
    "repo": "golang/go",
    "confirmed": true,
    "last_seen_tag": "go1.22.0"
  }
]
```

---

### 8.2 GitHub REST API Integration

| Purpose                    | Endpoint                                                      | Method |
| -------------------------- | ------------------------------------------------------------- | ------ |
| Check repository existence | `https://api.github.com/repos/{owner}/{repo}`                 | GET    |
| Get latest release         | `https://api.github.com/repos/{owner}/{repo}/releases/latest` | GET    |

**Headers:**

```
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2022-11-28
Authorization: Bearer {GITHUB_TOKEN}   (optional)
```

**Rate limits:**

| Mode                | Limit                |
| ------------------- | -------------------- |
| Without token       | 60 req/hour (per IP) |
| With `GITHUB_TOKEN` | 5,000 req/hour       |

When the rate limit is exceeded (status 429), the service throws `GitHubRateLimitError` and logs the reset time from `X-RateLimit-Reset`.

### 8.3 SMTP Integration

Nodemailer over standard SMTP. Compatible with any SMTP provider:

| Provider | SMTP_HOST          | SMTP_PORT |
| -------- | ------------------ | --------- |
| Gmail    | `smtp.gmail.com`   | `587`     |
| Resend   | `smtp.resend.com`  | `465`     |
| Mailgun  | `smtp.mailgun.org` | `587`     |

---

## 9. Observability

### 9.1 Logging (current)

Structured JSON logging is implemented via **Pino** with `pino-http` for HTTP request logging. Logs are aggregated via the **ELK stack** (see [ADR-003](adr/ADR-003-elk-stack-logging.md)).

| Level   | When used                                                               |
| ------- | ----------------------------------------------------------------------- |
| `DEBUG` | Verbose internal details (disabled in production)                       |
| `INFO`  | Successful operations: subscription created, email sent, scan completed |
| `ERROR` | Failures: GitHub API errors, SMTP errors, unexpected exceptions         |

Every HTTP request is logged with method, URL, status code, and response time. The scanner logs each cycle: repositories checked, new releases found, emails sent.

**Log pipeline:**

```
Node.js (Pino JSON) → Docker log driver → Filebeat → Elasticsearch → Kibana
```

Filebeat reads container logs via the Docker socket and uses the `co.elastic.logs/*` labels on the `app` container to parse output as JSON. In production, Kibana is available at `https://<DOMAIN>/kibana` behind Caddy `basic_auth`.

**Index template (`es-init`):**

An `es-init` one-shot container (`curlimages/curl`) runs on every `docker compose up`, after Elasticsearch passes its health check. It applies the composable index template from `elasticsearch/index-template.json` via `PUT /_index_template/app-logs`. A `dynamic_template` maps any unmapped string field to `keyword` by default, preventing Elasticsearch from auto-guessing `text` for new fields.

### 9.2 Metrics (current)

Metrics are exposed at `GET /metrics` in Prometheus exposition format via **prom-client**. The endpoint is blocked externally by Caddy (`respond 404`) — only Prometheus scrapes it internally over the Docker network every 15 s.

**Metric pipeline:**

```
Node.js (prom-client) → GET /metrics → Prometheus (scrape) → Grafana (visualise)
```

**Grafana** is available at `https://<DOMAIN>/grafana` behind Caddy `basic_auth`. On startup it auto-provisions Prometheus as the default datasource and loads the pre-built dashboard from `grafana/dashboards/github-scanner.json`.

| Metric                              | Type      | Labels                      | Description                              |
| ----------------------------------- | --------- | --------------------------- | ---------------------------------------- |
| `http_requests_total`               | Counter   | method, route, status_code  | Total HTTP requests                      |
| `http_request_duration_seconds`     | Histogram | method, route, status_code  | Request latency — P50/P95/P99            |
| `github_api_requests_total`         | Counter   | operation, result           | GitHub API calls by operation and result |
| `subscription_operations_total`     | Counter   | operation, result           | Subscribe/confirm/unsubscribe outcomes   |
| `scanner_releases_detected_total`   | Counter   | repo                        | New releases found per repository        |
| `scanner_emails_sent_total`         | Counter   | repo                        | Notification emails sent per repository  |
| `scanner_scan_duration_seconds`     | Histogram | result                      | Full scanner cycle duration              |

Default Node.js runtime metrics (CPU, heap, RSS, event-loop lag) are also collected via `collectDefaultMetrics()`.

### 9.3 Alerting (planned)

> Not yet implemented.

| Alert             | Condition                                        |
| ----------------- | ------------------------------------------------ |
| Service down      | No successful HTTP responses for > 2 min         |
| Scanner stalled   | No scan cycle completed within 2× cron interval  |
| GitHub rate limit | `github_api_errors_total{type="rate_limit"}` > 0 |
| High error rate   | HTTP 5xx rate > 1% over 5 min                    |

---

## 10. Testing and CI

### 10.1 Test Strategy

The project uses **Jest** as the test runner with **Supertest** for HTTP-layer integration tests.

| Layer       | Tool             | Scope                                                         |
| ----------- | ---------------- | ------------------------------------------------------------- |
| Unit        | Jest             | Individual service and middleware functions in isolation      |
| Integration | Jest + Supertest | Full HTTP request/response cycle against a real test database |

**Unit tests** (`src/**/__tests__/`) mock all external dependencies (database, GitHub API, SMTP) and verify business logic in isolation:

| File                             | What is tested                                                             |
| -------------------------------- | -------------------------------------------------------------------------- |
| `subscriptionService.test.ts`    | Subscribe, confirm, unsubscribe, duplicate detection                       |
| `scannerService.test.ts`         | Scan cycle: grouping by repo, new release detection, notification dispatch |
| `githubService.test.ts`          | Repository existence check, latest release fetch, rate limit handling      |
| `emailService.test.ts`           | Confirmation and notification email rendering and dispatch                 |
| `subscriptionController.test.ts` | Request validation, error mapping to HTTP status codes                     |
| `apiKeyAuth.test.ts`             | Timing-safe API key comparison, missing/invalid key rejection              |

**Integration tests** (`tests/integration/subscription.test.ts`) spin up the full Express application and verify end-to-end HTTP flows: subscribe → confirm → receive notification → unsubscribe. All tests mock the Knex connection and service layer, so the full suite runs without any external dependencies (no real PostgreSQL required).

### 10.2 CI Pipeline

Implemented in `.github/workflows/ci.yml` using GitHub Actions.

```mermaid
flowchart LR
    Trigger["Push to main\nor PR to main"]
    Trigger --> Build["build\nnpm run build"]
    Trigger --> Lint["lint\nnpm run lint\nnpm run format:check"]
    Trigger --> Typecheck["typecheck\nnpm run typecheck"]
    Trigger --> Test["test\nnpm test"]
    Build & Lint & Typecheck & Test -->|"push to main only"| Deploy["deploy\nSSH → EC2\ngit pull · docker compose up"]
```

All four check jobs run in **parallel** on every push to `main` and every PR targeting `main`.

| Job         | Steps                                                                                              |
| ----------- | -------------------------------------------------------------------------------------------------- |
| `build`     | `npm ci` → `npm run build` — verifies the TypeScript compiles without emit errors                  |
| `lint`      | `npm ci` → `npm run lint` → `npm run format:check` — ESLint + Prettier                             |
| `typecheck` | `npm ci` → `npm run typecheck` — `tsc --noEmit` for type errors without full compilation           |
| `test`      | `npm ci` → `npm test` — full Jest suite (no external services required)                            |
| `deploy`    | SSH into EC2 → `git pull` → `docker compose --profile production up -d --build` → prune old images |

The `deploy` job runs **only on a push to `main`** (i.e. after a PR is merged) and requires all four jobs above to pass first. It never runs on PR events. Required repository secrets: `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`, `EC2_WORK_DIR`.

---

## 11. Future Work

Architectural decisions deferred until the project scales beyond a single EC2 instance are tracked as ADRs:

- [ADR-002: Scanner Deduplication Under Horizontal Scaling](adr/ADR-002-scanner-horizontal-scaling.md)
- [ADR-003: ELK Stack for Log Aggregation](adr/ADR-003-elk-stack-logging.md)
