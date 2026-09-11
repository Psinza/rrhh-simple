import { useState } from 'react';
import {
  FileSpreadsheet,
  ShieldCheck,
  CheckCircle,
  Eye,
  Users,
  Wallet,
  Landmark,
} from 'lucide-react';
import { CompanySettings, Employee, PayrollItem, PayrollPeriod } from '../types';
import {
  calculatePayrollDeductionsAndContributions,
  formatBs,
  formatUSD,
} from '../utils/venezuelaLaborCalculations';

interface PayrollModuleProps {
  company: CompanySettings;
  payroll: PayrollPeriod;
  employees?: Employee[];
  currentUser?: { rol?: string; nombre?: string };
  onUpdatePayroll: (payroll: PayrollPeriod) => void;
  onOpenSlip?: (item: PayrollItem) => void;
  onOpenPayslip?: (item: PayrollItem) => void;
  onApprovePayroll?: () => void;
  commissionByEmployee?: Record<string, number>;
  loanInstallmentByEmployee?: Record<string, number>;
  productDeductionByEmployee?: Record<string, number>;
}

export function PayrollModule({
  company,
  payroll,
  employees,
  currentUser,
  onUpdatePayroll,
  onOpenSlip,
  onOpenPayslip,
  onApprovePayroll,
}: PayrollModuleProps) {
  const [activeFrequency, setActiveFrequency] = useState<'semanal' | 'quincenal' | 'mensual'>(
    payroll.items[0]?.employee?.frecuenciaPago || 'mensual'
  );
  const [filterDept, setFilterDept] = useState<string>('todos');
  const [aplicarRetencionesGubernamentales, setAplicarRetencionesGubernamentales] = useState(true);
  const [showApprovedNotice, setShowApprovedNotice] = useState(false);

  const handleRecalculate = () => {
    const recalculatedItems = payroll.items.map((item) => {
      const calc = calculatePayrollDeductionsAndContributions(
        item.employee,
        company,
        activeFrequency,
        item.horasExtrasDiurnas,
        item.horasExtrasNocturnas,
        item.bonoProductividad,
        item.viaticos,
        item.prestamosAnticipos,
        item.deduccionesProductos,
        aplicarRetencionesGubernamentales
      );

      return {
        ...item,
        ...calc,
        employee: {
          ...item.employee,
          frecuenciaPago: activeFrequency,
        },
      };
    });

    onUpdatePayroll({
      ...payroll,
      items: recalculatedItems,
      tipo: activeFrequency === 'semanal' ? 'Semanal' : activeFrequency === 'quincenal' ? '1ra Quincena' : 'Mensual',
      totalNominaBs: recalculatedItems.reduce((sum, i) => sum + i.totalAsignaciones, 0),
      totalCestaticketBs: recalculatedItems.reduce((sum, i) => sum + i.cestaticketPeriodo, 0),
      totalAportesPatronalesBs: recalculatedItems.reduce((sum, i) => sum + i.totalAportesPatronales, 0),
      totalCostoEmpresaBs: recalculatedItems.reduce((sum, i) => sum + i.totalAsignaciones + i.totalAportesPatronales, 0),
    });
  };

  const handleApprovePayroll = () => {
    onUpdatePayroll({
      ...payroll,
      estatus: 'Aprobada',
    });
    setShowApprovedNotice(true);
    setTimeout(() => setShowApprovedNotice(false), 5000);
  };

  const filteredItems = payroll.items.filter((item) => {
    if (filterDept === 'todos') return true;
    return item.employee.departamento === filterDept;
  });

  const totalDeduccionesPeriodo = filteredItems.reduce((acc, i) => acc + i.totalDeducciones, 0);
  const totalNetoPagarPeriodo = filteredItems.reduce((acc, i) => acc + i.netoCobrarBs, 0);
  const payrollDepartments = Array.from(new Set(payroll.items.map((item) => item.employee.departamento)));

  const frequencySummary =
    activeFrequency === 'semanal'
      ? 'Semanal • 1 mes dividido en 4 semanas'
      : activeFrequency === 'quincenal'
        ? 'Quincenal • 1 mes dividido en 2 quincenas'
        : 'Mensual • 1 pago por mes completo';

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">
              Nómina Legal & Recibos Digitales (LOTTT)
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Período: <strong className="text-slate-800">{payroll.nombre}</strong> • Frecuencia: {payroll.tipo} • Retenciones y aportes calculados automáticamente.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-600 font-semibold">Tipo de nómina
              <select value={activeFrequency} onChange={(e) => setActiveFrequency(e.target.value as 'semanal' | 'quincenal' | 'mensual')} className="ml-2 px-2 py-2 text-xs bg-slate-50 border border-slate-200 rounded">
                <option value="semanal">Semanal - Obreros</option>
                <option value="quincenal">Quincenal - Administrativos</option>
                <option value="mensual">Mensual</option>
              </select>
            </label>
            <span className="ml-2 text-[10px] font-medium text-slate-500">{frequencySummary}</span>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-600 font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={aplicarRetencionesGubernamentales}
              onChange={(e) => setAplicarRetencionesGubernamentales(e.target.checked)}
              className="rounded border-slate-300 text-blue-600"
            />
            Aplicar retenciones gubernamentales
          </label>

          {(currentUser?.rol === 'rrhh' || currentUser?.rol === 'admin_sistema') && (
            <button
              onClick={handleRecalculate}
              className="px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors border border-slate-200"
            >
              Recalcular Nómina
            </button>
          )}

          {payroll.estatus !== 'Aprobada' ? (
            (currentUser?.rol === 'dueno' || currentUser?.rol === 'admin_sistema') ? (
              <button
                onClick={() => {
                  if (onApprovePayroll) onApprovePayroll();
                  else handleApprovePayroll();
                }}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded shadow-sm transition-all"
              >
                <CheckCircle className="w-4 h-4" />
                Aprobar y Sellar Nómina
              </button>
            ) : (
              <button
                disabled
                title="Solo el Dueño o Administrador puede aprobar la nómina"
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-slate-200 text-slate-500 rounded border border-slate-200"
              >
                <CheckCircle className="w-4 h-4" />
                Aprobar y Sellar Nómina
              </button>
            )
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-100 text-emerald-800 rounded border border-emerald-200">
              <ShieldCheck className="w-4 h-4" /> Nómina Aprobada y Sellada
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-slate-500"><Wallet className="w-3.5 h-3.5" /> Total nómina</div>
          <div className="mt-2 text-xl font-black text-slate-900">{formatBs(payroll.totalNominaBs || filteredItems.reduce((s, i) => s + i.totalAsignaciones, 0))}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-amber-700"><Landmark className="w-3.5 h-3.5" /> Deducciones</div>
          <div className="mt-2 text-xl font-black text-amber-800">{formatBs(totalDeduccionesPeriodo)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-emerald-700"><Users className="w-3.5 h-3.5" /> Neto a pagar</div>
          <div className="mt-2 text-xl font-black text-emerald-900">{formatBs(totalNetoPagarPeriodo)}</div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Resumen de empleados</h2>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-slate-600">Departamento</label>
            <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="text-xs border border-slate-200 rounded px-2 py-1 bg-white">
              <option value="todos">Todos</option>
              {payrollDepartments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No hay empleados para este período.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase text-[10px]">
                <tr>
                  <th className="px-3 py-3">Empleado</th>
                  <th className="px-3 py-3">Cargo</th>
                  <th className="px-3 py-3">Sueldo Base</th>
                  <th className="px-3 py-3">Neto</th>
                  <th className="px-3 py-3">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="border-t border-slate-200 hover:bg-slate-50">
                    <td className="px-3 py-3">
                      <div className="font-semibold text-slate-900">{item.employee.primerNombre} {item.employee.primerApellido}</div>
                      <div className="text-[10px] text-slate-500">{item.employee.cedula}</div>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{item.employee.cargo}</td>
                    <td className="px-3 py-3 font-medium text-slate-900">{formatBs(item.sueldoBasePeriodo)}</td>
                    <td className="px-3 py-3 font-bold text-emerald-700">{formatBs(item.netoCobrarBs)}</td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => {
                          if (onOpenSlip) onOpenSlip(item);
                          else if (onOpenPayslip) onOpenPayslip(item);
                        }}
                        className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700"
                      >
                        <Eye className="w-3.5 h-3.5 inline mr-1" /> Ver recibo
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showApprovedNotice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 px-4 py-3 text-xs font-medium">
          Nómina aprobada y sellada correctamente.
        </div>
      )}
    </div>
  );
}
