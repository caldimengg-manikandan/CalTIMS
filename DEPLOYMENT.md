# CalTIMS Deployment Guide

This document outlines the exact deployment workflow and server structure for the CalTIMS application. It serves as a guide for all team members to ensure updates are pushed to the production VPS safely and correctly.

---

## 🏗️ Architecture & Server Structure

Our application uses a subpath-based architecture on the VPS to share the server with other products smoothly.

- **Live URL:** `https://caldimproducts.com/caltims/`
- **Frontend Engine:** React / Vite (Built via `npm run build`)
- **Backend Engine:** Node.js / Express (Port 5005, managed by PM2)
- **Web Server:** Nginx (Handles HTTPS and proxy mapping)
- **Database:** PostgreSQL (Native VPS installation)

### File Paths
- **Main Code Directory (VPS):** `/var/www/caltims`
- **Nginx Config Location:** `/etc/nginx/sites-enabled/caldimproducts.conf`
- **Nginx Frontend Alias:** `/caltims/` maps to `/var/www/caltims/frontend/dist/`
- **Nginx API Proxy:** `/caltims/api//` maps to `http://localhost:5005/api/`

### Important Configuration (VPS Only - .gitignore'd)
1. **Backend Env:** `/var/www/caltims/backend/.env` (DB URL and secrets)
2. **Frontend Env:** `/var/www/caltims/frontend/.env.production`
   Must contain:
   ```env
   VITE_ROUTER_BASENAME=/caltims
   VITE_API_BASE_URL=/caltims/api/v1
   VITE_SOCKET_URL=/
   ```

---

## 🚀 How to Deploy Updates

### Option 1: Fully Automated (Recommended)
Our deployment is automated via GitHub Actions. **Just push to the main branch.**

1. **Local Machine:**
```bash
git add .
git commit -m "Update: Fixes for subpath routing and dashboard crash"
git push origin main
```
2. GitHub will log into the VPS, pull the code, install dependencies, run Prisma migrations, build the React frontend, and restart the backend.

### Option 2: Manual Trigger (If GitHub Action fails)
Log into your VPS SSH and run:
```bash
cd /var/www/caltims && ./vps_deploy.sh
```

---

## 🛠️ Important Notes for Developers
1. **Routing:** The app lives at `/caltims`.
   - `vite.config.js` uses `base: '/caltims/'`.
   - `App.jsx` uses `<BrowserRouter basename="/caltims">`.
2. **Proxy Trust:** In `app.js`, we use `app.set('trust proxy', 1)`. This is required for the backend to see the real user IPs behind Nginx.
3. **Assets:** Always use relative paths for images/videos in code (e.g., `src="assets/images/..."` NOT `src="/assets/..."`).
4. **Super Admin:** To create the root administrator, run `node create_superadmin.js` in the `backend` folder on the VPS.

---

## 🚨 Troubleshooting Commands (VPS)

**Check Backend Status:**
```bash
pm2 status
```

**Check Backend Logs:**
```bash
pm2 logs caltims-backend
```

**Reload Web Routing:**
```bash
sudo nginx -t && sudo systemctl reload nginx
```
