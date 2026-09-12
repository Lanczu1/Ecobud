# ECOBUD notifications

## Implementation and rollout

The additive migration `20260908010000_notifications` extends the existing notifications table, preserves old records and policies, and adds durable publication events, device registrations, and delivery jobs. Apply this migration before running the new API. New tables are backend-only with RLS enabled and direct Supabase client grants revoked. The existing ECOBUD JWT middleware scopes all notification queries to the authenticated CUID user ID; Supabase auth.uid() is not substituted for that ID.

Review the live database baseline, role privileges and existing notifications RLS policies as described in `rls-review-status.md` before deployment. The migration and tests here have NOT been applied to the remote database. Test with the actual backend database role in staging; it must be able to insert and process outbox jobs. Do not disable RLS to resolve a permission error.

1. With the existing migration baseline reconciled, run `npm run db:migrate:deploy` and `npm run db:generate` in apps/api.
2. Configure the existing GMAIL_USER and GMAIL_PASS. Set ECOBUD_WELCOME_URL to your HTTPS onboarding URL or `ecobud://`. SMTP credentials and the verification-code template are reused/preserved, respectively; the welcome template is separate.
3. Configure the API with `FIREBASE_PROJECT_ID` and one server-only credential source: `FIREBASE_SERVICE_ACCOUNT_PATH` (recommended), `FIREBASE_SERVICE_ACCOUNT_JSON`, or `FIREBASE_SERVICE_ACCOUNT_BASE64`. Never bundle an Admin service account in the mobile app or commit it.
4. Keep the Android Firebase client configuration at `apps/mobile/google-services.json`, then rebuild the native app with `expo-notifications`. Native Android registers its FCM device token directly; Expo Go and web still support the in-app inbox but do not register remote push tokens.
5. Restart the API. Its notification worker runs every ten seconds. Keep at least one API instance running. Multiple workers claim disjoint jobs using PostgreSQL row locks.
6. Run the staging acceptance checks below before enabling production traffic.

## Behavior

Only admins can create/update/publish Learn, Challenge and Eco Event content. Moderation endpoints retain their existing permissions. Lessons use their existing publishing scheduler. Challenges wait until startDate, and inactive/expired challenges do not fan out. Events now support a published checkbox, with existing events retaining their previous visibility. Edits and visibility toggles do not generate another publication for an already announced content ID; an explicit repeat campaign is intentionally not exposed.

Successful OTP registration and verified Google account creation add a verified_at marker to the new user insertion. The existing validation, code generation, expiry, OTP email and authentication responses are unchanged. The database trigger creates one welcome event only for a new, verified, active member; admin-created active accounts and later unblocking do not qualify. Old accounts are not retroactively emailed.

Publication events and content changes commit together. Fan-out runs in resumable pages of 200 active members, excluding users created after the publication visibility time. Notifications and delivery jobs commit together, with unique keys for each user/event and each notification/channel/destination. Devices are bound to a user and session version; revocation, account suspension and token invalidation suppress sending. Registration retries on foregrounding and token changes. Logout attempts to deregister the device; offline logout cannot immediately revoke a server registration, so push payloads contain no account data.

The mobile inbox supports all ten categories, compact filters, read state, timestamps, pagination, exact Learn/Challenge/Event destinations and push taps on warm/cold launch. Swap/chat targets use their existing listing/conversation views when a related ID is supplied. Reward and leaderboard notifications open their existing screens. Category preferences can be added at fan-out without changing the delivery pipeline.

## Delivery guarantees and operations

Database notification creation is idempotent. Gmail SMTP and Firebase Cloud Messaging do not provide an end-to-end exactly-once delivery guarantee. The worker retries explicit Firebase throttling/server failures and safe SMTP pre-acceptance failures. After ambiguous network failures or a process crash during sending, it marks delivery `uncertain` instead of risking a duplicate. A stable SMTP Message-ID is included, but is not claimed to guarantee recipient deduplication. This means an ambiguous delivery may require operator investigation and cannot be advertised as guaranteed delivery.

Firebase message IDs are saved after accepted sends. Invalid or unregistered FCM tokens are removed, transient Firebase quota/server failures are retried, and permanent rejections are logged as failed. In-app records remain available regardless of push delivery state. Realtime notices reuse the existing user channel; foreground polling recovers missed realtime events.

Monitor `notification_worker_failed`, `notification_delivery_failed` and `notification_delivery_rejected`. Inspect counts grouped by state in notification_deliveries and incomplete notification_events. Jobs stop automatic retry after 20 attempts; investigate those alongside failed/uncertain jobs. Never reset uncertain push/email jobs to pending without reconciling provider evidence, since the first attempt may have succeeded. The worker logs delivery IDs and error classifications, not credentials, email addresses or device tokens.

## Verification

Automated tests use an isolated embedded PostgreSQL instance; no live account or email is used. They execute the migration and exercise drafts, publication edits/retries, transaction rollback, legacy preservation, scheduled challenges, verified-user eligibility, unique constraints, and backend-only table grants. API tests verify user ownership, read-all isolation and validation. Provider mocks verify invalid tokens, ticket persistence, receipt polling, revocation, throttling and payload privacy. The full existing API suite also covers authentication regressions.

Run `npx vitest run --maxWorkers=1` in apps/api. Run API/mobile TypeScript checks and the web TypeScript build. A default parallel run timed out once in the existing chat rate-limit test; the serial run passed.

Required live staging acceptance remains:
- Register a test account and compare the unchanged OTP email; wrong/expired codes must behave as before. Verify successfully and receive one separate welcome email; repeat registration/verification must not create another welcome event.
- Save drafts and publish Learn, Challenge and Eco Event content. Confirm one record per eligible user, actual device push receipt, inbox update and exact navigation. Repeat publish requests and edit content; confirm no duplicates.
- Exercise two member accounts for list/get/read/read-all isolation, and a non-admin account for denied publishing. Verify direct Supabase table access against the actual deployed policies.
- Disable push permission, revoke a session and use an invalid token. Confirm publishing still succeeds, records remain, and invalid tokens are removed.
- Confirm background, terminated and foreground push taps on a physical Android device, including cold login and deleted content destinations. Add Firebase Messaging native integration before enabling direct FCM registration on iOS.

References: Firebase Admin FCM delivery: https://firebase.google.com/docs/cloud-messaging/send/admin-sdk ; Expo native device tokens: https://docs.expo.dev/push-notifications/sending-notifications-custom/ .
