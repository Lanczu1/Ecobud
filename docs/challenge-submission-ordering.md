# Challenge submission activity ordering

Admin and moderator challenge submissions now use the latest persisted update first. A new Before submission and an After upload on an older submission can both move their record to the top. Reviews and other submission updates also count as activity because this uses the existing `updatedAt` field. Original creation timestamps and chronological submission numbers stay intact.

Barangay pagination selects the most recently updated groups before loading their records. The web groups barangays, residents, challenges, and individual records by that activity. Last Updated displays the ordering date. Moderator barangay restrictions and existing search/status filters remain in place.

The resident API returns creation/update timestamps and orders submission histories by update time, creation time, then ID. Mobile My Tasks and History groups use their newest submission update. The newest-created submission remains the source of the challenge's overall status, so uploading an After photo to an older attempt does not replace the current attempt.

Before and After writes publish resident challenge/tracker and admin refresh signals. Existing web subscriptions bypass the API cache when refreshing; mobile refreshes after submitting and listens for its user channel. Duplicate After uploads do not change activity or publish another signal. Real delivery across deployed devices requires the API deployment and an updated mobile build; this change was checked locally with mocked broadcasts.

Design read: preserve the existing ECOBUD grouped review table and mobile challenge cards, ENERGY 2 / RHYTHM 2 / MOTION 1. The ordering and date label help reviewers find the most recent work; no new decoration, actions, animation, or layout is introduced.

- Hard Gate PASS: web production build and API/mobile TypeScript checks passed. Existing responsive table container and theme styles are unchanged; this adds no interactive controls to click through.
- Purpose Gate PASS: Last Updated reflects the actual sorting timestamp, with no new visual techniques or assets.
- Liveliness PASS: existing ECOBUD card/table hierarchy and status accents are retained, with the original visual dials and primary review action.
- Craftsmanship PASS: 65 focused tests passed covering Before/After refresh signals, duplicate uploads, ownership, older After uploads outranking newer Before submissions, tie handling, pagination, and challenge role access. Builds and mocked route tests do not establish live push delivery or device behavior.
