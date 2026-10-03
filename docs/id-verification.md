# ID verification

Residents can enter the app before ID approval. They can browse Challenges, Eco Events, and Give & Get Hub and complete all Learn activities, including reward claims. Challenge participation and recognition, event joining, and marketplace listing creation and requests require an approved ID in the database.

## Resident flow

Email OTP or Google sign-in creates an active account with a separate `not_submitted` ID status. An ID submission screen opens for accounts that have not submitted an ID. Residents can continue browsing, or submit their legal name, a government/school/barangay ID photo, and consent to review. Photos must be JPEG, PNG, or WebP and no larger than 5 MB. Settings displays the verification status; rejection includes the moderator's reason and allows resubmission.

## Moderator review

The moderator dashboard includes ID Verification. Only moderators assigned to the submission's barangay can list submissions, view private photos, or approve/reject. Admins do not have access to this queue. Reviews record the moderator, decision, reason, and timestamp. Concurrent submissions and reviews are guarded so that a resident has at most one pending submission and a review result is written once.

Results and the in-app notification are saved in one database transaction, along with email, realtime, and registered-device push deliveries. The existing notification worker delivers those jobs. Email requires the configured Gmail transport; push requires Firebase and a registered device. The app refreshes verification status on foreground, on a review notification, and every 30 seconds while active.

## Storage and rollout

- Deploy `prisma/migrations/20261003000000_id_verification/migration.sql` with the project's migration process, then regenerate Prisma Client and restart the API. Do not reset the database.
- Existing residents also begin as `not_submitted`. Their learning progress and rewards are preserved. They must submit an ID before performing the restricted actions.
- Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the API. The API creates the private `ecobud-private-ids` bucket on first use. It fails closed if the bucket is public. Do not grant anonymous or authenticated clients direct read access to this bucket; documents are served only through the authenticated moderator endpoint.
- Reviewed photos are removed after 30 days by the hourly cleanup scheduler. Status, legal name, submission history, and moderator review metadata remain. Pending photos remain available until review. Failed deletions retry on subsequent cleanup runs.
- Supported ID categories and retention are implementation defaults. Moderators must inspect the document; uploading a photo does not automatically verify identity.

## Verification

API tests cover authentication, current approval checks, moderator scope, private document responses, consent, resubmission, concurrent submission/review conflicts, transactional notifications, email content, and retention retries. A PGlite migration test verifies existing-user defaults and the unique pending-submission constraint.
