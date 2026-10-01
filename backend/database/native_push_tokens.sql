-- Provider-neutral device tokens alongside existing Expo tokens.
-- Existing Expo rows stay valid: provider remains NULL until a later backfill,
-- and application code treats NULL provider + expo_push_token as provider 'expo'.

ALTER TABLE user_push_tokens
  ADD COLUMN IF NOT EXISTS device_token TEXT;

ALTER TABLE user_push_tokens
  ADD COLUMN IF NOT EXISTS provider VARCHAR(20);

ALTER TABLE user_push_tokens
  ALTER COLUMN expo_push_token DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_push_tokens_provider_check'
  ) THEN
    ALTER TABLE user_push_tokens
      ADD CONSTRAINT user_push_tokens_provider_check
      CHECK (provider IS NULL OR provider IN ('expo', 'fcm', 'apns'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_push_tokens_shape_check'
  ) THEN
    ALTER TABLE user_push_tokens
      ADD CONSTRAINT user_push_tokens_shape_check
      CHECK (
        (
          (provider IS NULL OR provider = 'expo')
          AND expo_push_token IS NOT NULL
        )
        OR (
          provider = 'fcm'
          AND device_token IS NOT NULL
          AND platform = 'android'
        )
        OR (
          provider = 'apns'
          AND device_token IS NOT NULL
          AND platform = 'ios'
        )
      );
  END IF;
END $$;

-- One native token belongs to one user. NULL device_token (Expo rows) is excluded.
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_push_tokens_device_token
  ON user_push_tokens (device_token)
  WHERE device_token IS NOT NULL;

-- idx_user_push_tokens_user_active already serves user_id WHERE is_active.
