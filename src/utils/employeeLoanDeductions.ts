import { EmployeeLoan, MoneyCurrency, PayrollItem, PayrollPeriod } from '../types';
import { convertAmountToBaseCurrency } from './venezuelaLaborCalculations';

type PayrollDeductionSource = Pick<PayrollPeriod, 'id' | 'nombre' | 'fechaPago' | 'estatus'> & {
  items: Pick<PayrollItem, 'employeeId' | 'prestamosAnticiposDetalle'>[];
};

function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase();
}

export function isLoanPrincipalProductDeduction(
  employeeId: string,
  label: string,
  amountBs: number,
  loans: EmployeeLoan[],
): boolean {
  const normalizedLabel = normalizeText(label);
  const isLoanLabel = /\bprestamo\b/.test(normalizedLabel);

  return loans.some((loan) => (
    loan.employeeId === employeeId
    && Math.abs(loan.principalBs - amountBs) < 0.01
    && (isLoanLabel || normalizedLabel === normalizeText(loan.description))
  ));
}

function getDeductionAmountInLoanCurrency(
  amount: EmployeeLoan['deductionHistory'][number],
  loanCurrency: MoneyCurrency,
  exchangeRate: number,
): number {
  if (amount.currency === loanCurrency) return amount.amountOriginal;
  if (loanCurrency === 'USD') {
    const historicalRate = amount.exchangeRate || exchangeRate;
    return historicalRate > 0 ? amount.amountBs / historicalRate : 0;
  }
  return amount.amountBs;
}

export function getLoanOutstandingBs(
  loan: EmployeeLoan,
  exchangeRate: number,
  excludingPayrollPeriodId?: string,
): number {
  const currentPayrollDeduction = loan.deductionHistory?.find(
    (entry) => entry.payrollPeriodId === excludingPayrollPeriodId,
  );
  const hasOriginalPrincipal = Number.isFinite(loan.principalOriginal)
    && (loan.principalOriginal || 0) >= 0;

  if (!hasOriginalPrincipal) {
    return Math.max(0, loan.outstandingBs + (currentPayrollDeduction?.amountBs || 0));
  }

  const loanCurrency = loan.currency || 'BS';
  const totalDeductedOriginal = (loan.deductionHistory || [])
    .filter((entry) => entry.payrollPeriodId !== excludingPayrollPeriodId)
    .reduce(
      (total, entry) => total + getDeductionAmountInLoanCurrency(entry, loanCurrency, exchangeRate),
      0,
    );
  const outstandingOriginal = Math.max(0, (loan.principalOriginal || 0) - totalDeductedOriginal);

  return loanCurrency === 'USD'
    ? convertAmountToBaseCurrency(outstandingOriginal, loanCurrency, exchangeRate)
    : outstandingOriginal;
}

export function calculateLoanPayrollDeduction(
  loan: EmployeeLoan,
  payrollPeriodId: string,
  exchangeRate: number,
): { amountOriginal: number; amountBs: number; currency: MoneyCurrency } {
  const currency = loan.installmentCurrency || 'BS';
  const installmentOriginal = loan.installmentOriginal ?? loan.installmentBs;
  const availableBalanceBs = getLoanOutstandingBs(loan, exchangeRate, payrollPeriodId);
  const installmentBs = convertAmountToBaseCurrency(installmentOriginal, currency, exchangeRate);
  const amountBs = Math.min(installmentBs, availableBalanceBs);
  const amountOriginal = currency === 'USD' && exchangeRate > 0
    ? amountBs / exchangeRate
    : amountBs;

  return { amountOriginal, amountBs, currency };
}

export function synchronizeLoanDeductionHistory(
  loans: EmployeeLoan[],
  payroll: PayrollDeductionSource,
  exchangeRate: number,
): EmployeeLoan[] {
  const deductionsByLoanId = new Map<string, EmployeeLoan['deductionHistory'][number]>();

  for (const item of payroll.items) {
    for (const deduction of item.prestamosAnticiposDetalle || []) {
      if (deduction.amountBs <= 0) continue;
      deductionsByLoanId.set(deduction.loanId, {
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

  return loans.map((loan) => {
    const existingCurrentPeriodDeduction = (loan.deductionHistory || []).find(
      (entry) => entry.payrollPeriodId === payroll.id,
    );
    if (payroll.estatus === 'Aprobada' && existingCurrentPeriodDeduction) {
      return loan;
    }

    const historyWithoutCurrentPeriod = (loan.deductionHistory || [])
      .filter((entry) => entry.payrollPeriodId !== payroll.id);
    const currentDeduction = deductionsByLoanId.get(loan.id);
    const deductionHistory = currentDeduction
      ? [...historyWithoutCurrentPeriod, currentDeduction]
      : historyWithoutCurrentPeriod;
    return {
      ...loan,
      deductionHistory,
      outstandingBs: getLoanOutstandingBs({ ...loan, deductionHistory }, exchangeRate),
    };
  });
}
