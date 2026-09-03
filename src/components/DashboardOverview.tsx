import {
  Users,
  Wallet,
  Building,
  Coins,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  FileCheck2,
  FileText,
  TrendingUp,
  Download,
} from 'lucide-react';
import { CompanySettings, Employee, PayrollPeriod, LegalNotification } from '../types';
import { formatBs, formatUSD, calculateSocialBenefits } from '../utils/venezuelaLaborCalculations';

interface DashboardOverviewProps {
  company: CompanySettings;
  employees: Employee[];
  payroll: PayrollPeriod;
  notifications: LegalNotification[];
  onNavigate: (tab: string) => void;
  onOpenEmployeeDetail: (employee: Employee) => void;
  onQuickGenerateCertificate: () => void;
}

export function DashboardOverview({
  company,
  employees,
  payroll,
  notifications,
  onNavigate,
  onOpenEmployeeDetail,
  onQuickGenerateCertificate,
}: DashboardOverviewProps) {
  // Cálculos consolidados en tiempo real
  const activeEmployees = employees.filter((e) => e.status === 'activo');
  const totalSalariosBase = activeEmployees.reduce((acc, e) => acc + e.salarioMensualBase, 0);
  const totalCestaticket = activeEmployees.reduce(
    (acc, e) => acc + (e.cestaticketMensual || company.montoCestaticketNacional),
    0
  );
  const totalNominaEstimadaBs = totalSalariosBase + totalCestaticket;
  const totalNominaEstimadaUSD = company.tasaBCV_USD > 0 ? totalNominaEstimadaBs / company.tasaBCV_USD : 0;

  // Prestaciones acumuladas en garantía + intereses para todos los empleados activos
  const totalPrestacionesFondo = activeEmployees.reduce((acc, e) => {
    const report = calculateSocialBenefits(e, company);
    return acc + report.saldoNetoActual;
  }, 0);

  // Aportes patronales estimados mensuales (IVSS 10% promedio sobre tope, FAOV 2%, INCES 2%, RPE 2%)
  const topeIvssMensual = company.salarioMinimoNacional * 5;
  const aportesPatronalesMensuales = activeEmployees.reduce((acc, e) => {
    const baseSujeta = Math.min(e.salarioMensualBase, topeIvssMensual);
    const semanal = (baseSujeta * 12) / 52;
    const ivss = semanal * (company.nivelRiesgoIVSS / 100) * company.lunesDelMesActual;
    const rpe = semanal * 0.02 * company.lunesDelMesActual;
    const faov = e.salarioMensualBase * 0.02;
    const inces = e.salarioMensualBase * 0.02;
    return acc + ivss + rpe + faov + inces;
  }, 0);

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Left Main Column (col-span-12 lg:col-span-8) */}
      <div className="col-span-12 lg:col-span-8 space-y-6">
        {/* Metric Cards (Professional Polish) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Empleados Activos */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-tight">
              Empleados Activos
            </div>
            <div className="text-2xl font-bold mt-1 text-slate-900">
              {activeEmployees.length}
            </div>
            <div className="text-xs text-green-600 mt-1 flex items-center gap-1 font-medium">
              <span>+{activeEmployees.length} este mes</span>
              <span className="text-slate-400 font-normal">• 100% IVSS</span>
            </div>
          </div>

          {/* Card 2: Monto Total Nómina */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-tight">
              Monto Total Nómina
            </div>
            <div className="text-2xl font-bold mt-1 text-slate-800 font-mono">
              {formatBs(totalNominaEstimadaBs)}
            </div>
            <div className="text-xs text-slate-500 mt-1 truncate">
              Quincena Actual • Ref. {formatUSD(totalNominaEstimadaUSD)}
            </div>
          </div>

          {/* Card 3: Aportes Parafiscales */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-tight">
              Aportes Parafiscales
            </div>
            <div className="text-2xl font-bold mt-1 text-blue-600 font-mono">
              {formatBs(aportesPatronalesMensuales)}
            </div>
            <div className="text-xs text-slate-500 mt-1 truncate">
              Proyectado Mensual (IVSS/FAOV)
            </div>
          </div>
        </div>

        {/* Generación de Archivos de Cumplimiento (Professional Polish) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800 text-base">
              Generación de Archivos de Cumplimiento
            </h3>
            <button
              onClick={() => onNavigate('government_files')}
              className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-wide transition-colors"
            >
              Actualizar Datos
            </button>
          </div>

          <div className="space-y-4">
            {/* IVSS */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-blue-100 rounded text-blue-600 font-bold text-xs shrink-0">
                  IVSS
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800">
                    Archivo de Movimientos TIUNA
                  </div>
                  <div className="text-xs text-slate-500">
                    Corte: Octubre 2024 | Patronal: {company.numeroPatronalIVSS} • Riesgo {company.nivelRiesgoIVSS}%
                  </div>
                </div>
              </div>
              <button
                onClick={() => onNavigate('government_files')}
                className="text-blue-600 text-xs font-bold hover:underline shrink-0"
              >
                Generar .TXT
              </button>
            </div>

            {/* FAOV */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-orange-100 rounded text-orange-600 font-bold text-xs shrink-0">
                  FAOV
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800">
                    Carga Mensual BANAVIH
                  </div>
                  <div className="text-xs text-slate-500">
                    Consolidado de aportes patronales (2%) y retención trabajadores (1%)
                  </div>
                </div>
              </div>
              <button
                onClick={() => onNavigate('government_files')}
                className="text-blue-600 text-xs font-bold hover:underline shrink-0"
              >
                Generar Archivo
              </button>
            </div>

            {/* RECIBOS */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-green-100 rounded text-green-600 font-bold text-xs shrink-0">
                  REC
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800">
                    Recibos Digitales de Pago
                  </div>
                  <div className="text-xs text-slate-500">
                    Emisión electrónica formal con firma digital y verificación QR
                  </div>
                </div>
              </div>
              <button
                onClick={() => onNavigate('payroll')}
                className="text-blue-600 text-xs font-bold hover:underline shrink-0"
              >
                Enviar Recibos
              </button>
            </div>
          </div>
        </div>

        {/* Expedientes de Colaboradores & Historial Laboral Table Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">
                Expedientes de Colaboradores & Historial Laboral
              </h3>
              <p className="text-xs text-slate-500">
                Directorio con cálculo de prestaciones, vacaciones y emisión de constancias LOTTT.
              </p>
            </div>
            <button
              onClick={() => onNavigate('employees')}
              className="text-blue-600 text-xs font-bold hover:underline flex items-center gap-1 shrink-0"
            >
              Ver Todos ({employees.length}) <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Colaborador</th>
                  <th className="py-2.5 px-3">Cédula / RIF</th>
                  <th className="py-2.5 px-3">Cargo & Área</th>
                  <th className="py-2.5 px-3">Fecha Ingreso</th>
                  <th className="py-2.5 px-3 text-right">Salario Mensual</th>
                  <th className="py-2.5 px-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.slice(0, 5).map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 text-xs sm:text-sm">
                        {emp.primerNombre} {emp.primerApellido}
                      </div>
                      <div className="text-[11px] text-slate-400">{emp.email}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        {emp.cedula}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-xs font-medium text-slate-800">{emp.cargo}</div>
                      <div className="text-[10px] text-slate-400">{emp.departamento}</div>
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-600">{emp.fechaIngreso}</td>
                    <td className="py-3 px-3 text-right">
                      <div className="font-mono font-bold text-slate-900 text-xs">
                        {formatBs(emp.salarioMensualBase)}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {formatUSD(company.tasaBCV_USD > 0 ? emp.salarioMensualBase / company.tasaBCV_USD : 0)}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => onOpenEmployeeDetail(emp)}
                        className="text-blue-600 text-xs font-bold hover:underline"
                      >
                        Expediente
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right Sidebar Column (col-span-12 lg:col-span-4) */}
      <div className="col-span-12 lg:col-span-4 space-y-6">
        {/* Alertas Legales (Gaceta) (Professional Polish Blue Card) */}
        <div className="bg-blue-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-white/20 rounded-full font-bold text-xs flex items-center justify-center w-7 h-7">
              !
            </div>
            <h4 className="font-bold text-sm uppercase tracking-wide">
              Alertas Legales (Gaceta)
            </h4>
          </div>

          <div className="space-y-4">
            {notifications.slice(0, 3).map((notif, index) => {
              const timeTag =
                index === 0
                  ? 'HACE 2 DÍAS'
                  : index === 1
                  ? 'HACE 1 SEMANA'
                  : 'HACE 2 SEMANAS';
              return (
                <div
                  key={notif.id}
                  className="p-3 bg-white/10 rounded-lg border border-white/20"
                >
                  <div className="text-xs font-bold text-blue-100 mb-1">
                    {timeTag} • {notif.fecha}
                  </div>
                  <div className="text-sm leading-tight font-medium">
                    {notif.titulo}
                  </div>
                  <div className="text-xs text-blue-100/80 mt-1 line-clamp-2">
                    {notif.descripcion}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recursos del Sistema (Professional Polish) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h4 className="font-bold text-slate-800 text-sm mb-4 uppercase tracking-wide">
            Recursos del Sistema
          </h4>
          <ul className="space-y-3">
            <li
              onClick={() => onNavigate('benefits')}
              className="flex items-center gap-3 text-sm text-slate-600 hover:text-blue-600 cursor-pointer transition-colors"
            >
              <div className="w-2 h-2 bg-blue-400 rounded-full shrink-0" />
              <span>Calculadora de Prestaciones (Art. 142 LOTTT)</span>
            </li>
            <li
              onClick={() => onNavigate('employees')}
              className="flex items-center gap-3 text-sm text-slate-600 hover:text-blue-600 cursor-pointer transition-colors"
            >
              <div className="w-2 h-2 bg-blue-400 rounded-full shrink-0" />
              <span>Historial de Sueldos y Salarios</span>
            </li>
            <li
              onClick={onQuickGenerateCertificate}
              className="flex items-center gap-3 text-sm text-slate-600 hover:text-blue-600 cursor-pointer transition-colors"
            >
              <div className="w-2 h-2 bg-blue-400 rounded-full shrink-0" />
              <span>Constancias de Trabajo Automáticas</span>
            </li>
            <li
              onClick={() => onNavigate('government_files')}
              className="flex items-center gap-3 text-sm text-slate-600 hover:text-blue-600 cursor-pointer transition-colors"
            >
              <div className="w-2 h-2 bg-blue-400 rounded-full shrink-0" />
              <span>Configuración de Retención ISLR</span>
            </li>
          </ul>
        </div>

        {/* Fondo de Prestaciones Sociales (Art. 142 LOTTT) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-tight">
            Garantía Prestaciones (Art. 142 LOTTT)
          </div>
          <div className="text-2xl font-bold mt-1 text-slate-800 font-mono">
            {formatBs(totalPrestacionesFondo)}
          </div>
          <div className="text-xs text-amber-700 font-medium mt-1">
            Tasa Activa BCV: {company.tasaInteresPrestacionesBCV}% Anual
          </div>
          <button
            onClick={() => onNavigate('benefits')}
            className="mt-3 text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
          >
            Auditar Fideicomiso LOTTT <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
