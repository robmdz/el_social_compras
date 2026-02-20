# AGENTS.md — El Social Medellín S.A.S | Warehouse Management System

## Business Context

**El Social Medellín S.A.S** is a gastro-bar chain with **7 locations** across the Valle de Aburrá region in Colombia. The purchasing department (`área de compras`) manages a central warehouse containing PPE (EPP), staff uniforms (dotación), and packaging materials (empaques).

### Core Problems Being Solved

1. **Unoptimized supplier selection:** Point-of-sale leaders (líderes de punto de venta) purchase from suppliers without price comparison, generating avoidable overspending.
2. **No formal inventory management:** There is no system for tracking stock entries, exits, or counts in the central warehouse.

---

## Project Goal

Build a **web-based warehouse management platform** — a smart Kardex system with a friendly UI — that enables:
- Tracking inventory entries and exits with full traceability
- Managing and comparing suppliers and their pricing
- Generating smart purchase order suggestions to minimize costs
- Providing dashboards with statistical and graphical data

---

## Tech Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Backend    | FastAPI + Python                  |
| Frontend   | React.js + Tailwind CSS           |
| Database   | Supabase (PostgreSQL)             |
| Deployment | Cloud (Railway / Render or similar) |

- The system must be **fully responsive** (mobile + desktop).
- All **code and technical documentation must be written in English**.
- All **UI-facing text and labels must be in Spanish**.

---

## System Modules

### 1. Authentication & Role-Based Access Control (RBAC)

Three user roles with different permission levels. User base is small (< 10 users).

| Role           | Spanish Label         | Permissions |
|----------------|-----------------------|-------------|
| `admin`        | Administrador         | Full access: create, read, update, delete all data across all modules |
| `user`         | Usuario (Líder)       | Limited: can change quantities, register movements, and submit requests for admin review |
| `reviewer`     | Revisor               | Read-only: can view dashboards, charts, and statistical reports only |

> Each user must be associated with one of the 7 store locations (sedes).

---

### 2. Supplier Module (Módulo de Proveedores)

An enriched supplier directory — more than a contact list, it stores commercial and operational data.

**Fields per supplier:**

| Field                  | Description                              |
|------------------------|------------------------------------------|
| `nit`                  | Tax ID number (NIT)                      |
| `company_name`         | Supplier company name                    |
| `category`             | Product/service category                 |
| `advisor_name`         | Name of the commercial advisor           |
| `contact_phone_1`      | Primary phone number                     |
| `contact_phone_2`      | Secondary phone number                   |
| `email`                | Contact email                            |
| `response_days`        | Average days to respond to a quote       |
| `credit_days`          | Payment credit term in days              |

---

### 3. Inventory Module — Smart Kardex (Módulo de Inventario)

A **shared catalog** used across all 7 locations (not per-location). Products are managed centrally from the warehouse.

**Fields per product:**

| Field            | Description                                              |
|------------------|----------------------------------------------------------|
| `category`       | Product category                                         |
| `code`           | Internal product code                                    |
| `name`           | Product name                                             |
| `unit`           | Unit of measure (UM) — e.g., unidad, caja, kg, litro    |
| `supplier_1`     | Primary linked supplier                                  |
| `supplier_2`     | Secondary supplier slot (default empty)                  |
| `supplier_3`     | Tertiary supplier slot (default empty)                   |
| `monthly_prices` | Price per supplier per month (historical tracking)       |
| `price_variation`| Month-over-month percentage change per supplier          |

**Price comparison table** must show all 3 supplier prices side by side per product, with visual indicators for the best price.

**Inventory Movement Types (Kardex entries):**

| Type                    | Spanish Label                    |
|-------------------------|----------------------------------|
| Purchase entry          | Entrada por compra a proveedor   |
| Exit by store request   | Salida por pedido de sede        |
| Inventory adjustment    | Ajuste de inventario (corrección)|
| Loss / damage           | Merma o daño de producto         |

Each movement must record: timestamp, responsible user, quantity, movement type, and optional notes.

**Stock Alerts:**
- Configurable minimum stock per product.
- Automatic alert triggered when stock drops below the defined minimum.
- Alert visible in UI and sent as a notification.

---

### 4. Purchase Orders Module (Módulo de Pedidos)

Workflow for store leaders to request supplies from the central warehouse/purchasing team.

#### Order Flow (States)

```
BORRADOR → ENVIADO → EN REVISIÓN → APROBADO → DESPACHADO → ENTREGADO
(Draft)   (Sent)   (In Review)  (Approved) (Dispatched) (Delivered)
```

- **Líder (user role):** Creates and submits orders.
- **Compras (admin role):** Reviews, approves or rejects, and marks as dispatched.

#### Smart Supplier Suggestion Engine

When a leader builds an order:
1. The system reads the current prices from the inventory module for each requested product.
2. It automatically **highlights the supplier with the lowest price** per product.
3. It generates a **cost savings mini-report** showing:
   - Highest available price per product
   - Suggested (lowest) price per product and its supplier
   - Item-level savings (difference)
   - Total estimated savings for the full order
4. The mini-report can be **exported to PDF**.

---

### 5. Dashboard & Statistics Module (Módulo de Reportes)

Accessible to all roles (with detail level depending on role).

**Visualizations to include:**

- Inventory movement history (entries vs exits over time)
- Current stock levels per product / category
- Monthly price variation per supplier and product
- Supplier price comparison charts
- Savings report history
- Warehouse data visualizations (graphical overview of stock status)

---

### 6. Notifications & Alerts System

| Trigger                                      | Recipients              |
|----------------------------------------------|-------------------------|
| Stock drops below minimum threshold          | Admin / Compras team    |
| A store leader submits a new purchase order  | Admin / Compras team    |
| A supplier's price increases significantly   | Admin / Compras team    |

Notifications should be visible within the app (in-app notification center). External notifications (email/SMS) are out of scope for v1 unless specified later.

---

## Data Migration

The company has **existing data in Excel / Google Sheets** (products and/or suppliers). The system must support an **import mechanism** (CSV or Excel upload) for the initial data load into the supplier and inventory modules.

---

## Coding & Documentation Conventions

- **Language:** All code, comments, docstrings, variable names, function names, API routes, and documentation files must be in **English**.
- **UI Language:** All user-facing labels, buttons, messages, and text must be in **Spanish**.
- **Backend:** Follow FastAPI best practices — use Pydantic models for validation, dependency injection, async routes, and proper HTTP status codes.
- **Frontend:** Use functional React components with hooks. Keep components modular and reusable. Use Tailwind utility classes consistently.
- **Database:** Use Supabase (PostgreSQL). Define clear table schemas with proper foreign keys, indexes, and RLS (Row Level Security) policies aligned with the RBAC roles.
- **Clean Code:** Separation of concerns, single responsibility principle, no business logic in route handlers.
- **API:** RESTful design. Version the API under `/api/v1/`.

---

## Project File Structure (Suggested)

```
el-social-bodega/
├── backend/
│   ├── app/
│   │   ├── api/v1/routes/       # Route handlers per module
│   │   ├── core/                # Config, security, dependencies
│   │   ├── models/              # Pydantic schemas
│   │   ├── services/            # Business logic
│   │   └── db/                  # Supabase client and queries
│   ├── main.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   ├── pages/               # Page-level components per module
│   │   ├── hooks/               # Custom React hooks
│   │   ├── services/            # API call functions
│   │   ├── context/             # Auth context and global state
│   │   └── utils/               # Helper functions
│   └── package.json
├── AGENTS.md                    # This file — AI agent context (at repo root CODE/)
└── MEMORY.md                    # Single source of truth — changelog and decisions log (at repo root CODE/)
```

---

## Key Business Rules

1. A product always has up to 3 supplier slots; at least 1 must be filled.
2. Price history is stored monthly — do not overwrite past prices, only append.
3. Only `admin` users can approve, reject, or dispatch orders.
4. Only `admin` users can add or edit supplier information and product catalog.
5. `user` role changes are flagged for admin review before being committed.
6. The smart suggestion always picks the **lowest current price** among filled supplier slots.
7. Minimum stock thresholds are set per product by an admin.
8. All 7 store locations share the same product catalog but each order is tied to a specific sede.
9. Data migration from Excel/Google Sheets must be supported at launch via CSV import.
10. PDF export of cost savings reports must be available for any completed order.

---

## Architecture Lessons & Agent Notes

> This section is maintained by the AI agent. Updated: 2026-02-20.

### Frontend Auth Initialization Pattern

The `AuthContext` initialization **must not block on the FastAPI backend**. The correct pattern is:

1. Wrap `supabase.auth.getSession()` in a `Promise.race()` with an 8 s timeout (`getSessionWithTimeout`). Without this, a stored expired token forces a network refresh call — if Supabase is unreachable (paused free-tier project, network issue), that call hangs indefinitely and `loading` never resolves.
2. Attempt to fetch the enriched profile from `/api/v1/auth/me` (role, sede_id) as a best-effort operation inside the same `try` block.
3. Use a `finally` block that **always** calls `setLoading(false)`, no matter what fails.
4. Use a `mounted` flag (set to `false` in the effect cleanup) to prevent state updates after component unmount — required for React StrictMode compatibility.
5. In `onAuthStateChange`, skip the `INITIAL_SESSION` event explicitly (`if (event === 'INITIAL_SESSION') return`) to avoid a duplicate backend call that races with the `initialize()` function.

**Why `getSession` can hang**: In Supabase JS v2, `getSession()` is **not always synchronous**. If a session exists in localStorage but the access token is expired, the client silently attempts to refresh it via a network request. The axios `timeout` does not cover this call — it must be protected by a separate `Promise.race` timeout.

**Why**: If the backend is down (common in local dev), an unguarded `await api.get('/auth/me')` with no timeout can hang indefinitely, leaving `loading = true` forever and showing a permanent "Cargando..." blank screen.

### Axios Configuration

All `axios` instances **must define a `timeout`** (currently 10 000 ms). Without a timeout, any request to a server that accepts the TCP connection but stalls (e.g., Render/Railway cold start, or a slow DB query) will cause the frontend to hang with no error and no user feedback.

### Role Field Consistency

The user object after login can come from two sources:
- **Supabase fallback** (`session.user`): has `user_metadata.role`, not `role` directly.
- **Backend `/auth/me` response**: should return `{ role, sede_id, email, ... }` flat.

All role checks across the frontend (`Layout.jsx`, `ProtectedRoute`, etc.) must handle both cases:
```js
const role = user?.role || user?.role_name || user?.user_metadata?.role
```

### Error Boundary

Currently there is no React error boundary wrapping `<App />`. Any unhandled runtime error in a page component will crash the whole app silently in production. Add one before the first production deployment.

### Local vs Cloud Development

The project is structured to run identically in both environments:
- In local dev: `VITE_API_URL=http://localhost:8000/api/v1`
- In cloud: `VITE_API_URL=https://<backend-service>.up.railway.app/api/v1`
- The only change needed for cloud is updating the `.env` values in the hosting platform — no code changes required.
- `CORS_ORIGINS` in `backend/.env` must include the frontend's production URL.

