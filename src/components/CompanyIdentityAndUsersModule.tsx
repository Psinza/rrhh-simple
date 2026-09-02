import React, { useState, useRef } from 'react';
import {
  Building2,
  Upload,
  Image as ImageIcon,
  Trash2,
  CheckCircle2,
  Shield,
  Briefcase,
  Crown,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  Save,
  RotateCcw,
  FileText,
  FileSpreadsheet,
  Check,
  Building,
  KeyRound,
  Fingerprint,
} from 'lucide-react';
import { CompanySettings, AppUser } from '../types';

interface CompanyIdentityAndUsersModuleProps {
  company: CompanySettings;
  users: AppUser[];
  onSaveCompany: (updatedCompany: CompanySettings) => void;
  onSaveUsers: (updatedUsers: AppUser[]) => void;
}

export function CompanyIdentityAndUsersModule({
  company,
  users,
  onSaveCompany,
  onSaveUsers,
}: CompanyIdentityAndUsersModuleProps) {
  // Local state for company
  const [razonSocial, setRazonSocial] = useState(company.razonSocial);
  const [rif, setRif] = useState(company.rif);
  const [direccionFiscal, setDireccionFiscal] = useState(company.direccionFiscal);
  const [ciudad, setCiudad] = useState(company.ciudad);
  const [estado, setEstado] = useState(company.estado);
  const [telefono, setTelefono] = useState(company.telefono);
  const [email, setEmail] = useState(company.email);
  const [representanteLegal, setRepresentanteLegal] = useState(company.representanteLegal);
  const [cedulaRepresentante, setCedulaRepresentante] = useState(company.cedulaRepresentante);
  const [cargoRepresentante, setCargoRepresentante] = useState(company.cargoRepresentante);
  const [logoUrl, setLogoUrl] = useState(company.logoUrl || '');

  // Local state for the 3 users
  const [adminUser, setAdminUser] = useState<AppUser>(() => {
    return users.find((u) => u.rol === 'admin_sistema') || users[0];
  });
  const [rrhhUser, setRrhhUser] = useState<AppUser>(() => {
    return users.find((u) => u.rol === 'rrhh') || users[1];
  });
  const [duenoUser, setDuenoUser] = useState<AppUser>(() => {
    return users.find((u) => u.rol === 'dueno') || users[2];
  });

  const [activeUserTab, setActiveUserTab] = useState<'admin_sistema' | 'rrhh' | 'dueno'>('admin_sistema');
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [showRrhhPass, setShowRrhhPass] = useState(false);
  const [showDuenoPass, setShowDuenoPass] = useState(false);

  const [logoInputType, setLogoInputType] = useState<'file' | 'url'>('file');
  const [logoUrlInput, setLogoUrlInput] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showNotification = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  // Handle Logo Upload from local file
  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (max 2MB for base64)
    if (file.size > 2.5 * 1024 * 1024) {
      alert('La imagen no debe superar los 2.5 MB para un óptimo rendimiento.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setLogoUrl(result);
        const updated = { ...company, logoUrl: result };
        onSaveCompany(updated);
        showNotification('¡Logotipo de la empresa cargado y actualizado correctamente!');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyLogoUrl = () => {
    if (!logoUrlInput.trim()) return;
    setLogoUrl(logoUrlInput.trim());
    const updated = { ...company, logoUrl: logoUrlInput.trim() };
    onSaveCompany(updated);
    setLogoUrlInput('');
    showNotification('¡URL de logotipo asignada y guardada exitosamente!');
  };

  const handleRemoveLogo = () => {
    setLogoUrl('');
    const updated = { ...company, logoUrl: undefined };
    onSaveCompany(updated);
    if (fileInputRef.current) fileInputRef.current.value = '';
    showNotification('Logotipo eliminado. Se utilizará el emblema estándar.');
  };

  // Auto-generate avatar initials from name
  const computeInitials = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'US';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Save all 3 users
  const handleSaveAllUsers = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const updatedAdmin: AppUser = {
      ...adminUser,
      avatar: adminUser.avatar.trim() || computeInitials(adminUser.nombre),
    };

    const updatedRrhh: AppUser = {
      ...rrhhUser,
      avatar: rrhhUser.avatar.trim() || computeInitials(rrhhUser.nombre),
    };

    const updatedDueno: AppUser = {
      ...duenoUser,
      avatar: duenoUser.avatar.trim() || computeInitials(duenoUser.nombre),
    };

    const newUsersList = [updatedAdmin, updatedRrhh, updatedDueno];
    onSaveUsers(newUsersList);
    showNotification('¡Perfiles de los 3 usuarios directivos guardados y actualizados con éxito!');
  };

  // Save Company Data
  const handleSaveCompanyData = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: CompanySettings = {
      ...company,
      razonSocial,
      rif,
      direccionFiscal,
      ciudad,
      estado,
      telefono,
      email,
      representanteLegal,
      cedulaRepresentante,
      cargoRepresentante,
      logoUrl: logoUrl || undefined,
    };
    onSaveCompany(updated);
    showNotification('¡Información institucional de la empresa actualizada con éxito!');
  };

  // Quick sync representative with owner or HR
  const handleSyncRepresentative = (source: 'dueno' | 'rrhh') => {
    if (source === 'dueno') {
      setRepresentanteLegal(duenoUser.nombre);
      setCargoRepresentante(duenoUser.cargo);
    } else {
      setRepresentanteLegal(rrhhUser.nombre);
      setCargoRepresentante(rrhhUser.cargo);
    }
    showNotification(`Datos del Representante Legal sincronizados con ${source === 'dueno' ? 'el Dueño' : 'la Gerencia de RRHH'}.`);
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback Notification */}
      {feedbackMessage && (
        <div className="fixed top-5 right-5 z-50 p-4 bg-emerald-600 text-white font-medium text-xs rounded-xl shadow-xl flex items-center gap-2.5 animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Module Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Identidad Corporativa & Usuarios Directivos
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold uppercase">
                Módulo Oficial
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Personalice el logo de la empresa y actualice los nombres, cargos y accesos del Administrador de TI, Gerente de RRHH y Dueño de la Empresa.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => handleSaveAllUsers()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Guardar Todos los Cambios</span>
          </button>
        </div>
      </div>

      {/* Two Column Layout: Logo on Left/Top, Directiva on Right/Bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ================= SECTION 1: LOGOTIPO DE LA EMPRESA (4 COLS) ================= */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Logo de la Compañía</h3>
                  <p className="text-[11px] text-slate-400">Marca gráfica para cabeceras y documentos</p>
                </div>
              </div>
              {logoUrl && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                  Activo
                </span>
              )}
            </div>

            {/* Logo Preview Card */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center text-center">
              <div className="w-36 h-28 rounded-xl bg-white border border-slate-200 shadow-xs p-2 flex items-center justify-center overflow-hidden relative group">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo de la empresa"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center text-slate-400">
                    <div className="w-12 h-12 rounded-xl bg-blue-600 text-white font-black text-2xl flex items-center justify-center shadow-xs">
                      {razonSocial ? razonSocial.charAt(0).toUpperCase() : 'V'}
                    </div>
                    <span className="text-[10px] font-medium text-slate-400 mt-2">
                      Emblema Estándar
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-3 text-center">
                <span className="text-xs font-bold text-slate-800 block truncate max-w-xs">
                  {razonSocial}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">RIF: {rif}</span>
              </div>
            </div>

            {/* Upload Method Selector */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setLogoInputType('file')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors ${
                    logoInputType === 'file'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Subir Archivo de Imagen
                </button>
                <button
                  type="button"
                  onClick={() => setLogoInputType('url')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors ${
                    logoInputType === 'url'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Enlace / URL de Imagen
                </button>
              </div>

              {logoInputType === 'file' ? (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/webp, image/svg+xml"
                    onChange={handleLogoFileUpload}
                    className="hidden"
                    id="company-logo-file-input"
                  />
                  <label
                    htmlFor="company-logo-file-input"
                    className="w-full flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 rounded-xl cursor-pointer transition-all text-center group"
                  >
                    <Upload className="w-6 h-6 text-slate-400 group-hover:text-blue-600 transition-colors mb-1" />
                    <span className="text-xs font-bold text-slate-700 group-hover:text-blue-700">
                      Haga clic para seleccionar el logo
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      PNG, JPG, SVG o WebP (Recomendado: fondo transparente)
                    </span>
                  </label>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://ejemplo.com/logo-empresa.png"
                      value={logoUrlInput}
                      onChange={(e) => setLogoUrlInput(e.target.value)}
                      className="flex-1 p-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleApplyLogoUrl}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                    >
                      Aplicar
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    Pegue una URL pública y directa de la imagen del logotipo.
                  </span>
                </div>
              )}

              {logoUrl && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar Logo / Restaurar Emblema Estándar</span>
                </button>
              )}
            </div>

            {/* Visibility Indicators */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <span className="font-bold text-[11px] text-slate-700 uppercase tracking-wider block">
                ¿Dónde se reflejará el logotipo?
              </span>
              <ul className="space-y-1 text-[11px] text-slate-600">
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Barra superior y menú lateral del sistema</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Portal corporativo de inicio de sesión</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Recibos de Pago Digitales certificados LOTTT</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Constancias Oficiales de Trabajo con membrete</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* ================= SECTION 2: MODIFICACIÓN DE LOS 3 ROLES (7 COLS) ================= */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Fingerprint className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Modificar Usuarios & Autoridades</h3>
                  <p className="text-[11px] text-slate-400">
                    Cambie los nombres y cargos de los 3 perfiles principales del sistema
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleSaveAllUsers()}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Guardar Cambios</span>
              </button>
            </div>

            {/* 3 Role Selection Tabs */}
            <div className="grid grid-cols-3 gap-2">
              {/* Tab 1: Admin TI */}
              <button
                type="button"
                onClick={() => setActiveUserTab('admin_sistema')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col items-start ${
                  activeUserTab === 'admin_sistema'
                    ? 'bg-blue-50 border-blue-500 shadow-xs ring-1 ring-blue-500/30'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5 text-blue-600 mb-1">
                  <Shield className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase">TI & Sistemas</span>
                </div>
                <span className="text-xs font-bold text-slate-900 truncate w-full">
                  {adminUser.nombre}
                </span>
                <span className="text-[10px] text-slate-500 truncate w-full">
                  {adminUser.cargo}
                </span>
              </button>

              {/* Tab 2: RRHH */}
              <button
                type="button"
                onClick={() => setActiveUserTab('rrhh')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col items-start ${
                  activeUserTab === 'rrhh'
                    ? 'bg-emerald-50 border-emerald-500 shadow-xs ring-1 ring-emerald-500/30'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5 text-emerald-600 mb-1">
                  <Briefcase className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase">Gerente RRHH</span>
                </div>
                <span className="text-xs font-bold text-slate-900 truncate w-full">
                  {rrhhUser.nombre}
                </span>
                <span className="text-[10px] text-slate-500 truncate w-full">
                  {rrhhUser.cargo}
                </span>
              </button>

              {/* Tab 3: Dueño */}
              <button
                type="button"
                onClick={() => setActiveUserTab('dueno')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col items-start ${
                  activeUserTab === 'dueno'
                    ? 'bg-amber-50 border-amber-500 shadow-xs ring-1 ring-amber-500/30'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5 text-amber-600 mb-1">
                  <Crown className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase">Dueño Empresa</span>
                </div>
                <span className="text-xs font-bold text-slate-900 truncate w-full">
                  {duenoUser.nombre}
                </span>
                <span className="text-[10px] text-slate-500 truncate w-full">
                  {duenoUser.cargo}
                </span>
              </button>
            </div>

            {/* Role 1 Form: Administrador del Sistema */}
            {activeUserTab === 'admin_sistema' && (
              <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-100 space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                      {adminUser.avatar}
                    </div>
                    <div>
                      <h4 className="font-bold text-blue-950 text-xs uppercase tracking-wider">
                        Perfil: Administrador de Sistemas & TI
                      </h4>
                      <span className="text-[10px] text-blue-800">
                        Nivel de Acceso 3 • Root TI & Ciberseguridad
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-mono font-bold">
                    ID: {adminUser.id}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nombre Completo del Administrador de TI *
                    </label>
                    <input
                      type="text"
                      required
                      value={adminUser.nombre}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAdminUser((prev) => ({
                          ...prev,
                          nombre: val,
                          avatar: computeInitials(val),
                        }));
                      }}
                      placeholder="Ej. Ing. Marcos Valbuena"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Cargo / Título Oficial *
                    </label>
                    <input
                      type="text"
                      required
                      value={adminUser.cargo}
                      onChange={(e) => setAdminUser((prev) => ({ ...prev, cargo: e.target.value }))}
                      placeholder="Ej. Administrador de Sistemas & TI"
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Iniciales para Avatar (Badge)
                    </label>
                    <input
                      type="text"
                      maxLength={3}
                      value={adminUser.avatar}
                      onChange={(e) => setAdminUser((prev) => ({ ...prev, avatar: e.target.value.toUpperCase() }))}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-center uppercase"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Usuario de Ingreso (Login) *
                    </label>
                    <input
                      type="text"
                      required
                      value={adminUser.username}
                      onChange={(e) => setAdminUser((prev) => ({ ...prev, username: e.target.value }))}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Correo Electrónico Institucional
                    </label>
                    <input
                      type="email"
                      value={adminUser.email}
                      onChange={(e) => setAdminUser((prev) => ({ ...prev, email: e.target.value }))}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Teléfono de Contacto
                    </label>
                    <input
                      type="tel"
                      value={adminUser.telefono || ''}
                      onChange={(e) => setAdminUser((prev) => ({ ...prev, telefono: e.target.value }))}
                      placeholder="Ej. 04127310361"
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Contraseña de Acceso
                    </label>
                    <div className="relative">
                      <input
                        type={showAdminPass ? 'text' : 'password'}
                        value={adminUser.password}
                        onChange={(e) => setAdminUser((prev) => ({ ...prev, password: e.target.value }))}
                        className="w-full p-2 pr-9 bg-white border border-slate-300 rounded-lg font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPass(!showAdminPass)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showAdminPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Role 2 Form: Gerente de Recursos Humanos */}
            {activeUserTab === 'rrhh' && (
              <div className="p-4 rounded-xl bg-emerald-50/40 border border-emerald-100 space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                      {rrhhUser.avatar}
                    </div>
                    <div>
                      <h4 className="font-bold text-emerald-950 text-xs uppercase tracking-wider">
                        Perfil: Gerente de Recursos Humanos
                      </h4>
                      <span className="text-[10px] text-emerald-800">
                        Nivel de Acceso 2 • Gestión Operativa RRHH & Nómina
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-mono font-bold">
                    ID: {rrhhUser.id}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nombre Completo del/de la Gerente de RRHH *
                    </label>
                    <input
                      type="text"
                      required
                      value={rrhhUser.nombre}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRrhhUser((prev) => ({
                          ...prev,
                          nombre: val,
                          avatar: computeInitials(val),
                        }));
                      }}
                      placeholder="Ej. Lic. Valentina Silva"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Cargo / Título Oficial *
                    </label>
                    <input
                      type="text"
                      required
                      value={rrhhUser.cargo}
                      onChange={(e) => setRrhhUser((prev) => ({ ...prev, cargo: e.target.value }))}
                      placeholder="Ej. Gerente de Recursos Humanos"
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Iniciales para Avatar (Badge)
                    </label>
                    <input
                      type="text"
                      maxLength={3}
                      value={rrhhUser.avatar}
                      onChange={(e) => setRrhhUser((prev) => ({ ...prev, avatar: e.target.value.toUpperCase() }))}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-center uppercase"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Usuario de Ingreso (Login) *
                    </label>
                    <input
                      type="text"
                      required
                      value={rrhhUser.username}
                      onChange={(e) => setRrhhUser((prev) => ({ ...prev, username: e.target.value }))}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Correo Electrónico Institucional
                    </label>
                    <input
                      type="email"
                      value={rrhhUser.email}
                      onChange={(e) => setRrhhUser((prev) => ({ ...prev, email: e.target.value }))}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Teléfono de Contacto
                    </label>
                    <input
                      type="tel"
                      value={rrhhUser.telefono || ''}
                      onChange={(e) => setRrhhUser((prev) => ({ ...prev, telefono: e.target.value }))}
                      placeholder="Ej. 04141234567"
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Contraseña de Acceso
                    </label>
                    <div className="relative">
                      <input
                        type={showRrhhPass ? 'text' : 'password'}
                        value={rrhhUser.password}
                        onChange={(e) => setRrhhUser((prev) => ({ ...prev, password: e.target.value }))}
                        className="w-full p-2 pr-9 bg-white border border-slate-300 rounded-lg font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRrhhPass(!showRrhhPass)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showRrhhPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Role 3 Form: Dueño de la Empresa */}
            {activeUserTab === 'dueno' && (
              <div className="p-4 rounded-xl bg-amber-50/40 border border-amber-100 space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-xs">
                      {duenoUser.avatar}
                    </div>
                    <div>
                      <h4 className="font-bold text-amber-950 text-xs uppercase tracking-wider">
                        Perfil: Dueño de la Empresa / Dirección General
                      </h4>
                      <span className="text-[10px] text-amber-800">
                        Nivel de Acceso 1 • Alta Dirección & Accionista
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono font-bold">
                    ID: {duenoUser.id}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nombre Completo del Dueño / Propietario *
                    </label>
                    <input
                      type="text"
                      required
                      value={duenoUser.nombre}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDuenoUser((prev) => ({
                          ...prev,
                          nombre: val,
                          avatar: computeInitials(val),
                        }));
                      }}
                      placeholder="Ej. Dr. Alejandro Ramos"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Cargo / Título Oficial *
                    </label>
                    <input
                      type="text"
                      required
                      value={duenoUser.cargo}
                      onChange={(e) => setDuenoUser((prev) => ({ ...prev, cargo: e.target.value }))}
                      placeholder="Ej. Director General & Propietario"
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Iniciales para Avatar (Badge)
                    </label>
                    <input
                      type="text"
                      maxLength={3}
                      value={duenoUser.avatar}
                      onChange={(e) => setDuenoUser((prev) => ({ ...prev, avatar: e.target.value.toUpperCase() }))}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-center uppercase"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Usuario de Ingreso (Login) *
                    </label>
                    <input
                      type="text"
                      required
                      value={duenoUser.username}
                      onChange={(e) => setDuenoUser((prev) => ({ ...prev, username: e.target.value }))}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Correo Electrónico Institucional
                    </label>
                    <input
                      type="email"
                      value={duenoUser.email}
                      onChange={(e) => setDuenoUser((prev) => ({ ...prev, email: e.target.value }))}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Teléfono de Contacto
                    </label>
                    <input
                      type="tel"
                      value={duenoUser.telefono || ''}
                      onChange={(e) => setDuenoUser((prev) => ({ ...prev, telefono: e.target.value }))}
                      placeholder="Ej. 04249876543"
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Contraseña de Acceso
                    </label>
                    <div className="relative">
                      <input
                        type={showDuenoPass ? 'text' : 'password'}
                        value={duenoUser.password}
                        onChange={(e) => setDuenoUser((prev) => ({ ...prev, password: e.target.value }))}
                        className="w-full p-2 pr-9 bg-white border border-slate-300 rounded-lg font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowDuenoPass(!showDuenoPass)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showDuenoPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Los cambios se reflejarán de inmediato en la sesión activa y en la pantalla de inicio.
              </span>
              <button
                type="button"
                onClick={() => handleSaveAllUsers()}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                <Save className="w-4 h-4" />
                <span>Aplicar Cambios de Usuarios</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================= SECTION 3: DATOS FISCALES & REPRESENTANTE LEGAL ================= */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center">
              <Building className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Identificación Institucional & Representante Legal</h3>
              <p className="text-[11px] text-slate-400">
                Datos que aparecen en los membretes, recibos de pago y constancias de trabajo oficiales
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSyncRepresentative('dueno')}
              className="text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg transition-colors"
              title="Copiar el nombre del Dueño como Representante Legal"
            >
              Usar Nombre del Dueño
            </button>
            <button
              type="button"
              onClick={() => handleSyncRepresentative('rrhh')}
              className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors"
              title="Copiar el nombre del Gerente de RRHH como Representante Legal"
            >
              Usar Nombre de RRHH
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveCompanyData} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Razón Social de la Empresa *</label>
              <input
                type="text"
                required
                value={razonSocial}
                onChange={(e) => setRazonSocial(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-semibold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">R.I.F. (J-00000000-0) *</label>
              <input
                type="text"
                required
                value={rif}
                onChange={(e) => setRif(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono text-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nombre del Representante Legal *</label>
              <input
                type="text"
                required
                value={representanteLegal}
                onChange={(e) => setRepresentanteLegal(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Cédula del Representante *</label>
              <input
                type="text"
                required
                value={cedulaRepresentante}
                onChange={(e) => setCedulaRepresentante(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Cargo del Representante *</label>
              <input
                type="text"
                required
                value={cargoRepresentante}
                onChange={(e) => setCargoRepresentante(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Dirección Fiscal *</label>
              <input
                type="text"
                required
                value={direccionFiscal}
                onChange={(e) => setDireccionFiscal(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Ciudad y Estado *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Ciudad"
                  value={ciudad}
                  onChange={(e) => setCiudad(e.target.value)}
                  className="w-1/2 p-2 bg-white border border-slate-300 rounded-lg"
                />
                <input
                  type="text"
                  required
                  placeholder="Estado"
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="w-1/2 p-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Teléfono de Contacto</label>
              <input
                type="text"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Correo Electrónico de la Empresa</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Información de la Empresa</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
