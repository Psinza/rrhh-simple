import assert from 'node:assert/strict';
import test from 'node:test';
import {
  nextJournalEntryNumber,
  prepareAnnualClosing,
  validateJournal,
} from '../src/services/accountingLedger';
import { createAccountingPeriods } from '../src/data/accountingInitialData';
import { AccountingAccount, AccountingPeriod, JournalEntry, JournalLine } from '../src/types';

const accounts: AccountingAccount[] = [
  { id: 'cash', code: '1.1', name: 'Caja', type: 'activo', isGroup: false, active: true },
  { id: 'sales', code: '4.1', name: 'Ventas', type: 'ingreso', isGroup: false, active: true },
  { id: 'group', code: '1', name: 'Activo', type: 'activo', isGroup: true, active: true },
];
const period: AccountingPeriod = {
  id: '2026-01',
  name: 'Enero 2026',
  startDate: '2026-01-01',
  endDate: '2026-01-31',
  status: 'open',
};
const balancedLines: JournalLine[] = [
  { id: '1', accountId: 'cash', description: '', debit: 125.5, credit: 0 },
  { id: '2', accountId: 'sales', description: '', debit: 0, credit: 125.5 },
];

test('accepts a balanced entry with active posting accounts in an open period', () => {
  assert.deepEqual(validateJournal('2026-01-15', 'Venta', period, balancedLines, accounts), {
    valid: true,
    debitCents: 12_550,
    creditCents: 12_550,
  });
});

test('rejects unbalanced entries and non-posting accounts', () => {
  const unbalanced = [{ ...balancedLines[0], debit: 125.51 }, balancedLines[1]];
  assert.equal(validateJournal('2026-01-15', 'Venta', period, unbalanced, accounts).valid, false);

  const groupAccount = [{ ...balancedLines[0], accountId: 'group' }, balancedLines[1]];
  assert.equal(validateJournal('2026-01-15', 'Venta', period, groupAccount, accounts).valid, false);
});

test('rejects invalid precision, dates, and closed periods', () => {
  const invalidPrecision = [{ ...balancedLines[0], debit: 1.001 }, balancedLines[1]];
  assert.equal(validateJournal('2026-01-15', 'Venta', period, invalidPrecision, accounts).valid, false);
  assert.equal(validateJournal('2026-02-01', 'Venta', period, balancedLines, accounts).valid, false);
  assert.equal(
    validateJournal('2026-01-15', 'Venta', { ...period, status: 'closed' }, balancedLines, accounts).valid,
    false,
  );
});

test('allocates the next unused yearly number without reusing voided entry numbers', () => {
  const entries = [
    { number: 'AS-2026-00004' },
    { number: 'AS-2026-00005' },
    { number: 'REV-AS-2026-00005' },
  ];
  assert.equal(nextJournalEntryNumber('2026-03-01', entries), 'AS-2026-00006');
  assert.equal(nextJournalEntryNumber('2027-01-01', entries), 'AS-2027-00001');
});

const closingAccounts: AccountingAccount[] = [
  { id: 'cash', code: '1.1', name: 'Caja', type: 'activo', isGroup: false, active: true },
  { id: 'sales', code: '4.1', name: 'Ventas', type: 'ingreso', isGroup: false, active: true },
  { id: 'cost', code: '5.1', name: 'Costo de ventas', type: 'gasto', isGroup: false, active: true },
  { id: 'expenses', code: '5.2', name: 'Gastos', type: 'gasto', isGroup: false, active: true },
  { id: 'retained', code: '3.2.01', name: 'Resultados acumulados', type: 'patrimonio', isGroup: false, active: true },
];

function closingPeriods(year: number): AccountingPeriod[] {
  return createAccountingPeriods(year).map((item, index) => ({
    ...item,
    status: index < 11 ? 'closed' : 'open',
  }));
}

function postedEntry(
  id: string,
  year: number,
  lines: JournalLine[],
  extra: Partial<JournalEntry> = {},
): JournalEntry {
  return {
    id,
    number: `AS-${year}-00001`,
    date: `${year}-06-30`,
    description: id,
    periodId: `${year}-06`,
    status: 'posted',
    lines,
    createdAt: `${year}-06-30T12:00:00.000Z`,
    createdBy: 'Contador',
    postedAt: `${year}-06-30T12:00:00.000Z`,
    postedBy: 'Contador',
    ...extra,
  };
}

test('closes nominal accounts and transfers annual profit to retained earnings', () => {
  const entries = [
    postedEntry('sales-entry', 2024, [
      { id: 'cash-sales-line', accountId: 'cash', description: '', debit: 100, credit: 0 },
      { id: 'sales-line', accountId: 'sales', description: '', debit: 0, credit: 100 },
    ]),
    postedEntry('cost-entry', 2024, [
      { id: 'cost-line', accountId: 'cost', description: '', debit: 35, credit: 0 },
      { id: 'cash-cost-line', accountId: 'cash', description: '', debit: 0, credit: 35 },
      { id: 'expense-line', accountId: 'expenses', description: '', debit: 15, credit: 0 },
      { id: 'cash-expense-line', accountId: 'cash', description: '', debit: 0, credit: 15 },
    ]),
  ];

  const result = prepareAnnualClosing(2024, 'retained', 'Contador', closingPeriods(2024), entries, closingAccounts);

  assert.equal(result.netIncome, 50);
  assert.equal(result.nominalAccountCount, 3);
  assert.equal(result.entry?.date, '2024-12-31');
  assert.equal(result.entry?.closingYear, 2024);
  assert.equal(result.entry?.periodId, '2024-12');
  assert.equal(result.entry?.lines.find((line) => line.accountId === 'sales')?.debit, 100);
  assert.equal(result.entry?.lines.find((line) => line.accountId === 'cost')?.credit, 35);
  assert.equal(result.entry?.lines.find((line) => line.accountId === 'expenses')?.credit, 15);
  assert.equal(result.entry?.lines.find((line) => line.accountId === 'retained')?.credit, 50);
  assert.equal(
    result.entry?.lines.reduce((sum, line) => sum + line.debit, 0),
    result.entry?.lines.reduce((sum, line) => sum + line.credit, 0),
  );
});

test('transfers a loss as a debit to retained earnings', () => {
  const entries = [
    postedEntry('sales-entry', 2024, [
      { id: 'cash-sales-line', accountId: 'cash', description: '', debit: 100, credit: 0 },
      { id: 'sales-line', accountId: 'sales', description: '', debit: 0, credit: 100 },
    ]),
    postedEntry('expense-entry', 2024, [
      { id: 'cash-expense-line', accountId: 'cash', description: '', debit: 0, credit: 125 },
      { id: 'expense-line', accountId: 'expenses', description: '', debit: 125, credit: 0 },
    ]),
  ];

  const result = prepareAnnualClosing(2024, 'retained', 'Contador', closingPeriods(2024), entries, closingAccounts);

  assert.equal(result.netIncome, -25);
  assert.equal(result.entry?.lines.find((line) => line.accountId === 'retained')?.debit, 25);
});

test('returns no closing entry when annual nominal balances are zero', () => {
  const result = prepareAnnualClosing(2024, 'retained', 'Contador', closingPeriods(2024), [], closingAccounts);

  assert.equal(result.entry, null);
  assert.equal(result.netIncome, 0);
  assert.equal(result.decemberPeriod.status, 'open');
});

test('closes nominal balances without an equity transfer when annual profit is zero', () => {
  const entries = [
    postedEntry('sales-entry', 2024, [
      { id: 'cash-sales-line', accountId: 'cash', description: '', debit: 100, credit: 0 },
      { id: 'sales-line', accountId: 'sales', description: '', debit: 0, credit: 100 },
    ]),
    postedEntry('expense-entry', 2024, [
      { id: 'cash-expense-line', accountId: 'cash', description: '', debit: 0, credit: 100 },
      { id: 'expense-line', accountId: 'expenses', description: '', debit: 100, credit: 0 },
    ]),
  ];

  const result = prepareAnnualClosing(2024, 'retained', 'Contador', closingPeriods(2024), entries, closingAccounts);

  assert.equal(result.netIncome, 0);
  assert.equal(result.entry?.lines.some((line) => line.accountId === 'retained'), false);
  assert.equal(
    result.entry?.lines.reduce((sum, line) => sum + line.debit, 0),
    result.entry?.lines.reduce((sum, line) => sum + line.credit, 0),
  );
});

test('requires prior periods closed, December open, no drafts, and no active duplicate close', () => {
  const periods = closingPeriods(2024);
  const noEntries: JournalEntry[] = [];
  const prepare = (testPeriods = periods, testEntries = noEntries) => (
    prepareAnnualClosing(2024, 'retained', 'Contador', testPeriods, testEntries, closingAccounts)
  );

  assert.throws(() => prepare(periods.map((item, index) => (
    index === 4 ? { ...item, status: 'open' } : item
  ))), /enero a noviembre/);
  assert.throws(() => prepare(periods.map((item, index) => (
    index === 11 ? { ...item, status: 'closed' } : item
  ))), /Diciembre debe permanecer abierto/);
  assert.throws(() => prepare(periods, [
    postedEntry('draft-entry', 2024, [], { status: 'draft', postedAt: undefined, postedBy: undefined }),
  ]), /borradores/);
  assert.throws(() => prepare(periods, [
    postedEntry('prior-close', 2024, [], { closingYear: 2024 }),
  ]), /ya tiene un cierre anual/);
});

test('does not accept an inactive, group, or non-equity retained earnings account', () => {
  const invalidAccounts = [
    { id: 'inactive', code: '3.2.02', name: 'Inactivo', type: 'patrimonio' as const, isGroup: false, active: false },
    { id: 'group', code: '3.2', name: 'Grupo', type: 'patrimonio' as const, isGroup: true, active: true },
    { id: 'cash', code: '1.1', name: 'Caja', type: 'activo' as const, isGroup: false, active: true },
  ];
  for (const account of invalidAccounts) {
    assert.throws(
      () => prepareAnnualClosing(2024, account.id, 'Contador', closingPeriods(2024), [], [...closingAccounts, account]),
      /cuenta patrimonial imputable y activa/,
    );
  }
});
