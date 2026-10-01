import { PayrollPeriod } from '../types';

export function getPayrollApprovalBlockReason(payroll: PayrollPeriod): string | null {
  if (payroll.archivoBancarioConfirmado) {
    return 'El archivo bancario ya fue confirmado; esta nómina no puede aprobarse ni modificarse.';
  }
  if (payroll.estatus !== 'Calculada') {
    return 'Primero debe recalcular y revisar la nómina para poder aprobarla.';
  }
  if (payroll.items.length === 0) {
    return 'No se puede aprobar una nómina sin colaboradores.';
  }
  if (!Number.isFinite(payroll.tasaBCV_USD) || (payroll.tasaBCV_USD ?? 0) <= 0) {
    return 'La nómina no tiene una tasa BCV válida; recalcúlela antes de aprobarla.';
  }
  return null;
}
