import { FormEvent, useMemo, useState } from 'react';
import { Boxes, HandCoins, PackagePlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { AbsenceRecord, CashAdvanceRecord, Employee, EmployeeLoan, MoneyCurrency, ProductAssignment, ProductPurchase } from '../types';
import { convertAmountToBaseCurrency, formatBs, formatUSD, getMondayDate } from '../utils/venezuelaLaborCalculations';

interface ProductBenefitsModuleProps {
  employees: Employee[];
  assignments: ProductAssignment[];
  purchases: ProductPurchase[];
  loans: EmployeeLoan[];
  absences: AbsenceRecord[];
  cashAdvances: CashAdvanceRecord[];
  onAddAssignment: (item: ProductAssignment) => void;
  onAddPurchase: (item: ProductPurchase) => void;
  onAddLoan: (item: EmployeeLoan) => void;
  onUpdateAssignment: (item: ProductAssignment) => void;
  onUpdatePurchase: (item: ProductPurchase) => void;
  onUpdateLoan: (item: EmployeeLoan) => void;
  onDeleteAssignment: (id: string) => void;
  onDeletePurchase: (id: string) => void;
  onDeleteLoan: (id: string) => void;
  onAddAbsence: (item: AbsenceRecord) => void;
  onUpdateAbsence: (item: AbsenceRecord) => void;
  onDeleteAbsence: (id: string) => void;
  onAddCashAdvance: (item: CashAdvanceRecord) => void;
  onUpdateCashAdvance: (item: CashAdvanceRecord) => void;
  onDeleteCashAdvance: (id: string) => void;
  exchangeRate: number;
}

const today = new Date().toISOString().split('T')[0];

export function ProductBenefitsModule({
  employees,
  assignments,
  purchases,
  loans,
  absences,
  cashAdvances,
  onAddAssignment,
  onAddPurchase,
  onAddLoan,
  onUpdateAssignment,
  onUpdatePurchase,
  onUpdateLoan,
  onDeleteAssignment,
  onDeletePurchase,
  onDeleteLoan,
  onAddAbsence,
  onUpdateAbsence,
  onDeleteAbsence,
  onAddCashAdvance,
  onUpdateCashAdvance,
  onDeleteCashAdvance,
  exchangeRate,
}: ProductBenefitsModuleProps) {
  const [tab, setTab] = useState<'assignments' | 'purchases' | 'loans' | 'absences' | 'cashAdvances'>('assignments');
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
  const [absenceDate, setAbsenceDate] = useState(today);
  const [deductionWeekStart, setDeductionWeekStart] = useState(getMondayDate(today));

  const employee = employees.find((item) => item.id === employeeId);
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
    setAbsenceDate(today);
    setDeductionWeekStart(getMondayDate(today));
  };

  const changeTab = (nextTab: typeof tab) => {
    if (nextTab !== tab) {
      reset();
      setEditingId(null);
    }
    setTab(nextTab);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const quantityNumber = Number(quantity);
    const amountOriginal = Number(amount);
    const amountBs = convertAmountToBaseCurrency(amountOriginal, currency, exchangeRate);
    const installmentOriginal = Number(installment);
    const installmentBs = convertAmountToBaseCurrency(installmentOriginal, installmentCurrency, exchangeRate);
    if (tab === 'absences') {
      if (!employee || !absenceDate || quantityNumber <= 0 || quantityNumber > 5) {
        alert('Indique trabajador, fecha y entre 0,5 y 5 días de inasistencia.');
        return;
      }
      const item: AbsenceRecord = {
        id: editingId || `absence-${Date.now()}`,
        employeeId: employee.id,
        employeeName: `${employee.primerNombre} ${employee.primerApellido}`,
        date: absenceDate,
        days: quantityNumber,
        reason: description.trim() || undefined,
      };
      if (editingId) onUpdateAbsence(item); else onAddAbsence(item);
      reset();
      setEditingId(null);
      return;
    }
    if (tab === 'cashAdvances') {
      if (!employee || !product.trim() || amountOriginal <= 0) {
        alert('Complete trabajador, concepto y monto del adelanto.');
        return;
      }
      const item: CashAdvanceRecord = {
        id: editingId || `cash-advance-${Date.now()}`,
        employeeId: employee.id,
        employeeName: `${employee.primerNombre} ${employee.primerApellido}`,
        description: product.trim(),
        amountBs,
        currency,
        amountOriginal,
        deductionWeekStart: getMondayDate(deductionWeekStart),
        createdAt: editingId ? cashAdvances.find((current) => current.id === editingId)?.createdAt || today : today,
      };
      if (editingId) onUpdateCashAdvance(item); else onAddCashAdvance(item);
      reset();
      setEditingId(null);
      return;
    }
    if (!product.trim() || !quantityNumber || amountOriginal < 0) {
      alert('Complete producto, cantidad y monto.');
      return;
    }
    if (tab === 'assignments') {
      if (!employee) return;
      const item: ProductAssignment = {
        id: editingId || `assignment-${Date.now()}`, employeeId: employee.id,
        employeeName: `${employee.primerNombre} ${employee.primerApellido}`,
        product: product.trim(), quantity: quantityNumber, amountBs, currency, amountOriginal, month: getMondayDate(deductionWeekStart).slice(0, 7),
        deductionWeekStart: getMondayDate(deductionWeekStart),
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
        deductionWeekStart: getMondayDate(deductionWeekStart),
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
        deductionWeekStart: getMondayDate(deductionWeekStart),
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
    if ('deductionWeekStart' in item && item.deductionWeekStart) setDeductionWeekStart(item.deductionWeekStart);
    setTab('month' in item ? 'assignments' : 'supplier' in item ? 'purchases' : 'loans');
  };

  const startEditAbsence = (item: AbsenceRecord) => {
    setEditingId(item.id);
    setEmployeeId(item.employeeId);
    setAbsenceDate(item.date);
    setQuantity(String(item.days));
    setDescription(item.reason || '');
    setTab('absences');
  };

  const startEditCashAdvance = (item: CashAdvanceRecord) => {
    setEditingId(item.id);
    setEmployeeId(item.employeeId);
    setProduct(item.description);
    setAmount(String(item.amountOriginal));
    setCurrency(item.currency);
    setDeductionWeekStart(item.deductionWeekStart);
    setTab('cashAdvances');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2"><Boxes className="w-5 h-5 text-orange-600" /><h1 className="text-xl font-bold">Productos, Compras y Préstamos</h1></div>
        <p className="text-xs text-slate-500 mt-1">Controle asignaciones mensuales, compras de productos y préstamos asociados a trabajadores y vendedores.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white border rounded-xl p-4"><div className="text-xs text-slate-500">Asignaciones</div><strong>{formatBs(totals.assignments)}</strong><div className="text-xs text-slate-500">{formatUSD(totals.assignments / exchangeRate)}</div></div>
        <div className="bg-white border rounded-xl p-4"><div className="text-xs text-slate-500">Compras</div><strong>{formatBs(totals.purchases)}</strong><div className="text-xs text-slate-500">{formatUSD(totals.purchases / exchangeRate)}</div></div>
        <div className="bg-white border rounded-xl p-4"><div className="text-xs text-slate-500">Préstamos pendientes</div><strong>{formatBs(totals.loans)}</strong><div className="text-xs text-slate-500">{formatUSD(totals.loans / exchangeRate)}</div></div>
        <div className="bg-white border rounded-xl p-4"><div className="text-xs text-slate-500">Inasistencias</div><strong>{absences.length}</strong><div className="text-xs text-slate-500">registradas</div></div>
        <div className="bg-white border rounded-xl p-4"><div className="text-xs text-slate-500">Avances de efectivo</div><strong>{cashAdvances.length}</strong><div className="text-xs text-slate-500">{formatBs(cashAdvances.reduce((sum, item) => sum + item.amountBs, 0))} / {formatUSD(cashAdvances.reduce((sum, item) => sum + item.amountBs, 0) / exchangeRate)}</div></div>
      </div>
      <div className="flex flex-wrap gap-2 border-b">
        <button onClick={() => changeTab('assignments')} className={`px-3 py-2 text-xs font-bold ${tab === 'assignments' ? 'text-orange-700 border-b-2 border-orange-600' : 'text-slate-500'}`}><PackagePlus className="inline w-4 h-4 mr-1" />Asignaciones mensuales</button>
        <button onClick={() => changeTab('purchases')} className={`px-3 py-2 text-xs font-bold ${tab === 'purchases' ? 'text-orange-700 border-b-2 border-orange-600' : 'text-slate-500'}`}>Compras</button>
        <button onClick={() => changeTab('loans')} className={`px-3 py-2 text-xs font-bold ${tab === 'loans' ? 'text-orange-700 border-b-2 border-orange-600' : 'text-slate-500'}`}><HandCoins className="inline w-4 h-4 mr-1" />Préstamos</button>
        <button onClick={() => changeTab('absences')} className={`px-3 py-2 text-xs font-bold ${tab === 'absences' ? 'text-orange-700 border-b-2 border-orange-600' : 'text-slate-500'}`}>Inasistencias</button>
        <button onClick={() => changeTab('cashAdvances')} className={`px-3 py-2 text-xs font-bold ${tab === 'cashAdvances' ? 'text-orange-700 border-b-2 border-orange-600' : 'text-slate-500'}`}>Avances de sueldo</button>
      </div>
      <form onSubmit={handleSubmit} className="bg-white border border-orange-200 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-xs font-semibold">Trabajador<select required value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="mt-1 w-full p-2 border rounded-lg font-normal"><option value="">Seleccione</option>{employees.filter((item) => item.status === 'activo').map((item) => <option key={item.id} value={item.id}>{item.primerNombre} {item.primerApellido}</option>)}</select></label>
          {tab !== 'absences' && <label className="text-xs font-semibold">{tab === 'loans' || tab === 'cashAdvances' ? 'Concepto' : 'Producto'}<input required value={product} onChange={(event) => setProduct(event.target.value)} className="mt-1 w-full p-2 border rounded-lg font-normal" /></label>}
          {tab === 'purchases' && <label className="text-xs font-semibold">Proveedor<input required value={supplier} onChange={(event) => setSupplier(event.target.value)} className="mt-1 w-full p-2 border rounded-lg font-normal" /></label>}
          {(tab === 'assignments' || tab === 'purchases' || tab === 'absences') && <label className="text-xs font-semibold">{tab === 'absences' ? 'Días de inasistencia' : 'Cantidad'}<input type="number" min={tab === 'absences' ? '0.5' : '1'} max={tab === 'absences' ? '5' : undefined} step={tab === 'absences' ? '0.5' : '1'} value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-1 w-full p-2 border rounded-lg font-normal" /></label>}
          {tab === 'absences' ? <label className="text-xs font-semibold">Fecha de inasistencia<input type="date" required value={absenceDate} onChange={(event) => setAbsenceDate(event.target.value)} className="mt-1 w-full p-2 border rounded-lg font-normal" /></label> : <label className="text-xs font-semibold">Semana de descuento (lunes)<input type="date" required value={deductionWeekStart} onChange={(event) => setDeductionWeekStart(event.target.value)} className="mt-1 w-full p-2 border rounded-lg font-normal" /></label>}
          {tab !== 'absences' && <>
            <label className="text-xs font-semibold">Moneda<select value={currency} onChange={(event) => setCurrency(event.target.value as MoneyCurrency)} className="mt-1 w-full p-2 border rounded-lg font-normal"><option value="BS">Bolívares (Bs.)</option><option value="USD">Dólares (USD)</option></select></label>
            <label className="text-xs font-semibold">Monto ({currency === 'USD' ? 'USD' : 'Bs.'})<input required type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 w-full p-2 border rounded-lg font-normal" /></label>
          </>}
          {tab === 'loans' && <><label className="text-xs font-semibold">Moneda de cuota<select value={installmentCurrency} onChange={(event) => setInstallmentCurrency(event.target.value as MoneyCurrency)} className="mt-1 w-full p-2 border rounded-lg font-normal"><option value="BS">Bolívares (Bs.)</option><option value="USD">Dólares (USD)</option></select></label><label className="text-xs font-semibold">Cuota por nómina ({installmentCurrency === 'USD' ? 'USD' : 'Bs.'})<input required type="number" min="0.01" step="0.01" value={installment} onChange={(event) => setInstallment(event.target.value)} className="mt-1 w-full p-2 border rounded-lg font-normal" /></label></>}
          {(tab !== 'assignments') && <label className="text-xs font-semibold">{tab === 'absences' ? 'Motivo / notas' : 'Notas'}<input value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 w-full p-2 border rounded-lg font-normal" /></label>}
        </div>
        <button className="px-4 py-2 rounded-lg bg-orange-600 text-white text-xs font-bold"><Plus className="inline w-4 h-4 mr-1" />{editingId ? 'Guardar cambios' : 'Registrar'}</button>
        {editingId && <button type="button" onClick={() => { reset(); setEditingId(null); }} className="ml-2 px-4 py-2 text-xs text-slate-600">Cancelar edición</button>}
      </form>
      <div className="bg-white border rounded-xl p-4 text-xs text-slate-600">
        {tab === 'assignments' && <>{assignments.length} asignaciones registradas.{assignments.length > 0 && <div className="overflow-x-auto mt-3"><table className="w-full"><thead><tr className="text-left text-slate-500"><th className="py-1 pr-3">Trabajador</th><th className="py-1 pr-3">Producto</th><th className="py-1 pr-3">Semana</th><th className="py-1 pr-3">Estado</th><th className="py-1 text-right">Monto</th><th className="py-1 text-center">Acciones</th></tr></thead><tbody className="divide-y">{assignments.map((item) => <tr key={item.id}><td className="py-2 pr-3 font-semibold">{item.employeeName}</td><td className="py-2 pr-3">{item.product} × {item.quantity}</td><td className="py-2 pr-3">{item.deductionWeekStart || item.month}</td><td className="py-2 pr-3">{item.status}</td><td className="py-2 text-right">{formatBs(item.amountBs)}<div className="text-[10px] text-slate-500">{formatUSD(item.amountBs / exchangeRate)}</div></td><td className="py-2 text-center"><button title="Editar" onClick={() => startEdit(item)} className="p-1 text-blue-600"><Pencil className="w-3.5 h-3.5" /></button><button title="Eliminar" onClick={() => onDeleteAssignment(item.id)} className="p-1 text-red-600"><Trash2 className="w-3.5 h-3.5" /></button></td></tr>)}</tbody></table></div>}</>}
        {tab === 'purchases' && (
          <div className="space-y-2">
            <div>{purchases.length} compras registradas.</div>
            {purchases.length > 0 && <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left text-slate-500"><th className="py-1 pr-3">Trabajador</th><th className="py-1 pr-3">Producto</th><th className="py-1 pr-3">Proveedor</th><th className="py-1 pr-3">Semana</th><th className="py-1 text-right">Descuento</th><th className="py-1 text-center">Acciones</th></tr></thead><tbody className="divide-y">{purchases.map((purchase) => <tr key={purchase.id}><td className="py-1 pr-3 font-semibold">{purchase.employeeName || 'Sin trabajador'}</td><td className="py-1 pr-3">{purchase.product}</td><td className="py-1 pr-3">{purchase.supplier}</td><td className="py-1 pr-3">{purchase.deductionWeekStart || getMondayDate(purchase.purchaseDate)}</td><td className="py-1 text-right">{formatBs(purchase.amountBs)}<div className="text-[10px] text-slate-500">{formatUSD(purchase.amountBs / exchangeRate)}</div></td><td className="py-1 text-center"><button title="Editar" onClick={() => startEdit(purchase)} className="p-1 text-blue-600"><Pencil className="w-3.5 h-3.5" /></button><button title="Eliminar" onClick={() => onDeletePurchase(purchase.id)} className="p-1 text-red-600"><Trash2 className="w-3.5 h-3.5" /></button></td></tr>)}</tbody></table></div>}
          </div>
        )}
        {tab === 'loans' && <>{loans.length} préstamos registrados.{loans.length > 0 && <div className="overflow-x-auto mt-3"><table className="w-full"><thead><tr className="text-left text-slate-500"><th className="py-1 pr-3">Trabajador</th><th className="py-1 pr-3">Concepto</th><th className="py-1 pr-3">Desde</th><th className="py-1 text-right">Cuota</th><th className="py-1 text-right">Saldo</th><th className="py-1 text-center">Acciones</th></tr></thead><tbody className="divide-y">{loans.map((item) => <tr key={item.id}><td className="py-2 pr-3 font-semibold">{item.employeeName}</td><td className="py-2 pr-3">{item.description}</td><td className="py-2 pr-3">{item.deductionWeekStart || getMondayDate(item.createdAt)}</td><td className="py-2 text-right">{formatBs(item.installmentBs)}<div className="text-[10px] text-slate-500">{formatUSD(item.installmentBs / exchangeRate)}</div></td><td className="py-2 text-right">{formatBs(item.outstandingBs)}<div className="text-[10px] text-slate-500">{formatUSD(item.outstandingBs / exchangeRate)}</div></td><td className="py-2 text-center"><button title="Editar" onClick={() => startEdit(item)} className="p-1 text-blue-600"><Pencil className="w-3.5 h-3.5" /></button><button title="Eliminar" onClick={() => onDeleteLoan(item.id)} className="p-1 text-red-600"><Trash2 className="w-3.5 h-3.5" /></button></td></tr>)}</tbody></table></div>}</>}
        {tab === 'absences' && <>{absences.length} inasistencias registradas.{absences.length > 0 && <div className="overflow-x-auto mt-3"><table className="w-full"><thead><tr className="text-left text-slate-500"><th className="py-1 pr-3">Trabajador</th><th className="py-1 pr-3">Fecha</th><th className="py-1 pr-3">Días</th><th className="py-1 pr-3">Motivo</th><th className="py-1 text-center">Acciones</th></tr></thead><tbody className="divide-y">{absences.map((item) => <tr key={item.id}><td className="py-2 pr-3 font-semibold">{item.employeeName}</td><td className="py-2 pr-3">{item.date}</td><td className="py-2 pr-3">{item.days}</td><td className="py-2 pr-3">{item.reason || '-'}</td><td className="py-2 text-center"><button title="Editar" onClick={() => startEditAbsence(item)} className="p-1 text-blue-600"><Pencil className="w-3.5 h-3.5" /></button><button title="Eliminar" onClick={() => onDeleteAbsence(item.id)} className="p-1 text-red-600"><Trash2 className="w-3.5 h-3.5" /></button></td></tr>)}</tbody></table></div>}</>}
        {tab === 'cashAdvances' && <>{cashAdvances.length} avances registrados.{cashAdvances.length > 0 && <div className="overflow-x-auto mt-3"><table className="w-full"><thead><tr className="text-left text-slate-500"><th className="py-1 pr-3">Trabajador</th><th className="py-1 pr-3">Concepto</th><th className="py-1 pr-3">Semana</th><th className="py-1 text-right">Monto</th><th className="py-1 text-center">Acciones</th></tr></thead><tbody className="divide-y">{cashAdvances.map((item) => <tr key={item.id}><td className="py-2 pr-3 font-semibold">{item.employeeName}</td><td className="py-2 pr-3">{item.description}</td><td className="py-2 pr-3">{item.deductionWeekStart}</td><td className="py-2 text-right">{formatBs(item.amountBs)} / {formatUSD(item.amountBs / exchangeRate)}</td><td className="py-2 text-center"><button title="Editar" onClick={() => startEditCashAdvance(item)} className="p-1 text-blue-600"><Pencil className="w-3.5 h-3.5" /></button><button title="Eliminar" onClick={() => onDeleteCashAdvance(item.id)} className="p-1 text-red-600"><Trash2 className="w-3.5 h-3.5" /></button></td></tr>)}</tbody></table></div>}</>}
      </div>
    </div>
  );
}
