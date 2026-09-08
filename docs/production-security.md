# Production security and release procedure

This hardening change is not a penetration-test certificate or a 10/10 security rating. Do not treat a passing dependency audit as proof that every vulnerability is absent.

## Release changes

- Google login now requires `accessToken`, the Supabase OAuth session token. The server asks the configured Supabase Auth project to verify it and checks a confirmed Google identity. Email-only login is rejected. Admin/moderator Google login is denied. Automatic linking of an existing password account is restricted to verified Gmail identities; other existing accounts use password login.
- Access JWTs have a dedicated audience, issuer, algorithm allowlist, one-hour expiry and database session version. Old tokens are invalid after this deployment. Password/email changes and `POST /api/users/me/logout-all` revoke all previous access sessions. Mobile security updates persist the replacement token.
- Email changes require a current password and a code delivered to the new address. Use `POST /api/users/me/email-code` with `currentPassword` and `newEmail`, then `PATCH /api/users/me/security` with those fields and `emailCode`. Codes expire after ten minutes and have five attempts. Profile preferences cannot change email or privileged account jurisdiction.
- Registration codes are stored as keyed hashes and consumed once. Existing plaintext codes become invalid; users must request a new code. Mail delivery failure returns 503.
- Uploaded media has size/type/signature checks; temporary files are outside the public directory and cleaned up. Signature checks are not malware scanning or complete media decoding.
- Challenge submissions require signed AI results for AI challenges and reject reuse of a submitted proof URL within a serializable transaction.
- API rate limiting, restricted CORS, response headers, sensitive-response no-store caching and security-response logging are enabled. Dependency overrides patch qs and ExcelJS's UUID dependency; report serialization has a regression test.
- Reviewer responses select only public fields; a JSON response safeguard removes password hashes, passwords and external identity IDs from nested relations.

## Before serving traffic

1. Back up the database and verify a restore in staging. Review and apply `20260908000000_security_sessions` using `npm run db:migrate:deploy` against the intended database. This change adds user session versions, Google identity IDs, and OTP attempt counts. No migration or seed was executed against your database during the source hardening work.
2. In `apps/api`, install the locked dependencies with `npm ci`, run `npm run check:release`, then `npm run build`. `npm start` explicitly enables production safety checks. Use `npm run dev` only for local development.
3. Supply a fresh randomly generated JWT_SECRET (at least 32 characters), exact HTTPS CORS_ORIGINS, DATABASE_URL, DIRECT_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GMAIL_USER and GMAIL_PASS. Keep server credentials out of mobile/web builds. Review old seeded admin/moderator accounts and replace their passwords or remove unused accounts. The demo seed is destructive and is now forbidden in production.
4. Configure TLS at the reverse proxy, restrict direct API ingress, and set TRUST_PROXY to only that proxy's real addresses/subnets. Verify HTTPS, forwarded-client-IP handling and 429 responses from the deployed service. Never use a blanket trust-proxy setting.
5. Deploy the updated mobile client with the backend. Existing clients cannot use email-only Google login. Users sign in again after one hour; there is no refresh-token flow. Test real Google OAuth callbacks, SMTP delivery, email change, password change and logout-all in staging.
6. Use one API instance for the current in-memory IP/login limiters, or add a shared limiter/edge enforcement before horizontal scaling. Verify quotas for uploads, transcription and AI requests. Do not assume per-process limits protect a multi-instance deployment.
7. Inspect Supabase RLS, realtime authorization, bucket policies, database least privilege and backups in the actual project. The existing media bucket is public: only intentionally public content belongs there. Move confidential evidence to private storage and signed URLs if the product requires it.
8. Forward structured security_response logs to your monitoring service. Configure and test alerts for spikes in 401/403/429/5xx, failed logins, privileged changes and abnormal resource use. Local logging alone does not supply alerting or tamper-resistant retention.
9. Run independent authenticated security testing for object ownership, moderator jurisdiction, rewards/concurrency, uploads, and public data exposure. Verify Android release signing and mobile token storage before distributing a production app.

The deployed TLS, proxy, database/Supabase permissions, credential rotation, backups, alert delivery and real OAuth/SMTP flows require environment verification; they cannot be established from repository code alone.
