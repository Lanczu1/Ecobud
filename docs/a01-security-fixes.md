# A01 access-control changes — 5 November 2026

## Application changes

- Challenge deletion is restricted to administrators, matching the existing update restriction. Moderator challenge creation remains available.
- New challenge image uploads use user-scoped random draft paths. Moderator cleanup accepts only the caller's draft path and rejects images referenced by saved challenges. Administrators retain cleanup access to validated media locations.
- Cleanup validates the configured Supabase origin and media bucket. Local paths must remain under uploads; traversal, encoded separators, invalid encodings and arbitrary filesystem paths are rejected. Storage service deletion uses the same validation.
- Mobile notifications, refresh signals and exchange events now use an authenticated API event stream. The user scope comes from the verified session. The stream checks account status, role, token expiry and session version before sending events and on heartbeats. Connections and queued work are bounded and cleaned up on disconnect.
- Administrator streams also recheck account/session authorization. Resident streams never receive administrator events. Global resident signals omit actor and entity identifiers.
- Server Supabase broadcasts use private channels. The session endpoint no longer discloses direct channel names. Mobile presence continues through the authenticated presence API; the public presence tracker is removed.

## Live database change

Applied through the Supabase connector to the project matching local configuration: `revoke_public_client_truncate`.

The SQL in `deploy/revoke-client-truncate.sql.example` only revokes TRUNCATE privileges from public client roles and removes those default grants for future tables created by postgres. It does not execute TRUNCATE, DELETE, DROP, a seed, or a reset. Existing row-level policies and normal application CRUD grants are unchanged.

Post-change inspection: 55 public-schema tables, 55 with RLS enabled, zero tables granting TRUNCATE to anon or authenticated. The inspected counts remained 71 users, 3 challenges, 7 ID submissions and 2 buckets. The migration did not modify application rows or storage objects.

The managed supabase_admin role has separate future-table default grants. The connected postgres role cannot administer those defaults; new managed-role tables require a grant review. The current-table revocation covers existing tables regardless of creator.

## Validation and deployment

Security regressions cover resident/admin separation, ID barangay scope, media ownership and path validation, private publishing, recipient isolation, revoked streams, disconnect cleanup and connection limits. Database permission SQL was also executed against an isolated PGlite database: rows and SELECT grants were preserved and future postgres-created tables did not inherit client TRUNCATE grants.

A read-only live subscription check confirmed anonymous public-channel subscription and explicit denial for the corresponding private channel. No test broadcast, presence write, file removal or application record modification was performed against Supabase.

Deploy the API and updated mobile client together. Older mobile clients cannot consume the new authenticated stream and will rely on their existing polling behavior. The stream relay runs within one API process, consistent with the current single-instance deployment requirement; a shared authenticated event transport is required before scaling to multiple workers. Configure the reverse proxy to allow unbuffered event streams and verify actual device reconnects, background transitions and session revocation after deployment.

The full API suite also exposes two failures in the committed streak-expiry baseline, involving one- and two-challenge timer expectations. Their source files were not changed by this security work.
