import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  Animated,
  Easing
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { type ActiveChallengeCardProps } from '../types/home';
import { ecobudApiOrigin } from '../../shared/api/ecobudApi';
import { styles } from '../styles/appStyles';

const getValidImageUrl = (url: string | null | undefined) => {
  if (!url) return undefined;
  let cleanUrl = url.replace(/\\/g, '/');
  if (cleanUrl.includes('localhost:3000')) {
    cleanUrl = cleanUrl.replace('http://localhost:3000', ecobudApiOrigin);
  } else if (!cleanUrl.startsWith('http')) {
    cleanUrl = `${ecobudApiOrigin}${cleanUrl.startsWith('/') ? '' : '/'}${cleanUrl}`;
  }
  return cleanUrl;
};

export function ActiveChallengeCard({ dailyChallenge, onComplete, onClaim, isViewed }: ActiveChallengeCardProps) {
  const status = dailyChallenge.progress?.status?.toLowerCase() || 'not_started';
  
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [isPressing, setIsPressing] = useState(false);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  let btnText = 'VIEW CHALLENGE';
  let isApproved = false;
  let isPending = false;
  let isCompleted = false;
  let isAI = dailyChallenge.type === 'AI Image Recognition Challenge';

  if (status === 'pending') {
    btnText = 'PENDING APPROVAL';
    isPending = true;
  } else if (status === 'approved' || status === 'unclaimed') {
    btnText = isPressing ? 'CLAIMING...' : 'CLAIM REWARD';
    isApproved = true;
  } else if (status === 'completed') {
    btnText = 'CHALLENGE FINISHED';
    isCompleted = true;
  } else if (isAI) {
    btnText = isViewed ? (isPressing ? 'CONTINUING...' : 'CONTINUE MISSION') : (isPressing ? 'STARTING...' : 'START MISSION');
  } else {
    btnText = 'MARK AS COMPLETE';
  }

  const handlePress = () => {
    if (isPending || isCompleted) return;
    setIsPressing(true);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.85, duration: 100, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1.05, friction: 3, tension: 40, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true })
    ]).start(() => {
      setIsPressing(false);
      if (isApproved) {
        if (onClaim) onClaim();
      } else {
        if (onComplete) onComplete();
      }
    });
  };

  const shouldPulse = isAI && !isCompleted && !isPending && !isApproved;

  return (
    <Animated.View style={localStyles.featuredCard}>
      <View style={[localStyles.featuredImage, { backgroundColor: '#1A3B2A' }]}>
        {dailyChallenge.imageUrl ? (
          <Image source={{ uri: getValidImageUrl(dailyChallenge.imageUrl) }} style={StyleSheet.absoluteFill} blurRadius={10} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', paddingBottom: 60 }]}>
            <Ionicons name="trophy" size={80} color="#4ADE80" style={{ opacity: 0.5 }} />
          </View>
        )}
        <View style={localStyles.featuredOverlay} />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']} style={localStyles.featuredGradient} />
        
        <View style={localStyles.featuredContent}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, alignItems: 'flex-start' }}>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', flex: 1 }}>
              <View style={[localStyles.glassTag, { backgroundColor: 'rgba(74,222,128,0.3)', borderColor: 'rgba(74,222,128,0.5)' }]}>
                <Text style={[localStyles.glassTagText, { color: '#ECFDF5' }]}>TODAY'S CHALLENGE</Text>
              </View>
              {dailyChallenge.difficulty && (
                <View style={localStyles.glassTag}>
                  <Text style={localStyles.glassTagText}>
                    {dailyChallenge.difficulty.toLowerCase() === 'easy' ? '🟢' : dailyChallenge.difficulty.toLowerCase() === 'medium' ? '🟡' : dailyChallenge.difficulty.toLowerCase() === 'hard' ? '🔴' : '🔥'} {dailyChallenge.difficulty.toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={localStyles.glassTag}>
                <Text style={localStyles.glassTagText}>🌿 {dailyChallenge.expReward} XP</Text>
              </View>
              {dailyChallenge.ecoCoinReward > 0 && (
                <View style={[localStyles.glassTag, { backgroundColor: 'rgba(74,222,128,0.3)', borderColor: 'rgba(74,222,128,0.5)', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                  <Image source={require('../../../assets/coin.png')} style={{ width: 14, height: 14, resizeMode: 'contain' }} />
                  <Text style={[localStyles.glassTagText, { color: '#ECFDF5' }]}>{dailyChallenge.ecoCoinReward} Coins</Text>
                </View>
              )}
            </View>
            {isViewed ? (
              <View style={[localStyles.glassTag, { backgroundColor: 'rgba(59, 130, 246, 0.3)', borderColor: 'rgba(59, 130, 246, 0.5)', marginLeft: 8 }]}>
                <Text style={[localStyles.glassTagText, { color: '#EFF6FF' }]}>👁️ VIEWED</Text>
              </View>
            ) : (
              <View style={[localStyles.glassTag, { backgroundColor: 'rgba(239, 68, 68, 0.3)', borderColor: 'rgba(239, 68, 68, 0.5)', marginLeft: 8 }]}>
                <Text style={[localStyles.glassTagText, { color: '#FEF2F2' }]}>🆕 NEW</Text>
              </View>
            )}
          </View>
          
          <Text style={{ fontSize: 34, fontWeight: '900', color: '#FFF', marginBottom: 10, letterSpacing: -0.5, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }}>{dailyChallenge.title}</Text>
          <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.9)', marginBottom: 24, lineHeight: 24, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>{dailyChallenge.description}</Text>

          {isAI && dailyChallenge.aiDetectionTargets && dailyChallenge.aiDetectionTargets.length > 0 && (
            <LinearGradient colors={['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.05)']} style={localStyles.aiGradientBox}>
              <Text style={{ color: '#A7F3D0', fontSize: 13, fontWeight: '800', marginBottom: 6, letterSpacing: 1 }}>
                <Ionicons name="camera" size={14} color="#A7F3D0" /> AI RECOGNITION MISSION
              </Text>
              <Text style={{ color: '#FFF', fontSize: 14, lineHeight: 22 }}>
                Find & capture: <Text style={{ fontWeight: '800', color: '#4ADE80' }}>{dailyChallenge.aiDetectionTargets.join(', ')}</Text>
              </Text>
            </LinearGradient>
          )}

          {!isAI && (
            <View style={{ marginTop: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={styles.progressLabelLight}>PROGRESS</Text>
                <Text style={styles.progressLabelLight}>{dailyChallenge.progress?.progressPercentage || 0}%</Text>
              </View>
              <View style={styles.progressTrackLight}>
                <View style={[styles.progressFillLight, { width: `${dailyChallenge.progress?.progressPercentage || 0}%`, backgroundColor: '#4ADE80' }]} />
              </View>
            </View>
          )}

          <Animated.View style={shouldPulse ? { transform: [{ scale: Animated.multiply(pulseAnim, scaleAnim) }] } : { transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={handlePress}
              disabled={isPressing || isPending || isCompleted}
              style={isApproved ? [styles.featuredProgramBtn, { backgroundColor: '#F59E0B', borderColor: '#D97706' }] : (shouldPulse ? localStyles.pulseBtn : styles.featuredProgramBtn)}
            >
              <Text style={isApproved ? [styles.featuredProgramBtnText, { color: '#FFFFFF' }] : (shouldPulse ? localStyles.pulseBtnText : styles.featuredProgramBtnText)}>
                {btnText}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
}

const localStyles = StyleSheet.create({
  featuredCard: {
    borderRadius: 32,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#126027',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    elevation: 10,
    backgroundColor: '#126027',
  },
  featuredImage: { minHeight: 420, justifyContent: 'flex-end' },
  featuredOverlay: { ...StyleSheet.absoluteFill as any, backgroundColor: 'rgba(0, 0, 0, 0.3)' },
  featuredGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '100%' },
  featuredContent: { padding: 24, paddingTop: 40 },
  glassTag: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  glassTagText: { color: '#FFF', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  aiGradientBox: {
    padding: 16, borderRadius: 20, marginTop: 8, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  pulseBtn: {
    backgroundColor: '#4ADE80',
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#4ADE80',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  pulseBtnText: { color: '#126027', fontSize: 15, fontWeight: '900', letterSpacing: 1 },
});
