-- Add counted_at to inventory stock tables.
-- counted_at = date/time since which the current quantity has been accounted for (contabilizado).

-- Central warehouse stock (inventory_stock)
ALTER TABLE inventory_stock
ADD COLUMN IF NOT EXISTS counted_at TIMESTAMPTZ DEFAULT now();

UPDATE inventory_stock
SET counted_at = COALESCE(updated_at, now())
WHERE counted_at IS NULL;

COMMENT ON COLUMN inventory_stock.counted_at IS 'Date since which the current_quantity has been accounted for.';

-- Stock per sede (inventory_stock_sede) — only if that table exists (migration 005)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'inventory_stock_sede'
    ) THEN
        ALTER TABLE inventory_stock_sede
        ADD COLUMN IF NOT EXISTS counted_at TIMESTAMPTZ DEFAULT now();

        UPDATE inventory_stock_sede
        SET counted_at = COALESCE(updated_at, now())
        WHERE counted_at IS NULL;

        COMMENT ON COLUMN inventory_stock_sede.counted_at IS 'Date since which the current_quantity at this sede has been accounted for.';
    END IF;
END
$$;

-- Update atomic functions to set updated_at and counted_at when quantity changes
CREATE OR REPLACE FUNCTION decrement_stock(p_id INT, amount INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_qty INT;
BEGIN
    UPDATE inventory_stock
    SET current_quantity = current_quantity - amount,
        updated_at = now(),
        counted_at = now()
    WHERE product_id = p_id
      AND current_quantity >= amount
    RETURNING current_quantity INTO new_qty;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'insufficient_stock: product_id=%, requested=%', p_id, amount;
    END IF;

    RETURN new_qty;
END;
$$;

CREATE OR REPLACE FUNCTION increment_stock(p_id INT, amount INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_qty INT;
BEGIN
    INSERT INTO inventory_stock (product_id, current_quantity, counted_at)
    VALUES (p_id, amount, now())
    ON CONFLICT (product_id)
    DO UPDATE SET
        current_quantity = inventory_stock.current_quantity + EXCLUDED.current_quantity,
        updated_at = now(),
        counted_at = now()
    RETURNING current_quantity INTO new_qty;

    RETURN new_qty;
END;
$$;
