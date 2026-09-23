# AgriMarket APK landing-page redesign

## Goal

Refocus the AgriMarket site as an Android APK download landing page. The page should explain the value of the app quickly, demonstrate its core local-market workflow, and guide a visitor to download and install a release APK.

## Product truth and constraints

- AgriMarket connects buyers and farmers in Cebu, Philippines.
- Users discover local produce, request reservations, and coordinate pickup and payment directly with farmers.
- The app does not process payments, delivery, or checkout.
- Farmers are reviewed before they list; locations are barangay-level; English, Filipino, and Cebuano are supported.
- APK hosting is intentionally configurable. The page must work with a future direct Blob/object-storage URL and must not embed a Drive-specific flow.
- The final download action cannot silently install an app. Copy must set expectations: download the APK, allow the browser to install unknown apps if Android asks, then open and install it.
- Do not add invented metrics, testimonials, partner claims, launch claims, response-time promises, or security/payment guarantees.

## Experience direction

**Mode:** Persuade.

Retain AgriMarket's local-market visual world: deep green, botanical pale ground, coral and harvest-yellow accents, field contours, and concise product UI. The composition becomes app-first and download-first: one prominent Android download action, an app-icon-to-product continuity moment, and tangible explanation of the app's value.

The redesign may draw on high-level app-showcase patterns from the supplied reference—product-led storytelling, deliberate scroll continuity, and a decisive closing action—but must not copy its layout, assets, copy, or exact motion choreography.

## Information architecture

1. **Navigation** — brand, short anchors for the workflow and local trust, plus a download CTA.
2. **Hero** — real AgriMarket app icon as the focal object, Cebu-local headline, short supporting copy, and the primary `Download for Android` button. Supporting text states the APK size once known and links to installation guidance.
3. **Proof strip** — discover nearby crops, request available inventory, and coordinate directly. These are benefits, not metrics.
4. **Product walkthrough** — three sequential moments: Discover, Reserve, Coordinate. Each has a clear visual state and one-sentence explanation.
5. **Local trust** — approved farmers, barangay-level location privacy, and language support.
6. **Download finale** — repeat the direct download button and explain the three Android-install steps in plain language.
7. **Footer** — support email, Cebu location, and product credit.

## Motion thesis

### Focal moment

The app icon in the hero represents the APK visitors are about to download. As the visitor enters the walkthrough, it transitions into the phone interface, making the relationship between the download and the product tangible.

### Continuity

The feature scenes progress Discover → Reserve → Coordinate in a horizontal desktop story. The active scene is emphasized while adjacent scenes recede; this communicates the sequence rather than decorating page scroll.

### Feedback and fallback

Download buttons receive a small hover/focus acknowledgment. Motion must never gate content. On touch devices, the walkthrough is a discoverable horizontal swipe track with visible progress and controls. With `prefers-reduced-motion`, the phone is already fully visible and the walkthrough becomes a static, scannable sequence.

### Performance budget

Use CSS transforms, opacity, and bounded clip/blur only on isolated visual layers. Avoid scroll handlers that animate layout properties, and avoid adding a motion dependency. App content is visible by default if JavaScript fails.

## Components and data flow

- `downloadUrl` is a single configuration value used by header, hero, and closing CTAs.
- `DownloadButton` conveys Android/APK context consistently and safely handles an unset URL with a disabled explanatory state during development.
- `InstallGuide` presents Download → Allow if prompted → Open and install in native ordered-list semantics.
- `ProductStory` manages the active walkthrough state, progress indicator, keyboard controls, and non-motion fallback.
- Hero app icon and phone visual use existing owned AgriMarket assets.

## Responsive and accessibility requirements

- Mobile is single column with a bottom-reachable download CTA in the hero and closing section.
- No fixed-width copy or decorative layer may create horizontal overflow at 320px.
- Feature controls have visible text labels, keyboard focus, and touch targets of at least 44px.
- Decorative mockup content is hidden from assistive technology unless it is interactive and functional.
- Buttons and download guidance use clear, accurate copy; no email handoff is presented as account creation.
- `prefers-reduced-motion` retains the story and all controls without scroll-linked spatial movement.

## Testing and verification

- Add test coverage for shared download URL usage, correct Android download labels, visible install guidance, and the three workflow moments.
- Run the new test and confirm it fails before implementation.
- Run the full test suite, `npm run lint`, and `npm run build` after implementation.
- Inspect desktop and 320–390px mobile in one visual pass, including keyboard focus and reduced-motion behavior.
- Verify the production download link manually after APK hosting is configured; this cannot be completed until the final URL exists.
