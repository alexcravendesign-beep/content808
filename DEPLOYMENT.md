# Deployment Guide

## GitHub Actions CI/CD

### Required Repository Secrets

Set these in GitHub → Settings → Secrets and variables → Actions:

| Secret           | Description                          |
|------------------|--------------------------------------|
| `DEPLOY_HOST`    | Server IP or hostname                |
| `DEPLOY_USER`    | SSH username (e.g., `deploy`)        |
| `DEPLOY_SSH_KEY` | Private SSH key for server access    |
| `DEPLOY_PATH`    | App directory (default: `/opt/content808`) |

### Workflow

The CI pipeline (`.github/workflows/deploy.yml`) triggers on push to `main`:

1. **Lint & Test** — Runs ESLint and tests for both backend and frontend
2. **Deploy** — SSHs into the server and runs `deploy.sh`

## Server Bootstrap

### First-time setup

```bash
# 1. Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 2. Clone repo
git clone https://github.com/8zero8development-max/content808.git /opt/content808
cd /opt/content808

# 3. Configure environment (optional overrides)
cp backend/.env.example backend/.env
# Edit backend/.env if needed

# 4. Start services
docker compose up -d --build

# 5. Verify
curl http://localhost:4000/health
curl http://localhost:4000/ready
```

### deploy.sh

The deploy script (`deploy.sh` in repo root) handles:

1. `git fetch` + `git reset --hard origin/main`
2. `docker compose build --no-cache`
3. `docker compose up -d`
4. Health check with retries (up to 60s)

### Manual Deploy

```bash
cd /opt/content808
bash deploy.sh
```

## Rollback

```bash
cd /opt/content808

# Find previous good commit
git log --oneline -10

# Reset to specific commit
git reset --hard <commit-sha>

# Rebuild and restart
docker compose up -d --build

# Verify
curl http://localhost:4000/health
```

## Environment Variables

### Backend

| Variable       | Default           | Description             |
|----------------|-------------------|-------------------------|
| `PORT`         | `4000`            | API server port         |
| `NODE_ENV`     | `development`     | Environment             |
| `DB_HOST`      | `postgres`        | PostgreSQL host         |
| `DB_PORT`      | `5432`            | PostgreSQL port         |
| `DB_NAME`      | `content_hub`     | Database name           |
| `DB_USER`      | `content_hub`     | Database user           |
| `DB_PASSWORD`  | `content_hub_pass`| Database password       |
| `REDIS_HOST`   | `redis`           | Redis host              |
| `REDIS_PORT`   | `6379`            | Redis port              |
| `CORS_ORIGIN`  | `*`               | Allowed CORS origins    |

### Frontend

| Variable       | Default                  | Description     |
|----------------|--------------------------|-----------------|
| `VITE_API_URL` | `http://localhost:4000`  | Backend API URL |

## Ports

| Service    | Port  |
|------------|-------|
| Frontend   | 3000  |
| Backend    | 4000  |
| PostgreSQL | 5432  |
| Redis      | 6379  |
