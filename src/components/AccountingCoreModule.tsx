import { FormEvent, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpenCheck,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  FilePlus2,
  Landmark,
  LockKeyhole,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  AccountingAccount,
  AccountingAccountType,
  AccountingPeriod,
  AppUser,
  CompanyBranch,
  CompanySettings,
  CreateAppUserInput,
  JournalEntry,
  JournalLine,
} from '../types';
import { accountingAccountTypes } from '../data/accountingInitialData';
import {
  localAccountingDate,
  nextJournalEntryNumber,
  prepareAnnualClosing,
  validateJournal,
} from '../services/accountingLedger';

type CoreSection = 'overview' | 'branches' | 'users' | 'accounts' | 'periods' | 'year-end' | 'entries';

interface AccountingCoreModuleProps {
  company: CompanySettings;
  branches: CompanyBranch[];
  users: AppUser[];
  accounts: AccountingAccount[];
  periods: AccountingPeriod[];
  entries: JournalEntry[];
  canManage: boolean;
  currentUserName: string;
  onBranchesChange: (branches: CompanyBranch[]) => void;
  onAccountsChange: (accounts: AccountingAccount[]) => void;
  onPeriodsChange: (periods: AccountingPeriod[]) => void;
  onEntriesChange: (entries: JournalEntry[]) => void;
  onManageUsers: () => void;
  onCreateUser: (input: CreateAppUserInput) => Promise<AppUser>;
  onAudit: (action: string, module: 'Contabilidad' | 'Empresas', details: string) => void;
}

const sectionTabs: { id: CoreSection; label: string; icon: typeof Landmark }[] = [
  { id: 'overview', label: 'Resumen', icon: BookOpenCheck },
  { id: 'branches', label: 'Empresas y sucursales', icon: Building2 },
  { id: 'users', label: 'Usuarios y roles', icon: Users },
  { id: 'accounts', label: 'Plan de cuentas', icon: Landmark },
  { id: 'periods', label: 'Períodos', icon: CalendarDays },
  { id: 'year-end', label: 'Cierre anual', icon: CalendarDays },
  { id: 'entries', label: 'Asientos', icon: BookOpenCheck },
];

const typeLabels: Record<AccountingAccountType, string> = {
  activo: 'Activo',
  pasivo: 'Pasivo',
  patrimonio: 'Patrimonio',
  ingreso: 'Ingreso',
  gasto: 'Gasto',
};

const money = new Intl.NumberFormat('es-VE', {
  style: 'currency',
  currency: 'VES',
  minimumFractionDigits: 2,
});

const today = localAccountingDate;

function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function blankLine(): JournalLine {
  return {
    id: newId('line'),
    accountId: '',
    description: '',
    debit: 0,
    credit: 0,
  };
}

export function AccountingCoreModule({
  company,
  branches,
  users,
  accounts,
  periods,
  entries,
  canManage,
  currentUserName,
  onBranchesChange,
  onAccountsChange,
  onPeriodsChange,
  onEntriesChange,
  onManageUsers,
  onCreateUser,
  onAudit,
}: AccountingCoreModuleProps) {
  const [section, setSection] = useState<CoreSection>('overview');
  const [search, setSearch] = useState('');
  const [branchName, setBranchName] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchCity, setBranchCity] = useState('');
  const [accountCode, setAccountCode] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<AccountingAccountType>('activo');
  const [accountParent, setAccountParent] = useState('');
  const [entryFormOpen, setEntryFormOpen] = useState(false);
  const [entryDate, setEntryDate] = useState(today());
  const [entryPeriodId, setEntryPeriodId] = useState('');
  const [entryDescription, setEntryDescription] = useState('');
  const [entryLines, setEntryLines] = useState<JournalLine[]>([blankLine(), blankLine()]);
  const [closingYear, setClosingYear] = useState(String(new Date().getFullYear()));
  const [newUser, setNewUser] = useState<CreateAppUserInput>({
    username: '',
    email: '',
    password: '',
    nombre: '',
    cargo: '',
    rol: 'rrhh',
  });
  const [creatingUser, setCreatingUser] = useState(false);
  const [userFormError, setUserFormError] = useState('');
  const [userFormSuccess, setUserFormSuccess] = useState('');
  const [retainedEarningsAccountId, setRetainedEarningsAccountId] = useState('');
  const [annualCloseResult, setAnnualCloseResult] = useState('');
  const [formError, setFormError] = useState('');

  const postingAccounts = useMemo(
    () => accounts.filter((account) => account.active && !account.isGroup),
    [accounts]
  );
  const accountingYears = [...new Set(periods.map((period) => period.startDate.slice(0, 4)))]
    .sort((left, right) => right.localeCompare(left));
  const selectedClosingYear = accountingYears.includes(closingYear)
    ? closingYear
    : accountingYears[0] || String(new Date().getFullYear());
  const defaultRetainedEarningsAccount = postingAccounts.find(
    (account) => account.type === 'patrimonio'
      && (account.code === '3.2.01' || account.name.toLocaleLowerCase().includes('resultados acumulados')),
  );
  const selectedRetainedEarningsAccountId = retainedEarningsAccountId || defaultRetainedEarningsAccount?.id || '';
  const postedEntries = entries.filter((entry) => entry.status === 'posted');
  const openPeriods = periods.filter((period) => period.status === 'open');
  const visibleAccounts = accounts.filter((account) => {
    const query = search.trim().toLocaleLowerCase();
    return !query || account.code.toLocaleLowerCase().includes(query) || account.name.toLocaleLowerCase().includes(query);
  });
  const debitTotal = postedEntries.reduce(
    (total, entry) => total + entry.lines.reduce((sum, line) => sum + line.debit, 0),
    0
  );
  const creditTotal = postedEntries.reduce(
    (total, entry) => total + entry.lines.reduce((sum, line) => sum + line.credit, 0),
    0
  );

  const reportRows = useMemo(() => {
    const balances = new Map<string, { debit: number; credit: number }>();
    for (const entry of postedEntries) {
      for (const line of entry.lines) {
        const totals = balances.get(line.accountId) || { debit: 0, credit: 0 };
        totals.debit += line.debit;
        totals.credit += line.credit;
        balances.set(line.accountId, totals);
      }
    }

    return postingAccounts.map((account) => {
      const totals = balances.get(account.id) || { debit: 0, credit: 0 };
      const debitBalance = Math.max(0, totals.debit - totals.credit);
      const creditBalance = Math.max(0, totals.credit - totals.debit);
      return { account, debit: debitBalance, credit: creditBalance };
    }).filter((row) => row.debit > 0 || row.credit > 0);
  }, [postedEntries, postingAccounts]);

  const entryTotals = entryLines.reduce(
    (totals, line) => ({
      debit: totals.debit + (Number(line.debit) || 0),
      credit: totals.credit + (Number(line.credit) || 0),
    }),
    { debit: 0, credit: 0 }
  );

  const addBranch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    const name = branchName.trim();
    if (!name) {
      setFormError('Escribe el nombre de la sucursal.');
      return;
    }
    if (branches.some((branch) => branch.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setFormError('Ya existe una sucursal con ese nombre.');
      return;
    }
    const branch: CompanyBranch = {
      id: newId('branch'),
      name,
      address: branchAddress.trim(),
      city: branchCity.trim(),
      active: true,
    };
    onBranchesChange([branch, ...branches]);
    onAudit('Registro de sucursal', 'Empresas', `Se registró la sucursal ${branch.name}.`);
    setBranchName('');
    setBranchAddress('');
    setBranchCity('');
  };

  const toggleBranch = (branch: CompanyBranch) => {
    const updated = { ...branch, active: !branch.active };
    onBranchesChange(branches.map((item) => item.id === branch.id ? updated : item));
    onAudit(
      updated.active ? 'Activación de sucursal' : 'Desactivación de sucursal',
      'Empresas',
      `${updated.name} quedó ${updated.active ? 'activa' : 'inactiva'}.`
    );
  };

  const addAccount = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    const code = accountCode.trim();
    const name = accountName.trim();
    if (!code || !name) {
      setFormError('Completa el código y el nombre de la cuenta.');
      return;
    }
    if (!/^[0-9]+(?:\.[0-9]+)*$/.test(code)) {
      setFormError('El código debe contener números separados opcionalmente por puntos.');
      return;
    }
    if (accounts.some((account) => account.code === code)) {
      setFormError('Ese código ya está registrado.');
      return;
    }
    const parent = accounts.find((account) => account.code === accountParent && account.isGroup);
    if (!parent || parent.type !== accountType) {
      setFormError('Selecciona una cuenta agrupadora del mismo tipo.');
      return;
    }

    const account: AccountingAccount = {
      id: newId('account'),
      code,
      name,
      type: accountType,
      parentCode: parent.code,
      isGroup: false,
      active: true,
    };
    onAccountsChange([...accounts, account].sort((left, right) => left.code.localeCompare(right.code, 'es', { numeric: true })));
    onAudit('Creación de cuenta contable', 'Contabilidad', `Se creó la cuenta ${code} ${name}.`);
    setAccountCode('');
    setAccountName('');
  };

  const toggleAccount = (account: AccountingAccount) => {
    const isUsed = entries.some((entry) => entry.lines.some((line) => line.accountId === account.id));
    if (account.active && isUsed) {
      setFormError('No se puede desactivar una cuenta que ya aparece en asientos. Conserva el historial y crea una cuenta nueva.');
      return;
    }
    const updated = { ...account, active: !account.active };
    onAccountsChange(accounts.map((item) => item.id === account.id ? updated : item));
    onAudit(
      updated.active ? 'Activación de cuenta contable' : 'Desactivación de cuenta contable',
      'Contabilidad',
      `${account.code} ${account.name} quedó ${updated.active ? 'activa' : 'inactiva'}.`
    );
    setFormError('');
  };

  const setLine = (id: string, changes: Partial<JournalLine>) => {
    setEntryLines((lines) => lines.map((line) => line.id === id ? { ...line, ...changes } : line));
  };

  const saveDraft = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    const period = periods.find((item) => item.id === entryPeriodId);
    const description = entryDescription.trim();
    const lines = entryLines.map((line) => ({
      ...line,
      debit: Number(line.debit) || 0,
      credit: Number(line.credit) || 0,
    }));
    const validation = validateJournal(entryDate, description, period, lines, accounts);
    if (validation.valid === false) {
      setFormError(validation.error);
      return;
    }

    const normalizedLines = lines.map((line) => ({
      ...line,
      debit: Math.round(line.debit * 100) / 100,
      credit: Math.round(line.credit * 100) / 100,
    }));
    const entry: JournalEntry = {
      id: newId('entry'),
      number: nextJournalEntryNumber(entryDate, entries),
      date: entryDate,
      description,
      periodId: period.id,
      status: 'draft',
      lines: normalizedLines,
      createdAt: new Date().toISOString(),
      createdBy: currentUserName,
    };
    onEntriesChange([entry, ...entries]);
    onAudit('Creación de borrador de asiento', 'Contabilidad', `${entry.number}: ${entry.description}.`);
    setEntryFormOpen(false);
    setEntryDescription('');
    setEntryLines([blankLine(), blankLine()]);
  };

  const postEntry = (entry: JournalEntry) => {
    const period = periods.find((item) => item.id === entry.periodId);
    if (!canManage || entry.status !== 'draft' || !period || period.status !== 'open') return;
    const validation = validateJournal(entry.date, entry.description, period, entry.lines, accounts);
    if (validation.valid === false) {
      setFormError(`No se puede contabilizar: ${validation.error}`);
      return;
    }
    const updated: JournalEntry = {
      ...entry,
      status: 'posted',
      postedAt: new Date().toISOString(),
      postedBy: currentUserName,
    };
    onEntriesChange(entries.map((item) => item.id === entry.id ? updated : item));
    onAudit('Contabilización de asiento', 'Contabilidad', `${entry.number} quedó contabilizado por ${currentUserName}.`);
    setFormError('');
  };

  const voidDraft = (entry: JournalEntry) => {
    if (!canManage || entry.status !== 'draft') return;
    const reason = window.prompt(`Motivo para anular el borrador ${entry.number}:`)?.trim();
    if (!reason) return;
    const updated: JournalEntry = {
      ...entry,
      status: 'voided',
      voidedAt: new Date().toISOString(),
      voidedBy: currentUserName,
      voidReason: reason,
    };
    onEntriesChange(entries.map((item) => item.id === entry.id ? updated : item));
    onAudit('Anulación de borrador', 'Contabilidad', `${entry.number} fue anulado por ${currentUserName}. Motivo: ${reason}`);
    setFormError('');
  };

  const reverseEntry = (entry: JournalEntry) => {
    if (!canManage || entry.status !== 'posted' || entries.some((item) => item.reversalOf === entry.id)) return;
    const sourcePeriod = periods.find((period) => period.id === entry.periodId);
    const reversalDate = sourcePeriod?.status === 'open' && entry.date >= sourcePeriod.startDate && entry.date <= sourcePeriod.endDate
      ? entry.date
      : today();
    const targetPeriod = periods.find((period) =>
      period.status === 'open' && reversalDate >= period.startDate && reversalDate <= period.endDate
    );
    if (!targetPeriod) {
      setFormError('No hay un período abierto para registrar el asiento de reversión.');
      return;
    }
    const reversalNumber = `REV-${entry.number}`;
    if (entries.some((item) => item.number === reversalNumber)) {
      setFormError(`Ya existe un asiento con el número de reversión ${reversalNumber}.`);
      return;
    }
    const reversal: JournalEntry = {
      id: newId('entry'),
      number: reversalNumber,
      date: reversalDate,
      description: `Reversión de ${entry.number}: ${entry.description}`,
      periodId: targetPeriod.id,
      status: 'posted',
      lines: entry.lines.map((line) => ({
        ...line,
        id: newId('line'),
        debit: line.credit,
        credit: line.debit,
      })),
      createdAt: new Date().toISOString(),
      createdBy: currentUserName,
      postedAt: new Date().toISOString(),
      postedBy: currentUserName,
      reversalOf: entry.id,
    };
    onEntriesChange([reversal, ...entries]);
    onAudit('Reversión contable', 'Contabilidad', `${entry.number} se revirtió con ${reversal.number}.`);
    setFormError('');
  };

  const togglePeriod = (period: AccountingPeriod) => {
    if (!canManage) return;
    const nextStatus = period.status === 'open' ? 'closed' : 'open';
    if (nextStatus === 'closed' && entries.some((entry) => entry.periodId === period.id && entry.status === 'draft')) {
      setFormError('No se puede cerrar el período mientras existan borradores de asientos.');
      return;
    }
    onPeriodsChange(periods.map((item) => item.id === period.id ? { ...item, status: nextStatus } : item));
    onAudit(
      nextStatus === 'closed' ? 'Cierre de período contable' : 'Reapertura de período contable',
      'Contabilidad',
      `El período ${period.name} quedó ${nextStatus === 'closed' ? 'cerrado' : 'abierto'}.`
    );
    setFormError('');
  };

  const closeAnnualYear = () => {
    if (!canManage) return;
    setAnnualCloseResult('');
    try {
      const year = Number(selectedClosingYear);
      const preparation = prepareAnnualClosing(
        year,
        selectedRetainedEarningsAccountId,
        currentUserName,
        periods,
        entries,
        accounts,
      );
      if (preparation.entry) {
        onEntriesChange([preparation.entry, ...entries]);
      }
      onPeriodsChange(periods.map((period) => (
        period.id === preparation.decemberPeriod.id ? { ...period, status: 'closed' } : period
      )));
      const outcome = preparation.entry
        ? `${preparation.entry.number} · resultado ${money.format(preparation.netIncome)} · ${preparation.nominalAccountCount} cuentas nominales`
        : 'Sin saldos nominales que traspasar.';
      setAnnualCloseResult(`Ejercicio ${year} cerrado. ${outcome}`);
      onAudit(
        'Cierre anual contable',
        'Contabilidad',
        `Ejercicio ${year}: ${outcome}`,
      );
      setFormError('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'No se pudo completar el cierre anual.');
    }
  };

  const startNewEntry = () => {
    const currentPeriod = periods.find((period) => period.status === 'open' && today() >= period.startDate && today() <= period.endDate);
    const firstOpenPeriod = currentPeriod || openPeriods[0];
    if (!firstOpenPeriod) {
      setFormError('Crea o abre un período contable antes de registrar asientos.');
      return;
    }
    const proposedDate = today() >= firstOpenPeriod.startDate && today() <= firstOpenPeriod.endDate
      ? today()
      : firstOpenPeriod.startDate;
    setEntryDate(proposedDate);
    setEntryPeriodId(firstOpenPeriod.id);
    setEntryDescription('');
    setEntryLines([blankLine(), blankLine()]);
    setEntryFormOpen(true);
    setFormError('');
  };

  const balanceStatus = Math.abs(debitTotal - creditTotal) < 0.005;

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingUser(true);
    setUserFormError('');
    setUserFormSuccess('');
    try {
      const created = await onCreateUser(newUser);
      setUserFormSuccess(`Usuario ${created.username} creado con perfil ${created.rolTitulo}.`);
      setNewUser({ username: '', email: '', password: '', nombre: '', cargo: '', rol: 'rrhh' });
    } catch (error) {
      setUserFormError(error instanceof Error ? error.message : 'No se pudo crear el usuario.');
    } finally {
      setCreatingUser(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
            <Landmark className="h-4 w-4" />
            ERP · Fundación y contabilidad
          </div>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Centro empresarial</h1>
          <p className="mt-1 text-sm text-slate-500">{company.razonSocial} · {company.rif}</p>
        </div>
        {!canManage && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            <LockKeyhole className="h-4 w-4" />
            Acceso de consulta
          </div>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 pb-1">
        {sectionTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => { setSection(id); setFormError(''); }}
            className={`flex shrink-0 items-center gap-2 rounded-t-lg px-3 py-2.5 text-xs font-semibold transition-colors sm:text-sm ${
              section === id
                ? 'border-b-2 border-blue-600 bg-blue-50 text-blue-800'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {formError && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {section === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={Landmark} label="Cuentas imputables" value={String(postingAccounts.length)} detail="Cuentas activas del plan" tone="blue" />
            <MetricCard icon={CalendarDays} label="Períodos abiertos" value={String(openPeriods.length)} detail={`${periods.length} períodos configurados`} tone="violet" />
            <MetricCard icon={BookOpenCheck} label="Asientos contabilizados" value={String(postedEntries.length)} detail={`${entries.filter((entry) => entry.status === 'draft').length} borradores pendientes · ${entries.filter((entry) => entry.status === 'voided').length} anulados`} tone="emerald" />
            <MetricCard icon={Wallet} label="Movimientos al debe" value={money.format(debitTotal)} detail={balanceStatus ? 'Debe y haber cuadran' : 'Revisar descuadre'} tone={balanceStatus ? 'emerald' : 'rose'} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-slate-900">Balance de comprobación</h2>
                  <p className="mt-1 text-xs text-slate-500">Saldos calculados exclusivamente desde asientos contabilizados · VES</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${balanceStatus ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {balanceStatus ? 'Cuadrado' : 'Diferencia'}
                </span>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-y border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                    <tr><th className="py-2 pr-3">Cuenta</th><th className="py-2 pr-3">Tipo</th><th className="py-2 text-right">Debe</th><th className="py-2 text-right">Haber</th></tr>
                  </thead>
                  <tbody>
                    {reportRows.length === 0 ? (
                      <tr><td colSpan={4} className="py-8 text-center text-sm text-slate-400">Aún no hay movimientos contabilizados.</td></tr>
                    ) : reportRows.slice(0, 6).map(({ account, debit, credit }) => (
                      <tr key={account.id} className="border-b border-slate-50">
                        <td className="py-2.5 pr-3 font-medium text-slate-700">{account.code} · {account.name}</td>
                        <td className="py-2.5 pr-3 text-xs text-slate-500">{typeLabels[account.type]}</td>
                        <td className="py-2.5 text-right tabular-nums">{debit ? money.format(debit) : '—'}</td>
                        <td className="py-2.5 text-right tabular-nums">{credit ? money.format(credit) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="font-bold text-slate-800">
                    <tr><td colSpan={2} className="pt-3">Totales</td><td className="pt-3 text-right tabular-nums">{money.format(debitTotal)}</td><td className="pt-3 text-right tabular-nums">{money.format(creditTotal)}</td></tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="font-bold text-slate-900">Accesos de fundación</h2>
                <div className="mt-3 space-y-2">
                  <QuickLink icon={Building2} label="Administrar sucursales" detail={`${branches.length} sucursales`} onClick={() => setSection('branches')} />
                  <QuickLink icon={Users} label="Usuarios y perfiles" detail={`${users.length} usuarios`} onClick={() => setSection('users')} />
                  <QuickLink icon={Landmark} label="Mantener plan de cuentas" detail={`${accounts.length} cuentas`} onClick={() => setSection('accounts')} />
                  <QuickLink icon={BookOpenCheck} label="Registrar un asiento" detail="Doble partida" onClick={() => { setSection('entries'); startNewEntry(); }} />
                </div>
              </div>
              <div className="rounded-xl border border-sky-100 bg-sky-50 p-4 text-xs leading-5 text-sky-900">
                <div className="flex items-center gap-2 font-bold"><ShieldCheck className="h-4 w-4" /> Alcance de esta fase</div>
                <p className="mt-1.5">Contabilidad base en bolívares: plan de cuentas, períodos, asientos balanceados y reversos. La aplicación no calcula todavía impuestos ni declara cumplimiento u homologación SENIAT.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {section === 'branches' && (
        <div className="grid gap-5 xl:grid-cols-[1fr_1.5fr]">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">Empresa principal</h2>
            <div className="mt-4 space-y-3 text-sm">
              <InfoRow label="Razón social" value={company.razonSocial} />
              <InfoRow label="RIF" value={company.rif} />
              <InfoRow label="Dirección fiscal" value={company.direccionFiscal} />
              <InfoRow label="Ciudad / estado" value={`${company.ciudad}, ${company.estado}`} />
            </div>
            <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500">La información fiscal de la empresa se edita desde el módulo existente de identidad y configuración.</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div><h2 className="font-bold text-slate-900">Sucursales</h2><p className="mt-1 text-xs text-slate-500">La empresa principal no se elimina; agrega sedes operativas aquí.</p></div>
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            {canManage && (
              <form onSubmit={addBranch} className="mt-4 grid gap-2 sm:grid-cols-3">
                <input aria-label="Nombre de sucursal" value={branchName} onChange={(event) => setBranchName(event.target.value)} placeholder="Nombre de sucursal" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 sm:col-span-3" />
                <input aria-label="Dirección de sucursal" value={branchAddress} onChange={(event) => setBranchAddress(event.target.value)} placeholder="Dirección" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 sm:col-span-2" />
                <input aria-label="Ciudad de sucursal" value={branchCity} onChange={(event) => setBranchCity(event.target.value)} placeholder="Ciudad" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
                <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 sm:col-span-3"><Plus className="h-4 w-4" /> Agregar sucursal</button>
              </form>
            )}
            <div className="mt-4 divide-y divide-slate-100">
              {branches.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">No hay sucursales adicionales.</p> : branches.map((branch) => (
                <div key={branch.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{branch.name}</p><p className="truncate text-xs text-slate-500">{[branch.address, branch.city].filter(Boolean).join(' · ') || 'Sin dirección registrada'}</p></div>
                  <div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${branch.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{branch.active ? 'Activa' : 'Inactiva'}</span>{canManage && <button type="button" onClick={() => toggleBranch(branch)} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">{branch.active ? 'Desactivar' : 'Activar'}</button>}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {section === 'users' && (
        <div className="space-y-4">
          {canManage && (
            <form onSubmit={createUser} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <h2 className="font-bold text-slate-900">Crear usuario y asignar perfil</h2>
                <p className="mt-1 text-xs text-slate-500">La cuenta se guarda en el backend para la empresa activa (RIF {company.rif}); la contraseña no se conserva en el navegador.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <input required minLength={3} maxLength={64} pattern="[A-Za-z0-9._-]+" autoComplete="username" aria-label="Nombre de usuario" value={newUser.username} onChange={(event) => setNewUser({ ...newUser, username: event.target.value })} placeholder="Usuario" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
                <input required type="email" maxLength={254} autoComplete="email" aria-label="Correo electrónico" value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} placeholder="Correo electrónico" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
                <input required minLength={12} maxLength={72} type="password" autoComplete="new-password" aria-label="Contraseña inicial" value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} placeholder="Contraseña inicial (mín. 12 caracteres)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
                <input required maxLength={160} autoComplete="name" aria-label="Nombre completo" value={newUser.nombre} onChange={(event) => setNewUser({ ...newUser, nombre: event.target.value })} placeholder="Nombre completo" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
                <input maxLength={120} aria-label="Cargo" value={newUser.cargo} onChange={(event) => setNewUser({ ...newUser, cargo: event.target.value })} placeholder="Cargo (opcional)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
                <select aria-label="Perfil de acceso" value={newUser.rol} onChange={(event) => setNewUser({ ...newUser, rol: event.target.value as CreateAppUserInput['rol'] })} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400">
                  <option value="rrhh">Gerente de RRHH</option>
                  <option value="dueno">Dueño de la Empresa</option>
                  <option value="admin_sistema">Administrador del Sistema</option>
                </select>
              </div>
              {userFormError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{userFormError}</p>}
              {userFormSuccess && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{userFormSuccess}</p>}
              <button type="submit" disabled={creatingUser} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">
                <Plus className="h-4 w-4" />{creatingUser ? 'Creando…' : 'Crear usuario'}
              </button>
            </form>
          )}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="font-bold text-slate-900">Usuarios y perfiles de acceso</h2><p className="mt-1 text-xs text-slate-500">Cada perfil muestra sus permisos registrados en el directorio actual.</p></div>
              {canManage && <button type="button" onClick={onManageUsers} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-blue-800"><Users className="h-4 w-4" /> Administrar usuarios</button>}
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="border-y border-slate-100 text-[11px] uppercase tracking-wide text-slate-400"><tr><th className="py-2.5 pr-4">Usuario</th><th className="py-2.5 pr-4">Perfil</th><th className="py-2.5 pr-4">Nivel</th><th className="py-2.5">Permisos</th></tr></thead>
                <tbody>{users.map((user) => <tr key={user.id} className="border-b border-slate-50"><td className="py-3 pr-4"><p className="font-semibold text-slate-800">{user.nombre}</p><p className="text-xs text-slate-500">{user.email}</p></td><td className="py-3 pr-4">{user.rolTitulo}</td><td className="py-3 pr-4 text-xs text-slate-500">{user.nivelAcceso}</td><td className="py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{user.permisos.length} permisos</span></td></tr>)}</tbody>
              </table>
            </div>
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">Los perfiles asignan los roles disponibles del sistema. La configuración de políticas granulares por acción todavía requiere una fase posterior de RBAC.</p>
          </div>
        </div>
      )}

      {section === 'accounts' && (
        <div className="space-y-4">
          {canManage && (
            <form onSubmit={addAccount} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-[1fr_1.5fr_1fr_1.5fr_auto]">
              <input aria-label="Código de cuenta" value={accountCode} onChange={(event) => setAccountCode(event.target.value)} placeholder="Código (ej. 1.1.04)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
              <input aria-label="Nombre de cuenta" value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Nombre de cuenta" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
              <select aria-label="Tipo de cuenta" value={accountType} onChange={(event) => { setAccountType(event.target.value as AccountingAccountType); setAccountParent(''); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400">
                {accountingAccountTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
              <select aria-label="Cuenta agrupadora" value={accountParent} onChange={(event) => setAccountParent(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400">
                <option value="">Cuenta agrupadora</option>
                {accounts.filter((account) => account.isGroup && account.active && account.type === accountType).map((account) => <option key={account.id} value={account.code}>{account.code} · {account.name}</option>)}
              </select>
              <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"><Plus className="h-4 w-4" /><span className="sm:hidden xl:inline">Agregar</span></button>
            </form>
          )}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="font-bold text-slate-900">Plan de cuentas</h2><p className="mt-1 text-xs text-slate-500">Estructura inicial editable y preparada para ampliarse.</p></div>
              <label className="relative block sm:w-64"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input aria-label="Buscar cuentas" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por código o nombre" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs outline-none focus:border-blue-400" /></label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400"><tr><th className="px-4 py-2.5">Código / Cuenta</th><th className="px-4 py-2.5">Tipo</th><th className="px-4 py-2.5">Clase</th><th className="px-4 py-2.5">Estado</th><th className="px-4 py-2.5 text-right">Acción</th></tr></thead>
                <tbody>{visibleAccounts.map((account) => (
                  <tr key={account.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5" style={{ paddingLeft: `${16 + (account.code.split('.').length - 1) * 16}px` }}><span className="font-mono text-xs text-slate-500">{account.code}</span><span className={`ml-2 ${account.isGroup ? 'font-bold text-slate-800' : 'text-slate-700'}`}>{account.name}</span></td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{typeLabels[account.type]}</td>
                    <td className="px-4 py-2.5"><span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{account.isGroup ? 'Agrupadora' : 'Imputable'}</span></td>
                    <td className="px-4 py-2.5"><span className={`text-xs font-semibold ${account.active ? 'text-emerald-700' : 'text-slate-400'}`}>{account.active ? 'Activa' : 'Inactiva'}</span></td>
                    <td className="px-4 py-2.5 text-right">{canManage && !account.isGroup && <button type="button" onClick={() => toggleAccount(account)} className="text-xs font-semibold text-slate-500 hover:text-blue-700">{account.active ? 'Desactivar' : 'Activar'}</button>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {section === 'periods' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5"><h2 className="font-bold text-slate-900">Períodos contables</h2><p className="mt-1 text-xs text-slate-500">El período debe estar abierto y contener la fecha para admitir nuevas contabilizaciones.</p></div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {periods.slice().sort((left, right) => left.startDate.localeCompare(right.startDate)).map((period) => {
              const periodEntries = entries.filter((entry) => entry.periodId === period.id);
              const isOpen = period.status === 'open';
              return <div key={period.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-2"><div><h3 className="font-bold text-slate-800">{period.name}</h3><p className="mt-1 text-xs text-slate-500">{period.startDate} — {period.endDate}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${isOpen ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{isOpen ? 'Abierto' : 'Cerrado'}</span></div>
                <div className="mt-4 flex items-center justify-between"><span className="text-xs text-slate-500">{periodEntries.length} asientos</span>{canManage && <button type="button" onClick={() => togglePeriod(period)} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">{isOpen ? <><LockKeyhole className="h-3.5 w-3.5" /> Cerrar</> : <><RotateCcw className="h-3.5 w-3.5" /> Reabrir</>}</button>}</div>
              </div>;
            })}
          </div>
        </div>
      )}

      {section === 'year-end' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">Cierre contable anual</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Cierra las cuentas de ingreso y gasto del ejercicio y traspasa su resultado a resultados acumulados.
              Enero a noviembre deben estar cerrados; diciembre debe permanecer abierto hasta contabilizar el cierre.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-600">
                Ejercicio
                <select
                  value={selectedClosingYear}
                  onChange={(event) => setClosingYear(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800"
                >
                  {accountingYears.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Cuenta de resultados acumulados
                <select
                  value={selectedRetainedEarningsAccountId}
                  onChange={(event) => setRetainedEarningsAccountId(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800"
                >
                  <option value="">Selecciona una cuenta patrimonial</option>
                  {postingAccounts.filter((account) => account.type === 'patrimonio').map((account) => (
                    <option key={account.id} value={account.id}>{account.code} · {account.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
              Este cierre no calcula reserva legal automáticamente: la tasa, el límite y su aplicabilidad deben
              confirmarse para la empresa antes de registrar esa apropiación.
            </div>
            {annualCloseResult && (
              <div role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {annualCloseResult}
              </div>
            )}
            <button
              type="button"
              onClick={closeAnnualYear}
              disabled={!canManage || !accountingYears.length || !selectedRetainedEarningsAccountId}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LockKeyhole className="h-4 w-4" />
              Contabilizar cierre y cerrar diciembre
            </button>
          </div>
        </div>
      )}

      {section === 'entries' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="font-bold text-slate-900">Libro diario</h2><p className="mt-1 text-xs text-slate-500">Los asientos no se eliminan: los borradores se anulan y los contabilizados se corrigen mediante reversión.</p></div>
            {canManage && <button type="button" onClick={startNewEntry} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"><FilePlus2 className="h-4 w-4" /> Nuevo asiento</button>}
          </div>

          {entryFormOpen && (
            <form onSubmit={saveDraft} className="space-y-4 rounded-xl border border-blue-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-slate-900">Nuevo asiento · borrador</h3><p className="mt-1 text-xs text-slate-500">Se valida la partida doble al guardar.</p></div><button type="button" onClick={() => setEntryFormOpen(false)} aria-label="Cerrar formulario" className="rounded-md p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-xs font-semibold text-slate-600">Fecha<input required type="date" value={entryDate} onChange={(event) => {
                  setEntryDate(event.target.value);
                  const matching = periods.find((period) => period.status === 'open' && event.target.value >= period.startDate && event.target.value <= period.endDate);
                  if (matching) setEntryPeriodId(matching.id);
                }} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800" /></label>
                <label className="text-xs font-semibold text-slate-600">Período<input readOnly value={periods.find((period) => period.id === entryPeriodId)?.name || ''} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-normal text-slate-600" /></label>
                <label className="text-xs font-semibold text-slate-600 sm:col-span-1">Descripción<input required value={entryDescription} onChange={(event) => setEntryDescription(event.target.value)} placeholder="Motivo del asiento" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 sm:col-span-1" /></label>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[740px] text-left text-sm">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400"><tr><th className="px-2 py-2">Cuenta imputable</th><th className="px-2 py-2">Detalle</th><th className="px-2 py-2 text-right">Debe (VES)</th><th className="px-2 py-2 text-right">Haber (VES)</th><th /></tr></thead>
                  <tbody>{entryLines.map((line) => <tr key={line.id} className="border-t border-slate-100">
                    <td className="px-2 py-2"><select required aria-label="Cuenta contable" value={line.accountId} onChange={(event) => setLine(line.id, { accountId: event.target.value })} className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs"><option value="">Seleccionar cuenta</option>{postingAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select></td>
                    <td className="px-2 py-2"><input aria-label="Detalle de línea" value={line.description} onChange={(event) => setLine(line.id, { description: event.target.value })} placeholder="Detalle opcional" className="w-full rounded-md border border-slate-200 px-2 py-2 text-xs" /></td>
                    <td className="px-2 py-2"><input aria-label="Monto debe" type="number" min="0" step="0.01" value={line.debit || ''} onChange={(event) => setLine(line.id, { debit: Number(event.target.value) || 0, credit: 0 })} placeholder="0,00" className="w-full rounded-md border border-slate-200 px-2 py-2 text-right text-xs tabular-nums" /></td>
                    <td className="px-2 py-2"><input aria-label="Monto haber" type="number" min="0" step="0.01" value={line.credit || ''} onChange={(event) => setLine(line.id, { credit: Number(event.target.value) || 0, debit: 0 })} placeholder="0,00" className="w-full rounded-md border border-slate-200 px-2 py-2 text-right text-xs tabular-nums" /></td>
                    <td className="px-2 py-2"><button type="button" aria-label="Quitar línea" disabled={entryLines.length <= 2} onClick={() => setEntryLines((lines) => lines.filter((item) => item.id !== line.id))} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30"><X className="h-4 w-4" /></button></td>
                  </tr>)}</tbody>
                  <tfoot className="border-t border-slate-200 text-xs font-bold"><tr><td colSpan={2} className="px-2 py-3"><button type="button" onClick={() => setEntryLines((lines) => [...lines, blankLine()])} className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900"><Plus className="h-3.5 w-3.5" /> Añadir línea</button></td><td className="px-2 py-3 text-right tabular-nums">{money.format(entryTotals.debit)}</td><td className="px-2 py-3 text-right tabular-nums">{money.format(entryTotals.credit)}</td><td className="px-2 py-3 text-right"><span className={`inline-flex items-center gap-1 ${Math.abs(entryTotals.debit - entryTotals.credit) < 0.005 ? 'text-emerald-700' : 'text-rose-600'}`}>{Math.abs(entryTotals.debit - entryTotals.credit) < 0.005 ? <Check className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />}</span></td></tr></tfoot>
                </table>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3"><button type="button" onClick={() => setEntryFormOpen(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancelar</button><button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800">Guardar borrador</button></div>
            </form>
          )}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="divide-y divide-slate-100">
              {entries.length === 0 ? <div className="px-4 py-12 text-center"><BookOpenCheck className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-600">No hay asientos registrados</p><p className="mt-1 text-xs text-slate-400">Crea un asiento balanceado para iniciar el libro diario.</p></div> : entries.map((entry) => {
                const period = periods.find((item) => item.id === entry.periodId);
                const debit = entry.lines.reduce((sum, line) => sum + line.debit, 0);
                const credit = entry.lines.reduce((sum, line) => sum + line.credit, 0);
                return <article key={entry.id} className="p-4 sm:px-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-bold text-blue-700">{entry.number}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${entry.status === 'posted' ? 'bg-emerald-50 text-emerald-700' : entry.status === 'voided' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700'}`}>{entry.status === 'posted' ? 'Contabilizado' : entry.status === 'voided' ? 'Anulado' : 'Borrador'}</span>{entry.reversalOf && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700">Reversión</span>}</div><h3 className="mt-1 truncate text-sm font-semibold text-slate-800">{entry.description}</h3><p className="mt-1 text-xs text-slate-500">{entry.date} · {period?.name || 'Período eliminado'} · {entry.lines.length} líneas · creado por {entry.createdBy}{entry.voidReason ? ` · Motivo de anulación: ${entry.voidReason}` : ''}</p></div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end"><div className="mr-2 text-right"><p className="text-[10px] uppercase text-slate-400">Debe / Haber</p><p className="text-xs font-bold tabular-nums text-slate-700">{money.format(debit)} / {money.format(credit)}</p></div>{canManage && entry.status === 'draft' && <><button type="button" onClick={() => postEntry(entry)} className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-800"><CheckCircle2 className="h-3.5 w-3.5" /> Contabilizar</button><button type="button" onClick={() => voidDraft(entry)} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:border-rose-200 hover:text-rose-700">Anular borrador</button></>}{canManage && entry.status === 'posted' && !entry.reversalOf && !entries.some((item) => item.reversalOf === entry.id) && <button type="button" onClick={() => reverseEntry(entry)} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-violet-200 hover:text-violet-700"><RotateCcw className="h-3.5 w-3.5" /> Revertir</button>}</div>
                  </div>
                  <div className="mt-3 space-y-1.5 border-l-2 border-slate-100 pl-3">{entry.lines.map((line) => {
                    const account = accounts.find((item) => item.id === line.accountId);
                    return <div key={line.id} className="flex flex-wrap justify-between gap-2 text-xs text-slate-500"><span>{account ? `${account.code} · ${account.name}` : line.accountId}{line.description ? ` — ${line.description}` : ''}</span><span className="font-mono tabular-nums">{line.debit ? `D ${money.format(line.debit)}` : `H ${money.format(line.credit)}`}</span></div>;
                  })}</div>
                </article>;
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone }: {
  icon: typeof Landmark;
  label: string;
  value: string;
  detail: string;
  tone: 'blue' | 'violet' | 'emerald' | 'rose';
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    violet: 'bg-violet-50 text-violet-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    rose: 'bg-rose-50 text-rose-700',
  };
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-500">{label}</span><span className={`rounded-lg p-2 ${tones[tone]}`}><Icon className="h-4 w-4" /></span></div><p className="mt-3 text-xl font-extrabold tracking-tight text-slate-900">{value}</p><p className="mt-1 text-[11px] text-slate-400">{detail}</p></div>;
}

function QuickLink({ icon: Icon, label, detail, onClick }: {
  icon: typeof Landmark;
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-slate-50"><span className="rounded-md bg-slate-100 p-2 text-slate-600"><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-slate-700">{label}</span><span className="block text-[10px] text-slate-400">{detail}</span></span><ChevronRight className="h-4 w-4 text-slate-300" /></button>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-0.5 break-words text-sm text-slate-700">{value || '—'}</p></div>;
}
