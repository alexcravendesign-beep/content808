# content808 Setup Guide

## Quick Start (Already Configured)

The repo is pre-configured to work with your subdomains. Just:

```bash
cd content808
docker-compose up -d
```

## Current Working State

### .env Configuration (in .env file)
```
DB_HOST=supabase-db
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=Wankd0g123
SUPABASE_URL=http://host.docker.internal:8000
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE
GEMINI_API_KEY=your-gemini-key
```

### Docker Compose
- Uses `supabase-db` as DB host (connects to local Supabase Postgres)
- Must be on `supabase_default` Docker network to reach `supabase-db`
- Frontend proxies to backend via internal Docker networking (no external URL needed)

## Subdomains (Already Set Up)
- **Frontend**: https://content.cravencooling.services
- **Backend API**: https://content-api.cravencooling.services

## Running Services
- Frontend: https://content.cravencooling.services (proxies /api/ → backend)
- Backend API: http://localhost:54000 (or via content-api.cravencooling.services)
- Redis: localhost:6379

## Common Issues

### "502 Bad Gateway" from frontend
- Backend container not running or crashed
- Check: `docker-compose logs backend`

### "ENOTFOUND supabase-db"
- Backend not on `supabase_default` network
- Should be fixed in docker-compose.yml - check networks section

### "Tenant or user not found" on DB
- Wrong DB credentials
- Ensure: `DB_HOST=supabase-db`, `DB_PORT=5432`, `DB_PASSWORD=Wankd0g123`

## Pulling Updates

```bash
git pull origin main
docker-compose build
docker-compose up -d
```
