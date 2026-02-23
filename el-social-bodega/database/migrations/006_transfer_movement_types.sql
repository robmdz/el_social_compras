-- Add movement types for transfers between bodega and sedes.
-- Run in Supabase SQL Editor once. On PG 15+ use IF NOT EXISTS to make idempotent.

ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'transfer_bodega_to_sede';
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'transfer_sede_to_bodega';
