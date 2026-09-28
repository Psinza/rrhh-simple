import type { PayrollItem } from '../types';

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