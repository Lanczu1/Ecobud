# Give & Get moderation access

Administrators can open the Hub and manage listings from every barangay. Moderators can view and manage listings only when the owner's current resident profile matches their assigned barangay. Listing city and meetup location do not grant moderation access.

The same scope applies to listing search, notification record links, pagination totals, statistics, report history, approval, rejection, reporting, deletion, and the older item endpoints. Moderator accounts without a valid assigned barangay receive HTTP 403. Out-of-scope record actions receive HTTP 404.

## Verification

- PASS: 82 Give & Get access tests, including all 52 barangay scopes, resident-versus-meetup location, administrator access, moderator actions, cross-barangay denial, and authentication checks.
- PASS: 139 tests when run together with challenge access regression tests.
- PASS: API TypeScript check (`npx tsc --noEmit`).
- PASS: web production build (`npm run build`).

The HTTP tests use mocked persistence and notification services. No live records were approved, rejected, reported, or deleted. Authenticated browser click-through was not performed.

## Antislop delivery gate for the changed interface

- Hard Gate PASS (source review and build): the existing Hub navigation now resolves for administrators; no new controls, assets, statistics, or fabricated content were introduced. Existing action handlers continue to call real endpoints, exercised by the HTTP tests above.
- Purpose Gate PASS: the subtitle identifies the accessible resident scope using the API response. It helps moderators understand which listings they can manage.
- Liveliness PASS: ENERGY 1 / RHYTHM 1 / MOTION 1. The existing EcoBud layout, typography, spacing, and green identity are retained; this change adds access behavior and a scope description.
- Craftsmanship and Quality Locks PASS within the changed scope: web compilation succeeds; the access checks cover both allowed and denied actions. Sidebar navigation, hash routing, approval, rejection, deletion, and report handlers were reviewed in source. Browser interaction, visual contrast, responsive layout, and theme behavior were not independently retested.
