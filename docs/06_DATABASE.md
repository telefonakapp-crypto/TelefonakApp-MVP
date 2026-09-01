# Telefonak database

**Status:** Current implementation.  
**Code:** `backend/scripts/ensureDatabase.js`, `backend/database/*.sql`, `backend/utils/listingStatus.js`.

PostgreSQL. Access via the `pg` package (no ORM). DATE columns are handled as strings in the API to avoid timezone day-shift.

---

## Initialization (`ensureDatabase`)

`server.js` calls `await ensureDatabase(pool)` **before** `app.listen()`. `npm run init-db` runs the same function and exits.

Do **not** apply historical SQL files by hand against a populated database. Do **not** assume every SQL file is safe to re-run.

The catalog is `MIGRATION_FILES` in `ensureDatabase.js` (**48** files). Tracking table `schema_migrations` (`filename` PK, `applied_at`) is created in JavaScript.

`schema_migrations` means: **these filenames are considered applied.** It does **not** mean the database was built by running those exact files.

`verifySchema()` always runs after init or baseline (31 required tables, required `listings` columns, active `sim_configurations`).

PostgreSQL session advisory lock: `pg_advisory_lock(87261401, 9)` on a dedicated client, unlocked in `finally`. Failed SQL files are **not** recorded.

### Baseline contract

| Database state at startup | What happens |
|---|---|
| **New / empty** (none of the required application tables) | Execute pending SQL in catalog order; record each filename after success. |
| **Existing, fully initialized, tracking empty or absent** | Create `schema_migrations` if needed, **baseline** current filenames, **do not execute** historical SQL, then `verifySchema()`. |
| **Existing, partial or inconsistent, tracking empty or absent** | **STOP.** Do not baseline. Do not replay historical SQL. Server does not start. |
| **Tracking already has rows** | Skip recorded names; execute only pending catalog files. |

Fully initialized (when tracking is empty): all 31 required tables, required `listings` columns, `sim_configurations` has at least one active row.

**Unsafe:** if `schema_migrations` already has *some* rows (not 0, not the full catalog, or unexpected names), the code takes the **pending-apply** path. Missing historical files such as `admin_schema.sql` and `standardize_listing_status.sql` would execute and can change listing statuses. Do not hand-edit tracking to force a baseline.

### Future migrations

Append a new file under `backend/database/` **and** to the end of `MIGRATION_FILES`. Example: 48 skipped, `49_new_feature.sql` executed and recorded. Treat new SQL as a one-time migration.

### New empty database

Applies all 48 files, records 48 rows, `verifySchema()`, starts. Second start: applied 0, skipped 48.

---

## First production adopt of `schema_migrations`

For an existing Telefonak database that already has schema and data, and does **not** yet have a populated `schema_migrations` table.

This repository has **no staging database**. Rehearse on a local or staging **copy** (`pg_dump` / restore). Do **not** use live production for rehearsal. Do **not** point `npm run init-db` at production as a special targeting command — it uses the same `DB_*` as the API. Prefer starting the application.

### Why baseline is required

Older startup replayed all SQL files every boot. That is unsafe on data that already has `resubmitted` / `updated` listings: `admin_schema.sql` / `standardize_listing_status.sql` can set unsupported statuses to `pending` before later files reintroduce newer statuses.

### Before deployment

- [ ] PostgreSQL backup (restore tested)
- [ ] Application version includes `ensureDatabase` baseline (record git SHA)
- [ ] Same `DB_*` the API will use
- [ ] No active database incident
- [ ] Schema looks fully initialized; otherwise **do not deploy**
- [ ] Tracking absent or 0 rows:

```sql
SELECT to_regclass('public.schema_migrations') AS schema_migrations;
SELECT COUNT(*) AS migration_rows FROM schema_migrations;
SELECT filename FROM schema_migrations ORDER BY filename;
```

  - Missing table or `migration_rows = 0` → first-deploy baseline. Continue.
  - Exactly 48 current catalog filenames → already adopted; normal restart.
  - Any other count or unexpected names → **STOP.** Do not start. Do not delete rows.

- [ ] Snapshot integrity counts (listings by status, catalog, users, favorites, offers, notifications, banners, audit_logs, listing_moderation_events, listing_images, listing_image_uploads)
- [ ] Rollback understood: **pre-9A code ignores tracking and replays historical SQL**

### Deployment

- [ ] Deploy the code that includes baseline
- [ ] Start the API
- [ ] Logs must show baseline, **not** SQL apply:

```text
Existing initialized database detected — recording current migrations as baseline (no SQL replay)
✓ Baselined 48 migration files
Database initialization completed successfully (...; applied 0, skipped 48, baseline)
```

If logs show `Applying admin_schema.sql`, `Empty database detected`, or `applying N pending` on production: **stop the process**.

### After deployment

- [ ] `schema_migrations` has 48 rows matching `MIGRATION_FILES`
- [ ] `GET /api/health` succeeds
- [ ] Integrity counts unchanged (`resubmitted` / `updated` intact)
- [ ] Restart: `applied 0`, `skipped 48`, no baseline, no `Applying <file>`

### Partial / inconsistent databases

Startup **fails**. Do not automatically replay, baseline, guess, delete tracking, or “repair” production. An empty `schema_migrations` table may exist after a failed start (0 rows is not a baseline). Leave it; investigate.

### Backup and rollback

On a healthy existing DB, first adopt normally only creates `schema_migrations` and inserts 48 names. Backup is still required.

**Code rollback to a pre-tracking binary is unsafe** (replay-all SQL). Restore the pre-deploy backup instead of `DROP TABLE schema_migrations`.

---

## Required tables (`verifySchema`)

`users`, `brands`, `models`, `listings`, `storage_options`, `colors`, `conditions`, `categories`, `storage_capacities`, `model_storages`, `model_colors`, `sim_configurations`, `spec_definitions`, `model_spec_values`, `notifications`, `banners`, `cities`, `areas`, `favorites`, `listing_views`, `offers`, `admins`, `settings`, `audit_logs`, `listing_image_uploads`, `auth_refresh_sessions`, `listing_moderation_events`, `watch_case_sizes`, `model_watch_case_sizes`, `watch_connectivities`, `model_watch_connectivities`.

Other tables exist in SQL (for example `otp_codes`, `listing_images`, `listing_moderation_events` is required, `ads`) but are not all in the 31-name check.

---

## Listing statuses

Canonical: `backend/utils/listingStatus.js`.

| Status | Role |
|---|---|
| `pending` | New listing awaiting review (unless auto-approve) |
| `resubmitted` | New snapshot after editing a declined tip |
| `updated` | Approved listing edited by seller; awaiting review |
| `approved` | Live on the marketplace (only public status) |
| `declined` | Terminal for that snapshot; edit creates a new resubmitted row |
| `hidden` | Owner hid an approved listing; unhide returns to approved |
| `sold` | Terminal |
| `deleted` | Terminal (soft) |

Public marketplace, search, favorites, view counting, and public detail use **`approved` only**.

---

## Catalog

MVP-visible categories: `phones`, `smartwatches` (`backend/config/mvpCategories.js` and `mobile/src/utils/mvpCategories.js` must stay in sync). Listings may be `listing_source` `catalog` or `custom` (Other brand).
