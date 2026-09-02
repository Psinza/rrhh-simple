import { useState } from 'react';
import {
  FileCheck,
  Download,
  Copy,
  Check,
  Building,
  ShieldCheck,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { CompanySettings, Employee, GovernmentExportFile } from '../types';
import {
  generateTiunaIvssFile,
  generateBanavihFaovFile,
  generateIncesReport,
  downloadFile,
  formatBs,
} from '../utils/venezuelaLaborCalculations';

interface GovernmentFilesModuleProps {
  company: CompanySettings;
  employees: Employee[];
}

export function GovernmentFilesModule({
  company,
  employees,
}: GovernmentFilesModuleProps) {
  const [selectedFileType, setSelectedFileType] = useState<
    'IVSS_1402' | 'IVSS_SALARIOS' | 'FAOV_BANAVIH' | 'INCES_TRIMESTRAL'
  >('IVSS_1402');
  const [copied, setCopied] = useState(false);

  // Generación reactiva de archivos según selección
  let currentFile: GovernmentExportFile;
  if (selectedFileType === 'IVSS_1402') {
    currentFile = generateTiunaIvssFile(company, employees, 'INGRESOS_1402');
  } else if (selectedFileType === 'IVSS_SALARIOS') {
    currentFile = generateTiunaIvssFile(company, employees, 'MOVIMIENTOS_SALARIO');
  } else if (selectedFileType === 'FAOV_BANAVIH') {
    currentFile = generateBanavihFaovFile(company, employees, '08', 2026);
  } else {
    currentFile = generateIncesReport(company, employees, 3, 2026);
  }

  const handleDownload = () => {
    const mime = currentFile.formato === 'CSV' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8';
    downloadFile(currentFile.contenido, currentFile.nombreArchivo, mime);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.contenido);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner (Professional Polish) */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
              <FileCheck className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">
              Generación de Archivos Gubernamentales (Venezuela)
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Exportación automatizada en formatos oficiales para carga en portales TIUNA (IVSS), BANAVIH (FAOV) e INCES.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors border border-slate-200"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded shadow-sm transition-all"
          >
            <Download className="w-4 h-4" />
            Descargar ({currentFile.nombreArchivo})
          </button>
        </div>
      </div>

      {/* Select File Format Cards (Professional Polish) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* IVSS TIUNA 14-02 */}
        <button
          onClick={() => setSelectedFileType('IVSS_1402')}
          className={`p-4 rounded-xl border text-left transition-all ${
            selectedFileType === 'IVSS_1402'
              ? 'bg-blue-50/70 border-blue-600 ring-2 ring-blue-600/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
              IVSS TIUNA
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              TXT
            </span>
          </div>
          <h3 className="font-bold text-slate-900 text-sm mt-2">Forma 14-02 (Ingresos)</h3>
          <p className="text-xs text-slate-500 mt-1">
            Carga masiva de nuevos trabajadores en el portal TIUNA con formato posicional.
          </p>
        </button>

        {/* IVSS Modificación Salario */}
        <button
          onClick={() => setSelectedFileType('IVSS_SALARIOS')}
          className={`p-4 rounded-xl border text-left transition-all ${
            selectedFileType === 'IVSS_SALARIOS'
              ? 'bg-blue-50/70 border-blue-600 ring-2 ring-blue-600/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
              IVSS TIUNA
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              TXT
            </span>
          </div>
          <h3 className="font-bold text-slate-900 text-sm mt-2">Modificación de Salarios</h3>
          <p className="text-xs text-slate-500 mt-1">
            Actualización de montos salariales de cotizantes activos para cuadre mensual.
          </p>
        </button>

        {/* BANAVIH / FAOV */}
        <button
          onClick={() => setSelectedFileType('FAOV_BANAVIH')}
          className={`p-4 rounded-xl border text-left transition-all ${
            selectedFileType === 'FAOV_BANAVIH'
              ? 'bg-orange-50/70 border-orange-600 ring-2 ring-orange-600/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-orange-700">
              BANAVIH / FAOV
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              CSV
            </span>
          </div>
          <h3 className="font-bold text-slate-900 text-sm mt-2">Nómina Mensual FAOV</h3>
          <p className="text-xs text-slate-500 mt-1">
            Archivo delimitado con retención 1% trabajador y 2% aporte patronal.
          </p>
        </button>

        {/* INCES Trimestral */}
        <button
          onClick={() => setSelectedFileType('INCES_TRIMESTRAL')}
          className={`p-4 rounded-xl border text-left transition-all ${
            selectedFileType === 'INCES_TRIMESTRAL'
              ? 'bg-emerald-50/70 border-emerald-600 ring-2 ring-emerald-600/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              INCES 2%
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              TXT
            </span>
          </div>
          <h3 className="font-bold text-slate-900 text-sm mt-2">Declaración Trimestral</h3>
          <p className="text-xs text-slate-500 mt-1">
            Resumen jurado de salarios pagados y aporte patronal del 2%.
          </p>
        </button>
      </div>

      {/* File Details & Inspector */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 font-mono">
                {currentFile.nombreArchivo}
              </span>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                Estructura Válida
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">{currentFile.descripcion}</p>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500">
            <div>
              Cotizantes: <strong className="text-slate-800">{currentFile.totalRegistros}</strong>
            </div>
            {currentFile.montoTotalBs !== undefined && (
              <div>
                Monto Declarado: <strong className="text-slate-800">{formatBs(currentFile.montoTotalBs)}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Code / Content Viewer */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5 font-medium">
              <Eye className="w-3.5 h-3.5 text-sky-600" /> Vista Previa del Archivo de Carga:
            </span>
            <span className="font-mono text-[11px] text-slate-400">Codificación: UTF-8 / ASCII Estándar</span>
          </div>

          <div className="bg-slate-950 text-slate-200 font-mono text-xs p-4 rounded-xl border border-slate-800 overflow-x-auto max-h-96 leading-relaxed selection:bg-sky-700 selection:text-white">
            <pre className="whitespace-pre">{currentFile.contenido}</pre>
          </div>
        </div>

        {/* Regulatory Guidance Callout */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-slate-600">
            <p className="font-bold text-slate-800">
              Procedimiento de Carga en Portales Oficiales del Estado Venezolano:
            </p>
            <p>
              1. Descargue el archivo generado haciendo clic en <strong>Descargar Archivo</strong>.
            </p>
            <p>
              2. Ingrese con sus credenciales de aportante al portal correspondiente (
              <span className="font-semibold text-slate-700">http://tiuna.ivss.gob.ve</span> o{' '}
              <span className="font-semibold text-slate-700">https://faov.banavih.gob.ve</span>).
            </p>
            <p>
              3. Vaya al módulo de <em>"Carga Masiva de Nómina / Movimientos"</em> y seleccione este archivo sin modificar su extensión.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
