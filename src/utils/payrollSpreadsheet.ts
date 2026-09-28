import type { PayrollItem } from '../types';
import { buildBankPayrollFile, type BankPayrollExportInput } from './bankPayrollFile';

function csvCell(value: string | number): string {
  const text = String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function formatExcelAmount(value: number): string {
  return new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(Number(value) || 0);
}

export function buildPayrollSummaryCsv(items: PayrollItem[]): string {
  const rows: (string | number)[][] = [
    ['Departamento', 'Empleado', 'Cédula', 'Cargo', 'Sueldo base (Bs.)', 'Neto (Bs.)'],
    ...items.map((item) => [
      item.employee.departamento,
      `${item.employee.primerNombre} ${item.employee.primerApellido}`.trim(),
      item.employee.cedula,
      item.employee.cargo,
      formatExcelAmount(item.sueldoBasePeriodo),
      formatExcelAmount(item.netoCobrarBs),
    ]),
    ['TOTAL', '', '', '', formatExcelAmount(items.reduce((sum, item) => sum + item.sueldoBasePeriodo, 0)), formatExcelAmount(items.reduce((sum, item) => sum + item.netoCobrarBs, 0))],
  ];

  return `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}\r\n`;
}

export function downloadPayrollSummaryCsv(items: PayrollItem[], payrollName: string): void {
  const blob = new Blob([buildPayrollSummaryCsv(items)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `resumen-nomina-${payrollName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function buildBankPayrollWorkbook(
  payroll: { items: PayrollItem[] },
  input: BankPayrollExportInput
): Promise<Uint8Array> {
  const { default: ExcelJS } = await import('exceljs');
  const bankFile = buildBankPayrollFile(payroll, input);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('PAGO BANCARIO');
  const rows = bankFile.content.trimEnd().split('\r\n');
  const tableEndRow = bankFile.transferredItems.length + 2;

  sheet.columns = [
    { key: 'name', width: 27 },
    { key: 'amount', width: 18 },
    { key: 'account', width: 23 },
    { key: 'nationality', width: 8 },
    { key: 'identifier', width: 14 },
    { key: 'spacer', width: 3 },
    { key: 'bankRecord', width: 54 },
  ];

  sheet.getCell('G1').value = 'BLOCK DE NOTAS ARCHIVO TXT';
  sheet.getCell('G1').font = { bold: true, size: 10 };
  sheet.getCell('G1').alignment = { horizontal: 'center', vertical: 'middle' };

  const headers = ['NOMBRE', 'MONTO', 'N. CUENTA', 'NAC', 'CI'];
  headers.forEach((header, index) => {
    const cell = sheet.getCell(1, index + 1);
    cell.value = header;
    cell.font = { bold: true, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  bankFile.transferredItems.forEach((item, index) => {
    const rowNumber = index + 2;
    const employee = item.employee;
    sheet.getCell(rowNumber, 1).value = `${employee.primerNombre} ${employee.primerApellido}`.trim();
    sheet.getCell(rowNumber, 2).value = item.netoCobrarBs;
    sheet.getCell(rowNumber, 2).numFmt = '#,##0.00';
    sheet.getCell(rowNumber, 3).value = employee.numeroCuenta.replace(/\D/g, '');
    sheet.getCell(rowNumber, 3).numFmt = '@';
    sheet.getCell(rowNumber, 4).value = employee.nacionalidad || 'V';
    sheet.getCell(rowNumber, 5).value = employee.cedula.replace(/\D/g, '').padStart(9, '0');
    sheet.getCell(rowNumber, 5).numFmt = '@';
  });

  const totalRow = bankFile.transferredItems.length + 2;
  const totalCell = sheet.getCell(totalRow, 1);
  totalCell.value = 'TOTAL TRANSFERENCIA';
  totalCell.font = { bold: true };
  sheet.getCell(totalRow, 2).value = bankFile.transferredItems.reduce((sum, item) => sum + item.netoCobrarBs, 0);
  sheet.getCell(totalRow, 2).numFmt = '#,##0.00';
  sheet.getCell(totalRow, 2).font = { bold: true };

  for (let rowNumber = 1; rowNumber <= tableEndRow; rowNumber += 1) {
    for (let columnNumber = 1; columnNumber <= 5; columnNumber += 1) {
      const cell = sheet.getCell(rowNumber, columnNumber);
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
      if (columnNumber === 2 && rowNumber > 1) {
        cell.alignment = { horizontal: 'right' };
      }
    }

  }

  rows.forEach((line, index) => {
    const record = sheet.getCell(index + 2, 7);
    record.value = line;
    record.font = { name: 'Consolas', size: 9 };
    record.alignment = { horizontal: 'left', vertical: 'middle' };
  });

  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

export async function downloadBankPayrollWorkbook(
  payroll: { items: PayrollItem[] },
  input: BankPayrollExportInput,
  payrollName: string
): Promise<void> {
  const bytes = await buildBankPayrollWorkbook(payroll, input);
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `nomina-bancaria-${payrollName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}