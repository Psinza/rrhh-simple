import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  HardDriveDownload,
  HardDriveUpload,
  Lock,
  Key,
  Database,
  History,
  CheckCircle2,
  AlertCircle,
  FileCode2,
} from 'lucide-react';
import {
  AuditLog,
  CompanySettings,
} from '../types';
import { DatabaseState } from '../services/lightweightDb';
import { downloadFile } from '../utils/venezuelaLaborCalculations';

interface SecurityAndCloudModalProps {
  auditLogs: AuditLog[];
  company: CompanySettings;
  backupState: DatabaseState;
  onClose: () => void;
  onRestoreBackup: (importedData: Partial<DatabaseState>) => void;
  lastBackupTime: string;
  setLastBackupTime: (time: string) => void;
}

export function SecurityAndCloudModal({
  auditLogs,
  company,
  backupState,
  onClose,
  onRestoreBackup,
  lastBackupTime,
  setLastBackupTime,
}: SecurityAndCloudModalProps) {
  const [activeTab, setActiveTab] = useState<'security' | 'backups' | 'audit'>('security');
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const [notice, setNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showNotice = (text: string, type: 'success' | 'error' = 'success') => {
    setNotice({ text, type });
    setTimeout(() => setNotice(null), 4000);
  };

  const handleExportBackup = () => {
    const backupData = {
      ...backupState,
      backupMetadata: {
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        encrypted: false,
      },
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    downloadFile(jsonStr, `TALENTO_VE_BACKUP_${company.rif}_${new Date().toISOString().split('T')[0]}.json`, 'application/json');

    const nowStr = new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
    setLastBackupTime(nowStr);
    showNotice('Respaldo JSON completo descargado. Este archivo no está cifrado; guárdalo en un lugar protegido.');
  };

  const handleFileRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as Partial<DatabaseState> & { payroll?: unknown };
        if (parsed.company && Array.isArray(parsed.employees)) {
          const payrolls = parsed.payrolls
            || (parsed.payroll && typeof parsed.payroll === 'object' ? [parsed.payroll as DatabaseState['payrolls'][number]] : undefined);
          onRestoreBackup({ ...parsed, payrolls });
          setRestoreSuccess(true);
          showNotice('Datos restaurados con éxito desde el archivo de respaldo.');
          setTimeout(() => setRestoreSuccess(false), 3000);
        } else {
          showNotice('El archivo no tiene el formato válido de respaldo de TalentoVE.', 'error');
        }
      } catch (err) {
        showNotice('Error al leer el archivo de respaldo JSON.', 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-3xl w-full p-6 shadow-xl border border-slate-200 my-8 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-blue-100 text-blue-800 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Seguridad local y auditoría
              </h2>
              <p className="text-xs text-slate-500">
                Herramientas locales de respaldo y consulta de eventos. Esta fase no proporciona cifrado de datos ni respaldo automático.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {notice && (
          <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
            notice.type === 'error' ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          }`}>
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{notice.text}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-b border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-xl transition-all ${
              activeTab === 'security'
                ? 'bg-emerald-50 text-emerald-800 border-b-2 border-emerald-600 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Lock className="w-4 h-4 text-emerald-600" />
            Estado de seguridad
          </button>
          <button
            onClick={() => setActiveTab('backups')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-xl transition-all ${
              activeTab === 'backups'
                ? 'bg-emerald-50 text-emerald-800 border-b-2 border-emerald-600 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Database className="w-4 h-4 text-emerald-600" />
            Respaldos locales
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-xl transition-all ${
              activeTab === 'audit'
                ? 'bg-emerald-50 text-emerald-800 border-b-2 border-emerald-600 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4 text-emerald-600" />
            Registro de Auditoría (Logs)
          </button>
        </div>

        {/* Tab 1: Estado de seguridad */}
        {activeTab === 'security' && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-emerald-950 text-sm">
                  Cifrado de datos locales no disponible
                </h3>
                <p className="text-emerald-800 mt-1 leading-relaxed">
                  Los datos se guardan en el almacenamiento local del navegador y esta aplicación no los cifra. Protege el acceso al equipo y a la cuenta del sistema operativo.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-sky-600" /> Estado de cifrado
                </span>
                <p className="text-slate-600 text-[11px]">No se aplica cifrado en reposo ni a los archivos de respaldo JSON.</p>
                <p className="text-[10px] text-amber-700 font-semibold">El archivo de respaldo contiene datos legibles.</p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> Protección de Datos Personales
                </span>
                <p className="text-slate-600 text-[11px]">
                  Esta pantalla no constituye una certificación de cumplimiento legal o de seguridad.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Respaldos locales */}
        {activeTab === 'backups' && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
              <h3 className="font-bold text-blue-950 text-sm">
                Recuperación ante Desastres y Copias de Seguridad
              </h3>
              <p className="text-blue-800 mt-1">
                Exporte o restaure los datos disponibles en este navegador. No hay almacenamiento en la nube ni respaldo automático en esta fase.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Exportar Backup */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3 flex flex-col justify-between shadow-xs">
                <div>
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                    <HardDriveDownload className="w-4 h-4 text-blue-600" /> Exportar Copia de Seguridad
                  </h4>
                  <p className="text-slate-500 mt-1 text-[11px]">
                    Descarga un archivo JSON con los datos locales disponibles, incluida la contabilidad. El archivo no está cifrado.
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Último respaldo: {lastBackupTime}
                  </p>
                </div>
                <button
                  onClick={handleExportBackup}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow-sm transition-all text-xs"
                >
                  Descargar respaldo JSON
                </button>
              </div>

              {/* Restaurar Backup */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3 flex flex-col justify-between shadow-xs">
                <div>
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                    <HardDriveUpload className="w-4 h-4 text-emerald-600" /> Restaurar Base de Datos
                  </h4>
                  <p className="text-slate-500 mt-1 text-[11px]">
                    Cargue un archivo de respaldo JSON previamente generado para restaurar datos en tiempo real.
                  </p>
                  {restoreSuccess && (
                    <p className="text-[11px] text-emerald-700 font-bold mt-1">
                      ¡Datos restaurados con éxito!
                    </p>
                  )}
                </div>
                <label className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded shadow-sm transition-all text-center cursor-pointer block text-xs">
                  Seleccionar Archivo JSON
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileRestore}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Registro de Auditoría */}
        {activeTab === 'audit' && (
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between text-slate-500 text-[11px]">
              <span>Trazabilidad completa de accesos y modificaciones (Ley de Delitos Informáticos):</span>
              <span className="font-mono">{auditLogs.length} eventos registrados</span>
            </div>

            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto border border-slate-200 rounded-xl bg-slate-50/50">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-3 hover:bg-white transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{log.accion}</span>
                      <span className="bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded text-[10px]">
                        {log.modulo}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{log.timestamp}</span>
                  </div>
                  <p className="text-slate-600 mt-1 text-[11px]">{log.detalles}</p>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                    <span>Usuario: <strong className="text-slate-600">{log.usuario}</strong> ({log.rol})</span>
                    <span>IP: {log.ip || 'No disponible'} • Cifrado: {log.cifrado ? 'Sí' : 'No'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
