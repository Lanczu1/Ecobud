# Barangay reports

Moderators can open barangay Reports in the admin sidebar. The server reads their current profile barangay from the authenticated session and limits JSON, PDF, and Excel requests to that barangay. Invalid or missing assignments fail with 403. Requests for another barangay or all barangays also fail with 403. Admins see the original Reports & Analytics page. The barangay report API still allows admins to query any of the 52 barangays or all barangays.

## Page order

1. Barangay Overview
2. Announcements
3. Challenges
4. Events
5. Learning Progress
6. Rewards & Badges
7. Give & Get
8. Redeem Requests

## Endpoints

- `GET /api/admin/reports/barangay`
- `GET /api/admin/reports/barangay/pdf`
- `GET /api/admin/reports/barangay/excel`

The endpoints accept `from` and `to` as inclusive YYYY-MM-DD dates in Asia/Manila, with a maximum of 366 days. They default to the current month through today. Only admins can request `barangay=all` or another barangay. PDF and Excel use the same aggregation and scope as the page.

Existing `/api/reports/events/:id` JSON, PDF, and Excel endpoints also check the event's assigned barangay for moderators. Admins can access any event. These individual event reports include the event's participants, including residents from other barangays who registered for that event.

## Metric definitions

- Registered residents is a current count of user-role accounts. Other resident metrics use the resident's current profile barangay, not historical addresses.
- New registrations use account creation dates. Activity uses the account's last recorded action date, not a historical daily-active-users series.
- Challenge submission metrics use submission creation dates and current review status. Completions use completion dates.
- Events use the event's assigned barangay. Counts include all participants; registrations, attendance, and pending proofs use their respective timestamps.
- Lesson completions, badge awards, and positive reward ledger credits use completion/award dates. Spending is excluded from awarded coins.
- Listings and redeem requests use creation dates with current status. Completed swaps involve at least one resident in scope and use the last update date.
- Published announcements include all-resident announcements and announcements targeted to the selected barangay. Publication dates fall within the report period. Details list the latest 20; the count includes all matches. Drafts and future scheduled announcements are excluded.

No schema migration is required.

## Verification

API and web production builds passed. Report tests cover every barangay, missing assignments, scope tampering in all three formats, PHT day boundaries, invalid dates, aggregate scope, admin filtering, event-report access, PDF generation, Excel workbook contents, and a PGlite database join for redeem-request isolation.

The isolated `/tests/barangay-reports.html` fixture renders the actual Reports component with explicit test data. Browser checks covered section order, filters, exports, admin selection and System Overview, retry recovery, empty state, and a 375px dark layout without horizontal overflow. No live resident data or production database changes were used for these checks.
