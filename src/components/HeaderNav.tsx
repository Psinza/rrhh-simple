import { useState } from 'react';
import {
  Building2,
  ShieldCheck,
  Bell,
  Settings,
  HardDriveDownload,
  Users,
  FileSpreadsheet,
  Coins,
  FileCheck,
  FileText,
  LayoutDashboard,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { CompanySettings, LegalNotification } from '../types';

interface HeaderNavProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  company: CompanySettings;
  notifications: LegalNotification[];
  onOpenNotifications: () => void;
  onOpenSecurity: () => void;
  onOpenSettings: () => void;
  userRole: string;
  setUserRole: (role: string) => void;
  lastBackupTime: string;
}

export function HeaderNav({
  currentTab,
  setCurrentTab,
  company,
  notifications,
  onOpenNotifications,
  onOpenSecurity,
  onOpenSettings,
  userRole,
  setUserRole,
  lastBackupTime,
}: HeaderNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.leida).length;

  const navItems = [
    { id: 'dashboard', label: 'Panel General', icon: LayoutDashboard },
    { id: 'employees', label: 'Expedientes & Personal', icon: Users },
    { id: 'payroll', label: 'Nómina & Recibos', icon: FileSpreadsheet },
    { id: 'social_benefits', label: 'Prestaciones LOTTT', icon: Coins },
    { id: 'government_files', label: 'Archivos IVSS / FAOV', icon: FileCheck },
    { id: 'certificates', label: 'Constancias de Trabajo', icon: FileText },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-md">
      {/* Top Banner with Venezuelan Legal Indicators & Security */}
      <div className="bg-slate-950 px-4 py-1.5 border-b border-slate-800/80 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-slate-300">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Nube Segura • Cifrado E2E Activo
            </span>
            <span className="hidden sm:inline text-slate-600">|</span>
            <span className="hidden sm:inline text-slate-400">
              Marco Legal: <strong className="text-slate-200">LOTTT • IVSS • BANAVIH/FAOV • INCES</strong>
            </span>
            <span className="hidden md:inline text-slate-600">|</span>
            <span className="text-amber-300 font-semibold flex items-center gap-1">
              Tasa BCV Oficial: Bs. {company.tasaBCV_USD.toFixed(2)} / USD
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden lg:flex items-center gap-1 text-slate-400">
              <HardDriveDownload className="w-3.5 h-3.5 text-sky-400" />
              Último Backup Cloud: {lastBackupTime}
            </span>
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
              <Lock className="w-3 h-3 text-emerald-400" />
              <span className="text-slate-300">Rol:</span>
              <select
                aria-label="Seleccionar rol de usuario"
                value={userRole}
                onChange={(e) => setUserRole(e.target.value)}
                className="bg-transparent text-emerald-400 font-semibold text-xs border-none outline-none cursor-pointer"
              >
                <option value="Administrador RRHH" className="bg-slate-900 text-white">
                  Administrador RRHH
                </option>
                <option value="Especialista de Nómina" className="bg-slate-900 text-white">
                  Especialista de Nómina
                </option>
                <option value="Auditor Legal" className="bg-slate-900 text-white">
                  Auditor Legal
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Company Identification */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-blue-500 flex items-center justify-center shadow-lg shadow-sky-500/20 ring-1 ring-white/20">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-white">TalentoVE</span>
                <span className="bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                  RRHH VE
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-[200px] sm:max-w-xs md:max-w-sm">
                {company.razonSocial} <span className="text-slate-500">({company.rif})</span>
              </p>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right Action Icons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenNotifications}
              title="Notificaciones y Alertas Normativas"
              className="relative p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={onOpenSecurity}
              title="Ciberseguridad, Cifrado y Respaldos Cloud"
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            >
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span className="hidden sm:inline text-xs text-slate-300">Seguridad</span>
            </button>

            <button
              onClick={onOpenSettings}
              title="Configuración de la Empresa y Parámetros Fiscales"
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <Settings className="w-5 h-5 text-slate-300" />
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
              aria-label="Abrir menú"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-800 bg-slate-900 px-4 pt-2 pb-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive ? 'bg-sky-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>RIF: {company.rif}</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> E2E Encriptado
            </span>
          </div>
        </div>
      )}
    </header>
  );
}
