# QuAir Search

QuAir Search is a full-stack search experience that combines live web results with an AI overview, plus a fast, modern UI.

## What’s included

- FastAPI backend (search, suggestions, trending, auth, attachments, translation)
- OpenSearch indexing + ranking (BM25/freshness/authority boosts)
- PostgreSQL + Redis for storage/caching
- Static frontend (vanilla JS/CSS) served by the backend
- Docker Compose + Kubernetes manifests

## Run locally (Docker)

```powershell
cd G:\Quantum_SEO\infra\docker
docker-compose -p quantum_seo up -d --build
Start-Process "http://localhost:3000"
```

Stop:

```powershell
cd G:\Quantum_SEO\infra\docker
docker-compose -p quantum_seo down
```

## Run locally without Docker

Use this mode for frontend smoke testing on `localhost:3000` when Postgres, Redis, and OpenSearch are not running locally.

```powershell
cd G:\Quantum_SEO
node scripts/local_dev_server.mjs
Start-Process "http://localhost:3000"
```

Run the no-Docker smoke test:

```powershell
cd G:\Quantum_SEO
node tests/local_dev_server.test.mjs
```

<<<<<<< HEAD
## Backup & restore snapshots

Use the database URL in `.env` to create and restore PostgreSQL snapshots.

Create a new snapshot:

```powershell
cd G:\Quantum_SEO
python .\scripts\db_snapshot.py backup
```

Restore a snapshot from the latest file:

```powershell
cd G:\Quantum_SEO
python .\scripts\db_snapshot.py restore
```

Restore a specific snapshot file:

```powershell
cd G:\Quantum_SEO
python .\scripts\db_snapshot.py restore backups\quantum_seo_backup_20260501_123456.dump
```

List available snapshots:

```powershell
cd G:\Quantum_SEO
python .\scripts\db_snapshot.py list
```

The script uses `pg_dump`/`pg_restore` from your PostgreSQL client tools and will read `DATABASE_URL` from your environment or `.env`.

=======
>>>>>>> 082393a (Remove nested repo and clean structure)
## Deployment notes

This repository includes both a static frontend and a Python backend. Choose a deployment platform that can run the backend services (FastAPI + OpenSearch + Postgres + Redis).

