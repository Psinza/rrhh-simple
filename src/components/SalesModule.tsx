import { FormEvent, useMemo, useState } from 'react';
import { BadgeDollarSign, Plus, Receipt, TrendingUp } from 'lucide-react';
import { Employee, SalesRecord } from '../types';
import { formatBs } from '../utils/venezuelaLaborCalculations';

interface SalesModuleProps {
  employees: Employee[];
  records: SalesRecord[];
  onAddRecord: (record: SalesRecord) => void;
}

export function SalesModule({ employees, records, onAddRecord }: SalesModuleProps) {
  const sellers = employees.filter((employee) => employee.status === 'activo');
  const [showForm, setShowForm] = useState(false);
  const [vendedorId, setVendedorId] = useState(sellers[0]?.id || '');
  const [cliente, setCliente] = useState('');
  const [referencia, setReferencia] = useState('');
  const [monto, setMonto] = useState('');
  const [porcentaje, setPorcentaje] = useState('3');
  const [observaciones, setObservaciones] = useState('');

  const totals = useMemo(
    () => records.reduce(
      (summary, record) => ({
        ventas: summary.ventas + record.montoBs,
        comisiones: summary.comisiones + record.comisionBs,
      }),
      { ventas: 0, comisiones: 0 }
    ),
    [records]
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const vendedor = employees.find((employee) => employee.id === vendedorId);
    const montoBs = Number(monto);
    const porcentajeComision = Number(porcentaje);
    if (!vendedor || !cliente.trim() || !montoBs || porcentajeComision < 0) {
      alert('Complete vendedor, cliente, monto y porcentaje de comisión.');
      return;
    }
    onAddRecord({
      id: `sale-${Date.now()}`,
      fecha: new Date().toISOString().split('T')[0],
      vendedorId: vendedor.id,
      vendedorNombre: `${vendedor.primerNombre} ${vendedor.primerApellido}`,
      cliente: cliente.trim(),
      referencia: referencia.trim() || 'Sin referencia',
      montoBs,
      porcentajeComision,
      comisionBs: montoBs * (porcentajeComision / 100),
      estatus: 'Pendiente',
      observaciones: observaciones.trim() || undefined,
    });
    setCliente('');
    setReferencia('');
    setMonto('');
    setObservaciones('');
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-violet-100 text-violet-700 flex items-center justify-center">
              <BadgeDollarSign className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Ventas y Comisiones</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">Registre ventas por vendedor y controle la comisión pendiente de liquidar en nómina.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold">
          <Plus className="w-4 h-4" /> Registrar venta
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4"><div className="text-xs text-slate-500">Ventas registradas</div><div className="text-xl font-bold text-slate-900">{formatBs(totals.ventas)}</div></div>
        <div className="bg-white rounded-xl border border-slate-200 p-4"><div className="text-xs text-slate-500">Comisiones acumuladas</div><div className="text-xl font-bold text-violet-700">{formatBs(totals.comisiones)}</div></div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-violet-200 p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-xs font-semibold text-slate-700">Vendedor<select value={vendedorId} onChange={(e) => setVendedorId(e.target.value)} className="mt-1 w-full p-2 border rounded-lg font-normal"><option value="">Seleccione</option>{sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.primerNombre} {seller.primerApellido}</option>)}</select></label>
            <label className="text-xs font-semibold text-slate-700">Cliente<input required value={cliente} onChange={(e) => setCliente(e.target.value)} className="mt-1 w-full p-2 border rounded-lg font-normal" /></label>
            <label className="text-xs font-semibold text-slate-700">Referencia<input value={referencia} onChange={(e) => setReferencia(e.target.value)} className="mt-1 w-full p-2 border rounded-lg font-normal" /></label>
            <label className="text-xs font-semibold text-slate-700">Monto de venta (Bs.)<input required type="number" min="0" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} className="mt-1 w-full p-2 border rounded-lg font-normal" /></label>
            <label className="text-xs font-semibold text-slate-700">% Comisión<input required type="number" min="0" step="0.01" value={porcentaje} onChange={(e) => setPorcentaje(e.target.value)} className="mt-1 w-full p-2 border rounded-lg font-normal" /></label>
            <label className="text-xs font-semibold text-slate-700">Observaciones<input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className="mt-1 w-full p-2 border rounded-lg font-normal" /></label>
          </div>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowForm(false)} className="px-3 py-2 text-xs text-slate-600">Cancelar</button><button className="px-4 py-2 rounded-lg bg-violet-600 text-white text-xs font-bold">Guardar venta</button></div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-2"><Receipt className="w-4 h-4 text-violet-600" /><h2 className="font-bold text-sm">Historial de ventas</h2></div>
        <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-slate-50 text-slate-500 uppercase text-[10px]"><tr><th className="p-3 text-left">Fecha / Vendedor</th><th className="p-3 text-left">Cliente</th><th className="p-3 text-right">Venta</th><th className="p-3 text-right">Comisión</th><th className="p-3 text-center">Estatus</th></tr></thead><tbody className="divide-y divide-slate-100">{records.map((record) => <tr key={record.id}><td className="p-3"><div className="font-semibold">{record.vendedorNombre}</div><div className="text-slate-400">{record.fecha}</div></td><td className="p-3">{record.cliente}<div className="text-slate-400">{record.referencia}</div></td><td className="p-3 text-right">{formatBs(record.montoBs)}</td><td className="p-3 text-right font-bold text-violet-700">{formatBs(record.comisionBs)}<div className="text-[10px] text-slate-400">{record.porcentajeComision}%</div></td><td className="p-3 text-center"><span className={`px-2 py-1 rounded-full text-[10px] font-bold ${record.estatus === 'Liquidada' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{record.estatus}</span></td></tr>)}</tbody></table>{records.length === 0 && <div className="p-8 text-center text-xs text-slate-400"><TrendingUp className="w-5 h-5 mx-auto mb-2" />No hay ventas registradas.</div>}</div>
      </div>
    </div>
  );
}
