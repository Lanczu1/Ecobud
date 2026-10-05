# Admin web notifications

The web bell and Notifications page use a dedicated admin inbox. Resident/mobile notifications keep their existing pipeline. Database triggers capture review requests and content updates in the same transaction as the source change, so a rolled-back submission cannot leave a notification behind.

## Recipients and content

Admins see oversight updates across all 52 barangays. Moderators see review alerts for their assigned barangay and relevant global announcements, challenges and events. An unassigned moderator receives no inbox data. Scoping comes from the current database-backed authenticated role and barangay, including detail, read, read-all and push delivery checks. ID document access remains moderator-only; admins receive generic ID queue metadata.

Review alerts cover ID verification, challenge proofs (including final review), event attendance, pending swap listings, reported listings and reward requests. Their source workflow resolves the alert. Reading an alert changes only that user's read state. Status changes remain in history. Routine content updates cover lessons (admin-only), challenges starting/ending, announcements, event publications, schedule/location changes and withdrawal. There is no resident community-report intake or request-assignment workflow in this repository, so neither was invented for notifications.

The migration imports existing pending queues and baselines existing publications. Historical events do not generate a browser push burst. Repeated edits do not repeat publication notifications. Filtered lists use a stable date-and-ID cursor, 30 items at a time. Opening an alert displays its details; Open record filters the correct workflow to that record. Deleted records or changed access can show an empty scoped view. Announcements can open a read-only preview without granting editing access.

## Browser push

Browser push is opt-in. Enable alerts on this browser is the only permission prompt. Category preferences and quiet hours are saved per account. Quiet hours use Asia/Manila; matching start/end means quiet hours are off. Browser alerts contain generic text and an opaque inbox ID, without resident names, ID details, barangay names or report contents. Taps open the inbox after login if necessary.

Regular publications remain in-app only. Push candidates are grouped overdue review reminders, persistent delivery failures, scheduled-worker failures and event changes/withdrawals within 24 hours of the event. Review reminders default to 24 hours, configurable with ADMIN_REVIEW_REMINDER_HOURS, and are grouped by category and barangay once per Philippine calendar day. Admin reminders are consolidated across barangays. Admins default to system alerts; moderators default to no push categories until they choose them.

Subscriptions are bound to account session version and the web sign-in's 12-hour absolute lifetime. Explicit logout and local session expiry attempt server deregistration. Offline logout cannot guarantee immediate server deregistration; payloads remain generic and registration expires. Login restores an existing permitted browser subscription without prompting. Delivery rechecks current role, barangay, preferences, read state, resolution and session validity. Invalid endpoints are removed, explicit throttling/server failures are retried, and ambiguous network sends are marked uncertain instead of blindly repeated. Provider acceptance is not proof that a device displayed a notification.

## Deployment

1. Apply `apps/api/prisma/migrations/20261005000000_admin_notifications/migration.sql` through the project's reconciled Prisma migration workflow. This change is additive; it does not delete resident data. New tables use RLS and revoke public/Supabase client grants. Use a backend role that can access them; do not disable RLS to fix permissions.
2. Run `npm run db:generate` and build/restart the API and web app. The admin notification worker runs once per minute; the foreground inbox refreshes every 30 seconds and when focus/connection returns.
3. Generate one persistent VAPID pair with `npx web-push generate-vapid-keys --json` in apps/api. Store WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY and WEB_PUSH_SUBJECT in server environment configuration. The subject must be your real HTTPS contact URL or mailto address. Keep the private key server-only. The authenticated preferences endpoint exposes only the public key.
4. Serve the web app over HTTPS with `/admin-notifications-sw.js` available at its root. Localhost is suitable for browser development. Keep the root service worker free of auth tokens and avoid caching authenticated API responses.
5. In a staging browser, enable push for a test admin/moderator, select a category, and verify delivery and tap navigation with the tab closed. Test revoked permission, expired registration, reassigned barangay, logout, quiet hours, two moderators resolving the same request, and an admin ID alert without document access.

No live database migration or real provider delivery is implied by the local verification checks. The UI reports when browser push has not been configured.

## Verification

Backend checks use isolated embedded PostgreSQL and mocked providers:

```sh
cd apps/api
npx vitest run src/services/adminNotificationFixture.test.ts src/routes/adminNotificationRoutes.test.ts src/services/adminPushService.test.ts src/services/adminNotificationWorker.test.ts --maxWorkers=1
npx prisma validate
npx tsc --noEmit
```

The browser test exercises the actual web app with explicitly labeled fixture responses, without a real account:

```sh
cd apps/web
npm run dev -- --host 127.0.0.1 --port 5185
node tests/admin-notifications.cjs
npm run build
```

Set ECOBUD_PLAYWRIGHT_MODULE to an available Playwright package and ECOBUD_NOTIFICATION_SCREENSHOT to a desired screenshot path if needed.

Protocol references: [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API), [web-push library](https://github.com/web-push-libs/web-push).
