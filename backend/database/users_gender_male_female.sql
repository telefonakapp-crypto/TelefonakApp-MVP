-- Restrict user gender to the current Telefonak product values.
-- Development-only cleanup: no real users exist, so unsupported legacy values
-- are cleared instead of preserved.

BEGIN;

UPDATE users
   SET gender = NULL
 WHERE gender IS NOT NULL
   AND gender NOT IN ('male', 'female');

DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    FOR constraint_name IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'public'
          AND rel.relname = 'users'
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) ILIKE '%gender%'
    LOOP
        EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END $$;

ALTER TABLE users
    ADD CONSTRAINT users_gender_check CHECK (gender IN ('male', 'female'));

COMMIT;
