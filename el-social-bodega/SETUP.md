# SETUP.md — El Social Bodega

Setup guide for running the Warehouse Management System locally and deploying to the cloud.

---

## Prerequisites

| Tool       | Minimum Version | Download                                    |
|------------|-----------------|---------------------------------------------|
| Node.js    | 18+             | https://nodejs.org                          |
| npm        | 9+              | Bundled with Node.js                        |
| Python     | 3.10+           | https://www.python.org/downloads            |
| Git        | 2.x             | https://git-scm.com                         |

You also need a **Supabase** project. Create one for free at [supabase.com](https://supabase.com).

---

## Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Open the **SQL Editor** in the Supabase dashboard and run the contents of `database/schema.sql` to create all tables, enums, indexes, RLS policies, and seed data.
3. Collect the following values from **Project Settings → API**:
   - `Project URL` (e.g. `https://abc123.supabase.co`)
   - `anon (public) key`
   - `service_role key`
   - `JWT Secret`

---

## Local Development

### 1. Backend (FastAPI)

```bash
cd el-social-bodega/backend
```

Create and activate a virtual environment:

```bash
# Linux / macOS
python3 -m venv venv
source venv/bin/activate

# Windows (PowerShell)
python -m venv venv
.\venv\Scripts\Activate.ps1
```

> If PowerShell blocks the activation script, run:
> `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

Install dependencies:

```bash
pip install -r requirements.txt
```

Create your `.env` file from the example and fill in your Supabase credentials:

```bash
# Linux / macOS
cp .env.example .env

# Windows
copy .env.example .env
```

`.env` contents:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret
CORS_ORIGINS=http://localhost:5173
```

Start the API server:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Verify it's running: open `http://localhost:8000/health` — you should see `{"status": "ok"}`.

Interactive API docs are available at `http://localhost:8000/docs`.

---

### 2. Frontend (React + Vite)

In a **separate terminal**:

```bash
cd el-social-bodega/frontend
```

Install dependencies:

```bash
npm install
```

Create your `.env` file:

```bash
# Linux / macOS
cp .env.example .env

# Windows
copy .env.example .env
```

`.env` contents:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:8000/api/v1
```

**Slow or unreliable network (optional):** In development, auth init uses a 3 s timeout so the app does not block for long. You can tune it or the API timeout in `.env`:

- `VITE_AUTH_INIT_TIMEOUT=3000` — ms to wait for Supabase session (default: 3000 in dev, 8000 in production)
- `VITE_API_TIMEOUT=5000` — ms before API requests time out (default: 10000)

Start the dev server:

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

---

### Local Quick Reference

| Component | Command                                               | URL                          |
|-----------|-------------------------------------------------------|------------------------------|
| Backend   | `uvicorn main:app --reload --host 0.0.0.0 --port 8000` | http://localhost:8000        |
| API Docs  | —                                                     | http://localhost:8000/docs   |
| Frontend  | `npm run dev`                                         | http://localhost:5173        |

---

## Cloud Deployment

The project is designed to be deployed on **Railway** or **Render** (or any similar PaaS). Supabase remains the managed database regardless of where you host the app.

### Option A: Railway

#### Backend

1. Go to [railway.app](https://railway.app) and create a new project.
2. Add a new service and connect your Git repository (point to the `backend/` directory as root).
3. Set the **Start Command** to:
   ```
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
4. Add the following **environment variables** in Railway's dashboard:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   JWT_SECRET=your-jwt-secret
   CORS_ORIGINS=https://your-frontend-domain.up.railway.app
   ```
5. Railway will auto-detect Python and install from `requirements.txt`.
6. Deploy. Note the generated public URL for the backend.

#### Frontend

1. In the same Railway project, add a second service pointing to the `frontend/` directory.
2. Set the **Build Command** to:
   ```
   npm install && npm run build
   ```
3. Set the **Start Command** to serve the static build (e.g. using `npx serve dist`), or use Railway's static site feature if available.
4. Add environment variables:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_API_URL=https://your-backend-domain.up.railway.app/api/v1
   ```
   > `VITE_` variables are baked into the build at build time, so they must be set **before** building.
5. Deploy. Update the backend's `CORS_ORIGINS` to include the frontend's production URL.

---

### Option B: Render

#### Backend

1. Go to [render.com](https://render.com) and create a new **Web Service**.
2. Connect your repository and set the **Root Directory** to `backend`.
3. Set **Runtime** to Python.
4. Set the **Build Command** to:
   ```
   pip install -r requirements.txt
   ```
5. Set the **Start Command** to:
   ```
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
6. Add the same environment variables as listed in the Railway backend section.
7. Deploy.

#### Frontend

1. Create a new **Static Site** on Render.
2. Connect your repository and set the **Root Directory** to `frontend`.
3. Set the **Build Command** to:
   ```
   npm install && npm run build
   ```
4. Set the **Publish Directory** to `dist`.
5. Add the `VITE_` environment variables (same as Railway frontend section).
6. Deploy. Update the backend's `CORS_ORIGINS` to include the Render frontend URL.

---

### Post-Deployment Checklist

- [ ] Database schema is applied in Supabase (run `database/schema.sql`).
- [ ] Backend health check passes (`/health` returns `{"status": "ok"}`).
- [ ] `CORS_ORIGINS` on the backend matches the frontend's production URL.
- [ ] `VITE_API_URL` on the frontend points to the backend's production URL.
- [ ] Supabase RLS policies are enabled and tested for all three roles (`admin`, `user`, `reviewer`).
- [ ] At least one admin user exists in the system.
- [ ] Initial data migration (suppliers/products via CSV import) is completed if needed.

---

## Troubleshooting

| Problem | Solution |
| `pyroaring` / `pyiceberg` build fails (Microsoft Visual C++ required) | `supabase` is pinned to `<2.24.0` to avoid `storage3`'s `pyiceberg` dependency, which requires C++ compilation on Windows. If you need newer Supabase features, install [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) instead. |
|---------|----------|
| PowerShell blocks venv activation | Run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` |
| CORS errors in browser | Ensure `CORS_ORIGINS` in backend `.env` includes the exact frontend URL (no trailing slash) |
| Frontend shows blank page | Check browser console — verify `VITE_API_URL` and `VITE_SUPABASE_URL` are set correctly |
| `uvicorn: command not found` | Make sure the virtual environment is activated |
| Supabase RLS blocks queries | Verify RLS policies are applied from `schema.sql` and the correct key is being used |
| `VITE_` env vars not working after change | Restart the Vite dev server — env vars are loaded at startup |
