# MEMORY.md — El Social Bodega | Project Memory & Changelog

> This file is the living memory of the project. It must be updated continuously as the project evolves.  
> Every significant decision, architectural change, bug fix, or feature addition should be logged here.  
> This file is intended for future developers and LLM agents picking up the project.  
> **Single source of truth — there is only one MEMORY.md at the repo root (`CODE/MEMORY.md`).**

---

## Project Overview

**Project Name:** El Social Bodega — Warehouse Management System  
**Client:** El Social Medellín S.A.S  
**Type:** Internal web application  
**Status:** 🟡 In Development (MVP in local testing)  
**Started:** 2026  

**One-line summary:** A smart, Kardex-style warehouse management system for a 7-location gastro-bar chain, featuring supplier price comparison, purchase order workflows, and cost savings analytics.

---

## Business Context Summary

- El Social Medellín S.A.S operates 7 gastro-bar locations across the Valle de Aburrá, Colombia.
- The purchasing department manages a central warehouse with PPE, staff uniforms, and packaging.
- Two core problems: (1) store leaders buy from expensive suppliers due to lack of price visibility, (2) no formal inventory tracking system exists.
- Existing data (products and suppliers) lives in Excel / Google Sheets and must be migrated at launch.

---

## Tech Stack Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Backend framework | FastAPI + Python | Modern, async, excellent for REST APIs, strong typing with Pydantic |
| Frontend framework | React.js + Tailwind CSS | Component-based, widely supported, rapid UI development |
| Database | Supabase (PostgreSQL) | Managed Postgres with built-in auth, RLS, realtime, and storage |
| Deployment | Cloud (Railway / Render) | Simple CI/CD, managed infra, suitable for small teams |
| PDF export | ReportLab | For cost savings report export (server-side) |
| CSV import | pandas + openpyxl | For Excel/Google Sheets data migration |
| Frontend build tool | Vite | Fast dev server and build tool |
| HTTP client | axios | API calls with auth interceptor and timeout |
| Charts | Recharts | Dashboard visualizations |
| File upload | react-dropzone | CSV/Excel drag-and-drop upload |

---

## Environment Setup

- **Frontend**: Vite + React, runs on `http://localhost:5173`
- **Backend**: FastAPI, runs on `http://localhost:8000`
- **Database**: Supabase (PostgreSQL), project `kimuncniwgbbgthjpclg`
- **Frontend `.env`** uses `VITE_` prefix for all env vars (Vite requirement)
- **Backend `.env`** uses plain names (`SUPABASE_URL`, `SUPABASE_KEY`, etc.)

### Local Development — Services to Start

```bash
# Terminal 1 — Backend
cd el-social-bodega/backend
uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
cd el-social-bodega/frontend
npm run dev
```

> The frontend works without the backend running (falls back to Supabase session user data), but protected routes that need role/sede info from `/auth/me` will use raw Supabase data until the backend is up.

---

## Module Status Tracker

| Module | Status | Notes |
|---|---|---|
| Authentication / RBAC | 🟡 In Progress | Supabase Auth + JWT middleware + role deps implemented; session init bug fixed 2026-02-20 |
| Supplier Module | 🟡 In Progress | Full CRUD + UI scaffolded; needs end-to-end testing with live DB |
| Inventory / Kardex | 🟡 In Progress | Product CRUD, movements, price history, alerts — scaffolded; needs DB testing |
| Purchase Orders | 🟡 In Progress | Full workflow (draft→delivered), smart suggestions — scaffolded |
| Cost Savings Report | 🟡 In Progress | PDF export via ReportLab — backend implemented, needs integration test |
| Dashboard / Statistics | 🟡 In Progress | Recharts UI done; backend dashboard routes needed/connected |
| Notifications System | 🟡 In Progress | In-app CRUD scaffolded; triggers not yet verified live |
| CSV / Excel Import | 🟡 In Progress | pandas parsing + drag-and-drop UI scaffolded |
| Database Schema | ✅ Done | Full SQL migration: 11 tables, enums, indexes, RLS policies, triggers, 7 sede seeds |

> Status legend: ⬜ Not started | 🟡 In Progress | ✅ Done | 🔴 Blocked

---

## Database Schema (Implemented)

### Tables (see `el-social-bodega/database/schema.sql` for full SQL)

```
users               — id, email, role (admin|user|reviewer), sede_id, created_at
sedes               — id, name, address, city
suppliers           — id, nit, company_name, category, advisor_name, phone_1, phone_2, email, response_days, credit_days
products            — id, category, code, name, unit, min_stock, created_at, updated_at
product_suppliers   — id, product_id, supplier_id, slot (1|2|3)
price_history       — id, product_id, supplier_id, price, recorded_month, recorded_year, created_at
inventory_stock     — id, product_id, current_quantity, updated_at
inventory_movements — id, product_id, movement_type, quantity, user_id, sede_id, notes, created_at
orders              — id, sede_id, user_id, status, created_at, updated_at
order_items         — id, order_id, product_id, quantity_requested, suggested_supplier_id, suggested_price
notifications       — id, user_id, type, message, read, created_at
```

---

## Architecture Decisions

### ADR-001: Shared Product Catalog
**Date:** 2026  
**Decision:** All 7 locations share a single product catalog, not per-location catalogs.  
**Reason:** Simplifies inventory management, ensures price consistency, reduces data duplication.  
**Consequences:** Orders must always reference a `sede_id` (store location ID) to track which location is requesting.

### ADR-002: Role-Based Access Control (RBAC)
**Date:** 2026  
**Decision:** Three roles — `admin`, `user`, `reviewer` — enforced at both API and UI level.  
**Reason:** Business requirement. Líderes should not be able to freely modify catalog data.  
**Implementation:** Supabase RLS policies + FastAPI dependency injection for role checks.

### ADR-003: Price History Append-Only
**Date:** 2026  
**Decision:** Monthly prices are never overwritten. New price entries are always appended with a timestamp.  
**Reason:** Preserves historical data for trend analysis and the savings report comparisons.

### ADR-004: Up to 3 Suppliers Per Product
**Date:** 2026  
**Decision:** Each product supports up to 3 supplier price slots by default, displayed side-by-side.  
**Reason:** Business requirement to enable price comparison at a glance. Minimum 1 supplier required.

### ADR-005: Order Approval Workflow
**Date:** 2026  
**Decision:** Orders go through states: `draft → sent → in_review → approved → dispatched → delivered`.  
**Reason:** Business requirement. The purchasing team must validate and approve before dispatching.

### ADR-006: In-App Notifications Only (v1)
**Date:** 2026  
**Decision:** Notifications (stock alerts, new orders, price spikes) are in-app only for v1. No email/SMS.  
**Reason:** Keeps v1 scope manageable. External notifications can be added in v2 via Supabase Edge Functions.

### ADR-007: API Versioning
**Date:** 2026  
**Decision:** All API routes are prefixed with `/api/v1/`.  
**Reason:** Allows future breaking changes without disrupting existing clients.

### ADR-008: Auth Initialization Does NOT Block on Backend Profile Fetch
**Date:** 2026-02-20  
**Decision:** `AuthContext` uses Supabase `getSession()` to resolve the `loading` state. The backend call to `/auth/me` is attempted as a best-effort operation, but a `finally` block **always** calls `setLoading(false)`. If the backend is unreachable, the raw `session.user` is used as fallback.  
**Reason:** The backend may not be running in local dev. Blocking the entire UI on a backend call that might time out causes a permanent loading screen (BUG-001).  
**Impact:** Pages that depend on `user.role` must handle `role === undefined` gracefully.

### ADR-009: `INITIAL_SESSION` Event Skipped in `onAuthStateChange`
**Date:** 2026-02-20  
**Decision:** The `onAuthStateChange` listener returns early when `event === 'INITIAL_SESSION'`, because the initial session is already handled by the `initialize()` function.  
**Reason:** Without this guard, both `initialize()` and `onAuthStateChange` call `fetchUserProfile` in parallel on mount, creating a race condition and a duplicate backend request.

### ADR-010: `mounted` Flag in `AuthProvider` useEffect
**Date:** 2026-02-20  
**Decision:** A `let mounted = true` flag is set inside the `useEffect` and checked before every `setState` call. The cleanup sets `mounted = false`.  
**Reason:** React StrictMode (dev) double-invokes effects. Without this guard, the first (unmounted) effect's state updates still fire, causing race conditions and React warnings.

### ADR-011: Axios Timeout of 10 Seconds
**Date:** 2026-02-20  
**Decision:** `axios.create()` in `api.js` includes `timeout: 10000`.  
**Reason:** Without a timeout, if the backend accepts the TCP connection but stalls (cold start on Railway/Render, slow DB query), the frontend hangs indefinitely with no error or user feedback.

### ADR-012: Backend Not Required for Frontend to Start
**Date:** 2026-02-20  
**Decision:** The authentication flow is designed so the frontend renders without the backend running. Supabase handles auth directly; the backend only enriches the session with role/sede data.  
**Reason:** Better local dev experience and resilience. The MVP can be demonstrated with just frontend + Supabase.

---

## Bugs Fixed

### BUG-001 — Blank screen / permanent "Cargando..." on app load
**Date:** 2026-02-20  
**Symptom:** App showed only "Cargando..." text permanently. Console showed only the Supabase config debug log, no errors.  
**Root cause (3 compounding issues):**
1. `getSession()` and `onAuthStateChange`'s `INITIAL_SESSION` both called `fetchUserProfile` in parallel. With a stale session in `localStorage`, both hit the FastAPI backend. With no axios timeout, a hanging request meant `setLoading(false)` was never reached.
2. If `getSession()` needed to refresh an expired token, the refresh network call could be slow, hanging the entire `initialize` chain.
3. No `finally` block around `setLoading(false)` — any unhandled exception left `loading = true` permanently.  

**Fix:** Rewrote `AuthContext` with a `mounted` flag, a `finally` block guaranteeing `setLoading(false)`, and `INITIAL_SESSION` guard in `onAuthStateChange`. Added 10 s axios timeout in `api.js`. See ADR-008 through ADR-012.

### BUG-003 — Login form stays loading when Supabase signIn hangs
**Date:** 2026-02-20  
**Symptom:** User enters credentials and clicks "Iniciar sesión"; the button stays in "Cargando..." and never recovers.  
**Root cause:** `supabase.auth.signInWithPassword()` can hang indefinitely if Supabase is unreachable (paused project, network issue). The promise never resolves, so the login form's `submitting` state is never cleared.  
**Fix:** Wrapped `signInWithPassword` in a 12 s timeout (`Promise.race`) in `AuthContext.signIn`. On timeout, a friendly error is thrown and the form's `finally` clears `submitting`. Also set `session` and `user` in context immediately after successful sign-in so redirects see the user without waiting for `onAuthStateChange`. Role checks in `ProtectedRoute` and `Layout` now include `user_metadata?.role` for raw Supabase user.

---

## Pending / Known Issues

- [ ] Backend `/auth/me` endpoint needs to return `role` and `sede_id` flat from the `profiles` table — verify field names match what the frontend expects.
- [ ] `ProtectedRoute` role check uses `user.role || user.role_name` — standardize to one field once `/auth/me` response shape is confirmed.
- [ ] `signOut` in `api.js` response interceptor uses `window.location.href` redirect — this bypasses React Router state cleanup. Consider storing a `navigate` ref or using a custom event.
- [ ] No React error boundary wrapping `<App />` — a runtime error in any page will crash the whole app silently in production.
- [ ] `Layout.jsx` checks `user?.role` and `user?.role_name` — standardize once `/auth/me` shape is confirmed.
- [ ] Dashboard makes 6 concurrent API calls on mount — if the backend is down, charts are empty with no user-facing explanation. Add a fallback message.
- [ ] `signUp` requires the `handle_new_user` DB trigger to be active in Supabase to auto-create the user profile row.
- [ ] Supabase RLS policies currently open for dev — must be tightened before production deployment.

---

## Changelog

### [v0.1.0] — 2026 — Project Kickoff
- `AGENTS.md` created with full project specification.
- `MEMORY.md` initialized with architecture decisions and tech stack.
- Business requirements gathered and documented.
- Initial database schema planned.

### [v1.0.0] — 2026-02-19 — Full Implementation Scaffold
- **Backend (FastAPI):** All API routes implemented under `/api/v1/` — auth, suppliers, inventory, orders, dashboard, notifications, import.
- **Frontend (React + Vite + Tailwind):** Full SPA with 12 pages — home, login, register, dashboard, suppliers, inventory, product detail, orders list, order detail, new order, notifications, import.
- **Database:** Complete SQL schema with 11 tables, custom enums, indexes, RLS policies, triggers, and 7 sede seed data.
- **Services:** supplier_service, inventory_service, order_service, suggestion_service, notification_service, dashboard_service, import_service, pdf_service.
- **Auth:** Supabase Auth integration with JWT middleware and role-based dependencies.
- **Smart Features:** Lowest-price supplier suggestion engine, cost savings mini-reports with PDF export (ReportLab).
- **UI:** Fully responsive, Spanish-facing labels, modern card-based design — primary green `#1B5E20`, secondary amber `#FF8F00`.

### [v1.0.1] — 2026-02-20 — Auth Bug Fix
- Fixed permanent "Cargando..." blank screen on app load (BUG-001).
- Rewrote `AuthContext` initialization: `mounted` flag, `finally` block, `INITIAL_SESSION` guard.
- Added 10 s axios timeout in `api.js`.
- Created `MEMORY.md` at repo root as single source of truth (merged and deleted duplicate inside `el-social-bodega/`).
- Appended Architecture Lessons section to `AGENTS.md`.

### [v1.0.2] — 2026-02-20 — getSession Timeout Fix
- Fixed second instance of permanent "Cargando..." (BUG-002): `supabase.auth.getSession()` hangs when a stored token is expired and Supabase is unreachable (no network / paused free-tier project). The axios timeout does NOT cover this call.
- Added `getSessionWithTimeout(ms = 8000)` helper inside `AuthContext.jsx` that wraps `getSession()` in a `Promise.race()`. On timeout, the error propagates to the `catch` block and the `finally` always resolves `loading = false`.

### [v1.0.3] — 2026-02-20 — Login Timeout and Immediate User State
- Fixed login form stuck on "Cargando..." (BUG-003): added 12 s timeout around `signInWithPassword` so the button recovers with an error message if Supabase does not respond.
- After successful sign-in, set `session` and `user` in AuthContext immediately so redirect to dashboard works without waiting for `onAuthStateChange`. Role checks now include `user_metadata?.role` in ProtectedRoute and Layout.

---

## Cloud Deployment Checklist (for future)

- [ ] Set all `VITE_*` env vars in the frontend hosting platform (Vercel / Netlify / Railway static)
- [ ] Update `VITE_API_URL` to the deployed backend URL (e.g., `https://el-social-api.up.railway.app/api/v1`)
- [ ] Update `CORS_ORIGINS` in `backend/.env` to include the production frontend URL
- [ ] Review and tighten Supabase RLS policies before going live
- [ ] Confirm `JWT_SECRET` in `backend/.env` matches the JWT secret in Supabase project settings (Settings → API → JWT Secret)
- [ ] Add a React error boundary around `<App />` before production
- [ ] Standardize `user.role` field shape across frontend once `/auth/me` response is confirmed

---

## Notes for Future Developers / LLM Agents

- Always read `AGENTS.md` first for the full system specification.
- UI text is in **Spanish**, code and docs are in **English** — maintain this convention strictly.
- The `user` role (líderes) has intentionally limited write access — do not grant them admin capabilities even if it seems convenient.
- Price history must never be overwritten — always insert new rows.
- The smart supplier suggestion logic is purely based on lowest current price — no ML involved in v1.
- When adding new modules, update the Module Status Tracker table in this file.
- When making architectural decisions, add a new `ADR-XXX` entry in the Architecture Decisions section.
- When fixing bugs, add a `BUG-XXX` entry in the Bugs Fixed section.
- **There is only one `MEMORY.md`**, located at the repo root (`CODE/MEMORY.md`). Do not create project-level copies.
