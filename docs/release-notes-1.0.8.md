# 🌿 Ecobud v1.0.8 - Release Notes

🚀 New Features & Updates:

• Challenge Streak & Milestone Rewards: Track completed challenge reward claims toward lifetime milestones at 3, 10, 30, and 100 challenges. Unlock the streak flame after three completions, with up to three restores per month when it becomes inactive.
• Quick Tasks for Challenges: Added a quick missions overlay that displays up to three challenge shortcuts and opens the selected mission directly.
• Community Announcements & Push Notifications: Added announcements on the mobile dashboard, with images, barangay targeting, push notifications, and links from the notification inbox.
• Event & Announcement Editors: Added expanded admin editing tools, event audience settings, assigned official details, and barangay-based moderator permissions.
• Local Admin Drafts: Save and restore drafts locally on the web for announcements, challenges, events, learning content, and redeem items.
• Configurable Badges & Milestone Requirements: Added admin badge management and automatic badge awards based on completed lessons, challenges, events, and eligible swaps.
• Forgot Password & Email Verification Updates: Added email-code password recovery, synchronized OTP countdowns with server expiry times, and normalized email input before validation.
• Mobile Accessibility & Dashboard Updates: Added text size, contrast, bold text, larger touch targets, and performance preferences, alongside revised dashboard cards and mascot animation handling.

🛠️ Bug Fixes & Improvements:

• Challenge Streak & Reward Accuracy: Count challenge completions once per instance, preserve lifetime progress during inactivity, and prevent duplicate milestone rewards. Streak restores reactivate the flame without adding challenges or rewards.
• Announcement Delivery & Refresh: Improved announcement fetching, realtime refresh, notification handling, and navigation to the linked announcement.
• Login & Password Reset Reliability: Updated failed-login lockouts to five minutes and refined countdown feedback, reset-code reuse, request limits, and Google sign-in guidance.
• Badge & Swap Reward Synchronization: Updated badge progress and reward refresh handling after eligible content completions and swaps, with caching for marketplace reads.
• Redeem Claim Validation: Require a claim location, future claim deadline, and claim instructions before approval; generate claim codes using cryptographic randomness.
• Mandatory Update Detection: Recheck version requirements when the app resumes, connectivity returns, and during active online polling. Failed checks preserve a previously confirmed update requirement.
• App Version Alignment: Updated API and mobile release metadata to 1.0.8, aligned package lockfiles and API version defaults, and incremented the Android version code to 6.

Source: origin/main, from bd8efe1 (challenges streak changes) through 53fa445 (added quick tasks challenges), inclusive. Version alignment was performed locally after this range.
