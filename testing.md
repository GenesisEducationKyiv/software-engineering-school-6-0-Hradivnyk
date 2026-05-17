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

Docker starts automatically. Migrations run inside the container on startup.

```bash
npm run test:e2e:ci
```

---

## All tests

```bash
npm test
```
