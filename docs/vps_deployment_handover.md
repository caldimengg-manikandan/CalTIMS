# CalTIMS VPS Deployment & Architecture Handover

This document outlines the production architecture and deployment workflow for CalTIMS. It is designed for developers and AI agents to understand the system flow from local development to VPS production.

## 1. System Architecture Overview

CalTIMS is deployed using a **Containerized Microservices** architecture managed by Docker Compose, sitting behind a global Nginx reverse proxy.

### Component Breakdown:
*   **Global Nginx (VPS Host):** Handles SSL (HTTPS) and routes traffic for the domain `caldimproducts.com`. It proxies `/caltims/` traffic to the Docker network.
*   **Frontend (Docker - Nginx):** A React SPA served by a secondary Nginx container. It is configured to handle subpath routing (`/caltims`).
*   **Backend (Docker - Node.js):** An Express API running on port 5000 inside the container.
*   **Database (Docker - Postgres):** A PostgreSQL 16 instance. Data is persisted in a Docker volume `postgres_data`.

---

## 2. Traffic Flow (Networking)

The application is served under a subpath to avoid conflicts with other apps on the same VPS.

### Web Requests:
`User Browser` -> `HTTPS (443)` -> `VPS Global Nginx` -> `Internal Proxy` -> `Frontend Container (80)`

### API Requests:
`User Browser` -> `/caltims/api/` -> `VPS Global Nginx` -> `Internal Proxy` -> `Backend Container (5000)` -> `Postgres (5432)`

### WebSocket Flow:
`User Browser` -> `/caltims/api/socket.io` -> `VPS Global Nginx` -> `Backend Container` (Handles real-time updates).

---

## 3. Deployment Workflow (Local to VPS)

To deploy updates, follow this exact sequence:

### Step 1: Local Machine
Commit and push changes to the `main` branch.
```powershell
git add .
git commit -m "Your update message"
git push origin main
```

### Step 2: VPS Machine
Pull the code and execute the deployment script.
```bash
cd /var/www/caltims
git pull origin main
./scripts/vps_deploy.sh
```

---

## 4. Critical Configuration

### Environment Variables (`.env`)
The `.env` file on the VPS is the source of truth. **DO NOT** commit this file to Git.

| Variable | Description | Requirement |
| :--- | :--- | :--- |
| `NODE_ENV` | Must be `production`. | Critical |
| `DATABASE_URL` | `postgresql://user:pass@postgres:5432/db` | Uses container name `postgres` |
| `CLIENT_URL` | `https://caldimproducts.com/caltims` | Used for Redirects & CORS |
| `JWT_ACCESS_SECRET` | Long random string. | For Login Tokens |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console. | For OAuth |
| `GOOGLE_CALLBACK_URL` | `.../caltims/api/v1/auth/google/callback` | Must match Google Console |

### Docker Compose
The `docker-compose.yml` uses `env_file: .env` to inject these variables into the backend container.

---

## 5. Maintenance Commands

### Viewing Logs (Critical for Debugging)
```bash
# See live logs from the backend
docker logs backend_caltims -f --tail 50

# See frontend logs
docker logs frontend_caltims -f
```

### Database Management
```bash
# Run migrations
docker exec backend_caltims npx prisma migrate deploy

# Seed the Super Admin
docker exec backend_caltims npm run seed
```

### Full Reset
If the system is stuck or environment variables are not updating:
```bash
docker compose down
./scripts/vps_deploy.sh
```

---

## 6. Known AI Instructions
If an AI agent is modifying this codebase, it must ensure:
1.  **Frontend URLs** use `import.meta.env.VITE_API_BASE_URL` (usually `/caltims/api/v1`).
2.  **WebSockets** connect to the path `/caltims/api/socket.io`.
3.  **CORS** in `app.js` must allow `https://caldimproducts.com`.
4.  **Base URL** for React Router is set to `/caltims`.
