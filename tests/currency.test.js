import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convertAmountToBaseCurrency,
  calculatePayrollDeductionsAndContributions,
  normalizeSalaryToBs,
  canDeclareIntegralSalary,
} from '../src/utils/venezuelaLaborCalculations.ts';

test('convertAmountToBaseCurrency converts USD to Bs using BCV rate', () => {
  assert.equal(convertAmountToBaseCurrency(100, 'USD', 45.5), 4550);
  assert.equal(convertAmountToBaseCurrency(1000, 'BS', 45.5), 1000);
  assert.equal(convertAmountToBaseCurrency(250, 'USD', 0), 250);
});

test('weekly payroll keeps the 4-week salary rule and reflects the current BCV rate', () => {
  const employee = {
    id: 'emp-1',
    salarioMensualBase: 280 * 45.5,
    salarioMoneda: 'USD',
    porcentajeRetencionISLR: 0,
    cestaticketAplica: false,
    viaticosPendientes: 0,
    viaticosPendientesOriginal: 0,
    viaticosMoneda: 'BS',
  };

  const company = {
    tasaBCV_USD: 45.5,
    lunesDelMesActual: 4,
    salarioMinimoNacional: 130,
    nivelRiesgoIVSS: 10,
    montoCestaticketNacional: 0,
  };

  const slip = calculatePayrollDeductionsAndContributions(
    employee,
    company,
    'semanal',
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    false
  );

  assert.equal(slip.sueldoBasePeriodo, 3185);
  assert.ok(Math.abs(slip.netoCobrarUSD - 70) < 0.01);
});

test('normalizeSalaryToBs converts legacy raw USD salary once and keeps already-normalized values stable', () => {
  const exchangeRate = 45.5;

  assert.equal(normalizeSalaryToBs({ salarioMensualBase: 280, salarioMoneda: 'USD' }, exchangeRate), 12740);
  assert.equal(normalizeSalaryToBs({ salarioMensualBase: 500, salarioMoneda: 'USD' }, exchangeRate), 22750);
  assert.equal(normalizeSalaryToBs({ salarioMensualBase: 12740, salarioMoneda: 'USD' }, exchangeRate), 12740);
  assert.equal(normalizeSalaryToBs({ salarioMensualBase: 12740, salarioMoneda: 'BS' }, exchangeRate), 12740);
});

test('integral salary declaration is disabled when the employee does not receive cestaticket', () => {
  assert.equal(canDeclareIntegralSalary({ cestaticketAplica: false }), false);
  assert.equal(canDeclareIntegralSalary({ cestaticketAplica: true }), true);
  assert.equal(canDeclareIntegralSalary({}), true);
});
