import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convertAmountToBaseCurrency,
  calculatePayrollDeductionsAndContributions,
  normalizeSalaryToBs,
  normalizeImportedEmployeeSalaries,
  canDeclareIntegralSalary,
  getMondayDate,
  countWeekdaysInRange,
} from '../src/utils/venezuelaLaborCalculations.ts';
import { buildBankTransferTxt, buildBankTransferCsv, buildPayrollSummaryCsv } from '../src/utils/payrollExports.ts';

test('convertAmountToBaseCurrency converts USD to Bs using BCV rate', () => {
  assert.equal(convertAmountToBaseCurrency(100, 'USD', 45.5), 4550);
  assert.equal(convertAmountToBaseCurrency(1000, 'BS', 45.5), 1000);
  assert.equal(convertAmountToBaseCurrency(250, 'USD', 0), 250);
});

test('weekly date helpers normalize to Monday and count Monday through Friday only', () => {
  assert.equal(getMondayDate('2026-10-04'), '2026-09-28');
  assert.equal(countWeekdaysInRange('2026-09-28', '2026-10-02'), 5);
  assert.equal(countWeekdaysInRange('2026-10-03', '2026-10-04'), 0);
});

test('weekly payroll pays one quarter of the monthly salary and reflects the current BCV rate', () => {
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

  assert.equal(slip.sueldoBasePeriodo, (280 * 45.5) / 4);
  assert.ok(Math.abs(slip.netoCobrarUSD - 70) < 0.01);
});

test('weekly payroll pays the expected $50 installment for a $200 monthly salary', () => {
  const exchangeRate = 866.56;
  const employee = {
    salarioMensualBase: 200 * exchangeRate,
    salarioMoneda: 'USD',
    porcentajeRetencionISLR: 0,
    cestaticketAplica: false,
  };
  const company = {
    tasaBCV_USD: exchangeRate,
    lunesDelMesActual: 4,
    salarioMinimoNacional: 130,
    nivelRiesgoIVSS: 10,
    montoCestaticketNacional: 0,
  };

  const slip = calculatePayrollDeductionsAndContributions(
    employee, company, 'semanal', 0, 0, 0, 0, 0, 0, false, 0, 0, 5
  );

  assert.equal(slip.diasTrabajados, 5);
  assert.equal(slip.sueldoBasePeriodo, 43328);
  assert.equal(slip.netoCobrarBs, 43328);
  assert.equal(slip.netoCobrarUSD, 50);
});

test('weekly payroll includes absence and cash advance deductions in the net', () => {
  const employee = {
    salarioMensualBase: 3000,
    salarioMoneda: 'BS',
    porcentajeRetencionISLR: 0,
    cestaticketAplica: false,
  };
  const company = {
    tasaBCV_USD: 30,
    lunesDelMesActual: 4,
    salarioMinimoNacional: 130,
    nivelRiesgoIVSS: 10,
    montoCestaticketNacional: 0,
  };

  const slip = calculatePayrollDeductionsAndContributions(
    employee, company, 'semanal', 0, 0, 0, 0, 100, 0, false, 200, 50
  );

  assert.equal(slip.sueldoBasePeriodo, 750);
  assert.equal(slip.deduccionInasistencias, 200);
  assert.equal(slip.adelantoEfectivo, 50);
  assert.equal(slip.totalDeducciones, 350);
  assert.equal(slip.netoCobrarBs, 400);
});

test('normalizeSalaryToBs converts legacy raw USD salary once and keeps already-normalized values stable', () => {
  const exchangeRate = 45.5;

  assert.equal(normalizeSalaryToBs({ salarioMensualBase: 280, salarioMoneda: 'USD' }, exchangeRate), 12740);
  assert.equal(normalizeSalaryToBs({ salarioMensualBase: 500, salarioMoneda: 'USD' }, exchangeRate), 22750);
  assert.equal(normalizeSalaryToBs({ salarioMensualBase: 12740, salarioMoneda: 'USD' }, exchangeRate), 12740);
  assert.equal(normalizeSalaryToBs({ salarioMensualBase: 12740, salarioMoneda: 'BS' }, exchangeRate), 12740);
});

test('normalizeSalaryToBs preserves imported USD salary when its stored Bs equivalent uses an older rate', () => {
  const employee = {
    salarioMensualBase: 86656,
    salarioMoneda: 'USD',
    salarioMensualUSD: 200,
  };

  assert.equal(normalizeSalaryToBs(employee, 900), 180000);
  assert.equal(normalizeSalaryToBs(employee, 900) / 900, 200);
});

test('JSON restore infers USD salaries from the backup rate when legacy data has no USD source field', () => {
  const restored = normalizeImportedEmployeeSalaries([
    { salarioMensualBase: 86656, salarioMoneda: 'USD' },
    { salarioMensualBase: 200, salarioMoneda: 'USD' },
  ], 866.56);

  assert.equal(restored[0].salarioMensualUSD, 100);
  assert.equal(restored[0].salarioMensualBase, 86656);
  assert.equal(normalizeSalaryToBs(restored[0], 900) / 900, 100);
  assert.equal(restored[1].salarioMensualUSD, 200);
  assert.equal(restored[1].salarioMensualBase, 173312);
});

test('integral salary declaration is disabled when the employee does not receive cestaticket', () => {
  assert.equal(canDeclareIntegralSalary({ cestaticketAplica: false }), false);
  assert.equal(canDeclareIntegralSalary({ cestaticketAplica: true }), true);
  assert.equal(canDeclareIntegralSalary({}), true);
});

test('bank TXT has fixed 46-character records and uses net amounts in Bs', () => {
  const employee = {
    primerNombre: 'Erianny', primerApellido: 'Bernal', nacionalidad: 'V',
    cedula: 'V-30.481.922', numeroCuenta: '01910098792198270707',
    departamento: 'Administración', cargo: 'Auxiliar de Oficina',
  };
  const items = [{ employee, netoCobrarBs: 145690, netoCobrarUSD: 14569, sueldoBasePeriodo: 145690 }];
  const lines = buildBankTransferTxt(items, '01911234567898745632', 'J', '409644669').split('\r\n');

  assert.equal(lines.length, 2);
  assert.ok(lines.every((line) => line.length === 46));
  assert.ok(lines[0].startsWith('ND01911234567898745632'));
  assert.ok(lines[1].startsWith('NC01910098792198270707'));
  assert.ok(lines[1].endsWith('V030481922'));
  assert.match(lines[1], /00000014569000/);
});

test('bank spreadsheet and payroll summary CSV include headers, totals, and both currencies', () => {
  const employee = {
    primerNombre: 'Erianny', primerApellido: 'Bernal', nacionalidad: 'V',
    cedula: 'V-30.481.922', numeroCuenta: '01910098792198270707',
    departamento: 'Administración', cargo: 'Auxiliar de Oficina',
  };
  const items = [{ employee, netoCobrarBs: 145690, netoCobrarUSD: 14569, sueldoBasePeriodo: 145690 }];
  const payroll = { nombre: 'Semana de prueba' };
  const bankCsv = buildBankTransferCsv(items, 10, '01911234567898745632', 'J', '409644669');
  const summaryCsv = buildPayrollSummaryCsv(items, payroll, 10);

  assert.match(bankCsv, /NOMBRE.*MONTO \(Bs\.\).*N\. CUENTA/);
  assert.match(bankCsv, /TOTAL TRANSFERENCIA/);
  assert.match(bankCsv, /ND01911234567898745632/);
  assert.match(summaryCsv, /Sueldo base \(USD\).*Neto \(USD\)/);
  assert.match(summaryCsv, /14569\.00/);
});
