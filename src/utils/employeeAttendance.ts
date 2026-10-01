import { Employee } from '../types';
import { getSalaryBaseInBs } from './venezuelaLaborCalculations';

export interface AbsenceDeduction {
  attendanceEventId: string;
  date: string;
  days: number;
  amountBs: number;
}

export interface OutOfPeriodAbsence {
  attendanceEventId: string;
  employeeName: string;
  date: string;
}

export function getUnjustifiedAbsencesOutsidePeriod(
  employees: Employee[],
  periodStart: string,
  periodEnd: string,
): OutOfPeriodAbsence[] {
  if (!periodStart || !periodEnd || periodStart > periodEnd) {
    throw new Error('El período de nómina debe tener fechas válidas.');
  }

  return employees.flatMap((employee) => (employee.novedadesLaborales || [])
    .filter((event) => (
      event.tipo === 'Ausencia injustificada'
      && (event.fechaInicio < periodStart || event.fechaInicio > periodEnd)
    ))
    .map((event) => ({
      attendanceEventId: event.id,
      employeeName: `${employee.primerNombre} ${employee.primerApellido}`.trim(),
      date: event.fechaInicio,
    })));
}

export function getUnjustifiedAbsenceDeduction(
  employee: Employee,
  periodStart: string,
  periodEnd: string,
  frequency: 'semanal' | 'quincenal' | 'mensual',
  exchangeRate: number,
): { totalBs: number; details: AbsenceDeduction[] } {
  if (!periodStart || !periodEnd || periodStart > periodEnd) {
    throw new Error('El período de nómina debe tener fechas válidas.');
  }

  const uniqueDates = new Set<string>();
  const absences = (employee.novedadesLaborales || []).filter((event) => {
    if (
      event.tipo !== 'Ausencia injustificada'
      || event.fechaInicio < periodStart
      || event.fechaInicio > periodEnd
      || uniqueDates.has(event.fechaInicio)
    ) {
      return false;
    }
    uniqueDates.add(event.fechaInicio);
    return true;
  });
  const periodFactor = frequency === 'semanal' ? 1 / 4 : frequency === 'quincenal' ? 1 / 2 : 1;
  const monthlySalary = getSalaryBaseInBs(employee, exchangeRate);
  const periodSalary = monthlySalary * periodFactor;
  let remainingDeduction = periodSalary;
  const dailySalary = monthlySalary / 30;
  const details = absences.map((event) => {
    const amountBs = Math.min(dailySalary * event.dias, remainingDeduction);
    remainingDeduction -= amountBs;
    return {
      attendanceEventId: event.id,
      date: event.fechaInicio,
      days: event.dias,
      amountBs,
    };
  });

  return {
    totalBs: details.reduce((total, detail) => total + detail.amountBs, 0),
    details,
  };
}
