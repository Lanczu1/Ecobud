import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { TouchableOpacity } from '../../shared/accessibility/primitives';
import type { IdVerificationStatus } from '../../shared/api/ecobudApi';

const statuses = {
  approved: { label: 'Verified', color: '#49A447' },
  pending: { label: 'Pending', color: '#FFB511' },
  rejected: { label: 'Declined', color: '#EF383D' },
  not_submitted: { label: 'Unverified', color: '#788692' },
} satisfies Record<IdVerificationStatus, { label: string; color: string }>;

export function VerificationStatusBadge({ status, onPress, size = 30 }: {
  status: IdVerificationStatus;
  onPress: () => void;
  size?: number;
}) {
  const { label, color } = statuses[status];

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Account ${label.toLowerCase()}`}
      accessibilityHint="Open ID verification to view your status and review details."
      onPress={onPress}
      activeOpacity={0.75}
      style={styles.button}
    >
      <Svg width={size} height={size} viewBox="0 0 40 40" aria-hidden={true} focusable={false}>
        <Path
          d="M20 6 C23 6 24 10 27 11 C30 12 34 10 35 14 C36 17 34 19 36 22 C39 26 35 28 32 29 C29 30 30 35 26 35 C23 35 22 39 19 38 C16 37 15 34 12 34 C8 35 6 32 6 29 C6 26 1 26 2 22 C3 19 5 19 5 16 C5 12 9 12 12 11 C15 10 16 6 20 6 Z"
          fill={color}
          stroke="#FFFFFF"
          strokeWidth={1.2}
        />
        <Path d="M25 13 C23 7 27 2 37 2 C37 10 33 15 25 13 Z" fill={color} stroke="#FFFFFF" strokeWidth={1.2} />
        <Path d="M25 13 Q28 8 32 6" fill="none" stroke="#FFFFFF" strokeWidth={1.4} strokeLinecap="round" />
        {status === 'approved' && <Path d="M11 22 L17 28 L28 17" fill="none" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />}
        {status === 'pending' && <>
          <Circle cx={20} cy={23} r={10} fill="none" stroke="#684500" strokeWidth={2.5} />
          <Path d="M20 17 L20 23 L25 26" fill="none" stroke="#684500" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </>}
        {status === 'rejected' && <Path d="M14 17 L26 29 M26 17 L14 29" fill="none" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" />}
        {status === 'not_submitted' && <Path d="M13 23 H27" fill="none" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" />}
      </Svg>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
