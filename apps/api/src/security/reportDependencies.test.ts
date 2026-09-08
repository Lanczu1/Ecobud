import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
describe('patched report dependencies', () => {
  it('writes and reads an Excel report including conditional formatting', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Report');
    sheet.addRow(['Points']); sheet.addRow([100]);
    sheet.addConditionalFormatting({ ref: 'A2', rules: [{ type: 'dataBar', priority: 1, cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: 'FF00AA00' } }] });
    const bytes = await workbook.xlsx.writeBuffer();
    const restored = new ExcelJS.Workbook(); await restored.xlsx.load(bytes);
    expect(restored.getWorksheet('Report')?.getCell('A2').value).toBe(100);
  });
});
