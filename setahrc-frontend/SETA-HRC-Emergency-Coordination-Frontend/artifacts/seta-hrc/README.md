# SETA-HRC

Smart Emergency Triage, Ambulance & Hospital Resource Coordination System — a B.Tech project frontend for coordinating dispatch, triage, ambulance crews and receiving hospitals.

## Run locally

1. Install workspace dependencies with the repository's pnpm workspace setup.
2. Copy `.env.example` to `.env` and configure the Replit-managed Clerk publishable key. Clerk keys are normally provisioned by Replit; do not put a secret key in browser environment variables.
3. Start the artifact with the configured Vite workflow. The scaffold expects `PORT` and `BASE_PATH` to be supplied by the workspace.

`VITE_API_BASE_URL` defaults to `/api`. The only currently supported API is `GET /api/healthz`; emergency, hospital, ambulance and notification endpoints do not exist yet. The Axios client sends same-origin cookie-based requests (`withCredentials`) and does not implement browser bearer-token handling.

## Authentication and access

- Clerk sign-in and sign-up use branded embedded routes with the complete artifact base path and proxy configuration.
- Operational access is derived only from Clerk `publicMetadata.role` values: `dispatcher`, `hospital`, `paramedic`, or `admin`.
- A new signup never self-assigns operational access. Signed-in users without a trusted role are directed to `/access-pending`.
- The Express server and its Clerk proxy middleware are managed separately and are intentionally not part of this artifact.

## Public sample workspace

Visit `/demo` for a public, unauthenticated sample workspace. All records are fictional and the UI marks sample-data surfaces with a DEMO label. Intake, status changes, ambulance assignment, hospital approvals, resource updates, notifications, and audit history operate against an in-memory store. **All demo state resets on reload.** Do not enter real patient or caller details. No patient/caller information or auth tokens are written to localStorage or sessionStorage.

## Current integration boundary

Authenticated operational routes show an explicit API-not-connected state until real endpoints and role-aware server authorization are available. Do not treat sample records, triage suggestions, route markers, or sample analytics as live clinical information. Triage cues are demonstrative and are not medical advice.

## Frontend stack

React, React Router (with Vite base-path support), Clerk React, Axios, Leaflet / React Leaflet, Recharts, Lucide React, Tailwind CSS v4.
