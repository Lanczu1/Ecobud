import { z } from 'zod';

export const announcementSchema = z.object({
  title: z.string().trim().min(1).max(120), content: z.string().trim().min(1).max(20000),
  category: z.enum(['General', 'Waste Management', 'Eco Challenge', 'Eco Event', 'Rewards', 'Learning', 'Important Notice', 'Community']),
  image: z.string().url().regex(/^https?:\/\//i).nullable().default(null),
  images: z.array(z.string().url().regex(/^https?:\/\//i)).max(10).optional(),
  status: z.enum(['Draft', 'Published', 'Scheduled', 'Archived']),
  priority: z.enum(['Normal', 'Important']),
  targetAudience: z.enum(['All Residents', 'Specific Barangay', 'Multiple Barangays']),
  barangays: z.array(z.string().trim().min(1).max(200)).max(200),
  publishAt: z.string().datetime().nullable(), expiresAt: z.string().datetime().nullable(),
  ctaLabel: z.string().trim().max(40).nullable(),
  ctaType: z.enum(['No Action', 'View Eco Challenge', 'View Eco Event', 'View Learning Module', 'View Rewards', 'Open External Link']),
  ctaValue: z.string().trim().max(2000).nullable(),
}).superRefine((v, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (v.status === 'Scheduled' && (!v.publishAt || Date.parse(v.publishAt) <= Date.now())) issue('Choose a future publish date.');
  if (['Published', 'Scheduled'].includes(v.status) && v.expiresAt && Date.parse(v.expiresAt) <= Math.max(Date.now(), v.publishAt ? Date.parse(v.publishAt) : 0)) issue('Expiration must be after publication and in the future.');
  if (v.targetAudience === 'Specific Barangay' && v.barangays.length !== 1) issue('Choose one barangay.');
  if (v.targetAudience === 'Multiple Barangays' && v.barangays.length < 2) issue('Choose at least two barangays.');
  if (v.ctaType !== 'No Action' && (!v.ctaLabel || !v.ctaValue)) issue('Provide an action label and destination.');
  if (v.ctaType === 'Open External Link' && (!/^https:\/\//i.test(v.ctaValue || '') || !z.string().url().safeParse(v.ctaValue).success)) issue('External links must be valid HTTPS URLs.');
});

export function effectiveAnnouncementStatus(item: { status: string; publishAt: Date | null; expiresAt: Date | null }, now = new Date()) {
  if (['Published', 'Scheduled'].includes(item.status) && item.expiresAt && item.expiresAt <= now) return 'Archived';
  if (item.status === 'Scheduled' && item.publishAt && item.publishAt <= now) return 'Published';
  return item.status;
}
