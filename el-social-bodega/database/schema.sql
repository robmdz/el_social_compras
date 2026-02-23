-- El Social Bodega — Database Schema
-- Run this in the Supabase SQL Editor to set up all tables, enums, indexes, and RLS policies.

-- ============================================================
-- CUSTOM TYPES (idempotent: skip if type already exists)
-- ============================================================

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'user', 'reviewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE movement_type AS ENUM ('purchase_entry', 'exit_by_request', 'adjustment', 'loss_damage');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('draft', 'sent', 'in_review', 'approved', 'dispatched', 'delivered', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM ('low_stock', 'new_order', 'price_spike');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- TABLES (IF NOT EXISTS so script can be re-run safely)
-- ============================================================

CREATE TABLE IF NOT EXISTS sedes (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT DEFAULT 'Medellín'
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    role user_role NOT NULL DEFAULT 'user',
    sede_id INTEGER REFERENCES sedes(id),
    first_name TEXT,
    last_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    nit TEXT NOT NULL UNIQUE,
    company_name TEXT NOT NULL,
    category TEXT NOT NULL,
    advisor_name TEXT,
    contact_phone_1 TEXT NOT NULL,
    contact_phone_2 TEXT,
    email TEXT,
    response_days INTEGER,
    credit_days INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    min_stock INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_suppliers (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 3),
    UNIQUE (product_id, slot)
);

CREATE TABLE IF NOT EXISTS price_history (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    price NUMERIC(12,2) NOT NULL,
    recorded_month INTEGER NOT NULL CHECK (recorded_month BETWEEN 1 AND 12),
    recorded_year INTEGER NOT NULL CHECK (recorded_year >= 2020),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_stock (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
    current_quantity INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now(),
    counted_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_movements (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    movement_type movement_type NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    user_id UUID NOT NULL REFERENCES users(id),
    sede_id INTEGER REFERENCES sedes(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    sede_id INTEGER NOT NULL REFERENCES sedes(id),
    user_id UUID NOT NULL REFERENCES users(id),
    status order_status NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity_requested INTEGER NOT NULL CHECK (quantity_requested > 0),
    suggested_supplier_id INTEGER REFERENCES suppliers(id),
    suggested_price NUMERIC(12,2)
);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDEXES (IF NOT EXISTS so script can be re-run safely)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_sede ON users(sede_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history(product_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_price_history_period ON price_history(recorded_year, recorded_month);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created ON inventory_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_sede ON orders(sede_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);

-- ============================================================
-- TRIGGER: auto-update updated_at on products
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sedes ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
    SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- SEDES: all authenticated users can read
DROP POLICY IF EXISTS sedes_select ON sedes;
CREATE POLICY sedes_select ON sedes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS sedes_admin ON sedes;
CREATE POLICY sedes_admin ON sedes FOR ALL TO authenticated USING (get_user_role() = 'admin');

-- USERS: users can read own row; new user can insert own row (for signup trigger); admins can manage all
DROP POLICY IF EXISTS users_select_own ON users;
CREATE POLICY users_select_own ON users FOR SELECT TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS users_insert_own ON users;
CREATE POLICY users_insert_own ON users FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS users_admin ON users;
CREATE POLICY users_admin ON users FOR ALL TO authenticated USING (get_user_role() = 'admin');

-- SUPPLIERS: all authenticated can read, only admin can write
DROP POLICY IF EXISTS suppliers_select ON suppliers;
CREATE POLICY suppliers_select ON suppliers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS suppliers_admin_insert ON suppliers;
CREATE POLICY suppliers_admin_insert ON suppliers FOR INSERT TO authenticated WITH CHECK (get_user_role() = 'admin');
DROP POLICY IF EXISTS suppliers_admin_update ON suppliers;
CREATE POLICY suppliers_admin_update ON suppliers FOR UPDATE TO authenticated USING (get_user_role() = 'admin');
DROP POLICY IF EXISTS suppliers_admin_delete ON suppliers;
CREATE POLICY suppliers_admin_delete ON suppliers FOR DELETE TO authenticated USING (get_user_role() = 'admin');

-- PRODUCTS: all authenticated can read, only admin can write
DROP POLICY IF EXISTS products_select ON products;
CREATE POLICY products_select ON products FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS products_admin_insert ON products;
CREATE POLICY products_admin_insert ON products FOR INSERT TO authenticated WITH CHECK (get_user_role() = 'admin');
DROP POLICY IF EXISTS products_admin_update ON products;
CREATE POLICY products_admin_update ON products FOR UPDATE TO authenticated USING (get_user_role() = 'admin');
DROP POLICY IF EXISTS products_admin_delete ON products;
CREATE POLICY products_admin_delete ON products FOR DELETE TO authenticated USING (get_user_role() = 'admin');

-- PRODUCT_SUPPLIERS: all authenticated can read, only admin can write
DROP POLICY IF EXISTS product_suppliers_select ON product_suppliers;
CREATE POLICY product_suppliers_select ON product_suppliers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS product_suppliers_admin ON product_suppliers;
CREATE POLICY product_suppliers_admin ON product_suppliers FOR ALL TO authenticated USING (get_user_role() = 'admin');

-- PRICE_HISTORY: all authenticated can read, only admin can insert
DROP POLICY IF EXISTS price_history_select ON price_history;
CREATE POLICY price_history_select ON price_history FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS price_history_admin_insert ON price_history;
CREATE POLICY price_history_admin_insert ON price_history FOR INSERT TO authenticated WITH CHECK (get_user_role() = 'admin');

-- INVENTORY_STOCK: all authenticated can read, admin and user can update
DROP POLICY IF EXISTS inventory_stock_select ON inventory_stock;
CREATE POLICY inventory_stock_select ON inventory_stock FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS inventory_stock_write ON inventory_stock;
CREATE POLICY inventory_stock_write ON inventory_stock FOR ALL TO authenticated
    USING (get_user_role() IN ('admin', 'user'));

-- INVENTORY_MOVEMENTS: all authenticated can read, admin and user can insert
DROP POLICY IF EXISTS inventory_movements_select ON inventory_movements;
CREATE POLICY inventory_movements_select ON inventory_movements FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS inventory_movements_insert ON inventory_movements;
CREATE POLICY inventory_movements_insert ON inventory_movements FOR INSERT TO authenticated
    WITH CHECK (get_user_role() IN ('admin', 'user'));

-- ORDERS: all authenticated can read, admin and user can write
DROP POLICY IF EXISTS orders_select ON orders;
CREATE POLICY orders_select ON orders FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS orders_insert ON orders;
CREATE POLICY orders_insert ON orders FOR INSERT TO authenticated
    WITH CHECK (get_user_role() IN ('admin', 'user'));
DROP POLICY IF EXISTS orders_update ON orders;
CREATE POLICY orders_update ON orders FOR UPDATE TO authenticated
    USING (get_user_role() IN ('admin', 'user'));

-- ORDER_ITEMS: all authenticated can read, admin and user can write
DROP POLICY IF EXISTS order_items_select ON order_items;
CREATE POLICY order_items_select ON order_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS order_items_write ON order_items;
CREATE POLICY order_items_write ON order_items FOR ALL TO authenticated
    USING (get_user_role() IN ('admin', 'user'));

-- NOTIFICATIONS: users can read and update their own notifications
DROP POLICY IF EXISTS notifications_select ON notifications;
CREATE POLICY notifications_select ON notifications FOR SELECT TO authenticated
    USING (user_id = auth.uid());
DROP POLICY IF EXISTS notifications_update ON notifications;
CREATE POLICY notifications_update ON notifications FOR UPDATE TO authenticated
    USING (user_id = auth.uid());
DROP POLICY IF EXISTS notifications_admin_insert ON notifications;
CREATE POLICY notifications_admin_insert ON notifications FOR INSERT TO authenticated
    WITH CHECK (get_user_role() = 'admin');

-- ============================================================
-- TRIGGER: Auto-create user profile on auth signup
-- ============================================================

-- Function to handle new user creation (reads role, sede_id, first_name, last_name from raw_user_meta_data).
-- SECURITY DEFINER + SET search_path so the trigger runs with definer privileges and bypasses RLS when possible.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta JSONB;
  meta_role TEXT;
  meta_sede_id INTEGER;
  meta_first_name TEXT;
  meta_last_name TEXT;
BEGIN
  meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  meta_role := meta->>'role';
  IF meta_role IS NULL OR meta_role NOT IN ('admin', 'user', 'reviewer') THEN
    meta_role := 'user';
  END IF;
  meta_sede_id := NULL;
  IF meta->>'sede_id' IS NOT NULL AND meta->>'sede_id' <> '' THEN
    meta_sede_id := (meta->>'sede_id')::INTEGER;
  END IF;
  meta_first_name := NULLIF(TRIM(meta->>'first_name'), '');
  meta_last_name := NULLIF(TRIM(meta->>'last_name'), '');

  INSERT INTO public.users (id, email, role, sede_id, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    meta_role::user_role,
    meta_sede_id,
    meta_first_name,
    meta_last_name
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- SEED DATA: 7 store locations (idempotent: only inserts if name missing)
-- ============================================================

INSERT INTO sedes (name, address, city)
SELECT v.name, v.address, v.city
FROM (VALUES
    ('El Social Provenza', 'Cra 35# 8A 8', 'Medellín'),
    ('El Social Lalinde', 'Cra 36# 10A 71', 'Medellín'),
    ('El Social Excelsior', 'Cll 11 # 43B 16', 'Medellín'),
    ('El Social Maestro', 'Museo de Antioquia', 'Medellín'),
    ('El Social San Diego', 'C.C San Diego', 'Medellín'),
    ('El Social Viva', 'C.C Viva Envigado', 'Envigado'),
    ('El Social Pueblito Paisa', 'Pueblito Paisa', 'Medellín')
) AS v(name, address, city)
WHERE NOT EXISTS (SELECT 1 FROM sedes s WHERE s.name = v.name);
