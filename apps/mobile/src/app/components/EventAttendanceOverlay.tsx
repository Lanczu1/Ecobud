import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { EcoBudMobileModel } from '../types/home';
import { SurfaceCard, TopNavbar, PrimaryButton, SecondaryButton } from './CommonComponents';
import { ecobudApiOrigin } from '../../shared/api/ecobudApi';
import { homeService } from '../services/homeService';

interface EventAttendanceOverlayProps {
  eventId: string;
  model: EcoBudMobileModel;
  onClose: () => void;
}

export function EventAttendanceOverlay({ eventId, model, onClose }: EventAttendanceOverlayProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<'select_image' | 'image_preview' | 'qr' | 'uploading' | 'success'>('select_image');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const event = model.events.find(e => e.id === eventId);
  const session = model.session;

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setCapturedImage(result.assets[0].uri);
      setMode('image_preview');
    }
  };
  
  const handleTakePhoto = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission Denied', 'Camera access is required to take photos.');
        return;
      }
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setCapturedImage(result.assets[0].uri);
      setMode('image_preview');
    }
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (mode !== 'qr') return;
    if (!capturedImage) {
      Alert.alert('Error', 'Missing image proof. Please restart.');
      setMode('select_image');
      return;
    }

    setMode('uploading');
    
    try {
      if (!session) throw new Error('Not authenticated');
      
      const result = await homeService.submitEventAttendance(
        session.token,
        eventId,
        capturedImage,
        data.trim()
      );

      if (!result.success) throw new Error(result.message || 'Failed to submit attendance');
      
      setMode('success');
      model.refreshEverything(); // Refresh to update userStatus
    } catch (err: any) {
      Alert.alert('Submission Error', err.message || 'Invalid or expired QR code.');
      setMode('qr');
    }
  };

  if (mode === 'uploading') {
    return (
      <View style={styles.overlayContainer}>
        <TopNavbar model={model} showBack={false} onBack={() => {}} />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#126027" />
          <Text style={styles.loadingText}>Submitting Proof & QR...</Text>
        </View>
      </View>
    );
  }
  
  if (mode === 'success') {
    return (
      <View style={styles.overlayContainer}>
        <TopNavbar model={model} showBack={false} onBack={() => {}} />
        <View style={styles.centerContent}>
          <Ionicons name="time" size={80} color="#FFD700" />
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
        <View style={{ flex: 1 }}>
          <CameraView 
            style={StyleSheet.absoluteFill} 
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleBarCodeScanned}
          />
          <View style={[StyleSheet.absoluteFill, styles.qrOverlay]} pointerEvents="none">
            <View style={styles.qrCutout} />
            <Text style={styles.qrText}>Step 2: Scan the Event QR Code</Text>
          </View>
        </View>
      </View>
    );
  }

  if (mode === 'image_preview') {
    return (
      <View style={styles.overlayContainer}>
        <TopNavbar model={model} showBack={true} onBack={() => setMode('select_image')} />
        <View style={styles.content}>
          <Text style={styles.titleText}>Verify with Image</Text>
          <Text style={styles.descText}>Does this picture clearly show you at the event?</Text>
          
          <View style={styles.imagePreviewContainer}>
            {capturedImage && <Image source={{ uri: capturedImage }} style={styles.imagePreview} />}
          </View>
          
          <View style={{ gap: 12, marginTop: 'auto', marginBottom: 40 }}>
            <PrimaryButton label="Next: Scan QR" onPress={() => {
              if (!permission?.granted) {
                requestPermission().then(res => {
                  if (res.granted) setMode('qr');
                });
              } else {
                setMode('qr');
              }
            }} />
            <SecondaryButton label="Retake/Reselect" onPress={() => setMode('select_image')} />
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
            <Ionicons name="images" size={40} color="#126027" />
            <Text style={styles.optionTitle}>Upload Photo</Text>
            <Text style={styles.optionDesc}>Upload a photo from your gallery.</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.optionCard} onPress={handleTakePhoto}>
            <Ionicons name="camera" size={40} color="#126027" />
            <Text style={styles.optionTitle}>Take Photo</Text>
            <Text style={styles.optionDesc}>Snap a real-time photo of your participation.</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#F7FAF9',
    zIndex: 9999,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  titleText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A211D',
    marginBottom: 8,
    textAlign: 'center',
  },
  descText: {
    fontSize: 15,
    color: '#6B7A75',
    marginBottom: 24,
    textAlign: 'center',
  },
  optionsContainer: {
    gap: 16,
    marginTop: 16,
  },
  optionCard: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A211D',
    marginTop: 12,
    marginBottom: 4,
  },
  optionDesc: {
    fontSize: 14,
    color: '#6B7A75',
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#126027',
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
    borderColor: '#10B981',
    backgroundColor: 'transparent',
  },
  qrText: {
    color: '#FFF',
    marginTop: 24,
    fontSize: 16,
    fontWeight: '600',
  },
  imagePreviewContainer: {
    flex: 1,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E0EBE4',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  }
});
