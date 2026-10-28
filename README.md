# Employee Task Dashboard

A full-stack Employee Task Dashboard built as a **technical assessment for Aulten Digital Private Limited**.

The application fetches tasks from two separate mock REST APIs (CRM and Helpdesk), combines them into a unified prioritised list, and provides employee and status filters, clickable source links, and error-resilient API handling.

> **Assessment scope only.** All employee names, clients, projects, and task data are clearly generic and fictional. No real organisations, actual customers, or real employees are represented.

---

## What This Application Does

1. **Fetches tasks from two mock REST APIs**
   - `GET /api/crm/tasks` — returns 8 sample CRM tasks
   - `GET /api/helpdesk/tasks` — returns 8 sample Helpdesk tickets
2. **Combines both sources** into one unified task list shown on the dashboard.
3. **Prioritises tasks** by deadline and urgency (overdue first, then high-urgency, then by due date).
4. **Filters** by employee/assignee and task status (individually and together).
5. **Clickable source links** — each task links to `example-crm.com/tasks/...` or `example-helpdesk.com/tickets/...`.
6. **Error handling** — loading states, empty states, API failures, partial-source fallback, and responsive layout.
7. **Offline/demo mode** — if the backend is unreachable, a localStorage fallback provides full CRUD without blank screens.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19 + Vite 8, vanilla CSS design tokens, responsive sidebar |
| **Backend** | Node.js 18+ + Express 4, secure RESTful API |
| **Database** | PostgreSQL (`pg`) + `pg-mem` for tests, ACID transactions |
| **Security** | Scrypt hashing, HttpOnly cookies, CSRF protection, rate limiting |
| **Testing** | Node built-in test runner, Oxlint |

---

## Task Priority Rules

Tasks are sorted in the following order:

| Priority Level | Rule |
|---|---|
| **Overdue + Pending/In-Progress** | Deadline is before today and task is not completed |
| **High urgency** | `urgency === 'high'` (regardless of deadline) |
| **Medium urgency** | `urgency === 'medium'` |
| **Upcoming** | Deadline is in the future, lower urgency |
| **Completed** | `status === 'completed'` — always sorted last |

Within each group, tasks are further sorted by deadline (earliest first).

---

## Mock API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/crm/tasks` | GET | Returns 8 generic sample CRM tasks |
| `/api/helpdesk/tasks` | GET | Returns 8 generic Helpdesk/IT tickets |
| `/api/health` | GET | Backend health check |
| `/api/ready` | GET | PostgreSQL readiness probe |

Both mock endpoints respond within ~200ms and return JSON of shape:
```json
{
  "source": "CRM (Mock)",
  "count": 8,
  "tasks": [
    {
      "id": "crm-001",
      "title": "...",
      "employee": "Employee 01",
      "status": "in-progress",
      "deadline": "2026-10-26",
      "urgency": "high",
      "source": "CRM",
      "sourceUrl": "https://example-crm.com/tasks/crm-001"
    }
  ]
}
```

---

## Sample Data

All sample data uses clearly generic labels — no real organisations or people:

- **Employees:** Employee 01, Employee 02, Employee 03, Employee 04, Employee 05
- **Departments:** Engineering, Sales & CRM, Support & Helpdesk, Operations
- **Projects:** Project Alpha, Project Beta, Project Gamma
- **Clients:** Client A, Client B, Client C
- **Task sources:** `https://example-crm.com` and `https://example-helpdesk.com`

---

## Project Structure

```
employee-task-dashboard/
├── backend/
│   ├── routes/
│   │   ├── crm.js              # GET /api/crm/tasks  — mock CRM data
│   │   ├── helpdesk.js         # GET /api/helpdesk/tasks — mock Helpdesk data
│   │   ├── tasks.js            # Full CRUD task routes (PostgreSQL)
│   │   ├── employees.js        # Employee directory routes
│   │   ├── departments.js      # Department routes
│   │   ├── projects.js         # Project routes
│   │   ├── clients.js          # Client CRM routes
│   │   ├── reports.js          # Dashboard reports & CSV export
│   │   ├── notifications.js    # In-app notifications
│   │   ├── audit.js            # Audit log routes
│   │   └── auth.js             # Login, logout, demo switcher
│   ├── middleware/
│   │   ├── auth.js             # Session + CSRF middleware
│   │   └── rateLimiter.js      # In-memory IP rate limiter
│   ├── db/
│   │   ├── pool.js             # PostgreSQL connection pool
│   │   └── migrations/         # SQL schema migrations
│   ├── scripts/                # db:migrate, db:seed, provision:admin
│   ├── utils/                  # Scrypt hashing, audit logger
│   ├── server.js               # Express app entry point
│   └── test/                   # Backend test suite (40 tests)
│
├── frontend/
│   ├── src/
│   │   ├── api/crm.js          # API client (live backend + localStorage fallback)
│   │   ├── data/manufacturingSeedData.js  # Generic demo data for offline mode
│   │   ├── components/         # FilterBar, TaskList, KanbanBoard, etc.
│   │   ├── utils/              # taskMetrics, prioritize, safeUrl, analyticsDates
│   │   └── App.jsx             # Root component, data loading, routing
│   ├── test/                   # Frontend test suite (14 tests)
│   ├── index.html              # App entry — correct title & meta
│   └── vercel.json             # SPA rewrite rule for Vercel
│
└── README.md
```

---

## Local Setup (Windows PowerShell)

### Prerequisites
- Node.js ≥ 18.0.0 (Node 20 or 22 LTS recommended)
- npm ≥ 9

```powershell
node -v
npm -v
```

### 1. Install Dependencies

```powershell
# Backend
cd C:\Users\shiva\Downloads\projects\employee-task-dashboard\backend
npm install

# Frontend
cd ..\frontend
npm install
```

### 2. Configure Backend Environment (Optional — needed for PostgreSQL)

```powershell
cd backend
Copy-Item .env.example .env
notepad .env
```

Set `DATABASE_URL` if you have a PostgreSQL instance. Without it, the backend runs in demo mode (no persistence), and the frontend falls back to localStorage automatically.

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/taskflow?sslmode=disable"
```

### 3. Run Backend (Terminal 1)

```powershell
cd C:\Users\shiva\Downloads\projects\employee-task-dashboard\backend
npm start
```

Backend starts on **http://localhost:3001**

Verify:
- http://localhost:3001/api/health → `{"status":"ok"}`
- http://localhost:3001/api/crm/tasks → 8 CRM tasks
- http://localhost:3001/api/helpdesk/tasks → 8 Helpdesk tickets

### 4. Run Frontend (Terminal 2)

```powershell
cd C:\Users\shiva\Downloads\projects\employee-task-dashboard\frontend
npm run dev
```

Frontend starts on **http://localhost:5173**

---

## Database Migrations & Seeding (Optional)

Only needed if you have a PostgreSQL database configured:

```powershell
cd backend
# Apply schema migrations
npm run db:migrate

# Seed generic demo data
npm run db:seed

# Provision an initial admin account
$env:ADMIN_NAME = "Admin"
$env:ADMIN_EMAIL = "admin@example.com"
npm run provision:admin
```

---

## Testing

### Backend Tests (40 tests)

```powershell
cd backend
npm test
```

**Test coverage:**
- API health and security headers
- CORS origin restrictions
- Mock CRM and Helpdesk response shapes
- PostgreSQL schema migrations and foreign keys
- Scrypt password hashing and constant-time comparison
- Idempotent demo seeding
- Role-based access control (RBAC)
- Task CRUD lifecycle
- Tenant isolation
- CSV export authentication
- Password reset token single-use
- CSRF protection
- Rate limiter
- Database readiness probe

### Frontend Tests (14 tests)

```powershell
cd frontend
npm test
```

**Test coverage:**
- Task prioritisation rules
- Task metrics calculation (total, overdue, in-progress, completed)
- Safe URL validation for source links
- Mock API fetching (CRM + Helpdesk parallel fetch and merge)
- Analytics date range helpers

### Lint Check

```powershell
cd frontend
npm run lint
```
*Expected: 0 warnings, 0 errors.*

### Production Build

```powershell
cd frontend
npm run build
```
*Expected: bundle built in ~200ms to `frontend/dist/`.*

### Live Integration Tests (requires staging PostgreSQL only)

```powershell
cd backend
$env:TEST_DATABASE_URL = "postgresql://user:password@host:5432/staging_db?sslmode=require"
npm run test:integration
```

---

## Deployment

| Service | Config |
|---|---|
| **Frontend** | Vercel — Root: `frontend/`, Build: `npm run build`, Output: `dist` |
| **Backend** | Render — Root: `backend/`, Start: `npm start` |
| **Frontend env var** | `VITE_API_BASE_URL=https://your-render-backend.onrender.com` |
| **Backend env vars** | `NODE_ENV=production`, `DATABASE_URL=...`, `FRONTEND_URL=https://your-vercel-app.vercel.app` |

Live demo: https://employee-task-dashboard-chi.vercel.app/

---

## Known Limitations

- The mock CRM and Helpdesk endpoints (`/api/crm/tasks`, `/api/helpdesk/tasks`) return static in-memory data. They do not represent real external services.
- When the backend is not reachable (e.g., static Vercel deployment without backend), the app falls back to localStorage demo data. This is clearly indicated in the Settings page under "Demo Mode".
- The PostgreSQL backend is optional for this assessment. All core assignment requirements (two API sources, combined list, filters, priority sorting, clickable links) work fully in the fallback mode.
- Historical task completion timestamps are not persisted in the mock API, so trend charts use snapshot data only.

---

## Assignment Checklist

| Requirement | Status |
|---|---|
| Fetch tasks from mock CRM API | ✅ `/api/crm/tasks` |
| Fetch tasks from mock Helpdesk API | ✅ `/api/helpdesk/tasks` |
| Combine both into unified dashboard | ✅ merged and sorted in FilterBar/TaskList |
| Task prioritisation by deadline + urgency | ✅ `utils/prioritize.js` |
| Employee filter | ✅ FilterBar dropdown |
| Task status filter | ✅ FilterBar dropdown |
| Clickable source links | ✅ TaskCard and TaskDetailDrawer |
| Loading states | ✅ LoadingSpinner component |
| Empty states | ✅ EmptyState component |
| Error handling | ✅ ErrorMessage + partial-source fallback |
| Responsive design | ✅ sidebar collapses on mobile |
| GitHub repository | ✅ https://github.com/DollyQx/employee-task-dashboard |
| Live demo | ✅ https://employee-task-dashboard-chi.vercel.app/ |

---

## License

Developed as a technical assessment submission for **Aulten Digital Private Limited**.
All sample data is fictional and for demonstration purposes only.
