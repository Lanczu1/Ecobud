import { Router } from 'express';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import { authenticateRequest, requireModeratorAccess } from '../http/authentication';
import fs from 'fs';
import path from 'path';

const router = Router();
const prisma = new PrismaClient();

// Pre-load the ECOBUD logo for PDF embedding
const logoPath = path.join(__dirname, '..', '..', '..', 'web', 'public', 'logo.png');
let logoBuffer: Buffer | null = null;
try {
  logoBuffer = fs.readFileSync(logoPath);
} catch {
  console.warn('ECOBUD logo not found at', logoPath, '- PDF reports will not include logo');
}

// Helper: fetch full event report data
async function getEventReportData(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      managedBy: { select: { name: true, email: true } },
      registrations: {
        include: {
          user: { select: { name: true, email: true } },
        },
        orderBy: { registeredAt: 'asc' },
      },
      submissions: {
        include: {
          user: { select: { name: true, email: true } },
        },
      },
      rewards: {
        include: {
          user: { select: { name: true } },
        },
      },
    },
  });

  if (!event) return null;

  const totalRegistered = event.registrations.length;
  const attended = event.registrations.filter(r => r.attendedAt != null).length;
  const qrVerified = event.submissions.filter(s => s.qrVerified).length;
  const pendingVerification = event.submissions.filter(s => s.status === 'pending').length;
  const approved = event.submissions.filter(s => s.status === 'approved').length;
  const rejected = event.submissions.filter(s => s.status === 'rejected').length;
  const totalCoinsAwarded = event.rewards.filter(r => r.type === 'eco_coins').reduce((sum, r) => sum + r.amount, 0);
  const totalExpAwarded = event.rewards.filter(r => r.type === 'exp').reduce((sum, r) => sum + Math.abs(r.amount), 0);

  const photos = event.submissions
    .filter(s => s.status === 'approved' && s.attendanceImageUrl)
    .map(s => s.attendanceImageUrl);

  const rawLogs = await prisma.auditLog.findMany({
    where: { action: { in: ['EVENT_SUBMISSION_APPROVED', 'EVENT_SUBMISSION_REJECTED'] } },
    include: { user: { select: { name: true } } },
    orderBy: { timestamp: 'asc' }
  });
  const eventLogs = rawLogs.filter(l => {
    try {
      if (!l.details) return false;
      return JSON.parse(l.details).eventId === eventId;
    } catch { return false; }
  }).map(l => ({
    action: l.action.replace('EVENT_SUBMISSION_', ''),
    userName: l.user?.name || 'System',
    timestamp: l.timestamp,
    notes: (() => {
      try { return l.details ? JSON.parse(l.details).notes || 'None' : 'None'; } catch { return 'None'; }
    })()
  }));

  return {
    event,
    stats: {
      totalRegistered,
      attended,
      qrVerified,
      pendingVerification,
      approved,
      rejected,
      totalCoinsAwarded,
      totalExpAwarded,
    },
    participants: event.registrations.map(r => {
      const sub = event.submissions.find(s => s.userId === r.userId);
      const reward = event.rewards.find(rew => rew.userId === r.userId);
      return {
        name: r.user.name,
        email: r.user.email,
        attendanceStatus: r.attendedAt ? 'Attended' : 'Registered Only',
        qrVerification: sub ? (sub.qrVerified ? 'Verified' : sub.status) : 'No Submission',
        rewardStatus: reward ? (reward.amount > 0 ? 'Awarded' : 'Pending') : 'Pending',
        coinsAwarded: reward && reward.type === 'eco_coins' ? reward.amount : 0,
        expAwarded: reward && reward.type === 'exp' ? Math.abs(reward.amount) : 0,
        joinedDate: r.registeredAt,
      };
    }),
    photos,
    logs: eventLogs,
  };
}

// Generate summary narrative
function generateSummary(data: NonNullable<Awaited<ReturnType<typeof getEventReportData>>>) {
  const { event, stats, participants } = data;
  const eventDate = new Date(event.startDatetime).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });
  const name = event.title;
  const loc = event.location;
  const reg = stats.totalRegistered;
  const att = stats.attended;
  const pend = stats.pendingVerification;

  let summary = `The ${name} was successfully conducted on ${eventDate} at ${loc}. `;
  summary += `The event gathered ${reg} registered participant${reg !== 1 ? 's' : ''}. `;

  if (att > 0) {
    summary += `${att} participant${att !== 1 ? 's' : ''} successfully completed attendance verification`;
    if (pend > 0) {
      summary += ` while ${pend} remain${pend === 1 ? 's' : ''} pending verification`;
    }
    summary += '. ';
  }

  if (stats.totalCoinsAwarded > 0 || stats.totalExpAwarded > 0) {
    const parts = [];
    if (stats.totalCoinsAwarded > 0) parts.push(`${stats.totalCoinsAwarded} Eco Coins`);
    if (stats.totalExpAwarded > 0) parts.push(`${stats.totalExpAwarded} EXP`);
    summary += `Rewards totaling ${parts.join(' and ')} were distributed to eligible participants after verification.`;
  }

  return summary;
}

// ─── GET /api/reports/events/:id ─── Return report JSON data
router.get('/events/:id', authenticateRequest, requireModeratorAccess, async (req, res) => {
  try {
    const data = await getEventReportData(req.params.id);
    if (!data) return res.status(404).json({ message: 'Event not found' });
    res.json(data);
  } catch (error) {
    console.error('Error fetching event report data:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── GET /api/reports/events/:id/pdf ─── Generate PDF
router.get('/events/:id/pdf', authenticateRequest, requireModeratorAccess, async (req, res) => {
  try {
    const data = await getEventReportData(req.params.id);
    if (!data) return res.status(404).json({ message: 'Event not found' });

    const { event, stats, participants, photos, logs } = data;
    const generatedBy = (req as any).auth?.name || 'Admin';
    const generatedDate = new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });

    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ECOBUD-Event-Report-${event.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);
    doc.pipe(res);

    // Track page numbers correctly
    let currentPage = 1;
    const pageNumbers: number[] = [];
    doc.on('pageAdded', () => { currentPage++; });

    // ─── HEADER ───
    doc.rect(0, 0, doc.page.width, 110).fill('#126027');

    // Draw logo if available
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, 50, 15, { width: 50, height: 50, fit: [50, 50] });
      } catch { /* skip logo if invalid */ }
    }

    doc.fillColor('#FFFFFF').fontSize(24).font('Helvetica-Bold').text('ECOBUD', 50, 20, { align: 'center' });
    doc.fontSize(13).font('Helvetica').text('Community Event Report', 50, 50, { align: 'center' });
    doc.fontSize(9).text(`Generated: ${generatedDate}  |  Generated By: ${generatedBy}`, 50, 70, { align: 'center' });

    doc.moveDown(4.5);
    doc.fillColor('#000000');

    // ─── SECTION 1: EVENT INFORMATION ───
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#126027').text('SECTION 1: EVENT INFORMATION', { underline: true });
    doc.moveDown(0.5);
    doc.fillColor('#333333').fontSize(10).font('Helvetica');
    const info = [
      ['Event Name', event.title],
      ['Event Description', event.description],
      ['Event Category', 'Community Event'],
      ['Event Location', event.location],
      ['Event Date', new Date(event.startDatetime).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })],
      ['Start Time', new Date(event.startDatetime).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila' })],
      ['End Time', new Date(event.endDatetime).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila' })],
      ['Organizer', event.managedBy.name],
      ['Event Status', (() => {
        const now = new Date();
        const start = new Date(event.startDatetime);
        const end = new Date(event.endDatetime);
        if (now < start) return 'Upcoming';
        if (now > end) return 'Completed';
        return 'Ongoing';
      })()],
    ];
    for (const [label, value] of info) {
      doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
      doc.font('Helvetica').text(String(value || 'N/A'));
    }

    doc.moveDown(1.5);

    // ─── SECTION 2: EVENT SUMMARY ───
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#126027').text('SECTION 2: EVENT SUMMARY', { underline: true });
    doc.moveDown(0.5);
    doc.fillColor('#333333').fontSize(10).font('Helvetica').text(generateSummary(data));

    doc.moveDown(1.5);

    // ─── SECTION 3: EVENT STATISTICS ───
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#126027').text('SECTION 3: EVENT STATISTICS', { underline: true });
    doc.moveDown(0.5);
    doc.fillColor('#333333').fontSize(10).font('Helvetica');
    const statRows = [
      ['Total Registered Participants', stats.totalRegistered],
      ['Total Participants Attended', stats.attended],
      ['Total QR Verified', stats.qrVerified],
      ['Total Pending Verification', stats.pendingVerification],
      ['Total Approved', stats.approved],
      ['Total Rejected', stats.rejected],
      ['Total Eco Coins Awarded', stats.totalCoinsAwarded],
      ['Total EXP Awarded', stats.totalExpAwarded],
    ];
    for (const [label, value] of statRows) {
      doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
      doc.font('Helvetica').text(String(value));
    }

    doc.moveDown(1.5);

    // ─── SECTION 4: PARTICIPANT LIST ───
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#126027').text('SECTION 4: PARTICIPANT LIST', { underline: true });
    doc.moveDown(0.5);

    if (participants.length === 0) {
      doc.fillColor('#666666').fontSize(10).font('Helvetica').text('No participants registered.');
    } else {
      const tableTop = doc.y;
      const colWidths = [80, 85, 55, 60, 55, 45, 45, 55];
      const headers = ['Name', 'Email', 'Status', 'QR Verify', 'Reward', 'Coins', 'EXP', 'Joined'];
      const startX = 50;

      // Table header
      doc.rect(startX, tableTop, colWidths.reduce((a, b) => a + b, 0), 20).fill('#126027');
      doc.fillColor('#FFFFFF').fontSize(7).font('Helvetica-Bold');
      let x = startX;
      for (let i = 0; i < headers.length; i++) {
        doc.text(headers[i], x + 4, tableTop + 6, { width: colWidths[i] - 8 });
        x += colWidths[i];
      }

      // Table rows
      doc.fillColor('#333333').font('Helvetica').fontSize(7);
      let y = tableTop + 22;
      for (let i = 0; i < participants.length; i++) {
        if (y > 720) {
          doc.addPage();
          y = 50;
        }
        const p = participants[i];
        const bgColor = i % 2 === 0 ? '#F9FAFB' : '#FFFFFF';
        doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), 16).fill(bgColor);
        doc.fillColor('#333333');
        const row = [
          p.name?.substring(0, 18) || 'N/A',
          p.email?.substring(0, 20) || 'N/A',
          p.attendanceStatus,
          p.qrVerification,
          p.rewardStatus,
          String(p.coinsAwarded),
          String(p.expAwarded),
          new Date(p.joinedDate).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }),
        ];
        x = startX;
        for (let j = 0; j < row.length; j++) {
          doc.text(row[j], x + 4, y + 4, { width: colWidths[j] - 8 });
          x += colWidths[j];
        }
        y += 16;
      }
    }

    // ─── SECTION 5: EVENT PHOTOS ───
    doc.x = 50;
    doc.moveDown(1.5);
    if (doc.y > 600) { doc.addPage(); }
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#126027').text('SECTION 5: EVENT PHOTOS', 50, doc.y, { underline: true });
    doc.moveDown(0.5);

    if (photos.length === 0) {
      doc.fillColor('#666666').fontSize(10).font('Helvetica').text('No event photos available.');
    } else {
      doc.fillColor('#333333').fontSize(10).font('Helvetica').text(`${photos.length} attendance photo(s) submitted by participants.`);
      doc.moveDown(0.8);

      const uploadsBase = path.join(__dirname, '..', '..', 'uploads');
      const pageWidth = doc.page.width - 100; // 50 margin each side
      const cols = 2;
      const photoSize = 230;
      const gapX = 20;
      const gapY = 25;
      const gridWidth = cols * photoSize + (cols - 1) * gapX;
      const startX = 50 + (pageWidth - gridWidth) / 2;

      let curX = startX;
      let curY = doc.y;

      for (let i = 0; i < photos.length; i++) {
        const photoUrl = photos[i];
        const filename = photoUrl.split('/').pop() || '';
        const filePath = path.join(uploadsBase, 'EventSubmissions', filename);

        const row = Math.floor(i / cols);
        const col = i % cols;

        if (col === 0 && i > 0) {
          curX = startX;
          curY += photoSize + gapY + 18;
        }

        // Page break check
        if (curY + photoSize + 25 > doc.page.height - 60) {
          doc.addPage();
          curY = 50;
          curX = startX;
        }

        // Draw photo border
        doc.rect(curX - 1, curY - 1, photoSize + 2, photoSize + 2).lineWidth(1).strokeColor('#E5E7EB').stroke();

        // Draw photo
        let drawn = false;
        try {
          if (fs.existsSync(filePath)) {
            const imgBuffer = fs.readFileSync(filePath);
            doc.image(imgBuffer, curX, curY, {
              width: photoSize,
              height: photoSize,
              fit: [photoSize, photoSize],
              align: 'center',
              valign: 'center',
            });
            drawn = true;
          }
        } catch { /* fall through */ }

        if (!drawn) {
          doc.rect(curX, curY, photoSize, photoSize).fill('#F3F4F6');
          doc.fillColor('#9CA3AF').fontSize(10).font('Helvetica')
            .text('Photo not available', curX, curY + photoSize / 2 - 5, { width: photoSize, align: 'center' });
        }

        // Photo label centered below
        doc.fontSize(8).fillColor('#6B7280').font('Helvetica')
          .text(`Photo ${i + 1}`, curX, curY + photoSize + 5, { width: photoSize, align: 'center' });

        curX += photoSize + gapX;
      }

      doc.y = curY + photoSize + 35;
    }

    // ─── SECTION 6: EVENT LOGS ───
    doc.x = 50;
    doc.moveDown(1.5);
    if (doc.y > 600) { doc.addPage(); }
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#126027').text('SECTION 6: EVENT LOGS', 50, doc.y, { underline: true });
    doc.moveDown(0.5);

    if (logs.length === 0) {
      doc.fillColor('#666666').fontSize(10).font('Helvetica').text('No logs available for this event.');
    } else {
      const tableTop = doc.y;
      const colWidths = [80, 100, 200, 100];
      const headers = ['Action', 'Reviewer', 'Notes', 'Date'];
      const startX = 50;

      // Table header
      doc.rect(startX, tableTop, colWidths.reduce((a, b) => a + b, 0), 20).fill('#126027');
      doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
      let x = startX;
      for (let i = 0; i < headers.length; i++) {
        doc.text(headers[i], x + 4, tableTop + 6, { width: colWidths[i] - 8 });
        x += colWidths[i];
      }

      // Table rows
      doc.fillColor('#333333').font('Helvetica').fontSize(8);
      let y = tableTop + 22;
      for (let i = 0; i < logs.length; i++) {
        if (y > 720) {
          doc.addPage();
          y = 50;
        }
        const log = logs[i];
        const bgColor = i % 2 === 0 ? '#F9FAFB' : '#FFFFFF';
        doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), 20).fill(bgColor);
        doc.fillColor('#333333');
        const row = [
          log.action,
          log.userName?.substring(0, 20) || 'N/A',
          log.notes?.substring(0, 40) || 'None',
          new Date(log.timestamp).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }) + ' ' + new Date(log.timestamp).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }),
        ];
        x = startX;
        for (let j = 0; j < row.length; j++) {
          doc.text(row[j], x + 4, y + 4, { width: colWidths[j] - 8 });
          x += colWidths[j];
        }
        y += 20;
      }
    }

    // ─── SECTION 7: FOOTER ───
    doc.moveDown(2);
    if (doc.y > 700) { doc.addPage(); }
    const range = doc.bufferedPageRange();
    const totalPages = range.count;
    // Draw footer on every page
    for (let i = range.start; i < range.start + totalPages; i++) {
      doc.switchToPage(i);
      doc.rect(0, doc.page.height - 50, doc.page.width, 50).fill('#126027');
      doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica')
        .text(`Generated by ECOBUD System  |  ${generatedDate}  |  Page ${i - range.start + 1} of ${totalPages}`, 50, doc.page.height - 30, { align: 'center', width: doc.page.width - 100 });
    }

    doc.end();
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── GET /api/reports/events/:id/excel ─── Generate Excel
router.get('/events/:id/excel', authenticateRequest, requireModeratorAccess, async (req, res) => {
  try {
    const data = await getEventReportData(req.params.id);
    if (!data) return res.status(404).json({ message: 'Event not found' });

    const { event, stats, participants } = data;
    const generatedBy = (req as any).auth?.name || 'Admin';
    const generatedDate = new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ECOBUD System';
    workbook.created = new Date();

    // ─── Worksheet 1: Event Information ───
    const ws1 = workbook.addWorksheet('Event Information');
    ws1.columns = [
      { header: 'Field', key: 'field', width: 25 },
      { header: 'Value', key: 'value', width: 60 },
    ];
    ws1.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws1.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF126027' } };

    const infoRows = [
      ['Event Name', event.title],
      ['Event Description', event.description],
      ['Event Location', event.location],
      ['Event Date', new Date(event.startDatetime).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })],
      ['Start Time', new Date(event.startDatetime).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila' })],
      ['End Time', new Date(event.endDatetime).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila' })],
      ['Organizer', event.managedBy.name],
      ['Eco Coins Reward', String(event.ecoCoinsReward)],
      ['EXP Reward', String(event.expReward)],
      ['Capacity', String(event.capacity)],
      ['Generated By', generatedBy],
      ['Date Generated', generatedDate],
    ];
    for (const [field, value] of infoRows) {
      ws1.addRow({ field, value });
    }

    // ─── Worksheet 2: Participant List ───
    const ws2 = workbook.addWorksheet('Participant List');
    ws2.columns = [
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Attendance Status', key: 'attendance', width: 20 },
      { header: 'QR Verification', key: 'qr', width: 18 },
      { header: 'Reward Status', key: 'reward', width: 15 },
      { header: 'Coins Awarded', key: 'coins', width: 15 },
      { header: 'EXP Awarded', key: 'exp', width: 15 },
      { header: 'Joined Date', key: 'joined', width: 20 },
    ];
    ws2.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF126027' } };

    for (const p of participants) {
      ws2.addRow({
        name: p.name || 'N/A',
        email: p.email || 'N/A',
        attendance: p.attendanceStatus,
        qr: p.qrVerification,
        reward: p.rewardStatus,
        coins: p.coinsAwarded,
        exp: p.expAwarded,
        joined: new Date(p.joinedDate).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }),
      });
    }

    // ─── Worksheet 3: Statistics ───
    const ws3 = workbook.addWorksheet('Statistics');
    ws3.columns = [
      { header: 'Metric', key: 'metric', width: 35 },
      { header: 'Value', key: 'value', width: 15 },
    ];
    ws3.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws3.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF126027' } };

    const statRows = [
      ['Total Registered Participants', stats.totalRegistered],
      ['Total Participants Attended', stats.attended],
      ['Total QR Verified', stats.qrVerified],
      ['Total Pending Verification', stats.pendingVerification],
      ['Total Approved', stats.approved],
      ['Total Rejected', stats.rejected],
      ['Total Eco Coins Awarded', stats.totalCoinsAwarded],
      ['Total EXP Awarded', stats.totalExpAwarded],
    ];
    for (const [metric, value] of statRows) {
      ws3.addRow({ metric, value });
    }

    // ─── Worksheet 4: Reward Distribution ───
    const ws4 = workbook.addWorksheet('Reward Distribution');
    ws4.columns = [
      { header: 'Participant', key: 'name', width: 25 },
      { header: 'Eco Coins', key: 'coins', width: 15 },
      { header: 'EXP', key: 'exp', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
    ];
    ws4.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws4.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF126027' } };

    for (const p of participants) {
      if (p.coinsAwarded > 0 || p.expAwarded > 0) {
        ws4.addRow({
          name: p.name || 'N/A',
          coins: p.coinsAwarded,
          exp: p.expAwarded,
          status: p.rewardStatus,
        });
      }
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="ECOBUD-Event-Report-${event.title.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating Excel:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
