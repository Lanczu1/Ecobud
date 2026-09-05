# Challenge image recognition

Before photos use Gemini through the backend `POST /api/challenges/:id/analyze` route. The active request path no longer executes Python or YOLO. After photos retain their existing upload/review flow.

Set `GEMINI_API_KEY` in the ignored backend `.env` and optionally set `GEMINI_IMAGE_MODEL` (default `gemini-3.6-flash`). Restart the API after changing environment variables. Do not put the key in mobile/web source or any `EXPO_PUBLIC_`/`VITE_` variable. Rotate credentials shared in chat before production use.

Admin detection settings accept one or more of exactly these classes:

- Plastic Bottle: rigid plastic bottles.
- Glass Bottle: glass bottles, excluding drinking glasses and cups.
- Plastic Wrapper: flexible film packaging, including bread bags, snack wrappers, and sachets, empty or containing food.

The backend accepts only selected classes whose model-estimated confidence meets the saved threshold. Unselected objects do not contribute to the detection count. If multiple classes are selected, a match to any selected class is sufficient. An empty selection is rejected, with no implicit fallback. Confidence is an AI estimate, not a calibrated guarantee of material identity. Existing moderation and reward amounts remain in place; recognition does not itself award rewards.

The mobile app forwards a signed `analysisToken` with a successful before-photo submission. Tokens expire after 15 minutes and bind the image URL, member, challenge instance, detection count, and saved detection settings. Re-analyze after expiration or an admin settings change. Old app versions must update to submit AI before photos.

## Security controls

- Authentication and member-role checks before image upload or provider calls.
- Rate limiting, a 10 MB file cap, a single image/no form fields, signature-based JPEG/PNG/WebP checks, and temporary-file cleanup.
- Fixed HTTPS Google API origin, server-only key header, no image URL fetching or redirects.
- A 25-second provider deadline, at most four concurrent provider calls per API process, and a 64 KB provider response cap.
- Prompt instructions treating image text as untrusted, strict output validation, exact class allowlisting, and no tools available to the model.
- Generic provider errors that do not expose credentials, uploaded content, or provider response bodies.
- User-bound signed analysis results; direct AI progress bypass is rejected. A serializable submission transaction rejects reuse of an analyzed proof URL, including conflicting concurrent submissions.

Rate limits and concurrency limits are process-local. Use a shared limiter when deploying multiple API instances. Serve the application over HTTPS in production. These are targeted OWASP-aligned controls, not a full application security certification. Generative recognition can still misclassify a photo; retain human review.

## Verification

Run `npm test` and `npx tsc --noEmit` in `apps/api`. Regression tests cover the three-by-three class matrix, confidence filtering, invalid output, missing/forged/expired/wrong-user tokens, direct-submission bypass, repeated proofs, and multipart uploads. Provider and database calls are mocked in these tests.

Live check on 2026-09-05: the configured key could list models, but Gemini generation returned HTTP 403 `PERMISSION_DENIED` (project access denied). The previous 2.5 Flash model also reported it was unavailable to new users and directed migration to 3.6 Flash. A working project/key is required before live recognition can be verified. No successful live bread-bag classification has been claimed.

References: [Google image understanding](https://ai.google.dev/gemini-api/docs/image-understanding), [Google structured output](https://ai.google.dev/gemini-api/docs/generate-content/structured-output).
