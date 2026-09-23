# AgriMarket administrator workspace design

## Purpose

Add a separate, navigable `/admin` workspace for AgriMarket platform administrators. It supports overall platform management, user and organization oversight, and security and moderation. Event management is intentionally excluded because it belongs to a separate event-manager role.

The existing public landing page remains the default experience and is not repurposed as an internal dashboard.

## Scope and boundaries

The first release is a front-end prototype using clearly labeled in-memory demo data. It does not connect to authentication, a database, notification delivery, audit storage, or real account actions. Buttons and controls change local UI state only.

The page will be available at `/admin` without adding a routing dependency. A small path-aware app shell will render either the public landing page or the administrator workspace and handle browser back/forward navigation.

## Experience and layout

The administrator workspace uses AgriMarket’s existing green, cream, mist, sun, and coral palette but adapts it to a compact desktop work surface:

- A persistent left sidebar contains the AgriMarket mark, the signed-in administrator identity, and navigation for Overview, Users, Organizations, Moderation, Security & access, and Activity log.
- The main header names the selected area and contains a search field, a notification affordance, and the administrator profile control.
- The Overview begins with four concise health cards: active users, pending organization reviews, open moderation reports, and access alerts. Values are marked as demo data.
- A primary review queue follows the TailAdmin-inspired reference pattern: shared search/filter controls and three status columns—Needs review, Investigating, and Resolved. Cards represent AgriMarket-specific reports, verification tasks, organization approvals, suspicious activity, or access requests.
- The right/lower supporting content shows recent activity and a small security summary rather than event information.

The design borrows only the reference’s compact sidebar-and-board composition, shared controls, and status-column grouping. It uses original AgriMarket content, visual tokens, and interaction behavior.

## Views and interactions

The sidebar is a real local navigation control. Selecting a destination replaces the main panel with a focused view:

- **Overview:** health snapshot, review board, security snapshot, and recent activity.
- **Users:** searchable, filterable user table/list with status and role badges.
- **Organizations:** searchable approval list with organization type, owner, and review state.
- **Moderation:** expanded review board with report filtering and local status changes.
- **Security & access:** sign-in, access-role, and suspicious-activity records with severity filters.
- **Activity log:** chronological, filterable demo events.

The review board’s cards can be moved between statuses using an explicit status control; keyboard and pointer activation must both work. Search and filter controls reduce visible demo items. Empty results show a useful message with a reset-filter action. Sample actions such as "Review" open a local detail panel or update the selected record in local state; no control implies an external action has occurred.

## Data and state

Typed local records will define users, organizations, review items, security events, and activity entries. The app holds selected navigation view, query, active filters, selected record, and mutable review status in React state. Derived views filter those local records instead of duplicating state.

All initial metric values, alerts, and identity details are visibly or semantically labeled as demo data. The design contains no fabricated performance claim about the live AgriMarket product.

## Responsive and accessible behavior

- At desktop widths (1440px), the sidebar and three review columns are visible together.
- At tablet widths (768px), the sidebar collapses to a compact rail or drawer trigger and review columns remain horizontally grouped within their own scroll region if needed, without causing page-level overflow.
- At phone widths (375px), navigation becomes a menu control, summary cards stack, and the review board presents one status column at a time via accessible tabs or a selector.
- Controls have explicit labels, visible focus styles, a minimum 44px target, and keyboard behavior. The board does not rely on drag and drop.
- Color is never the only indicator of record status or severity. Text labels and icons accompany badges.
- Motion remains subtle and honors the existing reduced-motion treatment.

## Error and feedback states

Because this is local demo data, data loading does not occur. The interface will still model product-ready states:

- Empty filtered lists explain that no demo records match and provide a reset action.
- A local success message confirms a status change.
- Disabled controls state why an action is unavailable when no record is selected.
- Long titles, organization names, and report details wrap or truncate safely without horizontal overflow.

## Implementation boundaries

The implementation will be contained in reusable React components and new admin-specific styles, preserving the existing landing page, design tokens, assets, and tests. It will avoid adding packages unless an existing project limitation makes one necessary.

## Verification

- Build and lint the TypeScript/Vite project.
- Run the existing test suite and add focused static/render tests for the admin route and primary content.
- Verify keyboard navigation, local filtering/status updates, empty-result behavior, and the `/admin` path in a browser.
- Inspect 375px, 768px, and 1440px layouts for page-level horizontal overflow and legibility.

