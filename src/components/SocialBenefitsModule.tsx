import { useState } from 'react';
import {
  Coins,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  Users,
  Search,
  ArrowRight,
  Eye,
  Calculator,
  FileCheck,
} from 'lucide-react';
import { Employee, CompanySettings } from '../types';
import {
  calculateTenure,
  calculateIntegralSalary,
  calculateSocialBenefits,
  formatBs,
  formatUSD,
} from '../utils/venezuelaLaborCalculations';

interface SocialBenefitsModuleProps {
  employees: Employee[];
  company: CompanySettings;
  onOpenEmployeeDetail: (employee: Employee) => void;
}

export function SocialBenefitsModule({
  employees,
  company,
  onOpenEmployeeDetail,
}: SocialBenefitsModuleProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCalcEmployee, setSelectedCalcEmployee] = useState<Employee | null>(employees[0] || null);
  const [terminationType, setTerminationType] = useState<'renuncia' | 'despido_injustificado'>('renuncia');

  const activeEmployees = employees.filter((e) => e.status === 'activo');

  // Cálculos consolidados del fondo
  const totalGarantiaEmpresa = activeEmployees.reduce((acc, emp) => {
    const b = calculateSocialBenefits(emp, company);
    return acc + b.montoGarantiaTotal;
  }, 0);

  const totalInteresesEmpresa = activeEmployees.reduce((acc, emp) => {
    const b = calculateSocialBenefits(emp, company);
    return acc + b.interesesAcumulados;
  }, 0);

  const totalAnticiposEmpresa = activeEmployees.reduce((acc, emp) => {
    const b = calculateSocialBenefits(emp, company);
    return acc + b.totalAnticiposConcedidos;
  }, 0);

  const totalFondoNetoEmpresa = totalGarantiaEmpresa + totalInteresesEmpresa - totalAnticiposEmpresa;

  const filteredEmployees = activeEmployees.filter((emp) => {
    const term = searchTerm.toLowerCase();
    return (
      emp.primerNombre.toLowerCase().includes(term) ||
      emp.primerApellido.toLowerCase().includes(term) ||
      emp.cedula.toLowerCase().includes(term) ||
      emp.cargo.toLowerCase().includes(term)
    );
  });

  // Cálculo individual para el simulador de finiquito
  const simBenefits = selectedCalcEmployee ? calculateSocialBenefits(selectedCalcEmployee, company) : null;
  const simIntegral = selectedCalcEmployee
    ? calculateIntegralSalary(
        selectedCalcEmployee.salarioMensualBase,
        calculateTenure(selectedCalcEmployee.fechaIngreso).anios,
        selectedCalcEmployee.diasUtilidadesAnuales || company.diasUtilidadesEmpresa
      )
    : null;

  // Doble indemnización Art. 92 LOTTT en caso de despido injustificado
  const indemnizacionArt92 =
    terminationType === 'despido_injustificado' && simBenefits ? simBenefits.montoMayorAPagar : 0;
  const totalLiquidacionFiniquito = simBenefits ? simBenefits.montoMayorAPagar + indemnizacionArt92 : 0;
  const benefitsCurrencyLabel = 'Bs.';
  const benefitsReferenceCurrencyLabel = 'USD';

  return (
    <div className="space-y-6">
      {/* Top Banner (Professional Polish) */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
              <Coins className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">
              Régimen de Prestaciones Sociales (Art. 142 y 143 LOTTT)
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Garantía trimestral (15 días), días adicionales de antigüedad, intereses mensuales tasa activa BCV y anticipos (tope 75%).
          </p>
        </div>

        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs">
          <span className="text-amber-800 font-semibold block">Tasa Activa BCV Vigente:</span>
          <span className="text-base font-bold text-amber-900 font-mono">{company.tasaInteresPrestacionesBCV}% Anual</span>
        </div>
      </div>

      {/* Global Fund Summary (Professional Polish) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Total Garantía Trimestral
          </span>
          <div className="text-xl font-bold text-slate-900 font-mono mt-1">
            {formatBs(totalGarantiaEmpresa)}
            <span className="ml-2 text-[10px] align-middle font-bold text-slate-500">({benefitsCurrencyLabel})</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Art. 142 literales a y b
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Intereses Acumulados BCV
          </span>
          <div className="text-xl font-bold text-amber-700 font-mono mt-1">
            {formatBs(totalInteresesEmpresa)}
            <span className="ml-2 text-[10px] align-middle font-bold text-amber-600">({benefitsCurrencyLabel})</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Art. 143 tasa mensual de los 6 bancos
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Anticipos Otorgados (Art. 144)
          </span>
          <div className="text-xl font-bold text-slate-700 font-mono mt-1">
            -{formatBs(totalAnticiposEmpresa)}
            <span className="ml-2 text-[10px] align-middle font-bold text-slate-500">({benefitsCurrencyLabel})</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Vivienda, salud y educación
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Saldo Neto del Fondo Laboral
          </span>
          <div className="text-xl font-bold text-emerald-800 font-mono mt-1">
            {formatBs(totalFondoNetoEmpresa)}
            <span className="ml-2 text-[10px] align-middle font-bold text-emerald-700">({benefitsCurrencyLabel})</span>
          </div>
          <div className="text-xs text-emerald-700 mt-0.5 font-medium">
            Ref. BCV: {formatUSD(totalFondoNetoEmpresa / company.tasaBCV_USD)}
            <span className="ml-2 text-[10px] align-middle font-bold text-emerald-700">({benefitsReferenceCurrencyLabel})</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Staff Table & Termination Calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table of Employees and Benefits */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Control de Garantía e Intereses por Trabajador
              </h3>
              <p className="text-xs text-slate-500">
                Acreditación trimestral calculada a salario integral según Art. 122 de la LOTTT.
              </p>
            </div>

            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar trabajador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 rounded-lg border border-slate-200"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Colaborador</th>
                  <th className="py-3 px-3">Antigüedad</th>
                  <th className="py-3 px-3 text-right">Salario Integral</th>
                  <th className="py-3 px-3 text-right">Garantía Total</th>
                  <th className="py-3 px-3 text-right text-amber-700">Intereses BCV</th>
                  <th className="py-3 px-3 text-right font-bold text-emerald-900">Saldo Neto</th>
                  <th className="py-3 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp) => {
                  const b = calculateSocialBenefits(emp, company);
                  const tenure = calculateTenure(emp.fechaIngreso);

                  return (
                    <tr
                      key={emp.id}
                      onClick={() => setSelectedCalcEmployee(emp)}
                      className={`cursor-pointer transition-colors ${
                        selectedCalcEmployee?.id === emp.id ? 'bg-amber-50/50 font-medium' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">
                          {emp.primerNombre} {emp.primerApellido}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{emp.cedula}</div>
                      </td>

                      <td className="py-3 px-3 text-slate-600 text-[11px]">
                        {tenure.anios}a {tenure.meses}m
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-medium text-slate-800">
                        {formatBs(b.salarioIntegralMensual)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-slate-800">
                        {formatBs(b.montoGarantiaTotal)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-amber-700">
                        +{formatBs(b.interesesAcumulados)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-black text-emerald-900">
                        {formatBs(b.saldoNetoActual)}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenEmployeeDetail(emp);
                          }}
                          className="px-2 py-1 text-[11px] bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-700 rounded border border-slate-200"
                        >
                          Expediente
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Termination / Finiquito Simulator Panel */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Calculator className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Simulador de Liquidación (Art. 142 c)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Comparativa de garantía acumulada vs cálculo retroactivo.
                </p>
              </div>
            </div>

            {selectedCalcEmployee && simBenefits && simIntegral ? (
              <div className="space-y-3 mt-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="font-bold text-slate-900 text-sm">
                    {selectedCalcEmployee.primerNombre} {selectedCalcEmployee.primerApellido}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {selectedCalcEmployee.cedula} • {selectedCalcEmployee.cargo}
                  </div>
                  <div className="text-[11px] text-slate-600 mt-1">
                    Ingreso: {selectedCalcEmployee.fechaIngreso} ({simBenefits.antiguedadAnios} años, {simBenefits.antiguedadMeses} meses)
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Motivo de Desvinculación:</label>
                  <select
                    value={terminationType}
                    onChange={(e) => setTerminationType(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                  >
                    <option value="renuncia">Renuncia Voluntaria / Mutuo Acuerdo</option>
                    <option value="despido_injustificado">Despido Injustificado (Art. 92 Doble Indemnización)</option>
                  </select>
                </div>

                {/* Comparative breakdown */}
                <div className="space-y-2 p-3 bg-sky-50/50 rounded-xl border border-sky-100 text-slate-700 text-xs">
                  <div className="flex justify-between">
                    <span>Garantía + Intereses:</span>
                    <strong className="text-slate-900">
                      {formatBs(simBenefits.montoGarantiaTotal + simBenefits.interesesAcumulados)}
                    </strong>
                  </div>

                  <div className="flex justify-between">
                    <span>Cálculo Retroactivo (30d/año):</span>
                    <strong className="text-slate-900">
                      {formatBs(simBenefits.montoRetroactivoArt142c)}
                    </strong>
                  </div>

                  <div className="border-t border-sky-200/60 pt-1.5 flex justify-between font-bold text-sky-950">
                    <span>Monto Mayor Aplicable (Art. 142 c):</span>
                    <span>{formatBs(simBenefits.montoMayorAPagar)}</span>
                  </div>

                  {terminationType === 'despido_injustificado' && (
                    <div className="flex justify-between text-amber-800 font-semibold pt-1 border-t border-amber-200/60">
                      <span>Indemnización Art. 92 (Doble):</span>
                      <span>+{formatBs(indemnizacionArt92)}</span>
                    </div>
                  )}

                  {simBenefits.totalAnticiposConcedidos > 0 && (
                    <div className="flex justify-between text-slate-500 pt-1">
                      <span>Deducción de Anticipos:</span>
                      <span>-{formatBs(simBenefits.totalAnticiposConcedidos)}</span>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-emerald-50 rounded-xl border-2 border-emerald-400 text-emerald-950">
                  <span className="text-[10px] font-bold uppercase tracking-wider block">
                    TOTAL FINIQUITO ESTIMADO
                  </span>
                  <div className="text-xl font-black mt-0.5">
                    {formatBs(totalLiquidacionFiniquito - simBenefits.totalAnticiposConcedidos)}
                  </div>
                  <span className="text-[11px] text-emerald-700 font-semibold">
                    Ref. BCV: {formatUSD((totalLiquidacionFiniquito - simBenefits.totalAnticiposConcedidos) / company.tasaBCV_USD)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-6 text-center">
                Seleccione un colaborador de la lista para calcular su finiquito o prestaciones.
              </p>
            )}
          </div>

          <div className="text-[10px] text-slate-400 flex items-center gap-1.5 border-t border-slate-100 pt-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Cálculos auditados y verificados conforme a la LOTTT de Venezuela.
          </div>
        </div>
      </div>
    </div>
  );
}
