import { useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  ShieldCheck,
  CheckCircle,
  Eye,
  Users,
  Wallet,
  Landmark,
  Download,
} from 'lucide-react';
import { AbsenceRecord, CashAdvanceRecord, CompanySettings, Employee, EmployeeLoan, PayrollItem, PayrollPeriod, ProductAssignment, ProductPurchase } from '../types';
import { lightweightDb } from '../services/lightweightDb';
import {
  calculatePayrollDeductionsAndContributions,
  countWeekdaysInRange,
  formatBs,
  formatUSD,
  getMondayDate,
  getSalaryBaseInBs,
} from '../utils/venezuelaLaborCalculations';
import { buildBankPayrollFile, defaultSourceIdentifier, downloadBankPayrollFile } from '../utils/bankPayrollFile';
import { downloadBankPayrollWorkbook, downloadPayrollSummaryCsv } from '../utils/payrollSpreadsheet';
import {
  buildBankTransferCsv,
  buildBankTransferTxt,
  buildPayrollSummaryCsv,
  downloadTextFile,
} from '../utils/payrollExports';

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
  commissionSaleIdsByEmployee?: Record<string, string[]>;
  loanInstallmentByEmployee?: Record<string, number>;
  productDeductionByEmployee?: Record<string, number>;
  assignmentMonthlyByEmployee?: Record<string, number>;
  loans?: EmployeeLoan[];
  assignments?: ProductAssignment[];
  purchases?: ProductPurchase[];
  absences?: AbsenceRecord[];
  cashAdvances?: CashAdvanceRecord[];
}

const getFriday = (monday: string): string => {
  const date = new Date(`${monday}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 4);
  return date.toISOString().slice(0, 10);
};

export function PayrollModule({
  company,
  payroll,
  employees,
  currentUser,
  onUpdatePayroll,
  onOpenSlip,
  onOpenPayslip,
  onApprovePayroll,
  commissionByEmployee = {},
  commissionSaleIdsByEmployee = {},
  loanInstallmentByEmployee = {},
  productDeductionByEmployee = {},
  assignmentMonthlyByEmployee = {},
  loans = [],
  assignments = [],
  purchases = [],
  absences = [],
  cashAdvances = [],
}: PayrollModuleProps) {
  const activeFrequency = 'semanal';
  const [weekStart, setWeekStart] = useState(() => getMondayDate(payroll.fechaInicio || new Date().toISOString().slice(0, 10)));
  const [originAccount, setOriginAccount] = useState('');
  const [originIdType, setOriginIdType] = useState<'J' | 'V' | 'E'>('J');
  const [originIdNumber, setOriginIdNumber] = useState('');
  const [filterDept, setFilterDept] = useState<string>('todos');
  const [showApprovedNotice, setShowApprovedNotice] = useState(false);
  const [aplicarRetencionesGubernamentales, setAplicarRetencionesGubernamentales] = useState(true);
  const defaultIdentifier = defaultSourceIdentifier(company);
  const [showBankExport, setShowBankExport] = useState(false);
  const [sourceAccount, setSourceAccount] = useState('');
  const [sourceNationality, setSourceNationality] = useState(defaultIdentifier.nationality);
  const [sourceIdentifier, setSourceIdentifier] = useState(defaultIdentifier.identifier);
  const [bankExportError, setBankExportError] = useState('');

  const activeEmployees = (employees && employees.length > 0 ? employees : payroll.items.map((item) => item.employee))
    .filter((emp) => emp.status === 'activo');
  const hayEmpleadosConCestaticket = activeEmployees.some((emp) => emp.cestaticketAplica !== false);

  useEffect(() => {
    if (!hayEmpleadosConCestaticket) {
      setAplicarRetencionesGubernamentales(false);
    }
  }, [hayEmpleadosConCestaticket]);

  const handleBankExport = () => {
    try {
      const result = buildBankPayrollFile(payroll, { sourceAccount, sourceNationality, sourceIdentifier });
      downloadBankPayrollFile(result.content, payroll.nombre);
      setBankExportError('');
      setShowBankExport(false);
      alert(`Archivo bancario generado: ${result.transferredItems.length} transferencias. Se omitieron ${result.skippedItems.length} empleados con neto cero.`);
    } catch (error) {
      setBankExportError(error instanceof Error ? error.message : 'No se pudo generar el archivo bancario.');
    }
  };

  const handleBankWorkbookExport = async () => {
    try {
      await downloadBankPayrollWorkbook(payroll, { sourceAccount, sourceNationality, sourceIdentifier }, payroll.nombre);
      setBankExportError('');
      setShowBankExport(false);
    } catch (error) {
      setBankExportError(error instanceof Error ? error.message : 'No se pudo generar el Excel bancario.');
    }
  };

  const handleExportBankTxt = () => {
    try {
      const contents = buildBankTransferTxt(payroll.items, originAccount, originIdType, originIdNumber);
      downloadTextFile(contents, `nomina_bancaria_${payroll.fechaInicio}.txt`, 'text/plain;charset=utf-8');
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'No se pudo generar el TXT bancario.');
    }
  };

  const handleExportBankCsv = () => {
    try {
      const contents = buildBankTransferCsv(payroll.items, company.tasaBCV_USD, originAccount, originIdType, originIdNumber);
      downloadTextFile(contents, `nomina_bancaria_${payroll.fechaInicio}.csv`, 'text/csv;charset=utf-8');
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'No se pudo generar el archivo del banco.');
    }
  };

  const handleExportSummaryCsv = () => {
    try {
      const contents = buildPayrollSummaryCsv(payroll.items, payroll, company.tasaBCV_USD);
      downloadTextFile(contents, `resumen_nomina_${payroll.fechaInicio}.csv`, 'text/csv;charset=utf-8');
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'No se pudo generar el resumen de nómina.');
    }
  };

  const handleRecalculate = () => {
    if (payroll.estatus === 'Aprobada' && getMondayDate(weekStart) === payroll.fechaInicio) {
      window.alert('La semana ya fue aprobada. Seleccione otra semana para generar un nuevo período.');
      return;
    }
    const dailyRate = lightweightDb.getCurrencyRateForDate();
    const exchangeRate = dailyRate?.rate || company.tasaBCV_USD;
    if (!dailyRate) {
      window.alert('No existe una tasa BCV registrada para hoy. Se utilizará la tasa vigente configurada; registre la tasa oficial del día antes del próximo recálculo.');
    }
    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      window.alert('La tasa BCV vigente no es válida. Registre una tasa positiva antes de recalcular la nómina.');
      return;
    }
    const payrollCompany = { ...company, tasaBCV_USD: exchangeRate };
    const periodStart = getMondayDate(weekStart);
    const periodEnd = getFriday(periodStart);
    const diasHabiles = countWeekdaysInRange(periodStart, periodEnd);
    if (diasHabiles === 0) {
      window.alert('Seleccione una semana con días hábiles de lunes a viernes.');
      return;
    }
    const activeEmployees = (employees && employees.length > 0 ? employees : payroll.items.map((item) => item.employee))
      .filter((emp) => emp.status === 'activo');

    const sourceItems = activeEmployees.length > 0 ? activeEmployees : payroll.items;
    const recalculatedItems = sourceItems.map((source) => {
      const employee = 'employee' in source ? source.employee : source;
      const previousItem = 'employee' in source
        ? source
        : payroll.items.find((item) => item.employeeId === employee.id);
      const employeeLoans = loans.filter((loan) => loan.employeeId === employee.id && loan.status === 'Activo');
      const scheduledLoanDeduction = employeeLoans.reduce((sum, loan) => {
        const firstWeek = loan.deductionWeekStart || getMondayDate(loan.createdAt);
        return firstWeek <= periodStart ? sum + Math.min(loan.installmentBs, loan.outstandingBs) : sum;
      }, 0);
      const loanDeduction = loans.length > 0
        ? scheduledLoanDeduction
        : loanInstallmentByEmployee[employee.id] || 0;
      const payrollMonth = periodStart.slice(0, 7);
      const scheduledAssignmentDeduction = assignments
        .filter((assignment) => assignment.employeeId === employee.id && assignment.status === 'Asignado')
        .reduce((sum, assignment) => {
          if (assignment.deductionWeekStart) {
            return sum + (assignment.deductionWeekStart === periodStart ? assignment.amountBs : 0);
          }
          return sum + (assignment.month === payrollMonth ? assignment.amountBs / 4 : 0);
        }, 0);
      const scheduledPurchaseDeduction = purchases
        .filter((purchase) => purchase.employeeId === employee.id)
        .filter((purchase) => purchase.deductionWeekStart
          ? purchase.deductionWeekStart === periodStart
          : getMondayDate(purchase.purchaseDate) === periodStart)
        .reduce((sum, purchase) => sum + purchase.amountBs, 0);
      const productAssignmentDeduction = assignments.length > 0
        ? scheduledAssignmentDeduction
        : (assignmentMonthlyByEmployee[employee.id] || 0) / 4;
      const productPurchaseDeduction = purchases.length > 0
        ? scheduledPurchaseDeduction
        : productDeductionByEmployee[employee.id] || 0;
      const deduccionesProductos = productAssignmentDeduction + productPurchaseDeduction;
      const absenceDays = Math.min(diasHabiles, absences
        .filter((absence) => absence.employeeId === employee.id && absence.date >= periodStart && absence.date <= periodEnd)
        .filter((absence) => countWeekdaysInRange(absence.date, absence.date) > 0)
        .reduce((sum, absence) => sum + absence.days, 0));
      const absenceDeduction = (getSalaryBaseInBs(employee, exchangeRate) / 30) * absenceDays;
      const cashAdvanceDeduction = cashAdvances
        .filter((advance) => advance.employeeId === employee.id && advance.deductionWeekStart === periodStart)
        .reduce((sum, advance) => sum + advance.amountBs, 0);
      const calc = calculatePayrollDeductionsAndContributions(
        employee,
        payrollCompany,
        activeFrequency,
        previousItem?.horasExtrasDiurnas ?? employee.horasExtrasDiurnasPendientes ?? 0,
        previousItem?.horasExtrasNocturnas ?? employee.horasExtrasNocturnasPendientes ?? 0,
        previousItem?.bonoProductividad || 0,
        employee.viaticosPendientes || 0,
        loanDeduction,
        deduccionesProductos,
        aplicarRetencionesGubernamentales,
        absenceDeduction,
        cashAdvanceDeduction,
        diasHabiles,
        commissionByEmployee[employee.id] || 0
      );

      const baseItem = previousItem || {
        id: `slip-${employee.id}-${payroll.id}`,
        employeeId: employee.id,
        employee,
        fechaGeneracion: payroll.fechaPago,
        firmadoDigitalmente: false,
        hashCriptografico: `payroll-${employee.id}-${Date.now()}`,
      };

      return {
        ...baseItem,
        ...calc,
        commissionSaleIds: commissionSaleIdsByEmployee[employee.id] || previousItem?.commissionSaleIds || [],
        viaticosOriginal: employee.viaticosPendientesOriginal ?? employee.viaticosPendientes ?? 0,
        employee: {
          ...employee,
          frecuenciaPago: activeFrequency,
        },
      };
    });

    onUpdatePayroll({
      ...payroll,
      id: `period-${periodStart}`,
      nombre: `Semana del ${periodStart} al ${periodEnd}`,
      mes: new Intl.DateTimeFormat('es-VE', { month: 'long', timeZone: 'UTC' }).format(new Date(`${periodStart}T00:00:00Z`)),
      anio: Number(periodStart.slice(0, 4)),
      fechaInicio: periodStart,
      fechaFin: periodEnd,
      fechaPago: periodEnd,
      items: recalculatedItems,
      tipo: 'Semanal',
      estatus: 'Calculada',
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

  const frequencySummary = 'Semanal • días hábiles de lunes a viernes';

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
          <button
            onClick={() => setShowBankExport(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors"
            title="Generar archivo de carga bancaria"
          >
            <Download className="w-3.5 h-3.5" /> Archivo bancario
          </button>
          <button
            onClick={() => downloadPayrollSummaryCsv(filteredItems, payroll.nombre)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            title="Descargar resumen de nómina en CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Resumen CSV
          </button>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-600 font-semibold">Nómina semanal • lunes a viernes</span>
            <label className="text-[10px] text-slate-500">Lunes de la semana
              <input type="date" value={weekStart} onChange={(event) => { if (event.target.value) setWeekStart(getMondayDate(event.target.value)); }} className="ml-2 px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded" />
            </label>
            <span className="ml-2 text-[10px] font-medium text-slate-500">{frequencySummary} • cierre: {getFriday(weekStart)}</span>
          </div>

          {hayEmpleadosConCestaticket && (
            <label className="flex items-center gap-2 text-xs text-slate-600 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={aplicarRetencionesGubernamentales}
                onChange={(e) => setAplicarRetencionesGubernamentales(e.target.checked)}
                className="rounded border-slate-300 text-blue-600"
              />
              Aplicar retenciones gubernamentales
            </label>
          )}

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

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Archivo de pago bancario</h2>
          <p className="text-xs text-slate-500">TXT fijo de 46 caracteres; las transferencias usan el neto a pagar en Bs.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="text-xs font-semibold text-slate-700">Cuenta origen (20 dígitos)
            <input inputMode="numeric" maxLength={20} value={originAccount} onChange={(event) => setOriginAccount(event.target.value.replace(/\D/g, '').slice(0, 20))} className="mt-1 w-full rounded border border-slate-300 px-2 py-2 font-mono" placeholder="01911234567898745632" />
          </label>
          <label className="text-xs font-semibold text-slate-700">Tipo de identificador
            <select value={originIdType} onChange={(event) => setOriginIdType(event.target.value as 'J' | 'V' | 'E')} className="mt-1 w-full rounded border border-slate-300 px-2 py-2">
              <option value="J">J - Jurídico</option>
              <option value="V">V - Venezolano</option>
              <option value="E">E - Extranjero</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700">Identificador (9 dígitos)
            <input inputMode="numeric" maxLength={9} value={originIdNumber} onChange={(event) => setOriginIdNumber(event.target.value.replace(/\D/g, '').slice(0, 9))} className="mt-1 w-full rounded border border-slate-300 px-2 py-2 font-mono" placeholder="409644669" />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleExportBankTxt} disabled={payroll.items.length === 0} className="inline-flex items-center gap-2 rounded bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
            <Download className="h-4 w-4" /> Generar TXT
          </button>
          <button type="button" onClick={handleExportBankCsv} disabled={payroll.items.length === 0} className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
            <Download className="h-4 w-4" /> Generar Excel del banco
          </button>
          <button type="button" onClick={handleExportSummaryCsv} disabled={payroll.items.length === 0} className="inline-flex items-center gap-2 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50">
            <Download className="h-4 w-4" /> Resumen de nómina CSV
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-slate-500"><Wallet className="w-3.5 h-3.5" /> Total nómina</div>
          <div className="mt-2 text-xl font-black text-slate-900">{formatBs(payroll.totalNominaBs || filteredItems.reduce((s, i) => s + i.totalAsignaciones, 0))}</div>
          <div className="text-xs text-slate-500">{formatUSD((payroll.totalNominaBs || filteredItems.reduce((s, i) => s + i.totalAsignaciones, 0)) / company.tasaBCV_USD)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-amber-700"><Landmark className="w-3.5 h-3.5" /> Deducciones</div>
          <div className="mt-2 text-xl font-black text-amber-800">{formatBs(totalDeduccionesPeriodo)}</div>
          <div className="text-xs text-amber-700">{formatUSD(totalDeduccionesPeriodo / company.tasaBCV_USD)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-emerald-700"><Users className="w-3.5 h-3.5" /> Neto a pagar</div>
          <div className="mt-2 text-xl font-black text-emerald-900">{formatBs(totalNetoPagarPeriodo)}</div>
          <div className="text-xs text-emerald-700">{formatUSD(totalNetoPagarPeriodo / company.tasaBCV_USD)}</div>
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
                    <td className="px-3 py-3 font-medium text-slate-900">{formatBs(item.sueldoBasePeriodo)}<div className="text-[10px] text-slate-500">{formatUSD(item.sueldoBasePeriodo / company.tasaBCV_USD)}</div></td>
                    <td className="px-3 py-3 font-bold text-emerald-700">{formatBs(item.netoCobrarBs)}<div className="text-[10px] font-normal text-emerald-600">{formatUSD(item.netoCobrarUSD)}</div></td>
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

      {showBankExport && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-5 w-full max-w-md space-y-4">
            <div>
              <h2 className="font-bold text-slate-900">Archivo de pago bancario</h2>
              <p className="text-xs text-slate-500 mt-1">Formato fijo ND/NC de 46 caracteres. Se usará el neto a pagar en Bs.</p>
            </div>
            <label className="block text-xs font-semibold text-slate-700">Cuenta origen (20 dígitos)
              <input value={sourceAccount} onChange={(event) => setSourceAccount(event.target.value.replace(/\D/g, '').slice(0, 20))} inputMode="numeric" className="mt-1 w-full p-2 border border-slate-200 rounded font-mono" placeholder="01910000000000000000" />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label className="text-xs font-semibold text-slate-700">Tipo
                <select value={sourceNationality} onChange={(event) => setSourceNationality(event.target.value)} className="mt-1 w-full p-2 border border-slate-200 rounded">
                  <option value="J">J</option><option value="V">V</option><option value="E">E</option>
                </select>
              </label>
              <label className="col-span-2 text-xs font-semibold text-slate-700">Identificador (9 dígitos)
                <input value={sourceIdentifier} onChange={(event) => setSourceIdentifier(event.target.value.replace(/\D/g, '').slice(0, 9))} inputMode="numeric" className="mt-1 w-full p-2 border border-slate-200 rounded font-mono" />
              </label>
            </div>
            {bankExportError && <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">{bankExportError}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowBankExport(false); setBankExportError(''); }} className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded">Cancelar</button>
              <button onClick={handleBankExport} className="px-3 py-2 text-xs font-bold text-white bg-emerald-600 rounded">Generar TXT</button>
              <button onClick={handleBankWorkbookExport} className="px-3 py-2 text-xs font-bold text-white bg-blue-600 rounded">Generar Excel del banco</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
