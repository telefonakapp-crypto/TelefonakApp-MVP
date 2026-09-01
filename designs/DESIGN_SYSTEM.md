# Design System Specification: High-End Gastroenterology Clinic

## 1. Overview & Creative North Star
**Creative North Star: "The Clinical Sanctuary"**

This design system rejects the cluttered, anxiety-inducing aesthetics of traditional medical portals. Instead, it adopts the "Clinical Sanctuary" approach—a digital experience that feels as quiet, clean, and professional as a high-end private clinic. 

We break the "template" look by prioritizing **negative space as a functional element**. By using intentional asymmetry, such as offsetting a hero headline from its supporting body text, we create a rhythmic, editorial flow. The experience should feel curated, not generated. Every element must breathe, conveying a sense of calm expertise and precision.

---

## 2. Colors: Tonal Depth & The "No-Line" Rule
The palette is rooted in medical trust but executed with high-end digital sophistication. We move beyond flat colors by using the Material-based surface tiers to create a sense of physical architecture.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to define sections. Traditional borders create visual noise and "trap" the eye. Instead, define boundaries through:
- **Background Shifts:** Place a `surface-container-low` section against a `surface` background.
- **Tonal Transitions:** Use subtle shifts between `#f9f9f9` (Surface) and `#ffffff` (Surface Lowest).

### Surface Hierarchy & Nesting
Treat the UI as a series of nested layers of fine paper.
- **Base Layer:** `surface` (#f9f9f9) for the primary page background.
- **Structural Layer:** `surface-container-low` (#f3f3f3) for large content blocks or sidebars.
- **Interactive Layer:** `surface-container-lowest` (#ffffff) for primary cards and input fields to make them "pop" forward.

### The "Glass & Gradient" Rule
To add soul to the interface:
- **Signature Gradients:** For primary CTAs and hero headers, use `primary` (#1976D2). This is Telefonak’s brand blue.
- **Glassmorphism:** For floating navigation bars or modal overlays, use `surface-container-lowest` at 80% opacity with a `24px` backdrop-blur. This ensures the clinic’s brand feels modern and integrated.

---

## 3. Typography: Editorial Authority
We utilize a pairing of **Manrope** for authoritative headlines and **Inter** for clinical precision in body copy.

*   **Display (Manrope):** Large, confident scales (`display-lg`: 3.5rem) used sparingly for high-impact brand messaging.
*   **Headlines (Manrope):** Used for section titles. The slightly geometric nature of Manrope conveys "modern expertise."
*   **Body (Inter):** The workhorse. Inter provides unmatched readability for medical information. Use `body-lg` (1rem) for patient instructions to ensure comfort.
*   **Labels (Inter):** Use `label-md` in `secondary` (#526069) for metadata, ensuring a clear distinction between data and actionable text.

---

## 4. Elevation & Depth: Tonal Layering
In "The Clinical Sanctuary," we do not use heavy shadows. We use light.

### The Layering Principle
Depth is achieved by stacking. A card using `surface-container-lowest` (#ffffff) sitting on a `surface-container` (#eeeeee) background creates a natural, soft lift. This is "Tonal Layering."

### Ambient Shadows
Where floating elements (like modals or dropdowns) require a shadow, use an "Ambient Shadow":
- **Values:** `0px 12px 32px rgba(26, 28, 28, 0.04)`
- **Rule:** The shadow color is a 4% tint of `on-surface`, never pure black. This mimics natural light diffusing through a clean room.

### The "Ghost Border" Fallback
If a container requires a border for accessibility (e.g., a search input), use a **Ghost Border**: `outline-variant` (#c1c6d4) at 20% opacity. It should be felt, not seen.

---

## 5. Components: Precision & Comfort

### Buttons (The "Soft-Touch" Component)
*   **Primary:** `primary` background, `on-primary` text. Roundedness: `xl` (0.75rem). Use a subtle inner-glow (top-down) for a premium "pressed" feel.
*   **Secondary:** `secondary-container` background. No border.
*   **Tertiary:** Transparent background with `primary` text. Use for low-emphasis actions like "Cancel."

### Input Fields
*   **Style:** `surface-container-lowest` background with a `Ghost Border`. 
*   **Focus State:** The border transitions to `primary` (#1976D2) with a soft 4px outer "aura" of the same color at 10% opacity.
*   **Typography:** Labels use `label-md` and sit above the field, never inside as placeholders (for accessibility).

### Cards & Lists (The "Breathable" Rule)
*   **Forbid Dividers:** Do not use horizontal lines between list items. Use **Vertical White Space** (1.5rem to 2rem) or alternating background shifts between `surface` and `surface-container-low`.
*   **Medical Icons:** Use "Thin-Stroke" (1px or 1.5px) professional medical icons. Icons should be housed in a `tertiary-fixed` (#abf4ac) circular container at 20% opacity to denote health and vitality.

### Specialty Component: The "Patient Pulse" Progress Bar
For multi-step appointment bookings or medical history forms, use a custom progress bar: a thin `outline-variant` track with a `tertiary` (#266931) fill, featuring a subtle "glow" effect to symbolize progress and care.

---

## 6. Do's and Don'ts

### Do
*   **DO** use at least 80px of vertical padding between major sections to emphasize the "spacious" requirement.
*   **DO** use `tertiary` (medical green) only as a "confirmation" or "health" accent—never as a primary button color.
*   **DO** align text-heavy content to a narrow, readable central column (max 680px) to mimic editorial medical journals.

### Don't
*   **DON'T** use `0.25rem` (DEFAULT) roundedness. It feels too "standard." Stick to `xl` (0.75rem) for a friendlier, high-end touch.
*   **DON'T** use pure black (#000000) for text. Always use `on-surface` (#1a1c1c) to maintain a soft, premium contrast.
*   **DON'T** use "Hard" edges. Every container should feel approachable and safe.