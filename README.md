# device-event-service

Service for ingesting device events.

## How to run

Requirements: Node.js 20+, Docker.

```bash
npm install
docker compose up -d   # Postgres on localhost:5433
```

## How to run the tests

```bash
npm test               # unit tests
docker compose up -d   # e2e tests need Postgres
npm run test:e2e
```

