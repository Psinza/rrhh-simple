import { FormEvent, useMemo, useState } from 'react';
import { Boxes, HandCoins, PackagePlus, Plus } from 'lucide-react';
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
      onAddAssignment({
        id: `assignment-${Date.now()}`, employeeId: employee.id,
        employeeName: `${employee.primerNombre} ${employee.primerApellido}`,
        product: product.trim(), quantity: quantityNumber, amountBs, currency, amountOriginal, month, status: 'Asignado',
      });
    } else if (tab === 'purchases') {
      if (!supplier.trim()) {
        alert('Indique el proveedor de la compra.');
        return;
      }
      onAddPurchase({
        id: `purchase-${Date.now()}`, product: product.trim(), supplier: supplier.trim(),
        quantity: quantityNumber, amountBs, currency, amountOriginal, purchaseDate: new Date().toISOString().split('T')[0],
        notes: description.trim() || undefined,
      });
    } else {
      if (!employee || !installmentOriginal || amountBs <= 0) {
        alert('Complete trabajador, préstamo y cuota.');
        return;
      }
      onAddLoan({
        id: `loan-${Date.now()}`, employeeId: employee.id,
        employeeName: `${employee.primerNombre} ${employee.primerApellido}`,
        description: description.trim() || product.trim(), principalBs: amountBs, currency, principalOriginal: amountOriginal,
        installmentBs, installmentCurrency, installmentOriginal, outstandingBs: amountBs, status: 'Activo',
        createdAt: new Date().toISOString().split('T')[0],
      });
    }
    reset();
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
          {(tab !== 'purchases') && <label className="text-xs font-semibold">Trabajador<select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="mt-1 w-full p-2 border rounded-lg font-normal"><option value="">Seleccione</option>{employees.filter((item) => item.status === 'activo').map((item) => <option key={item.id} value={item.id}>{item.primerNombre} {item.primerApellido}</option>)}</select></label>}
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
        {tab === 'assignments' && <>{assignments.length} asignaciones registradas este mes.</>}
        {tab === 'purchases' && <>{purchases.length} compras registradas.</>}
        {tab === 'loans' && <>{loans.length} préstamos registrados.</>}
      </div>
    </div>
  );
}
