# Challenge streak

Completed challenge reward claims increment the lifetime challenge count once per challenge instance. Lessons, habits, events, and repeat submissions do not increment it. Multiple challenges on the same day each count.

| Completed challenges | Bonus points | Bonus eco coins | Badge |
| --- | ---: | ---: | --- |
| 3 | 30 | 0 | None |
| 10 | 100 | 5 | None |
| 30 | 300 | 15 | None |
| 100 | 1,000 | 50 | Challenge Champion |

These are the suggested initial amounts. Rewards are automatic and awarded once per milestone, in the same transaction as the challenge reward. A unique milestone record and user row lock prevent duplicate awards.

The flame turns gray exactly seven days after the latest challenge completion or restore. Inactivity never deletes the count. A completed challenge reactivates the flame. Restore changes only its active status for seven days, adds no rewards or challenges, and is limited to three uses per calendar month in Asia/Manila. Unused restores do not carry over; active retries do not consume another use.

## Migration and activation

`apps/api/prisma/migrations/20261001000100_challenge_streak/migration.sql` adds challenge activity and restore fields, plus server-managed milestone records. It converts existing streak counts to the number of completed `UserChallenge` instances and synchronizes `user_stats`. Existing points and coins are retained. Existing qualifying milestones receive their new bonuses on the next completed challenge. The milestone table follows the existing backend-only RLS pattern.

With explicit user approval, `npx prisma migrate deploy` applied the challenge streak migration to the configured Supabase database on October 1, 2026. A follow-up Prisma status check confirmed the schema is up to date. The updated API and mobile builds must be used together with this schema; no application release was published.

## Validation

- API production build passed. Prisma client generated successfully.
- Live read-only verification passed after migration: new fields readable, user/stats streak counts synchronized, summary service functional, and thresholds exactly 3/10/30/100.
- Mobile TypeScript check passed; Android production export bundled 1,331 modules successfully.
- Sixteen targeted streak and event tests passed, covering seven-day expiry, PHT month rollover, three restores, active retries, preserved count and balances, milestone amounts, one-time awards, excluded activities, badge assignment, migration/backfill, and duplicate milestone prevention.
- Full API suite: 177 passed, 1 failed. The only unrelated remaining issue is the pre-existing app-version test expecting 1.0.2 while the default config is 1.0.7. Streak/event regressions were corrected and their focused suite rerun.
- The actual `ChallengeStreakOverlay` was rendered with React Native Web and explicit test API fixtures at 320px and 375px widths. Both had no horizontal overflow. The native Lottie animation used an explicitly labeled fixture placeholder in the browser; Android export included the real `Fire.lottie` asset. Device playback was not exercised.
- Restore: count stayed 10, active state returned, allowance changed from 3 to 2, and the restore control disappeared while active.
- Close button dismissed the modal; Escape dismissed it; reopening worked. Tab and Shift+Tab reached the controls with visible focus. Controls measured 44px and 48px tall.
- Loading indicator rendered; failed fetch showed an error; Reload streak retrieved the rewards. The zero-challenge state showed the first milestone and no restore action. The exhausted-allowance state disabled restore.
- Browser console showed no warnings/errors in the verification fixture. `git diff --check` passed.

## Antislop delivery gate

- Hard Gate PASS for changed UI: real server data in production, explicit fixtures for verification, loading/empty/error states, functional controls, Escape dismissal, visible focus, minimum tap targets, no horizontal overflow at both phone widths, and no invented marketing content. Text contrast passes AA: body 9.15:1, heading 8.78:1, primary button 7.13:1, disabled button 6.02:1.
- Purpose Gate PASS: existing ECOBUD green establishes product identity; the active flame and gray flame communicate activity; milestone rows compare actual rewards without decorative cards; the modal fade marks a state transition. No added glows, patterns, or decoration-only icons.
- Liveliness PASS: ENERGY 2 / RHYTHM 2 / MOTION 1. The challenge count is the focal point, spacing separates progress/rewards/restore, green provides the deliberate accent, and the existing flame is the identity motif.
- Craftsmanship PASS for changed UI: flexible reward rows and scrolling work on narrow screens, production rewards come from the API, buttons have implemented behavior and feedback, and inactive/empty/locked/awarded/exhausted states were checked. The light modal uses the same self-contained high-contrast palette over either app theme.

Screenshots from the explicit verification fixture are saved locally under `apps/mobile/build/streak-preview/streak-mobile.jpg` and `streak-restore.jpg`.
