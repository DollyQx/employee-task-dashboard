# TaskFlow Frontend

React 19 and Vite frontend for the read-only Employee Task Dashboard.

## Development

```bash
npm ci
npm run dev
```

The Vite development server proxies `/api` requests to `http://localhost:3001`. For a production build, configure `VITE_API_BASE_URL` as the backend origin (without the `/api` suffix), then run:

```bash
npm test
npm run build
```

## Data and Capabilities

The frontend fetches CRM and Helpdesk task records from the existing GET endpoints. These sources are demonstration-only and do not support persistent task mutations. The current schema has due dates but no trustworthy creation/completion timestamps or historical snapshots; Team Analytics reports those trends as unavailable rather than inferring them from deadlines.
