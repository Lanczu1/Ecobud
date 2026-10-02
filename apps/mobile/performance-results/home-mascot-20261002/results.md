# Home mascot scrolling measurements

Tested on the connected Android phone at its existing 720 x 1600, 90 Hz display mode. Each run used four up/down Home swipe pairs (400 ms per swipe), with the mascot visible and animated. Login and app data were preserved.

The installed debug build presented about 26.2 FPS in the captured sample. This comparison includes debug versus release differences and other previously pending workspace changes; it does not isolate the mascot optimization alone.

The final optimized release with the Home mascot software renderer presented 71.6, 70.6, and 72.5 FPS across three samples (median 71.6 FPS). These are average frame presentation rates calculated from Android gfxinfo DisplayPresentTime timestamps, not inverse render latency. The phone remained at 90 Hz. The 95th percentile presentation gap was about 22 ms, so occasional dropped frames remain; this is not a guarantee of locked 60 FPS.

Android reported nearly every frame as janky against its 90 Hz timing/deadline budget. That metric remains high even though average presentation exceeds the requested 60 FPS. Raw data is included so this limitation is visible.

Only the Home floating mascot renderer and its Home-only asset were changed in this turn. The original Wave.lottie and chatbot conversation UI were preserved. Hidden image references were removed. Android image metadata was reduced by half in each dimension, with matching anchor and scale compensation; the native Lottie 6.7.1 loader resizes decoded bitmaps to that metadata. PNG contents, visible positions, easing, keyframe times, and loop duration were verified by five tests. The declared RGBA bitmap budget fell from 76.0 MiB to 16.5 MiB; the archive fell from 5,006,559 to 3,170,720 bytes. Android graphics memory was about 55 MiB for the final renderer compared with about 70 MiB in the hardware renderer trial.

Validation: Android assembleRelease passed; TypeScript passed; five asset regression tests passed. The final release was installed on the authorized connected phone and used for all three final scrolling runs.
