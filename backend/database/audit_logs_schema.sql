-- Admin Web audit trail for sensitive actions.
CREATE TABLE IF NOT EXISTS audit_logs (
  id           BIGSERIAL PRIMARY KEY,
  admin_id     INTEGER      REFERENCES admins(id) ON DELETE SET NULL,
  action       VARCHAR(64)  NOT NULL,
  entity_type  VARCHAR(64),
  entity_id    VARCHAR(64),
  metadata     JSONB        NOT NULL DEFAULT '{}'::jsonb,
  ip_address   VARCHAR(64),
  user_agent   TEXT,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs (admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
