# ECOBUD — Environmental Conservation Buddy
## System Architecture & Implementation Plan

### 1. Executive System Overview
ECOBUD is a multi-platform gamified environmental awareness application. It motivates users to form sustainable habits through education, daily challenges, and community events. To ensure trust and transparency, ECOBUD employs a blockchain-inspired audit log that immutably tracks environmental actions and reward distributions. The system combines a mobile app (primary user interface) and a responsive website (landing page, community dashboard, and admin portal) powered by a unified API backend.

### 2. Recommended Tech Stack
**Frontend (Mobile): React Native (Expo) + TypeScript**
- *Reasoning:* Fastest cross-platform development for Android-first approach, massive ecosystem, easy integration with web-like paradigms. Expo simplifies native builds and routing (Expo Router).

**Frontend (Web/Admin): Flutter Web + Dart**
- *Reasoning:* A single UI toolkit can power the public dashboard and future admin experience with a consistent design language, responsive layouts, and shared widget patterns.

**Backend: Node.js + Express.js + TypeScript**
- *Reasoning:* Lightweight, highly scalable, and excellent for rapid capstone prototyping. It keeps the stack entirely TypeScript/JavaScript, reducing context switching for developers.

**Database: MySQL / MariaDB (with Prisma ORM)**
- *Reasoning:* Relational structured data is perfect for user tracking, streaks, challenges, and transparency logs. MySQL via XAMPP is straightforward for local development on Windows, and Prisma provides excellent developer experience with type-safe queries.

**Authentication: JWT + bcrypt (Custom) or Firebase Auth**
- *Recommendation:* **Supabase Auth** or **Firebase Auth** for rapid prototyping, handling social logins and JWTs automatically. For a truly self-hosted capstone, standard **JWT + bcrypt** in Express is acceptable.

**Infrastructure/Offline Capabilities**
- *Mobile Offline:* AsyncStorage / WatermelonDB for caching lessons and streak data locally.
- *Push Notifications:* Firebase Cloud Messaging (FCM) integrated with Expo.

### 3. Full Feature Breakdown
- **Identity & Profiles:** Auth, role management, profiles, user preferences, avatars.
- **Learn & Grow (Education):** Categorized modules (composting, recycling), progress tracking, offline caching for articles.
- **Quests & Challenges:** Daily/Weekly habits, completion validation, reward assignment.
- **Gamification Engine:** Streak tracking (daily limits, miss-forgiveness logic), points, achievements, unlocked badges.
- **Events & Community:** Event listing, RSVP, QR-based check-in for attendance, community snapshot.
- **Eco-Bot (AI FAQ):** Chat interface, fallback responses, tip generation.
- **Transparency Dashboard:** Immutable activity logging (chained hashes) for public trust in user impact.
- **Admin Portal:** Content management, event creation, statistics oversight.

### 4. User Roles and Permissions Matrix
| Role | Auth Required | Capabilities |
| :--- | :--- | :--- |
| **Guest** | No | View landing page, basic FAQ, read public transparency metrics. |
| **User** | Yes | Post challenges, track streaks, earn points, join events, chat with bot, edit profile. |
| **Moderator** | Yes | User capabilities + Manage events, moderate challenge submissions (if proof required). |
| **Admin** | Yes | Moderator capabilities + User management, content creation (lessons/FAQs), view system analytics. |

### 5. Information Architecture / Sitemap
**Mobile App:**
- `Tabs:` Home | Learn | Challenges | Profile
  - `Home:` Daily Tip, Streak, Quick Actions, Active Challenge
  - `Learn:` Category Grid -> Lesson List -> Lesson Content
  - `Challenges:` Active Quests -> Challenge Details -> Submit Action
  - `Profile:` Stats, Badges, Event History, Settings, Transparency Log
- `Floating/Global:` Eco-Bot Chat interface, Notification Center

**Web Platform:**
- `Public:` Landing Page, Features, Community Impact (Transparency), Login/Signup
- `User Dashboard:` Web mirroring of mobile Home/Profile.
- `Admin Panel:` Users Table, Content Editor, Events Manager, Analytics View.

### 6. App Navigation Flow (Mobile)
1. **Splash/Onboarding:** 3-screen carousel explaining Learn, Act, Earn -> Auth Screen.
2. **Main Hub (Home):** Dynamic dashboard. Tap "Daily Challenge" -> Challenge Detail Modal.
3. **Bottom Navigation (Home, Learn, Challenges, Profile):** Sticky bottom glassmorphism bar.
4. **Header/Top Bar:** Eco-Points summary, Notification Bell.

### 7. Core User Journeys
- **The Daily Habit:** User opens app -> views Home Dashboard -> sees "Use reusable bottle" -> taps "Mark Complete" -> UI confetti / Points increased -> Streak updated.
- **Event Participation:** User browses 'Profile/Events' -> sees "Beach Clean-up" -> taps "Join" -> receives calendar reminder. Post-event, admin scans QR -> points awarded.
- **Learning Flow:** User opens 'Learn' -> selects "Composting Basics" -> reads step 1 to 4 -> completes mini-quiz -> earns "Sprout" badge.

### 8. Database Schema (Entities overview)
- `User`: id, email, password_hash, role, points, current_streak, highest_streak, created_at
- `Profile`: id, user_id, display_name, avatar_url, preferences_json
- `Lesson`: id, title, content, category, points_reward
- `UserLessonProgress`: id, user_id, lesson_id, status (started/completed), completed_at
- `Challenge`: id, title, description, difficulty, duration_days, points_reward, active
- `UserChallenge`: id, user_id, challenge_id, progress_percentage, status, expiration_date
- `Badge`: id, name, description, icon_url, required_points
- `UserBadge`: id, user_id, badge_id, unlocked_at
- `Event`: id, title, description, location, date, capacity, points_reward, admin_id
- `EventRegistration`: id, user_id, event_id, status (registered/attended)
- `TransparencyLog`: id, user_id, action_type, points_awarded, metadata, previous_hash, current_hash, timestamp

### 9. Entity-Relationship Structure
- `User` 1:1 `Profile`
- `User` 1:M `UserLessonProgress` M:1 `Lesson`
- `User` 1:M `UserChallenge` M:1 `Challenge`
- `User` 1:M `UserBadge` M:1 `Badge`
- `Event` 1:M `EventRegistration` M:1 `User`
- `User` 1:M `TransparencyLog`

### 10. API Endpoints (Express.js RESTful)
**Auth:**
- `POST /api/auth/register`
- `POST /api/auth/login`
**Users:**
- `GET /api/users/me`
- `PATCH /api/users/me/preferences`
**Learn:**
- `GET /api/lessons`
- `POST /api/lessons/:id/complete` (Updates progress, awards points)
**Challenges & Streaks:**
- `GET /api/challenges/active`
- `POST /api/challenges/:id/progress` (Increment progress, trigger transparency log if complete)
- `GET /api/streaks/summary`
**Events:**
- `GET /api/events`
- `POST /api/events/:id/join`
**Transparency (Public):**
- `GET /api/transparency/metrics` (Aggregated block stats)
- `GET /api/transparency/logs?page=1` (Paginated hashes)

### 11. Backend Module Architecture
- **Controllers:** Handle HTTP requests and responses.
- **Services:** Core business logic (e.g., `GamificationService` handles points and streaks, calling `TransparencyService` on success).
- **Repositories (Data Access):** Prisma client wrappers for DB operations.
- **Middlewares:** Authentication (`verifyToken`), Role Guards (`isAdmin`), Error Handling.
- **Utils:** Hashing configurations (`generateBlockHash`), date manipulation logic.

### 12. Frontend Screen/Component Architecture (React)
- **Atoms:** Buttons, Icons, Avatars, Badges, Input fields, Progress Bars.
- **Molecules:** Challenge Cards, Lesson List Items, Streak Charts, Notification Banners.
- **Organisms:** Bottom Navigation, Hero Header, Transparency Dashboard Table.
- **Templates/Pages:** HomeDashboard, LessonReader, ProfileView.
- **Providers:** `AuthProvider`, `ThemeProvider` (Dark/Light mode with Eco green base).

### 13. Admin Dashboard Architecture
- Flutter Web app with role-gated admin routes backed by authenticated API endpoints.
- Sidebar Navigation: Dashboard, Users, Events, Gamification/Content, Transparency Verifier.
- Tables with Server-Side Pagination, Forms for CRUD operations on lessons and events, Chart.js for usage analytics.

### 14. Offline Support Strategy
- Store essential data (current streak, active challenges, downloaded lesson textual content) in React Native `AsyncStorage` or `zustand` persist middleware.
- When `submitChallengeProgress` is triggered while offline, store the payload in a local sync queue.
- Use NetInfo to detect reconnection and flush the queue to the backend.

### 15. Notification Workflow
- **Trigger:** Cron job runs at 6:00 PM server time to find users who haven't completed a habit today.
- **Dispatch:** Backend formats push payload -> sends through FCM.
- **Client:** Device receives push. Tapping it opens the app via deep-link straight to the Challenges tab.

### 16. Gamification Logic
1. **Action:** User completes "Recycle plastic bottle".
2. **GamificationService:**
   - Adds 10 points to `User.points`.
   - Checks `UserBadge` conditions (e.g., if total points >= 350, unlock "Recycle Pro" badge).
   - Validates streak: if `last_action_date` was yesterday, `current_streak` + 1. If today, no change. If older, reset to 1.
3. **Impact:** System saves changes and triggers a Transparency Log.

### 17. Transparency Logging Logic (Blockchain-inspired)
- **When an action completes:**
  1. Fetch the most recent log entry to get its `current_hash` (becomes the new `previous_hash`).
  2. Create payload: `action_type`, `user_id` (anonymized/hashed for public display), `points_awarded`, `timestamp`.
  3. Calculate string: `SHA256(payload + previous_hash)`.
  4. Save new `TransparencyLog` record.
- **Verification:** Anyone can pull the table, re-run the SHA256 sequence from genesis, and verify the data hasn't been modified in the database.

### 18. Security and Privacy Considerations
- **Auth:** Passwords stored via bcrypt. JWTs have strict expirations.
- **Privacy:** The public Transparency dashboard redacts PII. Display generic identifiers (e.g., "EcoWarrior#3491 logged a tree planting").
- **Rate-Limiting:** Express-rate-limit to prevent point-farming attacks on the completion endpoint.

### 19. Scalability Recommendations
- Migrate to AWS/GCP with auto-scaling for Node servers if user base grows.
- Use Redis for Leaderboard caching (calculating ranks of 100,000 users in Postgres is slow).
- Implement Cursor-based pagination instead of Offset-based pagination for logs and feeds.

### 20. Suggested Folder Structure (Monorepo)
```
/ecobud-monorepo
  /apps
    /mobile        # React Native EXPO app
    /web           # Flutter Web App (Landing + Admin)
    /api           # Node.js Express backend
  /packages
    /shared-types  # Shared TypeScript interfaces (Models, DTOs)
    /ui            # (Optional) Shared React components
```

### 21. Development Roadmap by Phase
- **Phase 1: Foundation (Weeks 1-2)** Auth, DB Setup, Basic API, Mobile UI Skeletons.
- **Phase 2: Core Loop (Weeks 3-4)** Challenges, Streaks, Points logic, Web Landing page.
- **Phase 3: Content & Community (Weeks 5-6)** Learn modules, Events CRUD, Admin Dashboard.
- **Phase 4: Transparency & Polish (Weeks 7-8)** Transparency hash logging, Chatbot integration (OpenAI API or simple logic), UI/UX Polish, animations.

### 22. Sample Seed Data
- **Badges:** Waste Warrior (150pts), Energy Saver (200pts), Sustainability Star (400pts).
- **Habits:** Walk instead of drive (5pts), Use reusable bag (2pts).
- **Lessons:** "Waste Management Basics", "Intro to Composting".

### 23. Optional Future Improvements
- AI-based image recognition (users snap a photo of their recycling, AI validates it before awarding points).
- Hardware sensor integrations (smart bins).
- Actual Polygon/Ethereum smart contracts for the Transparency system.
