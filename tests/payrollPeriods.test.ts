import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCompanySettings } from '../src/data/initialData';
import { createPayrollPeriod } from '../src/utils/payrollPeriods';

test('crea una quincena de septiembre que contiene las novedades del 28/09', () => {
  const payroll = createPayrollPeriod(initialCompanySettings, [], 2026, 9, 'second');

  assert.equal(payroll.id, 'period-2026-09-q2');
  assert.equal(payroll.nombre, '2da Quincena de Septiembre 2026');
  assert.equal(payroll.fechaInicio, '2026-09-16');
  assert.equal(payroll.fechaFin, '2026-09-30');
  assert.equal(payroll.fechaPago, '2026-09-30');
  assert.equal(payroll.estatus, 'Borrador');
  assert.equal(payroll.archivoBancarioConfirmado, false);
});

test('crea correctamente la primera quincena de febrero en año bisiesto', () => {
  const payroll = createPayrollPeriod(initialCompanySettings, [], 2028, 2, 'first');

  assert.equal(payroll.fechaInicio, '2028-02-01');
  assert.equal(payroll.fechaFin, '2028-02-15');
  assert.equal(payroll.tipo, '1ra Quincena');
});

test('rechaza meses inválidos en vez de crear un período mal formado', () => {
  assert.throws(
    () => createPayrollPeriod(initialCompanySettings, [], 2026, 13, 'second'),
    /mes del período/,
  );
});
