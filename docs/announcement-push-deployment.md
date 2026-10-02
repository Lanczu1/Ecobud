# Announcement push: Supabase migration and API activation

The configured Supabase database was migrated on 2026-10-02. Only
20261002020000_announcement_notifications was applied.

Verified after migration:
- Existing announcement data is unchanged (one record, matching before/after fingerprint).
- Unrelated columns, constraints, indexes, triggers, functions, RLS policies and table grants are unchanged.
- Earlier Prisma migration history is unchanged.
- Three scoped indexes are installed.
- The new notification_announcement trigger is disabled.
- Zero pending announcement push events were created.
- The applied migration checksum matches the source file.

See announcement-push-migration-audit.json for the verification hashes.

## Important for deployment

Use the UPDATED bundle/source. The earlier ZIP contained the original migration,
which enabled push immediately. This migration was revised before applying it so
it installs dormant safely while the older API is still running. Keep this revised
migration file; do not replace it with the older ZIP's file.

The new trigger must be activated after every OLD API worker has been stopped.
Older workers do not enforce announcement barangay targeting.

Assuming the existing systemd service and /opt/ecobud repository:

```sh
sudo systemctl stop ecobud-api
# Install/extract the updated API source and build in your repository.
cd /opt/ecobud/apps/api
npm ci
npm run db:generate
npm run build
npx prisma migrate status
# With DATABASE_URL / DIRECT_URL available through your existing deployment environment:
node scripts/activate-announcement-push.cjs --workers-stopped
sudo systemctl start ecobud-api
sudo systemctl status ecobud-api --no-pager
sudo journalctl -u ecobud-api -n 100 --no-pager
```

Stop every API instance if there is more than one. Adapt the path and commands for
PM2 or another process manager. A systemd EnvironmentFile is not automatically
loaded into the shell used for npm/Prisma commands.

Migration status should now report that the database is up to date. No database
reset, seeding or replay of historical migrations is needed.

The activation command enables the trigger, baselines announcements published
while it was disabled, and queues existing FUTURE schedules that have not already
been notified. It does not change any announcement or resident record. It writes
only announcement entries in the existing notification_events outbox. Older visible
announcements are not resent.

Keep existing production environment, Firebase service-account credentials,
google-services.json, native Android project, assets and signing configuration.
The bundle excludes .env, private keys, service-account credentials, node_modules
and APKs. The generated Prisma client is platform-specific: generate it on the server.

Firebase requires FIREBASE_PROJECT_ID and one of FIREBASE_SERVICE_ACCOUNT_PATH,
FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_BASE64.

Build/install the updated native Android app for the new announcement inbox
category and exact announcement navigation. Expo Go/web do not register native
FCM tokens. Use the existing Android/EAS release process; source is included.

## Validate after deployment

Publish a NEW announcement and test on a physical Android phone:
- All Residents receives it.
- A barangay-targeted announcement reaches only eligible residents.
- Scheduled announcement sends when due.
- Push tap opens the exact announcement.
- Edits do not duplicate delivery.
- Deleted/archived/expired posts do not send pending pushes.

The database preparation is complete; the hosted API deployment, trigger activation
and physical-device delivery test still belong to the deployment step.

