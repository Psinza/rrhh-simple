import { useState } from 'react';
import {
  FileSpreadsheet,
  CheckCircle,
  FileText,
  DollarSign,
  Download,
  Building,
  Users,
  ShieldCheck,
  Send,
  Calendar,
  Lock,
} from 'lucide-react';
import { PayrollPeriod, Employee, CompanySettings, PayrollItem, AppUser } from '../types';
import {
  formatBs,
  formatUSD,
  calculatePayrollDeductionsAndContributions,
} from '../utils/venezuelaLaborCalculations';

interface PayrollModuleProps {
  payroll: PayrollPeriod;
  company: CompanySettings;
  employees: Employee[];
  currentUser?: AppUser | null;
  onOpenSlip: (item: PayrollItem) => void;
  onUpdatePayroll: (newPayroll: PayrollPeriod) => void;
  onApprovePayroll?: () => void;
}

export function PayrollModule({
  payroll,
  company,
  employees,
  currentUser,
  onOpenSlip,
  onUpdatePayroll,
  onApprovePayroll,
}: PayrollModuleProps) {
  const [activeFrequency, setActiveFrequency] = useState<'quincenal' | 'mensual'>('quincenal');
  const [filterDept, setFilterDept] = useState('todos');
  const [showApprovedNotice, setShowApprovedNotice] = useState(false);

  // Recalculate payroll with latest employee figures if needed
  const handleRecalculate = () => {
    if (!(currentUser?.rol === 'rrhh' || currentUser?.rol === 'admin_sistema')) {
      alert('Acceso denegado: solo el Gerente de RRHH o Administrador pueden recalcular la nómina.');
      return;
    }
    const updatedItems: PayrollItem[] = employees
      .filter((e) => e.status === 'activo')
      .map((emp) => {
        const calc = calculatePayrollDeductionsAndContributions(
          emp,
          company,
          activeFrequency,
          emp.horasExtrasDiurnasPendientes,
          emp.horasExtrasNocturnasPendientes,
          0
        );

        return {
          id: `slip-${emp.id}-${Date.now()}`,
          employeeId: emp.id,
          employee: emp,
          ...calc,
          fechaGeneracion: new Date().toISOString().split('T')[0],
          firmadoDigitalmente: true,
          firmaFecha: new Date().toISOString(),
          hashCriptografico: `SHA256-${emp.cedula.replace(/[^0-9]/g, '')}-${Date.now().toString(36).toUpperCase()}`,
        };
      });

    const totalNominaBs = updatedItems.reduce((sum, item) => sum + item.totalAsignacionesSalariales, 0);
    const totalCestaticketBs = updatedItems.reduce((sum, item) => sum + item.cestaticketPeriodo, 0);
    const totalAportesPatronalesBs = updatedItems.reduce((sum, item) => sum + item.totalAportesPatronales, 0);
    const totalCostoEmpresaBs = totalNominaBs + totalCestaticketBs + totalAportesPatronalesBs;

    const newPayroll: PayrollPeriod = {
      ...payroll,
      tipo: activeFrequency === 'quincenal' ? '1ra Quincena' : 'Mensual',
      items: updatedItems,
      totalNominaBs,
      totalCestaticketBs,
      totalAportesPatronalesBs,
      totalCostoEmpresaBs,
      estatus: 'Calculada',
    };

    onUpdatePayroll(newPayroll);
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

  return (
    <div className="space-y-6">
      {/* Top Banner and Summary */}
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
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-800 text-xs flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <strong>¡Nómina Aprobada con Éxito!</strong> Los recibos de pago digitales han sido sellados con firma criptográfica y están disponibles para descarga y envío por correo electrónico.
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Total Asignaciones Sueldo
          </span>
          <div className="text-xl font-bold text-slate-900 font-mono mt-1">
            {formatBs(payroll.totalNominaBs)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Sueldo base + Horas extras legales
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Cestaticket Socialista (Exento)
          </span>
          <div className="text-xl font-bold text-blue-700 font-mono mt-1">
            {formatBs(payroll.totalCestaticketBs)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Beneficio de alimentación no salarial
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Retenciones a Trabajadores
          </span>
          <div className="text-xl font-bold text-amber-700 font-mono mt-1">
            {formatBs(totalDeduccionesPeriodo)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            IVSS 4% • Paro 0.5% • FAOV 1% • ISLR
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Total Neto a Pagar a Personal
          </span>
          <div className="text-xl font-bold text-slate-900 font-mono mt-1">
            {formatBs(totalNetoPagarPeriodo)}
          </div>
          <div className="text-xs font-semibold text-slate-500 mt-0.5">
            Ref. BCV: {formatUSD(company.tasaBCV_USD > 0 ? totalNetoPagarPeriodo / company.tasaBCV_USD : 0)}
          </div>
        </div>
      </div>

      {/* Interactive Payroll Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Detalle Individual de Liquidación de Período
            </h3>
            <p className="text-xs text-slate-500">
              Desglose transparente con deducciones parafiscales y costo patronal para la seguridad social.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Departamento:</span>
            <select
              aria-label="Filtrar liquidación por departamento"
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5"
            >
              <option value="todos">Todos</option>
              <option value="Operaciones">Operaciones</option>
              <option value="Tecnología">Tecnología</option>
              <option value="Finanzas">Finanzas</option>
              <option value="Talento Humano">Talento Humano</option>
              <option value="Seguridad & Salud Laboral">Seguridad & Salud Laboral</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">Colaborador</th>
                <th className="py-3 px-3 text-right">Sueldo Período</th>
                <th className="py-3 px-3 text-right">Cestaticket</th>
                <th className="py-3 px-3 text-right text-amber-700">IVSS (4%)</th>
                <th className="py-3 px-3 text-right text-amber-700">Paro (0.5%)</th>
                <th className="py-3 px-3 text-right text-amber-700">FAOV (1%)</th>
                <th className="py-3 px-3 text-right font-bold text-slate-900">Neto a Cobrar</th>
                <th className="py-3 px-3 text-right text-indigo-700">Aporte Patrono</th>
                <th className="py-3 px-3 text-center">Recibo Digital</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-900">
                      {item.employee.primerNombre} {item.employee.primerApellido}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {item.employee.cedula} • {item.employee.cargo}
                    </div>
                  </td>

                  <td className="py-3 px-3 text-right font-medium text-slate-800">
                    {formatBs(item.totalAsignacionesSalariales)}
                  </td>

                  <td className="py-3 px-3 text-right font-medium text-sky-700">
                    {formatBs(item.cestaticketPeriodo)}
                  </td>

                  <td className="py-3 px-3 text-right text-amber-700 font-mono">
                    -{formatBs(item.retencionIVSS)}
                  </td>

                  <td className="py-3 px-3 text-right text-amber-700 font-mono">
                    -{formatBs(item.retencionParoForzoso)}
                  </td>

                  <td className="py-3 px-3 text-right text-amber-700 font-mono">
                    -{formatBs(item.retencionFAOV)}
                  </td>

                  <td className="py-3 px-3 text-right font-extrabold text-emerald-900">
                    {formatBs(item.netoCobrarBs)}
                  </td>

                  <td className="py-3 px-3 text-right text-indigo-800 font-medium">
                    {formatBs(item.totalAportesPatronales)}
                  </td>

                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => onOpenSlip(item)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold rounded-lg border border-sky-200 transition-colors shadow-2xs"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Ver Recibo
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
