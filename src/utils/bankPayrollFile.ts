import type { CompanySettings, PayrollItem } from '../types';

const ACCOUNT_LENGTH = 20;
const IDENTIFIER_LENGTH = 9;
const AMOUNT_LENGTH = 13;

type BankRecordKind = 'NC' | 'ND';

function digits(value: string | number | undefined): string {
  return String(value ?? '').replace(/\D/g, '');
}

function padIdentifier(value: string | number | undefined): string {
  return digits(value).padStart(IDENTIFIER_LENGTH, '0').slice(-IDENTIFIER_LENGTH);
}

function formatAmount(value: number): string {
  const cents = Math.round((Number(value) || 0) * 100);
  return String(cents).padStart(AMOUNT_LENGTH, '0');
}

function makeRecord(kind: BankRecordKind, account: string, amount: number, nationality: string, identifier: string): string {
  return `${kind}${account}${formatAmount(amount)}${nationality}${padIdentifier(identifier)}`;
}

export interface BankPayrollExportInput {
  sourceAccount: string;
  sourceNationality: string;
  sourceIdentifier: string;
}

export function buildBankPayrollFile(
  payroll: { items: PayrollItem[] },
  input: BankPayrollExportInput
): { content: string; transferredItems: PayrollItem[]; skippedItems: PayrollItem[] } {
  const sourceAccount = digits(input.sourceAccount);
  if (sourceAccount.length !== ACCOUNT_LENGTH) {
    throw new Error('La cuenta origen debe tener exactamente 20 dígitos.');
  }

  const sourceNationality = input.sourceNationality.trim().toUpperCase();
  if (!['J', 'V', 'E'].includes(sourceNationality)) {
    throw new Error('La nacionalidad del ordenante debe ser J, V o E.');
  }

  const sourceIdentifier = digits(input.sourceIdentifier);
  if (sourceIdentifier.length !== IDENTIFIER_LENGTH) {
    throw new Error('El identificador del ordenante debe tener 9 dígitos.');
  }

  const transferredItems = payroll.items.filter((item) => item.netoCobrarBs > 0);
  const skippedItems = payroll.items.filter((item) => item.netoCobrarBs <= 0);
  const total = transferredItems.reduce((sum, item) => sum + item.netoCobrarBs, 0);
  const header = makeRecord('ND', sourceAccount, total, sourceNationality, sourceIdentifier);

  const records = transferredItems.map((item) => {
    const employeeAccount = digits(item.employee.numeroCuenta);
    if (employeeAccount.length !== ACCOUNT_LENGTH) {
      throw new Error(`La cuenta de ${item.employee.primerNombre} ${item.employee.primerApellido} debe tener 20 dígitos.`);
    }

    const nationality = item.employee.nacionalidad || 'V';
    const identifier = digits(item.employee.cedula);
    if (identifier.length === 0 || identifier.length > IDENTIFIER_LENGTH) {
      throw new Error(`La cédula de ${item.employee.primerNombre} ${item.employee.primerApellido} no es válida.`);
    }

    return makeRecord('NC', employeeAccount, item.netoCobrarBs, nationality, identifier);
  });

  return {
    content: [header, ...records].join('\r\n') + '\r\n',
    transferredItems,
    skippedItems,
  };
}

export function downloadBankPayrollFile(content: string, payrollName: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `nomina-${payrollName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function defaultSourceIdentifier(company: CompanySettings): { nationality: string; identifier: string } {
  const rawRif = company.rif.trim().toUpperCase();
  const nationality = ['J', 'V', 'E'].includes(rawRif.charAt(0)) ? rawRif.charAt(0) : 'J';
  return { nationality, identifier: digits(rawRif).slice(-IDENTIFIER_LENGTH) };
}
