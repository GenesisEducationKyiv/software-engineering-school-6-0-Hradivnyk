# System Design: Release Owl

## Зміст

1. [Огляд системи](#1-огляд-системи)
2. [Вимоги системи](#2-вимоги-системи)
3. [Обмеження](#3-обмеження)
4. [Оцінка навантаження](#4-оцінка-навантаження)
5. [High-level архітектура](#5-high-level-архітектура)
6. [Детальний дизайн компонентів](#6-детальний-дизайн-компонентів)
7. [Модель даних](#7-модель-даних)
8. [API Integration](#8-api-integration)
9. [Безпека](#9-безпека)
10. [Спостережуваність](#10-спостережуваність)
11. [Деплоймент](#11-деплоймент)

---

## 1. Огляд системи

**Release Owl** — HTTP-сервіс, що дозволяє користувачам підписуватися на email-сповіщення про нові релізи GitHub-репозиторіїв. Сервіс регулярно опитує GitHub API та надсилає листи підписникам при виявленні нового тегу релізу.

```
Користувач → POST /api/subscribe
                    ↓
           Валідація репо (GitHub API)
                    ↓
           Збереження у PostgreSQL
                    ↓
           Відправка confirmation email
                    ↓
           Користувач підтверджує підписку
                    ↓
[cron] Сканер → GitHub API → новий реліз? → Email-сповіщення всім підписникам
```

---

## 2. Вимоги системи

### 2.1 Функціональні вимоги

| # | Вимога |
|---|--------|
| F-01 | Користувач може підписатися на сповіщення, вказавши email та `owner/repo` slug |
| F-02 | Система перевіряє існування репозиторію через GitHub REST API перед збереженням підписки |
| F-03 | Підписка активується лише після підтвердження email (double opt-in) |
| F-04 | Система надсилає email з посиланням для підтвердження після реєстрації підписки |
| F-05 | Система надсилає email-сповіщення всім підтвердженим підписникам при виявленні нового релізу |
| F-06 | Кожен лист сповіщення містить unsubscribe-посилання з одноразовим токеном |
| F-07 | Користувач може відписатися у будь-який момент, перейшовши за унікальним посиланням |
| F-08 | Система надає API для перегляду всіх активних підписок для конкретного email |
| F-09 | Пара `(email, repo)` унікальна — повторна підписка повертає 409 |
| F-10 | Статична landing page дозволяє підписатися без використання API напряму |
| F-11 | Swagger UI доступний за `/api/docs` для інтерактивного тестування API |

### 2.2 Нефункціональні вимоги

| Категорія | Вимога | Ціль |
|-----------|--------|------|
| **Доступність** | Uptime сервісу | ≥ 99% (single-instance EC2) |
| **Затримка** | P95 відповідь на API-запити | < 500 ms (без урахування GitHub API) |
| **Масштабованість** | Кількість репозиторіїв, що моніторяться | До 1 000 без зміни архітектури |
| **Надійність** | Помилка надсилання одного листа | Не зупиняє обробку решти підписників (`Promise.allSettled`) |
| **Надійність** | Crash сканера | Не впливає на обробку HTTP-запитів (graceful logging) |
| **Безпека** | Захист від brute-force | Rate limiting: 100 req / 15 хв / IP |
| **Безпека** | Захист API-ендпоінтів | Опціональний `X-API-Key` з timing-safe порівнянням |
| **Безпека** | Транспорт | TLS через Caddy (Let's Encrypt) у production |
| **Конфігурованість** | Запуск без ключових env-змінних | Fail-fast при старті |
| **Підтримуваність** | Структурований JSON-logging | Pino, рівень DEBUG/INFO/ERROR |
| **Тестованість** | Покриття unit + integration тестами | Jest + Supertest |

---

## 3. Обмеження

### Технічні обмеження

- **GitHub API rate limit без токена:** 60 запитів/год на IP. При N унікальних репозиторіях та годинному крон-розкладі система може обробити максимум 60 репо без `GITHUB_TOKEN`. З токеном — 5 000 запитів/год.
- **In-process scheduler:** `node-cron` виконується в тому ж Event Loop, що й HTTP-сервер. Тривалий scan-цикл може затримати обробку HTTP-запитів при великій кількості репозиторіїв.
- **Немає retry-механізму** для emails та GitHub-запитів: тимчасові помилки SMTP або GitHub API призводять до пропуску сповіщення до наступного cron-тіку.
- **Відсутність горизонтального масштабування:** один процес + один DB-інстанс. Кілька запущених екземплярів призведуть до дублювання сповіщень.

### Бізнес-обмеження

- Сервіс моніторить лише **публічні GitHub-репозиторії** (без OAuth для private repos).
- Відстежуються лише **офіційні релізи** GitHub (`/releases/latest`), не теги та не pre-release.
- Для кожної пари `(email, repo)` підтримується лише **одна активна підписка**.

### Інфраструктурні обмеження

- Деплой на **одному EC2-інстансі** (без load balancer, без auto-scaling).
- База даних — **single-node PostgreSQL** без реплік та резервного копіювання за межами Docker volume.

---

## 4. Оцінка навантаження

### 4.1 Користувачі та трафік

| Метрика | Оцінка | Примітка |
|---------|--------|---------|
| Активних підписників | ~1 000 | Цільова аудиторія MVP |
| Унікальних репозиторіїв | ~300 | Частина підписників підписана на одне й те саме репо |
| Нових підписок / день | ~20 | `POST /api/subscribe` |
| Підтверджень / день | ~18 | ~90% конверсія |
| Перегляд підписок / день | ~10 | `GET /api/subscriptions` |
| GitHub API запитів / год | ~300 | 1 запит × 300 репо × 1 раз/год |
| Email-сповіщень / год | ~50 | При ~5% репо що мають новий реліз за годину |


### 4.2 Дані

| Таблиця | Розмір рядка (estimate) | Рядків | Обсяг |
|---------|------------------------|--------|-------|
| `repositories` | ~100 байт | 300 | ~30 KB |
| `subscriptions` | ~300 байт | 1 000 | ~300 KB |

**Зростання:** +20 підписок / день = 6 KB / день → **2 MB / рік**. Порогові значення для PostgreSQL не є проблемою за будь-якого реалістичного обсягу.

### 4.3 Bandwidth

| Напрямок | Оцінка | Розрахунок |
|----------|--------|-----------|
| Вхідний HTTP-трафік | ~5 KB/год | ~20 req × ~250 байт/req |
| Вихідний до GitHub API | ~90 KB/год | 300 req × ~300 байт response |
| Вихідні email-сповіщення | ~50 KB/год | 50 листів × ~1 KB/лист |
| **Разом** | **< 200 KB/год** | Не є вузьким місцем |

---

## 5. High-level архітектура

```
┌─────────────────────────────────────────────────────────────────┐
│                        EC2 Instance                             │
│                                                                 │
│  ┌──────────┐   :80/:443   ┌─────────────────────────────────┐ │
│  │  Caddy   │◄────────────►│       Node.js Process           │ │
│  │ (TLS)    │   :3000      │                                 │ │
│  └──────────┘              │  ┌──────────┐  ┌─────────────┐ │ │
│                            │  │ Express  │  │ node-cron   │ │ │
│                            │  │  HTTP    │  │  Scanner    │ │ │
│                            │  └────┬─────┘  └──────┬──────┘ │ │
│                            │       │               │         │ │
│                            │  ┌────▼───────────────▼──────┐ │ │
│                            │  │     Service Layer          │ │ │
│                            │  │  subscriptionService       │ │ │
│                            │  │  scannerService            │ │ │
│                            │  │  githubService             │ │ │
│                            │  │  emailService              │ │ │
│                            │  └────┬───────────────────────┘ │ │
│                            │       │                         │ │
│                            │  ┌────▼──────┐                 │ │
│                            │  │  Knex     │                 │ │
│                            │  │  Models   │                 │ │
│                            └──└────┬──────┘─────────────────┘ │
│                                    │                           │
│  ┌─────────────────────────────────▼───────────────────────┐  │
│  │              PostgreSQL 16                               │  │
│  │         (Docker container, named volume)                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
          │                             │
          ▼                             ▼
   GitHub REST API               SMTP Server
   api.github.com                (Resend/Gmail/etc.)
```

### Потік підписки (Happy Path)

```
Client          Express         subscriptionService    GitHub API      SMTP
  │                │                    │                   │            │
  │ POST /subscribe│                    │                   │            │
  │───────────────►│                    │                   │            │
  │                │ subscribe(email,   │                   │            │
  │                │ repo)              │                   │            │
  │                │───────────────────►│                   │            │
  │                │                    │ GET /repos/{repo} │            │
  │                │                    │──────────────────►│            │
  │                │                    │◄──────────────────│            │
  │                │                    │ INSERT subscription│           │
  │                │                    │───────────────────►[DB]        │
  │                │                    │ sendConfirmEmail  │            │
  │                │                    │──────────────────────────────►│
  │◄───────────────│ 200 OK             │                   │            │
  │                │                    │                   │            │
  │ GET /confirm/:token                 │                   │            │
  │───────────────►│ confirm(token)     │                   │            │
  │                │───────────────────►│                   │            │
  │                │                    │ UPDATE status=confirmed        │
  │◄───────────────│ 200 OK             │                   │            │
```

### Потік сканування

```
node-cron         scannerService      DB             GitHub API      SMTP
    │                   │              │                  │             │
    │ (cron tick)       │              │                  │             │
    │──────────────────►│              │                  │             │
    │                   │ findAllConfirmed                │             │
    │                   │─────────────►│                  │             │
    │                   │◄─────────────│                  │             │
    │                   │              │                  │             │
    │                   │ [for each repo]                 │             │
    │                   │ getLatestRelease(repo)          │             │
    │                   │─────────────────────────────►  │             │
    │                   │◄─────────────────────────────  │             │
    │                   │              │                  │             │
    │                   │ [if new tag] sendNotificationEmail            │
    │                   │──────────────────────────────────────────────►
    │                   │ updateLastSeenTag               │             │
    │                   │─────────────►│                  │             │
```

---

## 6. Детальний дизайн компонентів

### 6.1 HTTP Server (Express 5)

**Middleware pipeline** (в порядку виконання):

```
express.static(public/)        → статична landing page
helmet()                        → security headers
cors({ origin, methods })       → CORS allowlist
rateLimit(100/15хв/IP)          → захист від brute-force
pinoHttp()                      → structured request logging
express.json()                  → JSON body parsing
express.urlencoded()            → form body parsing
swagger-ui (/api/docs)          → OpenAPI документація
subscriptionRoutes (/api)       → бізнес-ендпоінти
errorHandler()                  → централізована обробка помилок
```

**Error handling:**

- `ZodError` → 400 Bad Request з деталями валідації
- `AppError` (кастомні: `RepositoryNotFoundError`, `DuplicateSubscriptionError`, `InvalidTokenError`, `TokenNotFoundError`) → відповідні HTTP статус-коди
- Несподівані помилки → 500 Internal Server Error (без витоку деталей стека)

### 6.2 Subscription Service

Координує повний lifecycle підписки:

| Метод | Дія |
|-------|-----|
| `subscribe(email, repo)` | Перевіряє репо → перевіряє дублікат → генерує токени (`crypto.randomBytes(32)`) → зберігає → надсилає confirmation email |
| `confirm(token)` | Валідує формат токена (hex 64) → оновлює статус на `confirmed` |
| `unsubscribe(token)` | Валідує формат → видаляє рядок підписки |
| `getSubscriptions(email)` | Повертає всі підписки для email |

### 6.3 Scanner Service

Cron-задача з налаштованим розкладом (`SCANNER_CRON_SCHEDULE`, default: `0 * * * *`):

1. Завантажує всі `confirmed` підписки з `last_seen_tag` одним запитом
2. Групує підписки по `repo` → 1 GitHub API call на репозиторій незалежно від кількості підписників
3. Порівнює `release.tag_name` з `last_seen_tag`
4. При новому релізі: надсилає email всім підписникам через `Promise.allSettled` (один збій не зупиняє решту)
5. Оновлює `last_seen_tag` в таблиці `repositories`

**Важлива деталь:** використання `Promise.allSettled` замість `Promise.all` гарантує, що помилка SMTP для одного підписника не перерве сповіщення інших.

### 6.4 GitHub Service

Тонкий wrapper навколо GitHub REST API v2022-11-28:

| Метод | Endpoint | Поведінка |
|-------|----------|-----------|
| `repositoryExists(repo)` | `GET /repos/{owner}/{repo}` | `200` → true, `404` → false, `429` → throw `GitHubRateLimitError` |
| `getLatestRelease(repo)` | `GET /repos/{owner}/{repo}/releases/latest` | `200` → `{tag_name, html_url}`, `404` → null (немає релізів), `429` → throw |

**Rate limit handling:** при статусі 429 читає заголовок `X-RateLimit-Reset` і кидає `GitHubRateLimitError` з `resetAt: Date`. Без `GITHUB_TOKEN` — 60 req/год, з токеном — 5 000 req/год.

### 6.5 Email Service (Nodemailer)

Використовує SMTP-транспорт. Два типи листів:

| Тип | Тема | Вміст |
|-----|------|-------|
| Confirmation | `Confirm your subscription` | Посилання `{BASE_URL}/api/confirm/{token}` |
| Notification | `New release: {repo} {tag}` | Посилання на реліз + unsubscribe-посилання `{BASE_URL}/api/unsubscribe/{token}` |

### 6.6 Config Module

Fail-fast валідація env-змінних при старті:

```
DATABASE_URL          → required
SMTP_HOST             → required
SMTP_PORT             → optional (default: 587)
SMTP_USER             → required
SMTP_PASS             → required
SMTP_FROM             → required
BASE_URL              → optional (default: http://localhost:3000)
GITHUB_TOKEN          → optional (збільшує rate limit до 5 000/год)
API_KEY               → optional (вмикає X-API-Key auth)
SCANNER_CRON_SCHEDULE → optional (default: '0 * * * *')
ALLOWED_ORIGIN        → optional (default: '*')
PORT                  → optional (default: 3000)
```

---

## 7. Модель даних

### Схема БД

```sql
-- Відстежувані репозиторії
CREATE TABLE repositories (
  repo          TEXT PRIMARY KEY,        -- 'owner/repo', напр. 'golang/go'
  last_seen_tag TEXT                     -- останній відомий тег релізу, NULL якщо не перевірявся
);

-- Підписки користувачів
CREATE TABLE subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT NOT NULL,
  repo              TEXT NOT NULL REFERENCES repositories(repo) ON DELETE CASCADE,
  confirm_token     TEXT NOT NULL UNIQUE,      -- hex 64 символи, crypto.randomBytes(32)
  unsubscribe_token TEXT NOT NULL UNIQUE,      -- hex 64 символи, crypto.randomBytes(32)
  status            TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'confirmed'

  UNIQUE (email, repo)
);
```

### ER-діаграма

```
┌───────────────────────┐         ┌──────────────────────────────┐
│     repositories      │         │        subscriptions         │
├───────────────────────┤         ├──────────────────────────────┤
│ repo (PK)     TEXT    │◄───────│ id            UUID (PK)      │
│ last_seen_tag TEXT    │  1:N    │ email         TEXT           │
└───────────────────────┘         │ repo (FK)     TEXT           │
                                  │ confirm_token TEXT (UNIQUE)  │
                                  │ unsubscribe_token TEXT (UNIQ)│
                                  │ status        TEXT           │
                                  └──────────────────────────────┘
```

### Міграції

Керуються через Knex migrations (`src/db/migrations/`). Автоматично застосовуються при старті контейнера через `docker-entrypoint.sh`:

```sh
node dist/migrate.js   # knex migrate:latest
node dist/index.js     # запуск сервісу
```

---

## 8. API Integration

### 8.1 REST API Reference

**Base URL:** `/api`  
**Content-Type:** `application/json` або `application/x-www-form-urlencoded`  
**Auth:** `X-API-Key: <key>` (якщо `API_KEY` встановлено в `.env`)

---

#### `POST /api/subscribe`

Підписатися на сповіщення про релізи репозиторію.

**Request:**
```json
{ "email": "user@example.com", "repo": "golang/go" }
```

**Responses:**

| Статус | Опис |
|--------|------|
| `200 OK` | Підписка створена, confirmation email надіслано |
| `400 Bad Request` | Некоректний формат email або repo |
| `401 Unauthorized` | Відсутній або невірний API ключ |
| `404 Not Found` | Репозиторій не знайдено на GitHub |
| `409 Conflict` | Цей email вже підписаний на цей репозиторій |

---

#### `GET /api/confirm/:token`

Підтвердити підписку за токеном з листа.

**Path param:** `token` — hex-рядок 64 символи

**Responses:**

| Статус | Опис |
|--------|------|
| `200 OK` | Підписку підтверджено |
| `400 Bad Request` | Невірний формат токена |
| `404 Not Found` | Токен не знайдено |

---

#### `GET /api/unsubscribe/:token`

Відписатися за токеном з email-сповіщення.

**Path param:** `token` — hex-рядок 64 символи

**Responses:**

| Статус | Опис |
|--------|------|
| `200 OK` | Успішно відписано |
| `400 Bad Request` | Невірний формат токена |
| `404 Not Found` | Токен не знайдено |

---

#### `GET /api/subscriptions?email=...`

Отримати всі активні підписки для email.

**Query param:** `email` — адреса електронної пошти

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

| Ціль | Endpoint | Метод |
|------|----------|-------|
| Перевірка існування репо | `https://api.github.com/repos/{owner}/{repo}` | GET |
| Отримання останнього релізу | `https://api.github.com/repos/{owner}/{repo}/releases/latest` | GET |

**Headers:**
```
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2022-11-28
Authorization: Bearer {GITHUB_TOKEN}   (опціонально)
```

**Rate limits:**

| Режим | Ліміт |
|-------|-------|
| Без токена | 60 req/год (per IP) |
| З `GITHUB_TOKEN` | 5 000 req/год |

При перевищенні ліміту (статус 429) сервіс кидає `GitHubRateLimitError` та логує час скидання ліміту з `X-RateLimit-Reset`.

### 8.3 SMTP Integration

Nodemailer через стандартний SMTP. Сумісний із будь-яким SMTP-провайдером:

| Провайдер | SMTP_HOST | SMTP_PORT |
|-----------|-----------|-----------|
| Gmail | `smtp.gmail.com` | `587` |
| Resend | `smtp.resend.com` | `465` |
| Mailgun | `smtp.mailgun.org` | `587` |