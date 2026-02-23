-- Allow notifications for "new product requested by leader" with product_id for approve action.
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_product_request';

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES products(id) ON DELETE SET NULL;

COMMENT ON COLUMN notifications.product_id IS 'Set for type new_product_request: product to approve.';
