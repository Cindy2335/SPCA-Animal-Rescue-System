# SPCA Admin Web App

React admin dashboard for SPCA operations: pets, adoption requests, reports, activity, and quick platform stats.

## Run it locally

Install dependencies once:

```bash
npm install
```

Start the Vite dev server:

```bash
npm run dev
```

The dashboard loads live database stats from the backend at `http://localhost:3000` after an admin signs in.

## Change the API URL

```js
localStorage.setItem("spcaAdminApiUrl", "http://YOUR_SERVER_IP:3000");
location.reload();
```

## Admin-only data

Reports and adoption applications require an admin auth token from the backend. Sign in with an admin account, or seed one through the backend tools.

For local development, the seeded admin account is:

```text
admin@spca.local
SpcaAdmin123!
```

To reset:

```js
localStorage.removeItem("spcaAdminApiUrl");
localStorage.removeItem("spcaAdminToken");
location.reload();
```
