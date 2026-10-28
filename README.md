# Employee Task Dashboard

A professional, responsive employee task dashboard that aggregates tasks from two separate mock REST API sources — a **CRM** system and a **Helpdesk** system — into a single, priority-sorted unified view.

> ⚠️ **Mock Integrations Only** — The CRM and Helpdesk endpoints are local mock APIs backed by hardcoded data. They do **not** call real external systems.

---

## Tech Stack

| Layer    | Technology                     |
|----------|--------------------------------|
| Frontend | React 19 + Vite 8              |
| Backend  | Node.js + Express              |
| Language | JavaScript (ES Modules)        |
| Styling  | Vanilla CSS (custom design system) |

---

## Project Structure

```
employee-task-dashboard/
├── backend/
│   ├── package.json
│   ├── server.js              # Express server (port 3001)
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
│       │   └── prioritize.js  # Scoring & sorting algorithm
│       └── components/
│           ├── Header.jsx
│           ├── FilterBar.jsx
│           ├── TaskCard.jsx
│           ├── TaskList.jsx
│           ├── StatusBadge.jsx
│           ├── UrgencyBadge.jsx
│           ├── LoadingSpinner.jsx
│           ├── ErrorMessage.jsx
│           └── EmptyState.jsx
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
| `employee`  | string | Assigned employee's full name                |
| `status`    | string | `pending` \| `in-progress` \| `completed`   |
| `deadline`  | string | ISO date string `YYYY-MM-DD`                 |
| `urgency`   | string | `high` \| `medium` \| `low`                 |
| `source`    | string | `CRM` or `Helpdesk`                          |
| `sourceUrl` | string | URL of the task in the originating system    |

---

## Prioritization Algorithm

Tasks from both sources are combined and sorted using a simple, explainable numeric scoring system.

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
- ✅ **Filters** — filter by employee name and task status
- ✅ **Clickable tasks** — opens source system URL in new tab
- ✅ **Loading state** — animated spinner during parallel fetches
- ✅ **Error state** — clear message + retry button if API is unreachable
- ✅ **Empty state** — friendly message + clear filters button
- ✅ **Overdue warnings** — red highlight + inline warning banner
- ✅ **Responsive** — works on mobile, tablet, and desktop
- ✅ **Accessible** — ARIA roles, keyboard navigation, semantic HTML

---

## Error Handling

| Scenario                      | Behaviour                                                    |
|-------------------------------|--------------------------------------------------------------|
| Backend not running           | Error state with exact error message and Retry button        |
| One API fails, other succeeds | Error thrown (both fetched via `Promise.all`)                |
| Filters yield no results      | Empty state with "Clear Filters" button                      |
| Unknown task status/urgency   | Graceful fallback — shows raw value with default styling     |

---

## Interview Notes

### Why `Promise.all` for fetching?
Both APIs are independent — there is no reason to wait for one before starting the other. `Promise.all` runs them concurrently, cutting fetch time roughly in half.

### Why client-side filtering?
With only 16 tasks the dataset is tiny. Filtering in memory via `Array.filter` is instant and avoids unnecessary API round-trips. In a real system with thousands of tasks, filtering would be server-side with query parameters.

### Why a score-based sort instead of multi-key sort?
A single numeric score is easy to explain, debug, and extend. Adding a new factor (e.g. "VIP client" +20) just means adding another term to the formula.
