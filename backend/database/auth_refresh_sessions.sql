-- Customer refresh sessions (Phase 3 — SEC-006 / SEC-012).
-- Only SHA-256 hashes of opaque refresh tokens are stored.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS auth_refresh_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  family_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  replaced_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMPTZ,
  user_agent TEXT,
  ip TEXT,
  CONSTRAINT auth_refresh_sessions_token_hash_unique UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_sessions_user
  ON auth_refresh_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_sessions_family
  ON auth_refresh_sessions (family_id);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_sessions_expires
  ON auth_refresh_sessions (expires_at);
