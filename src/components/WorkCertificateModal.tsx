import { useState } from 'react';
import {
  X,
  Printer,
  FileText,
} from 'lucide-react';
import { Employee, CompanySettings } from '../types';
import { predefinedUsers } from '../data/authUsers';
import {
  calculateTenure,
  calculateIntegralSalary,
  formatUSD,
  formatMoneyWithEmployeeCurrency,
} from '../utils/venezuelaLaborCalculations';

interface WorkCertificateModalProps {
  employee: Employee;
  company: CompanySettings;
  onClose: () => void;
}

export function WorkCertificateModal({
  employee,
  company,
  onClose,
}: WorkCertificateModalProps) {
  const [destinatario, setDestinatario] = useState('A QUIEN PUEDA INTERESAR');
  const [incluirCestaticket, setIncluirCestaticket] = useState(employee.cestaticketAplica !== false);
  const [tipoSalario, setTipoSalario] = useState<'basico' | 'integral'>('basico');
  const [firmaId, setFirmaId] = useState('user-dueno-elias');
  const [ciudadEmision] = useState(company.ciudad || 'Caracas');
  const authorities = predefinedUsers.filter((user) => ['user-dueno-elias', 'user-dueno', 'user-rrhh'].includes(user.id));
  const signer = authorities.find((user) => user.id === firmaId) || authorities[0];

  const tenure = calculateTenure(employee.fechaIngreso);
  const integral = calculateIntegralSalary(
    employee.salarioMensualBase,
    tenure.anios,
    employee.diasUtilidadesAnuales || company.diasUtilidadesEmpresa
  );
  const displayCurrency = employee.salarioMoneda || 'BS';

  const salarioAMostrar = tipoSalario === 'basico' ? employee.salarioMensualBase : integral.salarioIntegralMensual;
  const cestaticketMonto = employee.cestaticketMensual || company.montoCestaticketNacional;
  const salarioAMostrarDisplay = formatMoneyWithEmployeeCurrency(salarioAMostrar, displayCurrency, company.tasaBCV_USD);
  const cestaticketDisplay = formatMoneyWithEmployeeCurrency(cestaticketMonto, employee.cestaticketMoneda || displayCurrency, company.tasaBCV_USD);

  const fechaHoy = new Date();
  const opcionesFecha: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[calc(100vh-1rem)] overflow-y-auto p-3 sm:p-5 shadow-xl border border-slate-200 my-2 space-y-4 print-card">
        {/* Top Control Bar (Hidden on print) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-1 rounded bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              Constancia de Trabajo Oficial (Venezuela)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded shadow-sm transition-all"
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

        {/* Options Panel (Hidden on print) */}
        <div className="no-print p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Destinatario:</label>
            <select
              value={destinatario}
              onChange={(e) => setDestinatario(e.target.value)}
              className="w-full p-2 bg-white border border-slate-200 rounded text-slate-800"
            >
              <option value="A QUIEN PUEDA INTERESAR">A QUIEN PUEDA INTERESAR</option>
              <option value="SEÑORES ENTIDAD BANCARIA">SEÑORES ENTIDAD BANCARIA</option>
              <option value="SEÑORES CONSULADO / EMBAJADA">SEÑORES CONSULADO / EMBAJADA</option>
              <option value="SEÑORES INSTITUCIÓN EDUCATIVA">SEÑORES INSTITUCIÓN EDUCATIVA</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Tipo de Salario a Declarar:</label>
            <select
              value={tipoSalario}
              onChange={(e) => setTipoSalario(e.target.value as 'basico' | 'integral')}
              className="w-full p-2 bg-white border border-slate-200 rounded text-slate-800"
            >
              <option value="basico">Salario Mensual Básico</option>
              <option value="integral">Salario Integral (Art. 122 LOTTT)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 pt-5">
            <input
              type="checkbox"
              id="chkCestaticket"
              checked={incluirCestaticket}
              onChange={(e) => setIncluirCestaticket(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
            />
            <label htmlFor="chkCestaticket" className="text-slate-700 font-medium cursor-pointer">
              Incluir Cestaticket Socialista
            </label>
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Firmante:</label>
            <select value={firmaId} onChange={(e) => setFirmaId(e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded text-slate-800">
              {authorities.map((authority) => <option key={authority.id} value={authority.id}>{authority.nombre} - {authority.cargo}</option>)}
            </select>
          </div>
        </div>

        {/* --- OFFICIAL CERTIFICATE PRINTABLE AREA --- */}
        <div className="print-document p-4 sm:p-6 border border-slate-200 rounded-xl bg-white space-y-5 font-serif text-slate-900 leading-relaxed text-xs shadow-xs">
          {/* Official Letterhead */}
          <div className="text-center border-b-2 border-slate-900 pb-6 space-y-2">
            {company.logoUrl && (
              <div className="flex justify-center mb-2">
                <img
                  src={company.logoUrl}
                  alt="Logo Empresa"
                  className="h-14 w-auto max-w-[160px] object-contain"
                />
              </div>
            )}
            <h1 className="text-lg font-bold tracking-wider uppercase font-sans text-slate-900">
              {company.razonSocial}
            </h1>
            <p className="text-xs text-slate-600 font-sans">
              R.I.F.: <strong>{company.rif}</strong> • N.I.L.: {company.numeroPatronalIVSS} • Código FAOV: {company.codigoAportanteFAOV}
            </p>
            <p className="text-xs text-slate-500 font-sans">
              {company.direccionFiscal}, {company.ciudad}, Estado {company.estado} • Teléfono: {company.telefono}
            </p>
          </div>

          {/* Certificate Title */}
          <div className="text-center space-y-3 pt-2">
            <h2 className="text-xl font-bold uppercase tracking-widest font-sans underline decoration-2 underline-offset-4">
              CONSTANCIA DE TRABAJO
            </h2>
            <p className="text-xs font-sans font-bold uppercase tracking-wider text-slate-700">
              {destinatario}
            </p>
          </div>

          {/* Formal Body Text */}
          <div className="text-justify space-y-4 text-slate-800 leading-loose text-base">
            <p>
              Por medio de la presente se hace constar que el (la) ciudadano(a){' '}
              <strong>
                {employee.primerNombre} {employee.segundoNombre || ''} {employee.primerApellido}{' '}
                {employee.segundoApellido || ''}
              </strong>
              , titular de la Cédula de Identidad N° <strong>{employee.cedula}</strong> y Registro de Información Fiscal
              (R.I.F.) N° <strong>{employee.rif}</strong>, presta sus servicios profesionales para esta entidad de trabajo
              desde el <strong>{new Date(employee.fechaIngreso).toLocaleDateString('es-VE', opcionesFecha)}</strong>,
              desempeñando a la fecha el cargo de <strong>{employee.cargo}</strong> adscrito al departamento de{' '}
              <strong>{employee.departamento}</strong>.
            </p>

            <p>
              Asimismo, se certifica que devenga una remuneración mensual {tipoSalario === 'integral' ? 'integral' : 'básica'} de{' '}
              <strong>{salarioAMostrarDisplay}</strong>
              {company.tasaBCV_USD > 0 && displayCurrency === 'USD' && (
                <span> (equivalente referencial a <strong>{formatUSD(salarioAMostrar / company.tasaBCV_USD)}</strong> según la tasa oficial del Banco Central de Venezuela)</span>
              )}
              {incluirCestaticket && employee.cestaticketAplica !== false && (
                <span>
                  , más el beneficio legal de alimentación (Cestaticket Socialista de los Trabajadores y las Trabajadoras)
                  por un monto mensual indexado de <strong>{cestaticketDisplay}</strong> conforme a la legislación laboral vigente
                </span>
              )}
              .
            </p>

            <p>
              Constancia que se expide a petición de la parte interesada, en la ciudad de {ciudadEmision}, a los{' '}
              {fechaHoy.getDate()} días del mes de {fechaHoy.toLocaleDateString('es-VE', { month: 'long' })} del año{' '}
              {fechaHoy.getFullYear()}.
            </p>
          </div>

          <div className="pt-8 pb-3 flex justify-center text-center font-sans">
            <div className="space-y-2 w-64">
              <div className="h-12 border-b border-slate-400"></div>
              <p className="text-xs font-bold">{signer.nombre}</p>
              <p className="text-[11px] text-slate-600">{signer.cargo}</p>
              <p className="text-[10px] text-slate-500 font-semibold">C.I. {signer.cedula || 'No registrada'} • {signer.telefono || ''}</p>
              <p className="text-[10px] text-slate-500 font-semibold">{signer.email}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
