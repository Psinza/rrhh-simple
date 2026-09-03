export type ContractType = 'indeterminado' | 'determinado' | 'obra';
export type EmployeeStatus = 'activo' | 'vacaciones' | 'reposo' | 'egresado';
export type IvssRiskLevel = 9 | 10 | 11; // 9% Mínimo, 10% Medio, 11% Máximo
export type PayrollFrequency = 'quincenal' | 'mensual';

export interface WorkHistoryEvent {
  id: string;
  fecha: string;
  tipo: 'Ingreso' | 'Aumento Salarial' | 'Ascenso' | 'Vacaciones' | 'Amonestación' | 'Evaluación' | 'Cambio Departamento';
  titulo: string;
  descripcion: string;
  salarioAnterior?: number;
  nuevoSalario?: number;
  registradoPor: string;
}

export interface SocialBenefitsAdvance {
  id: string;
  fecha: string;
  monto: number;
  motivo: 'Adquisición de Vivienda' | 'Liberación de Hipoteca' | 'Educación' | 'Gastos Médicos y Hospitalarios';
  porcentajeDelFondo: number;
  aprobadoPor: string;
}

export interface MonthlyInterestRecord {
  mes: string;
  anio: number;
  salarioIntegralMensual: number;
  capitalAcumulado: number;
  tasaActivaBCV: number; // e.g. 52.8 anual
  interesGenerado: number;
  pagadoO_Abonado: 'Abonado a Fideicomiso' | 'Pagado Directamente';
}

export interface Employee {
  id: string;
  cedula: string; // e.g. V-18.452.910
  rif: string; // e.g. V-18452910-3
  nacionalidad: 'V' | 'E';
  primerNombre: string;
  segundoNombre: string;
  primerApellido: string;
  segundoApellido: string;
  fechaNacimiento: string;
  sexo: 'M' | 'F';
  email: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  estado: string;

  // Datos Laborales
  cargo: string;
  departamento: string;
  fechaIngreso: string;
  fechaEgreso?: string;
  tipoContrato: ContractType;
  status: EmployeeStatus;
  numeroAfiliacionIVSS: string;

  // Salarios y Beneficios LOTTT
  salarioMensualBase: number; // En Bolívares (Bs.)
  frecuenciaPago: PayrollFrequency;
  cestaticketMensual: number; // En Bolívares (No salarial)
  diasUtilidadesAnuales: number; // Mínimo 30 días, máximo 120 días (Art. 131 LOTTT)
  horasExtrasDiurnasPendientes: number;
  horasExtrasNocturnasPendientes: number;
  porcentajeRetencionISLR: number; // Forma AR-I (0% a 34%)

  // Datos Bancarios
  banco: string;
  numeroCuenta: string; // 20 dígitos estándar venezolano
  tipoCuenta: 'Corriente' | 'Ahorro';

  // Historial e Informes
  historialLaboral: WorkHistoryEvent[];
  anticiposPrestaciones: SocialBenefitsAdvance[];
  vacacionesDisfrutadas: number; // Días ya tomados

  // Cargas Familiares
  cargasFamiliares: number;
}

export interface CompanySettings {
  razonSocial: string;
  rif: string; // J-30987654-1
  numeroPatronalIVSS: string; // 9 dígitos e.g. D82739102
  codigoAportanteFAOV: string;
  codigoInces: string;
  direccionFiscal: string;
  ciudad: string;
  estado: string;
  telefono: string;
  email: string;
  representanteLegal: string;
  cedulaRepresentante: string;
  cargoRepresentante: string;
  logoUrl?: string; // URL o DataURL (base64) del logo corporativo de la empresa

  // Parámetros Laborales Venezolanos
  nivelRiesgoIVSS: IvssRiskLevel; // 9, 10 o 11%
  salarioMinimoNacional: number; // Bs. (Decreto Oficial)
  montoCestaticketNacional: number; // Bs. (Decreto Oficial)
  tasaBCV_USD: number; // Tasa oficial del Banco Central de Venezuela
  tasaInteresPrestacionesBCV: number; // % anual activa BCV
  lunesDelMesActual: number; // 4 o 5 lunes
  diasUtilidadesEmpresa: number; // Mínimo legal 30 días
}

export interface PayrollItem {
  id: string;
  employeeId: string;
  employee: Employee;

  // Días y Horas
  diasTrabajados: number;
  horasExtrasDiurnas: number;
  horasExtrasNocturnas: number;

  // Asignaciones (Bs.)
  sueldoBasePeriodo: number;
  cestaticketPeriodo: number; // Beneficio de alimentación exento
  montoHorasExtrasDiurnas: number;
  montoHorasExtrasNocturnas: number;
  feriadosTrabajados: number;
  bonoProductividad: number;
  totalAsignacionesSalariales: number;
  totalAsignacionesNoSalariales: number;
  totalAsignaciones: number;

  // Deducciones (Bs.)
  retencionIVSS: number; // 4%
  retencionParoForzoso: number; // 0.5% (RPE)
  retencionFAOV: number; // 1%
  retencionISLR: number; // AR-I
  prestamosAnticipos: number;
  otrasDeducciones: number;
  totalDeducciones: number;

  // Neto a Cobrar
  netoCobrarBs: number;
  netoCobrarUSD: number; // A tasa oficial BCV

  // Aportes Patronales Informativos (Costo Seguridad Social)
  aportePatronalIVSS: number; // 9%, 10% u 11%
  aportePatronalRPE: number; // 2%
  aportePatronalFAOV: number; // 2%
  aportePatronalINCES: number; // 2%
  totalAportesPatronales: number;

  // Metadatos y Firma Digital
  fechaGeneracion: string;
  firmadoDigitalmente: boolean;
  firmaFecha?: string;
  hashCriptografico: string;
}

export interface PayrollPeriod {
  id: string;
  nombre: string;
  tipo: '1ra Quincena' | '2da Quincena' | 'Mensual';
  mes: string;
  anio: number;
  fechaInicio: string;
  fechaFin: string;
  fechaPago: string;
  estatus: 'Borrador' | 'Calculada' | 'Aprobada' | 'Pagada';
  items: PayrollItem[];
  totalNominaBs: number;
  totalCestaticketBs: number;
  totalAportesPatronalesBs: number;
  totalCostoEmpresaBs: number;
}

export interface SocialBenefitsReport {
  antiguedadAnios: number;
  antiguedadMeses: number;
  antiguedadDias: number;
  salarioDiarioNormal: number;
  alicuotaBonoVacacional: number;
  alicuotaUtilidades: number;
  salarioDiarioIntegral: number;
  salarioIntegralMensual: number;

  // Garantía Art. 142 LOTTT
  diasGarantiaAcumulados: number; // 15 días por trimestre
  diasAdicionalesAntiguedad: number; // 2 días por año acumulativo
  totalDiasGarantia: number;
  montoGarantiaTotal: number;

  // Intereses Art. 143 LOTTT
  interesesAcumulados: number;
  historialIntereses: MonthlyInterestRecord[];

  // Anticipos Art. 144
  totalAnticiposConcedidos: number;
  limiteMaximoAnticipo75: number;
  disponibleParaAnticipo: number;

  // Liquidación Art. 142 literal c (comparativa de finiquito retroactivo)
  montoRetroactivoArt142c: number;
  montoMayorAPagar: number;
  saldoNetoActual: number;
}

export interface GovernmentExportFile {
  tipo: 'IVSS_TIUNA_1402' | 'IVSS_TIUNA_SALARIO' | 'BANAVIH_FAOV' | 'INCES_TRIMESTRAL';
  nombreArchivo: string;
  descripcion: string;
  enteRegulador: string;
  contenido: string;
  formato: 'TXT' | 'CSV';
  totalRegistros: number;
  montoTotalBs?: number;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  usuario: string;
  rol: 'Administrador RRHH' | 'Especialista de Nómina' | 'Auditor Legal';
  accion: string;
  modulo: 'Nómina' | 'Expedientes' | 'Prestaciones' | 'Archivos Gubernamentales' | 'Seguridad' | 'Configuración';
  detalles: string;
  ip: string;
  cifrado: boolean;
}

export interface LegalNotification {
  id: string;
  fecha: string;
  tipo: 'Gaceta Oficial' | 'Tasa BCV' | 'Obligación Parafiscal' | 'Vencimiento Contrato' | 'Derecho Vacacional';
  titulo: string;
  descripcion: string;
  urgencia: 'alta' | 'media' | 'informativa';
  enlaceReferencia?: string;
  leida: boolean;
}

export type AppUserRole = 'admin_sistema' | 'rrhh' | 'dueno';

export interface AppUser {
  id: string;
  username: string;
  email: string;
  password: string;
  nombre: string;
  cargo: string;
  telefono?: string;
  rol: AppUserRole;
  rolTitulo: string;
  avatar: string;
  badgeColor: string;
  nivelAcceso: string;
  descripcionAcceso: string;
  permisos: string[];
}
