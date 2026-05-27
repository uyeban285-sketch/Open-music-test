# Open Music — Dev Infrastructure

## Quick Start

```bash
cd infra/docker
docker compose -f docker-compose.dev.yml --env-file .env.dev up -d
```

## Services

| Service     | Port  | Description                           |
|-------------|-------|---------------------------------------|
| PostgreSQL  | 5432  | Main DB (pgvector, pgcrypto, citext)  |
| Redis       | 6379  | Cache, queues, pub-sub                |
| MinIO       | 9000  | S3-compatible object storage          |
| MinIO UI    | 9001  | MinIO console                         |
| Mailhog     | 8025  | SMTP stub (email preview UI)          |
| LocalStack  | 4566  | KMS emulation for envelope encryption |

## Seed Data

After services are running:

```bash
pnpm db:seed:dev
```

This creates two dev users (admin + listener), feature flags, and connector fixtures.
