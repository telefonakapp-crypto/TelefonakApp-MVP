-- ============================================================
-- Admin Web authentication (email + password)
-- Completely independent from mobile users / OTP auth.
-- ============================================================

CREATE TABLE IF NOT EXISTS admins (
    id              SERIAL PRIMARY KEY,
    full_name       VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    password_hash   TEXT         NOT NULL,
    role            VARCHAR(32)  NOT NULL DEFAULT 'viewer'
                    CHECK (role IN (
                      'super_admin',
                      'moderator',
                      'marketing',
                      'support',
                      'viewer'
                    )),
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    last_login      TIMESTAMP,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by      INTEGER      REFERENCES admins(id) ON DELETE SET NULL,
    updated_by      INTEGER      REFERENCES admins(id) ON DELETE SET NULL,
    CONSTRAINT admins_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_admins_email
  ON admins (email);

CREATE INDEX IF NOT EXISTS idx_admins_role_active
  ON admins (role, is_active);

CREATE OR REPLACE FUNCTION update_admins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_admins_timestamp ON admins;
CREATE TRIGGER update_admins_timestamp
    BEFORE UPDATE ON admins
    FOR EACH ROW
    EXECUTE FUNCTION update_admins_updated_at();
