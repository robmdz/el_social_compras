-- El Social Bodega — Database Schema
-- Run this in the Supabase SQL Editor to set up all tables, enums, indexes, and RLS policies.

-- ============================================================
-- CUSTOM TYPES
-- ============================================================

CREATE TYPE user_role AS ENUM ('admin', 'user', 'reviewer');
CREATE TYPE movement_type AS ENUM ('purchase_entry', 'exit_by_request', 'adjustment', 'loss_damage');
CREATE TYPE order_status AS ENUM ('draft', 'sent', 'in_review', 'approved', 'dispatched', 'delivered', 'rejected');
CREATE TYPE notification_type AS ENUM ('low_stock', 'new_order', 'price_spike');

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE sedes (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT DEFAULT 'Medellín'
);

CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    role user_role NOT NULL DEFAULT 'user',
    sede_id INTEGER REFERENCES sedes(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE suppliers (
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

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    min_stock INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE product_suppliers (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 3),
    UNIQUE (product_id, slot)
);

CREATE TABLE price_history (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    price NUMERIC(12,2) NOT NULL,
    recorded_month INTEGER NOT NULL CHECK (recorded_month BETWEEN 1 AND 12),
    recorded_year INTEGER NOT NULL CHECK (recorded_year >= 2020),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE inventory_stock (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
    current_quantity INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE inventory_movements (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    movement_type movement_type NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    user_id UUID NOT NULL REFERENCES users(id),
    sede_id INTEGER REFERENCES sedes(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    sede_id INTEGER NOT NULL REFERENCES sedes(id),
    user_id UUID NOT NULL REFERENCES users(id),
    status order_status NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity_requested INTEGER NOT NULL CHECK (quantity_requested > 0),
    suggested_supplier_id INTEGER REFERENCES suppliers(id),
    suggested_price NUMERIC(12,2)
);

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_sede ON users(sede_id);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_code ON products(code);
CREATE INDEX idx_price_history_product ON price_history(product_id, supplier_id);
CREATE INDEX idx_price_history_period ON price_history(recorded_year, recorded_month);
CREATE INDEX idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX idx_inventory_movements_created ON inventory_movements(created_at);
CREATE INDEX idx_orders_sede ON orders(sede_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, read);

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

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

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
CREATE POLICY sedes_select ON sedes FOR SELECT TO authenticated USING (true);
CREATE POLICY sedes_admin ON sedes FOR ALL TO authenticated USING (get_user_role() = 'admin');

-- USERS: users can read own row, admins can manage all
CREATE POLICY users_select_own ON users FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY users_admin ON users FOR ALL TO authenticated USING (get_user_role() = 'admin');

-- SUPPLIERS: all authenticated can read, only admin can write
CREATE POLICY suppliers_select ON suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY suppliers_admin_insert ON suppliers FOR INSERT TO authenticated WITH CHECK (get_user_role() = 'admin');
CREATE POLICY suppliers_admin_update ON suppliers FOR UPDATE TO authenticated USING (get_user_role() = 'admin');
CREATE POLICY suppliers_admin_delete ON suppliers FOR DELETE TO authenticated USING (get_user_role() = 'admin');

-- PRODUCTS: all authenticated can read, only admin can write
CREATE POLICY products_select ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY products_admin_insert ON products FOR INSERT TO authenticated WITH CHECK (get_user_role() = 'admin');
CREATE POLICY products_admin_update ON products FOR UPDATE TO authenticated USING (get_user_role() = 'admin');
CREATE POLICY products_admin_delete ON products FOR DELETE TO authenticated USING (get_user_role() = 'admin');

-- PRODUCT_SUPPLIERS: all authenticated can read, only admin can write
CREATE POLICY product_suppliers_select ON product_suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY product_suppliers_admin ON product_suppliers FOR ALL TO authenticated USING (get_user_role() = 'admin');

-- PRICE_HISTORY: all authenticated can read, only admin can insert
CREATE POLICY price_history_select ON price_history FOR SELECT TO authenticated USING (true);
CREATE POLICY price_history_admin_insert ON price_history FOR INSERT TO authenticated WITH CHECK (get_user_role() = 'admin');

-- INVENTORY_STOCK: all authenticated can read, admin and user can update
CREATE POLICY inventory_stock_select ON inventory_stock FOR SELECT TO authenticated USING (true);
CREATE POLICY inventory_stock_write ON inventory_stock FOR ALL TO authenticated
    USING (get_user_role() IN ('admin', 'user'));

-- INVENTORY_MOVEMENTS: all authenticated can read, admin and user can insert
CREATE POLICY inventory_movements_select ON inventory_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY inventory_movements_insert ON inventory_movements FOR INSERT TO authenticated
    WITH CHECK (get_user_role() IN ('admin', 'user'));

-- ORDERS: all authenticated can read, admin and user can write
CREATE POLICY orders_select ON orders FOR SELECT TO authenticated USING (true);
CREATE POLICY orders_insert ON orders FOR INSERT TO authenticated
    WITH CHECK (get_user_role() IN ('admin', 'user'));
CREATE POLICY orders_update ON orders FOR UPDATE TO authenticated
    USING (get_user_role() IN ('admin', 'user'));

-- ORDER_ITEMS: all authenticated can read, admin and user can write
CREATE POLICY order_items_select ON order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY order_items_write ON order_items FOR ALL TO authenticated
    USING (get_user_role() IN ('admin', 'user'));

-- NOTIFICATIONS: users can read and update their own notifications
CREATE POLICY notifications_select ON notifications FOR SELECT TO authenticated
    USING (user_id = auth.uid());
CREATE POLICY notifications_update ON notifications FOR UPDATE TO authenticated
    USING (user_id = auth.uid());
CREATE POLICY notifications_admin_insert ON notifications FOR INSERT TO authenticated
    WITH CHECK (get_user_role() = 'admin');

-- ============================================================
-- TRIGGER: Auto-create user profile on auth signup
-- ============================================================

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-create user profile with default role 'user'
    -- Note: role and sede_id can be updated later by admin
    INSERT INTO public.users (id, email, role, sede_id)
    VALUES (
        NEW.id,
        NEW.email,
        'user',
        NULL
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- SEED DATA: 7 store locations
-- ============================================================

INSERT INTO sedes (name, address, city) VALUES
    ('El Social Laureles', 'Cra 70 #44-30', 'Medellín'),
    ('El Social Poblado', 'Cra 43A #7-50', 'Medellín'),
    ('El Social Envigado', 'Cra 43 #38S-25', 'Envigado'),
    ('El Social Sabaneta', 'Cra 43A #75S-100', 'Sabaneta'),
    ('El Social Belén', 'Cll 30A #76-30', 'Medellín'),
    ('El Social Estadio', 'Cra 70 #48-22', 'Medellín'),
    ('El Social Centro', 'Cra 49 #52-10', 'Medellín');
