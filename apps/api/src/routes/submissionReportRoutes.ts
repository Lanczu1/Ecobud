import { Router, Response } from 'express';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { authenticateRequest, requireModeratorAccess, AuthenticatedRequest } from '../http/authentication';
import { errorBoundary, HttpError } from '../http/errorResponder';
import { prisma } from '../prismaClient';
import { CHALLENGE_SUBMISSION_PHOTOS, EVENT_SUBMISSION_PHOTOS, readReportPhoto, ReportPhotoSource } from '../services/eventReportPhoto';

// Per-resident submission PDFs for the Challenges and Eco Events admin pages.
// Layout mirrors the Platform Reports & Analytics PDF in reportRoutes.ts.
const router = Router();

const BRAND = '#126027';
const MARGIN = 45;
const CONTENT_WIDTH = 505;
const FOOTER_HEIGHT = 40;
const MAX_PHOTOS = 60;
const PHOTO_FETCH_CONCURRENCY = 6;
const UNASSIGNED = 'Unassigned Barangay';
const uploadsBase = path.join(__dirname, '..', '..', 'uploads');

const logoPath = path.join(__dirname, '..', '..', '..', 'web', 'public', 'logo.png');
let logoBuffer: Buffer | null = null;
try {
  logoBuffer = fs.readFileSync(logoPath);
} catch {
  console.warn('ECOBUD logo not found at', logoPath, '- submission PDFs will not include logo');
}

// pdfkit is declared untyped in types.d.ts.
type Doc = any;
type Column = { label: string; width: number };
type Cell = { text: string; color?: string; bold?: boolean };
type ReportPhoto = { url: string; caption: string; detail: string };

const CHALLENGE_STATUS: Record<string, string> = {
  pending: 'Pending review',
  approved_collection: 'Approved for collection',
  final_review: 'Final review',
  approved: 'Approved',
  rejected: 'Rejected',
  flagged: 'Flagged',
};
const EVENT_STATUS: Record<string, string> = { pending: 'Pending review', approved: 'Approved', rejected: 'Rejected' };

const statusColor = (status: string) =>
  status === 'approved' ? '#047857' : status === 'rejected' || status === 'flagged' ? '#B91C1C' : status === 'pending' ? '#B45309' : '#1D4ED8';

const manilaDateTime = (date: Date) =>
  date.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' });

// Narrow table columns: date on one line, time on the next.
const manilaDateLines = (date: Date) =>
  `${date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })}\n${date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' })}`;

const fileSlug =(value: string) => value.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'Resident';

// Moderators only see residents of their assigned barangay, same as GET /api/admin/submissions.
async function loadResident(req: AuthenticatedRequest) {
  const resident = await prisma.user.findUnique({
    where: { id: req.params.userId },
    select: { id: true, name: true, profile: { select: { displayName: true, city: true } } },
  });
  if (!resident) throw new HttpError(404, 'Resident not found.');
  const city = resident.profile?.city?.trim() || '';
  if (req.auth!.role === 'moderator') {
    const assigned = req.auth!.city?.trim().toLowerCase();
    if (!assigned) throw new HttpError(403, 'A barangay assignment is required to download submission reports.');
    if (city.toLowerCase() !== assigned) throw new HttpError(404, 'Resident not found.');
  }
  return {
    username: resident.name,
    displayName: resident.profile?.displayName?.trim() || resident.name || 'Resident',
    barangay: city || UNASSIGNED,
  };
}

async function loadPhotos(photos: ReportPhoto[], source: ReportPhotoSource) {
  const buffers: (Buffer | null)[] = new Array(photos.length).fill(null);
  let next = 0;
  const worker = async () => {
    while (next < photos.length) {
      const index = next++;
      buffers[index] = await readReportPhoto(photos[index].url, uploadsBase, source).catch(() => null);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PHOTO_FETCH_CONCURRENCY, photos.length) }, worker));
  return buffers;
}

function generatedStamp(req: AuthenticatedRequest) {
  const now = new Date();
  return {
    generatedBy: req.auth?.name || req.auth?.email || 'Administrator',
    generatedDate: now.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }),
    generatedTime: now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila' }),
    todayIso: now.toISOString().slice(0, 10),
  };
}

function startDocument(res: Response, filename: string, title: string, subtitle: string, stamp: ReturnType<typeof generatedStamp>) {
  const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  doc.rect(0, 0, doc.page.width, 105).fill(BRAND);
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, MARGIN, 18, { width: 48, height: 48, fit: [48, 48] });
    } catch { /* skip logo if invalid */ }
  }
  doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold').text(title, MARGIN, 22, { align: 'center' });
  doc.fontSize(11).font('Helvetica').text(subtitle, MARGIN, 47, { align: 'center' });
  doc.fontSize(8).text(`Generated: ${stamp.generatedDate} at ${stamp.generatedTime} (PHT)  |  Generated By: ${stamp.generatedBy}  |  Real-time Live Data`, MARGIN, 65, { align: 'center' });

  doc.moveDown(4.2);
  doc.fillColor('#000000');
  return doc;
}

const pageBottom = (doc: Doc) => doc.page.height - FOOTER_HEIGHT - 20;

function sectionTitle(doc: Doc, text: string, spaceNeeded = 80) {
  if (doc.y + spaceNeeded > pageBottom(doc)) doc.addPage();
  doc.fontSize(13).font('Helvetica-Bold').fillColor(BRAND).text(text, MARGIN, doc.y, { underline: true });
  doc.moveDown(0.6);
}

function drawTable(doc: Doc, columns: Column[], rows: Cell[][]) {
  const tableWidth = columns.reduce((sum, c) => sum + c.width, 0);
  const drawHeader = (top: number) => {
    doc.rect(MARGIN, top, tableWidth, 18).fill(BRAND);
    doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
    let x = MARGIN;
    for (const column of columns) {
      doc.text(column.label, x + 6, top + 5, { width: column.width - 12 });
      x += column.width;
    }
    return top + 18;
  };

  let y = drawHeader(doc.y);
  rows.forEach((row, i) => {
    const cellHeight = (cell: Cell, column: Column) => {
      doc.font(cell.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
      return doc.heightOfString(cell.text, { width: column.width - 12 });
    };
    const rowHeight = Math.max(17, ...row.map((cell, c) => cellHeight(cell, columns[c]) + 8));
    if (y + rowHeight > pageBottom(doc)) {
      doc.addPage();
      y = drawHeader(MARGIN);
    }
    doc.rect(MARGIN, y, tableWidth, rowHeight).fill(i % 2 === 0 ? '#F9FAFB' : '#FFFFFF');
    let x = MARGIN;
    row.forEach((cell, c) => {
      doc.fillColor(cell.color || '#1F2937').font(cell.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
      doc.text(cell.text, x + 6, y + 4, { width: columns[c].width - 12 });
      x += columns[c].width;
    });
    y += rowHeight;
  });
  doc.y = y + 14;
}

function drawSummary(doc: Doc, rows: [string, string, string][]) {
  drawTable(doc, [
    { label: 'Record', width: 190 },
    { label: 'Value', width: 130 },
    { label: 'Context', width: 185 },
  ], rows.map(([label, value, note]) => [
    { text: label, bold: true },
    { text: value, bold: true, color: BRAND },
    { text: note, color: '#6B7280' },
  ]));
}

function drawPhotoGrid(doc: Doc, photos: ReportPhoto[], buffers: (Buffer | null)[]) {
  const photoSize = 230;
  const gapX = 20;
  const captionHeight = 30;
  const rowHeight = photoSize + captionHeight + 12;
  const startX = MARGIN + (CONTENT_WIDTH - (2 * photoSize + gapX)) / 2;

  let curY = doc.y;
  photos.forEach((photo, i) => {
    const col = i % 2;
    if (col === 0 && i > 0) curY += rowHeight;
    if (col === 0 && curY + photoSize + captionHeight > pageBottom(doc)) {
      doc.addPage();
      curY = MARGIN;
    }
    const curX = startX + col * (photoSize + gapX);

    doc.rect(curX - 1, curY - 1, photoSize + 2, photoSize + 2).lineWidth(1).strokeColor('#E5E7EB').stroke();
    let drawn = false;
    const buffer = buffers[i];
    if (buffer) {
      try {
        doc.image(buffer, curX, curY, { fit: [photoSize, photoSize], align: 'center', valign: 'center' });
        drawn = true;
      } catch { /* unsupported format, fall through */ }
    }
    if (!drawn) {
      doc.rect(curX, curY, photoSize, photoSize).fill('#F3F4F6');
      doc.fillColor('#6B7280').fontSize(10).font('Helvetica')
        .text('Photo not available', curX, curY + photoSize / 2 - 5, { width: photoSize, align: 'center' });
    }

    doc.fillColor('#1F2937').fontSize(8).font('Helvetica-Bold')
      .text(photo.caption, curX, curY + photoSize + 5, { width: photoSize, align: 'center', lineBreak: false, ellipsis: true });
    doc.fillColor('#6B7280').fontSize(7.5).font('Helvetica')
      .text(photo.detail, curX, curY + photoSize + 16, { width: photoSize, align: 'center', lineBreak: false, ellipsis: true });
  });
  doc.y = curY + rowHeight;
}

function finishDocument(doc: Doc, footerLabel: string, generatedDate: string) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0;
    doc.rect(0, doc.page.height - FOOTER_HEIGHT, doc.page.width, FOOTER_HEIGHT).fill(BRAND);
    doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica')
      .text(`${footerLabel}  |  ${generatedDate}  |  Page ${i - range.start + 1} of ${range.count}`, MARGIN, doc.page.height - 25, {
        align: 'center',
        width: doc.page.width - 90,
      });
  }
  doc.end();
}

function photoSection(doc: Doc, sectionLabel: string, photos: ReportPhoto[], buffers: (Buffer | null)[], totalPhotos: number) {
  sectionTitle(doc, sectionLabel, 300);
  if (photos.length === 0) {
    doc.fillColor('#6B7280').fontSize(10).font('Helvetica').text('No photos were attached to these submissions.', MARGIN, doc.y);
    return;
  }
  const note = totalPhotos > photos.length
    ? `Showing the ${photos.length} most recent of ${totalPhotos} photos.`
    : `${photos.length} photo(s) attached to these submissions.`;
  doc.fillColor('#374151').fontSize(9).font('Helvetica').text(note, MARGIN, doc.y);
  doc.moveDown(0.8);
  drawPhotoGrid(doc, photos, buffers);
}

// ─── GET /api/reports/submissions/challenges/:userId/pdf ───
router.get('/challenges/:userId/pdf', authenticateRequest, requireModeratorAccess, errorBoundary<AuthenticatedRequest>(async (req, res) => {
  const resident = await loadResident(req);
  const submissions = (await prisma.challengeSubmission.findMany({
    where: { userId: req.params.userId },
    orderBy: { createdAt: 'asc' },
    select: {
      status: true, proofUrl: true, afterProofUrl: true, moderatorNotes: true, detectedQuantity: true,
      ecoCoinsAwarded: true, expAwarded: true, rewardAwarded: true, createdAt: true,
      challengeInstance: { select: { challengeId: true, challenge: { select: { title: true, type: true, quantityUnit: true } } } },
    },
  })).filter(s => s.challengeInstance?.challenge?.type !== 'EVENT');
  if (submissions.length === 0) throw new HttpError(404, 'This resident has no challenge submissions.');

  const allPhotos: ReportPhoto[] = submissions.flatMap((s, i) => {
    const title = s.challengeInstance?.challenge?.title || 'Eco Challenge';
    const when = manilaDateTime(s.createdAt);
    const photos: ReportPhoto[] = [];
    if (s.proofUrl) photos.push({ url: s.proofUrl, caption: `#${i + 1} ${title}`, detail: `Proof photo  |  ${when}` });
    if (s.afterProofUrl) photos.push({ url: s.afterProofUrl, caption: `#${i + 1} ${title}`, detail: `After photo  |  ${when}` });
    return photos;
  });
  const photos = allPhotos.slice(-MAX_PHOTOS);
  const buffers = await loadPhotos(photos, CHALLENGE_SUBMISSION_PHOTOS);

  const count = (status: string) => submissions.filter(s => s.status === status).length;
  const challengeCount = new Set(submissions.map(s => s.challengeInstance?.challengeId)).size;
  const coins = submissions.reduce((sum, s) => sum + (s.rewardAwarded ? s.ecoCoinsAwarded : 0), 0);
  const exp = submissions.reduce((sum, s) => sum + (s.rewardAwarded ? s.expAwarded : 0), 0);

  const stamp = generatedStamp(req);
  const doc = startDocument(
    res,
    `ECOBUD-Challenge-Submissions-${fileSlug(resident.displayName)}-${stamp.todayIso}.pdf`,
    'ECOBUD CHALLENGE SUBMISSIONS',
    `Resident Submission Record: ${resident.displayName}`,
    stamp,
  );

  sectionTitle(doc, 'SECTION 1: RESIDENT SUMMARY');
  drawSummary(doc, [
    ['Resident', resident.displayName, `@${resident.username}`],
    ['Barangay', resident.barangay, 'From the resident profile'],
    ['Total Submissions', submissions.length.toLocaleString(), `Across ${challengeCount} ${challengeCount === 1 ? 'challenge' : 'challenges'}`],
    ['Approved', count('approved').toLocaleString(), 'Fully approved and rewarded'],
    ['Approved for Collection', count('approved_collection').toLocaleString(), 'Waiting for drop-off at a collection point'],
    ['Final Review', count('final_review').toLocaleString(), 'After photo submitted, awaiting final approval'],
    ['Pending Review', count('pending').toLocaleString(), 'Not yet reviewed'],
    ['Rejected', count('rejected').toLocaleString(), 'Declined by a reviewer'],
    ['Rewards Earned', `${coins.toLocaleString()} coins`, `${exp.toLocaleString()} EXP from these submissions`],
  ]);

  sectionTitle(doc, 'SECTION 2: SUBMISSION HISTORY');
  drawTable(doc, [
    { label: '#', width: 28 },
    { label: 'Challenge', width: 167 },
    { label: 'Status', width: 90 },
    { label: 'Quantity', width: 65 },
    { label: 'Rewards', width: 70 },
    { label: 'Submitted', width: 85 },
  ], submissions.map((s, i) => {
    const challenge = s.challengeInstance?.challenge;
    return [
      { text: String(i + 1), bold: true },
      { text: (challenge?.title || 'Eco Challenge') + (s.moderatorNotes ? `\nNote: ${s.moderatorNotes}` : ''), bold: true },
      { text: CHALLENGE_STATUS[s.status] || s.status, bold: true, color: statusColor(s.status) },
      { text: `${s.detectedQuantity} ${challenge?.quantityUnit || 'items'}` },
      { text: s.rewardAwarded ? `${s.ecoCoinsAwarded} coins\n${s.expAwarded} EXP` : 'Not awarded', color: s.rewardAwarded ? BRAND : '#6B7280' },
      { text: manilaDateLines(s.createdAt), color: '#374151' },
    ];
  }));

  photoSection(doc, 'SECTION 3: SUBMISSION PHOTOS', photos, buffers, allPhotos.length);
  finishDocument(doc, 'ECOBUD Challenge Submissions Report', stamp.generatedDate);
}));

// ─── GET /api/reports/submissions/events/:userId/pdf ───
router.get('/events/:userId/pdf', authenticateRequest, requireModeratorAccess, errorBoundary<AuthenticatedRequest>(async (req, res) => {
  const resident = await loadResident(req);
  const submissions = await prisma.eventSubmission.findMany({
    where: { userId: req.params.userId },
    orderBy: { submittedAt: 'asc' },
    select: {
      status: true, attendanceImageUrl: true, qrVerified: true, rejectionReason: true, submittedAt: true,
      event: { select: { title: true, location: true, startDatetime: true } },
    },
  });
  if (submissions.length === 0) throw new HttpError(404, 'This resident has no eco event submissions.');

  const allPhotos: ReportPhoto[] = submissions
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !!s.attendanceImageUrl)
    .map(({ s, i }) => ({ url: s.attendanceImageUrl, caption: `#${i + 1} ${s.event.title}`, detail: `Attendance photo  |  ${manilaDateTime(s.submittedAt)}` }));
  const photos = allPhotos.slice(-MAX_PHOTOS);
  const buffers = await loadPhotos(photos, EVENT_SUBMISSION_PHOTOS);

  const count = (status: string) => submissions.filter(s => s.status === status).length;
  const qrVerified = submissions.filter(s => s.qrVerified).length;

  const stamp = generatedStamp(req);
  const doc = startDocument(
    res,
    `ECOBUD-Event-Submissions-${fileSlug(resident.displayName)}-${stamp.todayIso}.pdf`,
    'ECOBUD ECO EVENT SUBMISSIONS',
    `Resident Attendance Record: ${resident.displayName}`,
    stamp,
  );

  sectionTitle(doc, 'SECTION 1: RESIDENT SUMMARY');
  drawSummary(doc, [
    ['Resident', resident.displayName, `@${resident.username}`],
    ['Barangay', resident.barangay, 'From the resident profile'],
    ['Events Attended', submissions.length.toLocaleString(), 'Attendance submissions on record'],
    ['Approved', count('approved').toLocaleString(), 'Attendance confirmed'],
    ['Pending Review', count('pending').toLocaleString(), 'Not yet reviewed'],
    ['Rejected', count('rejected').toLocaleString(), 'Declined by a reviewer'],
    ['QR Verified', qrVerified.toLocaleString(), 'Checked in by scanning the event QR code'],
  ]);

  sectionTitle(doc, 'SECTION 2: ATTENDANCE HISTORY');
  drawTable(doc, [
    { label: '#', width: 28 },
    { label: 'Eco Event', width: 172 },
    { label: 'Event Date', width: 85 },
    { label: 'Check-in', width: 65 },
    { label: 'Status', width: 70 },
    { label: 'Submitted', width: 85 },
  ], submissions.map((s, i) => [
    { text: String(i + 1), bold: true },
    { text: `${s.event.title}\n${s.event.location}` + (s.rejectionReason ? `\nNote: ${s.rejectionReason}` : '') },
    { text: manilaDateLines(s.event.startDatetime), color: '#374151' },
    { text: s.qrVerified ? 'QR scanned' : 'Photo only', color: s.qrVerified ? BRAND : '#6B7280' },
    { text: EVENT_STATUS[s.status] || s.status, bold: true, color: statusColor(s.status) },
    { text: manilaDateLines(s.submittedAt), color: '#374151' },
  ]));

  photoSection(doc, 'SECTION 3: ATTENDANCE PHOTOS', photos, buffers, allPhotos.length);
  finishDocument(doc, 'ECOBUD Eco Event Submissions Report', stamp.generatedDate);
}));

export default router;
