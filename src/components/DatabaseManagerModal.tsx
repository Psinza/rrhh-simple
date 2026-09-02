import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  X,
  Download,
  Upload,
  RefreshCw,
  FileCode,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Cloud,
  Check,
  Server,
  FileJson,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  Phone,
  Mail,
} from 'lucide-react';
import { lightweightDb, DbSyncStatus, DatabaseState } from '../services/lightweightDb';
import { CompanySettings, Employee, AppUser } from '../types';

interface DatabaseManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: CompanySettings;
  employees: Employee[];
  users: AppUser[];
  onDataRestored: (state: DatabaseState) => void;
}

export function DatabaseManagerModal({
  isOpen,
  onClose,
  company,
  employees,
  users,
  onDataRestored,
}: DatabaseManagerModalProps) {
  const [syncStatus, setSyncStatus] = useState<DbSyncStatus>(lightweightDb.getStatus());
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = lightweightDb.subscribeStatus((status, msg) => {
      setSyncStatus(status);
      if (msg) setStatusMsg(msg);
    });
    return unsub;
  }, []);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const success = await lightweightDb.testAndSyncCloud();
      if (success) {
        showToast('¡Base de datos sincronizada con Firestore con éxito!');
      } else {
        showToast('Operando en modo de base de datos ligera local (IndexedDB).');
      }
    } catch (e) {
      showToast('Operando con almacenamiento local seguro.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportJson = () => {
    lightweightDb.exportToJson();
    showToast('¡Copia de seguridad JSON descargada correctamente!');
  };

  const handleExportSql = () => {
    lightweightDb.exportSqlFile();
    showToast('¡Script SQL descargado correctamente!');
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const restored = await lightweightDb.importFromJson(text);
        onDataRestored(restored);
        showToast('¡Base de datos restaurada exitosamente!');
      } catch (err: any) {
        alert('Error al restaurar base de datos: ' + (err.message || 'Formato inválido'));
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCopySqlToClipboard = () => {
    const sql = lightweightDb.generateSqlDump();
    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
    showToast('¡Código SQL copiado al portapapeles!');
  };

  const adminUser = users.find((u) => u.rol === 'admin_sistema') || users[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base leading-tight">Base de Datos Ligera & Nube</h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                  Dual-Engine (Local + Firestore)
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Almacenamiento persistente, exportación JSON/SQL y sincronización en vivo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-700 text-xs">
          {/* Notification Toast */}
          {notification && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center gap-2 font-medium animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{notification}</span>
            </div>
          )}

          {/* Engine Status Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-blue-600" />
                <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  Estado del Motor de Datos
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                  syncStatus === 'synced' || syncStatus === 'cloud_connected'
                    ? 'bg-emerald-100 text-emerald-800'
                    : syncStatus === 'syncing'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                {syncStatus === 'synced'
                  ? 'Sincronizado con Firestore'
                  : syncStatus === 'cloud_connected'
                  ? 'Conectado a Firestore'
                  : syncStatus === 'syncing'
                  ? 'Sincronizando...'
                  : 'Base de Datos Local Activa'}
              </span>
            </div>

            <p className="text-slate-600 leading-relaxed">
              El sistema utiliza un <strong>motor híbrido ultra-ligero</strong>: almacena al instante en
              tu navegador con persistencia garantizada en Render y local, y sincroniza transparentemente
              con <strong>Google Firestore</strong> (BD: <code>ai-studio-talentoverecurso</code>) sin
              requerir servidores pesados.
            </p>

            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-400 block uppercase font-medium">Expedientes</span>
                <strong className="text-sm text-slate-900 font-black">{employees.length}</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-400 block uppercase font-medium">Empresa</span>
                <strong className="text-sm text-slate-900 font-black truncate block">{company.rif}</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-400 block uppercase font-medium">Directivos</span>
                <strong className="text-sm text-slate-900 font-black">{users.length}</strong>
              </div>
            </div>

            <div className="pt-1 flex items-center justify-between">
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Sincronizando...' : 'Probar Conexión & Sincronizar'}</span>
              </button>
              <span className="text-[11px] text-slate-500 font-mono">
                BD ID: talentove-74e26b
              </span>
            </div>
          </div>

          {/* Database Backup & Restore Operations */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5 text-slate-600" />
              Respaldos, Exportación e Importación
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Export JSON */}
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2 hover:border-slate-300 transition-colors shadow-2xs">
                <div className="flex items-center gap-2">
                  <FileJson className="w-4 h-4 text-emerald-600" />
                  <strong className="text-slate-900 text-xs">Copia de Seguridad (.JSON)</strong>
                </div>
                <p className="text-slate-500 text-[11px]">
                  Descarga un archivo JSON completo con empleados, nóminas, configuración y directivos.
                </p>
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar JSON Completo</span>
                </button>
              </div>

              {/* Import JSON */}
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2 hover:border-slate-300 transition-colors shadow-2xs">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-blue-600" />
                  <strong className="text-slate-900 text-xs">Restaurar Copia (.JSON)</strong>
                </div>
                <p className="text-slate-500 text-[11px]">
                  Sube un respaldo JSON previo para restaurar todos los registros de la empresa.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportJsonFile}
                  className="hidden"
                  id="db-restore-file"
                />
                <label
                  htmlFor="db-restore-file"
                  className="cursor-pointer w-full py-1.5 px-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors text-center"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Cargar Archivo JSON</span>
                </label>
              </div>
            </div>

            {/* SQL Export */}
            <div className="p-3.5 bg-slate-900 text-slate-100 rounded-xl space-y-2 border border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-amber-400" />
                  <strong className="text-white text-xs">Script de Base de Datos SQL (.SQL)</strong>
                </div>
                <span className="text-[10px] text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 font-mono">
                  SQLite / Postgres / MySQL
                </span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Genera sentencias DDL y DML estándar (<code>CREATE TABLE</code> e <code>INSERT INTO</code>)
                para importar tu base de datos en servidores relacionales o Cloud SQL.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleExportSql}
                  className="flex-1 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 text-xs transition-colors border border-slate-700"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Archivo .SQL</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopySqlToClipboard}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold rounded-lg flex items-center gap-1.5 text-xs transition-colors border border-slate-700"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FileCode className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? '¡Copiado!' : 'Copiar SQL'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Deployment & Admin Info */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                Enlaces de Despliegue Oficial
              </span>
              <span className="text-slate-500 font-mono">Render & GitHub</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200">
                <span className="text-slate-600 font-medium">Repositorio GitHub:</span>
                <a
                  href="https://github.com/Psinza/rrhh-simple"
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                >
                  <span>github.com/Psinza/rrhh-simple</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200">
                <span className="text-slate-600 font-medium">Producción en Render:</span>
                <a
                  href="https://rrhh-simple.onrender.com"
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-emerald-600 hover:underline flex items-center gap-1 font-semibold"
                >
                  <span>https://rrhh-simple.onrender.com</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-slate-600">
              <div className="flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>
                  Admin TI: <strong>{adminUser.nombre}</strong>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 font-mono text-[10px]">
                  <Mail className="w-3 h-3 text-slate-400" />
                  {adminUser.email}
                </span>
                {adminUser.telefono && (
                  <span className="flex items-center gap-1 font-mono text-[10px]">
                    <Phone className="w-3 h-3 text-emerald-600" />
                    {adminUser.telefono}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors"
          >
            Cerrar Gestor de Base de Datos
          </button>
        </div>
      </div>
    </div>
  );
}
