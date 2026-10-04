# User Activity & Transactions

The admin sidebar opens a read-only history organized as Barangay → Resident → Records, using the same green group headers, resident cards and table layout as Challenge Submissions. Challenge Submissions itself is unchanged.

Resident transaction lists start hidden whenever the page is opened. Select **Show transactions** on a resident card to reveal that resident's records, or use **Show all transactions** for residents on the current page. **Hide all transactions** closes the lists while keeping the resident cards visible. Expansion is held only during the current visit, survives background refreshes, and is not stored between visits. Newly encountered residents also start closed. Secondary filters are under **More filters**; active secondary filters show a count beside that control.

Next and Previous retain the current list while loading, then reveal the new page with a 220ms directional slide and fade and scroll back to the start of the records. Paging controls pause during loading. Failed requests keep the last successful page and can be retried using Retry or the same paging button. Background refreshes do not replay the transition. Reduced-motion preferences disable the animation and smooth scrolling.

## Access and synchronization

- `GET /api/admin/user-activity` requires an active, authenticated admin. Moderators and residents cannot use it. The server verifies the current account role; hiding the menu is not the access control.
- Mobile and web writes are read from their existing shared database tables. No client-maintained copy or backfill is needed. Deploy the API and web changes together.
- The visible page refreshes every 30 seconds, on focus, on becoming visible, and on reconnection. Refresh and Retry allow an immediate fetch. The API and client bypass response caches.
- In-flight refreshes are coalesced; results from a previous filter or an unmounted page are ignored. A failed background refresh retains the last successful records and shows an error.

## Included records

| Source | Included information |
| --- | --- |
| TransparencyLog | Claimed challenge/event/lesson/habit rewards, recorded Eco Points and EcoCoins |
| reward_transactions | All recorded EXP/EcoCoins credits, bonus awards, redemption debits and refunds |
| redeem_requests | Latest saved redemption status, requested time, item and cost |
| UserChallenge / ChallengeSubmission | Challenge participation, submission status, review and claim information |
| EventRegistration / event_submissions | Registrations, attendance and proof status |
| lesson_progress / HabitCheckIn | Lesson progress and daily habit check-ins |
| UserBadge / StreakMilestone | Awarded badges and challenge milestones |
| swap_listings / swap_requests | Listings and exchanges, including each participating resident's history |
| audit_logs | Existing admin review and account actions targeted at a resident |

Each row retains its original reference ID and identifies its source. Activity and reward ledger entries can describe the same award, so this view does not sum them into a financial total. Status-only rows show no invented currency movement. Current balances come from `users.points` and `user_stats.eco_coins`.

History includes all saved records, with 50 rows per page and a server-enforced maximum of 100. Filters cover barangay, resident, category, status, currency, ledger source, search and inclusive Philippine dates. Residents without a recognized barangay appear under Unassigned Barangay. Barangay membership follows the current profile; it is not a historical address snapshot. Group counts are explicitly for the current page, and the toolbar shows total matching records and residents.

The screen is an aggregation of existing records. Mutable request/progress rows represent their latest saved state; historical intermediate states that were never logged cannot be reconstructed. Records removed by existing cascade deletion policies are also unavailable. It does not expose chat messages, ID images, claim codes or arbitrary metadata. Details use an allowlist and React text rendering.

## Verification

`adminUserActivity.test.ts` executes the actual parameterized query against PostgreSQL via PGlite: all sources, signed amounts, access guards, grouping, filters, tied-timestamp pagination, date boundaries, literal search, privacy filtering and fresh reads after committed transactions.

`adminActivitySync.test.ts` checks foreground polling, visibility, focus, reconnect and unsubscribe behavior. Browser checks use isolated sample records to exercise grouping, rapid filter changes, details/Escape, automatic updates and recovery from refresh failures. No live resident data is modified during verification.
