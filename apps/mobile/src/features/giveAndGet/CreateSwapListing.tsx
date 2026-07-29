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
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { ecoTheme } from '../../shared/theme/ecoTheme';
import { swapService } from './swapService';
import type { SwapCategory, ItemCondition, MeetupMethod } from './types';
import { CATEGORY_LABELS, CONDITION_LABELS, MEETUP_LABELS } from './types';

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
        try {
          const url = await swapService.uploadImage(uri, userId);
          uploadedUrls.push(url);
        } catch {
          uploadedUrls.push(uri);
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
    <View style={localStyles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <LinearGradient colors={['#071C19', '#0C5E54', '#17A07E']} style={localStyles.header}>
          <View style={localStyles.headerRow}>
            <TouchableOpacity onPress={onBack} style={localStyles.backBtn}>
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
                    <Text style={[localStyles.meetupTitle, meetupMethod === m.key && localStyles.meetupTitleActive]}>
                      {MEETUP_LABELS[m.key]}
                    </Text>
                    <Text style={localStyles.meetupDesc}>{m.desc}</Text>
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
  );
}

const localStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: ecoTheme.colors.background,
  },
  header: {
    paddingTop: 8,
    paddingBottom: 18,
    paddingHorizontal: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFF',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotActive: {
    backgroundColor: '#4ADE80',
  },
  progressDotText: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.6)',
  },
  progressDotTextActive: {
    color: '#FFF',
  },
  progressLine: {
    width: 50,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 6,
  },
  progressLineActive: {
    backgroundColor: '#4ADE80',
  },
  stepLabel: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 18,
    paddingBottom: 100,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: ecoTheme.colors.text,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#F7FBF8',
    borderWidth: 1,
    borderColor: ecoTheme.colors.outline,
    paddingHorizontal: 16,
    fontSize: 15,
    color: ecoTheme.colors.text,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F5FBF8',
    borderWidth: 1,
    borderColor: ecoTheme.colors.outline,
  },
  chipActive: {
    backgroundColor: ecoTheme.colors.primaryDark,
    borderColor: ecoTheme.colors.primaryDark,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: ecoTheme.colors.textSoft,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  imagePicker: {
    minHeight: 140,
    borderRadius: 20,
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
    paddingVertical: 30,
    gap: 8,
  },
  imagePlaceholderText: {
    fontSize: 14,
    color: ecoTheme.colors.textSoft,
  },
  imageList: {
    flexDirection: 'row',
    padding: 8,
    gap: 8,
  },
  imageThumbWrap: {
    position: 'relative',
  },
  imageThumb: {
    width: 100,
    height: 100,
    borderRadius: 14,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
  },
  addMoreImage: {
    width: 100,
    height: 100,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#D1E8D8',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5FBF8',
  },
  addMoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: ecoTheme.colors.primaryDark,
    marginTop: 4,
  },
  infoCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FEF9EE',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDECC8',
    marginTop: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#92400E',
  },
  suggestionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: ecoTheme.colors.textSoft,
    marginTop: 16,
    marginBottom: 8,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: '#EEFBF2',
    borderWidth: 1,
    borderColor: '#D1F5DC',
  },
  suggestionText: {
    fontSize: 12,
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
    gap: 10,
  },
  meetupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#F7FBF8',
    borderWidth: 1,
    borderColor: ecoTheme.colors.outline,
  },
  meetupCardActive: {
    backgroundColor: '#EEFBF2',
    borderColor: ecoTheme.colors.primaryDark,
  },
  meetupIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E4F0E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meetupIconActive: {
    backgroundColor: ecoTheme.colors.primaryDark,
  },
  meetupTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: ecoTheme.colors.text,
  },
  meetupTitleActive: {
    color: ecoTheme.colors.primaryDark,
  },
  meetupDesc: {
    position: 'absolute',
    left: 66,
    bottom: 10,
    fontSize: 12,
    color: ecoTheme.colors.textSoft,
  },
  bottomBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F5F2',
  },
  prevBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: ecoTheme.colors.outline,
    alignItems: 'center',
  },
  prevBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: ecoTheme.colors.textSoft,
  },
  nextBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: ecoTheme.colors.primaryDark,
    alignItems: 'center',
  },
  nextBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
