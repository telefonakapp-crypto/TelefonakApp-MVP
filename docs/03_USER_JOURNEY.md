# Telefonak - User Journey

**Version:** 1.0
**Status:** Approved (Living Document)
**Last Updated:** July 2026

---

# 1. Purpose

This document defines every user journey in Telefonak Version 1.0.

Its purpose is to ensure that product, design, frontend, backend, and QA teams all share the same understanding of how users interact with the application.

Every screen and transition should follow these flows unless explicitly changed in a future version.

---

# 2. First Launch

## New User

User opens Telefonak.

↓

Splash Screen

↓

Welcome Screen

↓

Login / Create Account

---

## Returning User

User opens Telefonak.

↓

Splash Screen

↓

Authentication Check

↓

Home Screen

---

# 3. Registration Journey

User taps "Create Account".

↓

Enter:

- First Name
- Last Name
- Email
- Phone Number
- Password
- Confirm Password

↓

Accept Terms & Conditions

↓

Tap Create Account

↓

Receive OTP

↓

Verify Account

↓

Registration Successful

↓

Home Screen

---

# 4. Login Journey

User enters:

- Email or Phone Number
- Password

↓

Login

↓

Authentication Success

↓

Home Screen

If authentication fails:

↓

Display error message

↓

Allow retry

---

# 5. Forgot Password

User taps "Forgot Password"

↓

Enter Email

↓

Receive OTP

↓

Verify OTP

↓

Create New Password

↓

Login Screen

---

# 6. Home Journey

After login the user lands on Home.

Home contains:

- Search Bar
- Promotional Banner
- Latest Listings
- Featured Listings
- Quick Filters
- Bottom Navigation

Bottom Navigation:

- Home
- My Listings
- Sell
- Notifications
- Profile

---

# 7. Search Journey

User taps Search.

↓

Dedicated Search Screen

↓

Enter keyword

↓

Suggested searches appear

↓

Matching listings displayed instantly

↓

Tap listing

↓

Listing Details

---

# 8. Filter Journey

User taps Filters.

↓

Filter Screen opens.

Available filters:

- Device Type
- Brand
- Model
- Storage
- Color
- Battery Health
- Condition
- Price Range
- City
- Area

↓

Apply Filters

↓

Filtered Results

↓

Open Listing

---

# 9. Browse Listings

User scrolls listings.

Each card displays:

- Device Image
- Device Name
- Price
- Battery Health
- Condition
- City
- Time Posted

User can:

- Save Listing
- Open Listing

---

# 10. Listing Details

Opening a listing displays:

Image Gallery

↓

Device Specifications

↓

Seller Information

↓

Description

↓

Location

↓

Call Seller

↓

Submit Offer

User can also:

- Save Listing
- Share Listing

---

# 11. Save Listing Journey

User taps Heart Icon.

↓

Listing saved.

↓

Saved confirmation shown.

↓

Listing appears inside Saved Listings.

---

# 12. Create Listing Journey

User taps Sell.

↓

Select Device Type

↓

Select Brand

↓

Select Model

↓

Select Storage

↓

Select Color

↓

Select Condition

↓

Select Battery Health

↓

Enter Price

↓

Enter Description

↓

Select City

↓

Select Area

↓

Upload Photos

↓

Review Listing

↓

Submit

↓

Listing Status:

Pending Review

↓

Confirmation Screen

---

# 13. Listing Moderation Journey

Seller submits listing.

↓

Admin receives pending listing.

↓

Admin reviews:

- Photos
- Description
- Specifications

↓

Decision

Approved

or

Rejected

↓

Seller receives notification.

---

# 14. My Listings Journey

User opens My Listings.

Displayed sections:

- Active
- Pending
- Sold
- Hidden
- Rejected
- Expired

Selecting a listing allows:

- Edit
- Hide
- Delete
- Mark as Sold
- View Listing
- View Statistics

---

# 15. Saved Listings Journey

Profile

↓

Saved Listings

↓

View all saved devices

↓

Open listing

↓

Remove from Saved

---

# 16. Offer Journey

Buyer opens listing.

↓

Tap "Make Offer"

↓

Enter Offer Amount

↓

Submit

↓

Seller receives notification.

↓

Seller decides whether to contact buyer outside Telefonak.

---

# 17. Notifications Journey

Notifications include:

- Listing Approved
- Listing Rejected
- Listing Expiring Soon
- Offer Received

Selecting a notification opens the related screen.

---

# 18. Profile Journey

User opens Profile.

Available actions:

- Edit Personal Information
- Change Password
- View Saved Listings
- View My Listings
- Logout

---

# 19. Logout Journey

User taps Logout.

↓

Confirmation Dialog

↓

Logout

↓

Authentication Token Removed

↓

Login Screen

---

# 20. Admin Journey

Admin logs in.

↓

Dashboard

↓

Pending Listings

↓

Review Listing

↓

Approve or Reject

↓

Marketplace Updated

Admin can also:

- Manage Users
- Manage Banners
- View Analytics
- Suspend Accounts

---

# 21. Error Journeys

## No Internet

Display:

"No Internet Connection"

Retry Button

---

## Empty Search

Display:

"No devices found."

Suggest changing filters.

---

## Empty Saved Listings

Display:

"You haven't saved any listings yet."

---

## Empty My Listings

Display:

"You haven't created any listings yet."

Provide "Sell a Device" button.

---

# 22. Success States

The application should clearly communicate successful actions.

Examples:

- Listing Created
- Listing Saved
- Profile Updated
- Password Changed
- Offer Submitted

Every success state should provide immediate visual confirmation.

---

# 23. Design Principles

Every journey should prioritize:

- Simplicity
- Speed
- Minimal user effort
- Clear navigation
- Consistent interactions
- Fast loading
- Easy recovery from errors

Users should never feel lost or uncertain about what to do next.

---

# 24. Journey Completion

A user journey is considered complete when the intended action has been successfully performed with the fewest reasonable number of steps while maintaining clarity and trust.

Every future feature added to Telefonak should integrate naturally into these existing journeys rather than creating entirely new navigation patterns unless absolutely necessary.
