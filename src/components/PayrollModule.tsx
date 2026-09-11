import { useMemo, useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Eye,
  Printer,
  Wallet,
  ArrowUpDown,
  Users,
  Landmark,
  BadgeCheck,
  Search,
  Sparkles,
  Filter,
  Plus,
  Trash2,
} from 'lucide-react';
import { CompanySettings, Employee, PayrollItem, PayrollPeriod, PayrollFrequency } from '../types';
import { formatBs, formatUSD } from '../utils/venezuelaLaborCalculations';

interface PayrollModuleProps {
  company: CompanySettings;
  payroll: PayrollPeriod;
  currentUser?: { rol?: string; nombre?: string };
  onUpdatePayroll: (payroll: PayrollPeriod) => void;
  onOpenPayslip: (item: PayrollItem) => void;
  onApprovePayroll?: () => void;
}

export function PayrollModule({
  company,
  payroll,
  currentUser,
  onUpdatePayroll,
  onOpenPayslip,
  onApprovePayroll,
}: PayrollModuleProps) {
  const [activeFrequency, setActiveFrequency] = useState<'semanal' | 'quincenal' | 'mensual'>(payroll.items[0]?.employee?.frecuenciaPago || 'mensual');
  const [filterDept, setFilterDept] = useState<string>('todos');
  const [aplicarRetencionesGubernamentales, setAplicarRetencionesGubernamentales] = useState(true);
  const [showApprovedNotice, setShowApprovedNotice] = useState(false);

  const handleRecalculate = () => {
    const recalculatedItems = payroll.items.map((item) => {
      const salaryBase = item.employee.salarioMensualBase || 0;
      const frequencyFactor = activeFrequency === 'semanal' ? 1 / 4 : activeFrequency === 'quincenal' ? 1 / 2 : 1;
      const sueldoBasePeriodo = salaryBase * frequencyFactor;

      return {
        ...item,
        sueldoBasePeriodo,
        diasTrabajados: activeFrequency === 'semanal' ? 5 : activeFrequency === 'quincenal' ? 15 : 30,
        totalAsignacionesSalariales: sueldoBasePeriodo,
        totalAsignaciones: sueldoBasePeriodo,
        netoCobrarBs: sueldoBasePeriodo,
        netoCobrarUSD: sueldoBasePeriodo / company.tasaBCV_USD,
      };
    });

    onUpdatePayroll({
      ...payroll,
      items: recalculatedItems,
      totalNominaBs: recalculatedItems.reduce((sum, i) => sum + i.totalAsignaciones, 0),
      totalCestaticketBs: 0,
      totalAportesPatronalesBs: 0,
      totalCostoEmpresaBs: recalculatedItems.reduce((sum, i) => sum + i.totalAsignaciones, 0),
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
  const payrollCurrencyLabel = 'Bs.';
  const referenceCurrencyLabel = 'USD';

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
            <input type="checkbox" checked={aplicarRetencionesGubernamentales} onChange={(e) => setAplicarRetencionesGubernamentales(e.target.checked)} className="rounded border-slate-300 text-blue-600" />
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

      {showApprovedNotice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 px-4 py-3 text-xs font-medium">
          Nómina aprobada y sellada correctamente.
        </div>
      )}
    </div>
  );
}
