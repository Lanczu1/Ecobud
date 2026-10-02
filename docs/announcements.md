# Announcement management

The admin sidebar's Announcements entry uses the existing ECOBUD layout, Lora headings, green buttons, Tailwind tokens, authenticated API helpers, pagination and scroll lock. Styles are scoped to the new page. Existing page components and global styles are unchanged.

## Database setup

From `apps/api`, run `npm run db:migrate:deploy` against the intended database, then `npm run db:generate` and rebuild/restart the API. Review any other pending migrations before deploying. The new migration creates only the announcements table and index, references existing users, and enables RLS; direct anonymous Supabase access is not granted. The Express API uses the existing Prisma server connection.

Both `20261002000000_announcements` and `20261002010000_announcement_images` were successfully applied to the configured Supabase database. Migration status confirmed these were the only pending migrations. Client generation still encounters a locked Windows engine DLL; regenerate after the process holding it releases the file. A fresh live Prisma read was blocked by the database's session pool limit (`EMAXCONNSESSION`, maximum 15 clients), so live persistence and authenticated UI interactions remain unverified. No running processes were stopped and no sample announcements were inserted.

## Behavior

- Admins can manage all announcements. Moderators can create posts only for their assigned barangay, and manage only their own posts for that barangay. Posts authored by an admin or another moderator, including another moderator in the same barangay, are view only. Ownership and audience restrictions apply to edits, gallery updates and deletion in the API, independently of the UI. Missing/invalid moderator assignments fail closed. Residents have a separate authenticated, read-only `/api/announcements` endpoint.
- Scheduling and expiration are evaluated at read time using server time. No worker is required: a due scheduled record is returned as Published, and expired published/scheduled records are returned as Archived. The admin list refreshes every minute.
- The 52 barangay options match `apps/mobile/src/shared/constants/barangays.ts`, reproduced in the API's `announcementBarangays.ts`. The announcement list can filter by barangay; announcements for All Residents are included in every barangay filter. Moderator assignment uses the authenticated `Profile.city` field already used by ECOBUD moderation; the frontend cannot override it.
- Each announcement supports up to 10 JPEG, PNG or WebP images, up to 5 MB each. Multi-select and multi-file drop upload each file through the existing signature-validated storage pipeline. Successful uploads remain available if a later file fails. Saving retains the full ordered gallery; removing a picture affects the announcement attachment, not the underlying storage object. The first picture is the cover. Legacy single-image records are backfilled by `20261002010000_announcement_images` and retained through the `image` compatibility field. Apply this migration after the base announcement migration.
- Content supports structured Markdown, rendered as React text and elements, never raw HTML. External links require HTTPS. Internal action destinations use existing record IDs and are validated server-side.
- The preview demonstrates announcement content in mobile/desktop widths. It does not claim to reproduce an existing mobile announcement screen. Mobile app UI and navigation were not modified; consumers can use the new resident endpoint and CTA metadata.
- No existing announcement history backend was found, so no fictional activity history is displayed.

## Mobile announcement push

The announcement outbox migration `20261002020000_announcement_notifications` queues new publications and scheduled posts in the same transaction as the announcement. Existing visible announcements are baselined without sending old posts. Fan-out respects active resident accounts, publication time and barangay targeting; delivery checks visibility and audience again before sending. Important announcements use high push priority. Edits do not re-send a completed publication.

Mobile notification taps fetch the exact announcement ID with the resident endpoint's audience and expiration checks. Announcement realtime notices refresh only the announcement feed. Foreground push receipt and app resume also refresh it, with 30-second foreground polling as recovery. Existing per-session request deduplication and disk-cache startup rendering remain in use. The migration adds feed-order and barangay indexes. These changes reduce unnecessary work; actual device/network latency has not been measured.

The migration was applied to the configured Supabase database on 2026-10-02 with the new trigger disabled. Existing announcement data and unrelated schema/RLS/grants were verified unchanged; there are no pending announcement pushes. After stopping every old API worker and installing the updated API, run `node scripts/activate-announcement-push.cjs --workers-stopped`, then start only the updated workers. This enables the trigger and queues future schedules without modifying announcement/resident records or resending existing visible posts. See `announcement-push-deployment.md` and `announcement-push-migration-audit.json`. Firebase configuration, native Android release and physical-device testing remain part of deployment.

## Verification

`npx vitest run src/routes/announcementRoutes.test.ts` passes 10 tests covering permissions, trusted authorship, moderator ownership and barangay restrictions, gallery validation, the 52 barangay registry, published deletion confirmation, resident scope, invalid scheduling/CTA data and exact publish/expiration boundaries.

Web TypeScript and page ESLint checks pass. The Vite production build passes with a separate output directory because existing build artifacts are locked. API `tsc --noEmit` passes. The database migrations have been applied; live persistence and authenticated browser interactions remain unverified because of the session pool limit and lack of an authenticated browser session.
