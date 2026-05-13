# QuAir Search (Quantum SEO)

QuAir Search is a full-stack search experience: a FastAPI backend (search, suggestions, trending, auth, analytics), OpenSearch-backed retrieval with BM25-style ranking, PostgreSQL and Redis for persistence and caching, and a static vanilla JS/CSS frontend served by the API.

## Repository layout

| Path | Purpose |
|------|---------|
| `backend/` | FastAPI app (`main.py`), APIs, search engine, storage |
| `frontend/` | Static HTML, CSS, and client JavaScript |
| `infra/docker/` | Docker Compose and Dockerfiles for local full stack |
| `infra/k8s/` | Kubernetes example manifests |
| `infra/sql/` | Reference SQL used by `scripts/migrate.py` (legacy bootstrap; migrations live under `backend/db/migrations/`) |
| `scripts/` | Utilities: local dev server, DB migrate/snapshot, health check |
| `tests/` | Python `unittest` suites and Node smoke tests |
| `worker/` | Background workers (crawl, index) |

## Prerequisites

- **Python** 3.11+ (3.12 recommended)
- **Node.js** 18+ (for the static dev server and smoke tests)
- **PostgreSQL**, **Redis**, and **OpenSearch** (or Elasticsearch-compatible URL) when running the full backend locally or in Docker

Copy `.env.example` to `.env` and set `DATABASE_URL`, `REDIS_URL`, and `ES_URL`. Keep **API keys, JWT secrets, OAuth client secrets, database passwords, AWS keys, and deployment tokens** only in `.env`, your shell environment, or a managed secret store — never commit them. `.env` is gitignored; use `infra/k8s/secrets.example.yaml` as a Kubernetes Secret template only after copying to an untracked file or use `kubectl create secret`.

For production, set a strong `JWT_SECRET` (see `validate_security_settings` in `backend/config.py`).

## Run without Docker

From the repository root (so `PYTHONPATH` includes the project):

1. Create a virtual environment and install dependencies:

```powershell
cd G:\Quantum_SEO
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
```

2. Ensure Postgres, Redis, and OpenSearch are reachable using the URLs in `.env`.

3. Apply database migrations (async migrations under `backend/db/migrations/` are applied at startup; optional legacy SQL apply):

```powershell
python scripts\migrate.py
```

4. Start the API (serves the frontend from `frontend/`):

```powershell
$env:PYTHONPATH = "G:\Quantum_SEO"
python -m uvicorn backend.main:app --host 0.0.0.0 --port 3000 --reload
```

Or use the bundled entry point:

```powershell
$env:PYTHONPATH = "G:\Quantum_SEO"
python -m backend.main
```

5. Open `http://localhost:3000` in a browser.

**UI-only smoke (no Python services):** proxies the UI for quick checks when the full stack is not running:

```powershell
cd G:\Quantum_SEO
node scripts\local_dev_server.mjs
```

```powershell
node tests\local_dev_server.test.mjs
```

**Python tests** (install dev tools once: `pip install -r backend\requirements-dev.txt`):

```powershell
cd G:\Quantum_SEO
$env:PYTHONPATH = "G:\Quantum_SEO"
pytest tests\ -v
```

You can also run the unittest-based subset only:

```powershell
python -m unittest discover -s tests -p "test_*.py" -v
```

## Run with Docker

From `infra/docker`:

```powershell
cd G:\Quantum_SEO\infra\docker
docker compose -p quantum_seo up -d --build
```

Then open `http://localhost:3000`. Stop the stack:

```powershell
docker compose -p quantum_seo down
```

Compose binds the repo’s `frontend` and `backend` folders where configured so code edits are reflected after container restart or reload, depending on the service.

## Visual Studio Code

1. **File → Open Folder** and choose the repository root (`Quantum_SEO`).
2. **Python:** Select the interpreter from `.venv` after creating it (Command Palette → “Python: Select Interpreter”).
3. **Terminal:** Use the integrated terminal for the commands above; set `PYTHONPATH` to the workspace folder in your shell profile or in `.vscode/settings.json` via `terminal.integrated.env.windows` if you prefer it automatic.
4. **Docker:** Install the [Docker](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-docker) extension. Open `infra/docker/docker-compose.yml`, or run the `docker compose` commands from the integrated terminal.
5. **Debugging:** Create a launch configuration that runs `module` `uvicorn` with args `backend.main:app --reload --port 3000` and env `PYTHONPATH` set to the workspace root.

## Database snapshots (optional)

Requires PostgreSQL client tools (`pg_dump` / `pg_restore`) and `DATABASE_URL`:

```powershell
cd G:\Quantum_SEO
python scripts\db_snapshot.py backup
python scripts\db_snapshot.py list
python scripts\db_snapshot.py restore
```

## Security scanning and CI

- **CodeQL:** `.github/workflows/codeql.yml` runs on pushes and pull requests to `main`.
- **Smoke tests:** `.github/workflows/smoke.yml` runs Python unit tests and the Node dev-server smoke test.

## Deployment

The app needs the Python API plus OpenSearch, Postgres, and Redis (or degraded modes where the code allows). See `infra/k8s/` for example Kubernetes manifests; adjust images, secrets, and ingress for your environment.
