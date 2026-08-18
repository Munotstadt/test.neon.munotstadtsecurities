-- Einmalig auf der Neon-DB ausführen (z.B. über Neon SQL Editor)

CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  totp_secret TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Beispiel-Tabelle, falls security_master noch nicht existiert
-- (überspringen, wenn sie schon da ist)
CREATE TABLE IF NOT EXISTS security_master (
  id SERIAL PRIMARY KEY,
  isin TEXT UNIQUE,
  name TEXT NOT NULL,
  asset_class TEXT,
  currency TEXT,
  exchange TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
