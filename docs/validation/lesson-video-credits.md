# Lesson video credits validation

Scope: optional credits fields in the lesson editor, API persistence, and attribution above the learner's video transcript.

- Hard Gate PASS (changed editor UI): actual editor rendered in a temporary local harness. Credits on revealed both labeled inputs; off hid them. Invalid YouTube URL showed validation. Valid save emitted enabled/name/URL fields, and disabled save emitted false/empty values. Browser console returned no errors or warnings. Light and dark screenshots checked at 514px; page width equaled viewport width and credits fields had no overflow. Native checkboxes and labeled inputs retain keyboard behavior and visible focus outlines. No invented production content or assets added.
- Purpose Gate PASS: existing EcoBud green, typography, input shapes, and spacing retained for visual continuity. A top divider groups attribution with the transcript. No new decorative assets, gradients, animations, or badges.
- Liveliness PASS: ENERGY 1 / RHYTHM 1 / MOTION 1, following the supplied editor screenshot. Existing green accent identifies actions; spacing separates file upload, credits, and transcript. Lesson content remains the focal point.
- Craftsmanship PASS (editor and source inspection): fields stack below the small breakpoint; lengths and URLs are validated; optional fields are hidden when disabled. Learner attribution uses a link role, wrapping text, a 44px minimum touch target, and an error alert when opening the URL fails. Credits are stored separately so transcript regeneration cannot overwrite them.

Technical checks: web production build, API TypeScript compilation to a temporary output directory, mobile TypeScript check, Prisma validation, and 13 focused validation/migration tests passed. The PostgreSQL migration test preserved existing transcript data and an unrelated table. Temporary preview and build files were removed.

Database: only the three additive credits columns were applied and the migration recorded. Existing lessons were readable afterward. No seeds, table drops, resets, or unrelated pending migrations were run.

Limits: the native learner YouTube link was checked in source and by TypeScript, not clicked on a device. Browser save verification captured FormData locally without creating or editing production lessons. The standard API output directory had locked files, so compilation used a separate temporary directory.
