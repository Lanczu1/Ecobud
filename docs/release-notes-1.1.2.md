# 🌿 Ecobud v1.1.2 - Release Notes

🚀 New Features & Updates:
• Quick Missions Overlay: Added an interactive quick-access mission menu on mobile for jumping into active challenges with fluid radial spring animations.
• Offline Learning & Lesson Downloads: Implemented lesson caching allowing users to save educational modules locally and learn offline.
• Offline Feedback & Connection Alerts: Added `OfflineStatusPill` indicators and `ConnectionErrorCard` fallbacks across mobile views when offline.

🛠️ Bug Fixes & Improvements:
• Smart Conditional Caching: Integrated HTTP 304 conditional responses on backend endpoints to minimize redundant data transfer and accelerate loading.
• Real-Time Sync Optimization: Added live connection health monitoring to eliminate unnecessary polling when WebSocket channels are active.
• Mobile Animation Stability: Refactored animated transform typings in `QuickMissionsOverlay` and mobile motion helpers to ensure strict TypeScript and build compliance.
• Version Synchronization: Aligned API, mobile app metadata, and release configurations to 1.1.2.
