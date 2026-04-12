import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { SessionPayload } from './types/home';

type GuestViewerTab = 'home' | 'learn' | 'challenges' | 'tracker' | 'profile';
type GuestViewerOverlay =
  | 'assistant'
  | 'events'
  | 'lesson'
  | 'leaderboard'
  | 'rewards'
  | 'transparency'
  | null;

export type ReadOnlyAccessSession = SessionPayload & {
  user: SessionPayload['user'] & {
    role: 'guest';
  };
};

const readOnlyRestrictedTabs: GuestViewerTab[] = ['learn', 'challenges', 'tracker'];
const readOnlyRestrictedOverlays: Exclude<GuestViewerOverlay, null>[] = [
  'assistant',
  'lesson',
  'leaderboard',
  'rewards',
];

export const createReadOnlySession = (): ReadOnlyAccessSession => ({
  token: '',
  redirectPath: '/guest',
  user: {
    id: 'guest-viewer',
    name: 'Guest Viewer',
    email: 'guest@viewer.local',
    role: 'guest',
    status: 'active',
    points: 0,
    currentStreak: 0,
    displayName: 'Guest Viewer',
    avatarUrl: null,
  },
});

export const isReadOnlySession = (
  value: SessionPayload | null | undefined,
): value is ReadOnlyAccessSession => Boolean(value && value.user.role === 'guest');

export const isReadOnlyRestrictedTab = (tab: string) =>
  readOnlyRestrictedTabs.includes(tab as GuestViewerTab);

export const isReadOnlyRestrictedOverlay = (overlay: string | null) =>
  overlay != null &&
  readOnlyRestrictedOverlays.includes(overlay as Exclude<GuestViewerOverlay, null>);

export const showReadOnlyAccessAlert = () => {
  Alert.alert(
    'Guest Viewer',
    'Guest viewer can browse public events and transparency updates. Sign in to unlock lessons, challenges, streaks, and assistant chat.',
  );
};

interface GuestViewerEvent {
  title: string;
  description: string;
  location: string;
  date: string;
  imageUrl?: string | null;
}

interface GuestViewerMetrics {
  totalActions: number;
  activeParticipants: number;
}

interface GuestViewerProps {
  activeTab: GuestViewerTab;
  notificationCount: number;
  featuredEvent?: GuestViewerEvent | null;
  transparencyMetrics?: GuestViewerMetrics | null;
  onOpenEvents: () => void;
  onOpenTransparency: () => void;
  onExitReadOnlyExperience: () => void;
}

export function GuestViewer({
  activeTab,
  notificationCount,
  featuredEvent,
  transparencyMetrics,
  onOpenEvents,
  onOpenTransparency,
  onExitReadOnlyExperience,
}: GuestViewerProps) {
  if (activeTab === 'profile') {
    return (
      <>
        <GuestTopBar notificationCount={notificationCount} />
        <View style={styles.content}>
          <View style={styles.profileCard}>
            <View style={styles.profileIconWrap}>
              <Ionicons name="eye-outline" size={30} color="#126027" />
            </View>
            <Text style={styles.pointsLabel}>GUEST VIEWER</Text>
            <Text style={styles.profileTitle}>You are browsing public pages only</Text>
            <Text style={styles.profileText}>
              Sign in or create an account to start lessons, join challenges, track habits, chat with EcoBud, and earn rewards.
            </Text>
            <PrimaryActionButton
              label="Sign In or Create Account"
              onPress={onExitReadOnlyExperience}
              style={styles.profilePrimaryButton}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionHeadline}>What guests can view</Text>
            <Text style={styles.metaText}>Public eco events</Text>
            <Text style={styles.metaText}>Transparency metrics and verified activity logs</Text>
            <Text style={styles.metaText}>Community landing experience</Text>
          </View>

          <View style={styles.actionStack}>
            <SecondaryActionButton label="View Public Events" onPress={onOpenEvents} />
            <SecondaryActionButton label="Open Transparency Feed" onPress={onOpenTransparency} />
          </View>

          <View style={styles.bottomSpacer} />
        </View>
      </>
    );
  }

  return (
    <>
      <GuestTopBar notificationCount={notificationCount} />
      <View style={styles.content}>
        <Text style={styles.label}>GUEST VIEWER</Text>
        <Text style={styles.title}>Explore ECOBUD</Text>
        <Text style={styles.subtitle}>
          Browse public eco events and verified transparency updates. Sign in when you are ready to unlock lessons, challenges, streaks, and rewards.
        </Text>

        <View style={styles.metricRow}>
          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: '#EDF6F1' }]}>
              <Ionicons name="leaf" size={18} color="#126027" />
            </View>
            <Text style={styles.metricValue}>{transparencyMetrics?.totalActions ?? 0}</Text>
            <Text style={styles.metricLabel}>PUBLIC ACTIONS</Text>
          </View>
          <View style={styles.metricCard}>
            <View style={styles.metricIconWrap}>
              <Ionicons name="people" size={18} color="#126027" />
            </View>
            <Text style={styles.metricValue}>{transparencyMetrics?.activeParticipants ?? 0}</Text>
            <Text style={styles.metricLabel}>ACTIVE MEMBERS</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>PUBLIC ACCESS</Text>
          <Text style={styles.cardTitle}>Read-only guest mode</Text>
          <Text style={styles.cardText}>
            You can view events and transparency records here, but learning paths, challenges, streak tracking, and assistant chat stay locked until you sign in.
          </Text>
          <View style={styles.buttonRow}>
            <PrimaryQuickButton label="View Events" onPress={onOpenEvents} />
            <OutlineQuickButton label="Transparency" onPress={onOpenTransparency} />
          </View>
        </View>

        {featuredEvent ? (
          <View style={styles.eventCard}>
            {featuredEvent.imageUrl ? (
              <Image source={{ uri: featuredEvent.imageUrl }} style={styles.eventImage} />
            ) : (
              <LinearGradient
                colors={['#126027', '#1F7A3A']}
                style={[styles.eventImage, styles.eventImageFallback]}
              >
                <Ionicons name="leaf" size={30} color="#FFFFFF" />
              </LinearGradient>
            )}
            <View style={styles.eventBody}>
              <Text style={styles.label}>UPCOMING EVENT</Text>
              <Text style={styles.eventTitle}>{featuredEvent.title}</Text>
              <Text style={styles.metaText}>{featuredEvent.description}</Text>
              <View style={styles.rowMeta}>
                <Ionicons name="calendar" size={14} color="#6B7A75" />
                <Text style={styles.metaText}> {formatLongDate(featuredEvent.date)}</Text>
              </View>
              <View style={[styles.rowMeta, styles.eventLocation]}>
                <Ionicons name="location" size={14} color="#6B7A75" />
                <Text style={styles.metaText}> {featuredEvent.location}</Text>
              </View>
              <PrimaryQuickButton
                label="Browse Event Details"
                onPress={onOpenEvents}
                fullWidth
              />
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.label}>READY TO PARTICIPATE?</Text>
          <Text style={styles.eventTitle}>Create an account to start your eco journey.</Text>
          <Text style={styles.metaText}>
            Members can take lessons, complete challenges, join events, track habits, and earn ECO points.
          </Text>
          <SecondaryActionButton
            label="Sign In or Create Account"
            onPress={onExitReadOnlyExperience}
            style={styles.ctaButton}
          />
        </View>

        <View style={styles.bottomSpacer} />
      </View>
    </>
  );
}

function GuestTopBar({ notificationCount }: { notificationCount: number }) {
  return (
    <View style={styles.topBar}>
      <View style={styles.avatarCircle}>
        <Ionicons name="leaf" size={18} color="#126027" />
      </View>
      <Text style={styles.topBarTitle}>ECOBUD</Text>
      <View style={styles.notificationWrap}>
        <Ionicons name="notifications" size={24} color="#126027" />
        {notificationCount > 0 ? <View style={styles.notificationBadge} /> : null}
      </View>
    </View>
  );
}

function PrimaryActionButton({
  label,
  onPress,
  style,
}: {
  label: string;
  onPress: () => void;
  style?: object;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.primaryActionButton, style]}>
      <LinearGradient
        colors={['#0B5F58', '#169070', '#69CDA8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryActionGradient}
      >
        <Text style={styles.primaryActionText}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function SecondaryActionButton({
  label,
  onPress,
  style,
}: {
  label: string;
  onPress: () => void;
  style?: object;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.secondaryActionButton, style]}>
      <Text style={styles.secondaryActionText}>{label}</Text>
    </TouchableOpacity>
  );
}

function PrimaryQuickButton({
  label,
  onPress,
  fullWidth = false,
}: {
  label: string;
  onPress: () => void;
  fullWidth?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.quickPrimaryButton, fullWidth && styles.quickPrimaryButtonFull]}
    >
      <Text style={styles.quickPrimaryButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

function OutlineQuickButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.quickOutlineButton}>
      <Text style={styles.quickOutlineButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

function formatLongDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  topBar: {
    marginTop: 22,
    paddingHorizontal: 24,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ECFAEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: 3.2,
    color: '#1A211D',
    marginHorizontal: 12,
  },
  notificationWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF6B57',
    borderWidth: 2,
    borderColor: '#F7F9F7',
  },
  content: {
    paddingHorizontal: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: '#126027',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#1A211D',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 24,
    color: '#6B7A75',
    marginBottom: 24,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#126027',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  metricIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F5F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  metricValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1A211D',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7A75',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#126027',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#126027',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A211D',
    marginBottom: 10,
  },
  cardText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#6B7A75',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  quickPrimaryButton: {
    flex: 1,
    backgroundColor: '#EDF6F1',
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  quickPrimaryButtonFull: {
    flex: 0,
    width: '100%',
  },
  quickPrimaryButtonText: {
    color: '#126027',
    fontSize: 14,
    fontWeight: '800',
  },
  quickOutlineButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#4ADE80',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  quickOutlineButtonText: {
    color: '#126027',
    fontSize: 14,
    fontWeight: '800',
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#126027',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  eventImage: {
    width: '100%',
    height: 160,
  },
  eventImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventBody: {
    padding: 20,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A211D',
    marginBottom: 8,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  eventLocation: {
    marginBottom: 16,
  },
  metaText: {
    fontSize: 14,
    color: '#6B7A75',
    lineHeight: 22,
  },
  ctaButton: {
    marginTop: 16,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#126027',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    marginBottom: 24,
  },
  profileIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EDF6F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  pointsLabel: {
    color: '#126027',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
  },
  profileTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A211D',
    textAlign: 'center',
    marginBottom: 10,
  },
  profileText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#6B7A75',
    textAlign: 'center',
  },
  profilePrimaryButton: {
    marginTop: 20,
  },
  sectionHeadline: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A211D',
    marginBottom: 12,
  },
  actionStack: {
    gap: 12,
    marginTop: 20,
  },
  primaryActionButton: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#126027',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  primaryActionGradient: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  secondaryActionButton: {
    width: '100%',
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D6E9DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  secondaryActionText: {
    color: '#126027',
    fontSize: 14,
    fontWeight: '800',
  },
  bottomSpacer: {
    height: 100,
  },
});
