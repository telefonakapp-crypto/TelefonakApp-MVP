-- ============================================================
-- MVP category visibility
-- Keeps full category architecture; only exposes Phones + Smartwatches.
-- Reactivate future categories with: UPDATE categories SET is_active = TRUE WHERE slug = '...';
-- ============================================================

UPDATE categories
SET is_active = TRUE
WHERE slug IN ('phones', 'smartwatches');

UPDATE categories
SET is_active = FALSE
WHERE slug NOT IN ('phones', 'smartwatches');
