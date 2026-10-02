# Challenge streak

Completed challenge reward claims increment the lifetime challenge count once per challenge instance. Lessons, habits, events, and repeat submissions do not increment it. Multiple challenges on the same day each count.

| Completed challenges | Bonus points | Bonus eco coins | Badge |
| --- | ---: | ---: | --- |
| 3 | 30 | 0 | None |
| 10 | 100 | 5 | None |
| 30 | 300 | 15 | None |
| 100 | 1,000 | 50 | Challenge Champion |

These are the suggested initial amounts. Rewards are automatic and awarded once per milestone, in the same transaction as the challenge reward. A unique milestone record and user row lock prevent duplicate awards.

The flame unlocks at three completed challenges. Counts of zero, one, or two show the gray flame and progress toward ignition. Once unlocked, the flame turns gray exactly seven days after the latest challenge completion or restore. Inactivity never deletes the count. A completed challenge reactivates an unlocked flame. Restore changes only its active status for seven days, adds no rewards or challenges, and is limited to three uses per calendar month in Asia/Manila. Unused restores do not carry over; active retries do not consume another use.

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

## Calendar empty-state copy follow-up

Replaced the zero-count sentence with “Start your challenge streak” and a separate “Complete your first challenge.” instruction. Existing inactive counts retain their saved-count message, with singular/plural handling. The calendar center column now uses bounded flex space and centered wrapping; navigation buttons are fixed at 44px and cannot shrink.

- Hard Gate PASS for this copy/layout edit: no invented claims, no em dash, existing theme text tokens, bounded wrapping in source, and 44px navigation targets. No new controls were introduced.
- Purpose Gate PASS: the stronger headline introduces the challenge streak; the smaller second line states the next action, using the existing product typography and palette.
- Liveliness PASS: the existing calendar composition and flame identity remain; the empty-state headline is the focal point of the center column. Existing ENERGY 2 / RHYTHM 2 / MOTION 1 direction applies without adding motion.
- Craftsmanship PASS: mobile TypeScript check and Android production export passed; `git diff --check` passed. Existing month-navigation callbacks were preserved and inspected. This follow-up was verified by build and source inspection, without a new device click-through.

Calendar arrow follow-up: both 44px month buttons are anchored to the left/right edges of a full-width relative row. The center content reserves 52px on each side, so text cannot displace either arrow. Existing previous/next callbacks remain attached, with explicit accessibility labels. Purpose/Liveliness PASS: existing calendar navigation and hierarchy retained. Hard Gate/Craftsmanship PASS by source inspection and TypeScript validation; a new native-device visual check is still needed.

## Streak panel redesign and three-challenge ignition

The new panel places flame and count side by side, adds a labeled progress bar, highlights the next reward, and separates point/coin amounts from the badge label. Restore is a distinct final section. Light, dark, and onyx use the existing app theme palettes. The design read remains ENERGY 2 / RHYTHM 2 / MOTION 1: progress is the focal point; the existing flame animation communicates the unlocked state rather than adding decorative motion.

`StreakFlame` is shared by the reward panel and home cards. It mounts the existing `Fire.lottie` with autoplay and looping only when count is at least 3 and the streak is active. Counts 0–2 and expired streaks show `Unfire.png`. Server rules also enforce the threshold and disallow restoring a flame before unlocking it. No additional database migration is required; the API code change needs restart/deployment.

Runtime response validation now rejects missing or invalid milestone data before rendering. An old API response produces a readable error and reload action instead of the previous `.find` crash. A render-time guard also protects already-held invalid state.

- Hard Gate PASS: mobile TypeScript check, Android export, API build, and 31 targeted tests passed. Browser verification showed no overflow at 320px, safe handling of an old API response, working error retry, and working modal dismissal. Text uses existing theme contrast tokens; controls are at least 44px.
- Purpose Gate PASS: the tinted progress area groups flame/count/next target; only the next reward gets the accent border; numbered checkpoints identify actual thresholds and earned checks communicate actual awards. Reward rows use comparable formatting to compare quantities. No new ornamental assets or animation were added.
- Liveliness PASS: explicit 2/2/1 dials, prominent flame/count, section spacing, one theme accent, and the existing ECOBUD flame motif. The reward and restore sections have different hierarchy and composition.
- Craftsmanship PASS: light/dark/onyx verified in an explicit API fixture using the actual component and actual theme values. Count 2 stayed gray even with a stale active flag; count 3 selected the Lottie branch. Restore reactivated the flame and decreased allowance from 3 to 2; Escape dismissed the modal. Browser console reported no errors/warnings. The browser substitutes a labeled native-animation placeholder; native Lottie playback still requires device verification, while the Android bundle includes the actual asset.
# Restored unlocked overlay

## Home dashboard performance

During Home scrolling, the chatbot's optional speech bubble animation enters quiet mode so its opacity/position timers do not compete with scroll. The mascot Lottie remains playing; the bubble returns after drag/momentum ends. This temporary state changes only at scroll boundaries.

The eco point count now animates inside its own small memoized text component. Each animation frame updates that number alone instead of recalculating the full level card and rerendering its streak, progress bar, level text, and leaderboard. Level thresholds update once when the balance changes.

Home keeps its current ECOBUD composition and animations. Featured challenge selection uses a memoized linear lookup instead of copying/sorting on every render. Progress card and For You feed are memoized with stable navigation callbacks, so unrelated model updates can skip those subtrees. Main scroll offset tracking runs at 64ms instead of 16ms; native scrolling is unaffected, and tutorial positioning still records the offset. Small-screen Android Home mascot playback is restored; composition caching and hardware acceleration remain enabled.

TypeScript and whitespace checks passed. This change targets 60 FPS but does not assert a measured frame rate: release-build scrolling, reward counting, mascot dragging, and AI opening still need profiling on the intended low-end device. No animation was removed.

## Low-end rendering follow-up

The shared flame is memoized by visible status and size, with stable asset references and dimensions. Active Lottie pauses in the background and when reduced motion is enabled. Building/inactive states allocate no particle arrays or idle breathing/glow loops. Active celebration particle counts drop from 28 burst + 18 floating to 10 + 6. Tracker rewards seed from a validated dashboard summary and refresh in the background; initial fetch completion is ignored after dismissal.

- Hard Gate PASS: TypeScript and Android export succeeded, including Fire.lottie; source review preserves real reward/restore actions and all existing loading/error fallbacks.
- Purpose Gate PASS: existing screenshot design retained; fewer particles reduce animation work without removing the active celebration.
- Liveliness PASS: existing ENERGY 2 / RHYTHM 2 / MOTION 1 direction retained, with the active flame focal point.
- Craftsmanship PASS: shared flame comparison accounts for active/inactive/building accessibility labels; app-state and motion subscriptions are removed on unmount, and initial summary fetch ignores unmounted panels. No device FPS or memory measurements were taken; these are structural optimizations, not a measured performance claim.

## Screenshot reference follow-up

The user's screenshot supplies the visual direction: dark translucent full-screen background, large central flame, orange challenge-count badge, reward row, ember shower, and green gradient Keep it up button. The badge counts challenges rather than days. The reward row uses the latest awarded milestone, or explicitly labels the next milestone before any award; it never invents XP or coins. Keep it up dismisses the overlay; the secondary action opens rewards and restore.

- Hard Gate PASS: actual component browser fixture at 375×812 and 320×740 had no horizontal overflow; empty state showed a gray flame and next reward. Both buttons and repeated opening were clicked. Focus borders remain visible. Orange badge uses dark text for contrast; inactive badge uses white text. Native Lottie is represented by a labeled placeholder in the browser preview.
- Purpose Gate PASS: requested green gradient identifies the main dismissal action; orange badge connects the count to the flame. Active-only embers restore the reference celebration and stop moving when reduced motion is enabled.
- Liveliness PASS: ENERGY 2 / RHYTHM 2 / MOTION 1; central flame remains the focal point, reward spacing separates progress from actions, and the ECOBUD leaf/coin assets identify actual reward types.
- Craftsmanship PASS: challenge rules and reward amounts remain unchanged, both actions have verified behavior, content wraps and scrolls on narrow screens, and animation cleanup stops ember loops on dismissal.

The fire icon now opens `StreakUnlockedOverlay` on every tap. The automatic milestone trigger uses the same screen. Its rewards button opens the existing challenge reward and restore panel. Challenge counting, milestone amounts, inactivity, and restore limits are unchanged.

Design read: ECOBUD streak celebration for mobile users, restoring the previous dark green full-screen composition and central flame; ENERGY 2 / RHYTHM 2 / MOTION 1. The flame identifies streak status; the mint action leads to real rewards. Before three challenges and during inactivity, the title and gray flame reflect the actual state.

- Hard Gate PASS: mobile TypeScript check passed; real component browser fixture verified rewards navigation, dismissal, repeat opening, and Escape; controls have visible focus borders and 48px minimum height. ScrollView and bounded text/action widths support small screens.
- Purpose Gate PASS: dark green restores the requested celebration backdrop; one central flame communicates streak status, and the primary action opens the rewards panel.
- Liveliness PASS: declared dials, central flame focal point, structural spacing, and existing ECOBUD mint accent.
- Craftsmanship PASS: source routes icon taps and milestone triggers to the restored overlay, reward button to the existing rewards panel, and Close/Escape to dismissal. Native Lottie playback remains a device verification item; browser fixture uses an explicitly labeled placeholder.
