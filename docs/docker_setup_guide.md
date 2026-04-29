# Docker Compose Setup Complete! 🚀

Your PostgreSQL and pgAdmin 4 services are now running in Docker.

## 🛠 Accessing pgAdmin 4

1. **Open your browser** and navigate to: [http://localhost:5050](http://localhost:5050)
2. **Login Credentials:**
   - **Email:** `admin@caltims.com`
   - **Password:** `admin`

## 🔗 Connecting to PostgreSQL within pgAdmin

To manage your database from pgAdmin, perform the following:

1. **Right-click** on "Servers" > **Register** > **Server...**
2. **General Tab:**
   - **Name:** `CalTIMS DB`
3. **Connection Tab:**
   - **Host name/address:** `database_caltims` (IMPORTANT: Use the container name)
   - **Port:** `5432`
   - **Maintenance database:** `caltims_db`
   - **Username:** `caltims_admin`
   - **Password:** `mysecretpassword`
4. Click **Save**.

---

## 🏗 Environment Details

### PostgreSQL Service
- **Container Name:** `database_caltims`
- **Local Port:** `5432`
- **Database Name:** `caltims_db`
- **User:** `caltims_admin`
- **Password:** `mysecretpassword`

### pgAdmin Service
- **URL:** [http://localhost:5050](http://localhost:5050)
- **Email:** `admin@caltims.com`
- **Password:** `admin`

---

> [!IMPORTANT]
> If you are connecting from your **Node.js application** running locally (outside Docker), use `localhost` as the host. If your application is also inside Docker, use `database_caltims`.
