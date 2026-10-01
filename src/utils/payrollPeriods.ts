import { CompanySettings, Employee, PayrollPeriod } from '../types';
import { buildInitialPayrollPeriod } from '../data/initialData';

export type PayrollHalf = 'first' | 'second';

export function createPayrollPeriod(
  company: CompanySettings,
  employees: Employee[],
  year: number,
  month: number,
  half: PayrollHalf,
): PayrollPeriod {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new Error('El año del período de nómina no es válido.');
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('El mes del período de nómina no es válido.');
  }

  const monthIndex = month - 1;
  const startDay = half === 'first' ? 1 : 16;
  const endDay = half === 'first' ? 15 : new Date(Date.UTC(year, month, 0)).getUTCDate();
  const date = (day: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const startDate = date(startDay);
  const endDate = date(endDay);
  const monthName = new Intl.DateTimeFormat('es-VE', { month: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, monthIndex, 1)));
  const ordinal = half === 'first' ? '1ra' : '2da';
  const periodId = `period-${year}-${String(month).padStart(2, '0')}-q${half === 'first' ? 1 : 2}`;
  const initial = buildInitialPayrollPeriod(company, employees);
  const items = initial.items.map((item) => ({
    ...item,
    id: `slip-${item.employeeId}-${periodId}`,
    fechaGeneracion: endDate,
    firmadoDigitalmente: false,
    firmaFecha: undefined,
    hashCriptografico: `payroll-${item.employeeId}-${periodId}`,
  }));

  return {
    ...initial,
    id: periodId,
    nombre: `${ordinal} Quincena de ${monthName.charAt(0).toLocaleUpperCase('es-VE')}${monthName.slice(1)} ${year}`,
    tipo: half === 'first' ? '1ra Quincena' : '2da Quincena',
    mes: monthName.charAt(0).toLocaleUpperCase('es-VE') + monthName.slice(1),
    anio: year,
    fechaInicio: startDate,
    fechaFin: endDate,
    fechaPago: endDate,
    estatus: 'Borrador',
    items,
    totalNominaBs: items.reduce((total, item) => total + item.totalAsignaciones, 0),
    totalCestaticketBs: items.reduce((total, item) => total + item.cestaticketPeriodo, 0),
    totalAportesPatronalesBs: items.reduce((total, item) => total + item.totalAportesPatronales, 0),
    totalCostoEmpresaBs: items.reduce((total, item) => total + item.totalAsignaciones + item.totalAportesPatronales, 0),
    archivoBancarioConfirmado: false,
    archivoBancarioConfirmadoEn: undefined,
  };
}
