import { Router } from 'express';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { AuthenticatedRequest } from '../http/authentication';
import { errorBoundary } from '../http/errorResponder';
import { getBarangayReport } from '../services/barangayReports';

export const barangayReportRoutes = Router();
barangayReportRoutes.get('/', errorBoundary<AuthenticatedRequest>(async (req, res) => {
  res.json(await getBarangayReport(req.auth!, req.query));
}));
for (const format of ['pdf', 'excel']) {
  barangayReportRoutes.get(`/${format}`, errorBoundary<AuthenticatedRequest>(async (req, res) => {
    const report = await getBarangayReport(req.auth!, req.query);
    const filename = `ECOBUD-${report.barangay ?? 'All-Barangays'}-${report.from}-${report.to}`;
    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 45, size: 'A4' });
      res.type('application/pdf').attachment(`${filename}.pdf`);
      doc.pipe(res);
      doc.fontSize(20).text('ECOBUD Barangay Report');
      doc.fontSize(12).text(`${report.barangay ?? 'All barangays'} | ${report.from} to ${report.to} (Asia/Manila)`);
      doc.fontSize(9).text(`Generated: ${report.generatedAt}`);
      for (const section of report.sections) {
        doc.moveDown().fontSize(14).text(section.title);
        for (const [label, value] of Object.entries(section.metrics)) doc.fontSize(10).text(`${label}: ${value}`);
        if (section.title === 'Announcements') for (const item of report.announcements) doc.fontSize(10).text(`${item.title} | ${item.status} | ${item.publishedAt.slice(0, 10)}`);
      }
      doc.moveDown().fontSize(9).text(report.notes);
      doc.end();
    } else {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Barangay Report');
      sheet.columns = [{ header: 'Section', key: 'section', width: 28 }, { header: 'Metric', key: 'metric', width: 48 }, { header: 'Value', key: 'value', width: 24 }];
      sheet.addRow({ section: 'Scope', metric: report.barangay ?? 'All barangays', value: `${report.from} to ${report.to}` });
      sheet.addRow({ section: 'Generated (UTC)', metric: report.generatedAt });
      for (const section of report.sections) for (const [metric, value] of Object.entries(section.metrics)) sheet.addRow({ section: section.title, metric, value });
      sheet.addRow({ section: 'Definitions', metric: report.notes });
      const announcements = workbook.addWorksheet('Announcements (latest 20)');
      announcements.columns = [{ header: 'Title', key: 'title', width: 50 }, { header: 'Category', key: 'category', width: 25 }, { header: 'Status', key: 'status', width: 20 }, { header: 'Published (UTC)', key: 'publishedAt', width: 30 }];
      for (const item of report.announcements) announcements.addRow(item);
      res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').attachment(`${filename}.xlsx`);
      await workbook.xlsx.write(res);
      res.end();
    }
  }));
}
