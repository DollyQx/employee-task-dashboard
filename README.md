# Aulten Digital — TaskFlow Employee CRM

A production-grade, multi-user, responsive Employee Task Management & CRM platform architected for **Aulten Digital**, an Indian technology and software services enterprise.

TaskFlow provides role-based task tracking, project milestone management, an Indian client CRM pipeline, team workloads, interactive Kanban and monthly Calendar schedules, in-app notification routing, and security audit logs, backed by **PostgreSQL** and a high-performance **React 19 + Vite 8** frontend.

---

## Tech Stack

| Layer | Technology | Details |
|---|---|---|
| **Frontend** | React 19 + Vite 8 | Pure ES Modules, vanilla design tokens, responsive sidebar, light/dark themes |
| **Backend** | Node.js (v18+) + Express 4 | Secure RESTful architecture, parameterized SQL, role-based authorization |
| **Database** | PostgreSQL (`pg`) + `pg-mem` | ACID transactions, UUID keys, multi-tenant organization isolation, SSL auto-configuration |
| **Security** | Scrypt + Timing-Safe | OWASP memory-hard password hashing, HttpOnly cross-origin SameSite cookies, CSRF protection, rate limiting |
| **Code Quality** | Node Test Runner + Oxlint | Zero dependencies test suites, sub-millisecond AST linting |

---

## Architectural Highlights

1. **Brand & Organization**: Configured for **Aulten Digital** (`aulten-digital` tenant).
2. **Complete 13-Module Navigation**:
   * **Overview**: Executive & role-tailored dashboard with live KPI counters, overdue alerts, and priority tasks.
   * **My Tasks**: Focused individual work view for current employee with fast status toggles.
   * **All Tasks**: Organization-wide searchable and multi-filtered task list with pagination and server-side sorting.
   * **Kanban Board**: 6 workflow columns (`Backlog`, `To Do`, `In Progress`, `In Review`, `Blocked`, `Done`) with drag-and-drop & persistent backend updates.
   * **Calendar**: Interactive monthly schedule displaying tasks by due date with urgency badges.
   * **Employees Directory**: Searchable directory of 18 Indian staff members with designations, manager hierarchies, and workload summaries.
   * **Teams & Departments**: 12 operational divisions (Engineering, Web, Mobile, DevOps, QA, Cybersecurity, Sales, HR, etc.) with lead assignments.
   * **Projects Management**: 7 enterprise client engagements with milestone health (`good`, `at_risk`, `critical`) and completion bars derived from real tasks.
   * **Clients & CRM**: 7 enterprise accounts (e.g. Tata Consultancy, Reliance, Infosys, Flipkart, Zomato) with 7 pipeline stages and deal values in INR (₹).
   * **Reports & Analytics**: Real database calculations, status/priority distributions, department workloads, and safe CSV export.
   * **Notification Center**: In-app notifications with read/unread tracking and batch actions.
   * **Activity Log**: Immutable audit trail recording actors, actions, entity types, change metadata, and IP addresses.
   * **Settings**: Preferences, Light/Dark appearance toggle, and PostgreSQL readiness monitoring.
3. **Multi-Role Authorization (RBAC)**:
   * **Super Admin**: Complete organization-level control, user provisioning, system settings, all tasks, reports, and audit logs.
   * **Admin**: Manage employees, teams, projects, clients, all tasks, and organizational reports.
   * **Manager**: Supervise department team, assign/prioritize work, update statuses, manage client CRM leads.
   * **Employee**: View assigned tasks and calendar, update permitted progress, post comments, and view notifications.
4. **Realistic Indian Demo Data**:
   * Believable Indian names (Aarav Sharma, Priya Verma, Rahul Kumar, Sneha Gupta, Arjun Singh, etc.) with fictional `@example.com` emails.
   * Repeatable, idempotent seeding script (`npm run db:seed`) that never resets or damages production data.
   * Secure initial admin provisioning script (`npm run provision:admin`) generating random secrets without hardcoded credentials.
5. **Legacy Mock Feed Compatibility**:
   * Existing mock routes (`/api/crm/tasks` and `/api/helpdesk/tasks`) remain preserved and verified.

---

## Project Structure

```
employee-task-dashboard/
├── backend/
│   ├── db/
│   │   ├── migrations/
│   │   │   ├── 001_create_taskflow_core.sql     # Core tables (orgs, users, tasks, assignments)
│   │   │   └── 002_aulten_digital_crm_schema.sql # Departments, clients, projects, comments, notifications, audit
│   │   ├── migrate.js                           # Migration runner with transaction rollback
│   │   └── pool.js                              # PostgreSQL pool with SSL & readiness probe
│   ├── middleware/
│   │   ├── auth.js                              # Session verification, role guards, CSRF protection, tenant attachment
│   │   └── rateLimiter.js                       # In-memory IP rate limiter for login & sensitive endpoints
│   ├── routes/
│   │   ├── auth.js                              # /api/auth (login, logout, me, demo switch, password reset)
│   │   ├── tasks.js                             # /api/tasks (full CRUD, status patch, comments, bulk actions)
│   │   ├── employees.js                         # /api/employees (directory, workloads, staff management)
│   │   ├── departments.js                       # /api/departments (divisions, heads, member counts)
│   │   ├── projects.js                          # /api/projects (client projects, health, milestones)
│   │   ├── clients.js                           # /api/clients (CRM pipeline stages, deal values, lead owner)
│   │   ├── reports.js                           # /api/reports (dashboard metrics, CSV export)
│   │   ├── notifications.js                     # /api/notifications (in-app notifications, mark read)
│   │   ├── audit.js                             # /api/audit-logs (administrative audit trail)
│   │   ├── crm.js                               # Legacy mock feed (/api/crm/tasks)
│   │   └── helpdesk.js                          # Legacy mock feed (/api/helpdesk/tasks)
│   ├── scripts/
│   │   ├── migrate.js                           # npm run db:migrate
│   │   ├── seed.js                              # npm run db:seed (idempotent Indian demo data)
│   │   └── provision-admin.js                   # npm run provision:admin (secure admin setup)
│   ├── utils/
│   │   ├── auth.js                              # Scrypt hashing, timingSafeEqual, token generators
│   │   ├── audit.js                             # Structured audit logger
│   │   └── notifications.js                     # In-app notification creation
│   ├── server.js                                # Express server, dynamic CORS, startup validation
│   └── test/
│       ├── api.test.js                          # CORS, read-only mock route tests
│       ├── database.test.js                     # Schema migration and readiness tests (pg-mem)
│       ├── crm.test.js                          # Auth, RBAC, task CRUD, seeding, reporting tests
│       ├── security.test.js                     # Tenant isolation, CSRF, single-use reset, rate limiting
│       └── postgres-integration.test.js         # Live PostgreSQL staging integration suite
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── crm.js                           # Full CRM API client (Bearer auth, CRUD helpers)
│   │   │   └── tasks.js                         # Legacy parallel mock fetcher
│   │   ├── components/
│   │   │   ├── KanbanBoard.jsx                  # 6-column interactive drag & drop board
│   │   │   ├── CalendarView.jsx                 # Monthly deadline schedule grid
│   │   │   ├── EmployeesView.jsx                # Staff directory with workload counters
│   │   │   ├── DepartmentsView.jsx              # Divisions and department heads
│   │   │   ├── ProjectsView.jsx                 # Client projects with milestone health
│   │   │   ├── ClientsCrmView.jsx               # Pipeline Kanban/table in INR (₹)
│   │   │   ├── ReportsView.jsx                  # Analytics charts and CSV export
│   │   │   ├── ActivityLogView.jsx              # Searchable audit trail
│   │   │   ├── NotificationsView.jsx            # In-app notification drawer & alerts
│   │   │   ├── CreateTaskModal.jsx              # Full task creation & edit dialog
│   │   │   ├── AuthModal.jsx                    # Sign-in & quick test persona switcher
│   │   │   ├── TaskDetailDrawer.jsx             # Live comments & task status drawer
│   │   │   ├── TaskCard.jsx                     # Priority card item
│   │   │   └── FilterBar.jsx                    # Multi-parameter search & filtering
│   │   ├── App.jsx                              # Root enterprise shell & role routing
│   │   └── index.css                            # Complete design system with light/dark tokens
│   ├── test/                                    # 14 frontend unit & metric tests
│   └── vercel.json                              # SPA routing rewrite rule for Vercel
│
├── docs/
│   ├── SECURITY_AUDIT_REPORT.md                 # Full security audit, fixes & regression verification
│   └── DEPLOYMENT_GUIDE.md                      # PowerShell step-by-step deployment and verification
└── README.md
```

---

## Windows PowerShell Quick Start

Follow these steps in Windows PowerShell.

### 1. Prerequisites
* **Node.js** ≥ 18.0.0 (Node 20 or 22 LTS recommended)
* **npm** ≥ 9
* Check versions:
```powershell
node -v
npm -v
```

### 2. Install Dependencies

Open a PowerShell terminal at the repository root:
```powershell
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ..\frontend
npm install

# Return to root
cd ..
```

---

## Running Locally

You will need two PowerShell terminal windows:

### Terminal 1 — Start the Backend (Port 3001)
```powershell
cd C:\Users\shiva\Downloads\projects\employee-task-dashboard\backend
npm start
```
*For automatic restart during development: `npm run dev`*

### Terminal 2 — Start the Frontend (Port 5173)
```powershell
cd C:\Users\shiva\Downloads\projects\employee-task-dashboard\frontend
npm run dev
```

Open your web browser at **http://localhost:5173**

---

## Database Management & Seeding (Local / Staging)

### 1. Configure Local Database Connection
In PowerShell inside the `backend` directory:
```powershell
cd backend
Copy-Item .env.example .env
```
Edit `backend\.env` with your favorite text editor (Notepad, VS Code):
```powershell
notepad .env
```
Set your `DATABASE_URL` (for example, Neon, Render, Supabase, or local PostgreSQL):
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/taskflow_crm?sslmode=disable"
```

### 2. Apply Database Migrations
```powershell
npm run db:migrate
```
Applies `001_create_taskflow_core.sql` and `002_aulten_digital_crm_schema.sql` idempotently inside a transaction.

### 3. Seed Realistic Indian Demo Data
```powershell
npm run db:seed
```
Seeds 12 departments, 18 Indian employees, 7 CRM clients, 7 projects, 52 tasks, and demo audit logs. Safe and idempotent.

### 4. Secure Initial Admin Provisioning (PowerShell)
To provision an initial Super Admin account without hardcoded credentials:
```powershell
$env:ADMIN_NAME = "Aulten Super Admin"
$env:ADMIN_EMAIL = "admin@aulten.example.com"
npm run provision:admin
```
* If `$env:ADMIN_PASSWORD` is omitted, a 24-character cryptographically secure password is generated and displayed once.
* If re-run on an existing admin whose password is already set, the existing password is preserved safely.

---

## Testing & Quality Assurance

### Run All Backend Tests (33 Passing Tests)
```powershell
cd backend
npm test
```
**Test Coverage (33 Tests):**
* API security headers & CORS origin restrictions
* Legacy mock CRM and Helpdesk response shapes
* PostgreSQL schema migrations, indexes & foreign key constraints
* Scrypt password hashing & constant-time comparison
* Idempotent demo database seeding
* Role-based access control (Employees blocked from audit logs and bulk actions)
* Task CRUD lifecycle (Create, Kanban status patch, add comment, delete)
* Tenant isolation across tasks, comments, projects, and clients
* CSV export authentication and tenant isolation
* Password reset token single-use invalidation
* Simulation token suppressed in production (`NODE_ENV=production`)
* Demo user switcher fail-closed in production
* Clean client CRM join with active projects count
* Safe partial updates for employees, projects, and clients
* CSRF protection on mutating cookie requests
* Rate limiter blocking brute-force login attempts
* Database readiness probe (HTTP 200 on healthy connection, HTTP 503 on unconfigured)

### Run Live PostgreSQL Staging Integration Test
When a disposable staging PostgreSQL database is available:
```powershell
cd backend
$env:TEST_DATABASE_URL = "postgresql://user:password@host:5432/disposable_staging_db?sslmode=require"
npm run test:integration
```
* Verifies real PostgreSQL information_schema tables, UUID generation, scrypt verification, session persistence, and derived joins.
* **Safety guard**: Refuses to run if `TEST_DATABASE_URL` matches `DATABASE_URL` to protect production data.

### Run All Frontend Tests (14 Passing Tests)
```powershell
cd frontend
npm test
```

### Run Frontend Linter (Oxlint)
```powershell
cd frontend
npm run lint
```
*0 warnings and 0 errors.*

### Run Frontend Production Build (Vite)
```powershell
cd frontend
npm run build
```
*Generates optimized production bundle in `frontend/dist/` in < 200ms.*

---

## Production Deployment Checklist

For comprehensive step-by-step instructions with PowerShell commands, see:
* **[Deployment Guide](docs/DEPLOYMENT_GUIDE.md)**
* **[Security Audit Report](docs/SECURITY_AUDIT_REPORT.md)**

### Brief Summary:
1. **Render (Backend)**:
   * Root Directory: `backend`
   * Build Command: `npm install`
   * Start Command: `npm start`
   * Environment Variables: `NODE_ENV=production`, `DATABASE_URL=...`, `FRONTEND_URL=https://employee-task-dashboard-chi.vercel.app`
2. **Vercel (Frontend)**:
   * Root Directory: `frontend`
   * Framework Preset: Vite
   * Build Command: `npm run build`
   * Output Directory: `dist`
   * Environment Variable: `VITE_API_BASE_URL=https://employee-task-dashboard-g2ug.onrender.com`

---

## License & Credits

Developed for **Aulten Digital** · TaskFlow Employee Task Management CRM.
All rights reserved.
