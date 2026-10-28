# Aulten Digital TaskFlow CRM — Production Deployment Guide

A step-by-step, beginner-friendly guide written specifically for **Windows PowerShell** users to set up PostgreSQL, run staging integration tests, deploy to Render & Vercel, provision administrators, and verify production operation.

---

## Architecture Overview

```
                      ┌──────────────────────────────────────────────┐
                      │                User Browser                  │
                      └──────────────────────┬───────────────────────┘
                                             │
                      ┌──────────────────────┴───────────────────────┐
                      │   Vercel: React 19 + Vite Frontend SPA       │
                      │   https://employee-task-dashboard-chi.vercel.app  │
                      └──────────────────────┬───────────────────────┘
                                             │ HTTPS fetch() with Bearer Auth
                                             │ & Cross-Origin Cookies (SameSite=None)
                      ┌──────────────────────┴───────────────────────┐
                      │   Render: Node.js Express 4 Backend API      │
                      │   https://employee-task-dashboard-g2ug.onrender.com │
                      └──────────────────────┬───────────────────────┘
                                             │ TLS encrypted connection
                                             │ (?sslmode=require)
                      ┌──────────────────────┴───────────────────────┐
                      │   Managed PostgreSQL Database (v15+)         │
                      │   (Render Postgres / Neon / Supabase / RDS)  │
                      └──────────────────────────────────────────────┘
```

---

## Table of Contents

1. [Local Pre-Deployment Verification](#1-local-pre-deployment-verification)
2. [Step 1: PostgreSQL Database Provisioning](#step-1-postgresql-database-provisioning)
3. [Step 2: Staging PostgreSQL Integration Test](#step-2-staging-postgresql-integration-test)
4. [Step 3: Database Migrations](#step-3-database-migrations)
5. [Step 4: Secure Administrator Provisioning](#step-4-secure-administrator-provisioning)
6. [Step 5: Render Backend Deployment](#step-5-render-backend-deployment)
7. [Step 6: Vercel Frontend Deployment](#step-6-vercel-frontend-deployment)
8. [Step 7: Post-Deployment Smoke Test Checklist](#step-7-post-deployment-smoke-test-checklist)
9. [Step 8: Rollback Procedures](#step-8-rollback-procedures)

---

## 1. Local Pre-Deployment Verification

Before configuring external services, confirm that all local tests, linting, and build pass cleanly on your Windows computer.

Open **Windows PowerShell** in the project root:

```powershell
# Navigate to the repository
cd C:\Users\shiva\Downloads\projects\employee-task-dashboard

# Run backend test suite (33 tests)
cd backend
npm test

# Run frontend test suite (14 tests)
cd ..\frontend
npm test

# Run frontend linter
npm run lint

# Run frontend production build
npm run build

# Return to root
cd ..
```

*Expected result*: All tests pass (0 failures), 0 lint errors, and the Vite build succeeds in `< 300ms`.

---

## Step 1: PostgreSQL Database Provisioning

You need a managed PostgreSQL database. Any standard PostgreSQL 14+ service will work.

### Recommended Provider: Neon Serverless PostgreSQL

For this project, Neon PostgreSQL is configured:
* **Organization ID**: `org-tiny-wave-09328983`
* **Project ID**: `snowy-dream-09523508`
* **Production Branch**: `production`

#### Connection String Configurations:
1. **Production (Render Web Service)**:
   Use the **pooled connection string** from the `production` branch. The pooled endpoint includes `-pooler` in the host, ensuring connection pooling for concurrent requests.
   Example:
   `postgresql://[user]:[password]@ep-[id]-pooler.us-east-2.aws.neon.tech/[dbname]?sslmode=require`

2. **Staging / Integration Testing**:
   Create a dedicated disposable child branch in Neon (or via Neon CLI):
   ```bash
   neon branches create --name staging --project-id snowy-dream-09523508
   ```
   Retrieve its connection string and assign it to `TEST_DATABASE_URL`. Never use the `production` connection string for integration testing.

---

## Step 2: Staging PostgreSQL Integration Test

Before applying migrations to production, verify live database operations against a disposable test database or Neon branch.

In **Windows PowerShell**:

```powershell
cd C:\Users\shiva\Downloads\projects\employee-task-dashboard\backend

# Set the test database URL (replace with your disposable test database connection string)
$env:TEST_DATABASE_URL = "postgresql://user:password@host:5432/disposable_test_db?sslmode=require"

# Run the live integration test suite
npm run test:integration
```

*Safety Feature*: The test harness automatically verifies connection, applies migrations inside transactions, tests session creation, scrypt hashing, and CRM queries, then cleans up its test organization. It refuses to run if `$env:TEST_DATABASE_URL` matches your production `$env:DATABASE_URL`.

---

## Step 3: Database Migrations

Apply the migration scripts to your target database.

In **Windows PowerShell**:

```powershell
cd C:\Users\shiva\Downloads\projects\employee-task-dashboard\backend

# Set your target database connection string
$env:DATABASE_URL = "postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"

# Run migrations
npm run db:migrate
```

*What this does*:
* Checks `schema_migrations`.
* Applies `001_create_taskflow_core.sql` (Organizations, Users, Tasks, Assignments).
* Applies `002_aulten_digital_crm_schema.sql` (Departments, Clients CRM, Projects, Comments, Notifications, Audit Logs, User Sessions).
* All operations are wrapped in transactions and are 100% idempotent.

*(Optional for Staging/Evaluation)*: If you want to populate realistic Indian demo accounts, departments, clients, and 52 demo tasks on a staging database, run:
```powershell
npm run db:seed
```
*Note: Do not run `db:seed` on a live production environment if you wish to start with empty production data.*

---

## Step 4: Secure Administrator Provisioning

Provision the initial Super Administrator without hardcoding passwords into Git or terminal logs.

In **Windows PowerShell**:

```powershell
cd C:\Users\shiva\Downloads\projects\employee-task-dashboard\backend

# Ensure your target DATABASE_URL is set in the session
$env:DATABASE_URL = "postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"

# Set administrator details
$env:ADMIN_NAME = "Aulten Digital Admin"
$env:ADMIN_EMAIL = "admin@aulten.example.com"

# OPTION 1 (Recommended): Let the script generate a secure 24-character random password
npm run provision:admin

# OPTION 2: Supply an explicit secure password of your choice
# $env:ADMIN_PASSWORD = "YourSecurePassword!2026#"
# npm run provision:admin
```

*Output*:
```
======================================================
✅ Admin Provisioning Complete
   Organization: Aulten Digital
   Email:        admin@aulten.example.com
   Generated Password: Xk89PqLm44...#9a
   ⚠️ Save this password securely immediately! It will not be shown again.
======================================================
```
*Safety Note*: If re-run later on an existing administrator who has already logged in and changed their password, the script **preserves** the existing password unless `$env:ADMIN_PASSWORD` is explicitly set.

---

## Step 5: Render Backend Deployment

### 1. Render Dashboard Setup
1. Log in to the [Render Dashboard](https://dashboard.render.com).
2. Select your Web Service: `employee-task-dashboard-g2ug` (or create a new Web Service from your GitHub repo).
3. Under **Settings**:
   * **Root Directory**: `backend`
   * **Build Command**: `npm install`
   * **Start Command**: `npm start`
   * **Node Version**: Automatic (defaults to Node 20 LTS; specified as `>=18.0.0` in `package.json`).

### 2. Configure Environment Variables in Render
Under the **Environment** tab of your Render Web Service, add the following variables:

| Key | Value | Description |
|---|---|---|
| `NODE_ENV` | `production` | Enables production security mode, disables demo user switching, enforces CSRF checks |
| `PORT` | `10000` | Render default web service port |
| `DATABASE_URL` | `postgresql://...` | Connection string to your managed PostgreSQL database |
| `DATABASE_SSL` | `true` | Enforces SSL connection |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | `false` | Permits cloud database intermediate certificates |
| `FRONTEND_URL` | `https://employee-task-dashboard-chi.vercel.app` | Permitted CORS and CSRF frontend origin (add custom domains comma-separated) |
| `COOKIE_SAME_SITE` | `none` | Required for cross-origin authentication cookies between Vercel and Render |
| `COOKIE_SECURE` | `true` | Enforces HTTPS cookie transmission |
| `ALLOW_DEMO_SWITCH` | `false` | Prevents unauthenticated persona switching in production |

### 3. Deploy and Verify Backend
1. Click **Manual Deploy** > **Deploy latest commit** (or push to `main` when ready).
2. Monitor deployment logs until you see:
   ```
   ✅ Aulten Digital - TaskFlow Enterprise CRM API
      Server running at http://localhost:10000
      Health check:    http://localhost:10000/api/health
      Readiness probe: http://localhost:10000/api/ready
   ```
3. Test endpoints from PowerShell or browser:
   ```powershell
   # Health check
   Invoke-RestMethod -Uri "https://employee-task-dashboard-g2ug.onrender.com/api/health"
   # Output: @{status=ok; timestamp=...}

   # Database readiness check
   Invoke-RestMethod -Uri "https://employee-task-dashboard-g2ug.onrender.com/api/ready"
   # Output: @{status=ready; database=available; timestamp=...}
   ```

---

## Step 6: Vercel Frontend Deployment

### 1. Vercel Project Configuration
1. Log in to the [Vercel Dashboard](https://vercel.com).
2. Select the project: `employee-task-dashboard-chi` (or import the repository).
3. Under **Settings** > **General**:
   * **Root Directory**: `frontend`
   * **Framework Preset**: `Vite`
   * **Build Command**: `npm run build`
   * **Output Directory**: `dist`
   * **Install Command**: `npm install`

### 2. Configure Environment Variables in Vercel
Under **Settings** > **Environment Variables**, configure:

| Key | Value | Environments |
|---|---|---|
| `VITE_API_BASE_URL` | `https://employee-task-dashboard-g2ug.onrender.com` | Production, Preview, Development |

*Note*: Do not add a trailing slash `/` or `/api`. The frontend API client automatically formats endpoints to `${VITE_API_BASE_URL}/api/...`.

### 3. Redeploy Frontend
1. Under **Deployments**, trigger a **Redeploy** (or push code to GitHub).
2. When the build completes, visit `https://employee-task-dashboard-chi.vercel.app`.

---

## Step 7: Post-Deployment Smoke Test Checklist

Once both Render and Vercel are deployed, execute this 10-step verification:

1. [ ] **Site Load**: Open `https://employee-task-dashboard-chi.vercel.app` in Chrome or Edge incognito mode. Confirm header shows **Aulten Digital TaskFlow CRM**.
2. [ ] **Health Probes**: Verify `GET /api/health` returns `{"status":"ok"}` and `GET /api/ready` returns `{"status":"ready","database":"available"}`.
3. [ ] **Login Authentication**: Log in with your provisioned Super Admin email and password. Confirm successful login banner and user profile greeting.
4. [ ] **Cross-Origin Session Check**: Refresh the page (`F5`). Verify the session remains active without prompting for re-login (verifies Bearer storage in `sessionStorage` and `taskflow_session` cookie).
5. [ ] **Create Task**: Navigate to **All Tasks**, click **+ New Task**. Create a task with Title: `Production Verification Task 001`, Priority: `High`. Confirm task appears immediately with generated task code (e.g., `TASK-2026-0001`).
6. [ ] **Kanban Drag-and-Drop**: Navigate to **Kanban Board**. Drag the task from `To Do` to `In Progress`. Confirm status pill updates and changes persist on refresh.
7. [ ] **Comments & Notifications**: Click the task to open the details drawer. Add a comment: `System verification comment`. Confirm comment posts and creator notification triggers.
8. [ ] **Clients CRM Pipeline**: Navigate to **Clients & CRM** (Manager/Admin view). Confirm pipeline stages render with INR (₹) deal values.
9. [ ] **CSV Export**: Navigate to **Reports & Analytics**, click **Export Tasks CSV**. Confirm download starts and file contains valid headers (`Task Code,Title,Status,Priority...`).
10. [ ] **Logout**: Click the user profile badge > **Sign Out**. Confirm session token is destroyed and `/api/auth/me` returns 401.

---

## Step 8: Rollback Procedures

If an unexpected issue arises in production:

### 1. Backend Rollback (Render)
1. In the Render Dashboard, navigate to your Web Service > **Deploys**.
2. Find the previous successful deployment.
3. Click the three dots (`...`) > **Rollback to this deploy**.
4. Render immediately switches traffic to the previous build without downtime.

### 2. Frontend Rollback (Vercel)
1. In the Vercel Dashboard, go to your project > **Deployments**.
2. Find the previous stable production deployment.
3. Click the three dots (`...`) > **Instant Rollback**.
4. Vercel updates the edge network routing within seconds.

### 3. Database Recovery
* All schema changes in `001` and `002` migrations are additive (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`). They do not drop or truncate existing tables.
* If a data issue occurs, restore the snapshot from your PostgreSQL provider dashboard (Render, Neon, or Supabase).
