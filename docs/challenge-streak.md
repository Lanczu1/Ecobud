# Challenge streak

## Current rule: timer starts on the first completion

The first eligible completed challenge reward claim now ignites the flame and starts a seven-day timer. One or two completed challenges no longer wait for the third completion. Only a zero-challenge account shows Streak timer not started. Later eligible completions refresh the timer to seven days. When the timer expires, the flame becomes inactive and the lifetime challenge count remains saved.

Existing one/two-challenge accounts use their persisted latest completion or restore timestamp. An upgrade does not restart the clock or modify user records. Restore is available after the first completion when inactive, with the existing three-use monthly limit. Bonus milestones remain 3, 10, 30, and 100 challenges; starting the timer at one does not award the three-challenge bonus.

Yellow warnings remain active above 24 and up to 48 hours remaining. Red warnings apply at 24 hours or less. Both push stages now include residents with one or two completed challenges, with separate deduplication keys as before. The existing daytime delivery window and active-challenge requirement are retained.

- Hard Gate PASS: 53 streak/countdown/reminder tests passed, along with API/mobile TypeScript checks and Android export. Tests cover first/second-completion activation, exact seven-day expiry, restore at counts one and two, monthly restore limits, unchanged milestones, both push stages, and duplicate prevention.
- Purpose Gate PASS: Home, Tracker, calendar, reward panel, flame accessibility labels, and celebration copy consistently reflect first-completion activation. The calendar and flame no longer imply that one/two challenges are locked.
- Liveliness PASS: existing EcoBud countdown design and ENERGY 1 / RHYTHM 2 / MOTION 1 retained, including yellow/red urgency palettes and the isolated live countdown.
- Craftsmanship PASS for this scope: actual-component browser fixtures showed an active flame/countdown at one challenge, yellow at 48 hours and red at 24 hours for that account, inactive saved progress after expiry at two challenges, and the not-started state only at zero. Restore at one reactivated the flame/countdown while the next bonus stayed at three challenges. The first completion also triggers the existing queued streak celebration. Browser fixtures substitute labeled native flame/audio; push tests use mocked delivery, and no live device installation or push was performed.

Preview: `apps/mobile/build/streak-expiry-preview/first-challenge-active.png`.

Earlier three-challenge ignition references in the UI iteration history below describe the previous behavior. The current timer start threshold is one completed challenge.

## Expiry warning in the mobile UI

### Countdown and locked-state redesign

The status panels now use a shared header, palette, action, and countdown layout. Active streaks show a days-remaining label above separate hours, minutes, and seconds blocks. The countdown reads the API expiry timestamp, updates each second only while its screen is active, and cleans up its interval when hidden or unmounted. These updates stay inside the countdown component. The screen-level status retains its slower refresh and schedules exact updates at the 48-hour, 24-hour, and expiry boundaries.

Before ignition, the panel says Streak timer not started, highlights how many challenges remain, and shows three progress segments with the real completed count. It shows no countdown before the timer starts. Sync and inactive states retain their implemented actions and explanations. All panels still use View challenges to open the existing Challenges tab.

Design read: existing EcoBud mobile activity status, ENERGY 1 / RHYTHM 2 / MOTION 1. The countdown is the active-state focal point; three progress segments explain the actual three-challenge threshold. Timer/alarm/lock icons identify the state. Tabular numerals prevent digit-width shifts; inset blocks align comparable time units. Green remains informational, yellow marks the early deadline, and red marks the final day. No decorative animation was added.

- Hard Gate PASS: 42 streak/countdown/reminder tests, mobile TypeScript, and Android export passed. Browser fixtures checked the actual components at 320px and 375px. Countdown labels and body text wrapped within their panels. The action measured 48.8px high in the final browser fixture. All 15 muted-text/inset/button color pairs checked exceed 4.5:1, with a minimum of 5.17:1. Production time/count values come from server data; fixture screenshots are explicitly test data.
- Purpose Gate PASS: time blocks distinguish hours/minutes/seconds, the day label prevents ambiguity over longer timers, and the locked-state progress explains the exact unlock requirement. State icons and colors identify actual conditions rather than decoration.
- Liveliness PASS: declared 1/2/1 dials, existing EcoBud identity and typography, a prominent time display when active, and a different progress composition when locked.
- Craftsmanship PASS for the changed scope: live seconds visibly advanced from 00 to 52 while minutes rolled from 30 to 29. View challenges was clicked from locked and countdown states and reached the fixture destination. The normal active state showed a countdown without a warning. The missing-expiry state retained Refresh streak and did not invent time. Light, dark, and onyx variants were exercised; 320px light rewards and 375px onyx Tracker layouts were visually checked. The clean final standalone preview logged no runtime errors. One MutationObserver error was recorded during earlier iframe navigation; no application MutationObserver code was introduced. Browser-native flame/audio remain labeled fixture substitutions, and device installation/playback was not performed.

Redesign screenshots: `apps/mobile/build/streak-expiry-preview/locked-redesign.png` and `countdown-redesign.png`.

### Yellow and red warning stages with separate pushes

The shared warning on Tracker, the flame screen, and the rewards panel is yellow when more than 24 and at most 48 hours remain. It changes to red at exactly 24 hours and stays red until expiry. The red heading explicitly says Your streak expires within 24 hours, so urgency does not rely on color alone.

The reminder scheduler queues one high-priority push/inbox notification for each stage in each activity window. The 1-day stage has a separate notification key and query filter, so the earlier 2-day reminder cannot suppress it. The original 2-day key is retained to avoid repeating reminders created before this change. Existing notification and delivery uniqueness constraints also protect against duplicate delivery jobs. A completion or restore starts a new reminder cycle; expired, locked, inactive-account, and recently renewed streaks do not receive obsolete warnings. The scheduler retains its 15-minute check interval, 8 AM to 8 PM Philippine delivery window, and available-challenge check.

- Hard Gate PASS for the changed warning: 36 streak/reminder tests and API/mobile TypeScript checks passed. Browser fixtures verified yellow at 48 hours and red at 24 hours on Tracker, and red at 12 hours in the rewards panel. The 320px light layout and 375px onyx layout wrap without clipping the warning text. Red text contrast is 6.80:1 in light mode and 11.16:1 in dark/onyx; the light-mode action is 8.31:1. Actions retain their 48px minimum height.
- Purpose Gate PASS: yellow marks the early warning and red marks the final day. An explicit urgency heading and remaining-time text explain the difference without depending on color alone.
- Liveliness PASS: existing EcoBud composition retained, ENERGY 1 / RHYTHM 1 / MOTION 1 for the status panel, with no additional decoration or animation.
- Craftsmanship PASS for this scope: View challenges was clicked from yellow and red Tracker warnings and reached the fixture destination. Tests cover exact boundaries, both reminders in order, repeated polls without duplicate sends, legacy reminder keys, restored/newly completed streaks, failed notification-creation retry, and batch filtering. Tests mock notification delivery; no live push was sent to a phone. Browser-native flame/audio fixtures remain explicitly labeled substitutions.

Preview screenshots: `apps/mobile/build/streak-expiry-preview/streak-yellow.png` and `streak-red.png`.

### Tracker placement and visible status for every streak state

`TrackerStreakCard` now renders the existing Your Eco Streak card followed directly by its expiry section, before the level card. The same section appears below the hero in streak rewards and in the flame screen. With fewer than three completed challenges it says Streak timer not started and explains how to unlock it. Active streaks show the countdown even outside the warning window; the final 48 hours use the amber warning. Inactive streaks explain how to reactivate the flame. An older API without `expiresAt` shows an explicit sync message and refresh action instead of silently hiding the section or inventing a date.

The Tracker retrieves the latest summary on activation, resumes syncing when the app returns to the foreground, and refreshes once per minute while visible. Cached dashboard data remains available during synchronization. Loading and sync failures have visible feedback and retry behavior. The summary drives both the Tracker flame and its expiry status. The original coach-mark target remains on the streak card.

- Hard Gate PASS: mobile TypeScript and Android export passed; 19 streak expiry tests passed. Browser fixtures of the actual Tracker component verified the two-challenge state at 375px and active/inactive states at 320px. Text wraps below the card rather than overlapping the level card. Green status colors use dark text on light backgrounds and light text on dark backgrounds; the existing warning contrast and 48px action height are retained.
- Purpose Gate PASS: the persistent status explains why a two-challenge account has no countdown; green communicates a normal or informational state and amber identifies actual approaching expiry. No artwork or motion was added.
- Liveliness PASS: existing EcoBud streak-card direction retained, ENERGY 1 / RHYTHM 1 / MOTION 1 for the added status, with the timer or status heading as its focal point.
- Craftsmanship PASS for this scope: View challenges was clicked from both locked and warning Tracker states and reached the fixture destination. Sync failure showed Retry streak sync; clicking it cleared the error. An older response showed Refresh streak and stayed honest about missing expiry metadata. Light, dark, and onyx were exercised with explicitly labeled fixtures. Native flames/audio were substituted only in the browser; the Android bundle contains the actual assets. Device installation and playback were not performed.

Tracker screenshots: `apps/mobile/build/streak-expiry-preview/tracker-locked.png` and `tracker-warning.png`. Android export: `apps/mobile/build/streak-tracker-status-export/`.

The flame screen and streak rewards panel show an amber warning during the final 48 hours of an active, unlocked streak. It displays remaining days/hours/minutes and a View challenges action that closes the overlay and opens the Challenges tab. The clock refreshes every 15 seconds while the app is active and immediately on resume. The warning disappears after expiry or when a completion/restore extends the deadline beyond 48 hours.

The API summary now includes `expiresAt`, calculated seven days after the later of the most recent completed challenge and restore. This needs the updated API and mobile code together, without a database migration. Older summaries remain readable but do not display an estimated deadline. At expiry, the rewards panel refreshes its server state so restore eligibility is current.

Design read: an activity warning within the existing EcoBud streak screens; ENERGY 1 / RHYTHM 1 / MOTION 1 for the new warning. Amber communicates a deadline, and the countdown is its focal point. No new animation or artwork was added.

- Hard Gate PASS for the warning: 19 expiry tests, mobile/API TypeScript checks, and a browser bundle of the actual components passed. The button measures 48px tall. Browser verification showed wrapped content at 320px; the full-width fixture had no page overflow. Text contrast is 7.91:1 in light mode and 10.46:1 in dark/onyx, with 8.67:1 for the light-mode button. Real production deadlines come from the API; preview data is explicitly labeled.
- Purpose Gate PASS: the amber panel identifies approaching expiry, the countdown gives remaining time, and View challenges leads to the action that keeps the streak active.
- Liveliness PASS: declared 1/1/1 dials, existing EcoBud flame identity and typography retained, with a readable countdown and no extra motion.
- Craftsmanship PASS for the changed scope: View challenges was clicked from both actual overlay components and reached the fixture's Challenges destination. Active 72-hour and expired states showed no warning. Restore reactivated the flame and removed the warning. Light, dark, and onyx were checked using explicit API fixtures. The browser substitutes labeled native animation/audio fixtures; it logged existing React Native Web animation/pointer-events warnings, with no final-page runtime errors. Native device behavior was not independently exercised.

The fixture and screenshot are in `apps/mobile/build/streak-expiry-preview/`. They are ignored build artifacts and contain test data rather than live user records.

Completed challenge reward claims increment the lifetime challenge count once per challenge instance. Lessons, habits, events, and repeat submissions do not increment it. Multiple challenges on the same day each count.

| Completed challenges | Bonus points | Bonus eco coins | Badge |
| --- | ---: | ---: | --- |
| 3 | 30 | 0 | None |
| 10 | 100 | 5 | None |
| 30 | 300 | 15 | None |
| 100 | 1,000 | 50 | Challenge Champion |

These are the suggested initial amounts. Rewards are automatic and awarded once per milestone, in the same transaction as the challenge reward. A unique milestone record and user row lock prevent duplicate awards.

The flame starts at one completed challenge. A count of zero shows the gray flame and the first-completion instruction. Once started, the flame turns gray exactly seven days after the latest challenge completion or restore. Inactivity never deletes the count. A completed challenge reactivates the flame. Restore changes only its active status for seven days, adds no rewards or challenges, and is limited to three uses per calendar month in Asia/Manila. Unused restores do not carry over; active retries do not consume another use.

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

## Compact streak timer

Design read: retain ECOBUD's existing streak card and theme palettes, with a subordinate status strip below it. ENERGY 2 / RHYTHM 2 / MOTION 1. The strip uses a short label and a single tabular `Xd HH:MM:SS` countdown so the challenge count stays the focal point. Zero completions show only “Timer not started”. Yellow and red retain the existing 48-hour and 24-hour thresholds. Large icon tiles, explanatory paragraphs, progress segments, and repeated challenge buttons were removed from this strip; missing server expiry retains a working Refresh control.

- Hard Gate PASS: mobile TypeScript check passed; actual component browser fixture verified yellow at 320px/light, red at 375px/onyx, and not-started at 320px/onyx. Countdown visibly advanced by seconds. This is a browser fixture with explicitly substituted native animation/audio, not an installed-device test.
- Purpose Gate PASS: existing warning colors convey urgency; compact tabular digits prevent changing number widths, and row wrapping accommodates larger text without truncation.
- Liveliness PASS: declared dials retained; the existing flame/card remains the focal point and the small strip gives it structural separation from the level card.
- Craftsmanship PASS: no new controls or fabricated timers; the zero state has no running countdown. Server expiry, first-completion start rule, and both push reminder stages are unchanged by this presentation-only edit.

## Animated timer bar and milestone feedback

Design read: keep the compact status strip and existing celebration composition, ENERGY 2 / RHYTHM 2 / MOTION 1. A 5px bar beneath the live countdown shows the fraction remaining in the seven-day window, with short eased fill transitions. Yellow/red thresholds remain unchanged. The celebration count advances to the current total; exact 3/10/30/100 milestones give the count badge one brief local highlight, without a repeating or full-screen flash. Reduced motion suppresses this new movement, and the app's performance preference is respected through the shared animation wrapper.

- Hard Gate PASS: mobile TypeScript passed; 59 focused timer/reminder tests passed, including every milestone boundary, repeated refresh, initial load, decreases, and a refresh that skips a count. Browser fixture shows the compact red countdown bar and the 10-challenge overlay; View streak rewards opened the working rewards panel. Native animation/audio remain explicitly substituted in this fixture.
- Purpose Gate PASS: bar length represents actual server expiry relative to seven days, tabular digits retain readable seconds, and the local highlight directs attention to the milestone count.
- Liveliness PASS: existing flame remains the focal point, compact timing feedback stays subordinate, and the reward count gets a single brief celebration accent.
- Craftsmanship PASS: animations and listeners clean up on unmount; countdown pauses while its screen is inactive. Existing milestone queue waits for other overlays to close and does not retrigger on unchanged counts. Native visual timing still needs verification in an installed build.

Android export also passed (1,396 modules), producing `apps/mobile/build/streak-tracker-status-export`. This validates bundling, not installation on a phone.
