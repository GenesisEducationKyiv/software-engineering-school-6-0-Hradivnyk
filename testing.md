# Testing

## Prerequisites

- Git
- Docker
- Node.js (LTS)

```bash
git clone <repo-url>
cd <repo>
npm install
```

---

## Unit tests

```bash
npm run test:unit
```

---

## Integration tests

Docker starts and stops automatically.

```bash
npm run test:integration:ci
```

---

## E2E tests (browser)

Install Playwright browsers once before the first run:

```bash
npx playwright install --with-deps chromium
```

Docker starts and stops automatically. Uses `docker-compose.yml` + `docker-compose.e2e.yml` override (no `.env` file required).

```bash
npm run test:e2e:ci
```

To run against a manually started server (e.g. `npm run dev`):

```bash
PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:e2e
```

---

## All tests

```bash
npm test
```
