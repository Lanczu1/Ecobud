import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { type UpcomingEventCardProps } from '../types/home';

function formatLongDate(isoDate: string) {
  const date = new Date(isoDate);
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function UpcomingEventCard({ event, isReadOnly, onJoin, onSignIn }: UpcomingEventCardProps) {
  return (
    <ImageBackground
      source={{ uri: event.imageUrl ?? 'https://images.unsplash.com/photo-1618477461853-cf6ed80fabe5?q=80&w=800&auto=format&fit=crop' }}
      style={styles.eventFeaturedCard}
      imageStyle={{ borderRadius: 24 }}
    >
      <View style={styles.eventFeaturedOverlay} />
      <View style={styles.featuredProgramContent}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 'auto' }}>
          <View style={styles.tagLight}><Text style={styles.tagLightText}>UPCOMING</Text></View>
          <View style={styles.tagDark}><Text style={styles.tagDarkText}>PUBLIC EVENT</Text></View>
        </View>

        <View style={{flexDirection: 'row', gap: 16, marginBottom: 8, marginTop: 40}}>
          <View style={styles.rowMeta}><Ionicons name="calendar" size={14} color="#FFF"/><Text style={styles.metaTextWhite}> {formatLongDate(event.date)}</Text></View>
          <View style={styles.rowMeta}><Ionicons name="location" size={14} color="#FFF"/><Text style={styles.metaTextWhite}> {event.location}</Text></View>
        </View>
        <Text style={styles.featuredProgramTitle}>{event.title}</Text>
        <Text style={styles.featuredProgramDesc}>{event.description}</Text>

        <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
          <Text style={styles.metaTextWhite}>
            {event.spotsLeft != null ? `${event.spotsLeft} spots left` : `${event.pointsReward} ECO points reward`}
          </Text>
          <TouchableOpacity
            style={styles.eventJoinBtnInfo}
            onPress={isReadOnly ? onSignIn : onJoin}
          >
            <Text style={styles.eventJoinBtnInfoText}>
              {isReadOnly ? 'Sign In to Join' : 'Join Event'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  eventFeaturedCard: {
    width: '100%',
    height: 350,
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    marginBottom: 24,
  },
  eventFeaturedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 33, 29, 0.4)',
  },
  featuredProgramContent: {
    padding: 24,
  },
  tagDark: { backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  tagDarkText: { color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  tagLight: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  tagLightText: { color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  featuredProgramTitle: { fontSize: 24, fontWeight: '800', color: '#FFF', marginBottom: 8, lineHeight: 30 },
  featuredProgramDesc: { fontSize: 15, color: 'rgba(255,255,255,0.8)', marginBottom: 20, lineHeight: 22 },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaTextWhite: { fontSize: 12, color: '#FFF', fontWeight: '600' },
  eventJoinBtnInfo: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16 },
  eventJoinBtnInfoText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
});
