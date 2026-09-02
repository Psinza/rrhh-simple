import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  Coins,
  CreditCard,
  Briefcase,
  Check,
  X,
  Eye,
} from 'lucide-react';
import { Employee, CompanySettings } from '../types';
import { formatBs, formatUSD, calculateTenure, calculateIntegralSalary } from '../utils/venezuelaLaborCalculations';

interface EmployeesModuleProps {
  employees: Employee[];
  company: CompanySettings;
  onOpenDetail: (employee: Employee) => void;
  onGenerateCertificate: (employee: Employee) => void;
  onSaveEmployee: (newOrUpdated: Employee) => void;
}

export function EmployeesModule({
  employees,
  company,
  onOpenDetail,
  onGenerateCertificate,
  onSaveEmployee,
}: EmployeesModuleProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('todos');
  const [selectedStatus, setSelectedStatus] = useState<string>('todos');
  const [isNewEmployeeModalOpen, setIsNewEmployeeModalOpen] = useState(false);

  // Form state for new employee
  const [formNac, setFormNac] = useState<'V' | 'E'>('V');
  const [formCedulaNum, setFormCedulaNum] = useState('');
  const [formRifNum, setFormRifNum] = useState('');
  const [formPrimerNombre, setFormPrimerNombre] = useState('');
  const [formSegundoNombre, setFormSegundoNombre] = useState('');
  const [formPrimerApellido, setFormPrimerApellido] = useState('');
  const [formSegundoApellido, setFormSegundoApellido] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formTelefono, setFormTelefono] = useState('');
  const [formDireccion, setFormDireccion] = useState('');
  const [formCiudad, setFormCiudad] = useState('Caracas');
  const [formEstado, setFormEstado] = useState('Distrito Capital');
  const [formCargo, setFormCargo] = useState('');
  const [formDepartamento, setFormDepartamento] = useState('Operaciones');
  const [formFechaIngreso, setFormFechaIngreso] = useState(new Date().toISOString().split('T')[0]);
  const [formSalario, setFormSalario] = useState('25000');
  const [formBanco, setFormBanco] = useState('Banco de Venezuela');
  const [formNumeroCuenta, setFormNumeroCuenta] = useState('');
  const [formCargas, setFormCargas] = useState('1');

  // Extract unique departments
  const departments = ['todos', ...Array.from(new Set(employees.map((e) => e.departamento)))];

  // Filtered employees
  const filteredEmployees = employees.filter((emp) => {
    const term = searchTerm.toLowerCase();
    const fullName = `${emp.primerNombre} ${emp.primerApellido} ${emp.segundoApellido || ''}`.toLowerCase();
    const matchesSearch =
      fullName.includes(term) ||
      emp.cedula.toLowerCase().includes(term) ||
      emp.cargo.toLowerCase().includes(term) ||
      emp.email.toLowerCase().includes(term);

    const matchesDept = selectedDept === 'todos' || emp.departamento === selectedDept;
    const matchesStatus = selectedStatus === 'todos' || emp.status === selectedStatus;

    return matchesSearch && matchesDept && matchesStatus;
  });

  const handleCreateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCedulaNum || !formPrimerNombre || !formPrimerApellido || !formCargo) {
      alert('Por favor complete los campos obligatorios (Cédula, Nombre, Apellido y Cargo).');
      return;
    }

    const cleanCedula = formCedulaNum.replace(/[^0-9]/g, '');
    const formattedCedula = `${formNac}-${cleanCedula.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
    const formattedRif = formRifNum || `${formNac}-${cleanCedula}-0`;

    const salarioNum = parseFloat(formSalario) || 0;

    const newEmp: Employee = {
      id: `emp-${Date.now()}`,
      cedula: formattedCedula,
      rif: formattedRif,
      nacionalidad: formNac,
      primerNombre: formPrimerNombre.trim(),
      segundoNombre: formSegundoNombre.trim(),
      primerApellido: formPrimerApellido.trim(),
      segundoApellido: formSegundoApellido.trim(),
      fechaNacimiento: '1995-01-01',
      sexo: 'M',
      email: formEmail.trim() || `${formPrimerNombre.toLowerCase()}.${formPrimerApellido.toLowerCase()}@empresa.com.ve`,
      telefono: formTelefono || '+58 (412) 000-0000',
      direccion: formDireccion || 'Caracas, Venezuela',
      ciudad: formCiudad,
      estado: formEstado,
      cargo: formCargo.trim(),
      departamento: formDepartamento,
      fechaIngreso: formFechaIngreso,
      tipoContrato: 'indeterminado',
      status: 'activo',
      numeroAfiliacionIVSS: `IVSS-${cleanCedula}`,
      salarioMensualBase: salarioNum,
      frecuenciaPago: 'quincenal',
      cestaticketMensual: company.montoCestaticketNacional,
      diasUtilidadesAnuales: company.diasUtilidadesEmpresa,
      horasExtrasDiurnasPendientes: 0,
      horasExtrasNocturnasPendientes: 0,
      porcentajeRetencionISLR: 0,
      banco: formBanco,
      numeroCuenta: formNumeroCuenta.padEnd(20, '0'),
      tipoCuenta: 'Corriente',
      cargasFamiliares: parseInt(formCargas) || 0,
      vacacionesDisfrutadas: 0,
      anticiposPrestaciones: [],
      historialLaboral: [
        {
          id: `hist-${Date.now()}`,
          fecha: formFechaIngreso,
          tipo: 'Ingreso',
          titulo: 'Ingreso a la Organización',
          descripcion: 'Contratado formalmente bajo las normativas de la LOTTT.',
          nuevoSalario: salarioNum,
          registradoPor: 'Administrador RRHH',
        },
      ],
    };

    onSaveEmployee(newEmp);
    setIsNewEmployeeModalOpen(false);

    // Reset fields
    setFormCedulaNum('');
    setFormRifNum('');
    setFormPrimerNombre('');
    setFormPrimerApellido('');
    setFormCargo('');
  };

  return (
    <div className="space-y-6">
      {/* Header and Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">
              Expedientes & Gestión de Personal
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Registro formal bajo la LOTTT, cálculo de salario integral, control de cotizantes del IVSS y BANAVIH.
          </p>
        </div>

        <button
          onClick={() => setIsNewEmployeeModalOpen(true)}
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm px-4 py-2.5 rounded-xl shadow-sm transition-all"
        >
          <UserPlus className="w-4 h-4" />
          Registrar Colaborador
        </button>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por cédula, nombre, cargo o correo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-800 placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Building2 className="w-3.5 h-3.5" /> Departamento:
          </div>
          <select
            aria-label="Filtrar por departamento"
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          >
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept === 'todos' ? 'Todos los Departamentos' : dept}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por estatus laboral"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          >
            <option value="todos">Todos los Estatus</option>
            <option value="activo">Activos</option>
            <option value="vacaciones">En Vacaciones</option>
            <option value="reposo">En Reposo IVSS</option>
            <option value="egresado">Egresados</option>
          </select>
        </div>
      </div>

      {/* Employees Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEmployees.map((emp) => {
          const tenure = calculateTenure(emp.fechaIngreso);
          const integral = calculateIntegralSalary(
            emp.salarioMensualBase,
            tenure.anios,
            emp.diasUtilidadesAnuales || company.diasUtilidadesEmpresa
          );

          return (
            <div
              key={emp.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                {/* Card Top: Status & Document */}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    {emp.cedula}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      emp.status === 'activo'
                        ? 'bg-emerald-100 text-emerald-800'
                        : emp.status === 'vacaciones'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {emp.status}
                  </span>
                </div>

                {/* Name and Role */}
                <div className="mt-3">
                  <h3 className="font-bold text-slate-900 text-base">
                    {emp.primerNombre} {emp.segundoNombre ? `${emp.segundoNombre.charAt(0)}. ` : ''}{emp.primerApellido}
                  </h3>
                  <p className="text-xs text-sky-700 font-medium">{emp.cargo}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                    <Briefcase className="w-3 h-3 text-slate-400" /> {emp.departamento}
                  </p>
                </div>

                {/* Key Legal Stats */}
                <div className="mt-4 p-3 bg-slate-50/80 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" /> Antigüedad LOTTT:
                    </span>
                    <span className="font-semibold text-slate-800">
                      {tenure.anios}a {tenure.meses}m {tenure.dias}d
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-slate-400" /> Salario Mensual Base:
                    </span>
                    <span className="font-bold text-slate-900">
                      {formatBs(emp.salarioMensualBase)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] border-t border-slate-200/60 pt-1.5">
                    <span className="text-slate-500">Salario Integral (Art. 122):</span>
                    <span className="font-medium text-emerald-700">
                      {formatBs(integral.salarioIntegralMensual)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => onGenerateCertificate(emp)}
                  title="Emitir Constancia de Trabajo"
                  className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-sky-700 font-medium px-2.5 py-1.5 rounded-lg hover:bg-sky-50 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-600" /> Constancia
                </button>

                <button
                  onClick={() => onOpenDetail(emp)}
                  className="flex items-center gap-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-white font-semibold px-3 py-1.5 rounded-lg shadow-xs transition-all active:scale-95"
                >
                  <Eye className="w-3.5 h-3.5" /> Ver Expediente
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Registrar Nuevo Colaborador */}
      {isNewEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-sky-600" />
                <h2 className="text-lg font-bold text-slate-900">
                  Registrar Colaborador (Normativa LOTTT / IVSS)
                </h2>
              </div>
              <button
                onClick={() => setIsNewEmployeeModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="space-y-4 text-xs">
              {/* Cédula y RIF */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Nacionalidad</label>
                  <select
                    value={formNac}
                    onChange={(e) => setFormNac(e.target.value as 'V' | 'E')}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="V">Venezolano (V)</option>
                    <option value="E">Extranjero (E)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Cédula de Identidad *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 18452910"
                    value={formCedulaNum}
                    onChange={(e) => setFormCedulaNum(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">R.I.F. Personal</label>
                  <input
                    type="text"
                    placeholder="Ej. V-18452910-3"
                    value={formRifNum}
                    onChange={(e) => setFormRifNum(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              {/* Nombres y Apellidos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Primer Nombre *</label>
                  <input
                    type="text"
                    required
                    value={formPrimerNombre}
                    onChange={(e) => setFormPrimerNombre(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Segundo Nombre</label>
                  <input
                    type="text"
                    value={formSegundoNombre}
                    onChange={(e) => setFormSegundoNombre(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Primer Apellido *</label>
                  <input
                    type="text"
                    required
                    value={formPrimerApellido}
                    onChange={(e) => setFormPrimerApellido(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Segundo Apellido</label>
                  <input
                    type="text"
                    value={formSegundoApellido}
                    onChange={(e) => setFormSegundoApellido(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              {/* Cargo, Departamento y Fecha Ingreso */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Cargo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Analista Contable"
                    value={formCargo}
                    onChange={(e) => setFormCargo(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Departamento</label>
                  <select
                    value={formDepartamento}
                    onChange={(e) => setFormDepartamento(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="Operaciones">Operaciones</option>
                    <option value="Tecnología">Tecnología</option>
                    <option value="Finanzas">Finanzas</option>
                    <option value="Talento Humano">Talento Humano</option>
                    <option value="Seguridad & Salud Laboral">Seguridad & Salud Laboral</option>
                    <option value="Ventas & Mercadeo">Ventas & Mercadeo</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Fecha de Ingreso *</label>
                  <input
                    type="date"
                    required
                    value={formFechaIngreso}
                    onChange={(e) => setFormFechaIngreso(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              {/* Salario y Beneficios */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-sky-50/50 rounded-xl border border-sky-100">
                <div>
                  <label className="block font-medium text-slate-800 mb-1">
                    Salario Mensual Base (Bs.) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formSalario}
                    onChange={(e) => setFormSalario(e.target.value)}
                    className="w-full p-2 bg-white border border-sky-200 rounded-lg font-semibold text-slate-900"
                  />
                  <span className="text-[10px] text-sky-700 mt-1 block">
                    Equivalente BCV: {formatUSD(parseFloat(formSalario) / company.tasaBCV_USD || 0)}
                  </span>
                </div>

                <div>
                  <label className="block font-medium text-slate-800 mb-1">
                    Cestaticket Socialista (Bs.)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={formatBs(company.montoCestaticketNacional)}
                    className="w-full p-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Beneficio de alimentación legal exento (no salarial).
                  </span>
                </div>
              </div>

              {/* Datos Bancarios y Cargas */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Banco Receptor</label>
                  <select
                    value={formBanco}
                    onChange={(e) => setFormBanco(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="Banco de Venezuela">Banco de Venezuela (0102)</option>
                    <option value="Banco Mercantil">Banco Mercantil (0105)</option>
                    <option value="Banco Provincial">Banco Provincial (0108)</option>
                    <option value="Banesco Banco Universal">Banesco Banco Universal (0134)</option>
                    <option value="Bancaribe">Bancaribe (0114)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Número de Cuenta (20 dígitos)</label>
                  <input
                    type="text"
                    maxLength={20}
                    placeholder="01020000000000000000"
                    value={formNumeroCuenta}
                    onChange={(e) => setFormNumeroCuenta(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Cargas Familiares</label>
                  <input
                    type="number"
                    min="0"
                    value={formCargas}
                    onChange={(e) => setFormCargas(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewEmployeeModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white rounded-lg shadow-sm"
                >
                  <Check className="w-4 h-4" /> Guardar y Afiliar al IVSS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
