import React, { useEffect, useRef, useState } from 'react';
import { View, ScrollView, Image, ActivityIndicator, Switch } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Text, TextInput, TouchableOpacity } from '../../shared/accessibility/primitives';
import { useTheme } from '../../shared/theme/ecoTheme';
import { ecobudApi, type IdVerificationResult } from '../../shared/api/ecobudApi';
import { OverlayScaffold, PrimaryButton, SurfaceCard } from './CommonComponents';
import type { EcoBudMobileModel } from '../types/home';
import { SubmitIdIntroCard } from './SubmitIdIntroCard';
import { ApprovedIdCard } from './ApprovedIdCard';

export const idStatusLabel = {
  not_submitted: 'Submit your ID', pending: 'Waiting for ID approval',
  approved: 'ID approved', rejected: 'ID rejected: Resubmit',
};

export function IdVerificationOverlay({ model }: { model: EcoBudMobileModel }) {
  const { theme } = useTheme();
  const [result, setResult] = useState<IdVerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [choosingPhoto, setChoosingPhoto] = useState(false);
  const choosingPhotoRef = useRef(false);
  const loadInFlight = useRef(false);
  const [error, setError] = useState('');
  const [legalName, setLegalName] = useState('');
  const [idType, setIdType] = useState('government');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const preparedPhoto = useRef<{ source: string; uri: string } | null>(null);
  const [consent, setConsent] = useState(false);
  const [progress, setProgress] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const formTop = useRef(0);
  const token = model.session?.token;
  const status = result?.status ?? model.idVerificationStatus;
  const editable = status === 'not_submitted' || status === 'rejected';

  const load = async () => {
    if (!token || loadInFlight.current) return;
    loadInFlight.current = true;
    setLoading(true); setError('');
    try {
      const next = await ecobudApi.getIdVerification(token);
      setResult(next);
      await model.refreshIdVerification(next);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load your ID status.'); }
    finally { loadInFlight.current = false; setLoading(false); }
  };
  useEffect(() => { void load(); }, [token]);
  useEffect(() => {
    if (result && result.status !== model.idVerificationStatus) void load();
  }, [model.idVerificationStatus]);

  const choosePhoto = async (camera: boolean) => {
    if (busy || choosingPhotoRef.current) return;
    choosingPhotoRef.current = true;
    setChoosingPhoto(true);
    setError('');
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) { setError('Allow camera access to take an ID photo, or choose a photo instead.'); return; }
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, base64: false, exif: false, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current };
      const chosen = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (chosen.canceled || !chosen.assets[0]) return;
      const asset = chosen.assets[0];
      preparedPhoto.current = null;
      setPhoto(asset);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to select a photo.'); }
    finally { choosingPhotoRef.current = false; setChoosingPhoto(false); }
  };

  const submit = async () => {
    if (!token || !photo || busy || choosingPhotoRef.current) return;
    if (legalName.trim().length < 2 || !consent) { setError('Enter the name on your ID and accept the review notice.'); return; }
    setBusy(true); setProgress(0); setError('');
    try {
      if (preparedPhoto.current?.source !== photo.uri) {
        const longestSide = Math.max(photo.width, photo.height);
        if (photo.mimeType === 'image/jpeg' && longestSide <= 1800 && photo.fileSize != null && photo.fileSize > 0 && photo.fileSize <= 5 * 1024 * 1024) {
          preparedPhoto.current = { source: photo.uri, uri: photo.uri };
        } else {
          const resize = longestSide > 1800 ? [{ resize: photo.width >= photo.height ? { width: 1800 } : { height: 1800 } }] : [];
          const image = await ImageManipulator.manipulateAsync(photo.uri, resize, { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG });
          preparedPhoto.current = { source: photo.uri, uri: image.uri };
        }
      }
      const next = await ecobudApi.submitIdVerification(token, preparedPhoto.current.uri, legalName.trim(), idType, setProgress);
      setResult(next); setPhoto(null); setConsent(false);
      await model.refreshIdVerification(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your ID could not be submitted. Please retry.');
      // Recover a saved submission when the response was lost.
      try { const recovered = await ecobudApi.getIdVerification(token); setResult(recovered); await model.refreshIdVerification(recovered); } catch {}
    } finally { setBusy(false); }
  };

  return <OverlayScaffold title="ID verification" subtitle="Reviewed by your barangay moderator" onBack={() => model.setActiveOverlay(null)}>
    <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      {status === 'not_submitted' ? <SubmitIdIntroCard /> : status === 'rejected'
        ? <ApprovedIdCard status="rejected" reason={result?.submission?.reason ?? model.idVerificationReason} onPress={() => scrollRef.current?.scrollTo({ y: Math.max(0, formTop.current - 20), animated: true })} />
        : <ApprovedIdCard status={status} actionLabel={loading ? 'Checking status…' : status === 'pending' ? 'Check verification status' : 'Refresh verification status'} actionIcon="refresh" loading={loading} disabled={busy} onPress={() => void load()} />}
      {loading && editable && <ActivityIndicator accessibilityLabel="Loading ID status" color={theme.colors.primary} />}
      {error !== '' && <Text accessibilityRole="alert" style={{ color: theme.colors.textPrimary }}>{error}</Text>}
      {editable && <View onLayout={(event) => { formTop.current = event.nativeEvent.layout.y; }}><SurfaceCard style={{ padding: 18, gap: 14 }}>
        <Text style={{ color: theme.colors.textPrimary, fontWeight: '700' }}>Full name as shown on your ID</Text>
        <TextInput accessibilityLabel="Full name on ID" value={legalName} editable={!busy} maxLength={120} onChangeText={setLegalName} autoCapitalize="words" style={{ color: theme.colors.textPrimary, borderWidth: 1, borderColor: theme.colors.inputBorder, borderRadius: 10, padding: 12 }} />
        <Text style={{ color: theme.colors.textPrimary, fontWeight: '700' }}>ID type</Text>
        {([['government', 'Government ID'], ['school', 'School ID'], ['barangay', 'Barangay ID']] as const).map(([value, label]) =>
          <TouchableOpacity key={value} disabled={busy} accessibilityRole="radio" accessibilityState={{ checked: idType === value }} onPress={() => setIdType(value)} style={{ padding: 12, borderWidth: 1, borderColor: idType === value ? theme.colors.primary : theme.colors.inputBorder, borderRadius: 10 }}>
            <Text style={{ color: theme.colors.textPrimary }}>{idType === value ? '● ' : '○ '}{label}</Text>
          </TouchableOpacity>)}
        <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>Upload the front of your ID with your name and photo clearly visible. JPEG, PNG, or WebP, up to 5 MB. This photo is private and accessible to moderators assigned to your barangay.</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <TouchableOpacity disabled={busy || choosingPhoto} onPress={() => void choosePhoto(true)} style={{ padding: 12, opacity: busy || choosingPhoto ? 0.5 : 1 }}><Text style={{ color: theme.colors.primary, fontWeight: '700' }}>Take ID photo</Text></TouchableOpacity>
          <TouchableOpacity disabled={busy || choosingPhoto} onPress={() => void choosePhoto(false)} style={{ padding: 12, opacity: busy || choosingPhoto ? 0.5 : 1 }}><Text style={{ color: theme.colors.primary, fontWeight: '700' }}>Choose photo</Text></TouchableOpacity>
        </View>
        {choosingPhoto && <ActivityIndicator accessibilityLabel="Opening photo picker" color={theme.colors.primary} />}
        {photo && <Image source={{ uri: photo.uri }} accessibilityLabel="Selected ID photo preview" style={{ width: '100%', height: 220, borderRadius: 10 }} resizeMode="contain" resizeMethod="resize" />}
        <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>ID photos are deleted 30 days after review. Your submission status and review record remain in your account.</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Switch disabled={busy} value={consent} onValueChange={setConsent} accessibilityLabel="I agree to submit my ID for moderator review" />
          <Text style={{ flex: 1, color: theme.colors.textPrimary }}>I agree to submit this ID for moderator review.</Text>
        </View>
        <PrimaryButton label={busy ? progress === 0 ? 'Preparing ID photo…' : `Uploading ID… ${progress}%` : status === 'rejected' ? 'Resubmit ID' : 'Submit ID'} disabled={loading || busy || choosingPhoto || !photo || !consent || legalName.trim().length < 2} onPress={() => void submit()} />
      </SurfaceCard></View>}
      {editable && <PrimaryButton label="Refresh verification status" disabled={loading || busy} onPress={() => void load()} />}
      <TouchableOpacity disabled={busy} onPress={() => model.setActiveOverlay(null)} style={{ padding: 14, alignItems: 'center' }}><Text style={{ color: theme.colors.primary, fontWeight: '700' }}>Continue browsing Eco Bud</Text></TouchableOpacity>
    </ScrollView>
  </OverlayScaffold>;
}
