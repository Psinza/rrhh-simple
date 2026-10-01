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
  ClipboardCheck,
  AlertTriangle,
  X,
} from 'lucide-react';
import { CompanySettings, Employee, PayrollItem, PayrollPeriod } from '../types';
import {
  calculatePayrollDeductionsAndContributions,
  formatBs,
  formatUSD,
} from '../utils/venezuelaLaborCalculations';
import { buildBankPayrollFile, defaultSourceIdentifier, downloadBankPayrollFile } from '../utils/bankPayrollFile';
import { downloadBankPayrollWorkbook, downloadPayrollSummaryCsv } from '../utils/payrollSpreadsheet';
import {
  getUnjustifiedAbsenceDeduction,
  getUnjustifiedAbsencesOutsidePeriod,
} from '../utils/employeeAttendance';
import { PayrollHalf } from '../utils/payrollPeriods';
import { getPayrollApprovalBlockReason } from '../utils/payrollOperationGuards';

interface PayrollModuleProps {
  company: CompanySettings;
  payroll: PayrollPeriod;
  payrollPeriods: PayrollPeriod[];
  employees?: Employee[];
  currentUser?: { rol?: string; nombre?: string };
  onUpdatePayroll: (payroll: PayrollPeriod, exchangeRate?: number, historicalRate?: boolean) => void;
  onSelectPayroll: (payroll: PayrollPeriod) => void;
  onCreatePayrollPeriod: (year: number, month: number, half: PayrollHalf) => void;
  bcvRateSync: {
    status: 'idle' | 'loading' | 'current' | 'stale' | 'error';
    rate?: number;
    effectiveDate?: string;
    historical?: boolean;
    message?: string;
  };
  onRefreshBcvRate: (effectiveDate: string) => Promise<{ rate: number; historical: boolean }>;
  getLoanDeductionsForRate: (exchangeRate: number) => {
    details: Record<string, NonNullable<PayrollItem['prestamosAnticiposDetalle']>>;
    installments: Record<string, number>;
  };
  getSalaryAdvanceDeductionsForRate: (exchangeRate: number) => {
    details: Record<string, NonNullable<PayrollItem['adelantosSueldoDetalle']>>;
    installments: Record<string, number>;
  };
  onOpenSlip?: (item: PayrollItem) => void;
  onOpenPayslip?: (item: PayrollItem) => void;
  onApprovePayroll: () => Promise<void>;
  onConfirmBankFile: () => void;
  productDeductionByEmployee?: Record<string, number>;
}

export function PayrollModule({
  company,
  payroll,
  payrollPeriods,
  employees,
  currentUser,
  onUpdatePayroll,
  onSelectPayroll,
  onCreatePayrollPeriod,
  bcvRateSync,
  onRefreshBcvRate,
  getLoanDeductionsForRate,
  getSalaryAdvanceDeductionsForRate,
  onOpenSlip,
  onOpenPayslip,
  onApprovePayroll,
  onConfirmBankFile,
  productDeductionByEmployee,
}: PayrollModuleProps) {
  const [activeFrequency, setActiveFrequency] = useState<'semanal' | 'quincenal' | 'mensual'>(
    payroll.items[0]?.employee?.frecuenciaPago || 'mensual'
  );
  const [filterDept, setFilterDept] = useState<string>('todos');
  const [aplicarRetencionesGubernamentales, setAplicarRetencionesGubernamentales] = useState(true);
  const [showApprovedNotice, setShowApprovedNotice] = useState(false);
  const defaultIdentifier = defaultSourceIdentifier(company);
  const [showBankExport, setShowBankExport] = useState(false);
  const [bankTextGenerated, setBankTextGenerated] = useState(false);
  const [sourceAccount, setSourceAccount] = useState('');
  const [sourceNationality, setSourceNationality] = useState(defaultIdentifier.nationality);
  const [sourceIdentifier, setSourceIdentifier] = useState(defaultIdentifier.identifier);
  const [bankExportError, setBankExportError] = useState('');
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalculationError, setRecalculationError] = useState('');
  const [targetMonth, setTargetMonth] = useState(payroll.fechaPago.slice(0, 7));
  const [targetHalf, setTargetHalf] = useState<PayrollHalf>('second');
  const [pendingOperation, setPendingOperation] = useState<'recalculate' | 'approve' | null>(null);
  const [operationError, setOperationError] = useState('');

  const activeEmployees = (employees && employees.length > 0 ? employees : payroll.items.map((item) => item.employee))
    .filter((emp) => emp.status === 'activo');
  const outOfPeriodAbsences = getUnjustifiedAbsencesOutsidePeriod(
    activeEmployees,
    payroll.fechaInicio,
    payroll.fechaFin,
  );
  const hayEmpleadosConCestaticket = activeEmployees.some((emp) => emp.cestaticketAplica !== false);
  const calculatedFrequency = payroll.items[0]?.employee?.frecuenciaPago
    ?? (payroll.tipo === 'Semanal' ? 'semanal' : payroll.tipo === 'Mensual' ? 'mensual' : 'quincenal');
  const frequencyNeedsRecalculation = payroll.items.length > 0
    && payroll.items.some((item) => item.employee.frecuenciaPago !== activeFrequency);
  const approvalBlockReason = getPayrollApprovalBlockReason(payroll);
  const previewRate = payroll.tasaBCV_USD ?? bcvRateSync.rate ?? company.tasaBCV_USD;
  const absencePreview = activeEmployees.flatMap((employee) => (
    getUnjustifiedAbsenceDeduction(
      employee,
      payroll.fechaInicio,
      payroll.fechaFin,
      activeFrequency,
      previewRate,
    ).details.map((absence) => ({
      ...absence,
      employeeName: `${employee.primerNombre} ${employee.primerApellido}`,
    }))
  ));
  const loanPreview = getLoanDeductionsForRate(previewRate);
  const loanPreviewDetails = Object.entries(loanPreview.details).flatMap(([employeeId, details]) => (
    details.map((loan) => {
      const employee = activeEmployees.find((candidate) => candidate.id === employeeId);
      return {
        ...loan,
        employeeName: employee ? `${employee.primerNombre} ${employee.primerApellido}` : 'Colaborador',
      };
    })
  ));
  const salaryAdvancePreview = getSalaryAdvanceDeductionsForRate(previewRate);
  const salaryAdvancePreviewDetails = Object.entries(salaryAdvancePreview.details).flatMap(([employeeId, details]) => (
    details.map((advance) => {
      const employee = activeEmployees.find((candidate) => candidate.id === employeeId);
      return {
        ...advance,
        employeeName: employee ? `${employee.primerNombre} ${employee.primerApellido}` : 'Colaborador',
      };
    })
  ));
  const previewDeductions = absencePreview.reduce((sum, absence) => sum + absence.amountBs, 0)
    + loanPreviewDetails.reduce((sum, loan) => sum + loan.amountBs, 0)
    + salaryAdvancePreviewDetails.reduce((sum, advance) => sum + advance.amountBs, 0)
    + Object.values(productDeductionByEmployee || {}).reduce((sum, amount) => sum + amount, 0);

  useEffect(() => {
    setActiveFrequency(calculatedFrequency);
    setTargetMonth(payroll.fechaPago.slice(0, 7));
  }, [calculatedFrequency, payroll.id]);

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
      setBankTextGenerated(true);
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

  const handleRecalculate = async (): Promise<boolean> => {
    if (payroll.archivoBancarioConfirmado) {
      setRecalculationError('No se puede recalcular: el archivo TXT bancario ya fue confirmado.');
      return false;
    }
    if (payroll.estatus === 'Pagada') {
      setRecalculationError('No se puede recalcular una nómina marcada como pagada.');
      return false;
    }

    setIsRecalculating(true);
    setRecalculationError('');
    try {
      const { rate, historical } = await onRefreshBcvRate(payroll.fechaPago);
      const payrollCompany = { ...company, tasaBCV_USD: rate };
      const loanDeductions = getLoanDeductionsForRate(rate);
      const salaryAdvanceDeductions = getSalaryAdvanceDeductionsForRate(rate);
      const activeEmployees = (
        employees && employees.length > 0
          ? employees
          : payroll.items.map((item) => item.employee)
      ).filter((emp) => emp.status === 'activo');

      const sourceItems = activeEmployees.length > 0 ? activeEmployees : payroll.items;
      const recalculatedItems = sourceItems.map((source) => {
        const employee = 'employee' in source ? source.employee : source;
        const absenceDeduction = getUnjustifiedAbsenceDeduction(
          employee,
          payroll.fechaInicio,
          payroll.fechaFin,
          activeFrequency,
          rate,
        );
        const productDeduction = productDeductionByEmployee
          ? productDeductionByEmployee[employee.id] || 0
          : 'deduccionesProductos' in source ? source.deduccionesProductos : 0;
        const baseCalc = calculatePayrollDeductionsAndContributions(
          employee,
          payrollCompany,
          activeFrequency,
          'horasExtrasDiurnas' in source ? source.horasExtrasDiurnas : 0,
          'horasExtrasNocturnas' in source ? source.horasExtrasNocturnas : 0,
          'bonoProductividad' in source ? source.bonoProductividad : 0,
          'viaticos' in source ? source.viaticos : 0,
          loanDeductions.installments[employee.id] || 0,
          productDeduction,
          aplicarRetencionesGubernamentales,
          absenceDeduction.totalBs,
        );
        let remainingAdvanceCapacityBs = Math.max(0, baseCalc.netoCobrarBs);
        const advanceDetails = (salaryAdvanceDeductions.details[employee.id] || []).flatMap((advance) => {
          const amountBs = Math.min(advance.amountBs, remainingAdvanceCapacityBs);
          remainingAdvanceCapacityBs -= amountBs;
          if (amountBs <= 0) return [];
          return [{
            ...advance,
            amountBs,
            amountOriginal: advance.currency === 'USD' && rate > 0 ? amountBs / rate : amountBs,
          }];
        });
        const advanceDeductionBs = advanceDetails.reduce((sum, advance) => sum + advance.amountBs, 0);
        const calc = advanceDeductionBs > 0
          ? calculatePayrollDeductionsAndContributions(
            employee,
            payrollCompany,
            activeFrequency,
            'horasExtrasDiurnas' in source ? source.horasExtrasDiurnas : 0,
            'horasExtrasNocturnas' in source ? source.horasExtrasNocturnas : 0,
            'bonoProductividad' in source ? source.bonoProductividad : 0,
            'viaticos' in source ? source.viaticos : 0,
            (loanDeductions.installments[employee.id] || 0) + advanceDeductionBs,
            productDeduction,
            aplicarRetencionesGubernamentales,
            absenceDeduction.totalBs,
          )
          : baseCalc;

        const baseItem = 'employee' in source ? source : {
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
          ausenciasDeducidasDetalle: absenceDeduction.details,
          prestamosAnticiposDetalle: loanDeductions.details[employee.id] || [],
          adelantosSueldoDetalle: advanceDetails,
          employee: {
            ...employee,
            frecuenciaPago: activeFrequency,
          },
        };
      });

      onUpdatePayroll({
        ...payroll,
        tasaBCV_USD: rate,
        estatus: 'Calculada',
        items: recalculatedItems,
        tipo: activeFrequency === 'semanal' ? 'Semanal' : activeFrequency === 'quincenal' ? '1ra Quincena' : 'Mensual',
        totalNominaBs: recalculatedItems.reduce((sum, i) => sum + i.totalAsignaciones, 0),
        totalCestaticketBs: recalculatedItems.reduce((sum, i) => sum + i.cestaticketPeriodo, 0),
        totalAportesPatronalesBs: recalculatedItems.reduce((sum, i) => sum + i.totalAportesPatronales, 0),
        totalCostoEmpresaBs: recalculatedItems.reduce((sum, i) => sum + i.totalAsignaciones + i.totalAportesPatronales, 0),
      }, rate, historical);
      return true;
    } catch (error) {
      setRecalculationError(
        error instanceof Error ? error.message : 'No se pudo validar la tasa oficial del BCV.',
      );
      return false;
    } finally {
      setIsRecalculating(false);
    }
  };

  const confirmPendingOperation = async () => {
    setOperationError('');
    if (pendingOperation === 'recalculate') {
      if (await handleRecalculate()) setPendingOperation(null);
      return;
    }
    if (pendingOperation === 'approve') {
      try {
        await onApprovePayroll();
        setPendingOperation(null);
        setShowApprovedNotice(true);
        setTimeout(() => setShowApprovedNotice(false), 5000);
      } catch (error) {
        setOperationError(error instanceof Error ? error.message : 'No se pudo aprobar la nómina.');
      }
    }
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
      <section className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="flex min-w-56 flex-col gap-1 text-xs font-semibold text-slate-700">
          Período activo
          <select
            value={payroll.id}
            onChange={(event) => {
              const selectedPayroll = payrollPeriods.find((period) => period.id === event.target.value);
              if (selectedPayroll) onSelectPayroll(selectedPayroll);
            }}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-normal"
          >
            {payrollPeriods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.nombre} · {period.estatus}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
          Mes del nuevo período
          <input
            type="month"
            value={targetMonth}
            onChange={(event) => setTargetMonth(event.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-normal"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
          Quincena
          <select
            value={targetHalf}
            onChange={(event) => setTargetHalf(event.target.value as PayrollHalf)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-normal"
          >
            <option value="first">1ra quincena (1–15)</option>
            <option value="second">2da quincena (16–fin de mes)</option>
          </select>
        </label>
        <button
          type="button"
          disabled={!/^\d{4}-\d{2}$/.test(targetMonth)}
          onClick={() => {
            const [year, month] = targetMonth.split('-').map(Number);
            onCreatePayrollPeriod(year, month, targetHalf);
          }}
          className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Crear o abrir período
        </button>
      </section>
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
          {outOfPeriodAbsences.length > 0 && (
            <p role="status" className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {outOfPeriodAbsences.length} ausencia(s) injustificada(s) registrada(s) fuera de este período no se descuentan en esta nómina:
              {' '}
              {outOfPeriodAbsences.slice(0, 3).map((absence) => `${absence.employeeName} (${absence.date})`).join(', ')}
              {outOfPeriodAbsences.length > 3 ? ` y ${outOfPeriodAbsences.length - 3} más` : ''}.
              Recalcule una nómina cuyo rango incluya esas fechas.
            </p>
          )}
          {bcvRateSync.status !== 'idle' && (
            <p
              role={bcvRateSync.status === 'error' ? 'alert' : 'status'}
              className={`mt-2 text-xs ${
                bcvRateSync.status === 'error' || bcvRateSync.status === 'stale'
                  ? 'text-amber-700'
                  : 'text-emerald-700'
              }`}
            >
              {bcvRateSync.status === 'loading'
                ? 'Consultando la tasa oficial USD del BCV…'
                : bcvRateSync.status === 'error'
                  ? bcvRateSync.message
                  : `Tasa oficial BCV: Bs. ${bcvRateSync.rate?.toFixed(8)} por USD • Vigente desde ${bcvRateSync.effectiveDate}${bcvRateSync.historical ? ' • tasa histórica del período' : ''}${bcvRateSync.status === 'stale' ? ` • ${bcvRateSync.message || 'se usa la última tasa oficial guardada'}` : ''}`}
            </p>
          )}
          {recalculationError && <p className="mt-2 text-xs text-red-700" role="alert">{recalculationError}</p>}
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
            <label className="text-xs text-slate-600 font-semibold">Tipo de nómina
              <select value={activeFrequency} onChange={(e) => setActiveFrequency(e.target.value as 'semanal' | 'quincenal' | 'mensual')} className="ml-2 px-2 py-2 text-xs bg-slate-50 border border-slate-200 rounded">
                <option value="semanal">Semanal - Obreros</option>
                <option value="quincenal">Quincenal - Administrativos</option>
                <option value="mensual">Mensual</option>
              </select>
              {frequencyNeedsRecalculation && (
                <span className="mt-1 block text-xs text-amber-700">
                  Este tipo de pago se aplicará al recibo al recalcular la nómina.
                </span>
              )}
            </label>
            <span className="ml-2 text-[10px] font-medium text-slate-500">{frequencySummary}</span>
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

          {(currentUser?.rol === 'rrhh' || currentUser?.rol === 'admin_sistema' || currentUser?.rol === 'dueno') && (
            <button
              onClick={() => setPendingOperation('recalculate')}
              disabled={isRecalculating || bcvRateSync.status === 'loading' || payroll.archivoBancarioConfirmado || payroll.estatus === 'Pagada'}
              className="px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors border border-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              title={payroll.archivoBancarioConfirmado ? 'El archivo TXT bancario ya fue confirmado.' : payroll.estatus === 'Pagada' ? 'No se puede modificar una nómina pagada.' : undefined}
            >
              {isRecalculating ? 'Validando tasa BCV…' : payroll.archivoBancarioConfirmado ? 'TXT bancario confirmado' : payroll.estatus === 'Pagada' ? 'Nómina pagada' : 'Recalcular Nómina'}
            </button>
          )}

          {payroll.estatus !== 'Aprobada' && payroll.estatus !== 'Pagada' ? (
            (currentUser?.rol === 'dueno' || currentUser?.rol === 'admin_sistema') ? (
              <button
                onClick={() => setPendingOperation('approve')}
                disabled={bcvRateSync.status === 'loading' || approvalBlockReason !== null || payroll.archivoBancarioConfirmado}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-60"
                title={approvalBlockReason ?? undefined}
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
              <ShieldCheck className="w-4 h-4" /> {payroll.estatus === 'Pagada' ? 'Nómina pagada' : 'Nómina Aprobada y Sellada'}
            </span>
          )}
        </div>
      </div>

      <section aria-label="Control operativo de nómina" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-2">
          <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-slate-900">Control operativo de nómina</h2>
            <p className="mt-1 text-xs text-slate-600">
              Período liquidado: {payroll.fechaInicio} al {payroll.fechaFin} · {payroll.items.length || activeEmployees.length} colaborador(es) · Estado: {payroll.estatus}.
              {' '}Tasa guardada del cálculo: Bs. {payroll.tasaBCV_USD?.toFixed(8) ?? 'pendiente'} por USD.
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Revisión previa: {absencePreview.length} ausencia(s), {loanPreviewDetails.length} cuota(s) de préstamo y {salaryAdvancePreviewDetails.length} adelanto(s) · Deducciones estimadas: {formatBs(previewDeductions)}.
              {' '}Las ausencias se descuentan únicamente si su fecha cae dentro del rango indicado.
            </p>
            {approvalBlockReason && (
              <p role="status" className="mt-2 flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{approvalBlockReason}</span>
              </p>
            )}
            {(absencePreview.length > 0 || loanPreviewDetails.length > 0 || salaryAdvancePreviewDetails.length > 0 || previewDeductions > 0) && (
              <details className="mt-2 text-xs text-slate-700">
                <summary className="cursor-pointer font-semibold">Ver detalle de deducciones estimadas</summary>
                <ul className="mt-2 space-y-1 pl-4">
                  {absencePreview.map((absence) => (
                    <li key={absence.attendanceEventId}>
                      {absence.employeeName}: ausencia del {absence.date}, {absence.days} día(s), {formatBs(absence.amountBs)}.
                    </li>
                  ))}
                  {loanPreviewDetails.map((loan) => (
                    <li key={loan.loanId}>
                      {loan.employeeName} · {loan.description}: cuota {formatBs(loan.amountBs)}.
                    </li>
                  ))}
                  {salaryAdvancePreviewDetails.map((advance) => (
                    <li key={advance.advanceId}>
                      {advance.employeeName} · {advance.description}: adelanto {formatBs(advance.amountBs)}.
                    </li>
                  ))}
                  {activeEmployees.filter((employee) => (productDeductionByEmployee?.[employee.id] || 0) > 0).map((employee) => (
                    <li key={`product-${employee.id}`}>
                      {employee.primerNombre} {employee.primerApellido}: compras/asignaciones {formatBs(productDeductionByEmployee?.[employee.id] || 0)}.
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {operationError && <p role="alert" className="mt-2 text-xs font-medium text-rose-700">{operationError}</p>}
          </div>
        </div>
      </section>

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

      {pendingOperation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="payroll-operation-title"
            className="w-full max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="payroll-operation-title" className="font-bold text-slate-900">
                  {pendingOperation === 'recalculate' ? 'Confirmar recálculo' : 'Confirmar aprobación'}
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  {pendingOperation === 'recalculate'
                    ? `Se consultará la tasa BCV para ${payroll.fechaPago}, se actualizarán recibos, ausencias y cuotas, y se invalidará cualquier aprobación anterior.`
                    : `Se volverá a validar la tasa BCV del período ${payroll.nombre}. La aprobación quedará registrada en la auditoría; el TXT todavía no estará confirmado.`}
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar confirmación"
                onClick={() => { setPendingOperation(null); setOperationError(''); }}
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
              <p><strong>Rango:</strong> {payroll.fechaInicio} al {payroll.fechaFin}</p>
              <p><strong>Colaboradores:</strong> {payroll.items.length || activeEmployees.length}</p>
              <p><strong>Tasa almacenada:</strong> Bs. {payroll.tasaBCV_USD?.toFixed(8) ?? 'pendiente'} por USD</p>
              <p><strong>Deducciones revisadas:</strong> {formatBs(previewDeductions)} ({absencePreview.length} ausencia(s), {loanPreviewDetails.length} cuota(s) de préstamo, {salaryAdvancePreviewDetails.length} adelanto(s))</p>
            </div>
            {operationError && <p role="alert" className="text-xs text-rose-700">{operationError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setPendingOperation(null); setOperationError(''); }}
                disabled={isRecalculating}
                className="rounded bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmPendingOperation}
                disabled={isRecalculating || (pendingOperation === 'approve' && approvalBlockReason !== null)}
                className="rounded bg-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRecalculating ? 'Procesando…' : pendingOperation === 'recalculate' ? 'Validar BCV y recalcular' : 'Validar BCV y aprobar'}
              </button>
            </div>
          </section>
        </div>
      )}

      {showBankExport && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-5 w-full max-w-md space-y-4">
            <div>
              <h2 className="font-bold text-slate-900">Archivo de pago bancario</h2>
              <p className="text-xs text-slate-500 mt-1">Formato fijo ND/NC de 46 caracteres. Se usará el neto a pagar en Bs.</p>
            </div>
            {payroll.archivoBancarioConfirmado ? (
              <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded p-2">
                El archivo TXT fue confirmado{payroll.archivoBancarioConfirmadoEn ? ` el ${new Date(payroll.archivoBancarioConfirmadoEn).toLocaleString('es-VE')}` : ''}. El recálculo de esta nómina está bloqueado.
              </p>
            ) : bankTextGenerated ? (
              <div className="space-y-2">
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                  TXT descargado. Revíselo y confirme que está listo para enviar al banco para bloquear el recálculo.
                </p>
                <button
                  onClick={() => {
                    onConfirmBankFile();
                    setBankTextGenerated(false);
                    setShowBankExport(false);
                  }}
                  className="w-full px-3 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded"
                >
                  Confirmar TXT y bloquear recálculo
                </button>
              </div>
            ) : null}
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
              <button onClick={() => { setShowBankExport(false); setBankExportError(''); setBankTextGenerated(false); }} className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded">Cerrar</button>
              {!payroll.archivoBancarioConfirmado && (
                <button onClick={handleBankExport} className="px-3 py-2 text-xs font-bold text-white bg-emerald-600 rounded">Generar TXT</button>
              )}
              <button onClick={handleBankWorkbookExport} className="px-3 py-2 text-xs font-bold text-white bg-blue-600 rounded">Generar Excel del banco</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
