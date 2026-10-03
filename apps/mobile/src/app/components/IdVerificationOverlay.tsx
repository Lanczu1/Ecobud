import React, { useEffect, useState } from 'react';
import { View, ScrollView, Image, ActivityIndicator, Switch } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Text, TextInput, TouchableOpacity } from '../../shared/accessibility/primitives';
import { useTheme } from '../../shared/theme/ecoTheme';
import { ecobudApi, type IdVerificationResult } from '../../shared/api/ecobudApi';
import { OverlayScaffold, PrimaryButton, SurfaceCard } from './CommonComponents';
import type { EcoBudMobileModel } from '../types/home';

export const idStatusLabel = {
  not_submitted: 'Submit your ID', pending: 'Waiting for ID approval',
  approved: 'ID approved', rejected: 'ID rejected: Resubmit',
};

export function IdVerificationOverlay({ model }: { model: EcoBudMobileModel }) {
  const { theme } = useTheme();
  const [result, setResult] = useState<IdVerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [legalName, setLegalName] = useState('');
  const [idType, setIdType] = useState('government');
  const [photo, setPhoto] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [progress, setProgress] = useState(0);
  const token = model.session?.token;
  const status = result?.status ?? model.idVerificationStatus;
  const editable = status === 'not_submitted' || status === 'rejected';

  const load = async () => {
    if (!token) return;
    setLoading(true); setError('');
    try {
      setResult(await ecobudApi.getIdVerification(token));
      await model.refreshIdVerification();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load your ID status.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [token, model.idVerificationStatus]);

  const choosePhoto = async (camera: boolean) => {
    setError('');
    try {
      const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { setError('Allow photo access to submit your ID, or choose another photo source.'); return; }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
      const chosen = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (chosen.canceled || !chosen.assets[0]) return;
      const asset = chosen.assets[0];
      const image = await ImageManipulator.manipulateAsync(asset.uri, asset.width > 1800 ? [{ resize: { width: 1800 } }] : [], { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG });
      setPhoto(image.uri);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to select a photo.'); }
  };

  const submit = async () => {
    if (!token || !photo || busy) return;
    if (legalName.trim().length < 2 || !consent) { setError('Enter the name on your ID and accept the review notice.'); return; }
    setBusy(true); setProgress(0); setError('');
    try {
      const next = await ecobudApi.submitIdVerification(token, photo, legalName.trim(), idType, setProgress);
      setResult(next); setPhoto(null); setConsent(false);
      await model.refreshIdVerification();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your ID could not be submitted. Please retry.');
      // Recover a saved submission when the response was lost.
      try { setResult(await ecobudApi.getIdVerification(token)); await model.refreshIdVerification(); } catch {}
    } finally { setBusy(false); }
  };

  return <OverlayScaffold title="ID verification" subtitle="Reviewed by your barangay moderator" onBack={() => model.setActiveOverlay(null)}>
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <SurfaceCard style={{ padding: 18, gap: 10 }}>
        <Text accessibilityRole="header" style={{ color: theme.colors.textPrimary, fontSize: 20, fontWeight: '700' }}>{idStatusLabel[status]}</Text>
        <Text style={{ color: theme.colors.textMuted, lineHeight: 21 }}>
          {status === 'approved' ? 'You can now participate in Challenges, Eco Events, and Give & Get Hub.' : 'You can browse Challenges, Eco Events, and Give & Get Hub while waiting. Learn videos, quizzes, and Learn rewards remain available.'}
        </Text>
        {status === 'pending' && <Text style={{ color: theme.colors.textMuted }}>We will notify you in the app and by email when your moderator reviews your ID.</Text>}
        {result?.submission?.reason && <Text style={{ color: theme.colors.textPrimary }}>Review reason: {result.submission.reason}</Text>}
      </SurfaceCard>
      {loading && <ActivityIndicator accessibilityLabel="Loading ID status" color={theme.colors.primary} />}
      {error !== '' && <Text accessibilityRole="alert" style={{ color: theme.colors.textPrimary }}>{error}</Text>}
      {!loading && editable && <SurfaceCard style={{ padding: 18, gap: 14 }}>
        <Text style={{ color: theme.colors.textPrimary, fontWeight: '700' }}>Full name as shown on your ID</Text>
        <TextInput accessibilityLabel="Full name on ID" value={legalName} editable={!busy} maxLength={120} onChangeText={setLegalName} autoCapitalize="words" style={{ color: theme.colors.textPrimary, borderWidth: 1, borderColor: theme.colors.inputBorder, borderRadius: 10, padding: 12 }} />
        <Text style={{ color: theme.colors.textPrimary, fontWeight: '700' }}>ID type</Text>
        {([['government', 'Government ID'], ['school', 'School ID'], ['barangay', 'Barangay ID']] as const).map(([value, label]) =>
          <TouchableOpacity key={value} disabled={busy} accessibilityRole="radio" accessibilityState={{ checked: idType === value }} onPress={() => setIdType(value)} style={{ padding: 12, borderWidth: 1, borderColor: idType === value ? theme.colors.primary : theme.colors.inputBorder, borderRadius: 10 }}>
            <Text style={{ color: theme.colors.textPrimary }}>{idType === value ? '● ' : '○ '}{label}</Text>
          </TouchableOpacity>)}
        <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>Upload the front of your ID with your name and photo clearly visible. JPEG, PNG, or WebP, up to 5 MB. This photo is private and accessible to moderators assigned to your barangay.</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <TouchableOpacity disabled={busy} onPress={() => void choosePhoto(true)} style={{ padding: 12 }}><Text style={{ color: theme.colors.primary, fontWeight: '700' }}>Take ID photo</Text></TouchableOpacity>
          <TouchableOpacity disabled={busy} onPress={() => void choosePhoto(false)} style={{ padding: 12 }}><Text style={{ color: theme.colors.primary, fontWeight: '700' }}>Choose photo</Text></TouchableOpacity>
        </View>
        {photo && <Image source={{ uri: photo }} accessibilityLabel="Selected ID photo preview" style={{ width: '100%', height: 220, borderRadius: 10 }} resizeMode="contain" />}
        <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>ID photos are deleted 30 days after review. Your submission status and review record remain in your account.</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Switch disabled={busy} value={consent} onValueChange={setConsent} accessibilityLabel="I agree to submit my ID for moderator review" />
          <Text style={{ flex: 1, color: theme.colors.textPrimary }}>I agree to submit this ID for moderator review.</Text>
        </View>
        <PrimaryButton label={busy ? `Uploading ID… ${progress}%` : status === 'rejected' ? 'Resubmit ID' : 'Submit ID'} disabled={busy || !photo || !consent || legalName.trim().length < 2} onPress={() => void submit()} />
      </SurfaceCard>}
      <PrimaryButton label="Refresh verification status" disabled={loading || busy} onPress={() => void load()} />
      <TouchableOpacity disabled={busy} onPress={() => model.setActiveOverlay(null)} style={{ padding: 14, alignItems: 'center' }}><Text style={{ color: theme.colors.primary, fontWeight: '700' }}>Continue browsing Eco Bud</Text></TouchableOpacity>
    </ScrollView>
  </OverlayScaffold>;
}
