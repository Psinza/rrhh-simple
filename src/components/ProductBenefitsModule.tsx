import { FormEvent, useMemo, useState } from 'react';
import { Boxes, HandCoins, PackagePlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { Employee, EmployeeLoan, MoneyCurrency, ProductAssignment, ProductPurchase } from '../types';
import { convertAmountToBaseCurrency, formatBs, formatUSD } from '../utils/venezuelaLaborCalculations';

interface ProductBenefitsModuleProps {
  employees: Employee[];
  assignments: ProductAssignment[];
  purchases: ProductPurchase[];
  loans: EmployeeLoan[];
  onAddAssignment: (item: ProductAssignment) => void;
  onAddPurchase: (item: ProductPurchase) => void;
  onAddLoan: (item: EmployeeLoan) => void;
  onUpdateAssignment: (item: ProductAssignment) => void;
  onUpdatePurchase: (item: ProductPurchase) => void;
  onUpdateLoan: (item: EmployeeLoan) => void;
  onDeleteAssignment: (id: string) => void;
  onDeletePurchase: (id: string) => void;
  onDeleteLoan: (id: string) => void;
  exchangeRate: number;
}

export function ProductBenefitsModule({
  employees,
  assignments,
  purchases,
  loans,
  onAddAssignment,
  onAddPurchase,
  onAddLoan,
  onUpdateAssignment,
  onUpdatePurchase,
  onUpdateLoan,
  onDeleteAssignment,
  onDeletePurchase,
  onDeleteLoan,
  exchangeRate,
}: ProductBenefitsModuleProps) {
  const [tab, setTab] = useState<'assignments' | 'purchases' | 'loans'>('assignments');
  const [employeeId, setEmployeeId] = useState(employees[0]?.id || '');
  const [product, setProduct] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<MoneyCurrency>('BS');
  const [supplier, setSupplier] = useState('');
  const [description, setDescription] = useState('');
  const [installment, setInstallment] = useState('');
  const [installmentCurrency, setInstallmentCurrency] = useState<MoneyCurrency>('BS');
  const [editingId, setEditingId] = useState<string | null>(null);

  const employee = employees.find((item) => item.id === employeeId);
  const month = new Date().toISOString().slice(0, 7);
  const totals = useMemo(() => ({
    assignments: assignments.reduce((sum, item) => sum + item.amountBs, 0),
    purchases: purchases.reduce((sum, item) => sum + item.amountBs, 0),
    loans: loans.filter((item) => item.status === 'Activo').reduce((sum, item) => sum + item.outstandingBs, 0),
  }), [assignments, purchases, loans]);

  const reset = () => {
    setProduct('');
    setQuantity('1');
    setAmount('');
    setCurrency('BS');
    setSupplier('');
    setDescription('');
    setInstallment('');
    setInstallmentCurrency('BS');
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const quantityNumber = Number(quantity);
    const amountOriginal = Number(amount);
    const amountBs = convertAmountToBaseCurrency(amountOriginal, currency, exchangeRate);
    const installmentOriginal = Number(installment);
    const installmentBs = convertAmountToBaseCurrency(installmentOriginal, installmentCurrency, exchangeRate);
    if (!product.trim() || !quantityNumber || amountOriginal < 0) {
      alert('Complete producto, cantidad y monto.');
      return;
    }
    if (tab === 'assignments') {
      if (!employee) return;
      const item: ProductAssignment = {
        id: editingId || `assignment-${Date.now()}`, employeeId: employee.id,
        employeeName: `${employee.primerNombre} ${employee.primerApellido}`,
        product: product.trim(), quantity: quantityNumber, amountBs, currency, amountOriginal, month,
        status: editingId ? assignments.find((current) => current.id === editingId)?.status || 'Asignado' : 'Asignado',
      };
      if (editingId) onUpdateAssignment(item); else onAddAssignment(item);
    } else if (tab === 'purchases') {
      if (!employee) {
        alert('Seleccione el trabajador al que se le descontará la compra.');
        return;
      }
      if (!supplier.trim()) {
        alert('Indique el proveedor de la compra.');
        return;
      }
      const item: ProductPurchase = {
        id: editingId || `purchase-${Date.now()}`, employeeId: employee.id,
        employeeName: `${employee.primerNombre} ${employee.primerApellido}`,
        product: product.trim(), supplier: supplier.trim(), quantity: quantityNumber, amountBs, currency, amountOriginal,
        purchaseDate: editingId ? purchases.find((current) => current.id === editingId)?.purchaseDate || new Date().toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        notes: description.trim() || undefined,
      };
      if (editingId) onUpdatePurchase(item); else onAddPurchase(item);
    } else {
      if (!employee || !installmentOriginal || amountBs <= 0) {
        alert('Complete trabajador, préstamo y cuota.');
        return;
      }
      const item: EmployeeLoan = {
        id: editingId || `loan-${Date.now()}`, employeeId: employee.id,
        employeeName: `${employee.primerNombre} ${employee.primerApellido}`,
        description: description.trim() || product.trim(), principalBs: amountBs, currency, principalOriginal: amountOriginal,
        installmentBs, installmentCurrency, installmentOriginal,
        outstandingBs: editingId ? loans.find((current) => current.id === editingId)?.outstandingBs || amountBs : amountBs,
        status: editingId ? loans.find((current) => current.id === editingId)?.status || 'Activo' : 'Activo',
        createdAt: editingId ? loans.find((current) => current.id === editingId)?.createdAt || new Date().toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      };
      if (editingId) onUpdateLoan(item); else onAddLoan(item);
    }
    reset();
    setEditingId(null);
  };

  const startEdit = (item: ProductAssignment | ProductPurchase | EmployeeLoan) => {
    setEditingId(item.id);
    setEmployeeId(item.employeeId);
    setProduct('product' in item ? item.product : item.description);
    setQuantity('quantity' in item ? String(item.quantity) : '1');
    if ('principalBs' in item) setAmount(String(item.principalOriginal ?? item.principalBs));
    else setAmount(String(item.amountOriginal ?? item.amountBs));
    setCurrency(item.currency || 'BS');
    if ('supplier' in item) setSupplier(item.supplier);
    if ('notes' in item) setDescription(item.notes || '');
    if ('description' in item) setDescription(item.description);
    if ('installmentOriginal' in item) {
      setInstallment(String(item.installmentOriginal ?? item.installmentBs));
      setInstallmentCurrency(item.installmentCurrency || 'BS');
    }
    setTab('month' in item ? 'assignments' : 'supplier' in item ? 'purchases' : 'loans');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2"><Boxes className="w-5 h-5 text-orange-600" /><h1 className="text-xl font-bold">Productos, Compras y Préstamos</h1></div>
        <p className="text-xs text-slate-500 mt-1">Controle asignaciones mensuales, compras de productos y préstamos asociados a trabajadores y vendedores.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border rounded-xl p-4"><div className="text-xs text-slate-500">Asignaciones</div><strong>{formatBs(totals.assignments)}</strong><div className="text-xs text-slate-500">{formatUSD(totals.assignments / exchangeRate)}</div></div>
        <div className="bg-white border rounded-xl p-4"><div className="text-xs text-slate-500">Compras</div><strong>{formatBs(totals.purchases)}</strong><div className="text-xs text-slate-500">{formatUSD(totals.purchases / exchangeRate)}</div></div>
        <div className="bg-white border rounded-xl p-4"><div className="text-xs text-slate-500">Préstamos pendientes</div><strong>{formatBs(totals.loans)}</strong><div className="text-xs text-slate-500">{formatUSD(totals.loans / exchangeRate)}</div></div>
      </div>
      <div className="flex gap-2 border-b">
        <button onClick={() => setTab('assignments')} className={`px-3 py-2 text-xs font-bold ${tab === 'assignments' ? 'text-orange-700 border-b-2 border-orange-600' : 'text-slate-500'}`}><PackagePlus className="inline w-4 h-4 mr-1" />Asignaciones mensuales</button>
        <button onClick={() => setTab('purchases')} className={`px-3 py-2 text-xs font-bold ${tab === 'purchases' ? 'text-orange-700 border-b-2 border-orange-600' : 'text-slate-500'}`}>Compras</button>
        <button onClick={() => setTab('loans')} className={`px-3 py-2 text-xs font-bold ${tab === 'loans' ? 'text-orange-700 border-b-2 border-orange-600' : 'text-slate-500'}`}><HandCoins className="inline w-4 h-4 mr-1" />Préstamos</button>
      </div>
      <form onSubmit={handleSubmit} className="bg-white border border-orange-200 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-xs font-semibold">Trabajador{tab === 'purchases' && <span className="text-orange-700"> (se descuenta en nómina)</span>}<select required value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="mt-1 w-full p-2 border rounded-lg font-normal"><option value="">Seleccione</option>{employees.filter((item) => item.status === 'activo').map((item) => <option key={item.id} value={item.id}>{item.primerNombre} {item.primerApellido}</option>)}</select></label>
          <label className="text-xs font-semibold">{tab === 'loans' ? 'Concepto' : 'Producto'}<input required value={product} onChange={(event) => setProduct(event.target.value)} className="mt-1 w-full p-2 border rounded-lg font-normal" /></label>
          {tab === 'purchases' && <label className="text-xs font-semibold">Proveedor<input required value={supplier} onChange={(event) => setSupplier(event.target.value)} className="mt-1 w-full p-2 border rounded-lg font-normal" /></label>}
          <label className="text-xs font-semibold">Cantidad<input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-1 w-full p-2 border rounded-lg font-normal" /></label>
          <label className="text-xs font-semibold">Moneda<select value={currency} onChange={(event) => setCurrency(event.target.value as MoneyCurrency)} className="mt-1 w-full p-2 border rounded-lg font-normal"><option value="BS">Bolívares (Bs.)</option><option value="USD">Dólares (USD)</option></select></label>
          <label className="text-xs font-semibold">Monto ({currency === 'USD' ? 'USD' : 'Bs.'})<input required type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 w-full p-2 border rounded-lg font-normal" /></label>
          {tab === 'loans' && <><label className="text-xs font-semibold">Moneda de cuota<select value={installmentCurrency} onChange={(event) => setInstallmentCurrency(event.target.value as MoneyCurrency)} className="mt-1 w-full p-2 border rounded-lg font-normal"><option value="BS">Bolívares (Bs.)</option><option value="USD">Dólares (USD)</option></select></label><label className="text-xs font-semibold">Cuota por nómina ({installmentCurrency === 'USD' ? 'USD' : 'Bs.'})<input required type="number" min="0.01" step="0.01" value={installment} onChange={(event) => setInstallment(event.target.value)} className="mt-1 w-full p-2 border rounded-lg font-normal" /></label></>}
          {(tab !== 'assignments') && <label className="text-xs font-semibold">Notas<input value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 w-full p-2 border rounded-lg font-normal" /></label>}
        </div>
        <button className="px-4 py-2 rounded-lg bg-orange-600 text-white text-xs font-bold"><Plus className="inline w-4 h-4 mr-1" />Registrar</button>
      </form>
      <div className="bg-white border rounded-xl p-4 text-xs text-slate-600">
        {tab === 'assignments' && <>{assignments.length} asignaciones registradas este mes.{assignments.length > 0 && <div className="overflow-x-auto mt-3"><table className="w-full"><thead><tr className="text-left text-slate-500"><th className="py-1 pr-3">Trabajador</th><th className="py-1 pr-3">Producto</th><th className="py-1 text-right">Monto</th><th className="py-1 text-center">Acciones</th></tr></thead><tbody className="divide-y">{assignments.map((item) => <tr key={item.id}><td className="py-2 pr-3 font-semibold">{item.employeeName}</td><td className="py-2 pr-3">{item.product}</td><td className="py-2 text-right">{formatBs(item.amountBs)}</td><td className="py-2 text-center"><button title="Editar" onClick={() => startEdit(item)} className="p-1 text-blue-600"><Pencil className="w-3.5 h-3.5" /></button><button title="Eliminar" onClick={() => onDeleteAssignment(item.id)} className="p-1 text-red-600"><Trash2 className="w-3.5 h-3.5" /></button></td></tr>)}</tbody></table></div>}</>}
        {tab === 'purchases' && (
          <div className="space-y-2">
            <div>{purchases.length} compras registradas.</div>
            {purchases.length > 0 && <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left text-slate-500"><th className="py-1 pr-3">Trabajador</th><th className="py-1 pr-3">Producto</th><th className="py-1 pr-3">Proveedor</th><th className="py-1 text-right">Descuento</th><th className="py-1 text-center">Acciones</th></tr></thead><tbody className="divide-y">{purchases.map((purchase) => <tr key={purchase.id}><td className="py-1 pr-3 font-semibold">{purchase.employeeName || 'Sin trabajador'}</td><td className="py-1 pr-3">{purchase.product}</td><td className="py-1 pr-3">{purchase.supplier}</td><td className="py-1 text-right">{formatBs(purchase.amountBs)}</td><td className="py-1 text-center"><button title="Editar" onClick={() => startEdit(purchase)} className="p-1 text-blue-600"><Pencil className="w-3.5 h-3.5" /></button><button title="Eliminar" onClick={() => onDeletePurchase(purchase.id)} className="p-1 text-red-600"><Trash2 className="w-3.5 h-3.5" /></button></td></tr>)}</tbody></table></div>}
          </div>
        )}
        {tab === 'loans' && <>{loans.length} préstamos registrados.{loans.length > 0 && <div className="overflow-x-auto mt-3"><table className="w-full"><thead><tr className="text-left text-slate-500"><th className="py-1 pr-3">Trabajador</th><th className="py-1 pr-3">Concepto</th><th className="py-1 text-right">Saldo</th><th className="py-1 text-center">Acciones</th></tr></thead><tbody className="divide-y">{loans.map((item) => <tr key={item.id}><td className="py-2 pr-3 font-semibold">{item.employeeName}</td><td className="py-2 pr-3">{item.description}</td><td className="py-2 text-right">{formatBs(item.outstandingBs)}</td><td className="py-2 text-center"><button title="Editar" onClick={() => startEdit(item)} className="p-1 text-blue-600"><Pencil className="w-3.5 h-3.5" /></button><button title="Eliminar" onClick={() => onDeleteLoan(item.id)} className="p-1 text-red-600"><Trash2 className="w-3.5 h-3.5" /></button></td></tr>)}</tbody></table></div>}</>}
      </div>
    </div>
  );
}
