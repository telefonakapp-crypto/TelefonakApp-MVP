# Telefonak - MVP Scope

**Version:** 1.0  
**Status:** Approved (Living Document)  
**Last Updated:** July 2026

---

# 1. Purpose

This document defines the exact scope of Telefonak Version 1.0 (Minimum Viable Product).

Its purpose is to ensure that every stakeholder, designer, and developer understands:

- What is included in the first public release.
- What is intentionally excluded.
- What determines launch readiness.
- What will be developed in future versions.

Anything not listed in this document should be considered **out of scope** unless explicitly approved.

---

# 2. MVP Goal

The goal of Version 1.0 is simple:

> Launch a fast, trustworthy marketplace where users in Jordan can easily buy and sell used smartphones and smartwatches.

The MVP is **not** intended to compete with every marketplace feature from day one.

Instead, it should solve one problem exceptionally well.

---

# 3. Supported Devices

Version 1.0 supports only:

- Smartphones
- Smartwatches

No other device categories are included.

---

# 4. User Roles

The MVP includes two user roles:

## Customer

Can:

- Register
- Login
- Browse listings
- Search
- Filter
- Save listings
- Create listings
- Manage listings
- Receive notifications
- Edit profile
- Contact sellers

---

## Administrator

Can:

- Manage users
- Review listings
- Approve listings
- Reject listings
- Manage banners
- View analytics
- Moderate marketplace activity

---

# 5. Authentication

Included:

- Splash Screen
- Login
- Registration
- Email verification / OTP
- Phone verification (if enabled)
- Forgot Password
- Logout
- Edit Profile

Not Included:

- Google Login
- Apple Login
- Facebook Login

---

# 6. Home Screen

Included:

- Search bar
- Promotional banner carousel
- Latest listings
- Featured listings
- Quick filters
- Pull to refresh
- Infinite scrolling

---

# 7. Search

Users can search by:

- Brand
- Model
- Keywords

Search results update instantly.

---

# 8. Filters

Supported filters:

- Device Type
- Brand
- Model
- Storage
- Color
- Condition
- Battery Health
- Minimum Price
- Maximum Price
- City
- Area

Filters may be combined.

---

# 9. Listing Details

Every listing contains:

- Photos (up to 5)
- Device type
- Brand
- Model
- Storage
- Color
- Battery Health
- Condition
- Price
- Description
- Seller information
- City
- Area
- Date posted

---

# 10. Create Listing

Seller provides:

- Device type
- Brand
- Model
- Storage
- Color
- Condition
- Battery Health
- Price
- Description
- City
- Area
- Photos

System validates:

- Required fields
- Image count
- Valid selections

New listings enter **Pending Review**.

---

# 11. Listing Moderation

Every listing follows:

Pending Review

↓

Approved

or

Rejected

Rejected listings include a rejection reason.

Listings become publicly visible only after approval.

---

# 12. Listing Statuses

Every listing can be:

- Pending Review
- Approved
- Rejected
- Hidden
- Sold
- Expired

Expired listings occur after 60 days.

---

# 13. My Listings

Users can:

- View listings
- Edit listings
- Hide listings
- Mark as sold
- Delete listings
- View listing status
- View listing views

---

# 14. Saved Listings

Users can:

- Save listings
- Remove saved listings
- View saved listings

---

# 15. Seller Contact

Version 1.0 includes:

- Call Seller

Version 1.0 does NOT include:

- In-app chat
- Messaging
- Voice calls
- Video calls

---

# 16. Notifications

Users receive notifications for:

- Listing approved
- Listing rejected
- Listing expires soon
- New bid offer
- Listing sold (manual status)

---

# 17. Offer System

Buyers can submit an offer below the asking price.

Seller receives:

- Offer amount
- Buyer's contact information

Seller decides whether to continue the conversation outside the platform.

---

# 18. Admin Dashboard

Includes:

## User Management

- View users
- Suspend users
- View user listings

---

## Listing Management

- Approve listings
- Reject listings
- Delete listings

---

## Banner Management

- Upload banners
- Edit banners
- Remove banners

---

## Analytics

Dashboard displays:

- Total users
- Active users
- Listings created
- Listings approved
- Listings rejected
- Listings sold
- Daily growth
- Weekly growth
- Monthly growth

---

# 19. Non-Functional Requirements

Version 1.0 should prioritize:

- Fast loading
- Mobile-first design
- Responsive layouts
- Stable performance
- Secure authentication
- Reliable image uploads

---

# 20. Launch Success Criteria

Telefonak Version 1.0 is considered launch-ready when:

- Users can register.
- Users can login.
- Users can browse listings.
- Users can search.
- Users can filter.
- Users can create listings.
- Admin can approve listings.
- Listings become visible after approval.
- Users can save listings.
- Users can contact sellers.
- Notifications work.
- No critical bugs remain.

---

# 21. Explicitly Out of Scope

The following features are NOT included in Version 1.0:

- Store subscriptions
- Store pages
- Premium listings
- Featured listing payments
- AI pricing suggestions
- IMEI verification
- Warranty verification
- Chat
- Real-time messaging
- Product recommendations
- Trade-in program
- Device comparison
- Tablet marketplace
- Laptop marketplace
- Accessories marketplace
- Multi-language support
- Dark mode
- Web application

These features belong to future releases.

---

# 22. Definition of MVP Complete

The MVP is complete when every feature listed in this document is implemented, tested, and approved.

No additional features should be added before launch unless this document is updated and approved.

The primary objective is to launch a focused, stable, and trustworthy marketplace rather than an overly complex product.
