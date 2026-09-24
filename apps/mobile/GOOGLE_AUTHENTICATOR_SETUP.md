# Google Authenticator setup plan

## Goal

Add optional two-factor authentication (2FA) to the mobile account security settings using time-based one-time passwords (TOTP). This works with Google Authenticator and compatible authenticator apps. It is separate from the existing **Continue with Google** OAuth sign-in button.

This document records the implementation design and current behavior for 2FA.

## Current state

- Mobile **Privacy & Settings** is `SettingsOverlay` in `src/app/components/AppOverlays.tsx`. It has email/password controls, appearance, legal documents, and notifications.
- Mobile sign-in calls `/auth/login` or `/auth/google`; Google sign-in completes the provider flow before the app receives an ECOBUD API session.
- The API `User` model now stores an encrypted authenticator secret and enabled state. Recovery codes and login challenges are stored separately.
- The API provides enrollment, confirmation, recovery-code rotation, disable, and sign-in verification endpoints.
- TOTP uses Node's built-in crypto. Enrollment displays a QR code generated locally from the `otpauth://` URI, with a manual setup key as a fallback; no QR service receives the secret.

## Recommended user experience

Add an **Authenticator app** section to the **Privacy & Settings** screen:

1. Show the current state: **Off** or **On**.
2. When off, **Set up authenticator app** starts enrollment. Explain that any TOTP-compatible authenticator app can be used.
3. The server creates a pending enrollment secret and returns an `otpauth://` URI, a manual entry key, and a short-lived enrollment identifier. The app renders the URI as a local QR code. The user can scan it or enter the manual key; do not activate 2FA yet.
4. Ask the user to enter the current six-digit code from their authenticator app. The server verifies it before enabling 2FA.
5. After successful verification, show one-time recovery codes. Require the user to save or acknowledge them before leaving the screen; show them only once and do not log or persist them on the device.
6. When on, replace recovery codes after a valid authenticator code, or turn off after a valid authenticator or unused recovery code. Replacing codes invalidates all previous codes.

Use the project’s existing theme, `SurfaceCard`, form fields, keyboard handling, and loading/error patterns. Keep the manual setup key and code entry within the current Settings overlay; avoid adding a separate navigation route.

## Sign-in flow

Apply the second factor to both password and Google OAuth account sign-ins. The Google OAuth provider proves the user’s Google identity; the TOTP step proves possession of the separately enrolled authenticator.

1. `/auth/login` verifies the password as it does today. If 2FA is enabled, return a short-lived, single-use sign-in challenge and do not issue the normal ECOBUD session yet.
2. `/auth/google` verifies the Google identity as it does today. If the matched ECOBUD account has 2FA enabled, return the same kind of challenge and withhold the ECOBUD session.
3. Mobile stores the challenge only in transient component/hook state, displays a six-digit code prompt, and calls the verification endpoint. On success it continues the existing session persistence and hydration path.
4. Offer a recovery-code option in the same prompt. A successful recovery code is consumed and cannot be used again.
5. Keep new Google-account enrollment and existing barangay onboarding intact. A new user with no existing 2FA receives the normal onboarding flow.

Use an explicit response discriminator such as `{ mfaRequired: true, challengeToken, expiresAt }` so existing successful login responses remain distinguishable. Define and validate a shared mobile/API type before changing login UI behavior.

## API and storage work

Implement these authenticated routes under the existing user API, plus the sign-in verification endpoint:

- `POST /users/me/mfa/totp/enroll` — create a pending secret and return enrollment id, `otpauth://` URI, and manual key. Require a session created within the previous 10 minutes (sign in again to refresh it).
- `POST /users/me/mfa/totp/confirm` — verify the first TOTP code and enable 2FA. Return recovery codes once.
- `POST /users/me/mfa/disable` — verify reauthentication and the current factor before disabling; invalidate pending enrollment and recovery codes.
- `POST /users/me/mfa/recovery-codes/rotate` — verify the current factor and issue a replacement set.
- `POST /auth/mfa/verify` — exchange a short-lived login challenge for the regular ECOBUD session after verifying a TOTP or unused recovery code.

Storage/security requirements:

- Add nullable encrypted TOTP secret and enabled timestamp to `User`; keep a pending enrollment secret separate or in an expiring enrollment record.
- Encrypt TOTP secrets at rest with a server-only key from environment/secret management. Never return a stored secret after enrollment is confirmed.
- Store recovery code hashes only. Generate high-entropy codes and atomically consume each one once.
- Sign MFA challenges with a distinct JWT audience/type, a short expiry (about five minutes), and a one-use server-side identifier. Never accept a challenge token as an API access token.
- Rate-limit enrollment confirmation, sign-in code checks, disable, and recovery-code attempts. Apply account lockout consistently without leaking whether an account exists or has MFA enabled.
- Keep TOTP validation window narrow (current time step plus at most one adjacent step), use constant-time comparisons where applicable, and prevent replay of a successfully used time step.
- Ensure auth responses, analytics, error messages, and logs never include TOTP secrets, QR payloads, raw recovery codes, or entered OTPs.

The implementation uses Node crypto for RFC 6238 TOTP and AES-256-GCM encryption. Configure and back up a server-only `TOTP_ENCRYPTION_KEY` in production before running the migration or enabling enrollment.

## Mobile implementation files

- `apps/mobile/src/app/components/AppOverlays.tsx` — locally generated setup QR, manual setup key, code confirmation, recovery codes, and disable controls in `SettingsOverlay`.
- `apps/mobile/src/app/hooks/useHomeDashboard.ts` — authenticated API actions and challenge continuation while preserving current session/hydration behavior.
- `apps/mobile/src/app/types/home.ts` — model action and enrollment/status types.
- `apps/mobile/src/shared/api/ecobudApi.ts` and `apps/mobile/src/app/services/homeService.ts` — typed API calls.
- `apps/mobile/src/shared/ui/LegalDocumentModal.tsx` — update the privacy copy to explain authenticator secret and recovery-code processing/storage.
- API: `apps/api/src/routes/authRoutes.ts`, `apps/api/src/routes/userRoutes.ts`, `apps/api/src/security/totp.ts`, `apps/api/src/security/tokenService.ts`, `apps/api/prisma/schema.prisma`, and the mobile TOTP migration.
- `apps/mobile/src/features/auth/AuthView.tsx` (and the parent auth flow) — show the challenge verification step for both password and Google sign-in without starting onboarding before the factor succeeds.

## Acceptance checks

### Enrollment and account settings

- Enrollment works after a recent password or Google sign-in (session age at most 10 minutes).
- Invalid, expired, and replayed codes do not enable or disable 2FA.
- Confirming a valid code enables 2FA and returns a finite one-time recovery-code set.
- Recovery-code rotation invalidates every old code. Each new code works once only.
- Disable requires a current authenticator or unused recovery code; canceling enrollment leaves 2FA off.
- Closing or reopening Settings never reveals the secret again.

### Sign-in and compatibility

- Password and Google OAuth sign-in both require a second factor when enabled and issue no full ECOBUD token before verification.
- TOTP and recovery-code sign-in each work; expired challenges and reused recovery codes fail safely.
- Existing accounts without 2FA and new Google sign-ups retain their current login/onboarding behavior.
- Existing refresh, offline fallback, session persistence, and logout behavior remain intact.
- Challenge tokens cannot access ordinary authenticated endpoints.

### Quality and rollout

- Unit tests cover TOTP vectors, time-window boundaries, replay protection, recovery-code consumption, expiry, and challenge token audience.
- API tests cover enrollment, password login, Google login, verification, rate limits, and unauthorized access.
- Mobile checks cover manual-key setup, invalid/valid code, recovery display, theme/layout, keyboard, cancellation, and both login entry points.
- Run API migration validation/build/tests and mobile TypeScript checks. Verify a staged database backup and server encryption key are configured before enabling in production.
- Release behind a server feature flag or staged rollout; monitor enrollment completion, failed verification rates, and support requests without logging OTP material.

## Dependencies and unresolved setup choices

- Confirm the server has a secure secret-management location for the TOTP encryption key and define key rotation/backup handling.
- The implementation issues 10 one-time recovery codes and revokes other sessions after enabling or disabling 2FA.

## Implementation order after setup approval

1. Configure and back up `TOTP_ENCRYPTION_KEY` in each production server environment.
2. Apply the Prisma migration to each target database.
3. Run API security tests and verify password and Google MFA flows against a staged deployment.
4. Validate enrollment, recovery, and sign-in on Android and iOS release builds.
