import { ecobudApi } from '../../shared/api/ecobudApi';
import {
  type ChallengeWithProgress,
  type DashboardData,
  type EcoEvent,
  type LeaderboardData,
  type LessonWithProgress,
  type ProfileData,
  type RewardsData,
  type SessionPayload,
  type TrackerData,
  type TransparencyFeed,
} from '../types/home';

export const homeService = {
  // ─── Auth ───────────────────────────────────────────────────────────────────────
  
  login: (email: string, pass: string) => 
    ecobudApi.login(email.trim(), pass),

  register: (email: string, pass: string, username: string, otpCode: string) =>
    ecobudApi.register(email.trim(), pass, username.trim(), otpCode.trim()),

  sendOTP: (email: string) =>
    ecobudApi.sendOTP(email.trim()),

  checkUsername: (displayName: string) =>
    ecobudApi.checkUsernameAvailability(displayName.trim()),

  // ─── Data Fetching ─────────────────────────────────────────────────────────────

  getDashboard: (token: string) =>
    ecobudApi.fetchDashboard(token),

  getLessons: (token: string) =>
    ecobudApi.fetchLessons(token),

  getChallenges: (token: string) =>
    ecobudApi.fetchChallenges(token).then(res => res.items),

  getHabitsToday: (token: string) =>
    ecobudApi.fetchHabitsToday(token),

  getTracker: (token: string, month?: string) =>
    ecobudApi.fetchTracker(token, month),

  getProfile: (token: string) =>
    ecobudApi.fetchProfile(token),

  getRewards: (token: string) =>
    ecobudApi.fetchRewards(token),

  getLeaderboard: (token: string) =>
    ecobudApi.fetchLeaderboard(token),

  getEvents: () =>
    ecobudApi.fetchEvents().then(res => res.items),

  getTransparency: (token: string) =>
    ecobudApi.fetchTransparency(token),

  getPublicTransparency: () =>
    ecobudApi.fetchPublicTransparency(),

  // ─── Actions ───────────────────────────────────────────────────────────────────

  completeLesson: (token: string, lessonId: string) =>
    ecobudApi.completeLesson(token, lessonId),

  updateLessonProgress: (token: string, lessonId: string, progress: number, videoTimestamp?: number) =>
    ecobudApi.updateLessonProgress(token, lessonId, progress, videoTimestamp),

  markLessonSeen: (token: string, lessonId: string) =>
    ecobudApi.markLessonSeen(token, lessonId),

  updateChallengeProgress: (token: string, challengeId: string, progressPercentage: number) =>
    ecobudApi.updateChallengeProgress(token, challengeId, progressPercentage),

  analyzeChallengeImage: (token: string, challengeId: string, uri: string) =>
    ecobudApi.analyzeChallengeImage(token, challengeId, uri),

  submitChallengeProof: (token: string, challengeId: string, proofUrl: string) =>
    ecobudApi.submitChallengeProof(token, challengeId, proofUrl),

  claimChallengeReward: (token: string, challengeId: string) =>
    ecobudApi.claimChallengeReward(token, challengeId),

  checkInHabit: (token: string, habitId: string) =>
    ecobudApi.checkInHabit(token, habitId),

  joinEvent: (token: string, eventId: string) =>
    ecobudApi.joinEvent(token, eventId),

  sendAssistantMessage: (token: string, message: string) =>
    ecobudApi.sendAssistantMessage(token, message),

  // ─── Composite Loaders ────────────────────────────────────────────────────────
  
  /**
   * Fetches all required data for a full member session.
   */
  async getFullHydrationData(token: string) {
    const [
      dashboard,
      lessons,
      challenges,
      habitsToday,
      tracker,
      profile,
      rewards,
      leaderboard,
      events,
      transparency,
    ] = await Promise.all([
      this.getDashboard(token),
      this.getLessons(token),
      this.getChallenges(token),
      this.getHabitsToday(token),
      this.getTracker(token),
      this.getProfile(token),
      this.getRewards(token),
      this.getLeaderboard(token),
      this.getEvents(),
      this.getTransparency(token),
    ]);

    return {
      dashboard,
      lessons,
      challenges,
      habitsToday,
      tracker,
      profile,
      rewards,
      leaderboard,
      events,
      transparency,
    };
  },

  /**
   * Fetches limited data for a read-only guest session.
   */
  async getReadOnlyHydrationData() {
    const [events, transparency] = await Promise.all([
      this.getEvents(),
      this.getPublicTransparency(),
    ]);

    return {
      events,
      transparency,
    };
  }
};
