import test from 'node:test';
import assert from 'node:assert/strict';
import { Employee } from '../src/types';
import {
  getUnjustifiedAbsenceDeduction,
  getUnjustifiedAbsencesOutsidePeriod,
} from '../src/utils/employeeAttendance';

function employeeWithEvents(events: NonNullable<Employee['novedadesLaborales']>): Employee {
  return {
    id: 'employee-1',
    cedula: 'V-12345678',
    rif: 'J-12345678-1',
    nacionalidad: 'V',
    primerNombre: 'Ana',
    segundoNombre: '',
    primerApellido: 'Garcia',
    segundoApellido: 'Perez',
    fechaNacimiento: '1990-01-01',
    sexo: 'F',
    email: 'ana@example.com',
    telefono: '04121234567',
    direccion: 'Calle 1',
    ciudad: 'Caracas',
    estado: 'Miranda',
    cargo: 'Analista',
    departamento: 'RRHH',
    fechaIngreso: '2023-01-01',
    tipoContrato: 'indeterminado',
    status: 'activo',
    numeroAfiliacionIVSS: '12345678',
    salarioMensualBase: 400,
    salarioMoneda: 'USD',
    salarioMensualBaseOriginal: 400,
    frecuenciaPago: 'quincenal',
    cestaticketMensual: 0,
    cestaticketMoneda: 'BS',
    diasUtilidadesAnuales: 30,
    horasExtrasDiurnasPendientes: 0,
    horasExtrasNocturnasPendientes: 0,
    porcentajeRetencionISLR: 0,
    banco: 'Mercantil',
    numeroCuenta: '01080100000000000000',
    tipoCuenta: 'Corriente',
    historialLaboral: [],
    novedadesLaborales: events,
    anticiposPrestaciones: [],
    vacacionesDisfrutadas: 0,
    cargasFamiliares: 0,
  };
}

function event(
  id: string,
  tipo: NonNullable<Employee['novedadesLaborales']>[number]['tipo'],
  fechaInicio: string,
  dias = 1,
): NonNullable<Employee['novedadesLaborales']>[number] {
  return {
    id,
    tipo,
    fechaInicio,
    fechaFin: fechaInicio,
    dias,
    descripcion: '',
    registradoPor: 'RRHH',
    fechaRegistro: '2026-08-20',
  };
}

test('deduce una vez cada ausencia injustificada del período a la tasa cambiaria de nómina', () => {
  const employee = employeeWithEvents([
    event('absence-1', 'Ausencia injustificada', '2026-08-18'),
    event('duplicate-absence', 'Ausencia injustificada', '2026-08-18'),
    event('sick-leave', 'Reposo médico', '2026-08-19'),
    event('vacation', 'Vacaciones', '2026-08-20'),
    event('outside-period', 'Ausencia injustificada', '2026-09-01'),
  ]);

  const deduction = getUnjustifiedAbsenceDeduction(
    employee,
    '2026-08-16',
    '2026-08-31',
    'quincenal',
    857.57,
  );

  assert.deepEqual(deduction.details.map(({ attendanceEventId }) => attendanceEventId), ['absence-1']);
  assert.equal(deduction.totalBs, 400 * 857.57 / 30);
});

test('limita el descuento de ausencias al sueldo base del período', () => {
  const employee = employeeWithEvents(
    Array.from({ length: 8 }, (_, index) => event(
      `absence-${index + 1}`,
      'Ausencia injustificada',
      `2026-08-${String(index + 1).padStart(2, '0')}`,
    )),
  );

  const deduction = getUnjustifiedAbsenceDeduction(
    employee,
    '2026-08-01',
    '2026-08-08',
    'semanal',
    857.57,
  );

  assert.equal(deduction.totalBs, 400 * 857.57 / 4);
});

test('identifica la ausencia del 28 de septiembre fuera de la nómina de agosto', () => {
  const employee = employeeWithEvents([
    event('erianny-absence', 'Ausencia injustificada', '2026-09-28'),
  ]);
  const erianny = {
    ...employee,
    salarioMensualBase: 340,
    salarioMensualBaseOriginal: 340,
  };

  const absences = getUnjustifiedAbsencesOutsidePeriod(
    [erianny],
    '2026-08-16',
    '2026-08-31',
  );

  assert.deepEqual(absences, [{
    attendanceEventId: 'erianny-absence',
    employeeName: 'Ana Garcia',
    date: '2026-09-28',
  }]);
  assert.deepEqual(
    getUnjustifiedAbsencesOutsidePeriod([erianny], '2026-09-16', '2026-09-30'),
    [],
  );
  const septemberDeduction = getUnjustifiedAbsenceDeduction(
    erianny,
    '2026-09-16',
    '2026-09-30',
    'quincenal',
    857.57,
  );
  assert.equal(septemberDeduction.details[0]?.date, '2026-09-28');
  assert.equal(septemberDeduction.totalBs, 340 * 857.57 / 30);
});

test('rechaza un período de fechas invertido', () => {
  assert.throws(
    () => getUnjustifiedAbsenceDeduction(employeeWithEvents([]), '2026-08-31', '2026-08-16', 'mensual', 857.57),
    /fechas válidas/,
  );
  assert.throws(
    () => getUnjustifiedAbsencesOutsidePeriod([], '2026-08-31', '2026-08-16'),
    /fechas válidas/,
  );
});
