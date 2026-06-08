export interface TransparencyMetric {
  label: string;
  value: number;
  icon: 'eco' | 'trophy' | 'groups';
  accent: string;
  suffix?: string;
}

export interface TransparencyLogEntry {
  id: string;
  user: string;
  action: string;
  points: number;
  hash: string;
}
