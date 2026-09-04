import { useState } from 'react';
import {
  X,
  Printer,
  ShieldCheck,
  Building,
  CheckCircle2,
  FileCheck,
  Lock,
  Download,
} from 'lucide-react';
import { PayrollItem, CompanySettings } from '../types';
import { formatBs, formatUSD } from '../utils/venezuelaLaborCalculations';

interface DigitalPaySlipModalProps {
  item: PayrollItem;
  company: CompanySettings;
  periodName: string;
  onClose: () => void;
}

export function DigitalPaySlipModal({
  item,
  company,
  periodName,
  onClose,
}: DigitalPaySlipModalProps) {
  const [isSigned, setIsSigned] = useState(item.firmadoDigitalmente);
  const [signatureDate, setSignatureDate] = useState(item.firmaFecha || new Date().toLocaleString('es-VE'));
  const slipCurrencyLabel = 'Bs.';
  const slipReferenceCurrencyLabel = 'USD';

  const handleSign = () => {
    setIsSigned(true);
    setSignatureDate(new Date().toLocaleString('es-VE'));
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-3xl w-full p-6 sm:p-8 shadow-xl border border-slate-200 my-8 space-y-6 print-card">
        {/* Top Control Bar (Hidden on print) */}
        <div className="flex items-center justify-between no-print border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-1 rounded bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              Recibo Digital Certificado LOTTT
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Hash: {item.hashCriptografico.substring(0, 16)}...
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded transition-all border border-slate-200"
            >
              <Printer className="w-3.5 h-3.5" /> Imprimir / PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* --- OFFICIAL PAY SLIP PRINTABLE AREA --- */}
        <div className="space-y-4 text-xs font-sans text-slate-900 border border-slate-200 p-6 rounded-xl bg-white shadow-xs">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                {company.logoUrl && (
                  <img
                    src={company.logoUrl}
                    alt="Logo Empresa"
                    className="h-12 w-auto max-w-[120px] object-contain shrink-0 rounded border border-slate-200 p-0.5"
                  />
                )}
                <div>
                  <h2 className="text-base font-black uppercase tracking-tight text-slate-900">
                    {company.razonSocial}
                  </h2>
                  <div className="text-[11px] text-slate-600 space-y-0.5 mt-0.5">
                    <p>
                      <strong>R.I.F.:</strong> {company.rif} • <strong>N° Patronal IVSS:</strong> {company.numeroPatronalIVSS}
                    </p>
                    <p>
                      <strong>Código FAOV:</strong> {company.codigoAportanteFAOV} • <strong>INCES:</strong> {company.codigoInces}
                    </p>
                    <p>{company.direccionFiscal}, {company.ciudad}, Venezuela</p>
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="inline-block bg-slate-900 text-white font-extrabold text-[11px] px-3 py-1 rounded">
                  RECIBO DE PAGO
                </span>
                <p className="text-[11px] font-bold text-slate-800 mt-1">{periodName}</p>
                <p className="text-[10px] text-slate-500">Fecha de Pago: {item.fechaGeneracion}</p>
              </div>
            </div>
          </div>

          {/* Employee Identification Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px]">
            <div>
              <span className="text-slate-500 block">Colaborador:</span>
              <strong className="text-slate-900">
                {item.employee.primerNombre} {item.employee.primerApellido}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">Cédula de Identidad:</span>
              <strong className="font-mono text-slate-900">{item.employee.cedula}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Cargo:</span>
              <strong className="text-slate-900">{item.employee.cargo}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Departamento:</span>
              <strong className="text-slate-900">{item.employee.departamento}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Fecha de Ingreso:</span>
              <strong className="text-slate-900">{item.employee.fechaIngreso}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Banco y N° de Cuenta:</span>
              <strong className="font-mono text-[10px] text-slate-900">
                {item.employee.banco} ({item.employee.numeroCuenta.slice(-8)})
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">Salario Mensual Base:</span>
              <strong className="text-slate-900">
                {formatBs(item.employee.salarioMensualBase)}
                <span className="ml-1 text-[10px] align-middle font-bold text-slate-500">({slipCurrencyLabel})</span>
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">Días Liquidados:</span>
              <strong className="text-slate-900">{item.diasTrabajados} días</strong>
            </div>
          </div>

          {/* Concepts Table: Asignaciones y Deducciones */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700 text-[10px] uppercase">
                <tr>
                  <th className="py-2 px-3 w-16">Código</th>
                  <th className="py-2 px-3">Concepto Laboral</th>
                  <th className="py-2 px-3 text-right">Asignaciones (Bs.)</th>
                  <th className="py-2 px-3 text-right">Deducciones (Bs.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* Sueldo Base Periodo */}
                <tr>
                  <td className="py-1.5 px-3 font-mono text-slate-500 text-[11px]">001</td>
                  <td className="py-1.5 px-3">Sueldo Base del Período ({item.diasTrabajados} días)</td>
                  <td className="py-1.5 px-3 text-right font-medium">{formatBs(item.sueldoBasePeriodo)}</td>
                  <td className="py-1.5 px-3 text-right text-slate-400">-</td>
                </tr>

                {/* Horas Extras Diurnas */}
                {item.horasExtrasDiurnas > 0 && (
                  <tr>
                    <td className="py-1.5 px-3 font-mono text-slate-500 text-[11px]">005</td>
                    <td className="py-1.5 px-3">Horas Extras Diurnas ({item.horasExtrasDiurnas} hrs recargo 50% LOTTT)</td>
                    <td className="py-1.5 px-3 text-right font-medium">{formatBs(item.montoHorasExtrasDiurnas)}</td>
                    <td className="py-1.5 px-3 text-right text-slate-400">-</td>
                  </tr>
                )}

                {/* Horas Extras Nocturnas */}
                {item.horasExtrasNocturnas > 0 && (
                  <tr>
                    <td className="py-1.5 px-3 font-mono text-slate-500 text-[11px]">006</td>
                    <td className="py-1.5 px-3">Horas Extras Nocturnas ({item.horasExtrasNocturnas} hrs recargo 50%+30% nocturno)</td>
                    <td className="py-1.5 px-3 text-right font-medium">{formatBs(item.montoHorasExtrasNocturnas)}</td>
                    <td className="py-1.5 px-3 text-right text-slate-400">-</td>
                  </tr>
                )}

                {/* Cestaticket Socialista */}
                <tr>
                  <td className="py-1.5 px-3 font-mono text-slate-500 text-[11px]">050</td>
                  <td className="py-1.5 px-3 font-medium text-sky-900">
                    Cestaticket Socialista de Alimentación (Decreto Oficial - No Salarial)
                  </td>
                  <td className="py-1.5 px-3 text-right font-bold text-sky-700">{formatBs(item.cestaticketPeriodo)}</td>
                  <td className="py-1.5 px-3 text-right text-slate-400">-</td>
                </tr>

                {/* Deducción IVSS 4% */}
                <tr>
                  <td className="py-1.5 px-3 font-mono text-slate-500 text-[11px]">101</td>
                  <td className="py-1.5 px-3 text-slate-700">Retención Seguro Social Obligatorio (IVSS 4% s/tope)</td>
                  <td className="py-1.5 px-3 text-right text-slate-400">-</td>
                  <td className="py-1.5 px-3 text-right text-amber-800 font-medium">{formatBs(item.retencionIVSS)}</td>
                </tr>

                {/* Deducción Paro Forzoso 0.5% */}
                <tr>
                  <td className="py-1.5 px-3 font-mono text-slate-500 text-[11px]">102</td>
                  <td className="py-1.5 px-3 text-slate-700">Retención Régimen Prestacional de Empleo (RPE / Paro 0.5%)</td>
                  <td className="py-1.5 px-3 text-right text-slate-400">-</td>
                  <td className="py-1.5 px-3 text-right text-amber-800 font-medium">{formatBs(item.retencionParoForzoso)}</td>
                </tr>

                {/* Deducción FAOV 1% */}
                <tr>
                  <td className="py-1.5 px-3 font-mono text-slate-500 text-[11px]">103</td>
                  <td className="py-1.5 px-3 text-slate-700">Retención Ahorro Habitacional BANAVIH (FAOV 1%)</td>
                  <td className="py-1.5 px-3 text-right text-slate-400">-</td>
                  <td className="py-1.5 px-3 text-right text-amber-800 font-medium">{formatBs(item.retencionFAOV)}</td>
                </tr>

                {/* Deducción ISLR si aplica */}
                {item.retencionISLR > 0 && (
                  <tr>
                    <td className="py-1.5 px-3 font-mono text-slate-500 text-[11px]">104</td>
                    <td className="py-1.5 px-3 text-slate-700">Retención Impuesto Sobre la Renta (ISLR Forma AR-I)</td>
                    <td className="py-1.5 px-3 text-right text-slate-400">-</td>
                    <td className="py-1.5 px-3 text-right text-amber-800 font-medium">{formatBs(item.retencionISLR)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Subtotals and Net Payable */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>Total Asignaciones Devengadas:</span>
                <strong className="text-slate-900">
                  {formatBs(item.totalAsignaciones)}
                  <span className="ml-1 text-[10px] align-middle font-bold text-slate-500">({slipCurrencyLabel})</span>
                </strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total Retenciones Legales:</span>
                <strong className="text-amber-800">
                  -{formatBs(item.totalDeducciones)}
                  <span className="ml-1 text-[10px] align-middle font-bold text-amber-600">({slipCurrencyLabel})</span>
                </strong>
              </div>
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl border-2 border-emerald-500/40 text-xs flex flex-col justify-center">
              <span className="text-emerald-900 font-bold uppercase text-[11px] tracking-wider">
                NETO A COBRAR
              </span>
              <div className="text-2xl font-black text-emerald-900 mt-0.5">
                {formatBs(item.netoCobrarBs)}
                <span className="ml-2 text-[10px] align-middle font-bold text-emerald-700">({slipCurrencyLabel})</span>
              </div>
              <span className="text-[11px] text-emerald-700 font-semibold">
                Equivalente Ref. BCV: {formatUSD(item.netoCobrarUSD)}
                <span className="ml-1 text-[10px] align-middle font-bold text-emerald-700">({slipReferenceCurrencyLabel})</span>
                <span className="ml-1">(Tasa: Bs. {company.tasaBCV_USD.toFixed(2)})</span>
              </span>
            </div>
          </div>

          {/* Informative Employer Contributions (Seguridad Social) */}
          <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 text-[10px] space-y-1">
            <span className="font-bold uppercase tracking-wider text-slate-600 block">
              Aportes Patronales de Seguridad Social (Informativo - No deducible del trabajador)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-600">
              <div>IVSS Patrono ({company.nivelRiesgoIVSS}%): <strong>{formatBs(item.aportePatronalIVSS)}</strong></div>
              <div>RPE Patrono (2%): <strong>{formatBs(item.aportePatronalRPE)}</strong></div>
              <div>FAOV Patrono (2%): <strong>{formatBs(item.aportePatronalFAOV)}</strong></div>
              <div>INCES Patrono (2%): <strong>{formatBs(item.aportePatronalINCES)}</strong></div>
            </div>
          </div>

          {/* Legal Signatures and Audit Seals */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-slate-200">
            {/* Employer Signature */}
            <div className="text-center space-y-1">
              <div className="h-10 flex items-center justify-center">
                <span className="font-serif italic text-slate-700 text-sm font-bold">
                  {company.representanteLegal}
                </span>
              </div>
              <div className="border-t border-slate-400 pt-1 text-[10px] text-slate-600">
                <strong>{company.representanteLegal}</strong>
                <p>{company.cargoRepresentante}</p>
                <p>Por la Entidad de Trabajo • Sello Húmedo Digital</p>
              </div>
            </div>

            {/* Employee Digital Signature */}
            <div className="text-center space-y-1">
              <div className="h-10 flex items-center justify-center">
                {isSigned ? (
                  <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-xs bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Firmado Digitalmente ({signatureDate})
                  </div>
                ) : (
                  <button
                    onClick={handleSign}
                    className="no-print text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded shadow-sm"
                  >
                    Estampar Firma Digital
                  </button>
                )}
              </div>
              <div className="border-t border-slate-400 pt-1 text-[10px] text-slate-600">
                <strong>{item.employee.primerNombre} {item.employee.primerApellido}</strong>
                <p>C.I. {item.employee.cedula}</p>
                <p>Conforme con los montos devengados y retenidos de ley</p>
              </div>
            </div>
          </div>

          {/* Cryptographic Security Hash */}
          <div className="pt-2 text-[9px] text-slate-400 text-center font-mono border-t border-slate-100">
            Seguridad Criptográfica: {item.hashCriptografico} • Sistema TalentoVE Cloud • Cumplimiento LOTTT
          </div>
        </div>
      </div>
    </div>
  );
}
