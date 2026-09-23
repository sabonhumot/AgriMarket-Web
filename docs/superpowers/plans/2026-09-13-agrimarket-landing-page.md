# AgriMarket Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Vite starter with an original, responsive, claim-accurate landing page for the AgriMarket mobile marketplace.

**Architecture:** A single semantic React component renders static marketing sections from small local data arrays for steps, capabilities, and local-trust principles. `App.css` owns surface layout and artwork while `index.css` supplies global tokens and baseline accessibility styles.

**Tech Stack:** React 19, TypeScript, Vite 8, CSS.

**Spec:** `docs/superpowers/specs/2026-09-13-agrimarket-landing-page-design.md`

## Global Constraints

- Use `#1B6B43` and `#F8FAF9` as brand anchors.
- Keep all copy limited to Cebu, Philippines. Do not imply nationwide coverage, public launch status, or store availability.
- Describe reservations and direct buyer-farmer pickup/payment coordination; never checkout, payment processing, or delivery.
- Do not include testimonials, ratings, metrics, partners, awards, price promises, quality guarantees, or invented claims.
- State only barangay-level location visibility, approved-farmer listing access, and English/Filipino/Cebuano support.
- Do not add dependencies or external image requests. Use CSS shapes and inline SVG.
- Preserve keyboard focus styles and respect `prefers-reduced-motion`.

---

### Task 1: Build semantic, claim-safe page content

**Files:**
- Modify: `src/App.tsx`
- Test: `npm run lint`

**Interfaces:**
- Consumes: React JSX only.
- Produces: Default `App` component with navigation, hero, product scene, steps, capabilities, local trust, CTA, and footer.

- [ ] **Step 1: Remove Vite starter state and imports**

Replace all imports with:

```tsx
import './App.css'
```

- [ ] **Step 2: Add factual local data**

Define arrays for three steps, five capabilities, and three trust principles. The step data must be:

```tsx
const steps = [
  ['01', 'Discover local produce', 'Browse active crop listings from approved farmers around Cebu.'],
  ['02', 'Reserve what is available', 'Send a reservation request when a listing fits what you need.'],
  ['03', 'Coordinate directly', 'Use messages to arrange pickup and payment with the farmer.'],
]
```

Capabilities cover image-assisted crop discovery, listing inventory details, reservations, messaging, and market-event/barangay discovery. Trust principles cover farmer approval, barangay-level privacy, and English/Filipino/Cebuano support.

- [ ] **Step 3: Render the page landmarks**

Render semantic `header`, `main`, and `footer`. Add navigation anchors for `#how-it-works`, `#features`, and `#local-trust`, plus a CTA to `#get-started`.

Use this hero:

```tsx
<p className="eyebrow">Cebu, Philippines</p>
<h1>Local harvests.<br /><em>Direct connections.</em></h1>
<p className="hero-copy">
  Discover local produce, reserve available harvests, and coordinate directly with farmers.
</p>
```

Give both CTAs an in-page `#get-started` target. State: “Pickup and payment are arranged directly with the farmer.”

- [ ] **Step 4: Create the original product-scene markup**

Add a `product-scene` containing a phone-like listing panel and three floating cards: “Crop discovery”, “Reservation request”, and “Direct message”. Display only generic crop names such as Bok Choy, Tomatoes, and Eggplant—no price, quantity, ratings, photos, or exact locations. Use only factual status labels: “Available”, “Request sent”, and “Coordinate pickup”. Mark ornamental SVGs and crop/map shapes `aria-hidden="true"`.

- [ ] **Step 5: Complete accessible closing content**

Use unique `h2` headings. Mark navigation with `aria-label="Main navigation"`. Footer content includes a `mailto:agrimarket.cebu@gmail.com` link, “Cebu, Philippines,” and “An Upslope product.”

- [ ] **Step 6: Verify lint**

Run: `npm run lint`

Expected: exit code 0 with no lint errors.

- [ ] **Step 7: Commit if Git is available**

```bash
git add src/App.tsx
git commit -m "feat: add agrimarket landing content"
```

If Git remains unavailable, record that fact in the handoff.

### Task 2: Add market-map visual system and responsive layout

**Files:**
- Modify: `src/index.css`
- Modify: `src/App.css`
- Test: `npm run build`

**Interfaces:**
- Consumes: Class names and section IDs created in Task 1.
- Produces: Responsive styling from 320px through desktop widths.

- [ ] **Step 1: Replace global Vite styles with design tokens**

Set global tokens including:

```css
:root {
  --ink: #15372a;
  --leaf: #1b6b43;
  --leaf-dark: #10452b;
  --cream: #f8faf9;
  --mist: #e7f0ea;
  --sun: #f2bc5b;
  --coral: #e97851;
  --line: rgba(21, 55, 42, 0.14);
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}
```

Set body margin to zero, background to `var(--cream)`, and text to `var(--ink)`. Add a 2px leaf-dark visible focus outline with a 3px offset to links and buttons. Remove Vite dark-mode rules.

- [ ] **Step 2: Establish desktop and mobile shell**

Create a centered page shell with a 1240px maximum width and a sticky, translucent header. Use a fluid headline scale of `clamp(3rem, 8vw, 7rem)`; render emphasized hero text in a serif stack. Use no gradients.

- [ ] **Step 3: Style hero artwork**

Use grid for the hero and switch to one column below 850px. Create faint contour lines with pseudo-elements/borders. Render a dark-green rounded phone frame with a cream screen and restrained shadow. Position floating cards asymmetrically, then tuck or stack them safely on narrow screens.

- [ ] **Step 4: Style the narrative sequence**

Style steps as a numbered editorial layout, features as a responsive card grid, and local trust as a dark-green contrast section. Use labels in every icon/card; color cannot be the sole way information is conveyed.

- [ ] **Step 5: Add CTA, interaction, and motion rules**

Give the final CTA a rounded cream panel and leaf button. Apply only subtle hover transforms. Add:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 6: Verify compilation**

Run: `npm run build`

Expected: TypeScript and Vite complete with exit code 0.

- [ ] **Step 7: Commit if Git is available**

```bash
git add src/App.css src/index.css
git commit -m "feat: style agrimarket market-map landing page"
```

If Git remains unavailable, record that fact in the handoff.

### Task 3: Inspect the rendered page and close defects

**Files:**
- Modify: `src/App.tsx` and/or `src/App.css` only if inspection finds a defect
- Test: `npm run lint`; `npm run build`

**Interfaces:**
- Consumes: Page and style work from Tasks 1–2.
- Produces: A visually checked, responsive, claim-safe landing page.

- [ ] **Step 1: Start Vite**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

- [ ] **Step 2: Inspect both viewport classes in one pass**

Capture at 1440px and 390px. Check header wrapping, CTA visibility, floating-card overlap, feature-grid collapse, contrast, focus styles, and footer readability.

- [ ] **Step 3: Audit claims and correct in one batch**

Remove any accidental implication of delivery, checkout, in-app payment, public app-store availability, exact farm locations, testimonials, ratings, or metrics. Also fix all visual defects discovered in Step 2 without replacing the market-map visual world.

- [ ] **Step 4: Recheck once**

Capture the corrected desktop and mobile views. Confirm no horizontal overflow, clipping, unreadable contrast, or CTA collision.

- [ ] **Step 5: Run final checks**

Run:

```bash
npm run lint
npm run build
```

Expected: both commands exit code 0.

- [ ] **Step 6: Commit if Git is available**

```bash
git add src/App.tsx src/App.css src/index.css
git commit -m "fix: polish agrimarket landing page"
```

If Git remains unavailable, record that fact in the handoff.
