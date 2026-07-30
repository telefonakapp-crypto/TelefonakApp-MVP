-- Remove legacy mobile OTP admin flag. Staff auth is the admins table only.
ALTER TABLE users DROP COLUMN IF EXISTS is_admin;
