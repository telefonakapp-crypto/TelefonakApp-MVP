-- Store OTP codes as HMAC-SHA256 hex digests (64 chars), not plaintext.
-- In-flight plaintext codes (pre-migration) expire within OTP TTL and become invalid.

ALTER TABLE otp_codes
  ALTER COLUMN code TYPE VARCHAR(64);
