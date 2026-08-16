import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { ecoTheme } from '../../shared/theme/ecoTheme';
import { swapService } from './swapService';
import type { SwapCategory, ItemCondition, MeetupMethod } from './types';
import { CATEGORY_LABELS, CONDITION_LABELS, MEETUP_LABELS } from './types';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../../app/utils/responsive';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CATEGORIES: SwapCategory[] = [
  'plastic', 'glass', 'metal', 'paper', 'cardboard',
  'electronics', 'clothing', 'household', 'plants', 'others',
];

const CONDITIONS: ItemCondition[] = ['new', 'like_new', 'good', 'fair', 'worn'];

const MEETUP_METHODS: { key: MeetupMethod; icon: string; desc: string }[] = [
  { key: 'public', icon: 'location', desc: 'Meet at a public location' },
  { key: 'pickup', icon: 'arrow-down', desc: 'Requester picks up from you' },
  { key: 'dropoff', icon: 'arrow-up', desc: 'You deliver to requester' },
];

export function CreateSwapListing({
  userId,
  onBack,
  onCreated,
}: {
  userId: string;
  onBack: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<SwapCategory | null>(null);
  const [quantity, setQuantity] = useState('');
  const [condition, setCondition] = useState<ItemCondition | null>(null);
  const [description, setDescription] = useState('');
  const [lookingFor, setLookingFor] = useState('');
  const [listingType, setListingType] = useState<'swap' | 'giveaway'>('swap');
  const [meetupMethod, setMeetupMethod] = useState<MeetupMethod | null>(null);
  const [meetupLocation, setMeetupLocation] = useState('');
  const [meetupLandmark, setMeetupLandmark] = useState('');
  const [meetupNotes, setMeetupNotes] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [showImageError, setShowImageError] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  React.useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  const handleBack = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_WIDTH,
      duration: 250,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      onBack();
    });
  };

  const totalSteps = 3;

  const pickImages = async () => {
    if (images.length >= 5) {
      Alert.alert('Maximum 5 photos allowed');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 5 - images.length,
    });
    if (!result.canceled) {
      const newImages = [...images, ...result.assets.map((a) => a.uri)];
      setImages(newImages.slice(0, 5));
    }
  };

  const takePicture = async () => {
    if (images.length >= 5) {
      Alert.alert('Maximum 5 photos allowed');
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera permissions to take a picture.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled) {
      const newImages = [...images, ...result.assets.map((a) => a.uri)];
      setImages(newImages.slice(0, 5));
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const canProceed = () => {
    if (step === 1) return title.trim() && category && quantity.trim() && condition;
    if (step === 2) return lookingFor.trim();
    return meetupMethod;
  };

  const handleSubmit = async () => {
    if (!category || !condition || !meetupMethod) return;
    setSubmitting(true);
    try {
      const uploadedUrls: string[] = [];
      for (const uri of images) {
        if (uri.startsWith('http')) {
          uploadedUrls.push(uri);
        } else {
          try {
            const url = await swapService.uploadImage(uri, userId);
            uploadedUrls.push(url);
          } catch (uploadErr: any) {
            throw new Error(uploadErr?.message || 'Failed to upload one or more listing photos. Please check your connection and try again.');
          }
        }
      }

      await swapService.createListing({
        title: title.trim(),
        category,
        quantity: quantity.trim(),
        condition,
        description: description.trim(),
        lookingFor: lookingFor.trim(),
        imageUrls: uploadedUrls,
        meetupMethod,
        meetupLocation: meetupLocation.trim() || undefined,
        meetupLandmark: meetupLandmark.trim() || undefined,
        meetupNotes: meetupNotes.trim() || undefined,
        city: city.trim() || undefined,
        province: province.trim() || undefined,
        userId,
      });
      onCreated();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create listing');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Animated.View style={[localStyles.container, { transform: [{ translateX: slideAnim }] }]}>
    <View style={localStyles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <LinearGradient colors={['#071C19', '#0C5E54', '#17A07E']} style={localStyles.header}>
          <View style={localStyles.headerRow}>
            <TouchableOpacity onPress={handleBack} style={localStyles.backBtn}>
              <Feather name="arrow-left" size={22} color="#FFF" />
              <Text style={localStyles.backLabel}>Back</Text>
            </TouchableOpacity>
            <Text style={localStyles.headerTitle}>New Listing</Text>
            <View style={{ width: 60 }} />
          </View>

          <View style={localStyles.progressRow}>
            {[1, 2, 3].map((s) => (
              <View key={s} style={localStyles.progressStep}>
                <View style={[localStyles.progressDot, step >= s && localStyles.progressDotActive]}>
                  {step > s ? (
                    <Ionicons name="checkmark" size={12} color="#FFF" />
                  ) : (
                    <Text style={[localStyles.progressDotText, step >= s && localStyles.progressDotTextActive]}>
                      {s}
                    </Text>
                  )}
                </View>
                {s < totalSteps && <View style={[localStyles.progressLine, step > s && localStyles.progressLineActive]} />}
              </View>
            ))}
          </View>
          <Text style={localStyles.stepLabel}>
            {step === 1 ? 'Item Information' : step === 2 ? 'Looking For' : 'Meetup Preferences'}
          </Text>
        </LinearGradient>

        <ScrollView
          style={localStyles.body}
          contentContainerStyle={localStyles.bodyContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
        >
          {step === 1 && (
            <>
              <View style={localStyles.imagePicker}>
                {images.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={localStyles.imageList}>
                    {images.map((uri, i) => (
                      <View key={i} style={localStyles.imageThumbWrap}>
                        <Image source={{ uri }} style={localStyles.imageThumb} />
                        <TouchableOpacity onPress={() => removeImage(i)} style={localStyles.removeImageBtn}>
                          <Ionicons name="close-circle" size={22} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    {images.length < 5 && (
                      <>
                        <TouchableOpacity onPress={pickImages} style={localStyles.addMoreImage}>
                          <Ionicons name="images-outline" size={24} color={ecoTheme.colors.primaryDark} />
                          <Text style={localStyles.addMoreText}>Gallery</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={takePicture} style={[localStyles.addMoreImage, { marginLeft: 8 }]}>
                          <Ionicons name="camera-outline" size={24} color={ecoTheme.colors.primaryDark} />
                          <Text style={localStyles.addMoreText}>Camera</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </ScrollView>
                ) : (
                  <View style={[localStyles.imagePlaceholder, { flexDirection: 'row', justifyContent: 'center', gap: 40 }]}>
                    <TouchableOpacity onPress={pickImages} style={{ alignItems: 'center' }}>
                      <Ionicons name="images-outline" size={40} color="#A7D5BA" />
                      <Text style={[localStyles.imagePlaceholderText, { marginTop: 8 }]}>Gallery</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={takePicture} style={{ alignItems: 'center' }}>
                      <Ionicons name="camera-outline" size={40} color="#A7D5BA" />
                      <Text style={[localStyles.imagePlaceholderText, { marginTop: 8 }]}>Camera</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <Text style={localStyles.fieldLabel}>Item Title *</Text>
              <TextInput
                style={localStyles.input}
                placeholder="e.g., Plastic Bottles, Glass Jars"
                placeholderTextColor="#9CA3AF"
                value={title}
                onChangeText={setTitle}
              />

              <Text style={localStyles.fieldLabel}>Category *</Text>
              <View style={localStyles.chipGrid}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setCategory(cat)}
                    style={[localStyles.chip, category === cat && localStyles.chipActive]}
                  >
                    <Text style={[localStyles.chipText, category === cat && localStyles.chipTextActive]}>
                      {CATEGORY_LABELS[cat]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={localStyles.fieldLabel}>Quantity *</Text>
              <TextInput
                style={localStyles.input}
                placeholder="e.g., 50"
                placeholderTextColor="#9CA3AF"
                value={quantity}
                onChangeText={(text) => setQuantity(text.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
              />

              <Text style={localStyles.fieldLabel}>Condition *</Text>
              <View style={localStyles.chipRow}>
                {CONDITIONS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setCondition(c)}
                    style={[localStyles.chip, condition === c && localStyles.chipActive]}
                  >
                    <Text style={[localStyles.chipText, condition === c && localStyles.chipTextActive]}>
                      {CONDITION_LABELS[c]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={localStyles.fieldLabel}>Description</Text>
              <TextInput
                style={[localStyles.input, localStyles.textArea]}
                placeholder="Describe your item (condition, size, quantity details...)"
                placeholderTextColor="#9CA3AF"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </>
          )}

          {step === 2 && (
            <>
              <Text style={localStyles.fieldLabel}>Listing Type *</Text>
              <View style={localStyles.chipGrid}>
                <TouchableOpacity
                  onPress={() => {
                    setListingType('swap');
                    setLookingFor('');
                  }}
                  style={[localStyles.suggestionChip, listingType === 'swap' && localStyles.suggestionChipActive]}
                >
                  <Text style={[localStyles.suggestionText, listingType === 'swap' && localStyles.suggestionTextActive]}>🔄 Swap</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setListingType('giveaway');
                    setLookingFor('Giveaway');
                  }}
                  style={[localStyles.suggestionChip, listingType === 'giveaway' && localStyles.suggestionChipActive]}
                >
                  <Text style={[localStyles.suggestionText, listingType === 'giveaway' && localStyles.suggestionTextActive]}>🎁 Giveaway</Text>
                </TouchableOpacity>
              </View>

              {listingType === 'swap' && (
                <>
                  <View style={localStyles.infoCard}>
                    <Ionicons name="bulb-outline" size={20} color="#D97706" />
                    <Text style={localStyles.infoText}>
                      Specify what you'd like to receive in exchange. Be specific to attract the right swaps!
                    </Text>
                  </View>

                  <Text style={localStyles.fieldLabel}>What are you looking for? *</Text>
                  <TextInput
                    style={localStyles.input}
                    placeholder="e.g., Indoor Plant, Used Books, School Supplies"
                    placeholderTextColor="#9CA3AF"
                    value={lookingFor}
                    onChangeText={setLookingFor}
                  />

                  <Text style={localStyles.suggestionLabel}>Popular requests:</Text>
                  <View style={localStyles.chipGrid}>
                    {['Flower Pot', 'Used Books', 'School Supplies', 'Plant Seeds', 'Plastic Storage Box', 'Garden Tools', 'Art Supplies', 'Cooking Utensils'].map((item) => (
                      <TouchableOpacity
                        key={item}
                        onPress={() => setLookingFor(item)}
                        style={localStyles.suggestionChip}
                      >
                        <Text style={localStyles.suggestionText}>{item}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {listingType === 'giveaway' && (
                <View style={localStyles.infoCard}>
                  <Ionicons name="gift-outline" size={20} color="#10B981" />
                  <Text style={localStyles.infoText}>
                    You're giving this item away for free! No exchange needed.
                  </Text>
                </View>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <Text style={localStyles.fieldLabel}>Meetup Method *</Text>
              <View style={localStyles.meetupOptions}>
                {MEETUP_METHODS.map((m) => (
                  <TouchableOpacity
                    key={m.key}
                    onPress={() => setMeetupMethod(m.key)}
                    style={[localStyles.meetupCard, meetupMethod === m.key && localStyles.meetupCardActive]}
                  >
                    <View style={[localStyles.meetupIcon, meetupMethod === m.key && localStyles.meetupIconActive]}>
                      <Ionicons name={m.icon as any} size={22} color={meetupMethod === m.key ? '#FFF' : ecoTheme.colors.primaryDark} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[localStyles.meetupTitle, meetupMethod === m.key && localStyles.meetupTitleActive]}>
                        {MEETUP_LABELS[m.key]}
                      </Text>
                      <Text style={localStyles.meetupDesc}>{m.desc}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {meetupMethod === 'public' && (
                <>
                  <Text style={localStyles.fieldLabel}>Meetup Location</Text>
                  <TextInput
                    style={localStyles.input}
                    placeholder="e.g., SM City Calamba"
                    placeholderTextColor="#9CA3AF"
                    value={meetupLocation}
                    onChangeText={setMeetupLocation}
                  />
                  <Text style={localStyles.fieldLabel}>Landmark</Text>
                  <TextInput
                    style={localStyles.input}
                    placeholder="e.g., Near Main Entrance"
                    placeholderTextColor="#9CA3AF"
                    value={meetupLandmark}
                    onChangeText={setMeetupLandmark}
                  />
                </>
              )}

              {meetupMethod === 'pickup' && (
                <View style={localStyles.infoCard}>
                  <Ionicons name="information-circle-outline" size={20} color="#2563EB" />
                  <Text style={localStyles.infoText}>
                    Your pickup address will only be shared after both users confirm the swap for privacy.
                  </Text>
                </View>
              )}

              {meetupMethod === 'dropoff' && (
                <View style={localStyles.infoCard}>
                  <Ionicons name="information-circle-outline" size={20} color="#2563EB" />
                  <Text style={localStyles.infoText}>
                    The delivery address will only be shared after both users confirm the swap for privacy.
                  </Text>
                </View>
              )}

              <Text style={localStyles.fieldLabel}>City</Text>
              <TextInput
                style={localStyles.input}
                placeholder="e.g., Santa Rosa"
                placeholderTextColor="#9CA3AF"
                value={city}
                onChangeText={setCity}
              />
              <Text style={localStyles.fieldLabel}>Province</Text>
              <TextInput
                style={localStyles.input}
                placeholder="e.g., Laguna"
                placeholderTextColor="#9CA3AF"
                value={province}
                onChangeText={setProvince}
              />

              <Text style={localStyles.fieldLabel}>Additional Notes</Text>
              <TextInput
                style={[localStyles.input, localStyles.textArea]}
                placeholder="Any extra details about the meetup..."
                placeholderTextColor="#9CA3AF"
                value={meetupNotes}
                onChangeText={setMeetupNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </>
          )}

          <View style={localStyles.bottomBar}>
            {step > 1 && (
              <TouchableOpacity onPress={() => setStep(step - 1)} style={localStyles.prevBtn}>
                <Text style={localStyles.prevBtnText}>Previous</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => {
                if (step === 1 && images.length < 3) {
                  setShowImageError(true);
                  return;
                }
                if (step < totalSteps) {
                  setStep(step + 1);
                } else {
                  handleSubmit();
                }
              }}
              disabled={!canProceed() || submitting}
              style={[localStyles.nextBtn, (!canProceed() || submitting) && { opacity: 0.5 }]}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={localStyles.nextBtnText}>
                  {step < totalSteps ? 'Continue' : 'Create Listing'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>

        <Modal
          visible={showImageError}
          transparent
          animationType="fade"
          onRequestClose={() => setShowImageError(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: scale(20) }}>
            <View style={{ backgroundColor: '#FEF2F2', padding: moderateScale(20), borderRadius: moderateScale(16), width: '100%', maxWidth: scale(360), alignItems: 'center', borderWidth: 2, borderColor: '#EF4444' }}>
              <View style={{ backgroundColor: '#FEE2E2', padding: moderateScale(10), borderRadius: moderateScale(30), marginBottom: verticalScale(12) }}>
                <Ionicons name="images-outline" size={scale(36)} color="#EF4444" />
              </View>
              <Text style={{ fontSize: responsiveFontSize(18), fontWeight: '900', color: '#B91C1C', marginBottom: verticalScale(6) }}>Photos Required</Text>
              <Text style={{ fontSize: responsiveFontSize(14), color: '#991B1B', textAlign: 'center', marginBottom: verticalScale(18), lineHeight: responsiveFontSize(20) }}>
                Please upload at least 3 photos of your item to continue.
              </Text>
              <TouchableOpacity
                style={{ backgroundColor: '#EF4444', width: '100%', minHeight: verticalScale(44), paddingVertical: verticalScale(10), borderRadius: moderateScale(12), alignItems: 'center', justifyContent: 'center' }}
                onPress={() => setShowImageError(false)}
              >
                <Text style={{ color: '#FFF', fontSize: responsiveFontSize(15), fontWeight: 'bold' }}>Got it</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

    </Animated.View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ecoTheme.colors.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: ecoTheme.colors.background,
  },
  header: {
    paddingTop: verticalScale(6),
    paddingBottom: verticalScale(14),
    paddingHorizontal: scale(16),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(12),
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  backLabel: {
    fontSize: responsiveFontSize(15),
    fontWeight: '600',
    color: '#FFF',
  },
  headerTitle: {
    fontSize: responsiveFontSize(18),
    fontWeight: '900',
    color: '#FFF',
    flexShrink: 1,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(6),
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    width: scale(26),
    height: scale(26),
    borderRadius: scale(13),
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotActive: {
    backgroundColor: '#4ADE80',
  },
  progressDotText: {
    fontSize: responsiveFontSize(11),
    fontWeight: '800',
    color: 'rgba(255,255,255,0.6)',
  },
  progressDotTextActive: {
    color: '#FFF',
  },
  progressLine: {
    width: scale(40),
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: scale(4),
  },
  progressLineActive: {
    backgroundColor: '#4ADE80',
  },
  stepLabel: {
    textAlign: 'center',
    fontSize: responsiveFontSize(13),
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: scale(16),
    paddingBottom: verticalScale(100),
  },
  fieldLabel: {
    fontSize: responsiveFontSize(13),
    fontWeight: '700',
    color: ecoTheme.colors.text,
    marginBottom: verticalScale(6),
    marginTop: verticalScale(14),
  },
  input: {
    minHeight: verticalScale(48),
    borderRadius: moderateScale(14),
    backgroundColor: '#F7FBF8',
    borderWidth: 1,
    borderColor: ecoTheme.colors.outline,
    paddingHorizontal: scale(14),
    fontSize: responsiveFontSize(14),
    color: ecoTheme.colors.text,
  },
  textArea: {
    minHeight: verticalScale(90),
    paddingTop: verticalScale(12),
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
  },
  chip: {
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(7),
    borderRadius: moderateScale(14),
    backgroundColor: '#F5FBF8',
    borderWidth: 1,
    borderColor: ecoTheme.colors.outline,
  },
  chipActive: {
    backgroundColor: ecoTheme.colors.primaryDark,
    borderColor: ecoTheme.colors.primaryDark,
  },
  chipText: {
    fontSize: responsiveFontSize(12),
    fontWeight: '600',
    color: ecoTheme.colors.textSoft,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  imagePicker: {
    minHeight: verticalScale(130),
    borderRadius: moderateScale(18),
    backgroundColor: '#F5FBF8',
    borderWidth: 2,
    borderColor: '#E0EFE3',
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(24),
    gap: verticalScale(6),
  },
  imagePlaceholderText: {
    fontSize: responsiveFontSize(13),
    color: ecoTheme.colors.textSoft,
  },
  imageList: {
    flexDirection: 'row',
    padding: scale(8),
    gap: scale(8),
  },
  imageThumbWrap: {
    position: 'relative',
  },
  imageThumb: {
    width: scale(90),
    height: scale(90),
    borderRadius: moderateScale(12),
  },
  removeImageBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
  },
  addMoreImage: {
    width: scale(90),
    height: scale(90),
    borderRadius: moderateScale(12),
    borderWidth: 2,
    borderColor: '#D1E8D8',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5FBF8',
  },
  addMoreText: {
    fontSize: responsiveFontSize(11),
    fontWeight: '600',
    color: ecoTheme.colors.primaryDark,
    marginTop: verticalScale(4),
  },
  infoCard: {
    flexDirection: 'row',
    gap: scale(10),
    backgroundColor: '#FEF9EE',
    borderRadius: moderateScale(14),
    padding: moderateScale(12),
    borderWidth: 1,
    borderColor: '#FDECC8',
    marginTop: verticalScale(14),
  },
  infoText: {
    flex: 1,
    fontSize: responsiveFontSize(12),
    lineHeight: responsiveFontSize(18),
    color: '#92400E',
  },
  suggestionLabel: {
    fontSize: responsiveFontSize(12),
    fontWeight: '600',
    color: ecoTheme.colors.textSoft,
    marginTop: verticalScale(14),
    marginBottom: verticalScale(6),
  },
  suggestionChip: {
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(6),
    borderRadius: moderateScale(12),
    backgroundColor: '#EEFBF2',
    borderWidth: 1,
    borderColor: '#D1F5DC',
  },
  suggestionText: {
    fontSize: responsiveFontSize(11),
    fontWeight: '600',
    color: ecoTheme.colors.primaryDark,
  },
  suggestionChipActive: {
    backgroundColor: ecoTheme.colors.primaryDark,
    borderColor: ecoTheme.colors.primaryDark,
  },
  suggestionTextActive: {
    color: '#FFFFFF',
  },
  meetupOptions: {
    gap: verticalScale(8),
  },
  meetupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    padding: moderateScale(12),
    borderRadius: moderateScale(14),
    backgroundColor: '#F7FBF8',
    borderWidth: 1,
    borderColor: ecoTheme.colors.outline,
  },
  meetupCardActive: {
    backgroundColor: '#EEFBF2',
    borderColor: ecoTheme.colors.primaryDark,
  },
  meetupIcon: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(19),
    backgroundColor: '#E4F0E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meetupIconActive: {
    backgroundColor: ecoTheme.colors.primaryDark,
  },
  meetupTitle: {
    fontSize: responsiveFontSize(14),
    fontWeight: '700',
    color: ecoTheme.colors.text,
    flexShrink: 1,
  },
  meetupTitleActive: {
    color: ecoTheme.colors.primaryDark,
  },
  meetupDesc: {
    fontSize: responsiveFontSize(11),
    color: ecoTheme.colors.textSoft,
    marginTop: 2,
    flexShrink: 1,
  },
  bottomBar: {
    flexDirection: 'row',
    gap: scale(10),
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(12),
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F5F2',
  },
  prevBtn: {
    flex: 1,
    minHeight: verticalScale(48),
    paddingVertical: verticalScale(10),
    borderRadius: moderateScale(14),
    borderWidth: 1,
    borderColor: ecoTheme.colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prevBtnText: {
    fontSize: responsiveFontSize(14),
    fontWeight: '700',
    color: ecoTheme.colors.textSoft,
  },
  nextBtn: {
    flex: 2,
    minHeight: verticalScale(48),
    paddingVertical: verticalScale(10),
    borderRadius: moderateScale(14),
    backgroundColor: ecoTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnText: {
    fontSize: responsiveFontSize(14),
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
