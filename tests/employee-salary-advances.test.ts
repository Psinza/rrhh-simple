import assert from 'node:assert/strict';
import test from 'node:test';
import { EmployeeSalaryAdvance, PayrollPeriod } from '../src/types';
import {
  calculateSalaryAdvancePayrollDeduction,
  getSalaryAdvanceOutstandingBs,
  synchronizeSalaryAdvanceDeductionHistory,
} from '../src/utils/employeeSalaryAdvances';

function makeAdvance(overrides: Partial<EmployeeSalaryAdvance> = {}): EmployeeSalaryAdvance {
  return {
    id: 'advance-1',
    employeeId: 'employee-1',
    employeeName: 'Empleado',
    description: 'Adelanto',
    amountBs: 20_000,
    currency: 'USD',
    amountOriginal: 200,
    createdAt: '2026-09-01T10:00:00.000Z',
    deductionHistory: [],
    ...overrides,
  };
}

function makePayroll(
  status: PayrollPeriod['estatus'],
  advances: NonNullable<PayrollPeriod['items'][number]['adelantosSueldoDetalle']> = [],
): Pick<PayrollPeriod, 'id' | 'nombre' | 'fechaPago' | 'estatus'> & {
  items: Array<Pick<PayrollPeriod['items'][number], 'employeeId' | 'adelantosSueldoDetalle'>>;
} {
  return {
    id: 'payroll-1',
    nombre: '1ra Quincena de Septiembre',
    fechaPago: '2026-09-15',
    estatus: status,
    items: [{ employeeId: 'employee-1', adelantosSueldoDetalle: advances }],
  };
}

test('conserva el saldo de un adelanto USD ante cambios de tasa', () => {
  const advance = makeAdvance({
    deductionHistory: [{
      payrollPeriodId: 'payroll-old',
      payrollPeriodName: 'Nómina anterior',
      paymentDate: '2026-08-31',
      payrollStatus: 'Pagada',
      amountOriginal: 10,
      currency: 'USD',
      amountBs: 1_000,
      exchangeRate: 100,
    }],
  });

  assert.equal(getSalaryAdvanceOutstandingBs(advance, 120), 22_800);
});

test('limita el adelanto al neto disponible y calcula su equivalente original', () => {
  const deduction = calculateSalaryAdvancePayrollDeduction(makeAdvance(), 'payroll-1', 100, 750);

  assert.deepEqual(deduction, { amountOriginal: 7.5, amountBs: 750, currency: 'USD' });
});

test('excluye la deducción del período al recalcularlo', () => {
  const advance = makeAdvance({
    deductionHistory: [{
      payrollPeriodId: 'payroll-1',
      payrollPeriodName: 'Nómina actual',
      paymentDate: '2026-09-15',
      payrollStatus: 'Calculada',
      amountOriginal: 20,
      currency: 'USD',
      amountBs: 2_000,
      exchangeRate: 100,
    }],
  });

  assert.equal(getSalaryAdvanceOutstandingBs(advance, 100, 'payroll-1'), 20_000);
});

test('sincroniza deducciones idempotentemente y conserva las de nóminas aprobadas', () => {
  const advance = makeAdvance();
  const deduction = {
    advanceId: advance.id,
    description: advance.description,
    amountOriginal: 5,
    currency: 'USD' as const,
    amountBs: 500,
  };
  const calculated = synchronizeSalaryAdvanceDeductionHistory(
    [advance],
    makePayroll('Calculada', [deduction]),
    100,
  );
  const repeated = synchronizeSalaryAdvanceDeductionHistory(
    calculated,
    makePayroll('Calculada', [deduction]),
    100,
  );

  assert.equal(repeated[0].deductionHistory.length, 1);

  const approved = synchronizeSalaryAdvanceDeductionHistory(
    repeated,
    makePayroll('Aprobada'),
    100,
  );
  assert.deepEqual(approved[0].deductionHistory, repeated[0].deductionHistory);
});
