import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatMoneyWithEmployeeCurrency,
  getEffectivePayrollExchangeRate,
  normalizeSalaryToBs,
} from '../src/utils/venezuelaLaborCalculations';

test('el recibo conserva la tasa BCV usada por la nómina aunque cambie la tasa actual', () => {
  const payrollRate = 857.57;
  const currentCompanyRate = 900;
  const effectiveRate = getEffectivePayrollExchangeRate(payrollRate, currentCompanyRate);
  const employee = {
    salarioMensualBase: 400 * payrollRate,
    salarioMensualBaseOriginal: 400,
    salarioMoneda: 'USD' as const,
  };

  assert.equal(effectiveRate, payrollRate);
  assert.equal(normalizeSalaryToBs(employee, effectiveRate), 400 * payrollRate);
  assert.equal(formatMoneyWithEmployeeCurrency(400 * payrollRate, 'USD', effectiveRate), '$400.00');
});

test('las nóminas antiguas sin tasa guardada usan la tasa vigente como compatibilidad', () => {
  assert.equal(getEffectivePayrollExchangeRate(undefined, 857.57), 857.57);
});
