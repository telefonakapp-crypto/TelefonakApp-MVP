# Phone catalog data quality report

Research date: 2026-08-29  
Implementation: `backend/scripts/phoneCatalogData.js` → `generatePhoneCatalogSql.js` → `phone_catalog_seed.sql`  
Sources: `backend/database/PHONE_CATALOG_SOURCES.md`

Smartwatch rows were not modified. Listing rows were not deleted.

## Headline counts

| Metric | Before | After |
| --- | --- | --- |
| Brands | 14 | 20 |
| Phone models | 168 | 275 |
| Smartwatch models | 83 | 83 |
| Active phone storage associations | 238 | 663 |
| All phone storage associations | 238 | 663 |
| Phone models with no active storage | 74 | 0 |
| Listings | 142 | 142 |

## Breakdown requested in Phase 11

1. **Total brands before:** 14  
2. **Total brands after:** 20  
   Added: Redmi, POCO, Nothing, Sony, ASUS, Fairphone. Tecno and Infinix already existed as empty brands.

3. **Total models before:** 168 phones  
4. **Total models after:** 275 phones  

5. **Total storage variants before:** 238 active `model_storages` on phones  
6. **Total storage variants after:** 663 active `model_storages` on phones  

7. **Number of models corrected:** 94 existing phone rows updated in place (year/chipset/screen and/or storage). Existing names were kept so listings keep the same `model_id`.

8. **Number of missing models added:** 107 (275 − 168)

9. **Number of incorrect storage options corrected:** 0 deactivated. The old catalog under-specified storage (too few SKUs) rather than attaching capacities that never existed. No official-unverified extras were found to deactivate on this pass.

10. **Number of missing storage options added:** 425 net new active associations (663 − 238), including:
    - 128 GB on iPhone 8 / 8 Plus (Apple Support)
    - 32 GB on iPhone 6 (Apple Support)
    - 64 GB on Galaxy S7 (GSMArena)
    - 256/512 GB on Galaxy S20+ (GSMArena)
    - Official storage on all 74 Jordan-seed models that previously had none

11. **Number of duplicate records resolved:** 16 models moved off Xiaomi onto Redmi (10) and POCO (6). No rows deleted. `listings.model_id` unchanged.

12. **Could not be confidently verified:** see Needs Review in `PHONE_CATALOG_SOURCES.md` (LG/HTC/BlackBerry/full historical budget lines, some regional SKUs, a few chipset labels).

## Per-brand phone models after

| Brand | Phones |
| --- | --- |
| Apple | 52 |
| Samsung | 74 |
| Google | 37 |
| Huawei | 14 |
| Xiaomi | 10 |
| Redmi | 10 |
| Honor | 9 |
| Oppo | 9 |
| OnePlus | 8 |
| Vivo | 7 |
| Realme | 7 |
| Motorola | 6 |
| POCO | 6 |
| Tecno | 5 |
| Infinix | 5 |
| Nokia | 4 |
| Nothing | 4 |
| Sony | 4 |
| ASUS | 3 |
| Fairphone | 1 |

## Architecture notes (Phase 1)

Phone catalog lives in `brands` → `models` (`category_id` = phones) → `model_storages` → `storage_capacities`. Listings reference `models.id` and `model_storages.id`. `spec_definitions` / `model_spec_values` exist but were empty and were not populated. Chipset, screen size, and release year live on `models` and were filled where verified.

The smartwatch work is the template: researched JS records, generated idempotent SQL, source markdown, deactivate-don't-delete, never steal a same-named row from the other category.

## How to re-run

```bash
cd backend
npm run generate:phone-catalog
# applied automatically on API boot via ensureDatabase.js
```
