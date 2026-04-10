# CalTIMS Deployment Guide

This document outlines the exact deployment workflow and server structure for the CalTIMS application. It serves as a guide for all team members to ensure updates are pushed to the production VPS safely and correctly.

---

## 🏗️ Architecture & Server Structure

Our application uses a clean, subpath-based architecture on the VPS so that it securely shares the server with our other products (`steeldms`, `projectmanagement`).

- **Live URL:** `https://caldimproducts.com/caltims/`
- **Frontend Engine:** React / Vite (Built to static files via `npm run build`)
- **Backend Engine:** Node.js / Express (Managed by PM2 in the background)
- **Web Server:** Nginx (Handles HTTPS and proxy mapping)
- **Database:** PostgreSQL (Operating natively on the VPS)

### File Paths
- **Main Code Directory (VPS):** `/var/www/caltims`
- **Nginx Config Location:** `/etc/nginx/sites-available/caldimproducts.conf`
- **Nginx PM2 Subpath:** `/caltims/` maps to `/var/www/caltims/frontend/dist/`
- **Nginx API Subpath:** `/caltims/api/` maps to `http://localhost:5005/api/`

*(If you ever need to access or modify server variables safely, the backend config lives directly at `/var/www/caltims/backend/.env` on the VPS).*

---

## 🚀 How to Deploy Updates

Our deployment is fully automated via Git. **NEVER manually copy or FTP files to the server.** Instead, follow this exact 2-step process whenever you make code changes locally.

### Step 1: Develop and Push (Local Machine)
Once you have written new code or upgraded packages locally, securely commit them to the main branch.

From your local VS Code terminal:
```bash
# 1. Stage your changes
git add .

# 2. Add an explicit description of what got changed
git commit -m "Update: Added new timesheet dashboard"

# 3. Push to GitHub
git push origin main
```

### Step 2: Trigger the Automation Script (VPS)
We have a unified deployment script (`vps_deploy.sh`) installed on the master server. You do not need to build manually on the server.

From your VPS SSH terminal (`caldim@187.127.135.34`):
```bash
# 1. Enter the directory
cd /var/www/caltims

# 2. Run the deployment script
./vps_deploy.sh
```

**What the script automatically does for you:**
- Retrieves all your new commits from GitHub.
- Compiles the latest Node packages for the backend and restarts your PM2 server gracefully.
- Compiles the latest frontend Node packages, generates the optimized React `dist` folder, and automatically replaces the live website interface.

---

## 🛠️ Important Notes for Developers

If you are modifying low-level routing commands, please remember:

1. **React Router & Vite:** The frontend is permanently attached to the `/caltims` subpath. 
   - `vite.config.js` always needs `base: '/caltims/'`.
   - `main.jsx` uses `<BrowserRouter basename="/caltims">`. Do not change these strings or the live interface will return 404 Nginx errors!
2. **Axios API:** Our frontend API is strictly pointed at `baseURL: '/caltims/api/v1'`. It is routed safely through Nginx to bypass cross-origin requests.

---

## 🚨 Troubleshooting Commands (VPS)

If something goes wrong after you run the deployment script, use these commands on your VPS to diagnose the crash:

**Check Backend Server Status:**
```bash
pm2 status
```

**Check Real-time Backend Logs (Find out why Node.js crashed):**
```bash
pm2 logs caltims-backend
```

**Reload Web Routing (If Nginx acts up):**
```bash
sudo systemctl restart nginx
```
