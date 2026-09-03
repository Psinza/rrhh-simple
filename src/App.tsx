import { useState, useEffect } from 'react';
import {
  Users,
  FileSpreadsheet,
  FileCheck,
  Coins,
  LayoutDashboard,
  ShieldCheck,
  Bell,
  Settings,
  Menu,
  X,
  LogOut,
  Shield,
  Briefcase,
  Crown,
  ChevronDown,
  Check,
  CheckCircle2,
  ArrowRight,
  UserCheck,
  CloudUpload,
  Database,
  Building2,
} from 'lucide-react';
import {
  Employee,
  CompanySettings,
  PayrollPeriod,
  PayrollItem,
  LegalNotification,
  AuditLog,
  AppUser,
  AppUserRole,
} from './types';
import {
  initialEmployees,
  initialCompanySettings,
  buildInitialPayrollPeriod,
  initialLegalNotifications,
  initialAuditLogs,
} from './data/initialData';
import { predefinedUsers } from './data/authUsers';
import { lightweightDb, DatabaseState } from './services/lightweightDb';

// Subcomponents
import { LoginScreen } from './components/LoginScreen';
import { DashboardOverview } from './components/DashboardOverview';
import { EmployeesModule } from './components/EmployeesModule';
import { EmployeeDetailModal } from './components/EmployeeDetailModal';
import { PayrollModule } from './components/PayrollModule';
import { DigitalPaySlipModal } from './components/DigitalPaySlipModal';
import { GovernmentFilesModule } from './components/GovernmentFilesModule';
import { SocialBenefitsModule } from './components/SocialBenefitsModule';
import { WorkCertificateModal } from './components/WorkCertificateModal';
import { LegalNotificationsModal } from './components/LegalNotificationsModal';
import { SecurityAndCloudModal } from './components/SecurityAndCloudModal';
import { CompanySettingsModal } from './components/CompanySettingsModal';
import { CompanyIdentityAndUsersModule } from './components/CompanyIdentityAndUsersModule';
import { DatabaseManagerModal } from './components/DatabaseManagerModal';
import { RenderDeployModal } from './components/RenderDeployModal';

export default function App() {
  // Authentication & Session
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);

  // Navigation
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'employees' | 'payroll' | 'benefits' | 'government_files' | 'company_identity'
  >('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Main State
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [company, setCompany] = useState<CompanySettings>(initialCompanySettings);
  const [payroll, setPayroll] = useState<PayrollPeriod>(() =>
    buildInitialPayrollPeriod(initialCompanySettings, initialEmployees)
  );
  const [users, setUsers] = useState<AppUser[]>(() => {
    try {
      const stored = localStorage.getItem('ven_nomina_users');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error(e);
    }
    return predefinedUsers;
  });
  const [notifications, setNotifications] = useState<LegalNotification[]>(
    initialLegalNotifications
  );
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(initialAuditLogs);
  const [lastBackupTime, setLastBackupTime] = useState('10:45 AM');

  // Modals
  const [selectedSlip, setSelectedSlip] = useState<PayrollItem | null>(null);
  const [selectedDetailEmployee, setSelectedDetailEmployee] = useState<Employee | null>(null);
  const [selectedCertEmployee, setSelectedCertEmployee] = useState<Employee | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState(false);
  const [isRenderModalOpen, setIsRenderModalOpen] = useState(false);

  // Synchronize with Lightweight DB on Mount
  useEffect(() => {
    lightweightDb.initDatabase().then((dbState) => {
      if (dbState) {
        if (dbState.company) setCompany(dbState.company);
        if (dbState.employees && dbState.employees.length > 0) setEmployees(dbState.employees);
        if (dbState.users && dbState.users.length > 0) {
          setUsers(dbState.users);
          // Sync current logged in user if match exists
          if (currentUser) {
            const updatedMe = dbState.users.find((u) => u.id === currentUser.id);
            if (updatedMe) setCurrentUser(updatedMe);
          }
        }
      }
    });

    // On mount, try to load authoritative session from backend (/api/me)
    (async () => {
      try {
        const API_BASE = (import.meta as any).env.VITE_API_BASE || '';
        const resp = await fetch(`${API_BASE}/api/me`, { credentials: 'include' });
        if (resp.ok) {
          const body = await resp.json();
          if (body?.user) {
            setCurrentUser(body.user);
          }
        }
      } catch (e) {
        // ignore, user not logged in server-side
      }
    })();
  }, []);

  // Save changes locally in lightweight DB
  useEffect(() => {
    lightweightDb.saveLocal({
      version: '3.2.0',
      timestamp: new Date().toISOString(),
      company,
      employees,
      users,
      payrolls: [payroll],
      socialBenefits: [],
      auditLogs,
<<<<<<< HEAD
      currencyRates: lightweightDb.loadLocal()?.currencyRates || [],
=======
>>>>>>> fb5f23abb61f2ec94b04b0cbd565dcf57c3185af
    });
    try {
      localStorage.setItem('ven_nomina_users', JSON.stringify(users));
      localStorage.setItem('ven_nomina_company', JSON.stringify(company));
    } catch (e) {
      // Ignore quota error
    }
  }, [company, employees, users, payroll, auditLogs]);

  const handleDataRestored = (restored: DatabaseState) => {
    if (restored.company) setCompany(restored.company);
    if (restored.employees) setEmployees(restored.employees);
    if (restored.users) {
      setUsers(restored.users);
      if (currentUser) {
        const updatedMe = restored.users.find((u) => u.id === currentUser.id);
        if (updatedMe) setCurrentUser(updatedMe);
      }
    }
    setLastBackupTime(new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }));
    addAuditLog('Restauración de Base de Datos', 'Seguridad', 'Base de datos restaurada correctamente');
  };

  const unreadCount = notifications.filter((n) => !n.leida).length;

<<<<<<< HEAD
  const getCompleteUserProfile = (user: AppUser): AppUser => {
    const predefinedProfile = predefinedUsers.find((u) => u.id === user.id || u.rol === user.rol);
    return {
      ...(predefinedProfile || user),
      ...user,
      permisos: user.permisos || predefinedProfile?.permisos || [],
      cargo: user.cargo || predefinedProfile?.cargo || '',
      telefono: user.telefono || predefinedProfile?.telefono,
      nivelAcceso: user.nivelAcceso || predefinedProfile?.nivelAcceso || '',
      descripcionAcceso: user.descripcionAcceso || predefinedProfile?.descripcionAcceso || '',
      password: user.password || predefinedProfile?.password || '',
    };
  };

  const getDefaultTabForRole = (role: AppUserRole) => {
    if (role === 'admin_sistema') return 'dashboard';
    if (role === 'rrhh') return 'employees';
    return 'dashboard';
  };

=======
>>>>>>> fb5f23abb61f2ec94b04b0cbd565dcf57c3185af
  // Helper to record audit logs
  const addAuditLog = (
    accion: string,
    modulo: 'Nómina' | 'Expedientes' | 'Prestaciones' | 'Archivos Gubernamentales' | 'Seguridad' | 'Configuración',
    detalles: string
  ) => {
    const roleLabel =
      currentUser?.rol === 'admin_sistema'
        ? 'Administrador RRHH'
        : currentUser?.rol === 'rrhh'
        ? 'Especialista de Nómina'
        : 'Auditor Legal';

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleString('es-VE'),
      usuario: currentUser?.nombre || company.representanteLegal || 'Usuario Sistema',
      rol: roleLabel,
      accion,
      modulo,
      detalles,
      ip: '190.202.112.45',
      cifrado: true,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const handleLogin = async (user: AppUser) => {
    // After login, verify authoritative session from backend (in case cookie is set)
    try {
      const API_BASE = (import.meta as any).env.VITE_API_BASE || '';
      const resp = await fetch(`${API_BASE}/api/me`, { credentials: 'include' });
      if (resp.ok) {
        const body = await resp.json();
        if (body?.user) {
<<<<<<< HEAD
          const completeUser = getCompleteUserProfile(body.user);
          setCurrentUser(completeUser);
          localStorage.setItem('ven_nomina_session_user', JSON.stringify(completeUser));
          setActiveTab(getDefaultTabForRole(completeUser.rol));
=======
          setCurrentUser(body.user);
          const defaultTab = body.user.rol === 'admin_sistema' ? 'company_identity' : body.user.rol === 'rrhh' ? 'employees' : 'payroll';
          setActiveTab(defaultTab as any);
>>>>>>> fb5f23abb61f2ec94b04b0cbd565dcf57c3185af
          setIsRoleDropdownOpen(false);
          addAuditLog(
            'Inicio de Sesión',
            'Seguridad',
<<<<<<< HEAD
            `Acceso autorizado como ${completeUser.rolTitulo} (${completeUser.nombre}) - ${completeUser.nivelAcceso}`
=======
            `Acceso autorizado como ${body.user.rolTitulo} (${body.user.nombre}) - ${body.user.nivelAcceso}`
>>>>>>> fb5f23abb61f2ec94b04b0cbd565dcf57c3185af
          );
          return;
        }
      }
    } catch (e) {
      // fallback to provided user
    }

    // Fallback if /api/me failed
<<<<<<< HEAD
    const completeUser = getCompleteUserProfile(user);
    setCurrentUser(completeUser);
    localStorage.setItem('ven_nomina_session_user', JSON.stringify(completeUser));
    setActiveTab(getDefaultTabForRole(completeUser.rol));
    setIsRoleDropdownOpen(false);
    addAuditLog('Inicio de Sesión', 'Seguridad', `Acceso autorizado como ${completeUser.rolTitulo} (${completeUser.nombre}) - ${completeUser.nivelAcceso}`);
=======
    setCurrentUser(user);
    const defaultTab = user.rol === 'admin_sistema' ? 'company_identity' : user.rol === 'rrhh' ? 'employees' : 'payroll';
    setActiveTab(defaultTab as any);
    setIsRoleDropdownOpen(false);
    addAuditLog('Inicio de Sesión', 'Seguridad', `Acceso autorizado como ${user.rolTitulo} (${user.nombre}) - ${user.nivelAcceso}`);
>>>>>>> fb5f23abb61f2ec94b04b0cbd565dcf57c3185af
  };

  const handleLogout = async () => {
    if (currentUser) {
      addAuditLog(
        'Cierre de Sesión',
        'Seguridad',
        `Cierre de sesión seguro de ${currentUser.nombre} (${currentUser.rolTitulo})`
      );
    }
    // Notify backend to clear cookie
    try {
      const API_BASE = (import.meta as any).env.VITE_API_BASE || '';
      await fetch(`${API_BASE}/api/logout`, { method: 'POST', credentials: 'include' });
    } catch (e) {
      // ignore
    }
    setCurrentUser(null);
<<<<<<< HEAD
    localStorage.removeItem('ven_nomina_session_user');
    sessionStorage.removeItem('ven_nomina_session_user');
=======
>>>>>>> fb5f23abb61f2ec94b04b0cbd565dcf57c3185af
    setIsRoleDropdownOpen(false);
  };

  const handleSwitchRole = (targetRole: AppUserRole) => {
    const target = predefinedUsers.find((u) => u.rol === targetRole);
<<<<<<< HEAD
    if (target && currentUser?.rol === 'admin_sistema') {
=======
    if (target) {
>>>>>>> fb5f23abb61f2ec94b04b0cbd565dcf57c3185af
      setCurrentUser(target);
      setIsRoleDropdownOpen(false);
      addAuditLog(
        'Cambio de Acceso Activo',
        'Seguridad',
        `Cambio de perfil a ${target.rolTitulo} (${target.nombre})`
      );
    }
  };

  const handleApprovePayrollByOwner = () => {
    setPayroll((prev) => ({
      ...prev,
      estatus: 'Aprobada',
    }));
    addAuditLog(
      'Aprobación Ejecutiva de Nómina',
      'Nómina',
      `Nómina ${payroll.nombre} aprobada formalmente por el Director General (${currentUser?.nombre}) para dispersión bancaria.`
    );
  };

  // Handlers for employees
  const handleSaveEmployee = (newEmp: Employee) => {
    setEmployees((prev) => {
      const exists = prev.some((e) => e.id === newEmp.id);
      if (exists) {
        addAuditLog(
          'Actualización de Colaborador',
          'Expedientes',
          `Modificación de datos de ${newEmp.primerNombre} ${newEmp.primerApellido} (${newEmp.cedula})`
        );
        return prev.map((e) => (e.id === newEmp.id ? newEmp : e));
      } else {
        addAuditLog(
          'Ingreso de Colaborador (14-02)',
          'Expedientes',
          `Nuevo colaborador registrado: ${newEmp.primerNombre} ${newEmp.primerApellido} (${newEmp.cedula})`
        );
        return [newEmp, ...prev];
      }
    });
  };

  const handleDeleteEmployee = (employeeId: string) => {
    const toDelete = employees.find((e) => e.id === employeeId);
    if (!toDelete) return;
    setEmployees((prev) => prev.filter((e) => e.id !== employeeId));
    addAuditLog(
      'Eliminación de Colaborador',
      'Expedientes',
      `Registro de ${toDelete.primerNombre} ${toDelete.primerApellido} (${toDelete.cedula}) eliminado por ${currentUser?.nombre || 'Sistema'}`
    );
  };

  const handleUpdatePayroll = (updatedPayroll: PayrollPeriod) => {
    setPayroll(updatedPayroll);
    addAuditLog('Cálculo de Nómina', 'Nómina', `Recálculo de la nómina: ${updatedPayroll.nombre}`);
  };

  const handleSaveCompany = (updatedCompany: CompanySettings) => {
    setCompany(updatedCompany);
    addAuditLog('Ajuste de Parámetros', 'Configuración', `Actualización de parámetros fiscales y tasas BCV`);
  };

  const handleRestoreBackup = (backupData: any) => {
    if (backupData.company) setCompany(backupData.company);
    if (backupData.employees) setEmployees(backupData.employees);
    if (backupData.payroll) setPayroll(backupData.payroll);
    addAuditLog('Restauración de Respaldo', 'Seguridad', `Restauración completa de la base de datos desde respaldo JSON`);
  };

  const handleMarkAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, leida: true })));
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard General', icon: LayoutDashboard },
    { id: 'employees', label: 'Gestión de Personal', icon: Users },
    { id: 'payroll', label: 'Cálculo de Nómina', icon: FileSpreadsheet },
    { id: 'government_files', label: 'Parafiscales (IVSS/FAOV)', icon: FileCheck },
    { id: 'benefits', label: 'Prestaciones Sociales', icon: Coins },
    { id: 'company_identity', label: 'Identidad & Usuarios', icon: Building2 },
    { id: 'audit_reports', label: 'Reportes y Auditoría', icon: ShieldCheck },
  ];

  // Role-based navigation permissions
  const roleAllowedTabs: Record<string, string[]> = {
    admin_sistema: ['dashboard', 'employees', 'payroll', 'government_files', 'benefits', 'company_identity', 'audit_reports'],
<<<<<<< HEAD
    rrhh: ['dashboard', 'employees', 'payroll', 'government_files', 'benefits'],
    dueno: ['dashboard', 'employees', 'payroll', 'government_files', 'benefits'],
=======
    rrhh: ['dashboard', 'employees', 'payroll', 'benefits'],
    dueno: ['dashboard', 'payroll', 'government_files'],
>>>>>>> fb5f23abb61f2ec94b04b0cbd565dcf57c3185af
  };

  const getAllowedNavItems = (role?: string) => {
    const allowedIds = role && roleAllowedTabs[role] ? roleAllowedTabs[role] : ['dashboard'];
    return navItems.filter((n) => allowedIds.includes(n.id));
  };

  // If no user is authenticated, display the dedicated Login Portal
  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} users={users} company={company} />;
  }

  return (
    <div className="flex min-h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-x-hidden selection:bg-blue-600 selection:text-white">
      {/* Mobile Sidebar Backdrop */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Dark Aside Navigation (Professional Polish) */}
      <aside
        className={`w-64 bg-slate-900 text-white flex flex-col shrink-0 z-50 fixed inset-y-0 left-0 transform transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center font-bold text-lg text-white shadow-sm">
              V
            </div>
            <div className="flex flex-col">
              <span className="font-bold tracking-tight text-xl text-white">VEN-Nomina</span>
              <span className="text-[10px] text-slate-400 font-medium">TalentoVE Cloud</span>
            </div>
          </div>
          <button
            onClick={() => setIsMobileSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1"
            aria-label="Cerrar navegación"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
          {getAllowedNavItems(currentUser?.rol).map((item) => {
            const isAudit = item.id === 'audit_reports';
            const isActive = isAudit ? isSecurityOpen : activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (isAudit) {
                    setIsSecurityOpen(true);
                  } else {
                    setActiveTab(item.id as any);
                  }
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors text-left ${
                  isActive
                    ? 'bg-blue-600 text-white font-medium'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                    isActive ? 'bg-white/20' : 'bg-white/10'
                  }`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      isActive ? 'bg-white' : 'bg-slate-400'
                    }`}
                  />
                </div>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Current User Session Card & Role Switcher in Sidebar */}
        <div className="px-4 py-3 border-t border-slate-800/80 space-y-2.5">
          <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold flex items-center justify-between">
            <span>Sesión Activa</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase bg-slate-800 text-blue-400 border border-slate-700">
              {currentUser.rol === 'admin_sistema' ? 'Admin' : currentUser.rol === 'rrhh' ? 'RRHH' : 'Dueño'}
            </span>
          </div>

          <div className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-800/70 border border-slate-700/70">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${currentUser.badgeColor}`}>
              {currentUser.avatar}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white truncate">
                {currentUser.nombre}
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {currentUser.rolTitulo}
              </div>
            </div>
          </div>

          {/* Quick Access Switcher for the 3 requested roles (visible only to Admin) */}
          {currentUser.rol === 'admin_sistema' && (
            <div className="space-y-1">
              <div className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">
                Cambiar Acceso Rápido:
              </div>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => handleSwitchRole('admin_sistema')}
                  title="Acceso Administrador del Sistema"
                  className={`px-1 py-1 rounded text-[10px] font-bold transition-all text-center truncate ${
                    currentUser.rol === 'admin_sistema'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchRole('rrhh')}
                  title="Acceso Gerente de RRHH"
                  className={`px-1 py-1 rounded text-[10px] font-bold transition-all text-center truncate ${
                    currentUser.rol === 'rrhh'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  RRHH
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchRole('dueno')}
                  title="Acceso Dueño de la Empresa"
                  className={`px-1 py-1 rounded text-[10px] font-bold transition-all text-center truncate ${
                    currentUser.rol === 'dueno'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  Dueño
                </button>
              </div>
            </div>
          )}
          

          {/* Logout button */}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-slate-800/80 hover:bg-rose-950/50 hover:text-rose-300 hover:border-rose-800 text-slate-300 text-xs font-semibold border border-slate-700/80 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar Sesión</span>
          </button>
        </div>

        {/* Sidebar Footer System Status */}
        <div className="p-4 mt-auto bg-slate-800/50 border-t border-slate-700">
          <div className="text-xs text-slate-400 mb-1 uppercase tracking-widest">
            Estado del Sistema
          </div>
          <div className="flex items-center gap-2 text-green-400 text-xs font-bold">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Conexión Segura E2E
          </div>
        </div>
      </aside>

      {/* Main Column */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 text-slate-900">
        {/* Header (Professional Polish) */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
              aria-label="Abrir navegación lateral"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="font-semibold text-slate-800 text-sm sm:text-base tracking-tight">
              Módulo de Recursos Humanos (Venezuela)
            </h2>
            <span className="hidden sm:inline-block bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
              Normativa LOTTT 2024
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative px-3 py-1 bg-slate-100 rounded-full text-xs text-slate-500 border border-slate-200 hidden md:block">
              Próximo Cierre: {payroll.fechaFin}
            </div>

            <div className="hidden xl:flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-xs text-slate-600 border border-slate-200 font-mono">
              <span className="text-slate-400 font-sans">Tasa BCV:</span>
              <strong className="text-slate-900">Bs. {company.tasaBCV_USD.toFixed(2)}</strong>
            </div>

            <button
              onClick={() => setIsNotificationsOpen(true)}
              className="relative p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Alertas Legales (Gaceta Oficial)"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-blue-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setIsSecurityOpen(true)}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Ciberseguridad & Respaldo Cloud"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Configuración de la Empresa"
            >
              <Settings className="w-4 h-4 text-slate-600" />
            </button>

            {/* Lightweight Database Manager Button */}
            <button
              onClick={() => setIsDatabaseModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold transition-colors"
              title="Base de Datos Ligera & Nube (Exportar SQL / JSON / Sincronización)"
            >
              <Database className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="hidden md:inline">Base de Datos</span>
            </button>

            {/* Render Deploy Guide Button */}
            <button
              onClick={() => setIsRenderModalOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold transition-colors"
              title="Subir a Render (Guía y Parámetros)"
            >
              <CloudUpload className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Subir a Render</span>
            </button>

            {/* User Session Profile & Dropdown in Header */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                className="flex items-center gap-2 pl-2 pr-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors text-left"
              >
                <div className={`w-7 h-7 rounded flex items-center justify-center text-xs font-bold ${currentUser.badgeColor}`}>
                  {currentUser.avatar}
                </div>
                <div className="hidden md:block">
                  <div className="text-xs font-bold text-slate-800 leading-none">
                    {currentUser.nombre}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    {currentUser.rolTitulo}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isRoleDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-50 text-xs space-y-1">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <div className="font-bold text-slate-900">{currentUser.nombre}</div>
                    <div className="text-[11px] text-slate-500">{currentUser.email}</div>
                    <div className="mt-1 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 inline-block">
                      {currentUser.nivelAcceso}
                    </div>
                  </div>

<<<<<<< HEAD
                  {currentUser.rol === 'admin_sistema' && (
                    <>
                      <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Cambiar Perfil de Acceso
                      </div>

                      {predefinedUsers.map((u) => {
                        const isSelected = u.rol === currentUser.rol;
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => handleSwitchRole(u.rol)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                              isSelected ? 'bg-blue-50 text-blue-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${u.badgeColor}`}>
                                {u.avatar}
                              </div>
                              <div>
                                <div className="text-xs font-bold">{u.rolTitulo}</div>
                                <div className="text-[10px] text-slate-400">{u.cargo}</div>
                              </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                          </button>
                        );
                      })}
                    </>
                  )}
=======
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Cambiar Perfil de Acceso
                  </div>

                  {predefinedUsers.map((u) => {
                    const isSelected = u.rol === currentUser.rol;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleSwitchRole(u.rol)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                          isSelected ? 'bg-blue-50 text-blue-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${u.badgeColor}`}>
                            {u.avatar}
                          </div>
                          <div>
                            <div className="text-xs font-bold">{u.rolTitulo}</div>
                            <div className="text-[10px] text-slate-400">{u.cargo}</div>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                      </button>
                    );
                  })}
>>>>>>> fb5f23abb61f2ec94b04b0cbd565dcf57c3185af

                  <div className="border-t border-slate-100 pt-1 mt-1">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-lg font-semibold transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Workspace */}
        <div className="p-4 sm:p-6 lg:p-8 flex-1 overflow-y-auto">
          {/* Role Specific Executive Banner: Dueño de la Empresa */}
          {currentUser.rol === 'dueno' && (
            <div className="mb-6 p-4 sm:p-5 rounded-xl bg-gradient-to-r from-amber-950 via-slate-900 to-slate-900 text-white border border-amber-500/40 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/40 shadow-sm">
                  <Crown className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      Vista Ejecutiva • Dirección General & Propietario
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                      Acceso Nivel 1
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white tracking-tight mt-0.5">
                    Bienvenido, {currentUser.nombre}
                  </h2>
                  <p className="text-xs text-slate-300 max-w-2xl mt-0.5">
                    Supervisión directa de compromisos laborales, nómina quincenal en Bs. y divisas (Tasa Oficial BCV: Bs. {company.tasaBCV_USD.toFixed(2)}) y pasivos sociales LOTTT.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                {payroll.estatus !== 'Aprobada' ? (
                  <button
                    onClick={handleApprovePayrollByOwner}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md transition-all active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Aprobar Nómina Quincenal</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold">
                    <Check className="w-4 h-4" />
                    <span>Nómina Aprobada para Desembolso</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Role Specific Banner: Administrador del Sistema */}
          {currentUser.rol === 'admin_sistema' && (
            <div className="mb-6 p-4 sm:p-5 rounded-xl bg-gradient-to-r from-blue-950 via-slate-900 to-slate-900 text-white border border-blue-500/40 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/40 shadow-sm">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                      Panel Técnico • Administrador del Sistema & TI
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono">
                      Acceso Nivel 3 - Root
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white tracking-tight mt-0.5">
                    Bienvenido, {currentUser.nombre}
                  </h2>
                  <p className="text-xs text-slate-300 max-w-2xl mt-0.5">
                    Control de ciberseguridad, respaldos cifrados (AES-256), integridad de base de datos y auditoría forense legal.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                <button
                  onClick={() => setIsSecurityOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition-all"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Respaldos & Seguridad</span>
                </button>
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all"
                >
                  <Settings className="w-4 h-4" />
                  <span>Tasas BCV & Parámetros</span>
                </button>
              </div>
            </div>
          )}

          {/* Role Specific Banner: Gerente de RRHH */}
          {currentUser.rol === 'rrhh' && (
            <div className="mb-6 p-4 sm:p-5 rounded-xl bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 text-white border border-emerald-500/40 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/40 shadow-sm">
                  <Briefcase className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      Panel Operativo • Gerencia de Recursos Humanos
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                      Acceso Nivel 2
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white tracking-tight mt-0.5">
                    Bienvenida, {currentUser.nombre}
                  </h2>
                  <p className="text-xs text-slate-300 max-w-2xl mt-0.5">
                    Expedientes de colaboradores (Forma 14-02), cálculo de nómina LOTTT, fondo de prestaciones sociales y parafiscales IVSS/FAOV/INCES.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                <button
                  onClick={() => setActiveTab('payroll')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-all"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Calcular Nómina</span>
                </button>
                <button
                  onClick={() => setActiveTab('government_files')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>Archivos Parafiscales</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <DashboardOverview
              company={company}
              employees={employees}
              payroll={payroll}
              notifications={notifications}
              onNavigate={(tab) => setActiveTab(tab as any)}
              onOpenEmployeeDetail={(emp) => setSelectedDetailEmployee(emp)}
              onQuickGenerateCertificate={() => setSelectedCertEmployee(employees[0] || null)}
            />
          )}

          {activeTab === 'employees' && (
            <EmployeesModule
              employees={employees}
              company={company}
                          currentUser={currentUser}
                          onOpenDetail={(emp) => setSelectedDetailEmployee(emp)}
                          onGenerateCertificate={(emp) => setSelectedCertEmployee(emp)}
                          onSaveEmployee={handleSaveEmployee}
                        />
          )}

          {activeTab === 'payroll' && (
            <PayrollModule
              payroll={payroll}
              company={company}
              employees={employees}
                          currentUser={currentUser}
                          onOpenSlip={(item) => setSelectedSlip(item)}
                          onUpdatePayroll={handleUpdatePayroll}
                          onApprovePayroll={handleApprovePayrollByOwner}
                        />
          )}

          {activeTab === 'benefits' && (
            <SocialBenefitsModule
              employees={employees}
              company={company}
              onOpenEmployeeDetail={(emp) => setSelectedDetailEmployee(emp)}
            />
          )}

          {activeTab === 'government_files' && (
            <GovernmentFilesModule
              company={company}
              employees={employees}
            />
          )}

          {activeTab === 'company_identity' && (
            <CompanyIdentityAndUsersModule
              company={company}
              users={users}
                          currentUser={currentUser}
                          onSaveCompany={handleSaveCompany}
                          onSaveUsers={(updatedUsers) => {
                            setUsers(updatedUsers);
                            if (currentUser) {
                              const updatedMe = updatedUsers.find((u) => u.id === currentUser.id);
                              if (updatedMe) setCurrentUser(updatedMe);
                            }
                            addAuditLog('Actualización de Directivos', 'Seguridad', 'Perfiles y accesos directivos actualizados');
                          }}
                        />
          )}
        </div>

        {/* Footer (Professional Polish) */}
        <footer className="h-12 bg-white border-t border-slate-200 flex items-center justify-between px-4 sm:px-8 text-[10px] text-slate-400 font-medium uppercase tracking-widest shrink-0">
          <div>Seguridad Bancaria Activada (AES-256)</div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline">Respaldo Automático: {lastBackupTime}</span>
            <button
              onClick={() => setIsSecurityOpen(true)}
              className="text-blue-500 hover:text-blue-600 hover:underline uppercase font-bold"
            >
              Soporte Técnico Especializado
            </button>
          </div>
        </footer>
      </main>

      {/* --- MODALS --- */}
      {selectedSlip && (
        <DigitalPaySlipModal
          item={selectedSlip}
          company={company}
          periodName={payroll.nombre}
          onClose={() => setSelectedSlip(null)}
        />
      )}

      {selectedDetailEmployee && (
        <EmployeeDetailModal
          employee={selectedDetailEmployee}
          company={company}
                  currentUser={currentUser}
                  onClose={() => setSelectedDetailEmployee(null)}
                  onGenerateCertificate={(emp) => {
                    setSelectedDetailEmployee(null);
                    setSelectedCertEmployee(emp);
                  }}
                  onUpdateEmployee={handleSaveEmployee}
                  onDeleteEmployee={handleDeleteEmployee}
                />
      )}

      {selectedCertEmployee && (
        <WorkCertificateModal
          employee={selectedCertEmployee}
          company={company}
          onClose={() => setSelectedCertEmployee(null)}
        />
      )}

      {isNotificationsOpen && (
        <LegalNotificationsModal
          notifications={notifications}
          onClose={() => setIsNotificationsOpen(false)}
          onMarkAllAsRead={handleMarkAllNotificationsAsRead}
        />
      )}

      {isSecurityOpen && (
        <SecurityAndCloudModal
          auditLogs={auditLogs}
          company={company}
          employees={employees}
          payroll={payroll}
          onClose={() => setIsSecurityOpen(false)}
          onRestoreBackup={handleRestoreBackup}
          lastBackupTime={lastBackupTime}
          setLastBackupTime={setLastBackupTime}
        />
      )}

      {isSettingsOpen && (
        <CompanySettingsModal
          company={company}
          onClose={() => setIsSettingsOpen(false)}
          onSave={handleSaveCompany}
          onOpenIdentityModule={() => {
            setIsSettingsOpen(false);
            setActiveTab('company_identity' as any);
          }}
        />
      )}

      {isDatabaseModalOpen && (
        <DatabaseManagerModal
          isOpen={isDatabaseModalOpen}
          onClose={() => setIsDatabaseModalOpen(false)}
          company={company}
          employees={employees}
          users={users}
          onDataRestored={handleDataRestored}
        />
      )}

      <RenderDeployModal
        isOpen={isRenderModalOpen}
        onClose={() => setIsRenderModalOpen(false)}
      />
    </div>
  );
}
