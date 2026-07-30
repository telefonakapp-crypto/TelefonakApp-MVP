# Telefonak - API Specification

**Version:** 1.0  
**Status:** Approved (Living Document)  
**Last Updated:** July 2026

---

# 1. Purpose

This document defines the REST API contract between the Telefonak mobile application and the backend server.

It specifies:

- Endpoints
- Authentication
- Request format
- Response format
- HTTP status codes
- Validation rules
- Pagination
- Error handling

This document is the single source of truth for API development.

---

# 2. General Standards

## Base URL

Development

```
http://localhost:5000/api
```

Production

```
https://api.telefonak.com/api
```

---

## Content Type

All requests and responses use:

```
application/json
```

File uploads use:

```
multipart/form-data
```

---

## Authentication

Protected endpoints require:

```
Authorization: Bearer <JWT_TOKEN>
```

Public endpoints do not require authentication.

---

# 3. Authentication Endpoints

## Register

POST

```
/auth/register
```

Purpose:

Create a new user account.

---

## Login

POST

```
/auth/login
```

Purpose:

Authenticate a user.

---

## Verify OTP

POST

```
/auth/verify-otp
```

Purpose:

Verify phone ownership.

---

## Forgot Password

POST

```
/auth/forgot-password
```

Future feature.

---

## Reset Password

POST

```
/auth/reset-password
```

Future feature.

---

# 4. User Endpoints

## Get Current User

GET

```
/users/me
```

Authentication Required

Returns:

- Profile
- Verification status
- Admin flag

---

## Update Profile

PUT

```
/users/me
```

Authentication Required

---

# 5. Brands

## Get Brands

GET

```
/brands
```

Public

Returns all supported brands.

---

# 6. Models

## Get Models

GET

```
/brands/{brandId}/models
```

Public

Returns models belonging to a brand.

---

# 7. Listings

## Get Listings

GET

```
/listings
```

Supports:

- Pagination
- Search
- Filters
- Sorting

---

## Get Listing

GET

```
/listings/{id}
```

Returns complete listing information.

---

## Create Listing

POST

```
/listings
```

Authentication Required

Uploads:

- Device details
- Images

Initial Status:

Pending Review

---

## Update Listing

PUT

```
/listings/{id}
```

Authentication Required

Only listing owner may update.

Updated listings return to review.

---

## Delete Listing

DELETE

```
/listings/{id}
```

Authentication Required

Soft delete preferred.

---

# 8. Listing Images

## Upload Images

POST

```
/listings/{id}/images
```

Multipart upload.

Maximum:

5 images.

---

## Delete Image

DELETE

```
/listings/{id}/images/{imageId}
```

Authentication Required.

---

# 9. Saved Listings

## Get Saved Listings

GET

```
/saved-listings
```

Authentication Required.

---

## Save Listing

POST

```
/saved-listings
```

Authentication Required.

---

## Remove Saved Listing

DELETE

```
/saved-listings/{listingId}
```

Authentication Required.

---

# 10. Offers

## Create Offer

POST

```
/offers
```

Authentication Required.

---

## Get My Offers

GET

```
/offers
```

Authentication Required.

---

# 11. Notifications

## Get Notifications

GET

```
/notifications
```

Authentication Required.

---

## Mark Notification Read

PUT

```
/notifications/{id}/read
```

Authentication Required.

---

# 12. Banners

Marketing banners for the Home carousel. `action_type` must be one of: `none`, `url`, `screen`, `listing`.

## Get Active Banners

GET

```
/banners
```

Public.

Returns active, in-schedule banners ordered by `display_order`.

Response fields: `id`, `title`, `image_url`, `action_type`, `action_value`, `display_order`, `starts_at`, `ends_at`.

---

# 13. Admin Web Authentication

Staff authenticate against the `admins` table (email + password). Middleware: `verifyAdminAuth`.

## Admin Login

POST

```
/admin/auth/login
```

Request: `{ "email", "password" }` → `{ token, admin }`.

## Current Admin

GET

```
/admin/auth/me
```

Requires Admin Web JWT.

---

# 14. Admin Web Modules

All routes below require Admin Web JWT (`Authorization: Bearer <admin-jwt>`).

| Area | Base path |
|------|-----------|
| Dashboard | `/admin/dashboard` |
| Listings moderation | `/admin/listings` |
| Banners | `/admin/banners` |
| Users | `/admin/users` |
| Admins (super_admin) | `/admin/admins` |
| Reports | `/admin/reports` |
| Settings | `/admin/settings` |
| Audit logs | `/admin/audit-logs` |
| Staff notifications | `/admin/notifications` |
| Banner image upload | `/admin/upload/image` |

Public marketplace banners remain `GET /banners` only. Banner CRUD is Admin Web-only under `/admin/banners`.

---

# 15. HTTP Status Codes

Standard responses:

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Validation Error |
| 500 | Internal Server Error |

---

# 18. Standard Response Format

Successful response:

```json
{
    "success": true,
    "data": {},
    "message": "Success"
}
```

Error response:

```json
{
    "success": false,
    "message": "Validation failed",
    "errors": []
}
```

---

# 19. Pagination

List endpoints should support:

```
?page=1
&limit=20
```

Response should include:

- Current Page
- Total Pages
- Total Records
- Page Size

---

# 20. Filtering

Listings should support:

- Brand
- Model
- Storage
- Color
- Condition
- Battery Health
- Price
- City
- Area

---

# 21. Sorting

Supported sorts:

- Newest
- Oldest
- Lowest Price
- Highest Price

Newest is the default.

---

# 22. Security

All protected endpoints require:

- Authentication
- Authorization
- Input validation
- SQL injection protection
- Rate limiting

Sensitive data must never be returned unnecessarily.

---

# 23. API Versioning

The API should be versioned.

Example:

```
/api/v1/
```

Breaking changes should introduce a new version instead of modifying existing endpoints.

---

# 24. Future Endpoints

Future versions may include:

- Chat
- Premium Listings
- IMEI Verification
- Trade-In
- Listing Reports
- AI Price Estimation
- Analytics APIs
- Webhooks

These endpoints are outside the scope of Version 1.0.
