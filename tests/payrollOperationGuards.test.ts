import test from 'node:test';
import assert from 'node:assert/strict';
import { Employee, PayrollItem, PayrollPeriod } from '../src/types';
import { buildInitialPayrollPeriod, initialCompanySettings } from '../src/data/initialData';
import { getPayrollApprovalBlockReason } from '../src/utils/payrollOperationGuards';

const employee: Employee = {
  id: 'employee-1',
  cedula: 'V-1',
  rif: 'V-1-1',
  nacionalidad: 'V',
  primerNombre: 'Empleado',
  segundoNombre: '',
  primerApellido: 'Prueba',
  segundoApellido: '',
  fechaNacimiento: '1990-01-01',
  sexo: 'M',
  email: '',
  telefono: '',
  direccion: '',
  ciudad: '',
  estado: '',
  cargo: 'Analista',
  departamento: 'Administración',
  fechaIngreso: '2020-01-01',
  tipoContrato: 'indeterminado',
  status: 'activo',
  numeroAfiliacionIVSS: '',
  salarioMensualBase: 1000,
  salarioMoneda: 'USD',
  salarioMensualBaseOriginal: 100,
  frecuenciaPago: 'quincenal',
  cestaticketMensual: 0,
  diasUtilidadesAnuales: 30,
  horasExtrasDiurnasPendientes: 0,
  horasExtrasNocturnasPendientes: 0,
  porcentajeRetencionISLR: 0,
  banco: '',
  numeroCuenta: '',
  tipoCuenta: 'Corriente',
  historialLaboral: [],
  anticiposPrestaciones: [],
  vacacionesDisfrutadas: 0,
  cargasFamiliares: 0,
};

const payrollItem: PayrollItem = {
  id: 'slip-1',
  employeeId: employee.id,
  employee,
  diasTrabajados: 15,
  horasExtrasDiurnas: 0,
  horasExtrasNocturnas: 0,
  sueldoBasePeriodo: 1000,
  cestaticketPeriodo: 0,
  montoHorasExtrasDiurnas: 0,
  montoHorasExtrasNocturnas: 0,
  viaticos: 0,
  feriadosTrabajados: 0,
  bonoProductividad: 0,
  comisionesVentas: 0,
  deduccionesProductos: 0,
  totalAsignacionesSalariales: 1000,
  totalAsignacionesNoSalariales: 0,
  totalAsignaciones: 1000,
  retencionIVSS: 0,
  retencionParoForzoso: 0,
  retencionFAOV: 0,
  retencionISLR: 0,
  prestamosAnticipos: 0,
  otrasDeducciones: 0,
  totalDeducciones: 0,
  netoCobrarBs: 1000,
  netoCobrarUSD: 100,
  aportePatronalIVSS: 0,
  aportePatronalRPE: 0,
  aportePatronalFAOV: 0,
  aportePatronalINCES: 0,
  totalAportesPatronales: 0,
  fechaGeneracion: '2026-09-30',
  firmadoDigitalmente: false,
  hashCriptografico: 'test',
};

function payroll(overrides: Partial<PayrollPeriod> = {}): PayrollPeriod {
  return {
    ...buildInitialPayrollPeriod(initialCompanySettings, []),
    id: 'period-2026-09-q2',
    nombre: '2da Quincena de Septiembre 2026',
    tipo: '2da Quincena',
    mes: 'Septiembre',
    anio: 2026,
    fechaInicio: '2026-09-16',
    fechaFin: '2026-09-30',
    fechaPago: '2026-09-30',
    tasaBCV_USD: 857.57,
    estatus: 'Calculada',
    items: [payrollItem],
    archivoBancarioConfirmado: false,
    ...overrides,
  };
}

test('solo permite aprobar una nómina calculada con tasa válida antes de confirmar TXT', () => {
  assert.equal(getPayrollApprovalBlockReason(payroll()), null);
});

test('bloquea aprobación de nómina sin recalcular', () => {
  assert.match(
    getPayrollApprovalBlockReason(payroll({ estatus: 'Borrador' })) || '',
    /recalcular y revisar/,
  );
});

test('bloquea aprobación luego de confirmar el archivo bancario', () => {
  assert.match(
    getPayrollApprovalBlockReason(payroll({ archivoBancarioConfirmado: true })) || '',
    /archivo bancario ya fue confirmado/,
  );
});

test('bloquea aprobación sin colaboradores o con tasa inválida', () => {
  assert.match(
    getPayrollApprovalBlockReason(payroll({ items: [] })) || '',
    /sin colaboradores/,
  );
  assert.match(
    getPayrollApprovalBlockReason(payroll({ tasaBCV_USD: 0 })) || '',
    /tasa BCV válida/,
  );
});
