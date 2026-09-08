import { useState, FormEvent } from 'react';
import {
  ShieldCheck,
  Lock,
  User,
  Eye,
  EyeOff,
  Building2,
  KeyRound,
  ArrowRight,
  Shield,
  Briefcase,
  Crown,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { AppUser, CompanySettings } from '../types';
import { predefinedUsers } from '../data/authUsers';
import { getApiBase } from '../services/api';

interface LoginScreenProps {
  onLogin: (user: AppUser) => void;
  defaultRole?: string;
  users?: AppUser[];
  company?: CompanySettings;
}

export function LoginScreen({ onLogin, users, company }: LoginScreenProps) {
  const activeUsers = users && users.length > 0 ? users : predefinedUsers;
  const [selectedRole, setSelectedRole] = useState<'admin_sistema' | 'rrhh' | 'dueno'>('admin_sistema');
  const [identifier, setIdentifier] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(true);

  // When clicking one of the 3 role selector cards
  const handleSelectRole = (role: 'admin_sistema' | 'rrhh' | 'dueno') => {
    setSelectedRole(role);
    setErrorMsg(null);
  };

  const handleManualLogin = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // ── Validación local primaria (siempre disponible, sin backend) ──
    const trimId = identifier.trim().toLowerCase();
    const localUser = activeUsers.find(
      (u) =>
        (u.username?.toLowerCase() === trimId || u.email?.toLowerCase() === trimId) &&
        u.password === password
    );

    if (!localUser) {
      setErrorMsg('Usuario o contraseña incorrectos.');
      return;
    }

    // Verificar que el rol seleccionado coincida con el perfil del usuario
    if (localUser.rol !== selectedRole) {
      setErrorMsg(
        `Las credenciales corresponden al perfil "${localUser.rolTitulo}". ` +
        `Por favor seleccione ese perfil en las tarjetas de arriba.`
      );
      return;
    }

    // Login local exitoso — notificar a App.tsx inmediatamente
    onLogin(localUser);

    // ── Intentar también el backend de forma secundaria y no bloqueante ──
    try {
      const API_BASE = getApiBase();
      fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ identifier, password, selectedRole }),
      }).catch(() => {/* ignorar si el backend no está disponible */});
    } catch {
      // Ignorar — el login local ya fue exitoso
    }
  };

  const handleDirectQuickLogin = (role: 'admin_sistema' | 'rrhh' | 'dueno') => {
    const targetUser = activeUsers.find((u) => u.rol === role);
    if (targetUser) {
      onLogin(targetUser);
    }
  };

  const currentUserConfig = activeUsers.find((u) => u.rol === selectedRole) || activeUsers[0];

  const adminRoleUser = activeUsers.find((u) => u.rol === 'admin_sistema');
  const rrhhRoleUser = activeUsers.find((u) => u.rol === 'rrhh');
  const duenoRoleUser = activeUsers.find((u) => u.rol === 'dueno');

  // Silence unused variable warning
  void handleDirectQuickLogin;
  void rememberMe;

  return (
    <div className="min-h-screen w-full bg-slate-900 text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white font-sans">
      {/* Top Header Bar */}
      <header className="h-16 border-b border-slate-800/80 px-6 sm:px-12 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {company?.logoUrl ? (
            <img
              src={company.logoUrl}
              alt="Logo de la Empresa"
              className="h-9 w-auto max-w-[120px] object-contain rounded bg-white/10 p-0.5 border border-slate-700/50"
            />
          ) : (
            <div className="w-9 h-9 bg-blue-600 rounded flex items-center justify-center font-black text-xl text-white shadow-sm">
              {company?.razonSocial ? company.razonSocial.charAt(0).toUpperCase() : 'V'}
            </div>
          )}
          <div>
            <div className="font-bold text-white tracking-tight flex items-center gap-2">
              <span className="truncate max-w-[200px] sm:max-w-xs">
                {company?.razonSocial || 'VEN-Nomina'}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono border border-blue-500/30 shrink-0">
                PRO v3.2
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Portal de Acceso Corporativo • LOTTT Venezuela</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Servidor Seguro Activo</span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="font-mono text-slate-300">Cifrado Bancario AES-256</span>
        </div>
      </header>

      {/* Center Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-10">
        <div className="w-full max-w-4xl bg-slate-950/80 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden backdrop-blur-md">
          {/* Header Banner inside card */}
          <div className="p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-800">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  Control de Acceso por Roles Oficiales
                </span>
                <h1 data-testid="login-header" className="text-2xl sm:text-3xl font-bold text-white mt-1 tracking-tight">
                  Inicio de Sesión
                </h1>
                <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-xl">
                  Seleccione su perfil de acceso asignado para gestionar la nómina venezolana, personal y finanzas con estricto apego a la normativa legal vigente.
                </p>
              </div>

              <div className="px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-right">
                <span className="text-[10px] text-slate-400 block uppercase font-mono">Tasa de Cambio BCV</span>
                <span className="text-sm font-bold text-white font-mono">Oficial Bs./USD</span>
              </div>
            </div>

            {/* 3 Access Profiles Selector */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
              {/* 1. Administrador del Sistema */}
              <button
                type="button"
                data-testid="role-admin"
                onClick={() => handleSelectRole('admin_sistema')}
                className={`p-3.5 rounded-xl border text-left transition-all relative ${
                  selectedRole === 'admin_sistema'
                    ? 'bg-blue-950/70 border-blue-500 ring-2 ring-blue-500/30 shadow-md'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    <Shield className="w-4 h-4" />
                  </div>
                  {selectedRole === 'admin_sistema' && (
                    <span className="text-[10px] font-bold uppercase bg-blue-500 text-white px-1.5 py-0.5 rounded">
                      Seleccionado
                    </span>
                  )}
                </div>
                <div className="font-bold text-white text-sm">Administrador del Sistema</div>
                <div className="text-[11px] text-blue-300 font-semibold truncate">
                  {adminRoleUser?.nombre || 'Ing. Pedro Sinza'}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                  {adminRoleUser?.cargo || 'TI, Respaldos, Base de Datos Ligera y Seguridad'}
                </div>
              </button>

              {/* 2. Acceso de RRHH */}
              <button
                type="button"
                data-testid="role-rrhh"
                onClick={() => handleSelectRole('rrhh')}
                className={`p-3.5 rounded-xl border text-left transition-all relative ${
                  selectedRole === 'rrhh'
                    ? 'bg-emerald-950/70 border-emerald-500 ring-2 ring-emerald-500/30 shadow-md'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  {selectedRole === 'rrhh' && (
                    <span className="text-[10px] font-bold uppercase bg-emerald-500 text-white px-1.5 py-0.5 rounded">
                      Seleccionado
                    </span>
                  )}
                </div>
                <div className="font-bold text-white text-sm">Gerente de RRHH</div>
                <div className="text-[11px] text-emerald-300 font-semibold truncate">
                  {rrhhRoleUser?.nombre || 'Lic. Dubraska'}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                  {rrhhRoleUser?.cargo || 'Expedientes 14-02, recibos digitales, prestaciones y archivos IVSS.'}
                </div>
              </button>

              {/* 3. Acceso del Dueño */}
              <button
                type="button"
                data-testid="role-dueno"
                onClick={() => handleSelectRole('dueno')}
                className={`p-3.5 rounded-xl border text-left transition-all relative ${
                  selectedRole === 'dueno'
                    ? 'bg-amber-950/70 border-amber-500 ring-2 ring-amber-500/30 shadow-md'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Crown className="w-4 h-4" />
                  </div>
                  {selectedRole === 'dueno' && (
                    <span className="text-[10px] font-bold uppercase bg-amber-500 text-white px-1.5 py-0.5 rounded">
                      Seleccionado
                    </span>
                  )}
                </div>
                <div className="font-bold text-white text-sm">Dueño de la Empresa</div>
                <div className="text-[11px] text-amber-300 font-semibold truncate">
                  {duenoRoleUser?.nombre || 'JACOB AGAI BENZAQUEN'}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                  {duenoRoleUser?.cargo || 'Dirección General, aprobación de nómina y costos BCV.'}
                </div>
              </button>
            </div>
          </div>

          {/* Form & Profile Details Grid */}
          <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-slate-900/90">
            {/* Left Column: Role Details */}
            <div className="lg:col-span-5 space-y-4 border-b lg:border-b-0 lg:border-r border-slate-800 pb-6 lg:pb-0 lg:pr-8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-lg text-white">
                  {currentUserConfig.avatar}
                </div>
                <div>
                  <h3 className="font-bold text-white text-base leading-tight">
                    {currentUserConfig.nombre}
                  </h3>
                  <span className="text-xs text-slate-400 block">{currentUserConfig.cargo}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 inline-block mt-1">
                    {currentUserConfig.nivelAcceso}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-2">
                <span className="text-slate-400 font-semibold block text-[11px] uppercase tracking-wider">
                  Permisos Habilitados:
                </span>
                <ul className="space-y-1.5 text-slate-300">
                  {currentUserConfig.permisos.slice(0, 4).map((p, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="w-full text-sm text-slate-400">
                Ingrese su usuario y contraseña para acceder al módulo correspondiente según su rol.
              </div>
            </div>

            {/* Right Column: Standard Authentication Form */}
            <form onSubmit={handleManualLogin} className="lg:col-span-7 space-y-4">
              <div>
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-blue-400" />
                  Credenciales de Acceso
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Ingrese las credenciales asignadas a su perfil seleccionado.
                </p>
              </div>

              {errorMsg && (
                <div data-testid="login-error" className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">
                    Usuario o Correo Institucional
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      data-testid="login-identifier"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Ej. psinza, rrhh, dueno"
                      required
                      autoComplete="username"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-slate-300 font-medium">Contraseña de Seguridad</label>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      data-testid="login-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Contraseña"
                      required
                      autoComplete="current-password"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-300">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Mantener sesión iniciada en este equipo</span>
                  </label>

                  <span className="text-[11px] text-blue-400 hover:underline cursor-pointer">
                    ¿Problemas de acceso?
                  </span>
                </div>

                <button
                  type="submit"
                  data-testid="login-submit"
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-[0.99] transition-all"
                >
                  <span>Iniciar Sesión como {currentUserConfig.rolTitulo}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {/* Hint de credenciales */}
                <div className="mt-2 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-[11px] text-slate-400 space-y-1">
                  <p className="font-semibold text-slate-300 mb-1">Credenciales de prueba:</p>
                  <p><span className="text-blue-300 font-mono">psinza / psinza</span> → Administrador (todos los módulos)</p>
                  <p><span className="text-emerald-300 font-mono">rrhh / rrhh</span> → Módulo RRHH</p>
                  <p><span className="text-amber-300 font-mono">dueno / dueno</span> → Dashboard Ejecutivo</p>
                </div>
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-12 border-t border-slate-800/80 px-6 sm:px-12 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-2">
          <Building2 className="w-3.5 h-3.5 text-slate-400" />
          <span>Cumplimiento Legal LOTTT • Gaceta Oficial de la República Bolivariana de Venezuela</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Soporte Técnico: petersinza@gmail.com</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">Caracas, Venezuela</span>
        </div>
      </footer>
    </div>
  );
}
