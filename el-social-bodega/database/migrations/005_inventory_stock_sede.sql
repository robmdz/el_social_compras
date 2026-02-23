-- Inventory stock per sede (store location).
-- Bodega (warehouse) uses inventory_stock; each sede has its own stock via this table.

CREATE TABLE IF NOT EXISTS inventory_stock_sede (
    id SERIAL PRIMARY KEY,
    sede_id INTEGER NOT NULL REFERENCES sedes(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    current_quantity INTEGER NOT NULL DEFAULT 0 CHECK (current_quantity >= 0),
    updated_at TIMESTAMPTZ DEFAULT now(),
    counted_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (sede_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_stock_sede_sede ON inventory_stock_sede(sede_id);
CREATE INDEX IF NOT EXISTS idx_inventory_stock_sede_product ON inventory_stock_sede(product_id);

ALTER TABLE inventory_stock_sede ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_stock_sede_select ON inventory_stock_sede;
CREATE POLICY inventory_stock_sede_select ON inventory_stock_sede
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS inventory_stock_sede_admin ON inventory_stock_sede;
CREATE POLICY inventory_stock_sede_admin ON inventory_stock_sede
    FOR ALL TO authenticated USING (get_user_role() = 'admin');

COMMENT ON TABLE inventory_stock_sede IS 'Stock per product at each store (sede). Central warehouse uses inventory_stock.';
