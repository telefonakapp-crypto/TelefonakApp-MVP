> **Historical (July 2026 product planning).** Not an implementation contract. Current app: [README.md](../README.md) and [docs/README.md](README.md).

# Telefonak - UI / UX Guidelines

**Version:** 1.0  
**Status:** Approved (Living Document)  
**Last Updated:** July 2026

---

# 1. Purpose

This document defines the design system and user experience guidelines for Telefonak.

Its goals are to:

- Ensure visual consistency
- Improve usability
- Simplify future feature development
- Maintain a premium and trustworthy appearance

Every screen in the application should follow these guidelines.

---

# 2. Design Principles

Telefonak should feel:

- Modern
- Clean
- Fast
- Trustworthy
- Minimal
- Easy to use

Every interaction should require the fewest possible taps while keeping the interface intuitive.

---

# 3. Brand Personality

The UI should communicate:

- Trust
- Simplicity
- Transparency
- Professionalism
- Speed

The marketplace should feel safe for buyers and sellers.

---

# 4. Color Palette

## Primary

Telefonak Blue

```
#2563EB
```

Used for:

- Primary buttons
- Links
- Active navigation
- Highlights

---

## Secondary

Dark Gray

```
#1F2937
```

Used for:

- Headings
- Icons
- Navigation

---

## Background

```
#FFFFFF
```

---

## Surface

```
#F8FAFC
```

---

## Border

```
#E5E7EB
```

---

## Success

```
#22C55E
```

---

## Warning

```
#F59E0B
```

---

## Error

```
#EF4444
```

---

# 5. Typography

Primary Font

- Inter

Fallback

- System UI

---

## Heading Sizes

H1

32 px

H2

28 px

H3

24 px

H4

20 px

Body

16 px

Caption

14 px

Small

12 px

---

# 6. Spacing System

Base Unit

8 px

Common spacing:

- 8
- 16
- 24
- 32
- 48
- 64

Avoid arbitrary spacing values.

---

# 7. Border Radius

Small

8 px

Medium

12 px

Large

16 px

Cards

16 px

Buttons

12 px

Images

16 px

---

# 8. Shadows

Use subtle shadows only.

Cards should have light elevation.

Avoid heavy shadows.

---

# 9. Buttons

Primary Button

- Filled
- Blue background
- White text

Secondary Button

- White background
- Blue border

Danger Button

- Red background
- White text

Disabled Button

- Gray background
- Gray text

Buttons should have:

- Consistent height
- Rounded corners
- Loading state
- Disabled state

---

# 10. Inputs

Every input should include:

- Label
- Placeholder
- Validation
- Error message

Input states:

- Default
- Focused
- Error
- Disabled

---

# 11. Icons

Use one icon family throughout the application.

Recommended:

- Lucide
- Heroicons

Icons should maintain a consistent size and stroke weight.

---

# 12. Cards

Cards are used for:

- Listings
- Profile summaries
- Statistics
- Advertisements

Every card should include:

- Rounded corners
- Consistent padding
- Subtle shadow
- Clear hierarchy

---

# 13. Navigation

Bottom navigation contains:

- Home
- Search
- Sell
- Saved
- Profile

The current page should always be clearly highlighted.

---

# 14. Images

Listing photos should:

- Fill available width
- Maintain aspect ratio
- Support pinch-to-zoom on detail pages

Use placeholders while images load.

---

# 15. Loading States

Use skeleton loaders whenever possible.

Avoid blank screens.

Buttons should show loading indicators during requests.

---

# 16. Empty States

Provide friendly empty states for:

- No listings
- No search results
- No notifications
- No saved items
- No internet

Every empty state should include a clear next action.

---

# 17. Error States

Errors should:

- Explain what happened
- Explain how to recover
- Avoid technical language

Provide retry actions where appropriate.

---

# 18. Accessibility

Support:

- Dynamic text sizes
- Screen readers
- High contrast
- Touch targets of at least 44 × 44 px

Never rely on color alone to communicate status.

---

# 19. Animations

Animations should be:

- Fast
- Subtle
- Functional

Recommended duration:

150–300 ms

Avoid excessive animations.

---

# 20. Responsive Behavior

Support:

- Small phones
- Standard phones
- Large phones
- Tablets (future)

Layouts should adapt gracefully without breaking.

---

# 21. Dark Mode

Version 1.0

Not supported.

The interface should be designed so dark mode can be added in a future release with minimal redesign.

---

# 22. Marketplace Components

Listing cards should consistently display:

- Primary image
- Brand
- Model
- Price
- Battery health
- Condition
- Location
- Posted date

The same hierarchy should be used across Home, Search, Saved, and My Listings.

---

# 23. Forms

Long forms should be divided into logical sections.

Examples:

- Device Information
- Condition
- Photos
- Pricing
- Contact Information

Validation should occur as early as possible without interrupting the user.

---

# 24. Notifications

Toast messages should be used for:

- Successful actions
- Minor errors
- Informational updates

Critical errors should use modal dialogs only when immediate attention is required.

---

# 25. Consistency Rules

Every screen should follow the same:

- Typography
- Colors
- Button styles
- Card layouts
- Spacing
- Icons
- Navigation patterns

New features should extend the existing design system rather than introducing new styles.

---

# 26. Future Enhancements

Future versions may include:

- Dark Mode
- Theme customization
- Tablet-optimized layouts
- Motion preferences
- Enhanced accessibility features

These enhancements should build upon, rather than replace, the principles defined in this document.
