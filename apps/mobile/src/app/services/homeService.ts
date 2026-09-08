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

  googleLogin: (payload: { accessToken: string; email: string; displayName?: string; avatarUrl?: string; city?: string }) =>
    ecobudApi.googleLogin(payload),

  checkEmail: (email: string, accessToken: string) =>
    ecobudApi.checkEmailExists(email.trim(), accessToken),

  register: (email: string, pass: string, username: string, city: string, otpCode: string) =>
    ecobudApi.register(email.trim(), pass, username.trim(), city, otpCode.trim()),

  sendOTP: (email: string) =>
    ecobudApi.sendOTP(email.trim()),

  checkUsername: (displayName: string) =>
    ecobudApi.checkUsernameAvailability(displayName.trim()),

  // ─── Data Fetching ─────────────────────────────────────────────────────────────

  getDashboard: (token: string) =>
    ecobudApi.fetchDashboard(token),

  getLessons: (token: string) =>
    ecobudApi.fetchLessons(token).then((res: any) => (Array.isArray(res) ? res : res?.items || [])),

  getChallenges: (token: string) =>
    ecobudApi.fetchChallenges(token).then((res: any) => ({
      items: Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [],
      isCycleActive: res?.isCycleActive ?? true,
    })),

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

  getEvents: (token?: string) =>
    ecobudApi.fetchEvents(token).then((res: any) => (Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [])),

  getTransparency: (token: string) =>
    ecobudApi.fetchTransparency(token),

  getPublicTransparency: () =>
    ecobudApi.fetchPublicTransparency(),

  uploadAvatar: (token: string, uri: string) =>
    ecobudApi.uploadAvatar(token, uri),

  updateProfile: (token: string, payload: { displayName?: string; email?: string; city?: string }) =>
    ecobudApi.updateProfile(token, payload),

  updateSecuritySettings: (token: string, payload: { currentPassword: string; newEmail?: string; emailCode?: string; newPassword?: string }) =>
    ecobudApi.updateSecuritySettings(token, payload),

  // ─── Actions ───────────────────────────────────────────────────────────────────

  completeLesson: (token: string, lessonId: string, answers?: Record<string, string>) =>
    ecobudApi.completeLesson(token, lessonId, answers),

  updateLessonProgress: (token: string, lessonId: string, progress: number, videoTimestamp?: number) =>
    ecobudApi.updateLessonProgress(token, lessonId, progress, videoTimestamp),

  markLessonSeen: (token: string, lessonId: string) =>
    ecobudApi.markLessonSeen(token, lessonId),

  updateChallengeProgress: (token: string, challengeId: string, progressPercentage: number) =>
    ecobudApi.updateChallengeProgress(token, challengeId, progressPercentage),

  analyzeChallengeImage: (token: string, challengeId: string, uri: string) =>
    ecobudApi.analyzeChallengeImage(token, challengeId, uri),

  uploadChallengeProofImage: (token: string, challengeId: string, uri: string) =>
    ecobudApi.uploadChallengeProofImage(token, challengeId, uri),

  submitChallengeProof: (token: string, challengeId: string, proofUrl: string, afterProofUrl?: string, detectedQuantity?: number, analysisToken?: string, proofText?: string) =>
    ecobudApi.submitChallengeProof(token, challengeId, proofUrl, afterProofUrl, detectedQuantity, analysisToken, proofText),

  verifyChallengeQr: (token: string, challengeId: string, qrData: string, latitude?: number, longitude?: number, submissionId?: string) =>
    ecobudApi.verifyChallengeQr(token, challengeId, qrData, latitude, longitude, submissionId),

  submitChallengeAfterPhoto: (token: string, challengeId: string, afterProofUrl: string, submissionId?: string) =>
    ecobudApi.submitChallengeAfterPhoto(token, challengeId, afterProofUrl, submissionId),

  claimChallengeReward: (token: string, challengeId: string, submissionId?: string) =>
    ecobudApi.claimChallengeReward(token, challengeId, submissionId),

  checkInHabit: (token: string, habitId: string) =>
    ecobudApi.checkInHabit(token, habitId),

  joinEvent: (token: string, eventId: string) =>
    ecobudApi.joinEvent(token, eventId),

  sendAssistantMessage: (token: string, message: string, history: { role: 'user' | 'assistant'; content: string }[] = []) =>
    ecobudApi.sendAssistantMessage(token, message, history),

  submitEventAttendance: (token: string, eventId: string, imageUri: string, qrData: string) =>
    ecobudApi.submitEventAttendance(token, eventId, imageUri, qrData),

  claimEventReward: (token: string, eventId: string) =>
    ecobudApi.claimEventReward(token, eventId),

  // ─── Composite Loaders ────────────────────────────────────────────────────────

  /**
   * Fetches only the critical data required for the Home Screen immediately.
   * Keeps network bandwidth lean and reduces time-to-interactive.
   */
  async getHomeCriticalData(token: string) {
    const [
      dashboard,
      lessons,
      challenges,
      habitsToday,
      events,
    ] = await Promise.all([
      this.getDashboard(token).catch(() => null),
      this.getLessons(token).catch(() => []),
      this.getChallenges(token).catch(() => ({ items: [], isCycleActive: true })),
      this.getHabitsToday(token).catch(() => null),
      this.getEvents(token).catch(() => []),
    ]);

    return {
      dashboard: dashboard || null,
      lessons: Array.isArray(lessons) ? lessons : (lessons as any)?.items || [],
      challenges: Array.isArray((challenges as any)?.items) ? (challenges as any).items : Array.isArray(challenges) ? challenges : [],
      isCycleActive: (challenges as any)?.isCycleActive ?? true,
      habitsToday: habitsToday || null,
      events: Array.isArray(events) ? events : (events as any)?.items || [],
    };
  },

  /**
   * Fetches non-critical secondary data for other tabs in the background.
   */
  async getSecondaryHydrationData(token: string) {
    const [
      tracker,
      profile,
      rewards,
      leaderboard,
      transparency,
    ] = await Promise.all([
      this.getTracker(token).catch(() => null),
      this.getProfile(token).catch(() => null),
      this.getRewards(token).catch(() => null),
      this.getLeaderboard(token).catch(() => null),
      this.getTransparency(token).catch(() => null),
    ]);

    return {
      tracker: tracker || null,
      profile: profile || null,
      rewards: rewards || null,
      leaderboard: leaderboard || null,
      transparency: transparency || null,
    };
  },

  /**
   * Fetches all required data for a full member session.
   */
  async getFullHydrationData(token: string) {
    const [homeData, secondaryData] = await Promise.all([
      this.getHomeCriticalData(token),
      this.getSecondaryHydrationData(token),
    ]);

    return {
      ...homeData,
      ...secondaryData,
    };
  }
};
