# Aulten Digital — TaskFlow Employee CRM

A production-grade, multi-user, responsive Employee Task Management & CRM platform architected for **Aulten Digital**, an Indian technology and software services enterprise.

TaskFlow provides role-based task tracking, project milestone management, an Indian client CRM pipeline, team workloads, interactive Kanban and monthly Calendar schedules, in-app notification routing, and security audit logs, backed by **PostgreSQL** and a high-performance **React 19 + Vite 8** frontend.

---

## Tech Stack

| Layer | Technology | Details |
|---|---|---|
| **Frontend** | React 19 + Vite 8 | Pure ES Modules, vanilla design tokens, responsive sidebar, light/dark themes |
| **Backend** | Node.js (v20+) + Express 4 | Secure RESTful architecture, parameterized SQL, role-based authorization |
| **Database** | PostgreSQL (`pg`) + `pg-mem` | ACID transactions, UUID keys, multi-tenant organization isolation |
| **Security** | Scrypt + Timing-Safe | OWASP memory-hard password hashing, HttpOnly cookies, rate limiting, CSP headers |
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
│   │   └── pool.js                              # PostgreSQL pool and readiness probe
│   ├── middleware/
│   │   ├── auth.js                              # Session verification, role guards, tenant attachment
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
│   ├── server.js                                # Express server, security headers, dynamic CORS
│   └── test/
│       ├── api.test.js                          # CORS, read-only mock route tests
│       ├── database.test.js                     # Schema migration and readiness tests (pg-mem)
│       └── crm.test.js                          # Auth, RBAC, task CRUD, seeding, reporting tests
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
│   └── test/                                    # 14 frontend unit & metric tests
│
└── README.md
```

---

## Installation & Setup

### Prerequisites
* **Node.js** ≥ 20.19 (tested with Node 22 & 24)
* **npm** ≥ 9
* Optional: Managed PostgreSQL database (Neon, Supabase, Render, AWS RDS, or local Docker)

### 1 — Install backend dependencies
```bash
cd backend
npm install
```

### 2 — Install frontend dependencies
```bash
cd frontend
npm install
```

---

## Running Locally

You need two terminal windows:

### Terminal 1 — Start the Backend (Port 3001)
```bash
cd backend
npm start
```
*Note: In development, nodemon is available via `npm run dev`.*

### Terminal 2 — Start the Frontend (Port 5173)
```bash
cd frontend
npm run dev
```

Open your browser at **http://localhost:5173**

---

## Database Management & Seeding

### 1. Database Configuration
Copy `backend/.env.example` to `backend/.env` and supply your database connection string:
```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
```

### 2. Apply Schema Migrations
```bash
cd backend
npm run db:migrate
```
Applies `001_create_taskflow_core.sql` and `002_aulten_digital_crm_schema.sql` safely within a transaction and records applied migrations in `schema_migrations`.

### 3. Seed Realistic Indian Demo Data
```bash
cd backend
npm run db:seed
```
* Sets up the **Aulten Digital** organization.
* Seeds **12 departments** (Engineering, Web, Mobile, DevOps, QA, Cybersecurity, Sales, HR, etc.).
* Seeds **18 Indian employees** with realistic designations, reporting managers, and hashed passwords.
* Seeds **7 enterprise clients** with CRM pipeline stages and deal values in INR (₹).
* Seeds **7 key company projects** with health indicators and budgets.
* Seeds **52 tasks** spanning all statuses (Backlog, To Do, In Progress, In Review, Blocked, Done) and priorities (Low, Medium, High, Urgent), with comments and tags.
* Seeds initial notifications and security audit logs.
* **Safe & Idempotent**: Uses `ON CONFLICT` clauses; safe to run multiple times without throwing duplicate key errors.

### 4. Secure Initial Admin Provisioning
To provision a brand new administrative account without default or hardcoded passwords:
```bash
cd backend
ADMIN_NAME="Aulten Super Admin" ADMIN_EMAIL="admin@aulten.example.com" npm run provision:admin
```
If `ADMIN_PASSWORD` is omitted, the script automatically generates a 24-character cryptographically secure password and outputs it to the console once.

---

## Testing & Quality Assurance

All test suites execute against isolated in-memory PostgreSQL (`pg-mem`) without requiring external database provisioning.

### Run All Backend Tests (18 Tests)
```bash
cd backend
npm test
```
**Test Coverage:**
* API security headers & CORS origin restrictions
* Legacy mock CRM and Helpdesk response verification
* PostgreSQL schema migration application & constraints
* Scrypt password hashing & constant-time comparison
* Idempotent demo database seeding
* Role-based access control (Employees blocked from audit logs, Admins permitted)
* Task CRUD lifecycle (Create, Kanban status patch, add comment, delete)
* Dashboard analytics calculation & CSV export formatting
* Database readiness probe (HTTP 200 on healthy connection, HTTP 503 on unconfigured)

### Run All Frontend Tests (14 Tests)
```bash
cd frontend
npm test
```
**Test Coverage:**
* Date range validation and comparison intervals
* Deadline calculations and calendar boundary rules
* Priority score algorithm and tie-breaking stability
* Safe external URL validator (blocking placeholder / javascript / data URIs)
* Snapshot metrics and multi-parameter task filters
* Mock API parallel fetch and error conversions

### Run Frontend Linter (Oxlint)
```bash
cd frontend
npm run lint
```
*0 warnings and 0 errors across 37 files.*

### Run Frontend Production Build (Vite)
```bash
cd frontend
npm run build
```
*Generates optimized production bundle in `frontend/dist/` in ~220ms.*

---

## Security Architecture

* **Broken Access Control & IDOR Mitigation**: All queries enforce tenant isolation using `WHERE organization_id = req.user.organization_id`. User roles (`super_admin`, `admin`, `manager`, `employee`) are checked server-side via `requireRole` middleware.
* **SQL Injection Prevention**: Parameterized queries are used exclusively (`$1, $2, ...`); no string concatenation.
* **Password Hashing**: Uses Node's native `crypto.scrypt` with a 16-byte random salt and memory-hard parameters. Verification uses `crypto.timingSafeEqual` to prevent timing attacks.
* **Session Management**: Cryptographically random 256-bit session tokens stored in `user_sessions`. Supported via `Authorization: Bearer` and secure, `HttpOnly`, `SameSite=Lax` cookies.
* **Rate Limiting**: In-memory IP rate limiter guards `/api/auth/login` and sensitive endpoints, returning HTTP 429 with `Retry-After`.
* **Cross-Site Scripting (XSS)**: No `dangerouslySetInnerHTML`. Response headers include `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Cache-Control: no-store`. `X-Powered-By` is disabled.
* **CSV Injection Defense**: Formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) are sanitized before generating CSV report exports.

---

## Production Deployment Checklist

### Frontend (Vercel)
1. Set Root Directory to `frontend`.
2. Configure build command: `npm run build`, output directory: `dist`.
3. Set environment variable `VITE_API_BASE_URL` to your backend origin (e.g. `https://employee-task-dashboard-g2ug.onrender.com`, without trailing `/api`).
4. Rebuild after configuring environment variables.

### Backend (Render)
1. Set Root Directory to `backend`.
2. Set Build Command to `npm ci`.
3. Set Start Command to `npm start`.
4. Add secret environment variable `DATABASE_URL` pointing to your managed PostgreSQL database.
5. Apply database migrations: Run `npm run db:migrate` in Render shell or deployment pipeline.
6. Verify endpoints:
   * Health: `GET https://employee-task-dashboard-g2ug.onrender.com/api/health`
   * Readiness: `GET https://employee-task-dashboard-g2ug.onrender.com/api/ready`
   * Tasks: `GET https://employee-task-dashboard-g2ug.onrender.com/api/tasks`

---

## License & Credits

Developed for **Aulten Digital** · TaskFlow Employee Task Management CRM.
All rights reserved.
