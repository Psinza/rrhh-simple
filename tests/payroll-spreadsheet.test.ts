import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';

import { buildBankPayrollWorkbook, buildPayrollSummaryCsv } from '../src/utils/payrollSpreadsheet';
import type { PayrollItem } from '../src/types';

const item = {
  employee: {
    departamento: 'Producción',
    primerNombre: 'José "Pepe"',
    primerApellido: 'Pérez',
    cedula: 'V-12345678',
    cargo: 'Operador; turno A',
    numeroCuenta: '01910011152111103821',
    nacionalidad: 'V',
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

test('genera un XLSX con la tabla del banco y el bloque de registros ND/NC', async () => {
  const bytes = await buildBankPayrollWorkbook(
    { items: [item] },
    { sourceAccount: '01910001002195000000', sourceNationality: 'J', sourceIdentifier: '409644669' }
  );
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const sheet = workbook.getWorksheet('PAGO BANCARIO');

  assert.ok(sheet);
  assert.equal(sheet.getCell('A1').value, 'NOMBRE');
  assert.equal(sheet.getCell('B1').value, 'MONTO');
  assert.equal(sheet.getCell('C1').value, 'N. CUENTA');
  assert.equal(sheet.getCell('D1').value, 'NAC');
  assert.equal(sheet.getCell('E1').value, 'CI');
  assert.equal(sheet.getCell('G1').value, 'BLOCK DE NOTAS ARCHIVO TXT');
  assert.equal(sheet.getCell('A2').value, 'José "Pepe" Pérez');
  assert.equal(sheet.getCell('B2').value, 57847.5);
  assert.equal(sheet.getCell('C2').value, '01910011152111103821');
  assert.equal(sheet.getCell('G2').value, 'ND019100010021950000000000005784750J409644669');
  assert.equal(sheet.getCell('G3').value, 'NC019100111521111038210000005784750V012345678');
  assert.equal(sheet.getCell('A3').value, 'TOTAL TRANSFERENCIA');
  assert.equal(sheet.getCell('B3').value, 57847.5);
});