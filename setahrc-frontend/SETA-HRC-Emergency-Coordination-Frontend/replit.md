# SETA-HRC

Smart Emergency Triage, Ambulance & Hospital Resource Coordination System — a role-aware emergency coordination frontend for dispatch, triage, hospital capacity, ambulance crews, and reporting.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/seta-hrc run dev` — run the SETA-HRC web frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Frontend API base defaults to `/api`; Clerk keys are managed through the workspace auth setup.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/seta-hrc/` — React/Vite frontend, demo state, service modules, environment example, and run instructions.
- `artifacts/api-server/` — shared Express API and Clerk proxy; the only operational endpoint currently available is `GET /api/healthz`.
- `lib/api-spec/openapi.yaml` — source of truth for the current API contract.

## Architecture decisions

- Operational role gates read only trusted Clerk `publicMetadata.role`; signup must not assign dispatcher, hospital, paramedic, or admin privileges.
- `/demo` is public and uses fictional, in-memory sample records; it resets on reload and must never accept real patient or caller details.
- Patient data and authentication tokens must not be stored in browser storage.
- Operational API routes must enforce authentication and role authorization on the server before real data is connected; frontend checks alone are not security.
- The frontend uses cookie-based Clerk requests; do not add browser bearer-token handling.

## Product

The frontend includes public landing and authentication routes, a dispatcher overview, emergency intake and triage, hospital recommendation and capacity views, ambulance dispatch and paramedic workflows, admin directories, notifications, analytics, and printable reports. Operational workflows are currently demonstrated with clearly marked sample data because domain API endpoints are not yet implemented.

## User preferences

The user requested a professional medical-technology interface, responsive behavior, accessible validated forms, light surfaces with navy accents, and red reserved for critical emergencies and urgent alerts.

## Gotchas

- The app uses the configured Vite artifact workflow, which supplies `PORT` and `BASE_PATH`; use that workflow rather than starting Vite from the workspace root.
- Clerk's production proxy must be mounted before Express body parsers.
- Do not present the demo's triage suggestions, routes, resource counts, or charts as live clinical information.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
