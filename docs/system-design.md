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

| # | Requirement |
|---|-------------|
| F-01 | A user can subscribe to notifications by providing an email and an `owner/repo` slug |
| F-02 | The system validates repository existence via the GitHub REST API before persisting the subscription |
| F-03 | A subscription is activated only after email confirmation (double opt-in) |
| F-04 | The system sends a confirmation email with a verification link after a subscription is registered |
| F-05 | The system sends email notifications to all confirmed subscribers when a new release is detected |
| F-06 | Every notification email contains an unsubscribe link with a one-time token |
| F-07 | A user can unsubscribe at any time by following their unique unsubscribe link |
| F-08 | The system exposes an API to list all active subscriptions for a given email |
| F-09 | The `(email, repo)` pair is unique — a duplicate subscription returns 409 |
| F-10 | A static landing page allows subscribing without calling the API directly |
| F-11 | Swagger UI is available at `/api/docs` for interactive API testing |

### 2.2 Non-Functional Requirements

| Category | Requirement | Target |
|----------|-------------|--------|
| **Availability** | Service uptime | ≥ 99% (single-instance EC2) |
| **Latency** | P95 response time for API requests | < 500 ms (excluding GitHub API latency) |
| **Scalability** | Number of monitored repositories | Up to 1,000 without architectural changes |
| **Reliability** | Single email send failure | Does not stop processing other subscribers (`Promise.allSettled`) |
| **Reliability** | Scanner crash | Does not affect HTTP request handling (graceful logging) |
| **Security** | Brute-force protection | Rate limiting: 100 req / 15 min / IP |
| **Security** | API endpoint protection | Optional `X-API-Key` with timing-safe comparison |
| **Security** | Transport | TLS via Caddy (Let's Encrypt) in production |
| **Configurability** | Start without required env variables | Fail-fast on startup |
| **Maintainability** | Structured JSON logging | Pino, DEBUG/INFO/ERROR levels |
| **Testability** | Unit + integration test coverage | Jest + Supertest |

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

| Metric | Estimate | Note |
|--------|----------|------|
| Active subscribers | ~1,000 | MVP target audience |
| Unique repositories | ~300 | Some subscribers follow the same repo |
| New subscriptions / day | ~20 | `POST /api/subscribe` |
| Confirmations / day | ~18 | ~90% conversion rate |
| Subscription lookups / day | ~10 | `GET /api/subscriptions` |
| GitHub API requests / hour | ~300 | 1 request × 300 repos × 1 time/hour |
| Email notifications / hour | ~50 | ~5% of repos having a new release per hour |

### 4.2 Data

| Table | Row size (estimate) | Rows | Volume |
|-------|---------------------|------|--------|
| `repositories` | ~100 bytes | 300 | ~30 KB |
| `subscriptions` | ~300 bytes | 1,000 | ~300 KB |

**Growth:** +20 subscriptions/day = 6 KB/day → **2 MB/year**. PostgreSQL thresholds are not a concern at any realistic volume.

### 4.3 Bandwidth

| Direction | Estimate | Calculation |
|-----------|----------|-------------|
| Inbound HTTP traffic | ~5 KB/hour | ~20 req × ~250 bytes/req |
| Outbound to GitHub API | ~90 KB/hour | 300 req × ~300 bytes response |
| Outbound email notifications | ~50 KB/hour | 50 emails × ~1 KB/email |
| **Total** | **< 200 KB/hour** | Not a bottleneck |

---

## 5. High-Level Architecture

```mermaid
flowchart TB
    subgraph EC2["EC2 Instance"]
        Caddy["Caddy (TLS)\n:80 / :443"]
        App["Node.js App"]
        PG[("PostgreSQL 16")]
        Caddy <-->|":3000"| App
        App --> PG
    end
    GitHub["GitHub REST API"]
    SMTP["SMTP Server"]
    App --> GitHub
    App --> SMTP
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

| Method | Action |
|--------|--------|
| `subscribe(email, repo)` | Validates repo → checks for duplicate → generates tokens (`crypto.randomBytes(32)`) → persists → sends confirmation email |
| `confirm(token)` | Validates token format (hex 64) → updates status to `confirmed` |
| `unsubscribe(token)` | Validates format → deletes the subscription row |
| `getSubscriptions(email)` | Returns all subscriptions for the given email |

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

| Method | Endpoint | Behavior |
|--------|----------|----------|
| `repositoryExists(repo)` | `GET /repos/{owner}/{repo}` | `200` → true, `404` → false, `429`/`403` → throw `GitHubRateLimitError` |
| `getLatestRelease(repo)` | `GET /repos/{owner}/{repo}/releases/latest` | `200` → `{tag_name, html_url}`, `404` → null (no releases), `429`/`403` → throw |

**Rate limit handling:** both primary and secondary rate limits can return either `403` or `429`. The `handleRateLimit` method determines `resetAt` using the following priority (per GitHub docs):
1. `Retry-After` header (seconds) — present on secondary rate limit responses; takes priority.
2. `X-RateLimit-Reset` header (Unix seconds) — present when the primary rate limit is exhausted.
3. Fallback: `now + 60 s`.

Without `GITHUB_TOKEN` — 60 req/hour; with token — 5,000 req/hour.

### 6.5 Email Service (Nodemailer)

Uses SMTP transport. Two email types:

| Type | Subject | Content |
|------|---------|---------|
| Confirmation | `Confirm your subscription` | Link `{BASE_URL}/api/confirm/{token}` |
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

| Status | Description |
|--------|-------------|
| `200 OK` | Subscription created, confirmation email sent |
| `400 Bad Request` | Invalid email or repo format |
| `401 Unauthorized` | Missing or invalid API key |
| `404 Not Found` | Repository not found on GitHub |
| `409 Conflict` | This email is already subscribed to this repository |

---

#### `GET /api/confirm/:token`

Confirm a subscription using the token from the confirmation email.

**Path param:** `token` — 64-character hex string

**Responses:**

| Status | Description |
|--------|-------------|
| `200 OK` | Subscription confirmed |
| `400 Bad Request` | Invalid token format |
| `404 Not Found` | Token not found |

> **Note on HTTP semantics:** RFC 9110 requires `GET` to be safe and idempotent (no state mutation). This endpoint intentionally violates that constraint because confirmation links are opened directly by the browser from an email — there is no opportunity to use `POST` without serving an intermediate HTML page. The trade-off is accepted for simplicity at the MVP stage. A stricter alternative would be: `GET /api/confirm/:token` renders an HTML page with a "Confirm" button, which submits `POST /api/confirm/:token` to perform the actual state change.

---

#### `GET /api/unsubscribe/:token`

Unsubscribe using the token from a notification email.

**Path param:** `token` — 64-character hex string

**Responses:**

| Status | Description |
|--------|-------------|
| `200 OK` | Successfully unsubscribed |
| `400 Bad Request` | Invalid token format |
| `404 Not Found` | Token not found |

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

| Purpose | Endpoint | Method |
|---------|----------|--------|
| Check repository existence | `https://api.github.com/repos/{owner}/{repo}` | GET |
| Get latest release | `https://api.github.com/repos/{owner}/{repo}/releases/latest` | GET |

**Headers:**
```
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2022-11-28
Authorization: Bearer {GITHUB_TOKEN}   (optional)
```

**Rate limits:**

| Mode | Limit |
|------|-------|
| Without token | 60 req/hour (per IP) |
| With `GITHUB_TOKEN` | 5,000 req/hour |

When the rate limit is exceeded (status 429), the service throws `GitHubRateLimitError` and logs the reset time from `X-RateLimit-Reset`.

### 8.3 SMTP Integration

Nodemailer over standard SMTP. Compatible with any SMTP provider:

| Provider | SMTP_HOST | SMTP_PORT |
|----------|-----------|-----------|
| Gmail | `smtp.gmail.com` | `587` |
| Resend | `smtp.resend.com` | `465` |
| Mailgun | `smtp.mailgun.org` | `587` |

---

## 9. Observability

### 9.1 Logging (current)

Structured JSON logging is implemented via **Pino** with `pino-http` for HTTP request logging.

| Level | When used |
|-------|-----------|
| `DEBUG` | Verbose internal details (disabled in production) |
| `INFO` | Successful operations: subscription created, email sent, scan completed |
| `ERROR` | Failures: GitHub API errors, SMTP errors, unexpected exceptions |

Every HTTP request is logged with method, URL, status code, and response time. The scanner logs each cycle: repositories checked, new releases found, emails sent.

### 9.2 Metrics (planned)

> Not yet implemented. Planned for a future course milestone.

| Metric | Type | Description |
|--------|------|-------------|
| `http_requests_total` | Counter | Total HTTP requests by method, route, status |
| `http_request_duration_ms` | Histogram | P50/P95/P99 response times |
| `scanner_cycle_duration_ms` | Histogram | Duration of each full scan cycle |
| `scanner_repos_checked_total` | Counter | Repositories checked per cycle |
| `scanner_notifications_sent_total` | Counter | Notification emails sent per cycle |
| `github_api_errors_total` | Counter | GitHub API failures by error type |
| `smtp_errors_total` | Counter | SMTP delivery failures |

**Planned stack:** Prometheus exposition format via `prom-client`, scraped by a Prometheus instance, visualised in Grafana.

### 9.3 Alerting (planned)

> Not yet implemented.

| Alert | Condition |
|-------|-----------|
| Service down | No successful HTTP responses for > 2 min |
| Scanner stalled | No scan cycle completed within 2× cron interval |
| GitHub rate limit | `github_api_errors_total{type="rate_limit"}` > 0 |
| High error rate | HTTP 5xx rate > 1% over 5 min |

---

## 10. Testing and CI

### 10.1 Test Strategy

The project uses **Jest** as the test runner with **Supertest** for HTTP-layer integration tests.

| Layer | Tool | Scope |
|-------|------|-------|
| Unit | Jest | Individual service and middleware functions in isolation |
| Integration | Jest + Supertest | Full HTTP request/response cycle against a real test database |

**Unit tests** (`src/**/__tests__/`) mock all external dependencies (database, GitHub API, SMTP) and verify business logic in isolation:

| File | What is tested |
|------|----------------|
| `subscriptionService.test.ts` | Subscribe, confirm, unsubscribe, duplicate detection |
| `scannerService.test.ts` | Scan cycle: grouping by repo, new release detection, notification dispatch |
| `githubService.test.ts` | Repository existence check, latest release fetch, rate limit handling |
| `emailService.test.ts` | Confirmation and notification email rendering and dispatch |
| `subscriptionController.test.ts` | Request validation, error mapping to HTTP status codes |
| `apiKeyAuth.test.ts` | Timing-safe API key comparison, missing/invalid key rejection |

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

| Job | Steps |
|-----|-------|
| `build` | `npm ci` → `npm run build` — verifies the TypeScript compiles without emit errors |
| `lint` | `npm ci` → `npm run lint` → `npm run format:check` — ESLint + Prettier |
| `typecheck` | `npm ci` → `npm run typecheck` — `tsc --noEmit` for type errors without full compilation |
| `test` | `npm ci` → `npm test` — full Jest suite (no external services required) |
| `deploy` | SSH into EC2 → `git pull` → `docker compose --profile production up -d --build` → prune old images |

The `deploy` job runs **only on a push to `main`** (i.e. after a PR is merged) and requires all four jobs above to pass first. It never runs on PR events. Required repository secrets: `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`, `EC2_WORK_DIR`.

---

## 11. Future Work

### Duplicate Notifications Under Horizontal Scaling

**Problem:** when multiple service instances are running, each independently triggers `node-cron` and executes a full scan cycle. All instances send emails simultaneously — subscribers receive duplicate notifications.

#### Option 1 — PostgreSQL Advisory Lock (minimal changes)

Before starting the scan cycle, an instance attempts to acquire a session-level advisory lock via `pg_try_advisory_lock(bigint)`. If the lock is already held by another instance, the current one simply skips the tick.

```sql
-- scanner executes before starting work
SELECT pg_try_advisory_lock(12345);
-- returns true  → this instance runs the scan
-- returns false → another instance is already running, skip tick
```

**Pros:** requires no new infrastructure; implemented in a few lines of code.  
**Cons:** the lock is tied to the session — a crashed process automatically releases the lock, but there may be a window with no scanning between process death and the next tick.

#### Option 2 — Leader Election with Heartbeat

Extension of Option 1: a background interval (e.g. every 30 s) holds the lock and updates `last_heartbeat` in a dedicated `scanner_leader` table. Other instances check heartbeat freshness and take over the leader role if the current leader has been silent for longer than N seconds.

```sql
CREATE TABLE scanner_leader (
  id             INT PRIMARY KEY DEFAULT 1,  -- always a single row
  instance_id    TEXT NOT NULL,
  last_heartbeat TIMESTAMPTZ NOT NULL
);
```

**Pros:** automatic failover when the leader crashes; transparent logic.  
**Cons:** additional table + heartbeat logic; slight extra DB load.

#### Option 3 — Extract the Scanner into a Dedicated Worker

Move the scan cycle into a standalone service/container (`scanner-worker`) that is always deployed as a single instance (`replicas: 1` in Docker Compose / Kubernetes Deployment). The HTTP server scales horizontally and independently.

```mermaid
flowchart TB
    LB[Load Balancer]
    LB --> API["api (replicas: N)\nhorizontally scaled"]
    Scanner["scanner (replicas: 1)\nalways a single instance"]
```

**Pros:** architecturally clean separation of concerns; eliminates the duplication problem without any lock mechanisms.  
**Cons:** requires refactoring the deployment and a separate Docker image or entrypoint. Still a single-threaded bottleneck — does not scale beyond one worker and does not protect against job overlap (a slow scan cycle can still be overtaken by the next cron tick).

#### Option 4 — Distributed Work Queue

Addresses two problems that Options 1–3 do not solve simultaneously: **safe parallel execution** across multiple workers and **job overlap prevention** when a scan cycle exceeds the cron interval.

**How it works:**

1. A lightweight cron process runs on a single instance and only **enqueues one job per repository** into a shared queue on each tick — it performs no GitHub API calls itself.
2. A pool of **N stateless scanner workers** dequeue and process jobs independently, each making exactly one GitHub API request per job.
3. Jobs have a **visibility timeout**: if a worker crashes mid-job, the job becomes visible again after the timeout and is retried by another worker — no repository is silently skipped.
4. The cron process can safely fire even if the previous wave of jobs is still being processed — workers drain the queue at their own pace without overlap.

```mermaid
flowchart LR
    Cron["Cron (single)\nenqueues 1 job / repo"] --> Queue[("Job Queue\ne.g. BullMQ / SQS")]
    Queue --> W1["Scanner Worker 1"]
    Queue --> W2["Scanner Worker 2"]
    Queue --> W3["Scanner Worker N"]
    W1 & W2 & W3 --> GH["GitHub API"]
    W1 & W2 & W3 --> DB[("PostgreSQL")]
    W1 & W2 & W3 --> SMTP["SMTP"]
```

**Queue options:**

| Option | Infrastructure | Notes |
|--------|---------------|-------|
| BullMQ + Redis | Redis instance | Good fit for Node.js; supports retries, delays, concurrency limits |
| PostgreSQL SKIP LOCKED | No new infra | Uses `SELECT … FOR UPDATE SKIP LOCKED`; works well at moderate scale |
| AWS SQS | Managed AWS | Natural fit if already on AWS; visibility timeout built-in |

**Pros:** true horizontal scalability — add workers to increase throughput linearly; overlap-safe by design; built-in retries on worker crash.  
**Cons:** introduces a new infrastructure component (queue broker); significantly more complex than Options 1–3.

#### Recommended Path

For the current constraints (single EC2), **Option 1** is sufficient — it eliminates the risk of duplicate notifications if two instances are accidentally started, with zero infrastructure changes. When moving to production-scale with a high number of repositories or strict latency requirements, **Option 4** is the correct long-term solution; **Option 3** is a reasonable intermediate step.
