import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Download, Plus, RefreshCw, WalletCards } from 'lucide-react';
import type { AppUser, Employee } from '../types';
import { getApiBase } from '../services/api';

type Account = { id: string; code: string; name: string; account_type: string; is_group: boolean };
type Supplier = {
  id: string; legal_name: string; trade_name: string | null; tax_identifier: string | null;
  email: string; phone: string; active: boolean; supplier_active: boolean;
};
type BankAccount = {
  id: string; bank_name: string; account_label: string; accounting_account_id: string;
  code: string; name: string;
};
type EmployeeRow = { id: string; cedula: string; first_name: string; last_name: string; status: string };
type EmployeeAsset = {
  id: string; asset_tag: string; name: string; category: string; serial_number: string;
  condition_status: string; availability_status: string; acquired_on: string | null;
  assignment_id: string | null; employee_id: string | null; first_name: string | null; last_name: string | null;
  expected_return_on: string | null; condition_at_delivery: string | null;
};
type Purchase = {
  id: string; document_type: string; external_reference: string | null; document_date: string;
  due_date: string | null; status: string; currency_code: string; party_name_snapshot: string;
  gross_amount: string; outstanding_amount: string | null;
};
type OpenItem = {
  id: string; party_role: 'customer' | 'supplier'; party_id: string; legal_name: string; external_reference: string | null;
  document_date: string; due_date: string | null; currency_code: string;
  original_amount: string; outstanding_amount: string;
};
type Settlement = {
  id: string; settlement_type: 'payable' | 'receivable'; legal_name: string;
  settlement_date: string; currency_code: string; amount: string; payment_method: string;
  reference: string | null; status: string; entry_number: string | null;
};
type Reconciliation = {
  id: string; bank_name: string; account_label: string; period_start: string; period_end: string;
  statement_balance: string; book_balance: string; difference: string; status: string;
};
type StatementLine = {
  id: string; transaction_date: string; description: string; reference: string | null;
  direction: 'debit' | 'credit'; amount: string; match_id: string | null;
};
type JournalLine = {
  id: string; entry_date: string; entry_number: string; description: string;
  debit: string; credit: string; match_id: string | null;
};
type ReportRow = Record<string, string | number | null>;
type Section = 'suppliers' | 'purchases' | 'settlements' | 'bank' | 'reports' | 'workforce';
type PurchaseLine = { description: string; quantity: string; unitPrice: string; discountAmount: string; taxAmount: string; accountId: string; taxAccountId: string };

const today = new Date().toISOString().slice(0, 10);
const fieldClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100';
const labelClass = 'mb-1 block text-xs font-semibold text-slate-600';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButtonClass = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getApiBase()}/api/erp${path}`, {
    credentials: 'include',
    ...init,
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  });
  if (!response.ok) {
    const text = await response.text();
    let message = text || `Error HTTP ${response.status}`;
    try {
      const body = JSON.parse(text) as { error?: string };
      message = body.error || message;
    } catch {
      // Keep the server response text for non-JSON errors.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

function money(value: string | number, currency = 'VES') {
  return new Intl.NumberFormat('es-VE', { style: 'currency', currency }).format(Number(value) || 0);
}

function Card({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block min-w-0"><span className={labelClass}>{label}</span>{children}</label>;
}

function StatusBadge({ status }: { status: string }) {
  const good = ['issued', 'approved', 'posted', 'closed', 'available', 'activo'].includes(status);
  return <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${good ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{status.replaceAll('_', ' ')}</span>;
}

export function ErpOperationsModule({ currentUser, employees }: { currentUser: AppUser; employees: Employee[] }) {
  const financeAccess = currentUser.rol === 'admin_sistema' || currentUser.rol === 'dueno';
  const [section, setSection] = useState<Section>(financeAccess ? 'suppliers' : 'workforce');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [employeeRows, setEmployeeRows] = useState<EmployeeRow[]>([]);
  const [assets, setAssets] = useState<EmployeeAsset[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [openItems, setOpenItems] = useState<OpenItem[]>([]);
  const [settlementType, setSettlementType] = useState<'payable' | 'receivable'>('payable');
  const [selectedOpenItem, setSelectedOpenItem] = useState('');
  const [selectedPayableAccount, setSelectedPayableAccount] = useState<Record<string, string>>({});
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [selectedReconciliation, setSelectedReconciliation] = useState('');
  const [statementLines, setStatementLines] = useState<StatementLine[]>([]);
  const [journalLines, setJournalLines] = useState<JournalLine[]>([]);
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const [reportName, setReportName] = useState('trial_balance');
  const [reportFrom, setReportFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [reportTo, setReportTo] = useState(today);
  const [selectedStatementLine, setSelectedStatementLine] = useState('');
  const [selectedJournalLine, setSelectedJournalLine] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const workforceRequests = Promise.all([
        apiRequest<{ employees: EmployeeRow[] }>('/workforce/employees'),
        apiRequest<{ assets: EmployeeAsset[] }>('/workforce/assets'),
      ]);
      if (financeAccess) {
        const [bootstrap, supplierData, purchaseData, settlementData, receivableItems, payableItems, bankData, reconciliationData, workforce] = await Promise.all([
          apiRequest<{ accounts: Account[] }>('/bootstrap'),
          apiRequest<{ suppliers: Supplier[] }>('/suppliers'),
          apiRequest<{ documents: Purchase[] }>('/purchases'),
          apiRequest<{ settlements: Settlement[] }>('/settlements'),
          apiRequest<{ items: OpenItem[] }>('/open-items?role=customer'),
          apiRequest<{ items: OpenItem[] }>('/open-items?role=supplier'),
          apiRequest<{ accounts: BankAccount[] }>('/bank/accounts'),
          apiRequest<{ reconciliations: Reconciliation[] }>('/bank/reconciliations'),
          workforceRequests,
        ]);
        setAccounts(bootstrap.accounts);
        setSuppliers(supplierData.suppliers);
        setPurchases(purchaseData.documents);
        setSettlements(settlementData.settlements);
        setOpenItems([...receivableItems.items, ...payableItems.items]);
        setBankAccounts(bankData.accounts);
        setReconciliations(reconciliationData.reconciliations);
        setEmployeeRows(workforce[0].employees);
        setAssets(workforce[1].assets);
      } else {
        const [workforce, assetData] = await workforceRequests;
        setEmployeeRows(workforce.employees);
        setAssets(assetData.assets);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los datos del módulo.');
    } finally {
      setLoading(false);
    }
  }, [financeAccess]);

  useEffect(() => { void loadData(); }, [loadData]);

  const run = async (action: () => Promise<void>, success: string): Promise<boolean> => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(success);
      await loadData();
      return true;
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'La operación no pudo completarse.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>, action: () => Promise<void>, success: string) => {
    const form = event.currentTarget;
    event.preventDefault();
    void run(action, success).then((succeeded) => {
      if (succeeded) form.reset();
    });
  };

  const syncEmployees = () => run(async () => {
    if (!employees.length) throw new Error('No hay empleados locales para sincronizar.');
    const result = await apiRequest<{ synchronized: number }>('/workforce/employees/sync', {
      method: 'POST', body: JSON.stringify({ employees }),
    });
    setNotice(`${result.synchronized} empleados sincronizados.`);
  }, 'Sincronización de RR. HH. completada.');

  const sections: { id: Section; label: string }[] = [
    ...(financeAccess ? [
      { id: 'suppliers' as const, label: 'Proveedores' },
      { id: 'purchases' as const, label: 'Compras' },
      { id: 'settlements' as const, label: 'Pagos y cobros' },
      { id: 'bank' as const, label: 'Bancos' },
      { id: 'reports' as const, label: 'Informes financieros' },
    ] : []),
    { id: 'workforce', label: 'RR. HH. y bienes' },
  ];

  const addPurchaseLine = () => setPurchaseLines((lines) => [...lines, emptyPurchaseLine()]);
  const [purchaseLines, setPurchaseLines] = useState<PurchaseLine[]>([emptyPurchaseLine()]);

  if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">Cargando operaciones ERP…</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl bg-gradient-to-r from-slate-950 to-blue-950 p-5 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-blue-200">Operaciones conectadas a PostgreSQL</p>
          <h1 className="mt-1 text-xl font-bold">ERP financiero y RR. HH.</h1>
          <p className="mt-1 text-sm text-slate-300">Compras, liquidaciones, conciliación, informes XLSX y custodia de bienes.</p>
        </div>
        <button className={secondaryButtonClass} onClick={() => void loadData()} disabled={busy}>
          <RefreshCw className="h-4 w-4" /> Actualizar
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {sections.map((item) => (
          <button key={item.id} className={`rounded-lg px-3 py-2 text-sm font-semibold ${section === item.id ? 'bg-blue-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`} onClick={() => setSection(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

      {section === 'suppliers' && financeAccess && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <Card title="Registrar proveedor">
            <form className="space-y-3" onSubmit={(event) => submit(event, async () => {
              const form = new FormData(event.currentTarget);
              await apiRequest('/suppliers', { method: 'POST', body: JSON.stringify({
                legalName: form.get('legalName'), tradeName: form.get('tradeName'),
                taxIdentifier: form.get('taxIdentifier'), email: form.get('email'),
                phone: form.get('phone'), partyKind: form.get('partyKind'),
              }) });
            }, 'Proveedor registrado.')}>
              <Field label="Razón social"><input name="legalName" className={fieldClass} required maxLength={250} /></Field>
              <Field label="Tipo"><select name="partyKind" className={fieldClass}><option value="organization">Empresa</option><option value="person">Persona</option></select></Field>
              <Field label="Nombre comercial"><input name="tradeName" className={fieldClass} maxLength={250} /></Field>
              <Field label="RIF / identificación"><input name="taxIdentifier" className={fieldClass} maxLength={80} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Correo"><input name="email" type="email" className={fieldClass} /></Field>
                <Field label="Teléfono"><input name="phone" className={fieldClass} maxLength={80} /></Field>
              </div>
              <button className={buttonClass} disabled={busy}><Plus className="h-4 w-4" /> Guardar proveedor</button>
            </form>
          </Card>
          <Card title={`Proveedores (${suppliers.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500"><tr><th className="pb-2">Razón social</th><th>RIF</th><th>Contacto</th><th>Estado</th></tr></thead>
                <tbody>{suppliers.map((supplier) => <tr key={supplier.id} className="border-t border-slate-100">
                  <td className="py-3 font-semibold text-slate-800">{supplier.legal_name}<span className="block text-xs font-normal text-slate-500">{supplier.trade_name}</span></td>
                  <td>{supplier.tax_identifier || '—'}</td><td>{supplier.email || supplier.phone || '—'}</td>
                  <td><StatusBadge status={supplier.supplier_active ? 'activo' : 'inactivo'} /></td>
                </tr>)}</tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {section === 'purchases' && financeAccess && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <Card title="Registrar compra u orden">
            <form className="space-y-4" onSubmit={(event) => submit(event, async () => {
              const form = new FormData(event.currentTarget);
              const documentType = String(form.get('documentType'));
              const lines = purchaseLines.map((line) => ({
                ...line,
                quantity: Number(line.quantity),
                unitPrice: Number(line.unitPrice),
                discountAmount: Number(line.discountAmount || 0),
                taxAmount: Number(line.taxAmount || 0),
              }));
              const payableAccountId = String(form.get('payableAccountId') || '');
              if (documentType === 'supplier_invoice' && !payableAccountId) {
                throw new Error('Seleccione la cuenta contable por pagar antes de guardar la factura.');
              }
              for (const [index, line] of lines.entries()) {
                if (line.discountAmount < 0 || line.discountAmount > line.quantity * line.unitPrice) {
                  throw new Error(`El descuento de la línea ${index + 1} debe estar entre cero y el importe bruto de la línea.`);
                }
                if (line.taxAmount < 0) throw new Error(`El impuesto de la línea ${index + 1} no puede ser negativo.`);
              }
              const result = await apiRequest<{ document: { id: string } }>('/purchases', { method: 'POST', body: JSON.stringify({
                documentType, supplierId: form.get('supplierId'), documentDate: form.get('documentDate'),
                dueDate: form.get('dueDate') || null, externalReference: form.get('externalReference'),
                currencyCode: form.get('currencyCode'), exchangeRate: Number(form.get('exchangeRate') || 1),
                description: form.get('description'), lines,
              }) });
              if (documentType === 'supplier_invoice') {
                await apiRequest(`/purchases/${result.document.id}/issue`, { method: 'POST', body: JSON.stringify({ payableAccountId }) });
              }
              setPurchaseLines([emptyPurchaseLine()]);
            }, 'Documento de compra guardado y, si era factura, contabilizado.')}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tipo de documento"><select name="documentType" className={fieldClass}><option value="supplier_invoice">Factura de proveedor</option><option value="purchase_order">Orden de compra</option></select></Field>
                <Field label="Proveedor"><select name="supplierId" className={fieldClass} required defaultValue=""><option value="" disabled>Seleccione…</option>{suppliers.filter((supplier) => supplier.supplier_active).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.legal_name}</option>)}</select></Field>
                <Field label="Fecha"><input name="documentDate" type="date" className={fieldClass} defaultValue={today} required /></Field>
                <Field label="Vencimiento"><input name="dueDate" type="date" className={fieldClass} /></Field>
                <Field label="Referencia de factura"><input name="externalReference" className={fieldClass} maxLength={250} /></Field>
                <Field label="Moneda"><select name="currencyCode" className={fieldClass}><option value="VES">VES</option><option value="USD">USD</option><option value="EUR">EUR</option></select></Field>
                <Field label="Tasa de cambio"><input name="exchangeRate" className={fieldClass} type="number" min="0.00000001" step="0.00000001" defaultValue="1" /></Field>
                <Field label="Cuenta por pagar (factura)"><select name="payableAccountId" className={fieldClass} defaultValue=""><option value="">Seleccione…</option>{accounts.filter((account) => account.account_type === 'pasivo' && !account.is_group).map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select></Field>
              </div>
              <Field label="Descripción"><input name="description" className={fieldClass} maxLength={500} /></Field>
              <div className="space-y-3">
                {purchaseLines.map((line, index) => (
                  <div key={index} className="rounded-lg border border-slate-200 p-3">
                    <div className="mb-2 flex items-center justify-between"><strong className="text-xs text-slate-700">Línea {index + 1}</strong>{purchaseLines.length > 1 && <button type="button" className="text-xs font-semibold text-rose-700" onClick={() => setPurchaseLines((prev) => prev.filter((_, i) => i !== index))}>Quitar</button>}</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Field label="Descripción"><input className={fieldClass} required value={line.description} onChange={(e) => updatePurchaseLine(index, 'description', e.target.value, setPurchaseLines)} /></Field>
                      <Field label="Cuenta de gasto / activo"><select className={fieldClass} required value={line.accountId} onChange={(e) => updatePurchaseLine(index, 'accountId', e.target.value, setPurchaseLines)}><option value="">Seleccione…</option>{accounts.filter((account) => ['activo', 'gasto'].includes(account.account_type) && !account.is_group).map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select></Field>
                      <Field label="Cantidad (unidades)"><input className={fieldClass} type="number" min="0.0001" step="0.0001" required value={line.quantity} onChange={(e) => updatePurchaseLine(index, 'quantity', e.target.value, setPurchaseLines)} /></Field>
                      <Field label="Precio unitario"><input className={fieldClass} type="number" min="0" step="0.01" required value={line.unitPrice} onChange={(e) => updatePurchaseLine(index, 'unitPrice', e.target.value, setPurchaseLines)} /></Field>
                      <Field label="Descuento"><input className={fieldClass} type="number" min="0" step="0.01" value={line.discountAmount} onChange={(e) => updatePurchaseLine(index, 'discountAmount', e.target.value, setPurchaseLines)} /></Field>
                      <Field label="Impuesto soportado"><input className={fieldClass} type="number" min="0" step="0.01" value={line.taxAmount} onChange={(e) => updatePurchaseLine(index, 'taxAmount', e.target.value, setPurchaseLines)} /></Field>
                      {Number(line.taxAmount) > 0 && <Field label="Cuenta de impuesto recuperable"><select className={fieldClass} required value={line.taxAccountId} onChange={(e) => updatePurchaseLine(index, 'taxAccountId', e.target.value, setPurchaseLines)}><option value="">Seleccione…</option>{accounts.filter((account) => account.account_type === 'activo' && !account.is_group).map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select></Field>}
                    </div>
                  </div>
                ))}
                <button type="button" className={secondaryButtonClass} onClick={addPurchaseLine}><Plus className="h-4 w-4" /> Añadir línea</button>
              </div>
              <button className={buttonClass} disabled={busy || !suppliers.some((supplier) => supplier.supplier_active)}><Plus className="h-4 w-4" /> Guardar compra</button>
            </form>
          </Card>
          <Card title={`Compras registradas (${purchases.length})`}>
            <div className="space-y-3">
              {purchases.map((purchase) => <div key={purchase.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="font-semibold text-slate-800">{purchase.party_name_snapshot} · {purchase.external_reference || purchase.id.slice(0, 8)}</p><p className="text-xs text-slate-500">{purchase.document_type === 'supplier_invoice' ? 'Factura proveedor' : 'Orden de compra'} · {String(purchase.document_date).slice(0, 10)} · {money(purchase.gross_amount, purchase.currency_code)}</p></div>
                <div className="flex flex-wrap items-center gap-2"><StatusBadge status={purchase.status} />{purchase.status === 'draft' && purchase.document_type === 'purchase_order' && <button className={secondaryButtonClass} disabled={busy} onClick={() => void run(async () => { await apiRequest(`/purchases/${purchase.id}/approve`, { method: 'POST', body: JSON.stringify({}) }); }, 'Orden aprobada.')}>Aprobar</button>}{purchase.status === 'draft' && purchase.document_type === 'supplier_invoice' && <><select aria-label={`Cuenta por pagar para factura ${purchase.external_reference || purchase.id.slice(0, 8)}`} className={fieldClass} value={selectedPayableAccount[purchase.id] || ''} onChange={(event) => setSelectedPayableAccount((current) => ({ ...current, [purchase.id]: event.target.value }))}><option value="">Cuenta por pagar…</option>{accounts.filter((account) => account.account_type === 'pasivo' && !account.is_group).map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select><button className={secondaryButtonClass} disabled={busy || !selectedPayableAccount[purchase.id]} onClick={() => void run(async () => { await apiRequest(`/purchases/${purchase.id}/issue`, { method: 'POST', body: JSON.stringify({ payableAccountId: selectedPayableAccount[purchase.id] }) }); }, 'Factura contabilizada.')}>Contabilizar</button></>}</div>
              </div>)}
              {!purchases.length && <p className="text-sm text-slate-500">No hay compras registradas.</p>}
            </div>
          </Card>
        </div>
      )}

      {section === 'settlements' && financeAccess && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <Card title="Registrar pago o cobro">
            <form className="space-y-3" onSubmit={(event) => submit(event, async () => {
              const form = new FormData(event.currentTarget);
              const type = settlementType;
              const item = openItems.find((openItem) => openItem.id === String(form.get('openItemId')));
              const expectedRole = type === 'payable' ? 'supplier' : 'customer';
              if (!item || item.party_role !== expectedRole) throw new Error('Seleccione una factura pendiente del tipo de operación elegido.');
              const amount = Number(form.get('amount'));
              if (!Number.isFinite(amount) || amount <= 0 || amount > Number(item.outstanding_amount)) {
                throw new Error('El importe debe ser positivo y no superar el saldo pendiente.');
              }
              const payableAccountId = String(form.get('payableAccountId') || '');
              if (type === 'payable' && !payableAccountId) throw new Error('Seleccione la cuenta contable por pagar.');
              const created = await apiRequest<{ settlement: { id: string } }>('/settlements', { method: 'POST', body: JSON.stringify({
                settlementType: type, partyId: item.party_id, settlementDate: form.get('settlementDate'),
                currencyCode: item.currency_code, exchangeRate: Number(form.get('exchangeRate') || 1),
                amount, cashAccountId: form.get('cashAccountId'), payableAccountId,
                paymentMethod: form.get('paymentMethod'), reference: form.get('reference'),
                allocations: [{ openItemId: item.id, amount }],
              }) });
              await apiRequest(`/settlements/${created.settlement.id}/post`, { method: 'POST', body: JSON.stringify({ payableAccountId }) });
              setSelectedOpenItem('');
            }, 'Pago/cobro aplicado y contabilizado.')}>
              <Field label="Operación"><select name="settlementType" className={fieldClass} value={settlementType} onChange={(event) => { setSettlementType(event.target.value as 'payable' | 'receivable'); setSelectedOpenItem(''); }}><option value="payable">Pago a proveedor</option><option value="receivable">Cobro a cliente</option></select></Field>
              <Field label="Factura pendiente"><select name="openItemId" className={fieldClass} required value={selectedOpenItem} onChange={(event) => setSelectedOpenItem(event.target.value)}><option value="" disabled>Seleccione factura…</option>{openItems.filter((item) => item.party_role === (settlementType === 'payable' ? 'supplier' : 'customer')).map((item) => <option key={item.id} value={item.id}>{item.legal_name} · {item.external_reference || item.id.slice(0, 8)} · saldo {money(item.outstanding_amount, item.currency_code)}</option>)}</select></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Fecha"><input name="settlementDate" className={fieldClass} type="date" defaultValue={today} required /></Field>
                <Field label="Importe aplicado"><input name="amount" className={fieldClass} type="number" min="0.01" step="0.01" required /></Field>
                <Field label="Cuenta de caja/banco"><select name="cashAccountId" className={fieldClass} required defaultValue=""><option value="" disabled>Seleccione…</option>{accounts.filter((account) => account.account_type === 'activo' && !account.is_group).map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select></Field>
                {settlementType === 'payable' && <Field label="Cuenta por pagar"><select name="payableAccountId" className={fieldClass} required defaultValue=""><option value="" disabled>Seleccione…</option>{accounts.filter((account) => account.account_type === 'pasivo' && !account.is_group).map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select></Field>}
                <Field label="Medio de pago"><select name="paymentMethod" className={fieldClass}><option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="otro">Otro</option></select></Field>
                <Field label="Referencia"><input name="reference" className={fieldClass} maxLength={250} /></Field>
                <Field label="Tasa para moneda extranjera"><input name="exchangeRate" className={fieldClass} type="number" min="0.00000001" step="0.00000001" defaultValue="1" /></Field>
              </div>
              <p className="text-xs text-slate-500">El importe debe estar en la misma moneda que la factura seleccionada. Cobros requieren la cuenta por cobrar configurada en el ERP.</p>
              <button className={buttonClass} disabled={busy || openItems.length === 0}><WalletCards className="h-4 w-4" /> Registrar y contabilizar</button>
            </form>
          </Card>
          <Card title={`Pagos y cobros (${settlements.length})`}>
            <div className="space-y-3">{settlements.map((settlement) => <div key={settlement.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
              <div><p className="font-semibold text-slate-800">{settlement.settlement_type === 'payable' ? 'Pago' : 'Cobro'} · {settlement.legal_name}</p><p className="text-xs text-slate-500">{String(settlement.settlement_date).slice(0, 10)} · {settlement.payment_method} · {settlement.reference || 'Sin referencia'} · {money(settlement.amount, settlement.currency_code)}</p></div>
              <div className="flex items-center gap-2"><StatusBadge status={settlement.status} />{settlement.entry_number && <span className="text-xs text-slate-500">{settlement.entry_number}</span>}</div>
            </div>)}</div>
          </Card>
        </div>
      )}

      {section === 'bank' && financeAccess && (
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-2">
            <Card title="Registrar cuenta bancaria">
              <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => submit(event, async () => {
                const form = new FormData(event.currentTarget);
                await apiRequest('/bank/accounts', { method: 'POST', body: JSON.stringify({
                  bankName: form.get('bankName'), accountLabel: form.get('accountLabel'),
                  accountNumberLast4: form.get('accountNumberLast4'), accountingAccountId: form.get('accountingAccountId'),
                  accountType: form.get('accountType'),
                }) });
              }, 'Cuenta bancaria registrada.')}>
                <Field label="Banco"><input name="bankName" className={fieldClass} required /></Field>
                <Field label="Nombre de la cuenta"><input name="accountLabel" className={fieldClass} required /></Field>
                <Field label="Últimos cuatro dígitos"><input name="accountNumberLast4" className={fieldClass} inputMode="numeric" pattern="[0-9]{4}" maxLength={4} /></Field>
                <Field label="Tipo"><select name="accountType" className={fieldClass}><option value="checking">Corriente</option><option value="savings">Ahorro</option><option value="other">Otra</option></select></Field>
                <Field label="Cuenta contable asociada"><select name="accountingAccountId" className={fieldClass} required defaultValue=""><option value="" disabled>Seleccione…</option>{accounts.filter((account) => account.account_type === 'activo' && !account.is_group).map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select></Field>
                <div className="flex items-end"><button className={buttonClass} disabled={busy}><Plus className="h-4 w-4" /> Guardar cuenta</button></div>
              </form>
            </Card>
            <Card title="Importar movimiento del estado de cuenta">
              <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => submit(event, async () => {
                const form = new FormData(event.currentTarget);
                const bankAccountId = String(form.get('bankAccountId'));
                await apiRequest(`/bank/accounts/${bankAccountId}/statement-lines`, { method: 'POST', body: JSON.stringify({ lines: [{
                  transactionDate: form.get('transactionDate'), description: form.get('description'),
                  reference: form.get('reference'), direction: form.get('direction'), amount: Number(form.get('amount')),
                }] }) });
              }, 'Movimiento bancario importado.')}>
                <Field label="Cuenta"><select name="bankAccountId" className={fieldClass} required defaultValue=""><option value="" disabled>Seleccione…</option>{bankAccounts.map((account) => <option key={account.id} value={account.id}>{account.bank_name} · {account.account_label}</option>)}</select></Field>
                <Field label="Fecha"><input name="transactionDate" className={fieldClass} type="date" defaultValue={today} required /></Field>
                <Field label="Descripción"><input name="description" className={fieldClass} required /></Field>
                <Field label="Referencia"><input name="reference" className={fieldClass} /></Field>
                <Field label="Tipo de movimiento"><select name="direction" className={fieldClass}><option value="debit">Débito bancario</option><option value="credit">Crédito bancario</option></select></Field>
                <Field label="Importe"><input name="amount" className={fieldClass} type="number" min="0.01" step="0.01" required /></Field>
                <div className="sm:col-span-2"><button className={buttonClass} disabled={busy || bankAccounts.length === 0}><Plus className="h-4 w-4" /> Importar línea</button></div>
              </form>
              <p className="mt-3 text-xs text-slate-500">Las importaciones repetidas se detectan por huella de fecha, referencia, descripción, dirección e importe.</p>
            </Card>
          </div>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <Card title="Abrir conciliación bancaria">
              <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => submit(event, async () => {
                const form = new FormData(event.currentTarget);
                const result = await apiRequest<{ reconciliation: { id: string } }>('/bank/reconciliations', { method: 'POST', body: JSON.stringify({
                  bankAccountId: form.get('bankAccountId'), periodStart: form.get('periodStart'),
                  periodEnd: form.get('periodEnd'), statementBalance: Number(form.get('statementBalance')),
                }) });
                setSelectedReconciliation(result.reconciliation.id);
              }, 'Conciliación creada.')}>
                <Field label="Cuenta bancaria"><select name="bankAccountId" className={fieldClass} required defaultValue=""><option value="" disabled>Seleccione…</option>{bankAccounts.map((account) => <option key={account.id} value={account.id}>{account.bank_name} · {account.account_label}</option>)}</select></Field>
                <Field label="Saldo final del estado (VES)"><input name="statementBalance" className={fieldClass} type="number" step="0.01" required /></Field>
                <Field label="Desde"><input name="periodStart" className={fieldClass} type="date" required /></Field>
                <Field label="Hasta"><input name="periodEnd" className={fieldClass} type="date" required /></Field>
                <div className="sm:col-span-2"><button className={buttonClass} disabled={busy || bankAccounts.length === 0}>Crear conciliación</button></div>
              </form>
              <div className="mt-4 space-y-2">{reconciliations.map((rec) => <button key={rec.id} className={`w-full rounded-lg border p-3 text-left ${selectedReconciliation === rec.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`} onClick={() => setSelectedReconciliation(rec.id)}>
                <div className="flex justify-between gap-2"><strong className="text-sm">{rec.bank_name} · {rec.account_label}</strong><StatusBadge status={rec.status} /></div>
                <div className="mt-1 text-xs text-slate-500">{String(rec.period_start).slice(0, 10)} — {String(rec.period_end).slice(0, 10)} · Diferencia: {money(rec.difference)}</div>
              </button>)}</div>
              {selectedReconciliation && <button className={`${buttonClass} mt-3 w-full`} disabled={busy} onClick={() => void run(async () => {
                await apiRequest(`/bank/reconciliations/${selectedReconciliation}/close`, { method: 'POST', body: JSON.stringify({}) });
              }, 'Conciliación cerrada.')}>Cerrar conciliación (requiere diferencia cero)</button>}
            </Card>
            <Card title="Asociar movimiento bancario con asiento">
              {selectedReconciliation ? <div className="space-y-3">
                <button className={secondaryButtonClass} disabled={busy} onClick={() => void run(async () => {
                  const data = await apiRequest<{ statementLines: StatementLine[]; journalLines: JournalLine[] }>(`/bank/reconciliations/${selectedReconciliation}/lines`);
                  setStatementLines(data.statementLines); setJournalLines(data.journalLines);
                }, 'Movimientos actualizados.')}>Cargar movimientos</button>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Línea de banco sin asociar"><select className={fieldClass} value={selectedStatementLine} onChange={(event) => setSelectedStatementLine(event.target.value)}><option value="">Seleccione…</option>{statementLines.filter((line) => !line.match_id).map((line) => <option key={line.id} value={line.id}>{String(line.transaction_date).slice(0, 10)} · {line.description} · {money(line.amount)}</option>)}</select></Field>
                  <Field label="Línea contable sin asociar"><select className={fieldClass} value={selectedJournalLine} onChange={(event) => setSelectedJournalLine(event.target.value)}><option value="">Seleccione…</option>{journalLines.filter((line) => !line.match_id).map((line) => <option key={line.id} value={line.id}>{String(line.entry_date).slice(0, 10)} · {line.entry_number} · {line.description} · {money(Number(line.debit) - Number(line.credit))}</option>)}</select></Field>
                </div>
                <button className={buttonClass} disabled={busy || !selectedStatementLine || !selectedJournalLine} onClick={() => void run(async () => {
                  await apiRequest(`/bank/reconciliations/${selectedReconciliation}/matches`, { method: 'POST', body: JSON.stringify({ statementLineId: selectedStatementLine, journalLineId: selectedJournalLine }) });
                  setSelectedStatementLine(''); setSelectedJournalLine('');
                  const data = await apiRequest<{ statementLines: StatementLine[]; journalLines: JournalLine[] }>(`/bank/reconciliations/${selectedReconciliation}/lines`);
                  setStatementLines(data.statementLines); setJournalLines(data.journalLines);
                }, 'Movimientos asociados.')}>Asociar líneas</button>
                <div className="grid gap-4 md:grid-cols-2">
                  <div><h3 className="mb-2 text-xs font-bold uppercase text-slate-500">Estado de cuenta</h3>{statementLines.map((line) => <p key={line.id} className="border-t border-slate-100 py-2 text-xs">{line.description} · {money(line.amount)} {line.match_id && <span className="text-emerald-700">· Asociada</span>}</p>)}</div>
                  <div><h3 className="mb-2 text-xs font-bold uppercase text-slate-500">Libro contable</h3>{journalLines.map((line) => <p key={line.id} className="border-t border-slate-100 py-2 text-xs">{line.entry_number} · {line.description} · {money(Number(line.debit) - Number(line.credit))} {line.match_id && <span className="text-emerald-700">· Asociada</span>}</p>)}</div>
                </div>
              </div> : <p className="text-sm text-slate-500">Seleccione una conciliación para cargar y asociar los movimientos.</p>}
            </Card>
          </div>
        </div>
      )}

      {section === 'reports' && financeAccess && (
        <div className="space-y-5">
          <Card title="Informes contables y financieros">
            <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(event) => submit(event, async () => {
              const params = new URLSearchParams({ from: reportFrom, to: reportTo });
              const response = await fetch(`${getApiBase()}/api/erp/reports/${reportName}?${params}`, { credentials: 'include' });
              if (!response.ok) {
                const body = await response.json() as { error?: string };
                throw new Error(body.error || 'No se pudo generar el informe.');
              }
              const data = await response.json() as { rows: ReportRow[] };
              setReportRows(data.rows);
            }, 'Informe generado.')}>
              <Field label="Informe"><select className={fieldClass} value={reportName} onChange={(event) => setReportName(event.target.value)}><option value="trial_balance">Balance de comprobación</option><option value="balance_sheet">Balance general</option><option value="income_statement">Estado de resultados</option><option value="general_ledger">Libro mayor</option></select></Field>
              <Field label="Desde"><input className={fieldClass} type="date" value={reportFrom} onChange={(event) => setReportFrom(event.target.value)} required /></Field>
              <Field label="Hasta"><input className={fieldClass} type="date" value={reportTo} onChange={(event) => setReportTo(event.target.value)} required /></Field>
              <div className="flex items-end"><button className={buttonClass} disabled={busy}>Consultar</button></div>
              <div className="flex items-end"><button type="button" className={secondaryButtonClass} disabled={busy} onClick={() => void run(async () => {
                const response = await fetch(`${getApiBase()}/api/erp/reports/${reportName}?${new URLSearchParams({ from: reportFrom, to: reportTo, format: 'xlsx' })}`, { credentials: 'include' });
                if (!response.ok) {
                  const body = await response.json() as { error?: string };
                  throw new Error(body.error || 'No se pudo exportar el informe.');
                }
                const file = await response.blob();
                const url = URL.createObjectURL(file);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = `${reportName}-${reportFrom}-${reportTo}.xlsx`;
                anchor.click();
                URL.revokeObjectURL(url);
              }, 'Archivo Excel descargado.')}><Download className="h-4 w-4" /> Exportar Excel</button></div>
            </form>
            <p className="mt-3 text-xs text-slate-500">Los informes se generan desde los asientos contabilizados de la empresa y el período consultado.</p>
          </Card>
          <Card title={`Vista del informe (${reportRows.length} filas)`}>
            {reportRows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{Object.keys(reportRows[0]).map((key) => <th key={key} className="p-2 font-semibold">{key.replaceAll('_', ' ')}</th>)}</tr></thead><tbody>{reportRows.map((row, index) => <tr key={index} className="border-t border-slate-100">{Object.values(row).map((value, col) => <td key={col} className="p-2">{value == null ? '—' : String(value)}</td>)}</tr>)}</tbody></table></div> : <p className="text-sm text-slate-500">Seleccione el informe y el rango de fechas, y pulse Consultar.</p>}
          </Card>
        </div>
      )}

      {section === 'workforce' && (
        <div className="space-y-5">
          <Card title="Sincronización del padrón de RR. HH." action={<button className={buttonClass} disabled={busy || employees.length === 0} onClick={syncEmployees}><RefreshCw className="h-4 w-4" /> Sincronizar {employees.length} empleados</button>}>
            <p className="text-sm text-slate-600">Envía al ERP el padrón local de RR. HH. de esta sesión. La sincronización conserva las empresas separadas y el servidor rechaza empleados pertenecientes a otra empresa.</p>
            <p className="mt-2 text-xs text-slate-500">En servidor: {employeeRows.length} empleados · En esta sesión: {employees.length}</p>
          </Card>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <Card title="Registrar bien bajo custodia">
              <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => submit(event, async () => {
                const form = new FormData(event.currentTarget);
                await apiRequest('/workforce/assets', { method: 'POST', body: JSON.stringify({
                  assetTag: form.get('assetTag'), name: form.get('name'), category: form.get('category'),
                  serialNumber: form.get('serialNumber'), conditionStatus: form.get('conditionStatus'),
                  acquiredOn: form.get('acquiredOn') || null, notes: form.get('notes'),
                }) });
              }, 'Bien registrado.')}>
                <Field label="Código / etiqueta"><input name="assetTag" className={fieldClass} required maxLength={80} /></Field>
                <Field label="Nombre del bien"><input name="name" className={fieldClass} required /></Field>
                <Field label="Categoría"><input name="category" className={fieldClass} /></Field>
                <Field label="Serial"><input name="serialNumber" className={fieldClass} /></Field>
                <Field label="Condición"><select name="conditionStatus" className={fieldClass}><option value="new">Nuevo</option><option value="good">Bueno</option><option value="fair">Regular</option><option value="damaged">Dañado</option></select></Field>
                <Field label="Fecha de adquisición"><input name="acquiredOn" className={fieldClass} type="date" /></Field>
                <div className="sm:col-span-2"><button className={buttonClass} disabled={busy}><Plus className="h-4 w-4" /> Guardar bien</button></div>
              </form>
            </Card>
            <Card title={`Bienes y custodia (${assets.length})`}>
              <div className="space-y-3">
                {assets.map((asset) => <div key={asset.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold text-slate-800">{asset.asset_tag} · {asset.name}</p><p className="text-xs text-slate-500">{asset.category || 'Sin categoría'} · Serial {asset.serial_number || '—'} · Condición {asset.condition_status}</p><p className="mt-1 text-xs text-slate-600">{asset.employee_id ? `Custodio: ${asset.first_name} ${asset.last_name}` : 'Sin custodio activo'}</p></div><StatusBadge status={asset.availability_status} /></div>
                  {asset.assignment_id ? <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(event) => submit(event, async () => {
                    const form = new FormData(event.currentTarget);
                    await apiRequest(`/workforce/assets/${asset.id}/return`, { method: 'POST', body: JSON.stringify({ assignmentId: asset.assignment_id, conditionAtReturn: form.get('conditionAtReturn'), returnNotes: form.get('returnNotes') }) });
                  }, 'Devolución registrada; el historial de custodia quedó conservado.')}>
                    <Field label="Condición al devolver"><select name="conditionAtReturn" className={fieldClass}><option value="good">Bueno</option><option value="new">Nuevo</option><option value="fair">Regular</option><option value="damaged">Dañado</option></select></Field>
                    <Field label="Notas"><input name="returnNotes" className={fieldClass} /></Field>
                    <button className={secondaryButtonClass} disabled={busy}>Registrar devolución</button>
                  </form> : asset.availability_status === 'available' ? <form className="mt-3 grid gap-2 sm:grid-cols-3" onSubmit={(event) => submit(event, async () => {
                    const form = new FormData(event.currentTarget);
                    await apiRequest(`/workforce/assets/${asset.id}/assign`, { method: 'POST', body: JSON.stringify({
                      employeeId: form.get('employeeId'), expectedReturnOn: form.get('expectedReturnOn') || null,
                      conditionAtDelivery: asset.condition_status, deliveryNotes: form.get('deliveryNotes'),
                    }) });
                  }, 'Entrega y custodia registradas.')}>
                    <Field label="Empleado"><select name="employeeId" className={fieldClass} required defaultValue=""><option value="" disabled>Seleccione…</option>{employeeRows.filter((employee) => employee.status !== 'egresado').map((employee) => <option key={employee.id} value={employee.id}>{employee.first_name} {employee.last_name} · {employee.cedula}</option>)}</select></Field>
                    <Field label="Fecha prevista de devolución"><input name="expectedReturnOn" className={fieldClass} type="date" /></Field>
                    <Field label="Notas de entrega"><input name="deliveryNotes" className={fieldClass} /></Field>
                    <button className={secondaryButtonClass} disabled={busy || employeeRows.length === 0}>Asignar al empleado</button>
                  </form> : null}
                </div>)}
                {!assets.length && <p className="text-sm text-slate-500">No hay bienes registrados.</p>}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function emptyPurchaseLine(): PurchaseLine {
  return { description: '', quantity: '1', unitPrice: '0', discountAmount: '0', taxAmount: '0', accountId: '', taxAccountId: '' };
}

function updatePurchaseLine(
  index: number,
  field: keyof PurchaseLine,
  value: string,
  setLines: (update: (lines: PurchaseLine[]) => PurchaseLine[]) => void,
) {
  setLines((lines) => lines.map((line, lineIndex) => lineIndex === index ? { ...line, [field]: value } : line));
}
