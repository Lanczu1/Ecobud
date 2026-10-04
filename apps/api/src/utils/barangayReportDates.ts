const options = { timeZone: 'Asia/Manila' };

export function formatReportDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', { ...options, month: 'long', day: 'numeric', year: 'numeric' })
    .format(new Date(`${value}T00:00:00Z`));
}

export function formatReportTimestamp(value: string): string {
  return `${new Intl.DateTimeFormat('en-US', { ...options, dateStyle: 'long', timeStyle: 'short', hour12: true })
    .format(new Date(value))} (Philippine Time)`;
}
