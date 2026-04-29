# CalTIMS Deployment Guide (Docker + Nginx Proxy)

This project has been reorganized to follow the standardized blueprint for predictable deployments.

## 📁 Project Structure
```text
/var/www/CalTIMS/
├── backend/                # Node.js API with Prisma
│   ├── src/
│   ├── Dockerfile          # Optimized Node 20 image
│   └── package.json
├── frontend/               # React (Vite) Frontend
│   ├── src/
│   ├── Dockerfile          # Multi-stage build (Node + Nginx)
│   └── package.json
├── data/                   # Database seeds and static data
├── docs/                   # Documentation and Manuals
├── scripts/                # Deployment and utility scripts
├── .env                    # Centralized environment variables
└── docker-compose.yml      # Container orchestration
```

## 🚀 Deployment Workflow

### 1. Update Code
Pull the latest changes from your repository:
```bash
git pull origin main
```

### 2. Configure Environment
Edit the root `.env` file with your production secrets:
```bash
nano .env
```

### 3. Build and Deploy
Run the following command in the project root:
```bash
docker compose up -d --build
```
This will:
- Build the frontend (Vite build) and package it into an Nginx container.
- Build the backend and install production dependencies.
- Start a PostgreSQL database with persistent volumes.
- Network everything together.

## 🌐 Global Nginx Proxy Configuration

To route traffic from your domain to the Docker containers, use a global Nginx configuration on your VPS:

```nginx
server {
    listen 80;
    server_name caltims.yourdomain.com;

    # Frontend Proxy
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Backend API Proxy (Optional if frontend calls localhost:5000)
    location /api {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🛠️ Maintenance Commands

- **View Logs**: `docker-compose logs -f`
- **Restart Services**: `docker-compose restart`
- **Stop Project**: `docker-compose down`
- **Database Studio**: `npx prisma studio` (run inside backend container or locally)
