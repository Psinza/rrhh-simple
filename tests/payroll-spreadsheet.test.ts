import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPayrollSummaryCsv } from '../src/utils/payrollSpreadsheet';
import type { PayrollItem } from '../src/types';

const item = {
  employee: {
    departamento: 'Producción',
    primerNombre: 'José "Pepe"',
    primerApellido: 'Pérez',
    cedula: 'V-12345678',
    cargo: 'Operador; turno A',
  },
  sueldoBasePeriodo: 57847.5,
  netoCobrarBs: 57847.5,
} as PayrollItem;

test('genera CSV compatible con Excel con datos escapados y total de nómina', () => {
  const csv = buildPayrollSummaryCsv([item]);
  const rows = csv.replace(/^\uFEFF/, '').trim().split('\r\n');

  assert.equal(rows.length, 3);
  assert.equal(rows[0], '"Departamento";"Empleado";"Cédula";"Cargo";"Sueldo base (Bs.)";"Neto (Bs.)"');
  assert.equal(rows[1], '"Producción";"José ""Pepe"" Pérez";"V-12345678";"Operador; turno A";"57.847,50";"57.847,50"');
  assert.equal(rows[2], '"TOTAL";"";"";"";"57.847,50";"57.847,50"');
});