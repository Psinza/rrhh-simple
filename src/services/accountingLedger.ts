import { AccountingAccount, AccountingPeriod, JournalEntry, JournalLine } from '../types';

export type JournalValidation =
  | { valid: true; debitCents: number; creditCents: number }
  | { valid: false; error: string };

export interface AnnualClosingPreparation {
  entry: JournalEntry | null;
  netIncome: number;
  nominalAccountCount: number;
  decemberPeriod: AccountingPeriod;
}

function amountToCents(value: number): number | null {
  if (!Number.isFinite(value) || value < 0) return null;
  const cents = Math.round(value * 100);
  return Math.abs(value * 100 - cents) < 0.000001 ? cents : null;
}

function centsToAmount(cents: number): number {
  return cents / 100;
}

function monthRange(year: number, month: number) {
  const monthText = String(month).padStart(2, '0');
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    startDate: `${year}-${monthText}-01`,
    endDate: `${year}-${monthText}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function prepareAnnualClosing(
  year: number,
  retainedEarningsAccountId: string,
  currentUserName: string,
  periods: readonly AccountingPeriod[],
  entries: readonly JournalEntry[],
  accounts: readonly AccountingAccount[],
  createdAt = new Date().toISOString(),
): AnnualClosingPreparation {
  if (!Number.isInteger(year) || year < 1900 || year > 9999) {
    throw new Error('Indica un ejercicio válido.');
  }

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const yearPeriods = Array.from({ length: 12 }, (_, index) => {
    const range = monthRange(year, index + 1);
    const matches = periods.filter(
      (period) => period.startDate === range.startDate && period.endDate === range.endDate,
    );
    if (matches.length !== 1) {
      throw new Error(`Debe existir exactamente un período contable para ${range.startDate.slice(0, 7)}.`);
    }
    return matches[0];
  });

  if (yearPeriods.slice(0, 11).some((period) => period.status !== 'closed')) {
    throw new Error('Cierra los períodos de enero a noviembre antes del cierre anual.');
  }
  const decemberPeriod = yearPeriods[11];
  if (decemberPeriod.status !== 'open') {
    throw new Error('Diciembre debe permanecer abierto para generar el asiento de cierre anual.');
  }
  if (entries.some((entry) => entry.date >= yearStart && entry.date <= yearEnd && entry.status === 'draft')) {
    throw new Error('No se puede cerrar el ejercicio mientras existan borradores de asientos.');
  }

  const activeClosing = entries.some((entry) => (
    entry.closingYear === year
    && entry.status === 'posted'
    && !entries.some((candidate) => candidate.status === 'posted' && candidate.reversalOf === entry.id)
  ));
  if (activeClosing) {
    throw new Error(`El ejercicio ${year} ya tiene un cierre anual contabilizado.`);
  }

  const retainedEarningsAccount = accounts.find(
    (account) => account.id === retainedEarningsAccountId
      && account.type === 'patrimonio'
      && account.active
      && !account.isGroup,
  );
  if (!retainedEarningsAccount) {
    throw new Error('Selecciona una cuenta patrimonial imputable y activa para resultados acumulados.');
  }

  const nominalAccounts = accounts.filter(
    (account) => account.type === 'ingreso' || account.type === 'gasto',
  );
  const nominalBalances = new Map<string, number>();
  const accountById = new Map(nominalAccounts.map((account) => [account.id, account]));
  for (const entry of entries) {
    if (entry.status !== 'posted' || entry.date < yearStart || entry.date > yearEnd) continue;
    for (const line of entry.lines) {
      if (!accountById.has(line.accountId)) continue;
      const debit = amountToCents(line.debit);
      const credit = amountToCents(line.credit);
      if (debit === null || credit === null) {
        throw new Error(`El asiento ${entry.number} contiene un monto inválido.`);
      }
      nominalBalances.set(line.accountId, (nominalBalances.get(line.accountId) || 0) + debit - credit);
    }
  }

  const nonzeroNominalBalances = [...nominalBalances].filter(([, balance]) => balance !== 0);
  const totalNominalBalance = nonzeroNominalBalances.reduce((total, [, balance]) => total + balance, 0);
  const netIncomeCents = totalNominalBalance === 0 ? 0 : -totalNominalBalance;
  if (nonzeroNominalBalances.length === 0) {
    return {
      entry: null,
      netIncome: 0,
      nominalAccountCount: 0,
      decemberPeriod,
    };
  }

  const lines: JournalLine[] = nonzeroNominalBalances.map(([accountId, balance]) => ({
    id: `close-line-${crypto.randomUUID()}`,
    accountId,
    description: `Cierre de ${accountById.get(accountId)?.name || 'cuenta nominal'} ${year}`,
    debit: balance < 0 ? centsToAmount(-balance) : 0,
    credit: balance > 0 ? centsToAmount(balance) : 0,
  }));
  if (netIncomeCents !== 0) {
    lines.push({
      id: `close-line-${crypto.randomUUID()}`,
      accountId: retainedEarningsAccount.id,
      description: `Traspaso del resultado del ejercicio ${year}`,
      debit: netIncomeCents < 0 ? centsToAmount(-netIncomeCents) : 0,
      credit: netIncomeCents > 0 ? centsToAmount(netIncomeCents) : 0,
    });
  }

  const validation = validateJournal(yearEnd, `Cierre anual ${year}`, decemberPeriod, lines, accounts);
  if (validation.valid === false) {
    throw new Error(`No se pudo preparar el asiento de cierre: ${validation.error}`);
  }

  const entry: JournalEntry = {
    id: `entry-${crypto.randomUUID()}`,
    number: nextJournalEntryNumber(yearEnd, entries),
    date: yearEnd,
    description: `Cierre de cuentas nominales del ejercicio ${year}`,
    periodId: decemberPeriod.id,
    status: 'posted',
    lines,
    createdAt,
    createdBy: currentUserName,
    postedAt: createdAt,
    postedBy: currentUserName,
    closingYear: year,
  };

  return {
    entry,
    netIncome: centsToAmount(netIncomeCents),
    nominalAccountCount: nonzeroNominalBalances.length,
    decemberPeriod,
  };
}

export function validateJournal(
  date: string,
  description: string,
  period: AccountingPeriod | undefined,
  lines: readonly JournalLine[],
  accounts: readonly AccountingAccount[],
): JournalValidation {
  if (!description.trim() || !date || !period) {
    return { valid: false, error: 'Completa la fecha, el período y la descripción del asiento.' };
  }

  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (
    Number.isNaN(parsedDate.getTime())
    || parsedDate.toISOString().slice(0, 10) !== date
    || period.status !== 'open'
    || date < period.startDate
    || date > period.endDate
  ) {
    return { valid: false, error: 'La fecha debe estar dentro de un período abierto.' };
  }

  if (lines.length < 2) {
    return { valid: false, error: 'El asiento debe contener al menos dos líneas.' };
  }

  const activePostingAccountIds = new Set(
    accounts.filter((account) => account.active && !account.isGroup).map((account) => account.id),
  );
  let debitCents = 0;
  let creditCents = 0;

  for (const line of lines) {
    const debit = amountToCents(line.debit);
    const credit = amountToCents(line.credit);
    if (
      !activePostingAccountIds.has(line.accountId)
      || debit === null
      || credit === null
      || (debit === 0 && credit === 0)
      || (debit > 0 && credit > 0)
    ) {
      return {
        valid: false,
        error: 'Cada línea debe usar una cuenta imputable activa y tener un monto positivo en débito o crédito, pero no en ambos.',
      };
    }
    debitCents += debit;
    creditCents += credit;
  }

  if (debitCents <= 0 || debitCents !== creditCents) {
    return { valid: false, error: 'El asiento debe tener débitos y créditos iguales, mayores que cero.' };
  }

  return { valid: true, debitCents, creditCents };
}

export function nextJournalEntryNumber(
  date: string,
  entries: readonly Pick<JournalEntry, 'number'>[],
): string {
  const year = date.slice(0, 4);
  const prefix = `AS-${year}-`;
  const usedNumbers = new Set(entries.map((entry) => entry.number));
  const sequencePattern = new RegExp(`^AS-${year}-(\\d+)$`);
  let nextSequence = entries.reduce((highest, entry) => {
    const match = sequencePattern.exec(entry.number);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0) + 1;

  let candidate = `${prefix}${String(nextSequence).padStart(5, '0')}`;
  while (usedNumbers.has(candidate)) {
    nextSequence += 1;
    candidate = `${prefix}${String(nextSequence).padStart(5, '0')}`;
  }
  return candidate;
}

export function localAccountingDate(date = new Date()): string {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}
