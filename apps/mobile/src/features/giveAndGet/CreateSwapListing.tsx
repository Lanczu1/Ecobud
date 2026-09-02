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
  StatusBar,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { ecoTheme, useTheme } from '../../shared/theme/ecoTheme';
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
  const { theme, isDark } = useTheme();
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
    <Animated.View style={[localStyles.container, { transform: [{ translateX: slideAnim }], backgroundColor: theme.colors.background }]}>
    <View style={[localStyles.safeArea, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <LinearGradient colors={['#071C19', '#0C5E54', '#17A07E']} style={localStyles.header}>
          <View style={localStyles.headerRow}>
            <TouchableOpacity onPress={handleBack} style={[localStyles.backBtn, { position: 'absolute', left: 0, zIndex: 10 }]}>
              <Feather name="arrow-left" size={22} color="#FFF" />
              <Text style={localStyles.backLabel}>Back</Text>
            </TouchableOpacity>
            <Text style={localStyles.headerTitle}>New Listing</Text>
          </View>

          <View style={localStyles.progressRow}>
            {[1, 2, 3].map((s) => (
              <View key={s} style={localStyles.progressStep}>
                <View style={[localStyles.progressDot, step >= s && localStyles.progressDotActive]}>
                  {step > s ? (
                    <Ionicons name="checkmark" size={16} color="#071C19" />
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
          style={[localStyles.body, { backgroundColor: theme.colors.background }]}
          contentContainerStyle={[localStyles.bodyContent, { backgroundColor: theme.colors.background }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
        >
          {step === 1 && (
            <>
              <View style={[localStyles.imagePicker, isDark && { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }]}>
                {images.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={localStyles.imageList}>
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
                        <TouchableOpacity onPress={pickImages} style={[localStyles.addMoreImage, isDark && { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
                          <Ionicons name="images-outline" size={24} color={isDark ? theme.colors.primary : ecoTheme.colors.primaryDark} />
                          <Text style={[localStyles.addMoreText, isDark && { color: theme.colors.primary }]}>Gallery</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={takePicture} style={[localStyles.addMoreImage, { marginLeft: 8 }, isDark && { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
                          <Ionicons name="camera-outline" size={24} color={isDark ? theme.colors.primary : ecoTheme.colors.primaryDark} />
                          <Text style={[localStyles.addMoreText, isDark && { color: theme.colors.primary }]}>Camera</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </ScrollView>
                ) : (
                  <View style={[localStyles.imagePlaceholder, { flexDirection: 'row', justifyContent: 'center', gap: scale(40) }]}>
                    <TouchableOpacity onPress={pickImages} style={{ alignItems: 'center' }}>
                      <View style={[localStyles.iconCircle, isDark && { backgroundColor: theme.colors.surfaceMuted }]}>
                        <Ionicons name="images-outline" size={32} color={isDark ? theme.colors.primary : ecoTheme.colors.primaryDark} />
                      </View>
                      <Text style={[localStyles.imagePlaceholderText, isDark && { color: theme.colors.textMuted }, { marginTop: 8 }]}>Gallery</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={takePicture} style={{ alignItems: 'center' }}>
                      <View style={[localStyles.iconCircle, isDark && { backgroundColor: theme.colors.surfaceMuted }]}>
                        <Ionicons name="camera-outline" size={32} color={isDark ? theme.colors.primary : ecoTheme.colors.primaryDark} />
                      </View>
                      <Text style={[localStyles.imagePlaceholderText, isDark && { color: theme.colors.textMuted }, { marginTop: 8 }]}>Camera</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <Text style={[localStyles.fieldLabel, isDark && { color: theme.colors.textMuted }]}>Item Title *</Text>
              <TextInput
                style={[localStyles.input, isDark && { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.inputBorder, color: theme.colors.textPrimary }]}
                placeholder="e.g., Plastic Bottles, Glass Jars"
                placeholderTextColor={theme.colors.textMuted}
                value={title}
                onChangeText={setTitle}
              />

              <Text style={[localStyles.fieldLabel, isDark && { color: theme.colors.textMuted }]}>Category *</Text>
              <View style={localStyles.chipGrid}>
                {CATEGORIES.map((cat) => {
                  const isSelected = category === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setCategory(cat)}
                      style={[
                        localStyles.chip,
                        isDark && { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                        isSelected && [localStyles.chipActive, isDark && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }],
                      ]}
                    >
                      <Text
                        style={[
                          localStyles.chipText,
                          isDark && { color: theme.colors.textMuted },
                          isSelected && [localStyles.chipTextActive, isDark && { color: '#0E1512' }],
                        ]}
                      >
                        {CATEGORY_LABELS[cat]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[localStyles.fieldLabel, isDark && { color: theme.colors.textMuted }]}>Quantity *</Text>
              <TextInput
                style={[localStyles.input, isDark && { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.inputBorder, color: theme.colors.textPrimary }]}
                placeholder="e.g., 50"
                placeholderTextColor={theme.colors.textMuted}
                value={quantity}
                onChangeText={(text) => setQuantity(text.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
              />

              <Text style={[localStyles.fieldLabel, isDark && { color: theme.colors.textMuted }]}>Condition *</Text>
              <View style={localStyles.chipRow}>
                {CONDITIONS.map((c) => {
                  const isSelected = condition === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      onPress={() => setCondition(c)}
                      style={[
                        localStyles.chip,
                        isDark && { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                        isSelected && [localStyles.chipActive, isDark && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }],
                      ]}
                    >
                      <Text
                        style={[
                          localStyles.chipText,
                          isDark && { color: theme.colors.textMuted },
                          isSelected && [localStyles.chipTextActive, isDark && { color: '#0E1512' }],
                        ]}
                      >
                        {CONDITION_LABELS[c]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[localStyles.fieldLabel, isDark && { color: theme.colors.textMuted }]}>Description</Text>
              <TextInput
                style={[localStyles.input, localStyles.textArea, isDark && { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.inputBorder, color: theme.colors.textPrimary }]}
                placeholder="Describe your item (condition, size, quantity details...)"
                placeholderTextColor={theme.colors.textMuted}
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
              <Text style={[localStyles.fieldLabel, isDark && { color: theme.colors.textMuted }]}>Listing Type *</Text>
              <View style={localStyles.chipGrid}>
                <TouchableOpacity
                  onPress={() => {
                    setListingType('swap');
                    setLookingFor('');
                  }}
                  style={[
                    localStyles.suggestionChip,
                    isDark && { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                    listingType === 'swap' && [localStyles.suggestionChipActive, isDark && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }],
                    { flexDirection: 'row', alignItems: 'center', gap: 6 }
                  ]}
                >
                  <Ionicons name="swap-horizontal" size={16} color={listingType === 'swap' ? (isDark ? '#0E1512' : '#126027') : (isDark ? theme.colors.textMuted : '#374151')} />
                  <Text style={[localStyles.suggestionText, isDark && { color: theme.colors.textMuted }, listingType === 'swap' && [localStyles.suggestionTextActive, isDark && { color: '#0E1512' }]]}>Swap</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setListingType('giveaway');
                    setLookingFor('Giveaway');
                  }}
                  style={[
                    localStyles.suggestionChip,
                    isDark && { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                    listingType === 'giveaway' && [localStyles.suggestionChipActive, isDark && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }],
                    { flexDirection: 'row', alignItems: 'center', gap: 6 }
                  ]}
                >
                  <Ionicons name="gift-outline" size={16} color={listingType === 'giveaway' ? (isDark ? '#0E1512' : '#126027') : (isDark ? theme.colors.textMuted : '#374151')} />
                  <Text style={[localStyles.suggestionText, isDark && { color: theme.colors.textMuted }, listingType === 'giveaway' && [localStyles.suggestionTextActive, isDark && { color: '#0E1512' }]]}>Giveaway</Text>
                </TouchableOpacity>
              </View>

              {listingType === 'swap' && (
                <>
                  <View style={[localStyles.infoCard, isDark && { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
                    <Ionicons name="bulb-outline" size={20} color="#D97706" />
                    <Text style={[localStyles.infoText, isDark && { color: theme.colors.textPrimary }]}>
                      Specify what you'd like to receive in exchange. Be specific to attract the right swaps!
                    </Text>
                  </View>

                  <Text style={[localStyles.fieldLabel, isDark && { color: theme.colors.textMuted }]}>What are you looking for? *</Text>
                  <TextInput
                    style={[localStyles.input, isDark && { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.inputBorder, color: theme.colors.textPrimary }]}
                    placeholder="e.g., Indoor Plant, Used Books, School Supplies"
                    placeholderTextColor={theme.colors.textMuted}
                    value={lookingFor}
                    onChangeText={setLookingFor}
                  />

                  <Text style={[localStyles.suggestionLabel, isDark && { color: theme.colors.textMuted }]}>Popular requests:</Text>
                  <View style={localStyles.chipGrid}>
                    {['Flower Pot', 'Used Books', 'School Supplies', 'Plant Seeds', 'Plastic Storage Box', 'Garden Tools', 'Art Supplies', 'Cooking Utensils'].map((item) => (
                      <TouchableOpacity
                        key={item}
                        onPress={() => setLookingFor(item)}
                        style={[localStyles.suggestionChip, isDark && { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                      >
                        <Text style={[localStyles.suggestionText, isDark && { color: theme.colors.textMuted }]}>{item}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {listingType === 'giveaway' && (
                <View style={[localStyles.infoCard, isDark && { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
                  <Ionicons name="gift-outline" size={20} color="#10B981" />
                  <Text style={[localStyles.infoText, isDark && { color: theme.colors.textPrimary }]}>
                    You're giving this item away for free! No exchange needed.
                  </Text>
                </View>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <Text style={[localStyles.fieldLabel, isDark && { color: theme.colors.textMuted }]}>Meetup Method *</Text>
              <View style={localStyles.meetupOptions}>
                {MEETUP_METHODS.map((m) => {
                  const isSelected = meetupMethod === m.key;
                  return (
                    <TouchableOpacity
                      key={m.key}
                      onPress={() => setMeetupMethod(m.key)}
                      style={[
                        localStyles.meetupCard,
                        isDark && { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                        isSelected && [localStyles.meetupCardActive, isDark && { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.primary }],
                      ]}
                    >
                      <View style={[localStyles.meetupIcon, isDark && { backgroundColor: theme.colors.surfaceMuted }, isSelected && [localStyles.meetupIconActive, isDark && { backgroundColor: theme.colors.primary }]]}>
                        <Ionicons name={m.icon as any} size={22} color={isSelected ? (isDark ? '#0E1512' : '#FFF') : (isDark ? theme.colors.primary : ecoTheme.colors.primaryDark)} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[localStyles.meetupTitle, isDark && { color: theme.colors.textPrimary }, isSelected && isDark && { color: theme.colors.primary }]}>
                          {MEETUP_LABELS[m.key]}
                        </Text>
                        <Text style={[localStyles.meetupDesc, isDark && { color: theme.colors.textMuted }]}>{m.desc}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {meetupMethod === 'public' && (
                <>
                  <Text style={[localStyles.fieldLabel, isDark && { color: theme.colors.textMuted }]}>Meetup Location</Text>
                  <TextInput
                    style={[localStyles.input, isDark && { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.inputBorder, color: theme.colors.textPrimary }]}
                    placeholder="e.g., SM City Calamba"
                    placeholderTextColor={theme.colors.textMuted}
                    value={meetupLocation}
                    onChangeText={setMeetupLocation}
                  />
                  <Text style={[localStyles.fieldLabel, isDark && { color: theme.colors.textMuted }]}>Landmark</Text>
                  <TextInput
                    style={[localStyles.input, isDark && { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.inputBorder, color: theme.colors.textPrimary }]}
                    placeholder="e.g., Near Main Entrance"
                    placeholderTextColor={theme.colors.textMuted}
                    value={meetupLandmark}
                    onChangeText={setMeetupLandmark}
                  />
                </>
              )}

              {meetupMethod === 'pickup' && (
                <View style={[localStyles.infoCard, isDark && { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
                  <Ionicons name="information-circle-outline" size={20} color="#2563EB" />
                  <Text style={[localStyles.infoText, isDark && { color: theme.colors.textPrimary }]}>
                    Your pickup address will only be shared after both users confirm the swap for privacy.
                  </Text>
                </View>
              )}

              {meetupMethod === 'dropoff' && (
                <View style={[localStyles.infoCard, isDark && { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
                  <Ionicons name="information-circle-outline" size={20} color="#2563EB" />
                  <Text style={[localStyles.infoText, isDark && { color: theme.colors.textPrimary }]}>
                    The delivery address will only be shared after both users confirm the swap for privacy.
                  </Text>
                </View>
              )}

              <Text style={[localStyles.fieldLabel, isDark && { color: theme.colors.textMuted }]}>City</Text>
              <TextInput
                style={[localStyles.input, isDark && { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.inputBorder, color: theme.colors.textPrimary }]}
                placeholder="e.g., Santa Rosa"
                placeholderTextColor={theme.colors.textMuted}
                value={city}
                onChangeText={setCity}
              />
              <Text style={[localStyles.fieldLabel, isDark && { color: theme.colors.textMuted }]}>Province</Text>
              <TextInput
                style={[localStyles.input, isDark && { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.inputBorder, color: theme.colors.textPrimary }]}
                placeholder="e.g., Laguna"
                placeholderTextColor={theme.colors.textMuted}
                value={province}
                onChangeText={setProvince}
              />

              <Text style={[localStyles.fieldLabel, isDark && { color: theme.colors.textMuted }]}>Additional Notes</Text>
              <TextInput
                style={[localStyles.input, localStyles.textArea, isDark && { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.inputBorder, color: theme.colors.textPrimary }]}
                placeholder="Any extra details about the meetup..."
                placeholderTextColor={theme.colors.textMuted}
                value={meetupNotes}
                onChangeText={setMeetupNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </>
          )}
        </ScrollView>

        <View style={[localStyles.bottomBar, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border }]}>
          {step > 1 && (
            <TouchableOpacity onPress={() => setStep(step - 1)} style={[localStyles.prevBtn, { borderColor: theme.colors.border }]}>
              <Text style={[localStyles.prevBtnText, { color: theme.colors.textMuted }]}>Previous</Text>
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
            style={[
              localStyles.nextBtn, 
              isDark && { backgroundColor: theme.colors.primary },
              (!canProceed() || submitting) && { backgroundColor: isDark ? theme.colors.surfaceMuted : '#E2E8F0', shadowOpacity: 0, elevation: 0 }
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={canProceed() ? (isDark ? "#0E1512" : "#FFF") : (isDark ? "#4B5563" : "#94A3B8")} />
            ) : (
              <Text style={[localStyles.nextBtnText, isDark && { color: '#0E1512' }, (!canProceed() || submitting) && { color: isDark ? '#4B5563' : '#94A3B8' }]}>
                {step < totalSteps ? 'Continue' : 'Create Listing'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + verticalScale(8) : verticalScale(44),
    paddingBottom: verticalScale(16),
    paddingHorizontal: scale(16),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(16),
    minHeight: verticalScale(32),
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
    marginBottom: verticalScale(10),
    marginTop: verticalScale(4),
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotActive: {
    backgroundColor: '#4ADE80',
    shadowColor: '#4ADE80',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  progressDotText: {
    fontSize: responsiveFontSize(13),
    fontWeight: '900',
    color: 'rgba(255,255,255,0.5)',
  },
  progressDotTextActive: {
    color: '#071C19',
  },
  progressLine: {
    width: scale(45),
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: scale(4),
    borderRadius: 2,
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
    fontSize: responsiveFontSize(11),
    fontWeight: '800',
    color: ecoTheme.colors.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: verticalScale(8),
    marginTop: verticalScale(18),
  },
  input: {
    minHeight: verticalScale(50),
    borderRadius: moderateScale(14),
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: scale(16),
    fontSize: responsiveFontSize(15),
    color: ecoTheme.colors.text,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
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
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(8),
    borderRadius: moderateScale(20),
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: ecoTheme.colors.primaryDark,
    borderColor: ecoTheme.colors.primaryDark,
    shadowColor: ecoTheme.colors.primaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  chipText: {
    fontSize: responsiveFontSize(13),
    fontWeight: '600',
    color: ecoTheme.colors.textSoft,
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  imagePicker: {
    minHeight: verticalScale(130),
    borderRadius: moderateScale(18),
    backgroundColor: '#F0F9F4',
    borderWidth: 2,
    borderColor: '#C6E8D3',
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
    fontWeight: '600',
  },
  iconCircle: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    minHeight: verticalScale(52),
    paddingVertical: verticalScale(10),
    borderRadius: moderateScale(16),
    backgroundColor: ecoTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ecoTheme.colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  nextBtnText: {
    fontSize: responsiveFontSize(14),
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
