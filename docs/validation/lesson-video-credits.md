# Lesson video credits validation

Latest mobile presentation: `Credits Name: Lanczu`, using the lesson's saved name. Only the name is clickable; the saved YouTube URL remains the destination and is not displayed.

- Hard Gate PASS by source inspection: a wrapping row, explicit link role, and 44px touch target remain; only the name is inside the link. No new content or assets.
- Purpose Gate PASS: the plain label identifies attribution, and the existing green underline identifies the clickable name.
- Liveliness PASS: ENERGY 1 / RHYTHM 1 / MOTION 1 and existing EcoBud theme tokens retained.
- Craftsmanship PASS by source inspection: optional visibility, URL validation, and link-opening error feedback are unchanged. Native visual/tap verification remains unperformed.

Scope: optional credits fields in the lesson editor, API persistence, and attribution above the learner's video transcript.

- Hard Gate PASS (changed editor UI): actual editor rendered in a temporary local harness. Credits on revealed both labeled inputs; off hid them. Invalid YouTube URL showed validation. Valid save emitted enabled/name/URL fields, and disabled save emitted false/empty values. Browser console returned no errors or warnings. Light and dark screenshots checked at 514px; page width equaled viewport width and credits fields had no overflow. Native checkboxes and labeled inputs retain keyboard behavior and visible focus outlines. No invented production content or assets added.
- Purpose Gate PASS: existing EcoBud green, typography, input shapes, and spacing retained for visual continuity. A top divider groups attribution with the transcript. No new decorative assets, gradients, animations, or badges.
- Liveliness PASS: ENERGY 1 / RHYTHM 1 / MOTION 1, following the supplied editor screenshot. Existing green accent identifies actions; spacing separates file upload, credits, and transcript. Lesson content remains the focal point.
- Craftsmanship PASS (editor and source inspection): fields stack below the small breakpoint; lengths and URLs are validated; optional fields are hidden when disabled. Learner attribution uses a link role, wrapping text, a 44px minimum touch target, and an error alert when opening the URL fails. Credits are stored separately so transcript regeneration cannot overwrite them.

Technical checks: web production build, API TypeScript compilation to a temporary output directory, mobile TypeScript check, Prisma validation, and 13 focused validation/migration tests passed. The PostgreSQL migration test preserved existing transcript data and an unrelated table. Temporary preview and build files were removed.

Database: only the three additive credits columns were applied and the migration recorded. Existing lessons were readable afterward. No seeds, table drops, resets, or unrelated pending migrations were run.

Limits: the native learner YouTube link was checked in source and by TypeScript, not clicked on a device. Browser save verification captured FormData locally without creating or editing production lessons. The standard API output directory had locked files, so compilation used a separate temporary directory.

## Follow-up: credits below the mobile video

- Hard Gate PASS by source inspection: attribution renders immediately after the video player and before the lesson-page lock message, independently of transcript visibility. The credit name has a link role, a 44px minimum touch target, wrapping text, and a YouTube open handler with failure feedback. Credits remain conditional on the lesson's saved enabled/name/URL fields. Device interaction has not been tested.
- Purpose Gate PASS: the existing green underlined name indicates a clickable attribution; no new decoration or assets.
- Liveliness PASS: ENERGY 1 / RHYTHM 1 / MOTION 1 retained from the supplied mobile screenshot; compact spacing keeps attribution next to its video.
- Craftsmanship PASS by source inspection: credits also remain visible when the completed video is collapsed; the transcript no longer duplicates the link. Both theme colors reuse existing tokens. No database changes required for this follow-up.

## Follow-up: missing mobile credits data

The mobile catalog now selects and returns all three saved attribution fields. Opening a lesson uses a direct published-lesson query instead of the cached full lesson list. The mobile attribution shows both the clickable name and its YouTube URL below the player.

Validation PASS: 16 regression tests passed, including catalog selection, fresh detail reads after a credit change, and explicit disabled/null values. API and mobile TypeScript checks passed. Read-only calls through the actual catalog and detail services both returned enabled credits, name "Lanczu", and a populated YouTube URL from the configured database. The local API and public tunnel health checks returned "ok"; Metro reported running. No database writes or migrations were performed during this fix. Native visual/tap verification remains unperformed.
