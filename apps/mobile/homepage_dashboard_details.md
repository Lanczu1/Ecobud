# EcoBud Mobile App - Homepage Dashboard Details

This document explains the structure and contents of the **HomeView** (Homepage Dashboard) within the EcoBud mobile application, specifically designed as context for AI assistants like Claude.

## File Location
The UI for the dashboard is primarily rendered by the `HomeView` component located in `apps/mobile/src/app/components/AppViews.tsx`. The data is supplied by the `useHomeDashboard` hook located in `apps/mobile/src/app/hooks/useHomeDashboard.ts`.

## Dashboard Sections

The homepage dashboard (`HomeView`) consists of the following key sections, ordered from top to bottom:

### 1. Top Navigation (`<TopNavbar />`)
- A consistent top bar displaying user context (e.g., avatar, notification icons, or basic profile data).

### 2. Welcome Header
- **Label**: "WELCOME BACK"
- **Title**: Greets the user by their first name (e.g., "Hello, [Name]!").
- **Subtitle**: "Let's keep your green streak going and make a positive impact today!"

### 3. Summary Cards (`<SummaryCards />`)
- **Current Streak**: Displays the user's ongoing daily activity streak.
- **Eco Points**: Displays the user's total earned Eco Points (XP).

### 4. Quick Actions (`<QuickActions />`)
- Provides fast access to common tasks and displays the user's weekly goal progress.

### 5. Editor's Pick (Featured Lesson)
- Highlights the top featured lesson (`topFeaturedLesson`).
- **Visuals**: A cover image with a shadow card effect.
- **Content**: 
  - "Featured" badge and category label.
  - Lesson Title and short description.
- **Action**: Tapping the card opens the lesson.

### 6. Today's Featured Challenge (`ActiveChallengeCard` logic)
- Displays the most prominent active challenge (the first item in the challenges array).
- **Visuals**: A large hero-style card with a dark overlay, blurred background image, or a fallback trophy icon.
- **Tags & Meta**:
  - **Difficulty**: Easy (🟢), Medium (🟡), Hard (🔴), or extreme (🔥).
  - **Rewards**: Eco Points (XP) and Eco Coins (if applicable).
  - **Status**: "TODAY'S CHALLENGE" and "NEW" or "VIEWED" badges.
- **AI Image Recognition Mission**: If the challenge type is AI-based, it displays a special neon box indicating the targets to find and capture (e.g., "Find & capture: Plastic bottle").
- **Standard Mission**: Shows a progress bar.
- **Dynamic Action Button**: A pulsing button that changes based on status:
  - START MISSION / CONTINUE MISSION
  - PENDING APPROVAL
  - CLAIM REWARD
  - CHALLENGE FINISHED

### 7. Daily Tip (`<DailyTipCard />`)
- A quick, actionable eco-friendly tip or fact for the day.

### 8. Continue Learning (`<ContinueLessonCard />`)
- A prompt to resume the user's in-progress educational course or lesson.

### 9. Community Impact (`<CommunityImpactCard />`)
- A global statistics card showing the collective impact of all EcoBud users.
- **Example Metrics**:
  - CO2 Saved (e.g., 4.2kg)
  - Trees Planted (e.g., 1240)
  - Community Members (e.g., 8500)

## Data Model (EcoBudMobileModel)
The view relies heavily on `EcoBudMobileModel` which includes:
- `userDisplayName`
- `dashboard` (streak, ecoPoints, weeklyGoal)
- `lessons` (array of lessons, used for Editor's Pick)
- `challenges` (array of challenges, used for the Featured Challenge)
- `viewedMissionIds` (array of string IDs to determine "NEW" vs "VIEWED" status)

This structure ensures the user is immediately greeted with their personal progress, a featured educational piece, and an actionable daily challenge, followed by global community motivation.
