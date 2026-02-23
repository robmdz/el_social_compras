-- Add first_name and last_name to users; update trigger to read from auth signup metadata.
ALTER TABLE users
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Replace trigger function to populate users from auth.users raw_user_meta_data
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
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
    NEW.email,
    meta_role::user_role,
    meta_sede_id,
    meta_first_name,
    meta_last_name
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
