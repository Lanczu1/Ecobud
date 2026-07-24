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

interface EventAttendanceOverlayProps {
  eventId: string;
  model: EcoBudMobileModel;
  onClose: () => void;
}

export function EventAttendanceOverlay({ eventId, model, onClose }: EventAttendanceOverlayProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<'select' | 'qr' | 'image' | 'uploading' | 'success'>('select');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const event = model.events.find(e => e.id === eventId);
  const session = model.session;

  const handleScanQR = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission Denied', 'Camera access is required to scan QR codes.');
        return;
      }
    }
    setMode('qr');
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (mode !== 'qr') return;
    setMode('uploading');
    
    try {
      if (!session) throw new Error('Not authenticated');
      
      const response = await fetch(`${ecobudApiOrigin}/api/events/${eventId}/submissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
        },
        body: JSON.stringify({ qrData: data }),
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Failed to verify QR code');
      
      setMode('success');
      model.refreshEverything(); // Refresh to update userStatus
    } catch (err: any) {
      Alert.alert('QR Error', err.message || 'Invalid or expired QR code.');
      setMode('select');
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setCapturedImage(result.assets[0].uri);
      setMode('image');
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
      setMode('image');
    }
  };

  const submitImage = async () => {
    if (!capturedImage) return;
    setMode('uploading');
    
    try {
      if (!session) throw new Error('Not authenticated');
      
      const formData = new FormData();
      formData.append('image', {
        uri: capturedImage,
        name: 'attendance.jpg',
        type: 'image/jpeg',
      } as any);

      const response = await fetch(`${ecobudApiOrigin}/api/events/${eventId}/submissions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Failed to upload proof');
      
      Alert.alert('Success', 'Your attendance proof has been submitted for review.');
      onClose();
    } catch (err: any) {
      Alert.alert('Upload Error', err.message || 'Failed to upload image.');
      setMode('image');
    }
  };

  if (mode === 'uploading') {
    return (
      <View style={styles.overlayContainer}>
        <TopNavbar model={model} showBack={true} onBack={() => {}} />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#126027" />
          <Text style={styles.loadingText}>Recording Attendance...</Text>
        </View>
      </View>
    );
  }
  
  if (mode === 'success') {
    return (
      <View style={styles.overlayContainer}>
        <TopNavbar model={model} showBack={true} onBack={onClose} />
        <View style={styles.centerContent}>
          <Ionicons name="checkmark-circle" size={80} color="#10B981" />
          <Text style={styles.titleText}>Attendance Recorded!</Text>
          <Text style={styles.descText}>You've earned ECO points for attending {event?.title}.</Text>
          <PrimaryButton label="Done" onPress={onClose} style={{ marginTop: 24, width: '100%' }} />
        </View>
      </View>
    );
  }

  if (mode === 'qr') {
    return (
      <View style={styles.overlayContainer}>
        <TopNavbar model={model} showBack={true} onBack={() => setMode('select')} />
        <View style={{ flex: 1 }}>
          <CameraView 
            style={{ flex: 1 }} 
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleBarCodeScanned}
          >
            <View style={styles.qrOverlay}>
              <View style={styles.qrCutout} />
              <Text style={styles.qrText}>Scan the Event QR Code</Text>
            </View>
          </CameraView>
        </View>
      </View>
    );
  }

  if (mode === 'image') {
    return (
      <View style={styles.overlayContainer}>
        <TopNavbar model={model} showBack={true} onBack={() => setMode('select')} />
        <View style={styles.content}>
          <Text style={styles.titleText}>Verify with Image</Text>
          <Text style={styles.descText}>Please submit an image clearly showing you at the event.</Text>
          
          <View style={styles.imagePreviewContainer}>
            {capturedImage && <Image source={{ uri: capturedImage }} style={styles.imagePreview} />}
          </View>
          
          <View style={{ gap: 12, marginTop: 'auto', marginBottom: 40 }}>
            <PrimaryButton label="Submit Proof" onPress={submitImage} />
            <SecondaryButton label="Retake/Reselect" onPress={() => setMode('select')} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.overlayContainer}>
      <TopNavbar model={model} showBack={true} onBack={onClose} />
      <View style={styles.content}>
        <Text style={styles.titleText}>Record Attendance</Text>
        <Text style={styles.descText}>You can verify your attendance for {event?.title} in two ways.</Text>
        
        <View style={styles.optionsContainer}>
          <TouchableOpacity style={styles.optionCard} onPress={handleScanQR}>
            <Ionicons name="qr-code" size={40} color="#126027" />
            <Text style={styles.optionTitle}>Scan QR Code</Text>
            <Text style={styles.optionDesc}>Quickest way! Scan the code provided by the event organizer.</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.optionCard} onPress={handlePickImage}>
            <Ionicons name="images" size={40} color="#126027" />
            <Text style={styles.optionTitle}>Upload Photo</Text>
            <Text style={styles.optionDesc}>Upload a photo of yourself participating in the event from your gallery.</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.optionCard} onPress={handleTakePhoto}>
            <Ionicons name="camera" size={40} color="#126027" />
            <Text style={styles.optionTitle}>Take Photo</Text>
            <Text style={styles.optionDesc}>Snap a real-time photo of your participation at the event.</Text>
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
    backgroundColor: 'rgba(0,0,0,0.6)',
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
