# TaskFlow Employee Task Dashboard

A responsive team task dashboard that aggregates tasks from two read-only mock REST API sources — a **CRM** system and a **Helpdesk** system — into a single, priority-sorted view.

> **Read-only demonstration APIs:** CRM and Helpdesk endpoints return hardcoded demonstration records. They do not connect to real external systems and do not persist TaskFlow edits.

---

## Tech Stack

| Layer    | Technology                     |
|----------|--------------------------------|
| Frontend | React 19 + Vite 8              |
| Backend  | Node.js + Express 4            |
| Language | JavaScript (ES Modules)        |
| Styling  | Vanilla CSS (custom design system) |

---

## Project Structure

```
employee-task-dashboard/
├── backend/
│   ├── package.json
│   ├── server.js              # Express server (port 3001)
│   ├── test/api.test.js        # API, CORS, security-header, and read-only tests
│   └── routes/
│       ├── crm.js             # GET /api/crm/tasks
│       └── helpdesk.js        # GET /api/helpdesk/tasks
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js         # Dev proxy: /api → localhost:3001
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx            # Root component, state management
│       ├── index.css          # Design system / tokens
│       ├── api/
│       │   └── tasks.js       # Parallel fetch + merge helper
│       ├── utils/
│       │   ├── prioritize.js
│       │   ├── taskMetrics.js # Shared overdue, snapshot, and filter rules
│       │   └── analyticsDates.js # Date range and trend calculations
│       └── components/
│           ├── FilterBar.jsx
│           ├── TaskCard.jsx
│           ├── TaskList.jsx
│           ├── TaskDetailDrawer.jsx
│           ├── TeamAnalytics.jsx
│           ├── DateRangeControls.jsx
│           └── OverviewInsights.jsx
│
└── README.md
```

---

## Installation & Setup

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9

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

## Running the Application

You need **two terminal windows**, one for each server.

### Terminal 1 — Start the backend (port 3001)
```bash
cd backend
node server.js
```

You should see:
```
✅ Employee Task Dashboard API
   Server running at http://localhost:3001
   CRM tasks:      http://localhost:3001/api/crm/tasks
   Helpdesk tasks: http://localhost:3001/api/helpdesk/tasks
```

### Terminal 2 — Start the frontend (port 5173)
```bash
cd frontend
npm run dev
```

Open your browser at **http://localhost:5173**

## Read-only Data and Supported Actions

The backend exposes `GET /api/crm/tasks`, `GET /api/helpdesk/tasks`, and `GET /api/health`. CRM and Helpdesk records are demonstration data held in route modules. There is no database, authentication/authorization model, or write integration. Create, edit, delete, bulk update, and persistent status changes are intentionally not offered. Use **Open original task** in the detail drawer only where the source URL is available.

Task records include `id`, `title`, `employee`, `status`, `deadline`, `urgency`, `source`, and `sourceUrl`. The mock CRM and Helpdesk source URLs use placeholder domains and are shown as unavailable rather than opened; legitimate source URLs are preserved. The current response does not include creation or completion timestamps or historical snapshots. Team Analytics labels those trends unavailable instead of deriving them from deadlines. Current workload, overdue, and completion-rate figures are snapshots of fetched records; completed tasks are excluded from overdue counts.

## Environment and Deployment

For Vercel, set the frontend root directory to `frontend` and define `VITE_API_BASE_URL` as the backend origin (for example, `https://employee-task-dashboard-g2ug.onrender.com`, without `/api`). Vite embeds this value at build time. The frontend keeps `/api` as a development fallback for the Vite proxy.

For Render, set the backend root directory to `backend`, the build command to `npm ci`, and the start command to `npm start`. The Express CORS allowlist includes the production TaskFlow origin and local Vite origins; browser requests are limited to GET. Do not configure credentials or write permissions: this service has no authenticated persistence layer.

Run checks from the repository root:

```bash
cd frontend && npm test && npm run build
cd ../backend && npm test
```

---

## API Endpoints

Both endpoints are served by the local Express backend. They simulate a ~300-400 ms network delay to mimic real external API calls.

### `GET /api/crm/tasks`
Returns 8 mock CRM tasks (client follow-ups, proposals, renewals).

**Response shape:**
```json
{
  "source": "CRM (Mock)",
  "count": 8,
  "tasks": [
    {
      "id": "crm-001",
      "title": "Follow up with Acme Corp on Q4 proposal",
      "employee": "Sarah Johnson",
      "status": "in-progress",
      "deadline": "2026-10-26",
      "urgency": "high",
      "source": "CRM",
      "sourceUrl": "https://example-crm.com/tasks/crm-001"
    }
  ]
}
```

### `GET /api/helpdesk/tasks`
Returns 8 mock Helpdesk tasks (IT tickets, escalations, infrastructure issues).

Response shape is identical to CRM, with `source: "Helpdesk"`.

### `GET /api/health`
Simple health check: `{ "status": "ok", "timestamp": "..." }`

---

## Task Schema

Every task object has these fields:

| Field       | Type   | Description                                  |
|-------------|--------|----------------------------------------------|
| `id`        | string | Unique identifier (e.g. `crm-001`, `hd-007`) |
| `title`     | string | Short description of the task                |
| `employee`  | string | Assigned employee's full name, when assigned  |
| `status`    | string | `pending` \| `in-progress` \| `completed`   |
| `deadline`  | string | ISO date string `YYYY-MM-DD`                 |
| `urgency`   | string | `high` \| `medium` \| `low`                 |
| `source`    | string | `CRM` or `Helpdesk`                          |
| `sourceUrl` | string | URL of the task in the originating system    |

---

## Prioritization Algorithm


```
Priority Score = urgencyScore + deadlineScore
```

### Urgency Score
| Urgency | Score |
|---------|-------|
| high    | 30    |
| medium  | 15    |
| low     |  5    |

### Deadline Score
| Deadline            | Score |
|---------------------|-------|
| Overdue (past)      | 50    |
| Due today           | 30    |
| Due within 3 days   | 15    |
| Future (> 3 days)   |  0    |

### Examples
| Task                              | Score | Reason                     |
|-----------------------------------|-------|----------------------------|
| High urgency + overdue            |  80   | 30 + 50 — always first     |
| High urgency + due today          |  60   | 30 + 30                    |
| Medium urgency + overdue          |  65   | 15 + 50                    |
| Low urgency + 2 weeks away        |   5   | 5 + 0 — sinks to bottom    |

Tasks are sorted **descending** by score. Ties maintain their original insertion order (CRM tasks first, then Helpdesk tasks).

---

## Features

- ✅ **Unified task list** — CRM + Helpdesk tasks merged and sorted by priority
- ✅ **Priority scoring** — transparent urgency × deadline algorithm
- ✅ **Filters** — search and filter by assignee, status, priority, source, and overdue state
- ✅ **Task details** — accessible, read-only drawer with a validated original-source link
- ✅ **Loading state** — task skeletons during parallel fetches
- ✅ **Error state** — clear message + retry button if API is unreachable
- ✅ **Empty state** — friendly message + clear filters button
- ✅ **Overdue warnings** — restrained date indicators; completed tasks are excluded
- ✅ **Team analytics** — workload and current-snapshot distributions from fetched data
- ✅ **Date ranges** — timestamp-backed trends only; unavailable history is explicitly identified
- ✅ **Responsive** — works on mobile, tablet, and desktop
- ✅ **Accessible** — ARIA roles, keyboard navigation, semantic HTML
- ✅ **Overview distributions** — current task summaries link to filtered task lists
- ✅ **Task detail drawer** — keyboard accessible, with safe original-source links
- ✅ **Team analytics** — workload, snapshot completion, and honest date-history limits
- ✅ **Read-only source status** — mock APIs do not claim changes are persisted

---

## Error Handling

| Scenario                      | Behaviour                                                    |
|-------------------------------|--------------------------------------------------------------|
| Backend unavailable or timed out | Recoverable error state with source context and Retry button |
| One API fails, other succeeds | Error thrown (both fetched via `Promise.all`)                |
| Filters yield no results      | Empty state with "Clear Filters" button                      |
| Unknown task status/urgency   | Graceful fallback — shows raw value with default styling     |

## Validation and Security Notes

- The backend is a read-only demonstration service. It has no database, user authentication, authorization, or source write API. Task create/edit/delete, status mutation, and bulk operations are not supported.
- CORS allows the deployed Vercel origin and local Vite development origins. It advertises GET only. Response headers include `nosniff`, frame denial, referrer policy, and `no-store`; `X-Powered-By` is disabled.
- The frontend validates task response shape, reports HTTP/JSON/network errors, and times out requests after 10 seconds.
- Production dependency audits were clean at the most recent review; rerun audits when dependencies change.
- The current task schema has no creation/completion timestamps or historical snapshots. Activity trends and historical overdue comparisons are unavailable until the data provider supplies reliable event history.

## Deployment Checklist

1. In Vercel, use `frontend` as the root directory and set `VITE_API_BASE_URL` to `https://employee-task-dashboard-g2ug.onrender.com` (origin only, without `/api`) for each deployed environment. Rebuild after changing it.
2. In Render, use `backend` as the root directory, `npm ci` as the build command, and `npm start` as the start command. Confirm the deployed branch/commit in the Render dashboard.
3. Verify `GET https://employee-task-dashboard-g2ug.onrender.com/api/health` and both `/api/crm/tasks` and `/api/helpdesk/tasks` after deployment.
4. Verify the Render response includes `Access-Control-Allow-Origin: https://employee-task-dashboard-chi.vercel.app` for requests with that Origin.
5. These commands do not deploy, commit, or push:

```bash
cd frontend && npm ci && npm test && npm run build
cd ../backend && npm ci && npm test
```

---

## Interview Notes

### Why `Promise.all` for fetching?
Both APIs are independent — there is no reason to wait for one before starting the other. `Promise.all` runs them concurrently, cutting fetch time roughly in half.

### Why client-side filtering?
With only 16 tasks the dataset is tiny. Filtering in memory via `Array.filter` is instant and avoids unnecessary API round-trips. In a real system with thousands of tasks, filtering would be server-side with query parameters.

### Why a score-based sort instead of multi-key sort?
A single numeric score is easy to explain, debug, and extend. Adding a new factor (e.g. "VIP client" +20) just means adding another term to the formula.
