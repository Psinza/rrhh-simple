import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPayrollAdjustmentMaps } from '../src/utils/payrollAdjustments';
import { calculatePayrollDeductionsAndContributions } from '../src/utils/venezuelaLaborCalculations';
import type { Employee, EmployeeLoan, ProductAssignment, ProductPurchase, SalesRecord } from '../src/types';

const employee = {
  id: 'emp-1',
  cedula: 'V-12345678',
  rif: 'J-12345678-1',
  nacionalidad: 'V',
  primerNombre: 'Ana',
  segundoNombre: '',
  primerApellido: 'Perez',
  segundoApellido: '',
  fechaNacimiento: '1990-01-01',
  sexo: 'F',
  email: 'ana@example.com',
  telefono: '04120000000',
  direccion: 'Caracas',
  ciudad: 'Caracas',
  estado: 'Miranda',
  cargo: 'Vendedora',
  departamento: 'Ventas',
  fechaIngreso: '2020-01-01',
  tipoContrato: 'indeterminado',
  status: 'activo',
  numeroAfiliacionIVSS: '12345678',
  salarioMensualBase: 4000,
  salarioMoneda: 'BS',
  frecuenciaPago: 'semanal',
  cestaticketMensual: 0,
  cestaticketMoneda: 'BS',
  cestaticketAplica: false,
  diasUtilidadesAnuales: 30,
  horasExtrasDiurnasPendientes: 0,
  horasExtrasNocturnasPendientes: 0,
  porcentajeRetencionISLR: 0,
  banco: 'Mercantil',
  numeroCuenta: '01080100000000000000',
  tipoCuenta: 'Corriente',
  historialLaboral: [],
  anticiposPrestaciones: [],
  vacacionesDisfrutadas: 0,
  viaticosPendientes: 50,
  viaticosPendientesOriginal: 50,
  viaticosMoneda: 'BS',
  cargasFamiliares: 0,
} as Employee;

const company = {
  razonSocial: 'Demo',
  rif: 'J-30987654-1',
  numeroPatronalIVSS: '12345678',
  codigoAportanteFAOV: 'FAOV-1',
  codigoInces: 'INCES-1',
  direccionFiscal: 'Caracas',
  ciudad: 'Caracas',
  estado: 'Miranda',
  telefono: '02120000000',
  email: 'demo@example.com',
  representanteLegal: 'Rep',
  cedulaRepresentante: 'V-12345678',
  cargoRepresentante: 'Gerente',
  nivelRiesgoIVSS: 10,
  salarioMinimoNacional: 130000,
  montoCestaticketNacional: 0,
  tasaBCV_USD: 1,
  tasaInteresPrestacionesBCV: 0,
  lunesDelMesActual: 4,
  diasUtilidadesEmpresa: 30,
} as const;

test('aplica los conceptos vigentes del período al recibo y calcula el neto correcto', () => {
  const sales = [
    { id: 'sale-pending', vendedorId: 'emp-1', comisionBs: 100, estatus: 'Pendiente' },
    { id: 'sale-paid', vendedorId: 'emp-1', comisionBs: 900, estatus: 'Liquidada' },
  ] as SalesRecord[];
  const assignments = [
    { employeeId: 'emp-1', amountBs: 400, month: '2026-09', status: 'Asignado' },
    { employeeId: 'emp-1', amountBs: 200, month: '2026-08', status: 'Asignado' },
  ] as ProductAssignment[];
  const purchases = [
    { employeeId: 'emp-1', amountBs: 30, purchaseDate: '2026-09-03' },
    { employeeId: 'emp-1', amountBs: 200, purchaseDate: '2026-08-31' },
  ] as ProductPurchase[];
  const loans = [
    { employeeId: 'emp-1', installmentBs: 25, status: 'Activo' },
    { employeeId: 'emp-1', installmentBs: 500, status: 'Cancelado' },
  ] as EmployeeLoan[];

  const adjustments = buildPayrollAdjustmentMaps(
    { fechaInicio: '2026-09-01', fechaFin: '2026-09-07' },
    sales,
    assignments,
    purchases,
    loans
  );
  const weeklyAssignmentDeduction = adjustments.assignmentMonthlyByEmployee[employee.id] / 4;
  const result = calculatePayrollDeductionsAndContributions(
    employee,
    company,
    'semanal',
    0,
    0,
    0,
    employee.viaticosPendientes,
    adjustments.loanInstallmentByEmployee[employee.id],
    adjustments.purchaseDeductionByEmployee[employee.id] + weeklyAssignmentDeduction,
    false,
    0,
    adjustments.commissionByEmployee[employee.id]
  );

  assert.equal(result.sueldoBasePeriodo, 1000);
  assert.equal(result.comisionesVentas, 100);
  assert.deepEqual(adjustments.commissionSaleIdsByEmployee[employee.id], ['sale-pending']);
  assert.equal(result.viaticos, 50);
  assert.equal(result.deduccionesProductos, 130);
  assert.equal(result.prestamosAnticipos, 25);
  assert.equal(result.totalAsignaciones, 1150);
  assert.equal(result.totalDeducciones, 155);
  assert.equal(result.netoCobrarBs, 995);
});