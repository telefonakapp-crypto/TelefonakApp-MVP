# Telefonak - Database Specification

**Version:** 1.0
**Status:** Approved (Living Document)
**Last Updated:** July 2026

---

# 1. Purpose

This document defines the database architecture for Telefonak.

Unlike a greenfield design, this document is based on the existing backend implementation and serves as the authoritative reference for future development.

Where the current implementation differs from the approved MVP, those differences are documented together with the planned evolution.

---

# 2. Database Technology

Database Engine:

- PostgreSQL

Database Access:

- Node.js
- pg package (raw SQL)

ORM:

- None

Migration System:

- SQL schema files
- Manual initialization through `backend/scripts/init-db.js`

---

# 3. Current Schema

Version 1.0 contains the following tables:

| Table | Purpose |
|--------|---------|
| users | User accounts |
| otp_codes | Phone verification |
| brands | Device manufacturers |
| models | Device models |
| storage_options | Storage capacities |
| colors | Device colors |
| conditions | Device conditions |
| listings | Marketplace listings |
| listing_images | Listing gallery |
| notifications | User notifications |
| ads | Promotional banners |

---

# 4. Relationships

## User

One user can own many listings.

One user can receive many notifications.

---

## Brand

One brand owns many models.

---

## Model

One model belongs to one brand.

One model can be used in many listings.

---

## Listing

Each listing belongs to:

- User
- Model
- Storage
- Color
- Condition

Each listing can contain multiple images.

Each listing can generate notifications.

---

# 5. Table Overview

## users

Stores marketplace users.

Primary Key:

- id

Key Fields:

- phone_number
- email
- first_name
- last_name
- gender
- city
- is_verified
- is_admin

---

## otp_codes

Stores one-time verification codes.

Purpose:

- Registration
- Login
- Password recovery (future)

---

## brands

Stores supported manufacturers.

Examples:

- Apple
- Samsung
- Google
- Huawei

---

## models

Stores phone models.

Each model belongs to a brand.

Examples:

- iPhone 16 Pro
- Galaxy S25 Ultra

---

## storage_options

Reference table.

Examples:

- 64 GB
- 128 GB
- 256 GB
- 512 GB
- 1 TB

---

## colors

Reference table.

Examples:

- Black
- White
- Blue
- Titanium

---

## conditions

Reference table.

Current values:

- New
- Used - Like New
- Used - Good
- Used - Fair

---

## listings

Core marketplace table.

Stores:

- Seller
- Device
- Price
- Battery Percentage
- Description
- Location
- Status

---

## listing_images

Stores listing photos.

Each image belongs to exactly one listing.

---

## notifications

Stores user notifications.

Examples:

- Listing Approved
- Listing Declined
- New Listing

---

## ads

Stores promotional banners displayed in the application.

---

# 6. Current Constraints

The existing implementation includes:

- Primary Keys
- Foreign Keys
- Unique Constraints
- Check Constraints
- Indexes

Important validation:

- Price > 0
- Battery Percentage between 70–100
- Gender validation
- Listing status validation

---

# 7. Current Indexes

Major indexes include:

- User phone number
- Listing status
- Listing creation date
- Listing owner
- Model
- Notifications
- Ads

These indexes support marketplace performance.

---

# 8. Current Limitations

The current schema does not yet support:

- Saved Listings
- Offers
- Listing Expiration
- Audit Logs
- User Suspension
- Device Types
- Separate City and Area
- Hidden Listings
- Expired Listings
- View Counts

These features are planned for future schema updates.

---

# 9. Differences Between Current Schema and MVP

The approved MVP requires several additions.

## Authentication

Current:

- Phone OTP

Planned:

- Email uniqueness
- Password authentication

---

## Listings

Current:

- location

Planned:

- city
- area

---

Current:

Battery validation:

70–100

Planned:

0–100

---

Current statuses:

- pending
- approved
- declined
- active
- sold
- deleted

Planned statuses:

- pending
- approved
- rejected
- hidden
- sold
- expired

---

## Missing Tables

Future versions should introduce:

### saved_listings

Stores user favourites.

---

### offers

Stores buyer offers.

---

### audit_logs

Stores administrator actions.

---

### listing_views

Tracks listing popularity.

---

# 10. Known Issues

The following implementation issues should be addressed before production launch.

## Listing Status

The backend currently mixes:

- active
- approved

This should be standardized to a single published status.

---

## Email

Email is not currently unique.

A UNIQUE constraint should be added.

---

## Password Authentication

The current implementation uses OTP only.

Password authentication should be added if retained in the product requirements.

---

## Admin Notes

Admin approval notes are accepted by the API but not stored.

---

## Rejection Reasons

Listing rejection reasons are not persisted.

A dedicated field should be added.

---

## Bilingual Support

The optional bilingual migration is not enabled by default.

If multilingual support is introduced in the future, the migration should become part of the standard initialization process.

---

# 11. Future Database Evolution

Future schema additions are expected to include:

- saved_listings
- offers
- audit_logs
- listing_views
- listing_reports
- user_sessions
- listing_expiration
- user_preferences

These additions should be implemented using versioned database migrations rather than modifying historical SQL files.

---

# 12. Database Design Principles

All future schema changes should follow these principles:

- Normalize shared reference data.
- Preserve referential integrity.
- Use foreign keys wherever possible.
- Prefer explicit constraints over application-only validation.
- Maintain backward compatibility through migrations.
- Keep indexes aligned with application query patterns.

This document is the authoritative reference for the Telefonak database and should be updated whenever the schema changes.
