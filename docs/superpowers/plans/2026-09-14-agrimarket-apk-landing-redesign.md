# AgriMarket APK Landing Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current AgriMarket page into a download-first Android APK landing page with an original, accessible app-icon-to-product scroll story.

**Architecture:** Keep the single React page, but make download metadata explicit and reuse it through a small `DownloadButton` component. Replace the existing unconstrained feature rail with an accessible three-state product story driven by semantic buttons and CSS custom properties; scroll observation only changes a visual active state and never hides content.

**Tech Stack:** React 19, TypeScript, Vite 8, plain CSS, Node's built-in test runner, ESLint.

**Spec:** `docs/superpowers/specs/2026-09-14-agrimarket-apk-landing-redesign-design.md`

## Global Constraints

- Preserve AgriMarket's actual claims: Cebu-local produce discovery, reservations, direct pickup/payment coordination, reviewed farmers, barangay-level locations, and English/Filipino/Cebuano support.
- Do not add payment processing, delivery, checkout, public-launch, partner, metric, testimonial, response-time, or security claims.
- Keep the APK host as a single configurable URL; do not embed a Google Drive-specific flow.
- Never imply that a browser can silently install an APK. Show Download → Allow if prompted → Open and install.
- Retain all content with JavaScript disabled and under `prefers-reduced-motion: reduce`.
- Keep every control keyboard-focusable with visible focus and at least 44px touch targets.
- Do not add a runtime dependency for motion.
- This workspace has no Git metadata; omit commit commands and report that fact in task handoffs.

---

## File Structure

- `src/App.tsx` — download URL configuration, semantic page content, reusable download button, install guide, product-story state and keyboard behavior.
- `src/App.css` — APK-first composition, hero icon/phone continuity styling, product-story states, responsive layout, and reduced-motion fallback.
- `tests/apk-landing.test.mjs` — source-level regression checks for direct-download configuration, accurate install guidance, and accessible story controls.
- `tests/horizontal-scroll.test.mjs` — remove assertions for the superseded five-panel wheel-only interaction and retain brand-asset coverage.

### Task 1: Establish download and story regression coverage

**Files:**
- Create: `tests/apk-landing.test.mjs`
- Modify: `tests/horizontal-scroll.test.mjs`
- Test: `tests/apk-landing.test.mjs`

**Interfaces:**
- Consumes: `src/App.tsx` as a UTF-8 source file.
- Produces: stable assertions that require `DOWNLOAD_URL`, an Android download CTA, an ordered installation guide, a three-step story, and accessible story navigation.

- [ ] **Step 1: Write the failing tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')

test('keeps every download action bound to one configured APK URL', () => {
  assert.match(source, /const DOWNLOAD_URL = 'https:\/\/downloads\.agrimarket\.example\/AgriMarket-1\.0\.0\.apk'/)
  assert.match(source, /href=\{DOWNLOAD_URL\}/)
  assert.match(source, /Download for Android/)
})

test('explains the Android installation path without promising silent installation', () => {
  assert.match(source, /Download the APK/)
  assert.match(source, /Allow installs if Android asks/)
  assert.match(source, /Open the download and install/)
  assert.doesNotMatch(source, /Create your AgriMarket account/)
})

test('renders an accessible three-step product story', () => {
  assert.match(source, /Discover/)
  assert.match(source, /Reserve/)
  assert.match(source, /Coordinate/)
  assert.match(source, /aria-label="Product walkthrough"/)
  assert.match(source, /aria-current=\{isActive \? 'step' : undefined\}/)
})
```

- [ ] **Step 2: Run the new test to verify it fails**

Run: `node --test tests/apk-landing.test.mjs`

Expected: FAIL because `DOWNLOAD_URL`, the install-guide copy, and accessible three-step controls do not yet exist.

- [ ] **Step 3: Remove the obsolete rail-specific test**

In `tests/horizontal-scroll.test.mjs`, retain the brand-asset test and remove only the test named `renders a horizontal feature-story track with all core moments`. The upcoming source replaces that five-panel wheel-driven rail with a three-step controlled story.

- [ ] **Step 4: Run both test files to verify the baseline**

Run: `node --test tests/*.test.mjs`

Expected: the original brand-asset assertion passes; the new APK-landing assertions fail.

---

### Task 2: Build the download-first semantic page structure

**Files:**
- Modify: `src/App.tsx`
- Test: `tests/apk-landing.test.mjs`

**Interfaces:**
- Consumes: `DOWNLOAD_URL: string`, `storySteps: Array<{ id: 'discover' | 'reserve' | 'coordinate'; label: string; title: string; copy: string }>`.
- Produces: `DownloadButton`, `InstallGuide`, and semantic `ProductStory` markup used by header, hero, and closing CTA locations.

- [ ] **Step 1: Implement a single direct-download configuration and reusable button**

At module scope, add:

```tsx
const DOWNLOAD_URL = 'https://downloads.agrimarket.example/AgriMarket-1.0.0.apk'

function DownloadButton({ className = 'button button-primary' }: { className?: string }) {
  return <a className={className} href={DOWNLOAD_URL} download>
    Download for Android <span aria-hidden="true">↓</span>
  </a>
}
```

Use `<DownloadButton />` in the header, hero, and closing section. Do not call the action account creation, email access, or instant installation.

- [ ] **Step 2: Replace account-creation copy with accurate Android guidance**

Replace the hero CTA group with one `DownloadButton` and a short note: `Android APK · 121 MB`. Add an in-page `href="#install"` text link labeled `How installation works`.

Replace the closing `mailto:` CTA with `DownloadButton`. Add this semantic guide immediately below it:

```tsx
<ol className="install-guide" id="install">
  <li><strong>Download the APK</strong><span>Save AgriMarket to your Android device.</span></li>
  <li><strong>Allow installs if Android asks</strong><span>Approve your browser or file manager as the install source.</span></li>
  <li><strong>Open the download and install</strong><span>Follow Android’s confirmation steps.</span></li>
</ol>
```

- [ ] **Step 3: Replace the five-panel wheel handler with an explicit product story**

Delete `featureTrackRef` and `handleFeatureWheel`. Add `useState` alongside `useRef`, then define exactly three `storySteps` with `id`, `label`, `title`, and `copy` values for Discover, Reserve, and Coordinate.

Render a labelled region and a real button per step:

```tsx
const [activeStory, setActiveStory] = useState<'discover' | 'reserve' | 'coordinate'>('discover')

<section className="product-story" id="features" aria-label="Product walkthrough">
  {storySteps.map((step) => {
    const isActive = step.id === activeStory
    return <article className={`story-panel ${isActive ? 'is-active' : ''}`} key={step.id}>
      <button
        className="story-control"
        type="button"
        aria-current={isActive ? 'step' : undefined}
        onClick={() => setActiveStory(step.id)}
      >
        {step.label}
      </button>
      <h3>{step.title}</h3>
      <p>{step.copy}</p>
    </article>
  })}
</section>
```

Keep all three panels' textual content in the DOM. Make the phone-style visual decorative unless its controls perform real navigation.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `node --test tests/apk-landing.test.mjs`

Expected: PASS.

- [ ] **Step 5: Run all source assertions**

Run: `node --test tests/*.test.mjs`

Expected: PASS with the brand-asset and APK-landing checks.

---

### Task 3: Implement the app-icon hero and original scroll continuity

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Test: `tests/apk-landing.test.mjs`

**Interfaces:**
- Consumes: existing `appIcon` image asset and `activeStory` state.
- Produces: a hero icon that is visually connected to the phone composition, plus three visible responsive story panels with active-state emphasis.

- [ ] **Step 1: Add a hero app-icon anchor beside the phone preview**

Place the owned `appIcon` asset in the hero composition as a decorative image with empty alt text, inside a `.hero-app-icon` wrapper. Keep the existing app phone visual as the product preview and ensure no mock control is interactive unless it has a real action.

- [ ] **Step 2: Add CSS custom properties and scroll-driven continuity when supported**

In `src/App.css`, create a `.hero-app-icon` that uses transform and shadow only. Add a progressive enhancement inside `@supports (animation-timeline: view())` that ties an icon-to-phone transform/opacity transition to the hero’s view timeline. Default CSS must show the icon and phone normally before this enhancement runs.

Use a bounded animation with the motion direction below:

```css
@supports (animation-timeline: view()) {
  .hero-app-icon {
    animation: icon-to-product 700ms cubic-bezier(.16, 1, .3, 1) both;
    animation-timeline: view();
    animation-range: entry 15% cover 45%;
  }
}

@keyframes icon-to-product {
  to { transform: translate3d(72px, 128px, 0) scale(.55) rotate(4deg); opacity: .72; }
}
```

Adjust exact transform values only after visual inspection. Do not animate `top`, `left`, `width`, `height`, or margins.

- [ ] **Step 3: Style the three-step story as an accessible sequence**

Replace wheel-only rail styles with a responsive grid. On desktop, use a three-column sequence; on mobile, make panels vertically stack. Give each `.story-control` a text label, 44px minimum block size, transparent background, and the existing visible focus ring. Use `.is-active` to raise contrast and visual prominence; do not hide non-active content.

- [ ] **Step 4: Add the reduced-motion fallback**

Extend the existing reduced-motion media query to set `animation: none` for `.hero-app-icon` and disable transition movement on story panels. All app icon, phone, panel copy, and controls remain visible and usable.

- [ ] **Step 5: Run source tests after styling changes**

Run: `node --test tests/*.test.mjs`

Expected: PASS; these tests ensure the structural and copy changes survived the visual implementation.

---

### Task 4: Validate quality, responsiveness, and copy boundaries

**Files:**
- Modify: `src/App.tsx` and/or `src/App.css` only if the checks below reveal a defect.
- Test: `tests/*.test.mjs`

**Interfaces:**
- Consumes: completed page structure and styles.
- Produces: verified APK landing page ready for a real host URL.

- [ ] **Step 1: Run static verification**

Run:

```powershell
node --test tests/*.test.mjs
npm run lint
npm run build
```

Expected: all tests pass, ESLint exits 0, and Vite produces `dist/` without TypeScript errors.

- [ ] **Step 2: Perform one batched desktop and mobile visual pass**

Start the Vite preview, inspect 1440px desktop and 320px plus 390px mobile widths, then correct this exact checklist in one batch:

- Hero copy, the app icon, and phone visual never clip or introduce horizontal scroll.
- The primary download button is visible in the initial viewport and clearly says Android download.
- Every story control has a visible focus indication, label, and 44px target at mobile width.
- The closing guide remains readable without referring to external documentation.
- Secondary text maintains readable contrast over green and yellow surfaces.
- The icon-to-phone motion remains smooth where supported and content remains complete with reduced motion enabled.

- [ ] **Step 3: Verify the final source remains truthful**

Run:

```powershell
rg -n "Create your AgriMarket account|mailto:.*subject=AgriMarket%20account|delivery|checkout|payment security|testimonial|review" src
```

Expected: no account-creation CTA or unsupported marketing claim remains. Existing factual references to direct pickup/payment coordination are allowed.

- [ ] **Step 4: Record the host handoff requirement**

Before production launch, replace the placeholder `DOWNLOAD_URL` with the final public Blob/object-storage APK URL, confirm it downloads directly on a physical Android device, and validate the signed APK’s installation prompt. This cannot be completed until the host and final asset are supplied.
