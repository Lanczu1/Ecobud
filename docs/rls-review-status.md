# RLS compatibility review — 8 September 2026

## Scope and current evidence

The user reports enabling RLS on all application tables since the previous inspection. Do not treat earlier findings of disabled RLS as the current state. No RLS policies, grants, migrations, records or credentials were changed during this review.

The new metadata-only inspection requires verified TLS and failed before querying PostgreSQL with SELF_SIGNED_CERT_IN_CHAIN, including with the OS trust store. This is a client trust-chain failure, not evidence that RLS is disabled or that PostgreSQL lacks TLS. The earlier pg inspection used a non-TLS connection; that result did not establish how every Prisma or production connection behaves.

To complete the live review, either supply the public database CA certificate downloaded from the Supabase dashboard (not a private key), or run `review-supabase-readonly.sql` in the dashboard SQL Editor and share the metadata result. For the local inspector, set SUPABASE_DB_CA_FILE to the downloaded certificate's path. Do not disable certificate verification.

## Access paths established from source

| Component | Access path | Compatibility consideration |
| --- | --- | --- |
| App data | Express routes → Prisma → PostgreSQL DATABASE_URL | The database sees the backend login role, not the mobile user's JWT. Establish privileges/policies for a dedicated backend role before switching away from an owner/bypass role. |
| User identity | ECOBUD users have CUID IDs; Google OAuth is verified through Supabase Auth | A blanket auth.uid() = userId policy is not compatible with these IDs or the current Prisma request context. |
| Client realtime | Supabase Broadcast channels | No postgres_changes subscription or direct application-table .from() query was found in the searched web/mobile source. Broadcast channel authorization is a separate review; public-table RLS does not automatically secure it. |
| Media | Server service-role Storage client; public media URLs | Do not change storage.objects policies or bucket visibility as part of an unrelated public-table grant change. Test any intentional media privacy change separately. |
| Google sign-in | Supabase Auth getUser and client OAuth exchange | Public application-table grants are distinct from Supabase Auth permissions. Do not revoke access across auth/storage/realtime schemas indiscriminately. |

This source inventory does not rule out external integrations, other deployed app versions or manual jobs using direct table access.

## Safe order for changes after metadata review

1. Inspect actual policy predicates, policy roles, effective/inherited grants, privileged functions, views and default privileges. RLS enabled alone is neither proof of safe access nor proof that users are blocked. RLS does not govern operations such as TRUNCATE; grants must be assessed separately.
2. Confirm whether this is a live database, identify deployed API/mobile versions and external integrations, and verify a restorable backup. Test with existing regular and privileged test accounts in a staging copy.
3. Compare existing schema against the full migration chain. If migration history is absent, establish a verified baseline rather than reset the database or mark missing schema as applied. Add only missing security columns after checking their definitions and migration state.
4. Create and test a dedicated backend role with intended grants/policies before switching DATABASE_URL. Verify register/login, profile reads/updates, lesson progress, submissions, moderation, rewards, swaps and notifications. Test rejection of unauthorized access as well as successful access.
5. Restrict anon/authenticated table grants only after confirming no legitimate direct Data API clients need them. Preserve any explicitly required public reads. Never expose password/OTP/role/reward fields through broad self-service policies.
6. Apply one verified change at a time during an appropriate change window. Keep the previous configuration and schema/policy definitions available for rollback. Do not remove new restrictions blindly to recover from a test failure.

`deploy/restrict-supabase-tables.sql` remains an unapplied proposal, not a compatibility-approved migration. Do not execute it before checking the current metadata and consumers.

The session-version migration is additive but the accompanying JWT audience/expiry change intentionally requires existing sessions to sign in again. Do not promise uninterrupted sessions when deploying that authentication change. Existing mobile versions must also be checked for compatibility with the newly required Google access token.
