import test from 'node:test';
import assert from 'node:assert/strict';
import { EmployeeLoan, PayrollPeriod } from '../src/types';
import {
  calculateLoanPayrollDeduction,
  getLoanOutstandingBs,
  isLoanPrincipalProductDeduction,
  synchronizeLoanDeductionHistory,
} from '../src/utils/employeeLoanDeductions';

const loan: EmployeeLoan = {
  id: 'loan-1',
  employeeId: 'emp-1',
  employeeName: 'Antonio Mota',
  description: 'Préstamo',
  principalBs: 171400,
  currency: 'USD',
  principalOriginal: 200,
  installmentBs: 17140,
  installmentCurrency: 'USD',
  installmentOriginal: 20,
  outstandingBs: 171400,
  status: 'Activo',
  createdAt: '2026-08-01',
};

test('identifica el principal del préstamo cargado como producto, no una compra real', () => {
  assert.equal(isLoanPrincipalProductDeduction('emp-1', 'PRESTAMO', 171400, [loan]), true);
  assert.equal(isLoanPrincipalProductDeduction('emp-2', 'PRESTAMO', 171400, [loan]), false);
  assert.equal(isLoanPrincipalProductDeduction('emp-1', 'Uniforme', 171400, [loan]), false);
});

test('guarda la deducción ligada a la nómina y sustituye su registro al recalcular', () => {
  const payroll = {
    id: 'payroll-aug-2',
    nombre: '2da Quincena de Agosto 2026',
    fechaPago: '2026-08-30',
    estatus: 'Calculada',
    items: [{
      employeeId: 'emp-1',
      prestamosAnticiposDetalle: [{
        loanId: 'loan-1',
        description: 'Préstamo',
        amountOriginal: 20,
        currency: 'USD',
        amountBs: 17140,
      }],
    }],
  } satisfies Pick<PayrollPeriod, 'id' | 'nombre' | 'fechaPago' | 'estatus'> & {
    items: { employeeId: string; prestamosAnticiposDetalle: NonNullable<PayrollPeriod['items'][number]['prestamosAnticiposDetalle']> }[];
  };

  const firstCalculation = synchronizeLoanDeductionHistory([loan], payroll, 857);
  assert.equal(firstCalculation[0].deductionHistory?.length, 1);
  assert.equal(firstCalculation[0].deductionHistory?.[0].payrollPeriodName, '2da Quincena de Agosto 2026');
  assert.equal(firstCalculation[0].deductionHistory?.[0].exchangeRate, 857);
  assert.equal(firstCalculation[0].outstandingBs, 154260);

  const recalculatedPayroll = {
    ...payroll,
    items: [{
      ...payroll.items[0],
      prestamosAnticiposDetalle: [{
        ...payroll.items[0].prestamosAnticiposDetalle[0],
        amountOriginal: 10,
        amountBs: 8570,
      }],
    }],
  };
  const recalculated = synchronizeLoanDeductionHistory(firstCalculation, recalculatedPayroll, 857);

  assert.equal(recalculated[0].deductionHistory?.length, 1);
  assert.equal(recalculated[0].deductionHistory?.[0].amountBs, 8570);
  assert.equal(recalculated[0].outstandingBs, 162830);

  const withoutDeduction = synchronizeLoanDeductionHistory(recalculated, {
    ...recalculatedPayroll,
    items: [{ employeeId: 'emp-1', prestamosAnticiposDetalle: [] }],
  }, 857);
  assert.equal(withoutDeduction[0].deductionHistory?.length, 0);
  assert.equal(withoutDeduction[0].outstandingBs, 171400);
});

test('no modifica el historial de deducciones de una nómina ya aprobada', () => {
  const existingApprovedDeduction = {
    ...loan,
    deductionHistory: [{
      payrollPeriodId: 'payroll-aug-2',
      payrollPeriodName: '2da Quincena de Agosto 2026',
      paymentDate: '2026-08-30',
      payrollStatus: 'Aprobada' as const,
      amountOriginal: 20,
      currency: 'USD' as const,
      amountBs: 17140,
      exchangeRate: 857,
    }],
  };
  const approvedPayroll = {
    id: 'payroll-aug-2',
    nombre: '2da Quincena de Agosto 2026',
    fechaPago: '2026-08-30',
    estatus: 'Aprobada',
    items: [{
      employeeId: 'emp-1',
      prestamosAnticiposDetalle: [{
        loanId: 'loan-1',
        description: 'Préstamo',
        amountOriginal: 10,
        currency: 'USD',
        amountBs: 8570,
      }],
    }],
  } satisfies Pick<PayrollPeriod, 'id' | 'nombre' | 'fechaPago' | 'estatus'> & {
    items: { employeeId: string; prestamosAnticiposDetalle: NonNullable<PayrollPeriod['items'][number]['prestamosAnticiposDetalle']> }[];
  };

  const result = synchronizeLoanDeductionHistory([existingApprovedDeduction], approvedPayroll, 857);
  assert.deepEqual(result[0], existingApprovedDeduction);
});

test('convierte la cuota USD con la tasa BCV vigente y conserva el saldo en moneda original', () => {
  const legacyLoan: EmployeeLoan = {
    ...loan,
    principalBs: 9100,
    installmentBs: 1365,
    outstandingBs: 7735,
    installmentOriginal: 30,
    deductionHistory: [{
      payrollPeriodId: 'previous-payroll',
      payrollPeriodName: 'Nómina anterior',
      paymentDate: '2026-08-30',
      payrollStatus: 'Aprobada',
      amountOriginal: 30,
      currency: 'USD',
      amountBs: 1365,
      exchangeRate: 45.5,
    }],
  };

  const deduction = calculateLoanPayrollDeduction(legacyLoan, 'current-payroll', 857);
  assert.equal(deduction.currency, 'USD');
  assert.equal(deduction.amountOriginal, 30);
  assert.equal(deduction.amountBs, 25710);
  assert.equal(getLoanOutstandingBs(legacyLoan, 857), 145690);

  const payroll = {
    id: 'current-payroll',
    nombre: 'Nómina actual',
    fechaPago: '2026-09-15',
    estatus: 'Calculada',
    items: [{
      employeeId: 'emp-1',
      prestamosAnticiposDetalle: [{
        loanId: 'loan-1',
        description: 'Préstamo',
        amountOriginal: deduction.amountOriginal,
        currency: deduction.currency,
        amountBs: deduction.amountBs,
      }],
    }],
  } satisfies Pick<PayrollPeriod, 'id' | 'nombre' | 'fechaPago' | 'estatus'> & {
    items: { employeeId: string; prestamosAnticiposDetalle: NonNullable<PayrollPeriod['items'][number]['prestamosAnticiposDetalle']> }[];
  };

  const updatedLoan = synchronizeLoanDeductionHistory([legacyLoan], payroll, 857)[0];
  assert.equal(updatedLoan.outstandingBs, 119980);
});
