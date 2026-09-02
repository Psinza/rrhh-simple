import React, { useState } from 'react';
import {
  X,
  User,
  History,
  Coins,
  Palmtree,
  FileText,
  CreditCard,
  Building,
  Calendar,
  DollarSign,
  TrendingUp,
  Plus,
  AlertCircle,
  ShieldCheck,
  Download,
} from 'lucide-react';
import { Employee, CompanySettings, WorkHistoryEvent, SocialBenefitsAdvance } from '../types';
import {
  calculateTenure,
  calculateIntegralSalary,
  calculateSocialBenefits,
  formatBs,
  formatUSD,
} from '../utils/venezuelaLaborCalculations';

interface EmployeeDetailModalProps {
  employee: Employee;
  company: CompanySettings;
  onClose: () => void;
  onGenerateCertificate: (employee: Employee) => void;
  onUpdateEmployee: (updated: Employee) => void;
}

export function EmployeeDetailModal({
  employee,
  company,
  onClose,
  onGenerateCertificate,
  onUpdateEmployee,
}: EmployeeDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'benefits' | 'vacations'>('benefits');

  // New History Event State
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [eventTipo, setEventTipo] = useState<WorkHistoryEvent['tipo']>('Aumento Salarial');
  const [eventTitulo, setEventTitulo] = useState('');
  const [eventDescripcion, setEventDescripcion] = useState('');
  const [eventNuevoSalario, setEventNuevoSalario] = useState('');

  // New Advance Request State
  const [showAddAdvance, setShowAddAdvance] = useState(false);
  const [advanceMonto, setAdvanceMonto] = useState('');
  const [advanceMotivo, setAdvanceMotivo] = useState<SocialBenefitsAdvance['motivo']>('Adquisición de Vivienda');

  const tenure = calculateTenure(employee.fechaIngreso);
  const integral = calculateIntegralSalary(
    employee.salarioMensualBase,
    tenure.anios,
    employee.diasUtilidadesAnuales || company.diasUtilidadesEmpresa
  );
  const benefits = calculateSocialBenefits(employee, company);

  const handleAddHistoryEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitulo) return;

    const newSalaryNum = eventNuevoSalario ? parseFloat(eventNuevoSalario) : undefined;

    const newEvent: WorkHistoryEvent = {
      id: `hist-${Date.now()}`,
      fecha: new Date().toISOString().split('T')[0],
      tipo: eventTipo,
      titulo: eventTitulo,
      descripcion: eventDescripcion,
      salarioAnterior: newSalaryNum ? employee.salarioMensualBase : undefined,
      nuevoSalario: newSalaryNum,
      registradoPor: 'Administrador RRHH',
    };

    const updatedEmployee: Employee = {
      ...employee,
      salarioMensualBase: newSalaryNum ? newSalaryNum : employee.salarioMensualBase,
      historialLaboral: [newEvent, ...employee.historialLaboral],
    };

    onUpdateEmployee(updatedEmployee);
    setShowAddEvent(false);
    setEventTitulo('');
    setEventDescripcion('');
    setEventNuevoSalario('');
  };

  const handleAddAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    const monto = parseFloat(advanceMonto);
    if (!monto || monto <= 0) return;

    if (monto > benefits.disponibleParaAnticipo) {
      alert(
        `El monto solicitado (${formatBs(monto)}) supera el límite legal del 75% disponible (${formatBs(
          benefits.disponibleParaAnticipo
        )}) según el Art. 144 de la LOTTT.`
      );
      return;
    }

    const pct = Math.round((monto / benefits.montoGarantiaTotal) * 100);

    const newAdvance: SocialBenefitsAdvance = {
      id: `ant-${Date.now()}`,
      fecha: new Date().toISOString().split('T')[0],
      monto,
      motivo: advanceMotivo,
      porcentajeDelFondo: pct,
      aprobadoPor: 'Dirección de Talento Humano',
    };

    const updatedEmployee: Employee = {
      ...employee,
      anticiposPrestaciones: [...(employee.anticiposPrestaciones || []), newAdvance],
    };

    onUpdateEmployee(updatedEmployee);
    setShowAddAdvance(false);
    setAdvanceMonto('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-4xl w-full p-6 shadow-xl border border-slate-200 space-y-5 my-8">
        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
              {employee.primerNombre.charAt(0)}
              {employee.primerApellido.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">
                  {employee.primerNombre} {employee.primerApellido} {employee.segundoApellido || ''}
                </h2>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                  {employee.cedula}
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase">
                  {employee.status}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {employee.cargo} • <strong className="text-slate-700">{employee.departamento}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={() => onGenerateCertificate(employee)}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-slate-600" />
              Constancia Laboral
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-b border-slate-200 text-xs font-semibold overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('benefits')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t transition-all ${
              activeTab === 'benefits'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Coins className="w-4 h-4 text-blue-600" />
            Prestaciones Sociales (Art. 142 LOTTT)
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t transition-all ${
              activeTab === 'history'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4 text-blue-600" />
            Historial Laboral ({employee.historialLaboral.length})
          </button>
          <button
            onClick={() => setActiveTab('vacations')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t transition-all ${
              activeTab === 'vacations'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Palmtree className="w-4 h-4 text-blue-600" />
            Vacaciones & Bono (Art. 190)
          </button>
          <button
            onClick={() => setActiveTab('info')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t transition-all ${
              activeTab === 'info'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-4 h-4 text-sky-600" />
            Datos Personales & Banco
          </button>
        </div>

        {/* Tab 1: Prestaciones Sociales LOTTT */}
        {activeTab === 'benefits' && (
          <div className="space-y-5">
            {/* Salario Integral Breakdown Banner */}
            <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
                    Base Salarial de Cálculo (Art. 122 LOTTT)
                  </span>
                  <h3 className="text-lg font-bold text-white">
                    Salario Diario Integral: {formatBs(integral.salarioDiarioIntegral)}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">Integral Mensual Equivalente:</span>
                  <div className="text-base font-extrabold text-emerald-400">
                    {formatBs(integral.salarioIntegralMensual)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                  <span className="text-slate-400">Salario Normal Diario (S/30):</span>
                  <div className="font-bold text-slate-200 mt-0.5">{formatBs(integral.salarioDiarioNormal)}</div>
                </div>
                <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                  <span className="text-slate-400">Alícuota Bono Vacacional ({integral.diasBonoVacacional}d/360):</span>
                  <div className="font-bold text-sky-300 mt-0.5">{formatBs(integral.alicuotaBonoVacacionalDiaria)}</div>
                </div>
                <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                  <span className="text-slate-400">Alícuota Utilidades ({employee.diasUtilidadesAnuales || 45}d/360):</span>
                  <div className="font-bold text-amber-300 mt-0.5">{formatBs(integral.alicuotaUtilidadesDiaria)}</div>
                </div>
              </div>
            </div>

            {/* Garantía vs Intereses vs Anticipos Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200/80">
                <span className="text-xs font-bold text-sky-800 uppercase tracking-wider">
                  Garantía Art. 142 (a y b)
                </span>
                <div className="text-xl font-extrabold text-slate-900 mt-1">
                  {formatBs(benefits.montoGarantiaTotal)}
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  {benefits.totalDiasGarantia} días de salario integral ({benefits.diasGarantiaAcumulados} trimestrales + {benefits.diasAdicionalesAntiguedad} adicionales)
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                  Intereses BCV (Art. 143)
                </span>
                <div className="text-xl font-extrabold text-slate-900 mt-1">
                  {formatBs(benefits.interesesAcumulados)}
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  Tasa activa BCV: {company.tasaInteresPrestacionesBCV}% anual
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/80">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                  Saldo Neto Acumulado
                </span>
                <div className="text-xl font-extrabold text-emerald-900 mt-1">
                  {formatBs(benefits.saldoNetoActual)}
                </div>
                <div className="text-xs text-emerald-700 mt-1">
                  Disponible para anticipo: {formatBs(benefits.disponibleParaAnticipo)} (75%)
                </div>
              </div>
            </div>

            {/* Anticipos Concedidos Section (Art. 144) */}
            <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    Anticipos de Prestaciones Sociales (Art. 144 LOTTT)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Límite máximo por ley: hasta el 75% del fondo acumulado para fines de vivienda, hipoteca, educación o salud.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddAdvance(!showAddAdvance)}
                  className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> Solicitar Anticipo
                </button>
              </div>

              {/* Formulario nuevo anticipo */}
              {showAddAdvance && (
                <form onSubmit={handleAddAdvance} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Monto Solicitado (Bs.) *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        max={benefits.disponibleParaAnticipo}
                        placeholder={`Máx: ${benefits.disponibleParaAnticipo.toFixed(2)}`}
                        value={advanceMonto}
                        onChange={(e) => setAdvanceMonto(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Motivo Justificado (LOTTT Art. 144) *</label>
                      <select
                        value={advanceMotivo}
                        onChange={(e) => setAdvanceMotivo(e.target.value as SocialBenefitsAdvance['motivo'])}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg"
                      >
                        <option value="Adquisición de Vivienda">Adquisición de Vivienda</option>
                        <option value="Liberación de Hipoteca">Liberación de Hipoteca</option>
                        <option value="Educación">Educación del Trabajador o Carga Familiar</option>
                        <option value="Gastos Médicos y Hospitalarios">Gastos Médicos y Hospitalarios</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddAdvance(false)}
                      className="px-3 py-1.5 text-slate-600 hover:bg-slate-200 rounded-lg"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 font-bold bg-sky-600 hover:bg-sky-500 text-white rounded-lg shadow-xs"
                    >
                      Aprobar y Registrar Anticipo
                    </button>
                  </div>
                </form>
              )}

              {/* Lista de Anticipos */}
              {(employee.anticiposPrestaciones || []).length > 0 ? (
                <div className="divide-y divide-slate-100 text-xs">
                  {(employee.anticiposPrestaciones || []).map((ant) => (
                    <div key={ant.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-800">{ant.motivo}</div>
                        <div className="text-[11px] text-slate-400">
                          Fecha: {ant.fecha} • Aprobado por: {ant.aprobadoPor}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900">{formatBs(ant.monto)}</span>
                        <div className="text-[10px] text-slate-500">({ant.porcentajeDelFondo}% del fondo)</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic py-2">
                  No se registran anticipos solicitados para este colaborador.
                </p>
              )}
            </div>

            {/* Comparativa Finiquito Retroactivo Art. 142 literal c */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h4 className="font-bold text-slate-800">
                  Comparativa de Liquidación en caso de Egreso (Art. 142 literal c)
                </h4>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Al término de la relación laboral, la LOTTT establece que se deben calcular 30 días de salario integral por cada año de servicio o fracción mayor a 6 meses. El trabajador recibirá el monto que resulte superior entre la garantía acumulada (más intereses) y el cálculo retroactivo:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-500">Monto Retroactivo (30 días por año):</span>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">
                    {formatBs(benefits.montoRetroactivoArt142c)}
                  </div>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-500">Garantía + Intereses Acumulados:</span>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">
                    {formatBs(benefits.montoGarantiaTotal + benefits.interesesAcumulados)}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-sky-800 font-semibold pt-1">
                Monto tutelado por ley a pagar: {formatBs(benefits.montoMayorAPagar)}
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Historial Laboral Completo */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  Trayectoria y Eventos del Colaborador
                </h4>
                <p className="text-xs text-slate-500">
                  Registro fidedigno de ingresos, ajustes de sueldo, ascensos, permisos y amonestaciones.
                </p>
              </div>
              <button
                onClick={() => setShowAddEvent(!showAddEvent)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Registrar Evento
              </button>
            </div>

            {/* Formulario nuevo evento */}
            {showAddEvent && (
              <form onSubmit={handleAddHistoryEvent} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Tipo de Evento *</label>
                    <select
                      value={eventTipo}
                      onChange={(e) => setEventTipo(e.target.value as WorkHistoryEvent['tipo'])}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="Aumento Salarial">Aumento Salarial</option>
                      <option value="Ascenso">Ascenso / Promoción</option>
                      <option value="Cambio Departamento">Cambio de Departamento</option>
                      <option value="Evaluación">Evaluación de Desempeño</option>
                      <option value="Vacaciones">Disfrute de Vacaciones</option>
                      <option value="Amonestación">Amonestación Escrita</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Título del Evento *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Promoción a Coordinador"
                      value={eventTitulo}
                      onChange={(e) => setEventTitulo(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                {eventTipo === 'Aumento Salarial' && (
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Nuevo Salario Mensual Base (Bs.) * (Actual: {formatBs(employee.salarioMensualBase)})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="Ej. 42000.00"
                      value={eventNuevoSalario}
                      onChange={(e) => setEventNuevoSalario(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg font-semibold"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Descripción y Justificación</label>
                  <textarea
                    rows={2}
                    placeholder="Detalles sobre el motivo o acuerdo laboral..."
                    value={eventDescripcion}
                    onChange={(e) => setEventDescripcion(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddEvent(false)}
                    className="px-3 py-1.5 text-slate-600 hover:bg-slate-200 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 font-bold bg-sky-600 hover:bg-sky-500 text-white rounded-lg shadow-xs"
                  >
                    Guardar en Expediente
                  </button>
                </div>
              </form>
            )}

            {/* Timeline */}
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {employee.historialLaboral.map((hist) => (
                <div key={hist.id} className="relative">
                  <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-white border-2 border-sky-600" />
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">{hist.titulo}</span>
                      <span className="text-[11px] text-slate-400 font-mono">{hist.fecha}</span>
                    </div>
                    <p className="text-slate-600 mt-1">{hist.descripcion}</p>
                    {hist.nuevoSalario && (
                      <div className="mt-2 p-2 bg-emerald-50 text-emerald-800 rounded-lg font-semibold flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5" />
                        Ajuste de Salario: {hist.salarioAnterior ? `${formatBs(hist.salarioAnterior)} → ` : ''}
                        {formatBs(hist.nuevoSalario)}
                      </div>
                    )}
                    <div className="text-[10px] text-slate-400 mt-2">
                      Registrado por: {hist.registradoPor}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Control de Vacaciones (Art. 190 LOTTT) */}
        {activeTab === 'vacations' && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
              <h4 className="font-bold text-emerald-950 text-sm">
                Régimen Vacacional y Bono Vacacional (Arts. 190 - 192 LOTTT)
              </h4>
              <p className="text-emerald-800 mt-1 leading-relaxed">
                El trabajador tiene derecho a 15 días hábiles remunerados por su primer año de servicio, más 1 día adicional por cada año posterior hasta un tope de 30 días hábiles.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 bg-white rounded-2xl border border-slate-200">
                <span className="text-slate-500">Días Bono Vacacional:</span>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {integral.diasBonoVacacional} días
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  15 días base + {Math.max(0, integral.diasBonoVacacional - 15)} adicionales
                </div>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200">
                <span className="text-slate-500">Vacaciones Disfrutadas:</span>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {employee.vacacionesDisfrutadas} días
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Registradas en expediente
                </div>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200">
                <span className="text-slate-500">Monto Estimado Bono Vacacional:</span>
                <div className="text-2xl font-black text-sky-700 mt-1">
                  {formatBs(integral.diasBonoVacacional * integral.salarioDiarioNormal)}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  A salario normal del período
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Datos Personales y Banco */}
        {activeTab === 'info' && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-sky-600" /> Identificación y Contacto
                </h4>
                <div className="space-y-1 text-slate-600">
                  <p><strong className="text-slate-800">Cédula:</strong> {employee.cedula}</p>
                  <p><strong className="text-slate-800">R.I.F.:</strong> {employee.rif}</p>
                  <p><strong className="text-slate-800">Correo Electrónico:</strong> {employee.email}</p>
                  <p><strong className="text-slate-800">Teléfono:</strong> {employee.telefono}</p>
                  <p><strong className="text-slate-800">Dirección:</strong> {employee.direccion}, {employee.ciudad}, {employee.estado}</p>
                  <p><strong className="text-slate-800">Cargas Familiares:</strong> {employee.cargasFamiliares} personas</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-sky-600" /> Datos Bancarios y Parafiscales
                </h4>
                <div className="space-y-1 text-slate-600">
                  <p><strong className="text-slate-800">Banco Receptor:</strong> {employee.banco}</p>
                  <p><strong className="text-slate-800">Número de Cuenta:</strong> <span className="font-mono">{employee.numeroCuenta}</span></p>
                  <p><strong className="text-slate-800">Tipo de Cuenta:</strong> {employee.tipoCuenta}</p>
                  <p><strong className="text-slate-800">Afiliación IVSS:</strong> <span className="font-mono">{employee.numeroAfiliacionIVSS}</span></p>
                  <p><strong className="text-slate-800">Retención ISLR (AR-I):</strong> {employee.porcentajeRetencionISLR}%</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
