# Content Hub v2

Staff-facing content operations platform for planning, approvals, and publishing workflows.

## Architecture

```
content808/
├── backend/          # Node.js + Express + TypeScript API
│   ├── src/
│   │   ├── config/       # Environment configuration
│   │   ├── db/           # Postgres connection + migrations
│   │   ├── middleware/    # Auth + RBAC middleware
│   │   ├── routes/       # API route handlers
│   │   ├── services/     # Business logic (transitions, audit)
│   │   └── types/        # TypeScript type definitions
│   └── Dockerfile
├── frontend/         # React + Vite + TypeScript + Tailwind
│   ├── src/
│   │   ├── api/          # API client
│   │   ├── components/   # Shared UI components
│   │   ├── pages/        # Page-level components
│   │   └── lib/          # Utilities
│   └── Dockerfile
├── docker-compose.yml
├── deploy.sh
└── .github/workflows/deploy.yml
```

### Stack

| Layer     | Tech                                    |
|-----------|-----------------------------------------|
| Frontend  | React 18, Vite, TypeScript, Tailwind CSS |
| Backend   | Node.js 20, Express, TypeScript          |
| Database  | PostgreSQL 16                            |
| Queue     | Redis 7 + BullMQ                         |
| Deploy    | Docker Compose                           |

### Key Design Decisions

- **Workflow transitions** enforced via centralized rules in `backend/src/services/transitions.ts`
- **RBAC** with three roles: `staff`, `manager`, `admin` — enforced server-side
- **Audit log** records every create, update, transition, approval, block, and comment
- **Plugin registry** supports panel/widget/action extensions with mount points
- **Dark theme** by default with modern SaaS-quality UI

## Local Development

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16 (or use Docker)

### Quick Start with Docker

```bash
docker compose up -d --build
```

Services:
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- Health: http://localhost:4000/health
- Ready: http://localhost:4000/ready

### Manual Development

**Backend:**
```bash
cd backend
cp .env.example .env
npm install
npm run migrate
npm run dev
```

**Frontend:**
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

## API

All content endpoints are under `/api/v1/content-hub/`. See [API.md](API.md) for full endpoint documentation.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for GitHub Actions CI/CD setup and server deployment instructions.

## Testing

See [TESTING.md](TESTING.md) for smoke test and e2e verification procedures.

## What Changed vs MVP

- Complete rebuild with modern React + TypeScript frontend
- Dark theme SaaS-quality UI with clean spacing and hierarchy
- Drag-and-drop Kanban board with 7 status lanes
- Drag-and-drop calendar with month and week views
- Approvals queue with one-click approve/block
- Full item detail page with comments, outputs, and activity history
- Centralized workflow transition engine with role-based guards
- Server-side RBAC enforcement (staff/manager/admin)
- Comprehensive audit logging for all operations
- Plugin/extension registry with enable/disable
- KPI dashboard strip with real-time stats
- Docker Compose deployment with health checks
- GitHub Actions CI/CD pipeline
- Versioned REST API under /api/v1/content-hub
