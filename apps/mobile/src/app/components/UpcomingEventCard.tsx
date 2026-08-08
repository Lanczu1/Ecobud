import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RejectionModal } from './RejectionModal';
import { type UpcomingEventCardProps } from '../types/home';
import { ecobudApiOrigin } from '../../shared/api/ecobudApi';
import { getEventLifecycleStatus } from '../utils/appUtils';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../utils/responsive';

function formatLongDate(isoDate: string) {
  const date = new Date(isoDate);
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function UpcomingEventCard({ event, isReadOnly, onJoin, onSignIn, onRecordAttendance, onClaimReward }: UpcomingEventCardProps) {
  const [rejectionModal, setRejectionModal] = React.useState<{ visible: boolean; reason: string }>({ visible: false, reason: '' });
  
  const defaultImage = 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=800&auto=format&fit=crop';
  const imageUrl = event.imageUrl 
    ? (event.imageUrl.startsWith('http') ? event.imageUrl : `${ecobudApiOrigin}${event.imageUrl}`)
    : defaultImage;

  const lifecycle = getEventLifecycleStatus(event.startDatetime, event.endDatetime);
  let statusText = 'UPCOMING';
  if (lifecycle === 'ongoing') statusText = 'ONGOING';
  if (lifecycle === 'ended') statusText = 'ENDED';

  const renderActionBtn = () => {
    if (lifecycle === 'ended' && !event.userStatus) {
      return null;
    }
    
    if (isReadOnly) {
      return (
        <TouchableOpacity style={styles.eventJoinBtnInfo} onPress={onSignIn}>
          <Text style={styles.eventJoinBtnInfoText}>Sign In to Join</Text>
        </TouchableOpacity>
      );
    }
    
    if (event.userStatus === 'reward_claimed') {
      return (
        <View style={[styles.eventJoinBtnInfo, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
          <Text style={[styles.eventJoinBtnInfoText, { color: '#FFF' }]}>Reward Claimed</Text>
        </View>
      );
    }
    
    if (event.userStatus === 'attended') {
      return (
        <TouchableOpacity 
          style={[styles.eventJoinBtnInfo, { backgroundColor: '#F59E0B' }]}
          onPress={onClaimReward}
        >
          <Text style={[styles.eventJoinBtnInfoText, { color: '#FFF' }]}>Claim Reward</Text>
        </TouchableOpacity>
      );
    }
    
    if (event.userStatus === 'rejected') {
      if (lifecycle === 'ongoing') {
        return (
          <TouchableOpacity style={[styles.eventJoinBtnInfo, { backgroundColor: '#DC2626' }]} onPress={() => {
            setRejectionModal({ visible: true, reason: event.rejectionReason || 'No reason provided.' });
          }}>
            <Text style={[styles.eventJoinBtnInfoText, { color: '#FFF' }]}>Rejected - Resubmit</Text>
          </TouchableOpacity>
        );
      } else {
        return (
          <TouchableOpacity style={[styles.eventJoinBtnInfo, { backgroundColor: '#DC2626' }]} onPress={() => {
            setRejectionModal({ visible: true, reason: event.rejectionReason || 'No reason provided.' });
          }}>
            <Text style={[styles.eventJoinBtnInfoText, { color: '#FFF' }]}>Rejected</Text>
          </TouchableOpacity>
        );
      }
    }
    
    if (event.userStatus === 'pending_approval') {
      return (
        <View style={[styles.eventJoinBtnInfo, { backgroundColor: '#FFD700' }]}>
          <Text style={[styles.eventJoinBtnInfoText, { color: '#000' }]}>Waiting for Approval</Text>
        </View>
      );
    }
    
    if (event.userStatus === 'joined') {
      if (lifecycle === 'ongoing') {
        return (
          <TouchableOpacity style={[styles.eventJoinBtnInfo, { backgroundColor: '#126027' }]} onPress={onRecordAttendance}>
            <Text style={[styles.eventJoinBtnInfoText, { color: '#FFF' }]}>Submit Picture & Scan QR</Text>
          </TouchableOpacity>
        );
      } else {
        return (
          <View style={[styles.eventJoinBtnInfo, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
            <Text style={[styles.eventJoinBtnInfoText, { color: '#FFF' }]}>Joined - Starts Soon</Text>
          </View>
        );
      }
    }
    

    if (lifecycle === 'ongoing') {
      return (
        <View style={[styles.eventJoinBtnInfo, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
          <Text style={[styles.eventJoinBtnInfoText, { color: '#ccc' }]}>Registration Closed</Text>
        </View>
      );
    }
    
    return (
      <TouchableOpacity style={styles.eventJoinBtnInfo} onPress={onJoin}>
        <Text style={styles.eventJoinBtnInfoText}>Join Event</Text>
      </TouchableOpacity>
    );
  };

  return (
    <ImageBackground
      source={{ uri: imageUrl }}
      style={styles.eventFeaturedCard}
      imageStyle={{ borderRadius: moderateScale(24) }}
    >
      <View style={styles.eventFeaturedOverlay} />
      <View style={styles.featuredProgramContent}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: scale(8), marginBottom: 'auto' }}>
          <View style={lifecycle === 'ongoing' ? styles.tagRed : (lifecycle === 'ended' ? styles.tagGray : styles.tagLight)}><Text style={styles.tagLightText}>{statusText}</Text></View>
          <View style={styles.tagDark}><Text style={styles.tagDarkText}>PUBLIC EVENT</Text></View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: scale(12), marginBottom: verticalScale(6), marginTop: verticalScale(28) }}>
          <View style={styles.rowMeta}><Ionicons name="calendar" size={scale(14)} color="#FFF"/><Text style={styles.metaTextWhite}> {formatLongDate(event.startDatetime)}</Text></View>
          <View style={styles.rowMeta}><Ionicons name="location" size={scale(14)} color="#FFF"/><Text style={styles.metaTextWhite}> {event.location}</Text></View>
        </View>
        <Text style={styles.featuredProgramTitle}>{event.title}</Text>
        <Text style={styles.featuredProgramDesc}>{event.description}</Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: scale(8) }}>
          <Text style={styles.metaTextWhite}>
            {event.spotsLeft != null ? `${event.spotsLeft} spots left` : `${event.expReward} ECO points reward`}
          </Text>
          {renderActionBtn()}
        </View>

        <RejectionModal
          visible={rejectionModal.visible}
          title="Attendance Rejected"
          reason={rejectionModal.reason}
          onClose={() => setRejectionModal(prev => ({ ...prev, visible: false }))}
          onResubmit={lifecycle === 'ongoing' ? () => {
            if (onRecordAttendance) onRecordAttendance();
          } : undefined}
        />
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  eventFeaturedCard: {
    width: '100%',
    minHeight: verticalScale(320),
    borderRadius: moderateScale(24),
    overflow: 'hidden',
    justifyContent: 'flex-end',
    marginBottom: verticalScale(20),
  },
  eventFeaturedOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(26, 33, 29, 0.4)',
  },
  featuredProgramContent: {
    padding: scale(20),
  },
  tagDark: { backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: scale(10), paddingVertical: verticalScale(5), borderRadius: moderateScale(10) },
  tagDarkText: { color: '#FFF', fontSize: responsiveFontSize(10), fontWeight: '800', letterSpacing: 1 },
  tagLight: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: scale(10), paddingVertical: verticalScale(5), borderRadius: moderateScale(10) },
  tagRed: { backgroundColor: 'rgba(200,50,50,0.8)', paddingHorizontal: scale(10), paddingVertical: verticalScale(5), borderRadius: moderateScale(10) },
  tagGray: { backgroundColor: 'rgba(100,100,100,0.8)', paddingHorizontal: scale(10), paddingVertical: verticalScale(5), borderRadius: moderateScale(10) },
  tagLightText: { color: '#FFF', fontSize: responsiveFontSize(10), fontWeight: '800', letterSpacing: 1 },
  featuredProgramTitle: { fontSize: responsiveFontSize(20), fontWeight: '800', color: '#FFF', marginBottom: verticalScale(6), lineHeight: responsiveFontSize(26) },
  featuredProgramDesc: { fontSize: responsiveFontSize(13), color: 'rgba(255,255,255,0.8)', marginBottom: verticalScale(14), lineHeight: responsiveFontSize(19) },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  metaTextWhite: { fontSize: responsiveFontSize(12), color: '#FFF', fontWeight: '600' },
  eventJoinBtnInfo: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: scale(14), paddingVertical: verticalScale(10), borderRadius: moderateScale(14) },
  eventJoinBtnInfoText: { color: '#FFF', fontSize: responsiveFontSize(13), fontWeight: '800' },
});

