import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ecoTheme';

export type LegalDocumentType = 'terms' | 'privacy';

type LegalSection = {
  heading: string;
  body: string;
};

const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: '1. Acceptance of Terms',
    body: 'By creating an ECOBUD account or using the application, you agree to these Terms and Conditions and the Privacy Policy. If you do not agree, do not create an account or use the services.',
  },
  {
    heading: '2. ECOBUD Services',
    body: 'ECOBUD supports environmental learning and community participation through lessons, eco-challenges, events, rewards, AI-assisted guidance, community rankings, notifications, and the Give and Get Hub. Features may change as the project develops.',
  },
  {
    heading: '3. Account Responsibilities',
    body: 'You must provide accurate information, keep your password and verification codes confidential, and promptly report suspected unauthorized access. You are responsible for activity performed through your account.',
  },
  {
    heading: '4. Challenges, Proof, and Rewards',
    body: 'Challenge submissions must be authentic, current, and relevant to the stated task. Photos and other proof may be reviewed by automated tools and authorized administrators. Eco points, coins, badges, streaks, or other rewards have no cash value unless ECOBUD expressly states otherwise and may be corrected when awarded through error, fraud, or abuse.',
  },
  {
    heading: '5. Give and Get Hub',
    body: 'Users are responsible for the accuracy, legality, safety, and condition of items they list or exchange. ECOBUD does not own listed items and is not a party to exchanges between users. Use safe meeting practices, protect personal information, and report suspicious or prohibited activity.',
  },
  {
    heading: '6. Acceptable Use',
    body: 'You may not submit false proof, impersonate another person, harass users, post unlawful or harmful material, manipulate rewards or rankings, interfere with the service, attempt unauthorized access, scrape protected data, or use ECOBUD to distribute malware or spam.',
  },
  {
    heading: '7. User Content',
    body: 'You retain ownership of content you submit. You grant ECOBUD a limited license to store, process, display, and review that content only as needed to operate, secure, moderate, and improve the service. You confirm that you have the right to submit the content.',
  },
  {
    heading: '8. AI-Assisted Features',
    body: 'AI-generated guidance and image analysis may be incomplete or inaccurate. They are provided for educational and verification support and should not replace professional, safety, medical, or legal advice. Administrative review may override an automated result.',
  },
  {
    heading: '9. Suspension and Termination',
    body: 'ECOBUD may restrict or terminate access when reasonably necessary to protect users, enforce these terms, prevent fraud, comply with law, or maintain service security. You may stop using the service and request account deletion at any time.',
  },
  {
    heading: '10. Availability and Disclaimers',
    body: 'The service is provided on an as-available basis. ECOBUD does not guarantee uninterrupted access, error-free automated results, event availability, successful exchanges, or permanent availability of any reward or feature.',
  },
  {
    heading: '11. Limitation of Liability',
    body: 'To the extent permitted by applicable law, ECOBUD and its project operators are not liable for indirect or consequential loss arising from use of the service, user exchanges, third-party conduct, or reliance on AI-assisted output.',
  },
  {
    heading: '12. Changes to These Terms',
    body: 'We may update these terms when the service or legal requirements change. Material updates will be communicated through the application or another appropriate channel. Continued use after an update means you accept the revised terms.',
  },
  {
    heading: '13. Questions and Support',
    body: 'For questions, account concerns, or legal requests, contact the ECOBUD project administrators through the official in-app support or administrator channel.',
  },
];

const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: '1. Information We Collect',
    body: 'We collect account and profile information such as your username, email address, authentication records, selected barangay, avatar, and preferences. We also process activity information including lesson progress, challenge entries, photos, rewards, event participation, Give and Get Hub listings and messages, reports, and notification settings.',
  },
  {
    heading: '2. Device and Technical Information',
    body: 'ECOBUD may process device identifiers, push-notification tokens, session information, app diagnostics, network status, and security logs. Camera, photo-library, microphone, or location data is accessed only when a feature requires it and after the relevant device permission is granted.',
  },
  {
    heading: '3. How We Use Information',
    body: 'We use information to create and secure accounts, provide app features, verify challenges, calculate points and rankings, support exchanges and events, deliver notifications, synchronize offline activity, prevent abuse, answer support requests, and improve reliability and user experience.',
  },
  {
    heading: '4. AI Processing and Administrative Review',
    body: 'Challenge images or chat prompts may be processed by AI-assisted services to classify submissions or generate guidance. Authorized administrators may review submissions, reports, and moderation information when needed to validate rewards, enforce rules, or resolve disputes.',
  },
  {
    heading: '5. How Information Is Shared',
    body: 'We share information only with service providers needed to operate ECOBUD, such as hosting, database, authentication, email, storage, realtime, notification, mapping, and AI services; with authorized project administrators; when you intentionally make information visible to other users; or when required by law and safety obligations. We do not sell personal information.',
  },
  {
    heading: '6. Public and Community Information',
    body: 'Your display name, avatar, barangay affiliation, leaderboard information, public profile details, listings, and content you choose to post may be visible to other ECOBUD users. Avoid including sensitive personal information in public content or chat messages.',
  },
  {
    heading: '7. Storage, Retention, and Security',
    body: 'Information may be stored on your device and on secured project servers or cloud services. We use reasonable technical and organizational safeguards, including authenticated access and protected data transmission. Information is retained only while needed for the purposes described here, legal compliance, security, dispute resolution, and legitimate project records.',
  },
  {
    heading: '8. Your Choices and Rights',
    body: 'You can update profile details and theme or notification preferences in the app. You may request access, correction, or deletion of your personal information through the official ECOBUD support or administrator channel. Some records may be retained when required for security, fraud prevention, or legal compliance.',
  },
  {
    heading: '9. Children and Community Safety',
    body: 'Users who are not legally able to consent on their own should use ECOBUD only with permission and supervision from a parent, guardian, school, or authorized community program. Do not submit images or personal information about another person without appropriate permission.',
  },
  {
    heading: '10. Changes and Contact',
    body: 'We may update this policy as ECOBUD evolves. Material changes will be communicated through the application or another appropriate channel. Privacy questions and requests may be sent to the ECOBUD project administrators through the official in-app support or administrator channel.',
  },
];

export function LegalDocumentModal({
  document,
  onClose,
}: {
  document: LegalDocumentType | null;
  onClose: () => void;
}) {
  const { theme, isDark } = useTheme();
  const isTerms = document === 'terms';
  const title = isTerms ? 'Terms & Conditions' : 'Privacy Policy';
  const sections = isTerms ? TERMS_SECTIONS : PRIVACY_SECTIONS;

  return (
    <Modal visible={document !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border, backgroundColor: theme.colors.card }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: theme.colors.textPrimary }}>{title}</Text>
            <Text style={{ marginTop: 3, fontSize: 12, color: theme.colors.textMuted }}>Effective September 12, 2026</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Close ${title}`} hitSlop={10} onPress={onClose} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceMuted }}>
            <Ionicons name="close" size={23} color={theme.colors.textPrimary} />
          </Pressable>
        </View>
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 20 }} showsVerticalScrollIndicator={false}>
          <View style={{ padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: isDark ? theme.colors.surfaceMuted : '#EAF7EF' }}>
            <Text selectable style={{ fontSize: 14, lineHeight: 21, color: theme.colors.textPrimary }}>
              {isTerms
                ? 'These terms govern your access to and use of the ECOBUD mobile application and its community environmental services.'
                : 'This policy explains how ECOBUD collects, uses, shares, stores, and protects information when you use the application.'}
            </Text>
          </View>
          {sections.map(section => (
            <View key={section.heading} style={{ gap: 6 }}>
              <Text selectable style={{ fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary }}>{section.heading}</Text>
              <Text selectable style={{ fontSize: 14, lineHeight: 22, color: theme.colors.textMuted }}>{section.body}</Text>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
