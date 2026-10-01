import { EmployeeSalaryAdvance, MoneyCurrency, PayrollItem, PayrollPeriod } from '../types';
import { convertAmountToBaseCurrency } from './venezuelaLaborCalculations';

type PayrollAdvanceSource = Pick<PayrollPeriod, 'id' | 'nombre' | 'fechaPago' | 'estatus'> & {
  items: Pick<PayrollItem, 'employeeId' | 'adelantosSueldoDetalle'>[];
};

export function getSalaryAdvanceOutstandingBs(
  advance: EmployeeSalaryAdvance,
  exchangeRate: number,
  excludingPayrollPeriodId?: string,
): number {
  const currency = advance.currency || 'BS';
  const deductedOriginal = (advance.deductionHistory || [])
    .filter((entry) => entry.payrollPeriodId !== excludingPayrollPeriodId)
    .reduce((total, entry) => {
      if (entry.currency === currency) return total + entry.amountOriginal;
      if (currency === 'USD') {
        const historicalRate = entry.exchangeRate || exchangeRate;
        return total + (historicalRate > 0 ? entry.amountBs / historicalRate : 0);
      }
      return total + entry.amountBs;
    }, 0);
  const outstandingOriginal = Math.max(0, advance.amountOriginal - deductedOriginal);
  return convertAmountToBaseCurrency(outstandingOriginal, currency, exchangeRate);
}

export function calculateSalaryAdvancePayrollDeduction(
  advance: EmployeeSalaryAdvance,
  payrollPeriodId: string,
  exchangeRate: number,
  maximumDeductionBs: number,
): { amountOriginal: number; amountBs: number; currency: MoneyCurrency } {
  const amountBs = Math.min(
    getSalaryAdvanceOutstandingBs(advance, exchangeRate, payrollPeriodId),
    Math.max(0, maximumDeductionBs),
  );
  return {
    amountOriginal: advance.currency === 'USD' && exchangeRate > 0
      ? amountBs / exchangeRate
      : amountBs,
    amountBs,
    currency: advance.currency,
  };
}

export function synchronizeSalaryAdvanceDeductionHistory(
  advances: EmployeeSalaryAdvance[],
  payroll: PayrollAdvanceSource,
  exchangeRate: number,
): EmployeeSalaryAdvance[] {
  const deductionsByAdvanceId = new Map<string, EmployeeSalaryAdvance['deductionHistory'][number]>();

  for (const item of payroll.items) {
    for (const deduction of item.adelantosSueldoDetalle || []) {
      if (deduction.amountBs <= 0) continue;
      deductionsByAdvanceId.set(deduction.advanceId, {
        payrollPeriodId: payroll.id,
        payrollPeriodName: payroll.nombre,
        paymentDate: payroll.fechaPago,
        payrollStatus: payroll.estatus,
        amountOriginal: deduction.amountOriginal,
        currency: deduction.currency,
        amountBs: deduction.amountBs,
        exchangeRate,
      });
    }
  }

  return advances.map((advance) => {
    const deductionHistoryBefore = advance.deductionHistory || [];
    const existingCurrentPeriodDeduction = deductionHistoryBefore.find(
      (entry) => entry.payrollPeriodId === payroll.id,
    );
    if (payroll.estatus === 'Aprobada' && existingCurrentPeriodDeduction) return advance;

    const historyWithoutCurrentPeriod = deductionHistoryBefore.filter(
      (entry) => entry.payrollPeriodId !== payroll.id,
    );
    const currentDeduction = deductionsByAdvanceId.get(advance.id);
    const deductionHistory = currentDeduction
      ? [...historyWithoutCurrentPeriod, currentDeduction]
      : historyWithoutCurrentPeriod;
    return { ...advance, deductionHistory };
  });
}
