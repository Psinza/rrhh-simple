import {
  CompanySettings,
  Employee,
  LegalNotification,
  AuditLog,
  PayrollPeriod,
} from '../types';
import { calculatePayrollDeductionsAndContributions } from '../utils/venezuelaLaborCalculations';

export const initialCompanySettings: CompanySettings = {
  razonSocial: 'INDUSTRIAS COUTURE 2618 C.A.',
  rif: 'J-40964466-9',
  numeroPatronalIVSS: 'D84910293',
  codigoAportanteFAOV: 'FAOV-304910',
  codigoInces: 'INC-2025-7819',
  direccionFiscal: 'CALLE CALLE PRINCIPAL, COMANDO 302, GRUPO CABALLERIA MOTORIZADA GENERAL DE BRIGADA JUAN PABLO AYALA , LOCAL COMPLEJO TIUNA. URB. FUERTE TIUNA  ZONA POSTAL 1010 ',
  ciudad: 'Caracas',
  estado: 'Miranda',
  telefono: '+58 (0412) 285-6530',
  email: 'INDUSTRIACOUTURE@GMAIL.COM',
  representanteLegal: 'JACOB AGAI BENZAQUEN',
  cedulaRepresentante: 'V-15.488.701',
  cargoRepresentante: 'Directora General de Talento Humano',

  // Parámetros Laborales Venezolanos
  nivelRiesgoIVSS: 10, // 10% Riesgo Medio
  salarioMinimoNacional: 130.00, // Salario mínimo de ley para topes
  montoCestaticketNacional: 1820.00, // Beneficio de alimentación indexado (~$40)
  tasaBCV_USD: 45.50, // Tasa de cambio oficial BCV (Bs. / USD)
  tasaInteresPrestacionesBCV: 53.20, // % anual Tasa Activa BCV para cálculo de intereses de prestaciones
  lunesDelMesActual: 4,
  diasUtilidadesEmpresa: 45, // La empresa otorga 45 días de utilidades (superior a los 30 mínimos LOTTT)
};

export const initialEmployees: Employee[] = [];

export const initialLegalNotifications: LegalNotification[] = [
  {
    id: 'notif-1',
    fecha: '2026-08-28',
    tipo: 'Tasa BCV',
    titulo: 'Publicación Tasa Activa BCV para Prestaciones Sociales',
    descripcion:
      'El Banco Central de Venezuela (BCV) fijó la tasa promedio activa en 53.20% anual para el cálculo de los intereses sobre prestaciones sociales (Art. 143 LOTTT) correspondiente al cierre mensual.',
    urgencia: 'alta',
    enlaceReferencia: 'http://www.bcv.org.ve/tasas-de-interes/prestaciones-sociales',
    leida: false,
  },
  {
    id: 'notif-2',
    fecha: '2026-08-20',
    tipo: 'Obligación Parafiscal',
    titulo: 'Vencimiento Declaración y Pago FAOV / BANAVIH',
    descripcion:
      'Recordatorio: Dentro de los primeros 5 días hábiles del mes de septiembre vence el plazo legal para la declaración y pago del 1% retención trabajador y 2% aporte patronal en el portal BANAVIH.',
    urgencia: 'alta',
    enlaceReferencia: 'https://faov.banavih.gob.ve',
    leida: false,
  },
  {
    id: 'notif-3',
    fecha: '2026-08-15',
    tipo: 'Gaceta Oficial',
    titulo: 'Monitoreo de Beneficio de Cestaticket Socialista',
    descripcion:
      'Verificación de indexación del beneficio de alimentación de los trabajadores de conformidad con el Decreto Presidencial de Ley del Cestaticket Socialista. Saldo actualizado en nómina a Bs. 1.820,00.',
    urgencia: 'media',
    enlaceReferencia: 'Gaceta Oficial Extraordinaria N° 6.746',
    leida: true,
  },
  {
    id: 'notif-4',
    fecha: '2026-08-01',
    tipo: 'Derecho Vacacional',
    titulo: 'Cumplimiento de Años de Servicio - Días Adicionales',
    descripcion:
      'Colaboradores acumulados para nuevo período de servicio, acreditándose días adicionales de bono vacacional y antigüedad según Arts. 142 y 190 de la LOTTT.',
    urgencia: 'informativa',
    leida: false,
  },
];

export const initialAuditLogs: AuditLog[] = [
  {
    id: 'log-1',
    timestamp: '2026-09-02 08:30:12',
    usuario: 'Lic. Dubraska',
    rol: 'Administrador RRHH',
    accion: 'Inicio de Sesión y Autenticación MFA',
    modulo: 'Seguridad',
    detalles: 'Acceso seguro con token TOTP y verificación criptográfica de dispositivo.',
    ip: '190.202.88.14',
    cifrado: true,
  },
  {
    id: 'log-2',
    timestamp: '2026-09-02 09:15:40',
    usuario: 'Lic. Dubraska',
    rol: 'Administrador RRHH',
    accion: 'Cálculo y Validación de Nómina 2da Quincena Agosto',
    modulo: 'Nómina',
    detalles: 'Generación automática de deducciones IVSS, Paro Forzoso y FAOV.',
    ip: '190.202.88.14',
    cifrado: true,
  },
  {
    id: 'log-3',
    timestamp: '2026-09-02 10:05:22',
    usuario: 'Lic. Dubraska',
    rol: 'Administrador RRHH',
    accion: 'Exportación de Archivo Carga Masiva BANAVIH',
    modulo: 'Archivos Gubernamentales',
    detalles: 'Generación de archivo CSV para portal FAOV con cotizantes validados.',
    ip: '190.202.88.19',
    cifrado: true,
  },
];

/**
 * Genera un período de nómina inicial precalculado
 */
export function buildInitialPayrollPeriod(company: CompanySettings, employees: Employee[]): PayrollPeriod {
  const items = employees.map((emp) => {
    const calc = calculatePayrollDeductionsAndContributions(
      emp,
      company,
      'quincenal',
      emp.horasExtrasDiurnasPendientes,
      emp.horasExtrasNocturnasPendientes,
      0
    );

    return {
      id: `slip-${emp.id}-ago2026-q2`,
      employeeId: emp.id,
      employee: emp,
      ...calc,
      fechaGeneracion: '2026-08-30',
      firmadoDigitalmente: true,
      firmaFecha: '2026-08-30 17:00:00',
      hashCriptografico: `SHA256-${emp.cedula.replace(/[^0-9]/g, '')}-20260830-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    };
  });

  const totalNominaBs = items.reduce((sum, item) => sum + item.totalAsignacionesSalariales, 0);
  const totalCestaticketBs = items.reduce((sum, item) => sum + item.cestaticketPeriodo, 0);
  const totalAportesPatronalesBs = items.reduce((sum, item) => sum + item.totalAportesPatronales, 0);
  const totalCostoEmpresaBs = totalNominaBs + totalCestaticketBs + totalAportesPatronalesBs;

  return {
    id: 'period-2026-08-q2',
    nombre: '2da Quincena de Agosto 2026',
    tipo: '1ra Quincena',
    mes: 'Agosto',
    anio: 2026,
    fechaInicio: '2026-08-16',
    fechaFin: '2026-08-31',
    fechaPago: '2026-08-30',
    estatus: 'Aprobada',
    items,
    totalNominaBs,
    totalCestaticketBs,
    totalAportesPatronalesBs,
    totalCostoEmpresaBs,
  };
}
