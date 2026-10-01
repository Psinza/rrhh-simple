import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Download,
  FilePlus2,
  PackageCheck,
  Plus,
  ReceiptText,
  Settings2,
  Trash2,
} from 'lucide-react';
import { getApiBase } from '../services/api';

type CommercialLine = {
  id: string;
  productId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
  taxRateIds: string[];
};

type Bootstrap = {
  company: { legal_name: string; trade_name: string | null; rif: string | null } | null;
  currentUserBranchId: string | null;
  branches: { id: string; name: string }[];
  parties: {
    id: string;
    legal_name: string;
    trade_name: string | null;
    tax_identifier: string | null;
    fiscal_condition: string | null;
  }[];
  products: {
    id: string;
    sku: string;
    name: string;
    product_kind: string;
    base_unit_id: string;
    tracks_lots: boolean;
    tracks_serials: boolean;
    unit_name: string;
  }[];
  warehouses: { id: string; code: string; name: string; branch_id: string | null }[];
  accounts: { id: string; code: string; name: string; account_type: string }[];
  fiscalConfiguration: {
    currency_code: string;
    minor_unit_digits: number;
  } | null;
  taxRates: {
    id: string;
    code: string;
    rate_percent: string;
    name: string;
    tax_kind: string;
    is_exempt: boolean;
  }[];
  invoiceSeries: { id: string; series_code: string; branch_id: string | null }[];
  accountMappings: Record<string, string | null>;
  valuations: {
    warehouse_id: string;
    warehouse_name: string;
    product_id: string;
    sku: string;
    product_name: string;
    quantity_on_hand: string;
    inventory_value: string;
    average_unit_cost: string;
    is_initialized: boolean;
  }[];
};

type CommercialDocument = {
  id: string;
  document_type: 'sales_quote' | 'delivery_note' | 'customer_invoice';
  document_number: string | null;
  document_date: string;
  due_date: string | null;
  status: string;
  currency_code: string;
  party_name_snapshot: string;
  net_amount: string;
  tax_amount: string;
  gross_amount: string;
  fiscal_document_number: string | null;
};

type ApiOptions = {
  method?: string;
  body?: unknown;
};

const apiBase = getApiBase();
const mappingFields = [
  ['receivable_account_id', 'Clientes por cobrar', 'activo'],
  ['revenue_account_id', 'Ingresos por ventas', 'ingreso'],
  ['tax_payable_account_id', 'Impuestos por pagar', 'pasivo'],
  ['inventory_account_id', 'Inventario', 'activo'],
  ['cost_of_sales_account_id', 'Costo de ventas', 'gasto'],
] as const;

function newLine(): CommercialLine {
  return {
    id: crypto.randomUUID(),
    productId: '',
    description: '',
    quantity: '1',
    unitPrice: '0',
    discountAmount: '0',
    taxRateIds: [],
  };
}

function localDate(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatMoney(value: string | number, currency: string): string {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: currency || 'VES',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function documentTypeLabel(type: CommercialDocument['document_type']): string {
  if (type === 'sales_quote') return 'Presupuesto';
  if (type === 'delivery_note') return 'Nota de entrega';
  return 'Factura';
}

async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const response = await fetch(`${apiBase}/api/commercial-sales${path}`, {
    method: options.method || 'GET',
    credentials: 'include',
    headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const responseText = await response.text();
  let payload: unknown;
  if (responseText.trim()) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      if (response.ok) {
        throw new Error(`La API comercial respondió con contenido no JSON (HTTP ${response.status}) en ${path}.`);
      }
    }
  }
  if (!response.ok) {
    if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
      throw new Error(payload.error);
    }
    throw new Error(
      `La API comercial respondió HTTP ${response.status} en ${path}. Verifique que el backend comercial esté desplegado y que sus migraciones se hayan aplicado.`,
    );
  }
  if (payload === undefined) throw new Error(`La API comercial respondió vacía (HTTP ${response.status}) en ${path}.`);
  return payload as T;
}

export function CommercialSalesModule() {
  const [activeSection, setActiveSection] = useState<'documents' | 'new' | 'settings'>('documents');
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [documents, setDocuments] = useState<CommercialDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [partyId, setPartyId] = useState('');
  const [documentDate, setDocumentDate] = useState(localDate());
  const [dueDate, setDueDate] = useState('');
  const [branchId, setBranchId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<CommercialLine[]>([newLine()]);
  const [showPartyForm, setShowPartyForm] = useState(false);
  const [partyKind, setPartyKind] = useState<'person' | 'organization'>('organization');
  const [partyName, setPartyName] = useState('');
  const [partyTaxId, setPartyTaxId] = useState('');
  const [partyFiscalCondition, setPartyFiscalCondition] = useState('');
  const [openingProductId, setOpeningProductId] = useState('');
  const [openingWarehouseId, setOpeningWarehouseId] = useState('');
  const [openingQuantity, setOpeningQuantity] = useState('');
  const [openingCost, setOpeningCost] = useState('');

  const currency = bootstrap?.fiscalConfiguration?.currency_code || 'VES';
  const availableWarehouses = useMemo(
    () => bootstrap?.warehouses.filter((warehouse) => !branchId || !warehouse.branch_id || warehouse.branch_id === branchId) || [],
    [bootstrap, branchId],
  );

  async function refreshDocuments() {
    const response = await apiRequest<{ documents: CommercialDocument[] }>('/documents');
    setDocuments(response.documents);
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [initialData, documentData] = await Promise.all([
          apiRequest<Bootstrap>('/bootstrap'),
          apiRequest<{ documents: CommercialDocument[] }>('/documents'),
        ]);
        if (!mounted) return;
        setBootstrap(initialData);
        setDocuments(documentData.documents);
        setBranchId(initialData.currentUserBranchId || initialData.branches[0]?.id || '');
        setWarehouseId(initialData.warehouses[0]?.id || '');
        setOpeningWarehouseId(initialData.warehouses[0]?.id || '');
        setOpeningProductId(initialData.products.find((product) => product.product_kind === 'stock')?.id || '');
        setPartyId(initialData.parties[0]?.id || '');
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el módulo comercial.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  function updateLine(id: string, changes: Partial<CommercialLine>) {
    setLines((current) => current.map((line) => line.id === id ? { ...line, ...changes } : line));
  }

  async function createQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    try {
      const result = await apiRequest<{ document: { id: string } }>('/documents', {
        method: 'POST',
        body: {
          partyId,
          documentDate,
          dueDate: dueDate || null,
          branchId: branchId || null,
          warehouseId: warehouseId || null,
          description,
          lines: lines.map((line) => ({
            productId: line.productId || null,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountAmount: line.discountAmount,
            taxRateIds: line.taxRateIds,
          })),
        },
      });
      await refreshDocuments();
      setLines([newLine()]);
      setDescription('');
      setDueDate('');
      setSuccess(`Presupuesto ${result.document.id.slice(0, 8)} creado en borrador.`);
      setActiveSection('documents');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'No se pudo crear el presupuesto.');
    }
  }

  async function createParty() {
    setError('');
    try {
      const response = await apiRequest<{ party: Bootstrap['parties'][number] }>('/parties', {
        method: 'POST',
        body: {
          partyKind,
          legalName: partyName,
          taxIdentifier: partyTaxId,
          fiscalCondition: partyFiscalCondition,
        },
      });
      setBootstrap((current) => current
        ? { ...current, parties: [...current.parties, response.party].sort((a, b) => a.legal_name.localeCompare(b.legal_name)) }
        : current);
      setPartyId(response.party.id);
      setPartyName('');
      setPartyTaxId('');
      setPartyFiscalCondition('');
      setShowPartyForm(false);
      setSuccess('Cliente registrado.');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'No se pudo registrar el cliente.');
    }
  }

  async function performDocumentAction(document: CommercialDocument, action: 'issue' | 'delivery_note' | 'invoice') {
    setBusyId(document.id);
    setError('');
    setSuccess('');
    try {
      if (action === 'issue') {
        const response = await apiRequest<{ document: { documentNumber: string } }>(`/documents/${document.id}/issue`, {
          method: 'POST',
          body: {},
        });
        setSuccess(`${documentTypeLabel(document.document_type)} emitido: ${response.document.documentNumber}.`);
      } else {
        const targetType = action === 'delivery_note' ? 'delivery_note' : 'customer_invoice';
        const response = await apiRequest<{ document: { id: string } }>(`/documents/${document.id}/convert`, {
          method: 'POST',
          body: { targetType, warehouseId },
        });
        setSuccess(`${documentTypeLabel(targetType)} creado en borrador (${response.document.id.slice(0, 8)}).`);
      }
      await refreshDocuments();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'No se pudo ejecutar la acción.');
    } finally {
      setBusyId('');
    }
  }

  async function saveMappings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bootstrap) return;
    setError('');
    try {
      await apiRequest('/account-mappings', {
        method: 'PUT',
        body: Object.fromEntries(mappingFields.map(([key]) => [
          key,
          bootstrap.accountMappings[key] || null,
        ])),
      });
      setSuccess('Cuentas comerciales guardadas.');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'No se pudieron guardar las cuentas.');
    }
  }

  async function saveOpeningBalance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    try {
      await apiRequest('/inventory/opening-balances', {
        method: 'POST',
        body: {
          productId: openingProductId,
          warehouseId: openingWarehouseId,
          quantity: openingQuantity,
          averageUnitCost: openingCost,
        },
      });
      const refreshed = await apiRequest<Bootstrap>('/bootstrap');
      setBootstrap(refreshed);
      setSuccess('Saldo inicial de inventario registrado. Queda protegido contra sobrescritura.');
      setOpeningQuantity('');
      setOpeningCost('');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'No se pudo registrar el saldo inicial.');
    }
  }

  async function exportWorkbook() {
    setError('');
    try {
      const { default: ExcelJS } = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'RRHH Contabilidad';
      workbook.created = new Date();
      const sheet = workbook.addWorksheet('Documentos comerciales');
      sheet.columns = [
        { header: 'Tipo', key: 'type', width: 20 },
        { header: 'Número', key: 'number', width: 18 },
        { header: 'Fecha', key: 'date', width: 14 },
        { header: 'Cliente', key: 'party', width: 32 },
        { header: 'Estado', key: 'status', width: 16 },
        { header: 'Moneda', key: 'currency', width: 10 },
        { header: 'Base imponible', key: 'net', width: 18 },
        { header: 'Impuestos', key: 'tax', width: 16 },
        { header: 'Total', key: 'gross', width: 18 },
      ];
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2744' } };
      documents.forEach((document) => {
        sheet.addRow({
          type: documentTypeLabel(document.document_type),
          number: document.fiscal_document_number || document.document_number || document.id,
          date: document.document_date,
          party: document.party_name_snapshot,
          status: document.status,
          currency: document.currency_code,
          net: Number(document.net_amount),
          tax: Number(document.tax_amount),
          gross: Number(document.gross_amount),
        });
      });
      for (const column of ['G', 'H', 'I']) {
        sheet.getColumn(column).numFmt = '#,##0.00';
      }
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      const content = await workbook.xlsx.writeBuffer();
      const objectUrl = URL.createObjectURL(new Blob([content]));
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `documentos-comerciales-${localDate()}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'No se pudo generar el archivo Excel.');
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500">Cargando módulo comercial…</div>;
  }

  if (!bootstrap) {
    return (
      <section className="rounded-2xl border border-rose-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900">No se pudo iniciar Ventas comerciales</h2>
        <p className="mt-2 text-sm text-rose-700">{error || 'La API no entregó la configuración de la empresa.'}</p>
        <p className="mt-2 text-sm text-slate-500">Verifique la sesión, la conexión PostgreSQL y las migraciones del servidor.</p>
      </section>
    );
  }

  const registeredValuations = new Set(
    bootstrap.valuations.filter((balance) => balance.is_initialized)
      .map((balance) => `${balance.warehouse_id}:${balance.product_id}`),
  );
  const issuableDocumentCount = documents.filter((document) => document.status === 'draft').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">Área comercial integrada</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Ventas comerciales</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Presupuestos, notas de entrega y facturas conectados al inventario, impuestos configurados y libro contable.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setActiveSection('documents')} className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${activeSection === 'documents' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>
            Documentos ({documents.length})
          </button>
          <button type="button" onClick={() => setActiveSection('new')} className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${activeSection === 'new' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>
            Nuevo presupuesto
          </button>
          <button type="button" onClick={() => setActiveSection('settings')} className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${activeSection === 'settings' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>
            Configuración
          </button>
        </div>
      </div>

      {(error || success) && (
        <div role={error ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {error && <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{error || success}</span>
        </div>
      )}

      {!bootstrap.fiscalConfiguration && (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>No hay configuración fiscal venezolana activa y verificada. Se pueden preparar presupuestos, pero la emisión de facturas queda bloqueada hasta configurar y revisar los datos fiscales.</p>
        </div>
      )}

      {activeSection === 'documents' && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Documentos recientes</h2>
              <p className="mt-1 text-sm text-slate-500">{issuableDocumentCount} documento(s) en borrador requieren revisión.</p>
            </div>
            <button type="button" onClick={() => void exportWorkbook()} disabled={!documents.length} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <Download className="h-4 w-4" /> Exportar Excel
            </button>
          </div>
          {documents.length === 0 ? (
            <div className="p-10 text-center">
              <ReceiptText className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 font-semibold text-slate-800">Todavía no hay documentos comerciales.</p>
              <button type="button" onClick={() => setActiveSection('new')} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">
                <FilePlus2 className="h-4 w-4" /> Crear presupuesto
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[950px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Documento</th><th className="px-5 py-3">Cliente</th>
                    <th className="px-5 py-3">Fecha</th><th className="px-5 py-3">Estado</th>
                    <th className="px-5 py-3 text-right">Total</th><th className="px-5 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documents.map((document) => (
                    <tr key={document.id} className="align-top">
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-900">{documentTypeLabel(document.document_type)}</p>
                        <p className="mt-1 font-mono text-xs text-slate-500">
                          {document.fiscal_document_number || document.document_number || `BORRADOR-${document.id.slice(0, 8)}`}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-slate-700">{document.party_name_snapshot}</td>
                      <td className="px-5 py-4 text-slate-600">{document.document_date}</td>
                      <td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{document.status}</span></td>
                      <td className="px-5 py-4 text-right font-semibold tabular-nums text-slate-900">{formatMoney(document.gross_amount, document.currency_code)}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          {document.status === 'draft' && (
                            <button type="button" disabled={busyId === document.id} onClick={() => void performDocumentAction(document, 'issue')} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                              {busyId === document.id ? 'Procesando…' : 'Emitir'}
                            </button>
                          )}
                          {document.status === 'issued' && document.document_type === 'sales_quote' && (
                            <>
                              <button type="button" disabled={!!busyId} onClick={() => void performDocumentAction(document, 'delivery_note')} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">
                                <PackageCheck className="h-3.5 w-3.5" /> Nota de entrega
                              </button>
                              <button type="button" disabled={!!busyId} onClick={() => void performDocumentAction(document, 'invoice')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">Facturar</button>
                            </>
                          )}
                          {document.status === 'issued' && document.document_type === 'delivery_note' && (
                            <button type="button" disabled={!!busyId} onClick={() => void performDocumentAction(document, 'invoice')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">Crear factura</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeSection === 'new' && (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-lg font-bold text-slate-900">Preparar presupuesto</h2>
            <p className="mt-1 text-sm text-slate-500">El presupuesto se guarda como borrador y no mueve inventario ni crea un asiento.</p>
          </div>
          <form onSubmit={(event) => void createQuote(event)} className="space-y-6 p-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-sm font-semibold text-slate-700">
                Cliente
                <select required value={partyId} onChange={(event) => setPartyId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal">
                  <option value="">Seleccione un cliente</option>
                  {bootstrap.parties.map((party) => <option key={party.id} value={party.id}>{party.trade_name || party.legal_name}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">Fecha
                <input required type="date" value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
              </label>
              <label className="text-sm font-semibold text-slate-700">Vencimiento (opcional)
                <input type="date" min={documentDate} value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
              </label>
              <label className="text-sm font-semibold text-slate-700">Sucursal
                <select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal">
                  <option value="">Sin sucursal</option>
                  {bootstrap.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">Almacén para un despacho posterior
                <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal">
                  <option value="">Sin almacén</option>
                  {availableWarehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">Descripción general
                <input value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" placeholder="Condiciones o alcance del presupuesto" />
              </label>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900">Líneas de presupuesto</h3>
                <button type="button" onClick={() => setLines((current) => [...current, newLine()])} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                  <Plus className="h-4 w-4" /> Agregar línea
                </button>
              </div>
              {lines.map((line, index) => (
                <div key={line.id} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-2 xl:grid-cols-[1.6fr_1.6fr_0.7fr_0.9fr_0.9fr_auto]">
                  <label className="text-xs font-bold text-slate-600">Producto / servicio
                    <select value={line.productId} onChange={(event) => {
                      const productId = event.target.value;
                      const product = bootstrap.products.find((candidate) => candidate.id === productId);
                      updateLine(line.id, {
                        productId,
                        description: product?.name || line.description,
                      });
                    }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal">
                      <option value="">Descripción manual</option>
                      {bootstrap.products.map((product) => <option key={product.id} value={product.id}>{product.sku} · {product.name}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-bold text-slate-600">Descripción
                    <input required value={line.description} onChange={(event) => updateLine(line.id, { description: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal" />
                  </label>
                  <label className="text-xs font-bold text-slate-600">Cantidad
                    <input required type="number" min="0.000001" step="0.000001" value={line.quantity} onChange={(event) => updateLine(line.id, { quantity: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal" />
                  </label>
                  <label className="text-xs font-bold text-slate-600">Precio unitario
                    <input required type="number" min="0" step="0.000001" value={line.unitPrice} onChange={(event) => updateLine(line.id, { unitPrice: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal" />
                  </label>
                  <label className="text-xs font-bold text-slate-600">Descuento
                    <input type="number" min="0" step="0.01" value={line.discountAmount} onChange={(event) => updateLine(line.id, { discountAmount: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal" />
                  </label>
                  <button type="button" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((candidate) => candidate.id !== line.id))} aria-label={`Eliminar línea ${index + 1}`} className="self-end rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-30">
                    <Trash2 className="h-4 w-4" />
                  </button>
                  {bootstrap.taxRates.length > 0 && (
                    <fieldset className="md:col-span-2 xl:col-span-6">
                      <legend className="mb-2 text-xs font-bold text-slate-600">Impuestos configurados y verificados para esta fecha</legend>
                      <div className="flex flex-wrap gap-2">
                        {bootstrap.taxRates.map((rate) => (
                          <label key={rate.id} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={line.taxRateIds.includes(rate.id)}
                              onChange={(event) => updateLine(line.id, {
                                taxRateIds: event.target.checked
                                  ? [...line.taxRateIds, rate.id]
                                  : line.taxRateIds.filter((id) => id !== rate.id),
                              })}
                            />
                            {rate.code} · {rate.name} ({rate.rate_percent}%)
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}
                </div>
              ))}
            </div>
            {bootstrap.parties.length === 0 && (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Registre un cliente antes de crear el presupuesto.</p>
            )}
            <div className="flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-5">
              <button type="button" onClick={() => setShowPartyForm((visible) => !visible)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">
                {showPartyForm ? 'Cerrar cliente' : 'Registrar cliente'}
              </button>
              <button type="submit" disabled={!partyId} className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50">Guardar presupuesto</button>
            </div>
            {showPartyForm && (
              <div className="grid gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="text-xs font-bold text-slate-600">Tipo
                  <select value={partyKind} onChange={(event) => setPartyKind(event.target.value as 'person' | 'organization')} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal">
                    <option value="organization">Empresa / organización</option><option value="person">Persona</option>
                  </select>
                </label>
                <label className="text-xs font-bold text-slate-600">Nombre o razón social
                  <input required value={partyName} onChange={(event) => setPartyName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal" />
                </label>
                <label className="text-xs font-bold text-slate-600">RIF / identificación
                  <input value={partyTaxId} onChange={(event) => setPartyTaxId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal" />
                </label>
                <label className="text-xs font-bold text-slate-600">Condición fiscal verificada
                  <input required value={partyFiscalCondition} onChange={(event) => setPartyFiscalCondition(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal" placeholder="Según constancia del cliente" />
                </label>
                <button type="button" onClick={() => {
                  if (!partyName.trim() || !partyFiscalCondition.trim()) {
                    setError('Indique el nombre y la condición fiscal verificada del cliente.');
                    return;
                  }
                  void createParty();
                }} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white md:col-span-2 xl:col-span-4">Guardar cliente</button>
              </div>
            )}
          </form>
        </section>
      )}

      {activeSection === 'settings' && (
        <div className="grid gap-6 xl:grid-cols-2">
          <form onSubmit={(event) => void saveMappings(event)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <Settings2 className="h-5 w-5 text-blue-700" />
              <div><h2 className="font-bold text-slate-900">Cuentas para ventas</h2><p className="text-xs text-slate-500">Se validan con el plan contable de esta empresa.</p></div>
            </div>
            <div className="space-y-3">
              {mappingFields.map(([key, label, type]) => (
                <label key={key} className="block text-sm font-semibold text-slate-700">{label}
                  <select value={bootstrap.accountMappings[key] || ''} onChange={(event) => setBootstrap((current) => current ? {
                    ...current,
                    accountMappings: { ...current.accountMappings, [key]: event.target.value || null },
                  } : current)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal">
                    <option value="">No configurada</option>
                    {bootstrap.accounts.filter((account) => account.account_type === type).map((account) => (
                      <option key={account.id} value={account.id}>{account.code} · {account.name}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <button type="submit" className="mt-5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">Guardar cuentas</button>
          </form>

          <div className="space-y-6">
            <form onSubmit={(event) => void saveOpeningBalance(event)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <PackageCheck className="h-5 w-5 text-emerald-700" />
                <div><h2 className="font-bold text-slate-900">Saldos iniciales valorizados</h2><p className="text-xs text-slate-500">Una captura única de la existencia y costo promedio actuales.</p></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">Almacén
                  <select required value={openingWarehouseId} onChange={(event) => setOpeningWarehouseId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal">
                    <option value="">Seleccione</option>{bootstrap.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">Producto
                  <select required value={openingProductId} onChange={(event) => setOpeningProductId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal">
                    <option value="">Seleccione</option>{bootstrap.products.filter((product) => product.product_kind === 'stock' && !product.tracks_lots && !product.tracks_serials).map((product) => <option key={product.id} value={product.id}>{product.sku} · {product.name}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">Existencia actual
                  <input required type="number" min="0" step="0.000001" value={openingQuantity} onChange={(event) => setOpeningQuantity(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
                </label>
                <label className="text-sm font-semibold text-slate-700">Costo promedio unitario ({currency})
                  <input required type="number" min="0" step="0.000001" value={openingCost} onChange={(event) => setOpeningCost(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
                </label>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">El sistema prohíbe despachar existencias sin una valoración inicial confiable. Una vez inicializado el par almacén/producto, no puede sobrescribirse desde esta pantalla.</p>
              <button type="submit" disabled={!openingProductId || !openingWarehouseId || registeredValuations.has(`${openingWarehouseId}:${openingProductId}`)} className="mt-4 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {registeredValuations.has(`${openingWarehouseId}:${openingProductId}`) ? 'Saldo ya inicializado' : 'Registrar saldo inicial'}
              </button>
            </form>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-bold text-slate-900">Estado de configuración</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Empresa</dt><dd className="text-right font-semibold">{bootstrap.company?.trade_name || bootstrap.company?.legal_name || 'No disponible'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Configuración fiscal</dt><dd className="text-right font-semibold">{bootstrap.fiscalConfiguration ? `Verificada · ${bootstrap.fiscalConfiguration.currency_code}` : 'Pendiente'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Tasas disponibles</dt><dd className="font-semibold">{bootstrap.taxRates.length}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Series de factura</dt><dd className="font-semibold">{bootstrap.invoiceSeries.length}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Saldos inventariados</dt><dd className="font-semibold">{registeredValuations.size}</dd></div>
              </dl>
              <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">Las tasas, series y condición fiscal se toman de la configuración registrada. La emisión permanece bloqueada mientras falte configuración, mapeo contable, saldo valorizado o verificación operativa.</p>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
