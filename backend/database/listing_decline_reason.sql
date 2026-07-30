-- Persist admin decline reasons on listings (Admin Web + optional mobile).
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS decline_reason TEXT;
