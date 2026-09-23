# AgriMarket landing page design

## Goal

Create a single-page marketing site for AgriMarket, a Cebu-focused mobile agricultural marketplace. The page should help prospective buyers and farmers understand the direct reservation-and-coordination model and encourage account creation or local-produce exploration.

## Product truth and claim boundaries

- AgriMarket connects buyers directly with local farmers in Cebu, Philippines.
- Buyers discover crop listings, reserve available inventory, and coordinate pickup and payment directly with farmers.
- The platform does not process payments, provide delivery, or support in-app checkout.
- Farmers must be approved before they can list. Location visibility is barangay-level, not precise-farm-location visibility.
- The supported app languages are English, Filipino, and Cebuano.
- The page must not state or imply public launch status, store availability, user counts, sales figures, partners, awards, reviews, price guarantees, exact locations, quality guarantees, instant replies, payment security, nationwide availability, or zero fees.
- Testimonials, ratings, and fabricated social proof are out of scope.

## Experience direction

**Mode:** Persuade.

Use an original “market map” visual world: deep AgriMarket green (`#1B6B43`), a pale botanical ground (`#F8FAF9`), rounded crop/listing cards, light map contours, and an illustrated phone interface. It should feel rooted in Cebu’s local agricultural communities, not resemble the supplied Tarsi reference beyond its high-level rhythm of hero, product storytelling, and closing call to action.

The visual tone is optimistic, practical, and human. The hero should feature a layered product preview rather than a generic dashboard. Decorative imagery may include crops, map pins, and subtle field lines; it must not show claims the app cannot support, such as delivery or a checkout flow.

## Information architecture

1. **Navigation** — brand mark, anchors for How it works / Features / Local trust, primary account-creation call to action.
2. **Hero** — headline: “Local harvests. Direct connections.” Supporting copy explains Cebu-local crop discovery, inventory reservations, and direct pickup/payment coordination. Primary CTA: “Create your AgriMarket account.” Secondary CTA: “Explore local produce.” A compact “Cebu, Philippines” marker is factual context, not a coverage promise beyond Cebu.
3. **Product moment** — a phone-like composition with three small supporting UI cards representing crop discovery, a reservation request, and buyer–farmer messages. These are illustrative and contain no invented product metrics.
4. **How it works** — three explicit steps: Discover local produce; Reserve what is available; Coordinate directly. Copy reiterates that pickup and payment are arranged between buyer and farmer.
5. **Capabilities** — five concise cards: active crop listings and image-assisted discovery; farmer inventory details; reservation requests; direct messages; market events and barangay discovery. Use product truth as supplied.
6. **Built for local coordination** — three trust principles: approved farmers before listing, barangay-level location privacy, and language support (English, Filipino, Cebuano). This replaces the testimonial/social-proof section common to app landing pages.
7. **Closing CTA and footer** — repeat account-creation CTA, provide the support email `agrimarket.cebu@gmail.com`, state “Cebu, Philippines,” and use “Upslope” only as the company name in the footer.

## Interaction and responsive behavior

- Navigation anchors scroll to their respective page sections; CTAs are styled as buttons but will use non-navigating placeholders until an official signup/exploration URL exists.
- Use a mobile-first single-column layout. At wider widths, hero content becomes two columns and capability cards form a responsive grid.
- Provide visible keyboard focus, high-contrast text, semantic headings, descriptive labels, and decorative images hidden from assistive technology.
- Respect `prefers-reduced-motion`; any entrance or hover movement is subtle and optional.

## Implementation shape

- Replace the starter content in `src/App.tsx` with semantic, static React sections and lightweight inline SVG iconography.
- Replace starter styling in `src/App.css` and `src/index.css` with a responsive design-token-based stylesheet. No external dependencies are necessary.
- Keep the page self-contained because official URLs, screenshots, app-store links, and publicly approved launch claims are not available.

## Verification

- `npm run build` and `npm run lint` complete successfully.
- Inspect desktop and narrow-mobile renders once each; correct any overflow, broken hierarchy, inaccessible contrast, or inaccessible interactive states in one batch.
- Reconfirm all displayed copy against the claim boundaries above, specifically ensuring no testimonials, ratings, delivery, checkout, payment-processing, or unsupported availability claims appear.
