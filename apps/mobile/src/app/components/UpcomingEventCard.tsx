import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RejectionModal } from './RejectionModal';
import { type UpcomingEventCardProps } from '../types/home';
import { ecobudApiOrigin } from '../../shared/api/ecobudApi';
import { formatEventDateTag, getEventLifecycleStatus } from '../utils/appUtils';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../utils/responsive';

export function UpcomingEventCard({
  event,
  isReadOnly,
  onJoin,
  onSignIn,
  onRecordAttendance,
  onClaimReward,
}: UpcomingEventCardProps) {
  const [rejectionModal, setRejectionModal] = React.useState<{ visible: boolean; reason: string }>({
    visible: false,
    reason: '',
  });

  const defaultImage =
    'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=800&auto=format&fit=crop';
  const imageUrl = event.imageUrl
    ? event.imageUrl.startsWith('http')
      ? event.imageUrl
      : `${ecobudApiOrigin}${event.imageUrl}`
    : defaultImage;

  const lifecycle = getEventLifecycleStatus(event.startDatetime, event.endDatetime);
  let statusText = 'UPCOMING';
  if (lifecycle === 'ongoing') statusText = 'ONGOING';
  if (lifecycle === 'ended') statusText = 'ENDED';

  const capacity = event.capacity || 0;
  const spotsLeft = typeof event.spotsLeft === 'number' ? event.spotsLeft : capacity;
  const joinedCount = Math.max(0, capacity - spotsLeft);
  const progressPercent =
    capacity > 0 ? Math.min(100, Math.max(0, Math.round((joinedCount / capacity) * 100))) : 0;
  const isFull = spotsLeft <= 0;

  const renderActionBtn = () => {
    if (lifecycle === 'ended' && !event.userStatus) {
      return (
        <View style={[styles.quickJoinBtn, { backgroundColor: '#F0F0F0' }]}>
          <Text style={[styles.quickJoinBtnText, { color: '#999' }]}>Event Ended</Text>
        </View>
      );
    }

    if (isReadOnly) {
      return (
        <TouchableOpacity style={styles.quickJoinBtn} onPress={onSignIn}>
          <Text style={styles.quickJoinBtnText}>Sign In to Join</Text>
        </TouchableOpacity>
      );
    }

    if (event.userStatus === 'reward_claimed') {
      return (
        <View style={[styles.quickJoinBtn, { backgroundColor: 'rgba(18,96,39,0.15)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }]}>
          <Ionicons name="checkmark-circle" size={scale(15)} color="#126027" />
          <Text style={[styles.quickJoinBtnText, { color: '#126027' }]}>Reward Claimed</Text>
        </View>
      );
    }

    if (event.userStatus === 'attended') {
      return (
        <TouchableOpacity
          style={[styles.quickJoinBtn, { backgroundColor: '#F59E0B' }]}
          onPress={onClaimReward}
        >
          <Text style={[styles.quickJoinBtnText, { color: '#FFF' }]}>Claim Reward</Text>
        </TouchableOpacity>
      );
    }

    if (event.userStatus === 'rejected') {
      return (
        <TouchableOpacity
          style={[styles.quickJoinBtn, { backgroundColor: '#DC2626' }]}
          onPress={() => {
            setRejectionModal({
              visible: true,
              reason: event.rejectionReason || 'No reason provided.',
            });
          }}
        >
          <Text style={[styles.quickJoinBtnText, { color: '#FFF' }]}>Rejected - Resubmit</Text>
        </TouchableOpacity>
      );
    }

    if (event.userStatus === 'pending_approval') {
      return (
        <View style={[styles.quickJoinBtn, { backgroundColor: '#FEF3C7' }]}>
          <Text style={[styles.quickJoinBtnText, { color: '#92400E' }]}>Waiting for Approval</Text>
        </View>
      );
    }

    if (event.userStatus === 'joined') {
      if (lifecycle === 'ongoing') {
        return (
          <TouchableOpacity
            style={[styles.quickJoinBtn, { backgroundColor: '#126027' }]}
            onPress={onRecordAttendance}
          >
            <Text style={[styles.quickJoinBtnText, { color: '#FFF' }]}>Submit Picture & Scan QR</Text>
          </TouchableOpacity>
        );
      } else {
        return (
          <View style={[styles.quickJoinBtn, { backgroundColor: '#E0EBE4' }]}>
            <Text style={[styles.quickJoinBtnText, { color: '#126027' }]}>Joined - Starts Soon</Text>
          </View>
        );
      }
    }

    if (lifecycle === 'ongoing') {
      return (
        <View style={[styles.quickJoinBtn, { backgroundColor: '#F0F0F0' }]}>
          <Text style={[styles.quickJoinBtnText, { color: '#999' }]}>Registration Closed</Text>
        </View>
      );
    }

    if (isFull) {
      return (
        <View style={[styles.quickJoinBtn, { backgroundColor: '#F0F0F0' }]}>
          <Text style={[styles.quickJoinBtnText, { color: '#999' }]}>Event Full</Text>
        </View>
      );
    }

    return (
      <TouchableOpacity style={styles.quickJoinBtn} onPress={onJoin}>
        <Text style={styles.quickJoinBtnText}>Join Event</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.eventListCard, event.isFeatured && styles.featuredCardBorder]}>
      <ImageBackground
        source={{ uri: imageUrl }}
        style={styles.eventListImg}
        imageStyle={{ borderTopLeftRadius: moderateScale(24), borderTopRightRadius: moderateScale(24) }}
      >
        <View style={styles.badgesContainer}>
          {event.isFeatured && (
            <View style={styles.featuredBadge}>
              <Ionicons name="star" size={scale(11)} color="#FFF" />
              <Text style={styles.featuredBadgeText}>FEATURED</Text>
            </View>
          )}
          <View
            style={[
              styles.statusBadge,
              lifecycle === 'ongoing'
                ? styles.tagRed
                : lifecycle === 'ended'
                ? styles.tagGray
                : styles.tagDark,
            ]}
          >
            <Text style={styles.statusBadgeText}>{statusText}</Text>
          </View>
        </View>
        <View style={styles.dateTagRight}>
          <Text style={styles.dateTagRightText}>{formatEventDateTag(event.startDatetime)}</Text>
        </View>
      </ImageBackground>

      <View style={styles.eventListBody}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: verticalScale(2) }}>
          {event.isFeatured && <Ionicons name="star" size={scale(11)} color="#F59E0B" />}
          <Text style={[styles.welcomeLabel, event.isFeatured && styles.welcomeLabelFeatured, { marginBottom: 0 }]}>
            {event.isFeatured ? 'FEATURED EVENT' : 'PUBLIC EVENT'}
          </Text>
        </View>
        <Text style={styles.cardTitle}>{event.title}</Text>
        <Text style={styles.metaTextSmallDark}>{event.description}</Text>

        <View style={[styles.rowMeta, { marginTop: verticalScale(10) }]}>
          <Ionicons name="location" size={scale(14)} color="#6B7A75" />
          <Text style={styles.metaTextSmallDark}> {event.location}</Text>
        </View>

        <View
          style={[
            styles.rowMeta,
            {
              marginTop: verticalScale(4),
              marginBottom: event.ecoCoinsReward ? verticalScale(4) : verticalScale(10),
            },
          ]}
        >
          <Ionicons name="leaf-outline" size={scale(14)} color="#10B981" />
          <Text style={styles.metaTextSmallDark}> {event.expReward} ECO points reward</Text>
        </View>

        {!!event.ecoCoinsReward && event.ecoCoinsReward > 0 && (
          <View style={[styles.rowMeta, { marginBottom: verticalScale(10) }]}>
            <Image
              source={require('../../../assets/coin.png')}
              style={{ width: scale(14), height: scale(14), resizeMode: 'contain' }}
            />
            <Text style={styles.metaTextSmallDark}> {event.ecoCoinsReward} ECO coins reward</Text>
          </View>
        )}

        {capacity > 0 && (
          <View style={styles.capacitySection}>
            <View style={styles.capacityRow}>
              <View style={styles.capacityLeft}>
                <Ionicons name="people-outline" size={scale(14)} color="#6B7A75" />
                <Text style={styles.capacityText}>
                  Capacity: <Text style={styles.capacityCountText}>{joinedCount}/{capacity}</Text>{' '}
                  <Text style={styles.spotsLeftText}>({isFull ? 'Full' : `${spotsLeft} spots left`})</Text>
                </Text>
              </View>
              <Text
                style={[
                  styles.capacityPercentText,
                  { color: isFull ? '#DC2626' : progressPercent >= 80 ? '#D97706' : '#126027' },
                ]}
              >
                {progressPercent}%
              </Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${progressPercent}%`,
                    backgroundColor: isFull ? '#DC2626' : progressPercent >= 80 ? '#F59E0B' : '#126027',
                  },
                ]}
              />
            </View>
          </View>
        )}

        <View style={{ marginTop: verticalScale(12) }}>{renderActionBtn()}</View>

        <RejectionModal
          visible={rejectionModal.visible}
          title="Attendance Rejected"
          reason={rejectionModal.reason}
          onClose={() => setRejectionModal(prev => ({ ...prev, visible: false }))}
          onResubmit={
            lifecycle === 'ongoing'
              ? () => {
                  if (onRecordAttendance) onRecordAttendance();
                }
              : undefined
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  eventListCard: {
    backgroundColor: '#FFF',
    borderRadius: moderateScale(24),
    overflow: 'hidden',
    marginBottom: verticalScale(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#EEF2F0',
  },
  featuredCardBorder: {
    borderColor: '#FCD34D',
    borderWidth: 1.5,
    shadowColor: '#F59E0B',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  eventListImg: {
    width: '100%',
    height: verticalScale(160),
    position: 'relative',
  },
  badgesContainer: {
    position: 'absolute',
    left: scale(14),
    top: verticalScale(14),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    zIndex: 2,
  },
  featuredBadge: {
    backgroundColor: '#F59E0B',
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(5),
    borderRadius: moderateScale(10),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  featuredBadgeText: {
    color: '#FFF',
    fontSize: responsiveFontSize(10),
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  statusBadge: {
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(5),
    borderRadius: moderateScale(10),
  },
  tagDark: {
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  tagRed: {
    backgroundColor: 'rgba(220,38,38,0.85)',
  },
  tagGray: {
    backgroundColor: 'rgba(100,116,139,0.85)',
  },
  statusBadgeText: {
    color: '#FFF',
    fontSize: responsiveFontSize(10),
    fontWeight: '800',
    letterSpacing: 1,
  },
  dateTagRight: {
    position: 'absolute',
    right: scale(14),
    top: verticalScale(14),
    backgroundColor: '#FFF',
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(6),
    borderRadius: moderateScale(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  dateTagRightText: {
    color: '#1A211D',
    fontSize: responsiveFontSize(12),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  eventListBody: {
    padding: scale(18),
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(4),
  },
  welcomeLabel: {
    fontSize: responsiveFontSize(11),
    fontWeight: '800',
    color: '#126027',
    letterSpacing: 1.2,
    marginBottom: verticalScale(4),
  },
  welcomeLabelFeatured: {
    color: '#D97706',
  },
  cardTitle: {
    fontSize: responsiveFontSize(18),
    fontWeight: '800',
    color: '#1A211D',
    marginBottom: verticalScale(4),
    lineHeight: responsiveFontSize(24),
  },
  metaTextSmallDark: {
    fontSize: responsiveFontSize(13),
    color: '#4B5563',
    lineHeight: responsiveFontSize(18),
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  capacitySection: {
    marginTop: verticalScale(12),
    backgroundColor: '#F7FAF8',
    padding: scale(10),
    borderRadius: moderateScale(12),
    borderWidth: 1,
    borderColor: '#EAF0EC',
  },
  capacityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(6),
  },
  capacityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  capacityText: {
    fontSize: responsiveFontSize(12),
    color: '#6B7A75',
    fontWeight: '500',
  },
  capacityCountText: {
    fontWeight: '700',
    color: '#1A211D',
  },
  spotsLeftText: {
    fontSize: responsiveFontSize(11),
    color: '#6B7A75',
    fontWeight: '500',
  },
  capacityPercentText: {
    fontSize: responsiveFontSize(12),
    fontWeight: '800',
  },
  progressBarTrack: {
    height: verticalScale(6),
    width: '100%',
    backgroundColor: '#E2EAE5',
    borderRadius: moderateScale(3),
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: moderateScale(3),
  },
  quickJoinBtn: {
    backgroundColor: '#EDF6F1',
    paddingVertical: verticalScale(12),
    borderRadius: moderateScale(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickJoinBtnText: {
    color: '#126027',
    fontSize: responsiveFontSize(14),
    fontWeight: '800',
  },
});

