-- Add order executor type and product suggestion metadata.
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS executor_type TEXT
CHECK (executor_type IN ('leader_direct', 'admin_managed'))
DEFAULT 'admin_managed';

ALTER TABLE products
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

ALTER TABLE products
ADD COLUMN IF NOT EXISTS is_pending BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE products
ALTER COLUMN code DROP NOT NULL;
