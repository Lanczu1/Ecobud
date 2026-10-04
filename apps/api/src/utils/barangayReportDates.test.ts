import { describe, expect, it } from 'vitest';
import { formatReportDate, formatReportTimestamp } from './barangayReportDates';

describe('readable barangay report dates', () => {
  it('keeps the selected calendar date', () => {
    expect(formatReportDate('2026-10-01')).toBe('October 1, 2026');
  });
  it('shows generation time in Philippine time without ISO notation or seconds', () => {
    expect(formatReportTimestamp('2026-10-04T05:00:14.001Z')).toBe('October 4, 2026 at 1:00 PM (Philippine Time)');
  });
  it('uses the local date when UTC crosses midnight in the Philippines', () => {
    expect(formatReportTimestamp('2026-10-03T16:05:00Z')).toBe('October 4, 2026 at 12:05 AM (Philippine Time)');
  });
});
