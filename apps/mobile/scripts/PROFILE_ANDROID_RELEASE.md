# Android release performance check

Use the same low end Android phone, network, account, and test data when comparing runs. React Native recommends measuring a release build because development mode changes JavaScript performance: [performance guide](https://reactnative.dev/docs/performance).

1. Build the Android release APK from `apps/mobile/android` with `./gradlew assembleRelease`. On Windows PowerShell, use `.\gradlew.bat assembleRelease`. The APK is at `app/build/outputs/apk/release/app-release.apk`.
2. Connect the phone with USB debugging and check `adb devices`. Close other heavy apps. Keep screen brightness and network conditions comparable between runs.
3. From `apps/mobile`, run:

   ```powershell
   .\scripts\profile-android-release.ps1 -ApkPath .\android\app\build\outputs\apk\release\app-release.apk
   ```

   Pass `-Serial <device-id>` if more than one Android device is connected. The script rejects a debuggable build.

4. Follow the prompts for fast challenge scrolling, tab switching, and a long chat. Use an existing chat with substantial history. The script measures cold launch with `am start -W`, records Android frame statistics for each interaction, then samples process memory every 30 seconds for five minutes of use.
5. Inspect `performance-results/<timestamp>/summary.csv`, `startup.txt`, and the raw `gfxinfo` and `meminfo` files. Compare launch `TotalTime`, janky frame percentage for the same interaction, and memory at the start and end. Note any visible stalls separately; Android frame stats do not measure React's JavaScript thread directly.

Do at least three runs on the same phone and compare the median. Restart the app between runs. The script preserves app data so the login and chat history remain available; `am force-stop` only stops its process before startup timing.
