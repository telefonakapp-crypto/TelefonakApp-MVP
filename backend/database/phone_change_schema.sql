-- Change Phone Number (OTP verification)
-- Reuses the existing otp_codes table and the users row; no new tables.

-- Scope one-time codes to the flow that issued them, so a code sent for a phone
-- change cannot be redeemed at the login endpoint and vice versa.
-- Existing rows are backfilled to 'auth' by the column default.
ALTER TABLE otp_codes
    ADD COLUMN IF NOT EXISTS purpose VARCHAR(20) NOT NULL DEFAULT 'auth';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'otp_codes_purpose_check'
    ) THEN
        ALTER TABLE otp_codes
            ADD CONSTRAINT otp_codes_purpose_check
            CHECK (purpose IN ('auth', 'phone_change'));
    END IF;
END $$;

-- Lookups always filter on both columns.
CREATE INDEX IF NOT EXISTS idx_otp_phone_purpose ON otp_codes(phone_number, purpose);

-- Pending phone change lives on the user's own row: the requested number is held
-- here until its OTP is verified, so users.phone_number stays active meanwhile.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS pending_phone_number VARCHAR(20),
    ADD COLUMN IF NOT EXISTS pending_phone_expires_at TIMESTAMP;
