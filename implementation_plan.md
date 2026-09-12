# EcoBud Homepage Refactoring Implementation Plan

This plan addresses homepage content repetition, scroll bloat (~7 viewport heights reduced to ~2–2.5), conflicting UI overlays, and navigation smoothness across the mobile app while strictly preserving all existing design tokens (typography, colors, radii, shadows, and spacing).

---

## Current Component Tree & File Structure

Below is the current component hierarchy for the EcoBud homepage:

```
apps/mobile/src/
├── app/
│   ├── EcoBudApp.tsx                                # Root shell (SafeAreaView, ScrollView, Overlays, ChatbotFAB, BottomTabBar)
│   ├── hooks/
│   │   └── useHomeDashboard.ts                      # Core state & handlers (dashboard, habits, streak, lessons, challenges, events)
│   ├── types/
│   │   └── home.ts                                  # EcoBudMobileModel, HeaderProps, HabitTodayData, OverlayScreen
│   ├── styles/
│   │   └── appStyles.ts                             # Global styles (chatbotFabOuter: position absolute, zIndex: 999)
│   └── components/
│       ├── CommonComponents.tsx                     # TopNavbar, ChatbotFAB, SurfaceCard, AvatarBubble
│       ├── Header.tsx                               # Top navbar layout (Avatar, Logo, Tracker, Events, Notifications)
│       ├── QuickActions.tsx                         # 4 equal-weight tiles (Log Habit, Redeem, Give & Get, Events)
│       ├── LevelCard.tsx                            # [Card 1] Full-width: Level, Eco Points, Progress bar, "Roadmap"
│       ├── MilestoneBadgePreview.tsx                # [Card 2] Full-width: "Eco Learner", XP to next, Progress bar 2
│       ├── SummaryCards.tsx                         # [Card 3] Full-width: Streak flame, 7-day dots, Visible streak
│       ├── LeaderboardSnippet                       # [Card 4] Full-width: Weekly rank, avatar, points, "View All"
│       ├── LearnLessonCard.tsx                      # [Section 1] Full-width/height card with "See all" & "Start Learning"
│       ├── DiscoverChallengeCard.tsx                # [Section 2] Full-width/height card with "See all" & "OPEN"/"START"
│       ├── UpcomingEventCard.tsx                    # [Section 3] Full-width/height card with "See all" & "Join Event"
│       └── HomeLearnViews.tsx                       # Orchestrates HomeView rendering all 7 stacked full-width blocks
```

### Current Issues Breakdown

1. **Gamification Repetition & Vertical Bloat**: Four separate large cards (`LevelCard`, `MilestoneBadgePreview`, `SummaryCards`, `LeaderboardSnippet`) stack one after another. Points are duplicated across cards, two separate progress bars show the same level progression, and leaderboard occupies a full card.
2. **Stacked Landing Pages**: Lesson, Challenge, and Event each render as full-height standalone sections with their own "See all" links, extending the scroll to ~7 viewport heights.
3. **Conflicting / Overlapping Floating Elements**:
   - `ChatbotFAB` sits fixed at `bottom: 110` with `zIndex: 999`, hovering over content and tappable actions (such as "Roadmap" and card CTAs) while the top search bar already provides an entry point to EcoBud AI.
   - Settings & Security is currently buried in `ProfileView`, with no top navbar access on Home.
4. **Equal CTA Weight**: Every section has an identical primary green button; the user is not guided toward today's most important task (e.g. logging daily habit).
5. **Layout Shifts & Scroll Settling**: Offscreen card images lack pre-computed aspect ratios; horizontal feeds lack momentum snap alignment.

---

## Proposed Consolidated Architecture

```
HomeView
├── TopNavbar (with Settings gear icon added to header action cluster)
├── Greeting & Eco Greeting Badge
├── AI Assistant Search Bar ("Ask EcoBud AI a question...")
├── QuickActions (Emphasizes "Log Habit" as Primary Hero CTA if habit not completed today)
├── UnifiedProgressCard [CONSOLIDATED GAMIFICATION]
│   ├── Top Row: Level & Points Headline ("LEVEL 1 ECO SEEDLING • 40 PTS") + "Roadmap" pill
│   ├── Single Unified Progress Bar (Progress toward Level 2 Eco Learner • 60 XP to next)
│   ├── Inline Stats Row:
│   │   ├── Streak Chip: 🔥 3 Days (tappable -> streak details overlay)
│   │   └── Leaderboard Strip: 🏆 #2 this week • 1 spot from top (tappable -> leaderboard overlay)
├── ForYouFeed [CONSOLIDATED HORIZONTAL FEED]
│   ├── Section Header: "For You" + "Explore all" (contextual filter/links)
│   └── Horizontal Snap ScrollView (momentum snap, fixed aspect ratios, 60fps)
│       ├── Compact Feed Card: Lesson ("Start Learning" / "Review")
│       ├── Compact Feed Card: Challenge ("Open" / "Start")
│       └── Compact Feed Card: Event ("Join" / "Details")
└── Bottom safe padding (BottomTabBar remains statically fixed in MobileShell)
```

---

## Proposed Changes by Component

### 1. Header & Navigation Refactor
#### [MODIFY] [Header.tsx](file:///c:/xampp/htdocs/Ecobud/apps/mobile/src/app/components/Header.tsx)
- Add `onSettingsPress?: () => void;` to `HeaderProps`.
- Render a settings gear icon (`Ionicons name="settings-outline"`) in the top navbar's right action cluster alongside notifications.
- This permanently eliminates floating gear/settings overlap issues and scopes it cleanly into the header.

#### [MODIFY] [CommonComponents.tsx](file:///c:/xampp/htdocs/Ecobud/apps/mobile/src/app/components/CommonComponents.tsx)
- In `TopNavbar`, pass `onSettingsPress={() => model.setActiveOverlay('settings')}` to `Header`.

#### [MODIFY] [EcoBudApp.tsx](file:///c:/xampp/htdocs/Ecobud/apps/mobile/src/app/EcoBudApp.tsx)
- Hide `ChatbotFAB` when on the `'home'` tab (or completely remove floating FAB in favor of the discoverable top AI search bar).

---

### 2. Gamification Widget Consolidation
#### [NEW] [UnifiedProgressCard.tsx](file:///c:/xampp/htdocs/Ecobud/apps/mobile/src/app/components/UnifiedProgressCard.tsx)
- Merges `LevelCard`, `MilestoneBadgePreview`, `SummaryCards`, and `LeaderboardSnippet` into a single, compact, high-efficiency card:
  - **Headline**: Current Level Badge & Title ("LEVEL 1 • Eco Seedling") alongside Total Eco Points ("40 pts").
  - **Single Progress Bar**: Clear progress toward next milestone ("Eco Learner", percentage, remaining XP to next tier) with smooth animated fill.
  - **Inline Stat Chips**:
    - **Streak Pill**: Flame indicator + streak count ("3 days" or "Start streak") that opens `streakUnlocked` overlay on press.
    - **Weekly Leaderboard Strip**: One-line interactive chip ("#2 this week — 1 spot from the top") with right arrow that opens `leaderboard` overlay on press.
  - **Roadmap Link**: Clean header pill linking to `ecoLevels` overlay.
  - Removes duplicate points counters and drops the second redundant progress bar.

---

### 3. Horizontal "For You" Feed Consolidation
#### [NEW] [ForYouFeed.tsx](file:///c:/xampp/htdocs/Ecobud/apps/mobile/src/app/components/ForYouFeed.tsx)
- Replaces the 3 vertically-stacked, full-viewport sections (Lesson, Challenge, Event) with one unified horizontal feed:
  - **Single Section Header**: "For You" with a "See all" shortcut.
  - **Standardized Card Dimensions**: Uniform card width (~`scale(280)`) and height (~`verticalScale(260)`), eliminating layout shifts.
  - **Card Layout**:
    - Top media area: Fixed-height banner image with fallback icon and category/type badge (e.g. "LESSON", "CHALLENGE", "EVENT").
    - Content body: Title (max 2 lines), one-line description, and reward pill (e.g. "+15 pts").
    - Action CTA: Styled with secondary weight (outline / subdued background) unless chosen as the session's primary CTA.
  - **Momentum Snap Scrolling**:
    - Configured with `horizontal`, `snapToInterval={cardWidth + gap}`, `decelerationRate="fast"`, `showsHorizontalScrollIndicator={false}`, and `snapToAlignment="start"`.

---

### 4. Clear Primary Action & Hierarchy
#### [MODIFY] [QuickActions.tsx](file:///c:/xampp/htdocs/Ecobud/apps/mobile/src/app/components/QuickActions.tsx)
- Support an `isPrimaryHabitAction` prop based on `model.todaysCompletedHabits === 0` (or uncompleted daily habits).
- When habit is not yet logged today:
  - "Log Habit" card receives visual emphasis (elevated card, brand primary accent border, subtle "Next Step" pill).
  - Feed cards in `ForYouFeed` use secondary/outline styling so the user's focus is immediately drawn to logging their daily habit first.

---

### 5. Home View Assembly & Scroll Reduction
#### [MODIFY] [HomeLearnViews.tsx](file:///c:/xampp/htdocs/Ecobud/apps/mobile/src/app/components/HomeLearnViews.tsx)
- Replace lines 192–307 in `HomeView` with:
  1. `<QuickActions model={model} isHabitPending={isHabitPending} />`
  2. `<UnifiedProgressCard model={model} ecoPoints={ecoPoints} currentStreak={currentStreak} />`
  3. `<ForYouFeed model={model} featuredLesson={featuredLesson} challenge={firstDiscoverChallenge} event={featuredEvent} />`
- Reduces total homepage scroll from ~7 screen heights down to ~2–2.5 screen heights.

---

## Verification Plan

### Automated & Static Verification
1. **Type Checking**:
   - Run `npx tsc --noEmit` in `apps/mobile` to ensure zero TypeScript errors with new components and props.
2. **Linting**:
   - Verify code syntax and style matches repository conventions.

### Manual & Performance Verification
1. **Scroll Length Verification**:
   - Confirm the homepage fits cleanly within ~2 to 2.5 mobile screen heights.
2. **Z-Index & Floating Overlap Check**:
   - Verify that no floating button obscures "Roadmap", "Start Learning", or "OPEN".
   - Confirm Settings gear in `Header` opens `model.setActiveOverlay('settings')` without any UI collisions.
3. **Feed Snap Scrolling**:
   - Verify momentum snap scrolling on horizontal cards settles precisely on card boundaries.
4. **Primary CTA Visual Distinction**:
   - Test both states: habit uncompleted (Log Habit highlighted) vs. habit completed (clean balanced state).
