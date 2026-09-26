import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EcoBudMobileModel } from '../types/home';
import { TopNavbar, PrimaryButton } from './CommonComponents';
import { useTheme, type ThemeColors } from '../../shared/theme/ecoTheme';
import { homeService } from '../services/homeService';
import { useInAppNotification } from '../../shared/ui/InAppNotification';

interface EventAttendanceOverlayProps {
  eventId: string;
  model: EcoBudMobileModel;
  onClose: () => void;
}

export function EventAttendanceOverlay({ eventId, model, onClose }: EventAttendanceOverlayProps) {
  const { theme } = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { showNotification } = useInAppNotification();
  const styles = React.useMemo(() => createStyles(theme.colors), [theme.colors]);
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<'select_image' | 'image_preview' | 'qr' | 'uploading' | 'success'>('select_image');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const scanSubmittedRef = useRef(false);

  const prepareAttendanceImage = async (uri: string) => {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1440 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  };

  const event = model.events.find(e => e.id === eventId);
  const session = model.session;

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.5,
    });

    if (!result.canceled) {
      setCapturedImage(await prepareAttendanceImage(result.assets[0].uri));
      setMode('image_preview');
    }
  };
  
  const handleTakePhoto = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        showNotification({
          title: 'Camera permission needed',
          message: 'Allow camera access in your device settings to take an attendance photo.',
          tone: 'warning',
          durationMs: 6000,
        });
        return;
      }
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.5,
    });

    if (!result.canceled) {
      setCapturedImage(await prepareAttendanceImage(result.assets[0].uri));
      setMode('image_preview');
    }
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (mode !== 'qr' || scanSubmittedRef.current) return;
    if (!capturedImage) {
      showNotification({
        title: 'Photo proof is missing',
        message: 'Choose or take a photo before scanning the event QR code.',
        tone: 'warning',
      });
      setMode('select_image');
      return;
    }

    scanSubmittedRef.current = true;
    setUploadProgress(0);
    setMode('uploading');
    
    try {
      if (!session) throw new Error('Not authenticated');
      
      const result = await homeService.submitEventAttendance(
        session.token,
        eventId,
        capturedImage,
        data.trim(),
        setUploadProgress
      );

      if (!result.success) throw new Error(result.message || 'Failed to submit attendance');
      
      setMode('success');
      model.refreshEverything(); // Refresh to update userStatus
    } catch (err: any) {
      showNotification({
        title: 'Attendance not submitted',
        message: err.message || 'The QR code is invalid or expired. Please scan again.',
        tone: 'error',
      });
      setMode('qr');
      setUploadProgress(0);
      scanSubmittedRef.current = false;
    }
  };

  if (mode === 'uploading') {
    return (
      <View style={styles.overlayContainer}>
        <TopNavbar model={model} showBack={false} onBack={() => {}} />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>
            {uploadProgress < 100 ? `Uploading photo ${uploadProgress}%...` : 'Verifying QR & submitting...'}
          </Text>
        </View>
      </View>
    );
  }
  
  if (mode === 'success') {
    return (
      <View style={styles.overlayContainer}>
        <TopNavbar model={model} showBack={false} onBack={() => {}} />
        <View style={styles.centerContent}>
          <Ionicons name="time" size={80} color={theme.colors.warning} />
          <Text style={styles.titleText}>Waiting for Approval</Text>
          <Text style={styles.descText}>Your picture and QR code scan have been submitted. An organizer will review it shortly.</Text>
          <PrimaryButton label="Done" onPress={onClose} style={{ marginTop: 24, width: '100%' }} />
        </View>
      </View>
    );
  }

  if (mode === 'qr') {
    return (
      <View style={styles.overlayContainer}>
        <TopNavbar model={model} showBack={true} onBack={() => setMode('image_preview')} />
        <View style={styles.qrScannerContainer}>
          <View style={styles.qrEventHeader}>
            <Text style={styles.qrEventEyebrow}>Scanning QR for</Text>
            <Text style={styles.qrEventTitle} numberOfLines={2}>{event?.title || 'Event check-in'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarCodeScanned}
            />
            <View style={[StyleSheet.absoluteFill, styles.qrOverlay]} pointerEvents="none">
              <View style={styles.qrCutout} />
              <Text style={styles.qrText}>Align the event QR code inside the frame</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (mode === 'image_preview') {
    const previewMaxHeight = Math.min(screenHeight * 0.52, 560);
    return (
      <View style={styles.overlayContainer}>
        <TopNavbar model={model} showBack={true} onBack={() => setMode('select_image')} />
        <View style={[styles.content, styles.previewContent, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
          <View style={styles.stepHeader}>
            <View style={styles.stepLabelRow}>
              <View style={styles.stepIcon}>
                <Ionicons name="image-outline" size={17} color={theme.colors.primary} />
              </View>
              <Text style={styles.stepLabel}>ATTENDANCE PROOF</Text>
              <Text style={styles.stepCount}>STEP 1 OF 2</Text>
            </View>
            <View style={styles.stepTrack}>
              <View style={styles.stepTrackActive} />
              <View style={styles.stepTrackInactive} />
            </View>
          </View>

          <Text style={styles.titleText}>Verify with Image</Text>
          <Text style={styles.descText}>Make sure this photo clearly shows you at {event?.title || 'the event'}.</Text>
          
          <View style={[styles.imagePreviewContainer, { maxHeight: previewMaxHeight }]}>
            {capturedImage && <Image source={{ uri: capturedImage }} style={styles.imagePreview} />}
            <View style={styles.photoBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
              <Text style={styles.photoBadgeText}>Photo selected</Text>
            </View>
            <View style={styles.photoCaption}>
              <Text style={styles.photoCaptionTitle}>Your event photo</Text>
              <Text style={styles.photoCaptionHint}>You can retake or choose another photo.</Text>
            </View>
          </View>
          
          <View style={styles.previewActions}>
            <PrimaryButton label="Continue to QR scan" onPress={async () => {
              if (!permission?.granted) {
                const res = await requestPermission();
                if (res?.granted) setMode('qr');
              } else {
                setMode('qr');
              }
            }} style={styles.continueButton} />
            <TouchableOpacity style={styles.reselectButton} onPress={() => setMode('select_image')} accessibilityRole="button" accessibilityLabel="Retake or choose another photo">
              <Ionicons name="camera-reverse-outline" size={19} color={theme.colors.primary} />
              <Text style={styles.reselectText}>Retake/Reselect</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.overlayContainer}>
      <TopNavbar model={model} showBack={true} onBack={onClose} />
      <View style={styles.content}>
        <Text style={styles.titleText}>Submit Picture</Text>
        <Text style={styles.descText}>Step 1: Provide a photo of yourself participating in {event?.title}.</Text>
        
        <View style={styles.optionsContainer}>
          <TouchableOpacity style={styles.optionCard} onPress={handlePickImage}>
            <Ionicons name="images" size={40} color={theme.colors.primary} />
            <Text style={styles.optionTitle}>Upload Photo</Text>
            <Text style={styles.optionDesc}>Upload a photo from your gallery.</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.optionCard} onPress={handleTakePhoto}>
            <Ionicons name="camera" size={40} color={theme.colors.primary} />
            <Text style={styles.optionTitle}>Take Photo</Text>
            <Text style={styles.optionDesc}>Snap a real-time photo of your participation.</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.background,
    zIndex: 9999,
  },
  content: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 12,
  },
  previewContent: {
    paddingBottom: 0,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  titleText: {
    fontSize: 27,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  descText: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  stepHeader: {
    marginBottom: 18,
  },
  stepLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  stepIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.textMuted,
  },
  stepCount: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  stepTrack: {
    flexDirection: 'row',
    gap: 6,
  },
  stepTrackActive: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  stepTrackInactive: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceMuted,
  },
  optionsContainer: {
    gap: 16,
    marginTop: 16,
  },
  optionCard: {
    backgroundColor: colors.card,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  reselectButton: {
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  reselectText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  previewActions: {
    gap: 10,
    marginTop: 14,
    paddingBottom: 0,
  },
  continueButton: {
    minHeight: 56,
    borderRadius: 16,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 12,
    marginBottom: 4,
  },
  optionDesc: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  qrOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrCutout: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  qrText: {
    color: '#FFF',
    marginTop: 24,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  qrScannerContainer: {
    flex: 1,
  },
  qrEventHeader: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  qrEventEyebrow: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 3,
  },
  qrEventTitle: {
    color: colors.textPrimary,
    fontSize: 21,
    fontWeight: '800',
  },
  imagePreviewContainer: {
    flex: 1,
    flexBasis: 200,
    minHeight: 180,
    marginTop: 2,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 11,
    backgroundColor: 'rgba(13, 31, 22, 0.78)',
  },
  photoBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  photoCaption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 16,
    backgroundColor: 'rgba(13, 31, 22, 0.72)',
  },
  photoCaptionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 3,
  },
  photoCaptionHint: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 12,
    lineHeight: 17,
  },
});
