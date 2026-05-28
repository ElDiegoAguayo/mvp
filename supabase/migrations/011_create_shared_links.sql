-- Tabla para links compartibles de la bóveda documental
CREATE TABLE IF NOT EXISTS shared_links (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  bucket      TEXT NOT NULL DEFAULT 'boveda',
  storage_path TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shared_links_code_idx ON shared_links(code);
CREATE INDEX IF NOT EXISTS shared_links_expires_at_idx ON shared_links(expires_at);

-- Acceso público de lectura (para la ruta /compartir/[code])
ALTER TABLE shared_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read non-expired shared links"
  ON shared_links FOR SELECT
  TO anon, authenticated
  USING (expires_at > NOW());

CREATE POLICY "Users can manage their own shared links"
  ON shared_links FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
