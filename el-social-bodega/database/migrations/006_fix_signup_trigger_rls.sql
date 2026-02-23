-- Fix "Database error saving new user" when signing up.
-- 1) Allow INSERT into public.users when id = auth.uid() (so the signup trigger can create the row).
-- 2) Update handle_new_user() with SECURITY DEFINER + SET search_path = public so it runs with definer privileges.

-- Policy so the signup flow can insert the new user row (trigger runs in auth context where auth.uid() may be the new user)
DROP POLICY IF EXISTS users_insert_own ON users;
CREATE POLICY users_insert_own ON users FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- Replace trigger function so it runs with definer privileges and explicit search_path
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
