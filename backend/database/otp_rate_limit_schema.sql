-- OTP rate limiting
-- Reuses otp_codes: request limits are derived from the rows themselves, so the
-- only new state is the per-code attempt counter.

-- Incorrect verification attempts against one code. The code is burned when this
-- reaches the configured maximum.
ALTER TABLE otp_codes
    ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;

-- Serves the rolling-window request count and the resend cooldown lookup, both of
-- which filter by phone number and creation time.
CREATE INDEX IF NOT EXISTS idx_otp_phone_created ON otp_codes(phone_number, created_at DESC);
