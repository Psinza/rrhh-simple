import type { Employee, PayrollItem, PayrollPeriod } from '../types';

const BANK_RECORD_LENGTH = 46;
const BANK_AMOUNT_LENGTH = 14;

const digitsOnly = (value: string): string => value.replace(/\D/g, '');

const csvCell = (value: string | number): string => {
  const text = String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const getEmployeeIdentity = (employee: Employee): string => {
  const number = digitsOnly(employee.cedula).slice(-9).padStart(9, '0');
  return `${employee.nacionalidad}${number}`;
};

const getAccountNumber = (employee: Employee): string => digitsOnly(employee.numeroCuenta).padStart(20, '0');

const toCents = (amountBs: number): number => Math.round((Number(amountBs) + Number.EPSILON) * 100);

const formatBankAmount = (amountBs: number): string => {
  const cents = toCents(amountBs);
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error('El monto bancario debe ser un número positivo válido.');
  }
  const amount = String(cents).padStart(BANK_AMOUNT_LENGTH, '0');
  if (amount.length !== BANK_AMOUNT_LENGTH) {
    throw new Error('El monto excede la longitud admitida por el archivo bancario.');
  }
  return amount;
};

const buildRecord = (type: 'ND' | 'NC', account: string, amountBs: number, identity: string): string => {
  const record = `${type}${account}${formatBankAmount(amountBs)}${identity}`;
  if (record.length !== BANK_RECORD_LENGTH) {
    throw new Error(`El registro bancario debe tener ${BANK_RECORD_LENGTH} caracteres.`);
  }
  return record;
};

export function buildBankTransferTxt(
  items: PayrollItem[],
  originAccount: string,
  originIdType: 'J' | 'V' | 'E',
  originIdNumber: string
): string {
  const account = digitsOnly(originAccount);
  const idNumber = digitsOnly(originIdNumber);
  if (account.length !== 20) throw new Error('La cuenta origen debe tener exactamente 20 dígitos.');
  if (idNumber.length !== 9) throw new Error('El identificador de origen debe tener exactamente 9 dígitos.');
  if (items.length === 0) throw new Error('No hay empleados en la nómina para generar el archivo.');

  const validItems = items.filter((item) => toCents(item.netoCobrarBs) > 0);
  const total = validItems.reduce((sum, item) => sum + toCents(item.netoCobrarBs), 0) / 100;
  const records = [buildRecord('ND', account, total, `${originIdType}${idNumber}`)];

  for (const item of validItems) {
    const employeeAccount = digitsOnly(item.employee.numeroCuenta);
    if (employeeAccount.length === 0 || employeeAccount.length > 20) {
      throw new Error(`La cuenta bancaria de ${item.employee.primerNombre} ${item.employee.primerApellido} debe tener entre 1 y 20 dígitos.`);
    }
    records.push(buildRecord('NC', getAccountNumber(item.employee), item.netoCobrarBs, getEmployeeIdentity(item.employee)));
  }

  return records.join('\r\n');
}

export function buildBankTransferCsv(
  items: PayrollItem[],
  exchangeRate: number,
  originAccount: string,
  originIdType: 'J' | 'V' | 'E',
  originIdNumber: string
): string {
  const payableItems = items.filter((item) => item.netoCobrarBs > 0);
  const txtRecords = buildBankTransferTxt(payableItems, originAccount, originIdType, originIdNumber).split('\r\n');
  const rows = [
    ['NOMBRE', 'MONTO (Bs.)', 'N. CUENTA', 'NAC', 'CI', 'BLOCK DE NOTAS ARCHIVO TXT'],
    ...payableItems.map((item, index) => [
      `${item.employee.primerNombre} ${item.employee.primerApellido}`,
      item.netoCobrarBs.toFixed(2),
      getAccountNumber(item.employee),
      item.employee.nacionalidad,
      digitsOnly(item.employee.cedula).slice(-9).padStart(9, '0'),
      txtRecords[index === 0 ? 0 : index + 1],
    ]),
    ['TOTAL TRANSFERENCIA', payableItems.reduce((sum, item) => sum + item.netoCobrarBs, 0).toFixed(2), '', '', '', txtRecords.at(-1) || ''],
    ['TASA BCV (Bs./USD)', Number(exchangeRate).toFixed(2), '', '', '', ''],
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
}

export function buildPayrollSummaryCsv(items: PayrollItem[], payroll: PayrollPeriod, exchangeRate: number): string {
  const rows = [
    ['Departamento', 'Empleado', 'Cédula', 'Cargo', 'Sueldo base (Bs.)', 'Neto (Bs.)', 'Sueldo base (USD)', 'Neto (USD)'],
    ...items.map((item) => [
      item.employee.departamento,
      `${item.employee.primerNombre} ${item.employee.primerApellido}`,
      item.employee.cedula,
      item.employee.cargo,
      item.sueldoBasePeriodo.toFixed(2),
      item.netoCobrarBs.toFixed(2),
      (item.sueldoBasePeriodo / exchangeRate).toFixed(2),
      (item.netoCobrarUSD || item.netoCobrarBs / exchangeRate).toFixed(2),
    ]),
    [
      'TOTAL', '', '', '',
      items.reduce((sum, item) => sum + item.sueldoBasePeriodo, 0).toFixed(2),
      items.reduce((sum, item) => sum + item.netoCobrarBs, 0).toFixed(2),
      (items.reduce((sum, item) => sum + item.sueldoBasePeriodo, 0) / exchangeRate).toFixed(2),
      (items.reduce((sum, item) => sum + item.netoCobrarBs, 0) / exchangeRate).toFixed(2),
    ],
    ['PERÍODO', payroll.nombre, '', '', '', '', '', ''],
    ['TASA BCV (Bs./USD)', Number(exchangeRate).toFixed(2), '', '', '', '', '', ''],
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
}

export function downloadTextFile(contents: string, fileName: string, mimeType: string): void {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}