import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ImageBackground,
  Image,
  Alert,
  StyleProp,
  ViewStyle,
  Animated,
  StyleSheet,
  Easing,
  Dimensions,
  DeviceEventEmitter,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useVideoPlayer, VideoView, useEventListener } from '../../shared/platform/VideoCompat';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { styles } from '../styles/appStyles';
import { SimpleMarkdown } from '../../shared/ui/SimpleMarkdown';
import { ecoTheme } from '../../shared/theme/ecoTheme';
import { LinearGradient } from 'expo-linear-gradient';
import { LoadingGlyph } from '../../shared/ui/OptimizedLoading';
import { EcoBadge, EcoBudMobileModel } from '../types/home';
import {
  formatLongDate,
  formatEventDateTag,
  getEcoLevel,
  getVisibleStreak,
  shortHash,
} from '../utils/appUtils';
import { ecobudApiOrigin } from '../../shared/api/ecobudApi';
import {
  TopNavbar,
  OverlayScaffold,
  LessonMedia,
  SurfaceCard,
  TinyBadge,
  ChallengeMeta,
  PrimaryButton,
  AvatarBubble,
  BadgeCard,
  SecondaryButton,
} from './CommonComponents';
import { FireStreak } from './FireStreak';

export function AiMissionOverlay({ model }: { model: EcoBudMobileModel }) {
  const challenge = model.selectedChallenge;
  const [step, setStep] = React.useState<'details' | 'capture' | 'result' | 'capture_after'>('details');
  const [processing, setProcessing] = React.useState(false);
  const [mockResult, setMockResult] = React.useState<{ passed: boolean; object: string; confidence: number; reason?: string; proofUrl?: string } | null>(null);
  const [beforeProofUrl, setBeforeProofUrl] = React.useState<string | null>(null);

  const entryFadeAnim = React.useRef(new Animated.Value(0)).current;
  const processFadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(entryFadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [entryFadeAnim]);

  React.useEffect(() => {
    if (processing) {
      Animated.timing(processFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      processFadeAnim.setValue(0);
    }
  }, [processing, processFadeAnim]);

  const fadeAnim = React.useRef(new Animated.Value(1)).current;
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = React.useRef<any>(null);
  const [capturedImage, setCapturedImage] = React.useState<string | null>(null);

  if (!challenge) {
    return null;
  }

  const handleStartRecognition = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'We need camera permission to scan items.');
        return;
      }
    }

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setStep('capture');
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const processImage = async (uri: string) => {
    setCapturedImage(uri);
    setProcessing(true);
    try {
      const result = await model.analyzeChallengeImage(challenge.id, uri);
      if (result.passed && result.proofUrl) {
        setBeforeProofUrl(result.proofUrl);
        setMockResult(result);
      } else {
        setMockResult(result);
      }
    } catch (err: any) {
      setMockResult({ passed: false, object: 'Error', confidence: 0, reason: err.message || 'Failed to analyze image' });
    } finally {
      setProcessing(false);
      setStep('result');
    }
  };

  const processAfterImage = async (uri: string) => {
    setCapturedImage(uri);
    setProcessing(true);
    try {
      if (beforeProofUrl) {
        const uploadResult = await model.uploadChallengeProofImage(challenge.id, uri);
        await model.handleSubmitChallengeProof(challenge.id, beforeProofUrl, uploadResult.proofUrl);
      }
      setStep('result'); // We can reuse result screen for final success
    } catch (err: any) {
      console.error('Failed to submit proof', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleCapture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync();
        if (step === 'capture_after') {
          processAfterImage(photo.uri);
        } else {
          processImage(photo.uri);
        }
      } catch (err) {
        console.error('Camera error', err);
      }
    }
  };

  const handleGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        if (step === 'capture_after') {
          processAfterImage(result.assets[0].uri);
        } else {
          processImage(result.assets[0].uri);
        }
      }
    } catch (err) {
      console.error('Gallery error', err);
    }
  };

  const handleClose = () => {
    Animated.timing(entryFadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      model.setActiveOverlay(null);
    });
  };

  const handleBackToChallenge = () => {
    handleClose();
  };

  const handleProceedToAfter = () => {
    setCapturedImage(null);
    setStep('capture_after');
  };

  const handleTryAgain = () => {
    setMockResult(null);
    setCapturedImage(null);
    setStep('capture');
  };

  if (step === 'result' && mockResult) {
    return (
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }, { opacity: entryFadeAnim }]}>
        <OverlayScaffold title="Result Page" subtitle="Detection Result" onBack={handleClose}>
          <ScrollView contentContainerStyle={[styles.overlayScroll, { padding: 24, alignItems: 'center' }]}>
            <Animated.View style={{ opacity: fadeAnim, width: '100%', alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#126027', marginBottom: 24 }}>Detection Result</Text>

              <View style={{ width: '100%', backgroundColor: '#F8FAF9', padding: 20, borderRadius: 16, marginBottom: 24, borderWidth: 1, borderColor: '#E8F0EA' }}>
                <Text style={{ fontSize: 14, color: '#6B7A75', marginBottom: 4 }}>Object:</Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#126027', marginBottom: 16 }}>{mockResult.object}</Text>

                <Text style={{ fontSize: 14, color: '#6B7A75', marginBottom: 4 }}>Confidence:</Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#126027', marginBottom: 16 }}>{mockResult.confidence}%</Text>

                <Text style={{ fontSize: 14, color: '#6B7A75', marginBottom: 4 }}>Status:</Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: mockResult.passed ? '#4ADE80' : '#F87171', marginBottom: mockResult.passed ? 0 : 16 }}>
                  {mockResult.passed ? 'Passed ✅' : 'Failed ❌'}
                </Text>

                {!mockResult.passed && (
                  <>
                    <Text style={{ fontSize: 14, color: '#6B7A75', marginBottom: 4 }}>Reason:</Text>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#F87171' }}>{mockResult.reason}</Text>
                  </>
                )}
              </View>

              {mockResult.passed && step === 'result' && beforeProofUrl && !capturedImage ? (
                <View style={{ alignItems: 'center', marginBottom: 32 }}>
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#126027', marginBottom: 8, textAlign: 'center' }}>Step 1 Complete!</Text>
                  <Text style={{ fontSize: 16, color: '#6B7A75', textAlign: 'center', marginBottom: 16, lineHeight: 24 }}>
                    We have verified the trash. Now, please take an "AFTER" picture showing you throwing it in the proper bin.
                  </Text>
                </View>
              ) : mockResult.passed && step === 'result' && capturedImage ? (
                <View style={{ alignItems: 'center', marginBottom: 32 }}>
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#126027', marginBottom: 8, textAlign: 'center' }}>Submission Complete!</Text>
                  <Text style={{ fontSize: 16, color: '#6B7A75', textAlign: 'center', marginBottom: 16, lineHeight: 24 }}>
                    Your submission has been sent to the admin for review. Once approved, you will receive:
                  </Text>
                  <Text style={{ fontSize: 16, color: '#10B981', fontWeight: 'bold', marginBottom: 4 }}>🌱 +{challenge.expReward} Eco Points</Text>
                  {challenge.ecoCoinReward > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Image source={require('../../../assets/coin.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
                      <Text style={{ fontSize: 16, color: '#10B981', fontWeight: 'bold' }}>+{challenge.ecoCoinReward} Eco Coins</Text>
                    </View>
                  )}
                </View>
              ) : null}

              {mockResult.passed ? (
                capturedImage ? (
                  <PrimaryButton label="Back to Challenges" onPress={handleBackToChallenge} />
                ) : (
                  <PrimaryButton label="Proceed to After Picture" onPress={handleProceedToAfter} />
                )
              ) : (
                <PrimaryButton label="Try Again" onPress={handleTryAgain} />
              )}
            </Animated.View>
          </ScrollView>
        </OverlayScaffold>
      </Animated.View>
    );
  }

  if (step === 'capture' || step === 'capture_after') {
    return (
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }, { opacity: entryFadeAnim }]}>
        <OverlayScaffold title={step === 'capture_after' ? "Take After Picture" : "AI Recognition Submission Page"} subtitle={step === 'capture_after' ? "Final Step" : "AI Recognition"} onBack={() => setStep(step === 'capture_after' ? 'result' : 'details')}>
          <ScrollView contentContainerStyle={[styles.overlayScroll, { padding: 24, alignItems: 'center' }]}>
            <Animated.View style={{ opacity: fadeAnim, width: '100%' }}>
              <View style={{ width: '100%', aspectRatio: 1, backgroundColor: '#E8F0EA', borderRadius: 24, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', marginBottom: 32 }}>
                {capturedImage ? (
                  <Image source={{ uri: capturedImage }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                ) : permission?.granted ? (
                  <CameraView style={{ width: '100%', height: '100%' }} facing="back" ref={cameraRef} />
                ) : (
                  <>
                    <Ionicons name="camera" size={64} color="#C8D8CE" />
                    <Text style={{ marginTop: 16, color: '#6B7A75', fontSize: 16 }}>No camera access</Text>
                  </>
                )}

                {processing && (
                  <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255, 255, 255, 0.8)', justifyContent: 'center', alignItems: 'center', opacity: processFadeAnim }]}>
                    <ActivityIndicator size="large" color="#10B981" />
                    <Text style={{ marginTop: 24, fontSize: 18, fontWeight: 'bold', color: '#126027' }}>
                      {step === 'capture_after' ? 'Submitting...' : 'Analyzing Image...'}
                    </Text>
                  </Animated.View>
                )}
              </View>

              {!processing && (
                <View style={{ width: '100%', gap: 16 }}>
                  <TouchableOpacity style={[styles.primaryButton, { backgroundColor: '#10B981', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }]} onPress={handleCapture}>
                    <Ionicons name="camera" size={20} color="#FFF" />
                    <Text style={styles.primaryButtonText}>Capture</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.primaryButton, { backgroundColor: '#4ADE80', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }]} onPress={handleGallery}>
                    <Ionicons name="image" size={20} color="#FFF" />
                    <Text style={styles.primaryButtonText}>Choose from Gallery</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Animated.View>
          </ScrollView>
        </OverlayScaffold>
      </Animated.View>
    );
  }

  // Details step
  return (
    <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }, { opacity: entryFadeAnim }]}>
      <OverlayScaffold title="📷 AI Waste Recognition Challenge" subtitle="Mission Details" onBack={handleClose}>
        <ScrollView contentContainerStyle={[styles.overlayScroll, { padding: 24 }]}>
          <Animated.View style={{ opacity: fadeAnim }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#126027', marginBottom: 24 }}>{challenge.title}</Text>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }}>
              <View>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#3A4B43', marginBottom: 8 }}>Difficulty:</Text>
                <Text style={{ fontSize: 16, color: '#6B7A75' }}>{challenge.difficulty}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#3A4B43', marginBottom: 8 }}>Rewards:</Text>
                <Text style={{ fontSize: 16, color: '#10B981', marginBottom: 4, fontWeight: '600' }}>🌱 {challenge.expReward} Eco Points</Text>
                {challenge.ecoCoinReward > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Image source={require('../../../assets/coin.png')} style={{ width: 16, height: 16, resizeMode: 'contain' }} />
                    <Text style={{ fontSize: 16, color: '#10B981', fontWeight: '600' }}>{challenge.ecoCoinReward} Eco Coins</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }}>
              <View>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#3A4B43', marginBottom: 8 }}>Targets:</Text>
                {challenge.aiDetectionTargets?.map(target => (
                  <Text key={target} style={{ fontSize: 16, color: '#6B7A75', marginBottom: 4 }}>✓ {target}</Text>
                ))}
                {(!challenge.aiDetectionTargets || challenge.aiDetectionTargets.length === 0) && (
                  <Text style={{ fontSize: 16, color: '#6B7A75', marginBottom: 4 }}>✓ Plastic Bottle</Text>
                )}
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#3A4B43', marginBottom: 8 }}>Minimum Confidence:</Text>
                <Text style={{ fontSize: 16, color: '#6B7A75' }}>80%</Text>
              </View>
            </View>

            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#3A4B43', marginBottom: 8 }}>Instructions:</Text>
            <Text style={{ fontSize: 16, color: '#6B7A75', marginBottom: 24, lineHeight: 24 }}>Take a clear photo of any target item.{'\n'}Blurred images may be rejected.</Text>

            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#3A4B43', marginBottom: 16 }}>Sample Images</Text>
            <View style={{ marginBottom: 32, marginHorizontal: -24 }}>
              <Image source={require('../../../assets/caw.png')} style={{ width: '100%', height: 540, resizeMode: 'contain' }} />
            </View>

            <PrimaryButton label="Start Recognition" onPress={handleStartRecognition} />
          </Animated.View>
        </ScrollView>
      </OverlayScaffold>
    </Animated.View>
  );
}

export function ClaimParticlesOverlay({ model }: { model: EcoBudMobileModel }) {
  const { width, height } = Dimensions.get('window');

  // Calculate how many of each particle type to spawn
  const hasCoins = model.claimRewardData ? model.claimRewardData.coins > 0 : true;
  const hasPoints = model.claimRewardData ? model.claimRewardData.points > 0 : true;

  // Total particles to spawn
  const numParticles = hasCoins && hasPoints ? 24 : 16;

  // Determine particle type array
  const particleTypes: ('coin' | 'leaf')[] = [];
  for (let i = 0; i < numParticles; i++) {
    if (hasCoins && hasPoints) {
      particleTypes.push(i % 2 === 0 ? 'leaf' : 'coin');
    } else if (hasCoins) {
      particleTypes.push('coin');
    } else if (hasPoints) {
      particleTypes.push('leaf');
    }
  }

  const particleAnims = React.useRef(
    Array.from({ length: particleTypes.length }, () => ({
      pos: new Animated.ValueXY({ x: width / 2 - 15, y: height / 2 - 80 }),
      scale: new Animated.Value(0),
      opacity: new Animated.Value(0),
    }))
  ).current;

  React.useEffect(() => {
    if (particleTypes.length === 0) {
      // If no particles to show, just close overlay immediately
      model.setActiveOverlay(null);
      return;
    }

    const animations = particleAnims.map((particle, index) => {
      const type = particleTypes[index];
      const angle = (Math.PI * 2 * index) / numParticles + (Math.random() - 0.5) * 0.4;
      const radius = 70 + Math.random() * 50;
      const burstX = width / 2 - 15 + Math.cos(angle) * radius;
      const burstY = height / 2 - 80 + Math.sin(angle) * radius;

      particle.pos.setValue({ x: width / 2 - 15, y: height / 2 - 80 });
      particle.scale.setValue(0);
      particle.opacity.setValue(0);

      const delay = index * 60;

      return Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.spring(particle.pos, {
            toValue: { x: burstX, y: burstY },
            tension: 80,
            friction: 6,
            useNativeDriver: true,
          }),
          Animated.timing(particle.scale, {
            toValue: 1.5,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(particle.opacity, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(120),
        Animated.parallel([
          Animated.timing(particle.pos, {
            toValue: type === 'leaf'
              ? { x: width / 2 - 15 + (Math.random() * 40 - 20), y: 130 + (Math.random() * 30 - 15) }
              : { x: width + 100, y: 150 },
            duration: 650,
            easing: Easing.bezier(0.25, 1, 0.5, 1),
            useNativeDriver: true,
          }),
          Animated.timing(particle.scale, {
            toValue: 0.4,
            duration: 650,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.delay(450),
            Animated.timing(particle.opacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]);
    });

    Animated.parallel(animations).start(() => {
      model.setActiveOverlay(null);
    });
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent', zIndex: 10000 }]} pointerEvents="none">
      {particleAnims.map((particle, index) => {
        const type = particleTypes[index];
        return (
          <Animated.View
            key={index}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              transform: [
                { translateX: particle.pos.x },
                { translateY: particle.pos.y },
                { scale: particle.scale },
              ],
              opacity: particle.opacity,
              zIndex: 9999,
              shadowColor: type === 'leaf' ? '#10b981' : '#F59E0B',
              shadowRadius: 10,
              shadowOpacity: 0.8,
              shadowOffset: { width: 0, height: 0 },
              elevation: 10,
            }}
          >
            <View style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: type === 'coin' ? 'transparent' : '#10b981',
              justifyContent: 'center',
              alignItems: 'center',
              borderWidth: type === 'coin' ? 0 : 2,
              borderColor: '#FFF',
            }}>
              {type === 'coin' ? (
                <Image
                  source={require('../../../assets/coin.png')}
                  style={{ width: 34, height: 34, resizeMode: 'contain' }}
                />
              ) : (
                <Ionicons name="leaf" size={16} color="#FFF" />
              )}
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

export function OverlayRouter({ model }: { model: EcoBudMobileModel }) {
  switch (model.activeOverlay) {
    case 'assistant':
      return <AssistantOverlay model={model} />;
    case 'events':
      return <EventsOverlay model={model} />;
    case 'lesson':
      return <LessonOverlay model={model} />;
    case 'quiz':
      return <QuizOverlay model={model} />;
    case 'lessonCompleted':
      return <LessonCompleteOverlay model={model} />;
    case 'leaderboard':
      return <LeaderboardOverlay model={model} />;
    case 'rewards':
      return <RewardsOverlay model={model} />;
    case 'transparency':
      return <TransparencyOverlay model={model} />;
    case 'ai_mission':
      return <AiMissionOverlay model={model} />;
    case 'claimParticles':
      return <ClaimParticlesOverlay model={model} />;
    case 'streakUnlocked':
      return <StreakUnlockedOverlay model={model} />;
    case 'streakRewards':
      return <StreakRewardsOverlay model={model} />;
    case 'settings':
      return <SettingsOverlay model={model} />;
    default:
      return null;
  }
}

export function AssistantOverlay({ model }: { model: EcoBudMobileModel }) {
  return (
    <View style={styles.fullscreenOverlay}>
      <TopNavbar model={model} showBack={true} title="AI Assistant" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1 }}>
          <View style={{ alignItems: 'center', marginBottom: 24, opacity: 0.7 }}>
            <View style={[styles.badgeCircleMedium, { width: 48, height: 48, borderRadius: 24, marginBottom: 8 }]}>
              <Ionicons name="chatbubbles" size={24} color="#FFF" />
            </View>
            <Text style={styles.metaTextSmallDark}>EcoBud Assistant is here to help</Text>
          </View>

          {model.assistantMessages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.chatBubble,
                message.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleBot,
              ]}
            >
              {message.role === 'user' ? (
                <Text style={styles.chatBubbleTextUser}>{message.text}</Text>
              ) : (
                <SimpleMarkdown>{message.text}</SimpleMarkdown>
              )}
              <Text style={message.role === 'user' ? styles.chatTimeUser : styles.chatTimeBot}>{message.time}</Text>
            </View>
          ))}
          {model.sendingMessage ? (
            <LoadingGlyph size="md" style={{ marginTop: 8, alignSelf: 'flex-start' }} />
          ) : null}
        </ScrollView>

        <View style={{ paddingHorizontal: 24, paddingBottom: 12 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {model.assistantQuickReplies.map((reply) => (
              <TouchableOpacity key={reply} onPress={() => void model.handleAssistantSend(reply)} style={styles.categoryOutlineBtn}>
                <Text style={[styles.categoryOutlineBtnText, { paddingHorizontal: 12 }]}>{reply}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.assistantComposer}>
          <TextInput
            value={model.assistantInput}
            onChangeText={model.setAssistantInput}
            placeholder="Message ECOBUD..."
            placeholderTextColor="#6B7A75"
            style={styles.chatInput}
          />
          <TouchableOpacity onPress={() => void model.handleAssistantSend()} style={styles.circularAddBtn}>
            <Ionicons name="send" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

export function EventsOverlay({ model }: { model: EcoBudMobileModel }) {
  const featuredEvent = model.events[0] ?? null;
  const otherEvents = featuredEvent ? model.events.slice(1) : model.events;

  return (
    <View style={styles.fullscreenOverlay}>
      <TopNavbar model={model} showBack={true} />
      <ScrollView contentContainerStyle={styles.homeContent}>
        <Text style={styles.welcomeLabel}>DIRECTORY</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.pageTitle}>Eco Events</Text>
          <View style={styles.filterPillGroup}>
            <View style={styles.filterPillActive}><MaterialCommunityIcons name="view-list" size={16} color="#126027" /><Text style={styles.filterPillActiveText}> List</Text></View>
            <View style={styles.filterPillInactive}><MaterialCommunityIcons name="map" size={16} color="#6B7A75" /><Text style={styles.filterPillInactiveText}> Map</Text></View>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 16, marginBottom: 24 }}>
          <View style={styles.categoryPillActive}><Text style={styles.categoryPillActiveText}>All Events</Text></View>
          <View style={styles.categoryPillInactive}><Text style={styles.categoryPillInactiveText}>Clean-ups</Text></View>
          <View style={styles.categoryPillInactive}><Text style={styles.categoryPillInactiveText}>Tree Planting</Text></View>
        </ScrollView>

        {featuredEvent ? (
          <ImageBackground
            source={{ uri: featuredEvent.imageUrl ?? 'https://images.unsplash.com/photo-1618477461853-cf6ed80fabe5?q=80&w=800&auto=format&fit=crop' }}
            style={styles.eventFeaturedCard}
            imageStyle={{ borderRadius: 24 }}
          >
            <View style={styles.eventFeaturedOverlay} />
            <View style={styles.featuredProgramContent}>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 'auto' }}>
                <View style={styles.tagLight}><Text style={styles.tagLightText}>FEATURED</Text></View>
                <View style={styles.tagDark}><Text style={styles.tagDarkText}>PUBLIC EVENT</Text></View>
              </View>

              <View style={{ flexDirection: 'row', gap: 16, marginBottom: 8, marginTop: 40 }}>
                <View style={styles.rowMeta}><Ionicons name="calendar" size={14} color="#FFF" /><Text style={styles.metaTextWhite}> {formatLongDate(featuredEvent.date)}</Text></View>
                <View style={styles.rowMeta}><Ionicons name="location" size={14} color="#FFF" /><Text style={styles.metaTextWhite}> {featuredEvent.location}</Text></View>
              </View>
              <Text style={styles.featuredProgramTitle}>{featuredEvent.title}</Text>
              <Text style={styles.featuredProgramDesc}>{featuredEvent.description}</Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.metaTextWhite}>
                  {featuredEvent.spotsLeft != null ? `${featuredEvent.spotsLeft} spots left` : `${featuredEvent.pointsReward} ECO points reward`}
                </Text>
                <TouchableOpacity
                  style={styles.eventJoinBtnInfo}
                  onPress={() => (
                    model.isReadOnlyExperience
                      ? void model.leaveReadOnlyAccess()
                      : void model.handleJoinEvent(featuredEvent.id)
                  )}
                >
                  <Text style={styles.eventJoinBtnInfoText}>
                    {model.isReadOnlyExperience ? 'Sign In to Join' : 'Join Event'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ImageBackground>
        ) : (
          <SurfaceCard style={styles.publicInfoCard}>
            <Text style={styles.sectionHeadline}>No public events yet</Text>
            <Text style={styles.metaTextSmallDark}>Check back soon for new clean-ups, workshops, and community eco campaigns.</Text>
          </SurfaceCard>
        )}

        {otherEvents.map((event) => (
          <View key={event.id} style={styles.eventListCard}>
            <ImageBackground
              source={{ uri: event.imageUrl ?? 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=800&auto=format&fit=crop' }}
              style={styles.eventListImg}
              imageStyle={{ borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
            >
              <View style={styles.dateTagRight}><Text style={styles.dateTagRightText}>{formatEventDateTag(event.date)}</Text></View>
            </ImageBackground>
            <View style={styles.eventListBody}>
              <Text style={styles.welcomeLabel}>PUBLIC EVENT</Text>
              <Text style={styles.cardTitle}>{event.title}</Text>
              <Text style={styles.metaTextSmallDark}>{event.description}</Text>
              <View style={[styles.rowMeta, { marginTop: 12 }]}>
                <Ionicons name="location" size={14} color="#6B7A75" />
                <Text style={styles.metaTextSmallDark}> {event.location}</Text>
              </View>
              <View style={[styles.rowMeta, { marginBottom: 16 }]}>
                <Ionicons name="leaf" size={14} color="#6B7A75" />
                <Text style={styles.metaTextSmallDark}> {event.pointsReward} ECO points reward</Text>
              </View>
              <TouchableOpacity
                style={styles.quickJoinBtn}
                onPress={() => (
                  model.isReadOnlyExperience
                    ? void model.leaveReadOnlyAccess()
                    : void model.handleJoinEvent(event.id)
                )}
              >
                <Text style={styles.quickJoinBtnText}>
                  {model.isReadOnlyExperience ? 'Sign In to Join' : 'Quick Join'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

export function LessonOverlay({ model }: { model: EcoBudMobileModel }) {
  const [currentPageIndex, setCurrentPageIndex] = React.useState(0);
  const pageAnim = React.useRef(new Animated.Value(1)).current;

  const handleNextPage = () => {
    Animated.sequence([
      Animated.timing(pageAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentPageIndex(currentPageIndex + 1);
      Animated.timing(pageAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    });
  };

  const videoSource = model.selectedLesson?.videoUrl
    ? `${ecobudApiOrigin}${model.selectedLesson.videoUrl}`
    : null;
  const headerImg = model.selectedLesson?.imageUrl
    ? `${ecobudApiOrigin}${model.selectedLesson.imageUrl}`
    : "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=800&auto=format&fit=crop";

  const player = useVideoPlayer(videoSource, player => {
    player.loop = true;
  });

  const maxAllowedProgress = model.selectedLesson?.hasQuiz ? 90 : 100;
  const numPages = model.selectedLesson?.pages?.length ?? 0;
  const calculatedInitialProgress = model.selectedLesson?.status === 'completed'
    ? 100
    : model.selectedLesson?.videoUrl
      ? Math.max(model.selectedLesson?.progress ?? 0, 0)
      : (numPages > 0
        ? Math.round(((currentPageIndex + 1) / numPages) * maxAllowedProgress)
        : maxAllowedProgress);

  const initialProgress = calculatedInitialProgress;
  const animatedProgress = React.useRef(new Animated.Value(initialProgress)).current;
  const [displayProgress, setDisplayProgress] = React.useState(initialProgress);

  React.useEffect(() => {
    animatedProgress.addListener(({ value }) => {
      setDisplayProgress(Math.round(value));
    });

    const targetValue = model.selectedLesson?.status === 'completed'
      ? 100
      : model.selectedLesson?.videoUrl
        ? Math.max(model.selectedLesson?.progress ?? 0, 0)
        : (numPages > 0
          ? Math.round(((currentPageIndex + 1) / numPages) * maxAllowedProgress)
          : maxAllowedProgress);

    Animated.timing(animatedProgress, {
      toValue: targetValue,
      duration: 1500,
      useNativeDriver: false,
    }).start();

    return () => {
      animatedProgress.removeAllListeners();
    };
  }, [model.selectedLesson?.progress, model.selectedLesson?.videoUrl, model.selectedLesson?.hasQuiz, currentPageIndex, numPages, model.selectedLesson?.status, maxAllowedProgress]);

  const lessonRef = React.useRef(model.selectedLesson);
  React.useEffect(() => {
    lessonRef.current = model.selectedLesson;
    setCurrentPageIndex(0);
  }, [model.selectedLesson]);

  const handleUpdateRef = React.useRef(model.handleUpdateLessonProgress);
  React.useEffect(() => { handleUpdateRef.current = model.handleUpdateLessonProgress; }, [model.handleUpdateLessonProgress]);

  const progressDataRef = React.useRef({ time: 0, duration: 0 });
  const hasSavedOnExit = React.useRef(false);

  const doSave = React.useCallback(() => {
    const lesson = lessonRef.current;
    if (!lesson) {
      console.log('[LessonOverlay] doSave: no lesson, skipping');
      return;
    }

    let time = progressDataRef.current.time;
    let duration = progressDataRef.current.duration;

    try {
      if (player.currentTime > 0) time = player.currentTime;
      if (player.duration > 0) duration = player.duration;
    } catch {
    }

    if (!duration || isNaN(duration) || duration <= 0 || !time || isNaN(time) || time <= 0) {
      return;
    }

    const maxVideoProgress = lesson.hasQuiz ? 90 : 100;
    const currentProgress = Math.min(maxVideoProgress, (time / duration) * maxVideoProgress);

    try {
      handleUpdateRef.current(lesson.id, currentProgress, time);
    } catch (err) {
      // Ignore
    }
  }, [player]);

  React.useEffect(() => {
    return () => {
      if (!hasSavedOnExit.current) {
        hasSavedOnExit.current = true;
        doSave();
      }
    };
  }, [doSave]);

  useEventListener(player, 'playingChange', ({ isPlaying }: { isPlaying: boolean }) => {
    if (!isPlaying) {
      doSave();
    }
  });

  const hasSeeked = React.useRef(false);
  const lastSaveTime = React.useRef(Date.now());

  useEventListener(player, 'statusChange', ({ status }: { status: string }) => {
    if (status === 'readyToPlay' && !hasSeeked.current && player.duration > 0 && model.selectedLesson) {
      const targetTime = model.selectedLesson.videoTimestamp && model.selectedLesson.videoTimestamp > 0
        ? model.selectedLesson.videoTimestamp
        : ((model.selectedLesson.progress ?? 0) / 100) * player.duration;

      if (targetTime > 0) {
        player.currentTime = targetTime;
      }
      hasSeeked.current = true;
    }
  });

  useEventListener(player, 'timeUpdate', () => {
    progressDataRef.current = { time: player.currentTime, duration: player.duration };

    if (!hasSeeked.current && player.status === 'readyToPlay' && player.duration > 0 && model.selectedLesson) {
      const targetTime = model.selectedLesson.videoTimestamp && model.selectedLesson.videoTimestamp > 0
        ? model.selectedLesson.videoTimestamp
        : ((model.selectedLesson.progress ?? 0) / 100) * player.duration;

      if (targetTime > 0) {
        player.currentTime = targetTime;
      }
      hasSeeked.current = true;
    }

    if (Date.now() - lastSaveTime.current > 5000) {
      doSave();
      lastSaveTime.current = Date.now();
    }
  });

  const handleBack = () => {
    hasSavedOnExit.current = true;
    doSave();
    model.setActiveOverlay(null);
  };

  const [showConfetti, setShowConfetti] = React.useState(false);

  React.useEffect(() => {
    if (displayProgress >= maxAllowedProgress && initialProgress < maxAllowedProgress && !showConfetti) {
      setShowConfetti(true);
    }
  }, [displayProgress, maxAllowedProgress, initialProgress, showConfetti]);

  const confettiPieces = React.useMemo(() => generateConfettiPieces(20), []);

  return (
    <OverlayScaffold
      title={model.selectedLesson?.title ?? 'Lesson Detail'}
      subtitle={model.selectedLesson?.status ?? 'eco course'}
      headerImage={headerImg}
      onBack={handleBack}
      topRightAccessory={
        <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFFFFF' }}>
          {displayProgress}%
        </Text>
      }
      topProgressBar={
        <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.2)', width: '100%' }}>
          <Animated.View style={{
            height: '100%',
            backgroundColor: '#4ade80',
            width: animatedProgress.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%']
            })
          }} />
        </View>
      }
    >
      {showConfetti && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} pointerEvents="none">
          {confettiPieces.map((piece) => (
            <ConfettiParticle key={piece.id} piece={piece} />
          ))}
        </View>
      )}
      <ScrollView contentContainerStyle={styles.overlayScroll}>
        {model.selectedLesson ? (
          <>
            <SurfaceCard style={styles.lessonDetailCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>{model.selectedLesson.title}</Text>
                <TinyBadge label={`${displayProgress}%`} />
              </View>
              <Text style={styles.sectionCaption}>{model.selectedLesson.description}</Text>

              {model.selectedLesson.content ? (
                <View style={{ marginTop: 24, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#E8F0EA' }}>
                  {model.selectedLesson.content.split('\n').map((paragraph, index) => {
                    if (!paragraph.trim()) return null;
                    const isHeading = paragraph.trim().startsWith('#');
                    const text = paragraph.replace(/^#+\s*/, '').trim();
                    return (
                      <Text key={index} style={{
                        fontSize: isHeading ? 20 : 16,
                        fontWeight: isHeading ? '800' : '400',
                        lineHeight: isHeading ? 28 : 24,
                        color: isHeading ? '#126027' : '#3A4B43',
                        marginBottom: isHeading ? 16 : 12,
                        marginTop: isHeading && index > 0 ? 12 : 0
                      }}>
                        {text}
                      </Text>
                    );
                  })}
                </View>
              ) : null}

              {model.selectedLesson.videoUrl ? (
                <View style={{ marginVertical: 16, borderRadius: 16, overflow: 'hidden' }}>
                  <VideoView
                    player={player as any}
                    style={{ width: '100%', height: 220, borderRadius: 16 }}
                    {...({ allowsFullscreen: true, allowsPictureInPicture: true } as any)}
                  />
                </View>
              ) : null}
              {model.selectedLesson.pages && model.selectedLesson.pages.length > 0 ? (
                <Animated.View style={{
                  marginTop: 24, backgroundColor: '#FAFCFB', padding: 20,
                  borderRadius: 16, borderWidth: 1, borderColor: '#E8F0EA',
                  opacity: pageAnim,
                  transform: [{ translateY: pageAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }]
                }}>
                  <Text style={[styles.lessonBodyText, { marginTop: 0 }]}>
                    {model.selectedLesson.pages[currentPageIndex].content}
                  </Text>
                  <Text style={{ textAlign: 'center', marginTop: 16, color: '#6B7A75', fontSize: 13, fontWeight: '600' }}>
                    Page {currentPageIndex + 1} of {model.selectedLesson.pages.length}
                  </Text>
                </Animated.View>
              ) : null}

              {model.selectedLesson.transcript ? (
                <View style={{
                  backgroundColor: '#F8FAF9',
                  padding: 20,
                  borderRadius: 16,
                  marginTop: 24,
                  borderWidth: 1,
                  borderColor: '#E8F0EA',
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#E8F0EA', justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="document-text" size={14} color="#126027" />
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#126027', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                      Video Transcript
                    </Text>
                  </View>
                  <View style={{
                    marginTop: 8,
                    borderLeftWidth: 3,
                    borderLeftColor: '#4ade80',
                    paddingLeft: 16
                  }}>
                    {model.selectedLesson.transcript.split('\n').map((paragraph, index) => {
                      if (!paragraph.trim()) return null;
                      return (
                        <Text key={index} style={{
                          fontSize: 15,
                          lineHeight: 26,
                          color: '#3A4B43',
                          marginBottom: 10,
                          letterSpacing: 0.3
                        }}>
                          {paragraph.trim()}
                        </Text>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </SurfaceCard>
          </>
        ) : null}
      </ScrollView>

      {model.selectedLesson && (
        (model.selectedLesson.pages && currentPageIndex < model.selectedLesson.pages.length - 1) ||
        (!model.selectedLesson.videoUrl && (!model.selectedLesson.pages || model.selectedLesson.pages.length === 0)) ||
        displayProgress >= (model.selectedLesson.hasQuiz ? 80 : 90) ||
        model.selectedLesson.status === 'completed'
      ) && (
          <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F0F5F2', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 10 }}>
            {model.selectedLesson.pages && currentPageIndex < model.selectedLesson.pages.length - 1 ? (
              <PrimaryButton
                label="Next Page"
                onPress={handleNextPage}
              />
            ) : (
              <PrimaryButton
                label={model.selectedLesson.status === 'completed' ? 'Lesson Completed' : (model.selectedLesson.hasQuiz ? 'Next' : 'Complete Lesson')}
                onPress={() => {
                  if (model.selectedLesson?.status === 'completed') return;
                  if (model.selectedLesson?.hasQuiz) {
                    model.startQuiz();
                  } else {
                    void model.handleCompleteLesson();
                  }
                }}
                disabled={model.selectedLesson.status === 'completed'}
              />
            )}
          </View>
        )}
    </OverlayScaffold>
  );
}

export function QuizOverlay({ model }: { model: EcoBudMobileModel }) {
  const currentQuestion = model.quizQuestions[model.currentQuestionIndex];
  const totalQuestions = model.quizQuestions.length;
  const progress = totalQuestions > 0 ? ((model.currentQuestionIndex + 1) / totalQuestions) * 100 : 0;

  if (model.quizCompleted) {
    return (
      <OverlayScaffold
        title="Quiz Results"
        subtitle={`${model.quizScore}% score`}
        onBack={() => {
          model.resetQuiz();
          model.setActiveOverlay('lesson');
        }}
      >
        <ScrollView contentContainerStyle={styles.overlayScroll}>
          <SurfaceCard style={styles.lessonDetailCard}>
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <View style={[styles.badgeCircleMedium, {
                width: 80,
                height: 80,
                borderRadius: 40,
                marginBottom: 16,
                backgroundColor: model.quizScore >= 70 ? '#4ade80' : '#f87171'
              }]}>
                <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#FFF' }}>
                  {model.quizScore}%
                </Text>
              </View>
              <Text style={[styles.cardTitle, { textAlign: 'center', marginBottom: 8 }]}>
                {model.quizScore >= 70 ? 'Congratulations!' : 'Keep Learning!'}
              </Text>
              <Text style={[styles.sectionCaption, { textAlign: 'center' }]}>
                {model.quizScore >= 70
                  ? 'You passed the quiz and completed the lesson. Great job!'
                  : 'You need at least 70% to pass. Review the lesson and try again.'}
              </Text>
            </View>
            <PrimaryButton
              label={model.quizScore >= 70 ? 'Back to Lessons' : 'Try Again'}
              onPress={() => {
                model.resetQuiz();
                if (model.quizScore >= 70) {
                  model.setActiveOverlay(null);
                } else {
                  model.setActiveOverlay('lesson');
                }
              }}
            />
          </SurfaceCard>
        </ScrollView>
      </OverlayScaffold>
    );
  }

  if (!currentQuestion) {
    return (
      <OverlayScaffold
        title="Quiz"
        subtitle={totalQuestions === 0 ? 'No questions available' : 'Loading...'}
        onBack={() => {
          model.resetQuiz();
          model.setActiveOverlay('lesson');
        }}
      >
        <ScrollView contentContainerStyle={styles.overlayScroll}>
          <SurfaceCard style={styles.lessonDetailCard}>
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <View style={[styles.badgeCircleMedium, { width: 64, height: 64, borderRadius: 32, marginBottom: 16, backgroundColor: '#E8F0EA' }]}>
                <Ionicons name="help-circle-outline" size={32} color="#126027" />
              </View>
              <Text style={[styles.cardTitle, { textAlign: 'center', marginBottom: 8 }]}>
                No Quiz Questions
              </Text>
              <Text style={[styles.sectionCaption, { textAlign: 'center' }]}>
                This lesson does not have any quiz questions yet. You can complete the lesson directly.
              </Text>
            </View>
            <PrimaryButton
              label="Complete Lesson"
              onPress={() => {
                model.resetQuiz();
                void model.handleCompleteLesson();
              }}
            />
          </SurfaceCard>
        </ScrollView>
      </OverlayScaffold>
    );
  }

  return (
    <OverlayScaffold
      title={model.selectedLesson?.title ?? 'Quiz'}
      subtitle={`Question ${model.currentQuestionIndex + 1} of ${totalQuestions}`}
      onBack={() => {
        model.resetQuiz();
        model.setActiveOverlay('lesson');
      }}
      topRightAccessory={
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' }}>
          {Math.round(progress)}%
        </Text>
      }
      topProgressBar={
        <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.2)', width: '100%' }}>
          <View style={{
            height: '100%',
            backgroundColor: '#4ade80',
            width: `${progress}%`,
          }} />
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.overlayScroll}>
        <SurfaceCard style={styles.lessonDetailCard}>
          <View style={{ marginBottom: 16 }}>
            <Text style={[styles.sectionCaption, { marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }]}>
              Question {model.currentQuestionIndex + 1}
            </Text>
            <Text style={[styles.cardTitle, { fontSize: 18, lineHeight: 26 }]}>
              {currentQuestion.question}
            </Text>
          </View>

          <View style={{ gap: 12 }}>
            {(['optionA', 'optionB', 'optionC', 'optionD'] as const).map((optionKey) => {
              const optionLabel = optionKey.replace('option', '');
              const optionText = currentQuestion[optionKey];
              const isSelected = model.selectedAnswer === optionLabel;

              return (
                <TouchableOpacity
                  key={optionKey}
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: isSelected ? '#126027' : '#E8F0EA',
                    backgroundColor: isSelected ? '#F0FFF4' : '#FFFFFF',
                  }}
                  onPress={() => model.selectAnswer(currentQuestion.id, optionLabel)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      borderWidth: 2,
                      borderColor: isSelected ? '#126027' : '#C8D8CE',
                      backgroundColor: isSelected ? '#126027' : 'transparent',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                      <Text style={{
                        fontSize: 14,
                        fontWeight: '700',
                        color: isSelected ? '#FFF' : '#6B7A75',
                      }}>
                        {optionLabel}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 16, color: '#3A4B43', flex: 1 }}>
                      {optionText}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </SurfaceCard>
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F0F5F2', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 10 }}>
        {model.currentQuestionIndex < totalQuestions - 1 ? (
          <PrimaryButton
            label="Next Question"
            onPress={() => model.nextQuestion()}
            disabled={!model.selectedAnswer}
          />
        ) : (
          <PrimaryButton
            label="Submit Quiz"
            onPress={() => void model.submitQuiz()}
            disabled={!model.selectedAnswer}
          />
        )}
      </View>
    </OverlayScaffold>
  );
}

interface ConfettiPieceProps {
  id: number;
  delay: number;
  startX: number;
  startY: number;
  drift: number;
  shootUpHeight: number;
  shape: 'rect' | 'circle' | 'square' | 'strip' | 'leaf';
  color: string;
  size: number;
  spinDirection: number;
}

function generateConfettiPieces(count: number) {
  const { width, height } = Dimensions.get('window');
  return Array.from({ length: count }, (_, i) => {
    const shapes = ['rect', 'circle', 'square', 'strip', 'leaf'];
    const shapeType = shapes[Math.floor(Math.random() * shapes.length)] as any;

    let colors = ['#4ade80', '#10b981', '#059669', '#FFD700', '#FBBF24', '#FF6B6B', '#3B82F6', '#A78BFA', '#F472B6'];
    if (shapeType === 'leaf') {
      colors = ['#4ade80', '#10b981', '#22c55e', '#82cf6a', '#a3e635', '#059669'];
    }
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = shapeType === 'leaf' ? 8 + Math.random() * 8 : 6 + Math.random() * 12;

    let startX = 0;
    let startY = height + 40;
    let drift = 0;
    let shootUpHeight = 0;

    if (i % 3 === 0) {
      // Bottom-left burst
      startX = width * 0.05;
      drift = Math.random() * (width * 0.5) + (width * 0.1);
      shootUpHeight = height * 0.6 + Math.random() * (height * 0.35);
    } else if (i % 3 === 1) {
      // Bottom-right burst
      startX = width * 0.95;
      drift = -(Math.random() * (width * 0.5) + (width * 0.1));
      shootUpHeight = height * 0.6 + Math.random() * (height * 0.35);
    } else {
      // Center burst
      startX = width * 0.2 + Math.random() * (width * 0.6);
      startY = height;
      drift = (Math.random() - 0.5) * (width * 0.4);
      shootUpHeight = height * 0.45 + Math.random() * (height * 0.3);
    }

    return {
      id: i,
      delay: Math.random() * 600,
      startX,
      startY,
      drift,
      shootUpHeight,
      shape: shapeType,
      color,
      size,
      spinDirection: Math.random() > 0.5 ? 1 : -1,
    };
  });
}

function ConfettiParticle({ piece }: { piece: ConfettiPieceProps }) {
  const progressAnim = React.useRef(new Animated.Value(0)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.sequence([
      Animated.delay(piece.delay),
      Animated.parallel([
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 1800 + Math.random() * 1000,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.delay(1200),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, [piece.delay, progressAnim, opacityAnim]);

  const translateY = progressAnim.interpolate({
    inputRange: [0, 0.25, 0.45, 1],
    outputRange: [
      piece.startY,
      piece.startY - piece.shootUpHeight * 0.9,
      piece.startY - piece.shootUpHeight,
      piece.startY + 200,
    ],
  });

  const translateX = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [piece.startX, piece.startX + piece.drift],
  });

  const rotate = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${piece.spinDirection * (720 + Math.random() * 1080)}deg`],
  });

  const rotateX = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${Math.random() * 360}deg`],
  });

  let borderTopLeftRadius = piece.shape === 'circle' ? piece.size / 2 : piece.shape === 'rect' ? 2 : 4;
  let borderBottomRightRadius = borderTopLeftRadius;
  let borderTopRightRadius = borderTopLeftRadius;
  let borderBottomLeftRadius = borderTopLeftRadius;

  if (piece.shape === 'leaf') {
    borderTopLeftRadius = piece.size;
    borderBottomRightRadius = piece.size;
    borderTopRightRadius = piece.size * 0.25;
    borderBottomLeftRadius = piece.size * 0.25;
  }

  const width = piece.size;
  const height = piece.shape === 'strip' ? piece.size * 1.8 : piece.shape === 'rect' ? piece.size * 0.5 : piece.size;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width,
        height,
        backgroundColor: piece.color,
        borderTopLeftRadius,
        borderBottomRightRadius,
        borderTopRightRadius,
        borderBottomLeftRadius,
        opacity: opacityAnim,
        transform: [
          { translateX },
          { translateY },
          { rotate },
          { rotateX },
        ],
      }}
    />
  );
}

interface EmberProps {
  id: number;
  delay: number;
  startX: number;
  startY: number;
  drift: number;
  riseHeight: number;
  size: number;
  color: string;
}

function generateEmbers(count: number) {
  const { width, height } = Dimensions.get('window');
  return Array.from({ length: count }, (_, i) => {
    const colors = ['rgba(74, 222, 128, 0.55)', 'rgba(251, 191, 36, 0.55)', 'rgba(163, 230, 53, 0.55)', 'rgba(52, 211, 153, 0.55)'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = 5 + Math.random() * 7;
    return {
      id: i,
      delay: Math.random() * 1500,
      startX: Math.random() * width,
      startY: height + 50,
      drift: (Math.random() - 0.5) * (width * 0.2),
      riseHeight: height * 0.6 + Math.random() * (height * 0.3),
      size,
      color,
    };
  });
}

function FloatingEmber({ ember }: { ember: EmberProps }) {
  const riseAnim = React.useRef(new Animated.Value(0)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(ember.delay),
        Animated.parallel([
          Animated.timing(riseAnim, {
            toValue: 1,
            duration: 4000 + Math.random() * 2500,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(opacityAnim, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.delay(2000),
            Animated.timing(opacityAnim, {
              toValue: 0,
              duration: 1200,
              useNativeDriver: true,
            }),
          ]),
        ]),
        Animated.parallel([
          Animated.timing(riseAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, [ember.delay, riseAnim, opacityAnim]);

  const translateY = riseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [ember.startY, ember.startY - ember.riseHeight],
  });

  const translateX = riseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [
      ember.startX,
      ember.startX + ember.drift * 0.5 + Math.sin(ember.id) * 15,
      ember.startX + ember.drift,
    ],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: ember.size,
        height: ember.size,
        borderRadius: ember.size / 2,
        backgroundColor: ember.color,
        opacity: opacityAnim,
        transform: [{ translateX }, { translateY }],
      }}
    />
  );
}



function ExpCounter({ targetPoints }: { targetPoints: number }) {
  const countAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.5)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;
  const glowAnim = React.useRef(new Animated.Value(0)).current;
  const sparkleRotate = React.useRef(new Animated.Value(0)).current;
  const [displayCount, setDisplayCount] = React.useState(0);

  React.useEffect(() => {
    Animated.sequence([
      Animated.delay(450),
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(countAnim, {
          toValue: targetPoints,
          duration: 1200,
          useNativeDriver: false,
        }),
      ]),
    ]).start();

    const listener = countAnim.addListener(({ value }) => {
      setDisplayCount(Math.round(value));
    });

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    Animated.loop(
      Animated.timing(sparkleRotate, {
        toValue: 1,
        duration: 6000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    return () => {
      countAnim.removeListener(listener);
    };
  }, [targetPoints, countAnim, scaleAnim, opacityAnim, glowAnim, sparkleRotate]);

  const rotateLeft = sparkleRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const rotateRight = sparkleRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-360deg'],
  });

  return (
    <Animated.View
      style={{
        alignItems: 'center',
        opacity: opacityAnim,
        transform: [{ scale: scaleAnim }],
      }}
    >
      <View style={{ width: 110, height: 110, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
        {/* Glowing Medallion */}
        <Animated.View
          style={{
            position: 'absolute',
            top: 5,
            left: 5,
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: '#10b981',
            transform: [
              {
                scale: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.65, 1], // Shrinks down to perfectly hug the 40px icon
                })
              }
            ]
          }}
        >
          <LinearGradient
            colors={['#34d399', '#059669']}
            style={{ flex: 1, borderRadius: 50 }}
          />
        </Animated.View>

        {/* Static Leaf Icon perfectly centered */}
        <View style={{ position: 'absolute', width: 110, height: 110, justifyContent: 'center', alignItems: 'center' }} pointerEvents="none">
          <Ionicons name="leaf" size={44} color="#FFFFFF" />
        </View>

        {/* Sparkle 1 */}
        <Animated.View
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            transform: [{ rotate: rotateLeft }],
            zIndex: 10,
          }}
        >
          <Ionicons name="sparkles" size={18} color="#6EE7B7" />
        </Animated.View>

        {/* Sparkle 2 */}
        <Animated.View
          style={{
            position: 'absolute',
            bottom: 2,
            left: 2,
            transform: [{ rotate: rotateRight }],
            zIndex: 10,
          }}
        >
          <Ionicons name="star" size={12} color="#34D399" />
        </Animated.View>
      </View>

      <Animated.Text
        style={{
          fontSize: 52,
          fontWeight: '900',
          color: '#FFFFFF',
          textShadowColor: 'rgba(16, 185, 129, 0.5)',
          textShadowOffset: { width: 0, height: 4 },
          textShadowRadius: 10,
          marginBottom: 4,
        }}
      >
        +{displayCount}
      </Animated.Text>
      <Text style={{ fontSize: 13, fontWeight: '800', color: '#A2C2B5', letterSpacing: 1.5, textTransform: 'uppercase' }}>
        ECO Points Earned
      </Text>

      {/* Streak Active Tag */}
      <View style={{
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(74, 222, 128, 0.12)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(74, 222, 128, 0.2)',
      }}>
        <Ionicons name="flame" size={14} color="#FF6B6B" />
        <Text style={{ fontSize: 11, fontWeight: '800', color: '#4ade80', letterSpacing: 0.5 }}>
          STREAK MULTIPLIER ACTIVE 🔥
        </Text>
      </View>
    </Animated.View>
  );
}

export function LessonCompleteOverlay({ model }: { model: EcoBudMobileModel }) {
  const { width, height } = Dimensions.get('window');
  const contentScale = React.useRef(new Animated.Value(0.8)).current;
  const contentOpacity = React.useRef(new Animated.Value(0)).current;
  const checkScale = React.useRef(new Animated.Value(0)).current;
  const checkRotate = React.useRef(new Animated.Value(0)).current;
  const glowScale = React.useRef(new Animated.Value(0.9)).current;
  const shineAnim = React.useRef(new Animated.Value(-150)).current;
  const btnPulse = React.useRef(new Animated.Value(1)).current;
  const btnOpacity = React.useRef(new Animated.Value(1)).current;
  const bgOpacity = React.useRef(new Animated.Value(1)).current;

  const [isAnimatingPoints, setIsAnimatingPoints] = React.useState(false);
  const numParticles = model.completionCelebrationType === 'claim' ? 24 : 12;
  const particleAnims = React.useRef(
    Array.from({ length: 24 }, () => ({
      pos: new Animated.ValueXY({ x: width / 2 - 15, y: height / 2 - 80 }),
      scale: new Animated.Value(0),
      opacity: new Animated.Value(0),
    }))
  ).current;

  const startPointsAnimation = () => {
    // 1. Immediately switch tab so the home page renders in background
    model.setActiveTab('home', true);

    // 2. Wait 100ms for the home tab to fully render natively
    setTimeout(() => {
      setIsAnimatingPoints(true);

      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.timing(btnOpacity, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.timing(bgOpacity, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]).start();

      const animations = particleAnims.map((particle, index) => {
        const angle = (Math.PI * 2 * index) / numParticles + (Math.random() - 0.5) * 0.4;
        const radius = 70 + Math.random() * 50;
        const burstX = width / 2 - 15 + Math.cos(angle) * radius;
        const burstY = height / 2 - 80 + Math.sin(angle) * radius;

        const delay = index * 60;

        return Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.spring(particle.pos, {
              toValue: { x: burstX, y: burstY },
              tension: 80,
              friction: 6,
              useNativeDriver: true,
            }),
            Animated.timing(particle.scale, {
              toValue: 1.5,
              duration: 250,
              useNativeDriver: true,
            }),
            Animated.timing(particle.opacity, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }),
          ]),
          Animated.delay(120),
          Animated.parallel([
            Animated.timing(particle.pos, {
              toValue: { x: (width / 2) - 15, y: 434 }, // Target exactly the center of the LevelCard progress bar (pushed further down by AI search)
              duration: 650,
              easing: Easing.bezier(0.25, 1, 0.5, 1),
              useNativeDriver: true,
            }),
            Animated.timing(particle.scale, {
              toValue: 0.4,
              duration: 650,
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.delay(450),
              Animated.timing(particle.opacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
              }),
            ]),
          ]),
        ]);
      });

      Animated.parallel(animations).start(() => {
        model.resetQuiz();
        model.setActiveOverlay(null);
        DeviceEventEmitter.emit('ECO_POINTS_DROP_ANIMATION');
      });
    }, 100);
  };

  React.useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(contentScale, {
          toValue: 1,
          friction: 5,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.spring(checkScale, {
          toValue: 1,
          friction: 3,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(shineAnim, {
          toValue: 350,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Rotating Ring around Checkmark
    Animated.loop(
      Animated.timing(checkRotate, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Breathing Glow of Outer Badge
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowScale, {
          toValue: 1.1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue: 0.9,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();


  }, [contentScale, contentOpacity, checkScale, shineAnim, checkRotate, glowScale, btnPulse]);

  const confettiPieces = React.useMemo(() => generateConfettiPieces(25), []);
  const embers = React.useMemo(() => generateEmbers(8), []);

  return (
    <View style={[styles.fullscreenOverlay, isAnimatingPoints && { backgroundColor: 'transparent' }]}>
      {/* Immersive Deep Emerald Background */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: bgOpacity }]}>
        <LinearGradient
          colors={['#06231E', '#093B32', '#126027']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Background Orbs */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: bgOpacity }]} pointerEvents="none">
        <View style={{
          position: 'absolute',
          top: -60,
          right: -60,
          width: 280,
          height: 280,
          borderRadius: 140,
          backgroundColor: 'rgba(74, 222, 128, 0.12)',
        }} />
        <View style={{
          position: 'absolute',
          bottom: -80,
          left: -80,
          width: 320,
          height: 320,
          borderRadius: 160,
          backgroundColor: 'rgba(23, 160, 126, 0.08)',
        }} />
      </Animated.View>

      {/* Floating bio-luminescent embers */}
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', zIndex: 5 }, { opacity: bgOpacity }]} pointerEvents="none">
        <View style={StyleSheet.absoluteFill}>
          {embers.map((ember) => (
            <FloatingEmber key={ember.id} ember={ember} />
          ))}
        </View>
      </Animated.View>

      {/* Confetti container */}
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', zIndex: 10 }, { opacity: bgOpacity }]} pointerEvents="none">
        <View style={StyleSheet.absoluteFill}>
          {confettiPieces.map((piece) => (
            <ConfettiParticle key={piece.id} piece={piece} />
          ))}
        </View>
      </Animated.View>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            opacity: contentOpacity,
            transform: [{ scale: contentScale }],
            alignItems: 'center',
            width: '100%',
          }}
        >
          {/* Glassmorphic Container Card */}
          <View style={{
            width: '100%',
            backgroundColor: 'rgba(255, 255, 255, 0.09)',
            borderRadius: 32,
            borderWidth: 1.5,
            borderColor: 'rgba(255, 255, 255, 0.14)',
            paddingHorizontal: 24,
            paddingVertical: 36,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 16 },
            shadowOpacity: 0.25,
            shadowRadius: 24,
            elevation: 12,
            overflow: 'hidden',
          }}>

            {/* Shimmer sweep effect */}
            <Animated.View
              style={{
                position: 'absolute',
                top: -150,
                bottom: -150,
                width: 60,
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                transform: [
                  { translateX: shineAnim },
                  { rotate: '25deg' },
                ],
              }}
            />

            {/* 3D concentric rings around checkmark */}
            <View style={{ position: 'relative', marginBottom: 28 }}>
              {/* Concentric outer breathing glow */}
              <Animated.View
                style={{
                  position: 'absolute',
                  top: -12,
                  left: -12,
                  right: -12,
                  bottom: -12,
                  borderRadius: 60,
                  backgroundColor: 'rgba(74, 222, 128, 0.15)',
                  transform: [{ scale: Animated.multiply(checkScale, glowScale) }]
                }}
              />

              {/* Dash rotating ring */}
              <Animated.View
                style={{
                  position: 'absolute',
                  top: -4,
                  left: -4,
                  right: -4,
                  bottom: -4,
                  borderRadius: 52,
                  borderWidth: 2,
                  borderColor: 'rgba(74, 222, 128, 0.6)',
                  borderStyle: 'dashed',
                  transform: [{
                    rotate: checkRotate.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg'],
                    })
                  }]
                }}
              />

              {/* Main Check Ring */}
              <Animated.View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  backgroundColor: '#10b981',
                  justifyContent: 'center',
                  alignItems: 'center',
                  transform: [{ scale: checkScale }],
                  shadowColor: '#10b981',
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.4,
                  shadowRadius: 18,
                  elevation: 10,
                  borderWidth: 4,
                  borderColor: 'rgba(255, 255, 255, 0.25)',
                }}
              >
                <Ionicons name="checkmark-sharp" size={56} color="#FFFFFF" />
              </Animated.View>
            </View>

            {/* Sparkle badge */}
            <View style={{
              backgroundColor: 'rgba(251, 191, 36, 0.16)',
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 20,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: 'rgba(251, 191, 36, 0.3)',
            }}>
              <Ionicons name="sparkles" size={14} color="#FBBF24" />
              <Text style={{ fontSize: 11, fontWeight: '900', color: '#FBBF24', letterSpacing: 1, textTransform: 'uppercase' }}>
                {model.completionCelebrationType === 'quiz' ? 'Quiz Passed' : model.completionCelebrationType === 'lesson' ? 'Lesson Mastered' : 'Reward Claimed'}
              </Text>
            </View>

            <Text style={{ fontSize: 32, fontWeight: '900', color: '#FFFFFF', marginBottom: 8, textAlign: 'center', letterSpacing: -0.5 }}>
              {model.completionCelebrationType === 'quiz' ? 'Quiz Passed!' : model.completionCelebrationType === 'lesson' ? 'Lesson Complete!' : 'Challenge Claimed!'}
            </Text>

            <Text style={{ fontSize: 15, color: '#C2D9CE', marginBottom: 32, textAlign: 'center', lineHeight: 22, paddingHorizontal: 8 }}>
              {model.completionCelebrationType === 'quiz'
                ? 'Excellent work! You have successfully verified your knowledge.'
                : model.completionCelebrationType === 'lesson'
                  ? 'Superb! You have finished reading the lesson materials.'
                  : 'Awesome! You have completed a challenge and earned your rewards!'}
            </Text>

            {model.completionCelebrationType === 'claim' && model.earnedCoins > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 24 }}>
                <ExpCounter targetPoints={model.earnedPoints} />
                <View style={{ alignItems: 'center' }}>
                  <View style={{ width: 110, height: 110, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                    <View style={{ position: 'absolute', top: 5, left: 5, width: 100, height: 100, borderRadius: 50, backgroundColor: '#FBBF24' }}>
                      <LinearGradient colors={['#FDE68A', '#F59E0B']} style={{ flex: 1, borderRadius: 50 }} />
                    </View>
                    <Ionicons name="cash" size={44} color="#FFF" />
                  </View>
                  <Text style={{ fontSize: 52, fontWeight: '900', color: '#FFF', textShadowColor: 'rgba(245, 158, 11, 0.5)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 10, marginBottom: 4 }}>+{model.earnedCoins}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#FDE68A', letterSpacing: 1.5, textTransform: 'uppercase' }}>Coins Earned</Text>
                </View>
              </View>
            ) : (
              <ExpCounter targetPoints={model.earnedPoints} />
            )}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Footer view with Continue button */}
      <Animated.View style={{ paddingHorizontal: 24, paddingBottom: 48, backgroundColor: 'transparent', alignItems: 'center', opacity: btnOpacity }}>
        <View style={{ width: '100%' }}>
          <TouchableOpacity
            onPress={startPointsAnimation}
            style={{
              width: '100%',
              height: 58,
              borderRadius: 20,
              overflow: 'hidden',
              shadowColor: '#10b981',
              shadowOpacity: 0.35,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
              elevation: 8,
            }}
          >
            <LinearGradient
              colors={['#10b981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                flexDirection: 'row',
                gap: 8,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 }}>
                Continue
              </Text>
              <Ionicons name="arrow-forward-outline" size={18} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {particleAnims.map((particle, index) => (
          <Animated.View
            key={index}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              transform: [
                { translateX: particle.pos.x },
                { translateY: particle.pos.y },
                { scale: particle.scale },
              ],
              opacity: particle.opacity,
              zIndex: 9999,
              shadowColor: '#10b981',
              shadowRadius: 10,
              shadowOpacity: 0.8,
              shadowOffset: { width: 0, height: 0 },
              elevation: 10,
            }}
          >
            <View style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: model.completionCelebrationType === 'claim' && index % 2 !== 0 ? '#F59E0B' : '#10b981',
              justifyContent: 'center',
              alignItems: 'center',
              borderWidth: 2,
              borderColor: '#FFF',
            }}>
              <Ionicons name={model.completionCelebrationType === 'claim' && index % 2 !== 0 ? 'cash' : 'leaf'} size={16} color="#FFF" />
            </View>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

export function LeaderboardOverlay({ model }: { model: EcoBudMobileModel }) {
  const [page, setPage] = React.useState(1);
  const itemsPerPage = 10;
  const actualItems = model.leaderboard?.items ?? [];
  const totalPages = Math.max(1, Math.ceil(actualItems.length / itemsPerPage));

  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageItems = actualItems.slice(startIndex, endIndex);

  // Animations
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(20)).current;

  React.useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [page, fadeAnim, slideAnim]);

  const isPageOne = page === 1;
  
  const top3 = isPageOne ? currentPageItems.slice(0, 3) : [];
  const remainingList = isPageOne ? currentPageItems.slice(3) : currentPageItems;
  
  const podiumLeaders = [];
  if (top3[1]) podiumLeaders.push({ ...top3[1], badgeColor: '#B0BEC5', avatarSize: 64, cardStyle: { marginTop: 40 } });
  if (top3[0]) podiumLeaders.push({ ...top3[0], badgeColor: '#FFD700', avatarSize: 80, cardStyle: {} });
  if (top3[2]) podiumLeaders.push({ ...top3[2], badgeColor: '#CD7F32', avatarSize: 64, cardStyle: { marginTop: 40 } });

  const currentUser = actualItems.find(item => item.isCurrentUser);

  return (
    <View style={styles.fullscreenOverlay}>
      <TopNavbar model={model} showBack={true} title="Leaderboard" />
      <View style={[styles.homeContent, { flex: 1, paddingBottom: 0 }]}>
        <View style={styles.leaderboardFilterRow}>
          <TouchableOpacity style={[styles.filterPillActive, { flex: 1, justifyContent: 'center' }]}><Text style={styles.filterPillActiveText}>Global</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.filterPillInactive, { flex: 1, justifyContent: 'center' }]}><Text style={styles.filterPillInactiveText}>Friends</Text></TouchableOpacity>
        </View>

        <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {isPageOne && top3.length > 0 && (
            <View style={styles.leaderboardTop3}>
              {podiumLeaders.map((leader) => (
                <View key={leader.rank} style={[styles.lbTopCard, leader.cardStyle]}>
                  <View style={styles.lbAvatarWrap}>
                    <AvatarBubble
                      label={leader.displayName}
                      size={leader.avatarSize}
                      style={styles.lbAvatarImg}
                      textStyle={leader.avatarSize > 64 ? styles.lbAvatarTextLarge : styles.lbAvatarText}
                    />
                    <View
                      style={[
                        styles.lbRankBadge,
                        {
                          backgroundColor: leader.badgeColor,
                          width: leader.rank === 1 ? 28 : 24,
                          height: leader.rank === 1 ? 28 : 24,
                          borderRadius: leader.rank === 1 ? 14 : 12,
                        },
                      ]}
                    >
                      <Text style={[styles.lbRankText, leader.rank === 1 ? { fontSize: 14 } : null]}>{leader.rank}</Text>
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.lbTopName,
                      leader.rank === 1 ? { fontSize: 18, fontWeight: 'bold' } : null,
                    ]}
                  >
                    {leader.isCurrentUser ? 'You' : leader.displayName}
                  </Text>
                  <Text
                    style={[
                      styles.lbTopPoints,
                      leader.rank === 1 ? { color: '#126027', fontWeight: 'bold' } : null,
                    ]}
                  >
                    {leader.points} pts
                  </Text>
                </View>
              ))}
            </View>
          )}

          <ScrollView style={{ flex: 1, marginTop: isPageOne ? 24 : 8, paddingHorizontal: 4 }}>
            {remainingList.map(user => (
              <View key={user.rank} style={styles.lbListRow}>
                <Text style={styles.lbListRank}>{user.rank}</Text>
                <AvatarBubble
                  label={user.displayName}
                  size={40}
                  style={styles.lbListAvatar}
                  textStyle={styles.lbListAvatarText}
                />
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text style={styles.cardTitle}>{user.isCurrentUser ? 'You' : user.displayName}</Text>
                </View>
                <Text style={styles.lbListPoints}>{user.points} pts</Text>
              </View>
            ))}
          </ScrollView>
        </Animated.View>

        {/* Pagination Controls */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderTopWidth: 1, borderColor: '#EDF6F1', alignItems: 'center' }}>
          <TouchableOpacity 
            disabled={page === 1} 
            onPress={() => setPage(page - 1)}
            style={{ padding: 8, opacity: page === 1 ? 0.3 : 1 }}
          >
            <Ionicons name="chevron-back" size={24} color="#126027" />
          </TouchableOpacity>
          <Text style={{ fontWeight: '800', color: '#126027', fontSize: 14 }}>
            Page {page} of {totalPages}
          </Text>
          <TouchableOpacity 
            disabled={page >= totalPages} 
            onPress={() => setPage(page + 1)}
            style={{ padding: 8, opacity: page >= totalPages ? 0.3 : 1 }}
          >
            <Ionicons name="chevron-forward" size={24} color="#126027" />
          </TouchableOpacity>
        </View>

        {currentUser && (
          <View style={[styles.lbCurrentUserCard, { marginTop: 0, marginBottom: 24, borderRadius: 16, marginHorizontal: 16 }]}>
            <Text style={styles.lbListRank}>{currentUser.rank}</Text>
            <AvatarBubble
              label={currentUser.displayName}
              size={40}
              style={[styles.lbListAvatar, styles.lbCurrentUserAvatar]}
              textStyle={styles.lbCurrentUserAvatarText}
            />
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={[styles.cardTitle, { color: '#FFF' }]}>You</Text>
            </View>
            <Text style={[styles.lbListPoints, { color: '#FFF' }]}>{currentUser.points} pts</Text>
          </View>
        )}

      </View>
    </View>
  );
}

export function RewardsOverlay({ model }: { model: EcoBudMobileModel }) {
  return (
    <OverlayScaffold
      title="Rewards & Badges"
      subtitle="Track unlocks and next milestones"
      onBack={() => model.setActiveOverlay(null)}
    >
      <ScrollView contentContainerStyle={styles.overlayScroll}>
        <SurfaceCard style={styles.rewardsHeroCard}>
          <Text style={styles.rewardsHeroValue}>{model.rewards?.points ?? 0} ECO Points</Text>
          <Text style={styles.sectionCaption}>Available for exchange</Text>
        </SurfaceCard>

        <Text style={styles.sectionHeadline}>Badges</Text>
        <View style={styles.badgesGrid}>
          {(model.rewards?.badges ?? []).map((badge) => (
            <BadgeCard key={badge.id} badge={badge} fullWidth />
          ))}
        </View>

        <Text style={styles.sectionHeadline}>Lifetime Achievements</Text>
        {(model.rewards?.achievements ?? []).map((achievement) => {
          const progress = Math.min(100, Math.round((achievement.current / achievement.target) * 100));

          return (
            <SurfaceCard key={achievement.id} style={styles.achievementCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>
                  {achievement.label} ({achievement.current}/{achievement.target})
                </Text>
                <Text style={styles.logPoints}>{achievement.reward} pts</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
            </SurfaceCard>
          );
        })}
      </ScrollView>
    </OverlayScaffold>
  );
}

export function TransparencyOverlay({ model }: { model: EcoBudMobileModel }) {
  return (
    <OverlayScaffold
      title="Activity Transparency"
      subtitle="Verified impact logs and immutable reward history"
      onBack={() => model.setActiveOverlay(null)}
    >
      <ScrollView contentContainerStyle={styles.overlayScroll}>
        <View style={styles.timelineRail}>
          {(model.transparency?.logs ?? []).map((log, index) => (
            <View key={log.id} style={styles.timelineRow}>
              <View style={styles.timelineNodeWrap}>
                <View style={styles.timelineNode} />
                {index < (model.transparency?.logs.length ?? 0) - 1 ? <View style={styles.timelineLine} /> : null}
              </View>
              <SurfaceCard style={styles.timelineCard}>
                <Text style={styles.cardTitle}>{log.publicLabel}</Text>
                <Text style={styles.sectionCaption}>{formatLongDate(log.timestamp)}</Text>
                <Text style={styles.hashText}>{shortHash(log.currentHash)}</Text>
              </SurfaceCard>
            </View>
          ))}
        </View>

        {(model.transparency?.logs ?? []).map((log) => (
          <SurfaceCard key={`detail-${log.id}`} style={styles.transparencyDetailCard}>
            <View style={styles.rowMeta}>
              <MaterialCommunityIcons name="leaf" size={22} color={ecoTheme.colors.primaryDark} />
              <Text style={styles.cardTitle}>Verified on ECOBUD ledger</Text>
            </View>
            <Text style={styles.transparencyLine}>Action: {log.actionType}</Text>
            <Text style={styles.transparencyLine}>Points: +{log.pointsAwarded}</Text>
            <Text style={styles.transparencyLine}>Date: {formatLongDate(log.timestamp)}</Text>
            <Text style={styles.transparencyLine}>Transaction: {shortHash(log.currentHash)}</Text>
            <SecondaryButton
              label="View Explorer"
              onPress={() => Alert.alert('Explorer placeholder', `Transaction hash:\n${log.currentHash}`)}
            />
          </SurfaceCard>
        ))}
      </ScrollView>
    </OverlayScaffold>
  );
}

interface FireRainParticleProps {
  id: number;
  startX: number;
  startY: number;
  delay: number;
  duration: number;
  size: number;
  drift: number;
  color: string;
}

function generateFireRainParticles(count: number) {
  const { width, height } = Dimensions.get('window');
  const colors = ['#FF3D00', '#FF9100', '#FFD600', '#FFEA00', '#FF5722', '#FFC107'];
  
  return Array.from({ length: count }, (_, i) => {
    return {
      id: i,
      startX: Math.random() * width,
      startY: -50,
      delay: Math.random() * 2000,
      duration: 2000 + Math.random() * 1500,
      size: 3 + Math.random() * 4,
      drift: (Math.random() - 0.5) * 80,
      color: colors[Math.floor(Math.random() * colors.length)],
    };
  });
}

function FireRainParticle({ particle }: { particle: FireRainParticleProps }) {
  const fallAnim = React.useRef(new Animated.Value(0)).current;
  const { height } = Dimensions.get('window');

  React.useEffect(() => {
    const totalDuration = particle.duration + particle.delay;
    fallAnim.setValue(0);
    const loop = Animated.loop(
      Animated.timing(fallAnim, {
        toValue: 1,
        duration: totalDuration,
        useNativeDriver: true,
        easing: Easing.linear,
      })
    );
    loop.start();

    return () => {
      loop.stop();
    };
  }, [fallAnim, particle.duration, particle.delay]);

  const totalDuration = particle.duration + particle.delay;
  const startRatio = particle.delay / totalDuration;

  const translateY = fallAnim.interpolate({
    inputRange: [0, startRatio, 1],
    outputRange: [particle.startY, particle.startY, height + 50],
  });

  const translateX = fallAnim.interpolate({
    inputRange: [0, startRatio, (1 + startRatio) / 2, 1],
    outputRange: [
      particle.startX,
      particle.startX,
      particle.startX + particle.drift,
      particle.startX + particle.drift * 1.5,
    ],
  });

  const opacity = fallAnim.interpolate({
    inputRange: [0, startRatio, startRatio + 0.1 * (1 - startRatio), 0.8 + 0.2 * startRatio, 1],
    outputRange: [0, 0, 0.8, 0.8, 0],
  });

  const rotate = fallAnim.interpolate({
    inputRange: [0, startRatio, 1],
    outputRange: ['0deg', '0deg', '360deg'],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: particle.size,
        height: particle.size * 1.8,
        borderRadius: particle.size / 2,
        backgroundColor: particle.color,
        opacity,
        transform: [
          { translateX },
          { translateY },
          { rotate },
        ],
        shadowColor: particle.color,
        shadowOpacity: 1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 0 },
        elevation: 4,
      }}
    />
  );
}

export function StreakUnlockedOverlay({ model }: { model: EcoBudMobileModel }) {
  const scale = React.useRef(new Animated.Value(0.5)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const buttonPulseAnim = React.useRef(new Animated.Value(1)).current;
  const particles = React.useMemo(() => generateFireRainParticles(20), []);

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      })
    ]).start();

    // Pulse animation for the glowing container background
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.95, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

    // Pulse animation for the button
    Animated.loop(
      Animated.sequence([
        Animated.timing(buttonPulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(buttonPulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    return () => {
      pulseAnim.stopAnimation();
      buttonPulseAnim.stopAnimation();
    };
  }, [scale, opacity, pulseAnim, buttonPulseAnim]);

  const closeOverlay = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 0.5,
        friction: 6,
        tension: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      })
    ]).start(() => {
      model.setActiveOverlay(null);
    });
  };

  const streakVal = model.dashboard?.streak ?? 3;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={{ flex: 1, opacity: opacity as any, justifyContent: 'center', alignItems: 'center' }}>
        
        {/* Deep, premium dark gradient background */}
        <LinearGradient
          colors={['rgba(7, 28, 25, 0.96)', 'rgba(12, 18, 17, 0.99)']}
          style={StyleSheet.absoluteFill}
        />

        {/* Fire Sparks Rain/Shower Effect */}
        <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
          {particles.map((particle) => (
            <FireRainParticle key={particle.id} particle={particle} />
          ))}
        </View>

        <Animated.View 
          style={{ 
            transform: [{ scale: scale as any }], 
            alignItems: 'center', 
            width: '90%', 
            zIndex: 10 
          }}
        >
          {/* Ambient fire glow aura behind the flame */}
          <Animated.View style={{
            position: 'absolute',
            top: 10,
            width: 180,
            height: 180,
            borderRadius: 90,
            backgroundColor: 'rgba(244, 144, 0, 0.15)',
            transform: [{ scale: pulseAnim as any }],
            filter: 'blur(20px)',
            zIndex: -1,
          }} />

          {/* Large Animated Duolingo Flame */}
          <View style={{ width: 150, height: 150, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <FireStreak streakCount={streakVal} isActive={true} size={140} mode="hero" />
          </View>

          {/* Active Streak Label Badge */}
          <View style={{
            backgroundColor: '#FF6D00',
            paddingHorizontal: 16,
            paddingVertical: 6,
            borderRadius: 100,
            marginBottom: 24,
            shadowColor: '#FF6D00',
            shadowOpacity: 0.4,
            shadowRadius: 10,
            elevation: 4,
          }}>
            <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 13, letterSpacing: 1.5 }}>
              {streakVal}-DAY STREAK
            </Text>
          </View>

          {/* Achievement Titles */}
          <Text style={{ 
            fontSize: 36, 
            fontWeight: '900', 
            color: '#FFF', 
            textAlign: 'center', 
            marginBottom: 12,
            textShadowColor: 'rgba(244, 144, 0, 0.3)',
            textShadowOffset: { width: 0, height: 3 },
            textShadowRadius: 10 
          }}>
            Streak Unlocked!
          </Text>
          
          <Text style={{ 
            fontSize: 16, 
            color: '#A7F3D0', 
            textAlign: 'center', 
            lineHeight: 24, 
            marginBottom: 32, 
            paddingHorizontal: 16,
            opacity: 0.9 
          }}>
            Outstanding job! You've successfully completed habit actions {streakVal} days in a row. Keep completing daily actions to watch your streak grow and earn bigger rewards.
          </Text>

          {/* Clean, boxless rewards row */}
          <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'center', 
            gap: 24, 
            width: '100%', 
            marginBottom: 36 
          }}>
            {/* Reward 1 */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}>
              <Text style={{ fontSize: 24 }}>🌱</Text>
              <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '800' }}>+50 XP</Text>
            </View>

            {/* Reward 2 */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}>
              <Text style={{ fontSize: 24 }}>🪙</Text>
              <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '800' }}>+10 Coins</Text>
            </View>
          </View>

          <Animated.View style={{ transform: [{ scale: buttonPulseAnim as any }], width: '100%' }}>
            <PrimaryButton 
              label="Keep it up!" 
              onPress={closeOverlay} 
            />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

export function StreakRewardsOverlay({ model }: { model: EcoBudMobileModel }) {
  const currentStreak = getVisibleStreak(model.dashboard?.streak ?? model.session?.user.currentStreak ?? 0);

  const scaleAnim = React.useRef(new Animated.Value(0.5)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start();
  }, [scaleAnim, opacityAnim]);

  const closeOverlay = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.5,
        friction: 6,
        tension: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      })
    ]).start(() => {
      model.setActiveOverlay(null);
    });
  };

  const rewards = [
    { day: 7, text: '5 Coins + 25 EXP' },
    { day: 14, text: '10 Coins + 40 EXP' },
    { day: 21, text: '15 Coins + 50 EXP' },
    { day: 30, text: '25 Coins + 100 EXP' },
    { day: 40, text: '30 Coins + 120 EXP' },
    { day: 50, text: '50 Coins + 200 EXP' },
    { day: 60, text: '60 Coins + 250 EXP' },
    { day: 70, text: '70 Coins + 300 EXP' },
    { day: 80, text: '80 Coins + 350 EXP' },
    { day: 90, text: '90 Coins + 400 EXP' },
    { day: 100, text: '150 Coins + 1,000 EXP + 100-Day Badge' },
  ];

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 9999, justifyContent: 'center', alignItems: 'center', opacity: opacityAnim }]}>
      <TouchableOpacity 
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)' }]} 
        activeOpacity={1} 
        onPress={closeOverlay} 
      />
      <Animated.View style={{
        width: '90%',
        maxHeight: '85%',
        backgroundColor: '#0C5E54',
        borderRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOpacity: 0.5,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
        elevation: 10,
        transform: [{ scale: scaleAnim }],
      }}>
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 24, fontWeight: '900', color: '#FFF', textAlign: 'center' }}>Streak Rewards</Text>
          <Text style={{ fontSize: 14, color: '#A7F3D0', textAlign: 'center', marginTop: 8 }}>Keep your streak going to unlock more rewards!</Text>
        </View>

        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#FFF' }}>Your Streak: {currentStreak} Days</Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
          <View style={{ gap: 12 }}>
            {rewards.map((reward, index) => {
              const isUnlocked = currentStreak >= reward.day;
              const isMilestone = reward.day === 100;
              return (
                <View
                  key={index}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isUnlocked ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255,255,255,0.05)',
                    padding: 12,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: isUnlocked ? '#4ADE80' : 'rgba(255,255,255,0.1)',
                  }}
                >
                  <View style={{ width: 32, alignItems: 'center', justifyContent: 'center' }}>
                    {isUnlocked ? (
                      <Text style={{ fontSize: 18 }}>✓</Text>
                    ) : isMilestone ? (
                      <Text style={{ fontSize: 18 }}>👑</Text>
                    ) : (
                      <Text style={{ fontSize: 18 }}>🔒</Text>
                    )}
                  </View>
                  <View style={{ width: 70 }}>
                    <Text style={{ color: isUnlocked ? '#4ADE80' : '#A7F3D0', fontWeight: '800', fontSize: 14 }}>
                      Day {reward.day}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: isUnlocked ? '#FFF' : 'rgba(255,255,255,0.7)', fontWeight: '600', fontSize: 14, flexWrap: 'wrap' }}>
                      {reward.text}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>

        <View style={{ marginTop: 24 }}>
          <PrimaryButton label="Got it" onPress={closeOverlay} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

export function SettingsOverlay({ model }: { model: EcoBudMobileModel }) {
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newEmail, setNewEmail] = React.useState(model.session?.user.email ?? '');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');

  const handleSave = async () => {
    if (!currentPassword) {
      Alert.alert('Error', 'Current password is required to save changes.');
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match.');
      return;
    }

    try {
      await model.handleUpdateSecuritySettings({
        currentPassword,
        newEmail: newEmail !== model.session?.user.email ? newEmail : undefined,
        newPassword: newPassword ? newPassword : undefined,
      });
      // clear fields on success
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Security settings saved.');
      model.setActiveOverlay(null);
    } catch (e) {
      // error handled in hook
    }
  };

  return (
    <OverlayScaffold
      title="Settings & Security"
      subtitle="Update your account details and password"
      onBack={() => model.setActiveOverlay(null)}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.overlayScroll}>
          <Text style={[styles.sectionHeadline, { marginTop: 0 }]}>Email Address</Text>
          <SurfaceCard style={{ padding: 16 }}>
            <TextInput
              style={localStyles.formInput}
              value={newEmail}
              onChangeText={setNewEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="Enter new email"
            />
          </SurfaceCard>

          <Text style={styles.sectionHeadline}>Change Password</Text>
          <SurfaceCard style={{ padding: 16 }}>
            <TextInput
              style={[localStyles.formInput, { marginBottom: 16 }]}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="New Password (optional)"
            />
            <TextInput
              style={localStyles.formInput}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder="Confirm New Password"
            />
          </SurfaceCard>

          <Text style={styles.sectionHeadline}>Confirm Changes</Text>
          <SurfaceCard style={{ padding: 16 }}>
            <Text style={{ marginBottom: 12, fontSize: 13, color: '#6B7A75' }}>
              Please enter your current password to save any security changes.
            </Text>
            <TextInput
              style={localStyles.formInput}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              placeholder="Current Password"
            />
          </SurfaceCard>

          <View style={{ marginTop: 24 }}>
            <PrimaryButton label="Save Changes" onPress={() => void handleSave()} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </OverlayScaffold>
  );
}

const localStyles = StyleSheet.create({
  formInput: {
    backgroundColor: '#F7FBF9',
    borderWidth: 1,
    borderColor: '#E6F4EC',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: '#1A3326',
    fontWeight: '500',
  },
});
