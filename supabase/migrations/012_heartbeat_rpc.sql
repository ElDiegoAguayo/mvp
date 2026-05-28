-- RPC to update last_activity_at, bypasses RLS via SECURITY DEFINER
CREATE OR REPLACE FUNCTION update_last_activity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET last_activity_at = NOW()
  WHERE id = auth.uid();
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION update_last_activity() TO authenticated;
