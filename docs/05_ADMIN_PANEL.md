# Telefonak - Admin Panel Specification

**Version:** 1.0
**Status:** Approved (Living Document)
**Last Updated:** July 2026

---

# 1. Purpose

The Admin Panel is the operational dashboard used by Telefonak administrators to manage the marketplace.

Its primary objectives are to:

- Maintain marketplace quality
- Moderate listings
- Manage users
- Publish promotional banners
- Monitor marketplace activity
- View platform analytics

The Admin Panel is not accessible to regular users.

---

# 2. Administrator Roles

Version 1.0 supports a single administrator role.

Administrators have unrestricted access to all admin features.

Future versions may introduce:

- Super Admin
- Content Moderator
- Customer Support
- Marketing Manager

---

# 3. Dashboard

The dashboard is the first screen after administrator login.

## Widgets

- Total Users
- Active Users
- Total Listings
- Pending Listings
- Approved Listings
- Rejected Listings
- Sold Listings

## Charts

- New Users (Daily)
- Listings Created (Daily)
- Marketplace Activity
- User Growth

---

# 4. Navigation

The sidebar contains:

- Dashboard
- Listings
- Users
- Banners
- Analytics
- Settings
- Logout

---

# 5. Listings Management

## Listing Table

Each listing displays:

- Listing ID
- Thumbnail
- Device Name
- Seller
- Price
- Status
- Created Date

Filters:

- Pending
- Approved
- Rejected
- Sold
- Hidden
- Expired

Search by:

- Listing ID
- Seller Name
- Brand
- Model

---

# 6. Listing Review

Opening a listing displays:

- Image Gallery
- Device Specifications
- Description
- Seller Information
- Creation Date

Administrator Actions:

- Approve
- Reject
- Hide
- Delete

---

# 7. Reject Listing

If rejected:

Administrator must provide:

- Rejection Reason

The reason is sent to the seller.

Rejected listings remain editable by the seller.

---

# 8. User Management

Each user record contains:

- User ID
- Name
- Email
- Phone
- City
- Join Date
- Listings Count
- Account Status

Administrator can:

- View User
- Suspend User
- Reactivate User

Deleting users is not supported in Version 1.0.

---

# 9. User Profile

Admin can view:

- Personal Information
- Listing History
- Saved Listings Count
- Number of Approved Listings
- Number of Rejected Listings

---

# 10. Banner Management

Administrators can:

- Upload Banner
- Replace Banner
- Delete Banner
- Change Display Order
- Enable Banner
- Disable Banner

Banner fields:

- Title
- Image
- Target URL (optional)
- Display Order
- Active Status

---

# 11. Analytics

Dashboard metrics include:

Marketplace

- Listings Created
- Listings Approved
- Listings Rejected
- Listings Sold

Users

- New Users
- Active Users

Categories

- Most Popular Brands
- Most Popular Models

Geography

- Listings by City
- Users by City

---

# 12. Search

Admin can search:

Listings

- Listing ID
- Brand
- Model
- Seller

Users

- Name
- Email
- Phone Number

---

# 13. Filters

Listings can be filtered by:

- Status
- Brand
- Device Type
- Date
- City

Users can be filtered by:

- Active
- Suspended
- Join Date

---

# 14. Permissions

Administrators may:

- View all listings
- View all users
- Approve listings
- Reject listings
- Hide listings
- Manage banners
- Access analytics

Regular users cannot access any admin endpoint.

---

# 15. Notifications

Admin receives notifications for:

- New Listing Submitted
- System Errors (future)
- New User Registration (optional)

---

# 16. Audit Trail

Every admin action should be logged.

Examples:

- Listing Approved
- Listing Rejected
- Banner Deleted
- User Suspended

Each log stores:

- Administrator
- Action
- Timestamp
- Target Resource

---

# 17. Security

Requirements:

- Authentication required
- Role-based authorization
- Secure sessions
- HTTPS only
- Protected API endpoints

---

# 18. Performance

Dashboard should:

- Load in under 3 seconds
- Support pagination
- Support server-side searching
- Support server-side filtering

---

# 19. Error Handling

The panel should gracefully handle:

- Network failures
- Unauthorized access
- Missing resources
- Invalid data

Each error should present a clear message with a retry option where appropriate.

---

# 20. Acceptance Criteria

The Admin Panel is considered complete when administrators can:

- Review pending listings
- Approve or reject listings
- Manage users
- Manage banners
- Search and filter data
- View marketplace analytics
- Access audit logs
- Perform all actions securely

All admin actions must be reflected immediately throughout the marketplace.
