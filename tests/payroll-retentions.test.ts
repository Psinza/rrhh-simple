import test from 'node:test';
import assert from 'node:assert/strict';

import { calculatePayrollDeductionsAndContributions } from '../src/utils/venezuelaLaborCalculations';

const company = {
  razonSocial: 'Demo',
  rif: 'J-30987654-1',
  numeroPatronalIVSS: '12345678',
  codigoAportanteFAOV: 'FAOV-1',
  codigoInces: 'INCES-1',
  direccionFiscal: 'Av. Main',
  ciudad: 'Caracas',
  estado: 'Miranda',
  telefono: '02121234567',
  email: 'demo@test.com',
  representanteLegal: 'Rep',
  cedulaRepresentante: 'V-12345678',
  cargoRepresentante: 'Gerente',
  nivelRiesgoIVSS: 10 as const,
  salarioMinimoNacional: 130000,
  montoCestaticketNacional: 1820,
  tasaBCV_USD: 36,
  tasaInteresPrestacionesBCV: 0,
  lunesDelMesActual: 4,
  diasUtilidadesEmpresa: 30,
};

test('las retenciones gubernamentales se desactivan cuando el empleado no aplica cestaticket', () => {
  const employee = {
    id: 'emp-1',
    cedula: 'V-12345678',
    rif: 'J-12345678-1',
    nacionalidad: 'V' as const,
    primerNombre: 'Ana',
    segundoNombre: '',
    primerApellido: 'Garcia',
    segundoApellido: 'Perez',
    fechaNacimiento: '1990-01-01',
    sexo: 'F' as const,
    email: 'ana@test.com',
    telefono: '04121234567',
    direccion: 'Calle 1',
    ciudad: 'Caracas',
    estado: 'Miranda',
    cargo: 'Analista',
    departamento: 'RRHH',
    fechaIngreso: '2023-01-01',
    tipoContrato: 'indeterminado' as const,
    status: 'activo' as const,
    numeroAfiliacionIVSS: '12345678',
    salarioMensualBase: 1200000,
    salarioMoneda: 'BS' as const,
    frecuenciaPago: 'mensual' as const,
    cestaticketMensual: 0,
    cestaticketMoneda: 'BS' as const,
    cestaticketAplica: false,
    diasUtilidadesAnuales: 30,
    horasExtrasDiurnasPendientes: 0,
    horasExtrasNocturnasPendientes: 0,
    porcentajeRetencionISLR: 0,
    banco: 'Mercantil',
    numeroCuenta: '01080100000000000000',
    tipoCuenta: 'Corriente' as const,
    historialLaboral: [],
    anticiposPrestaciones: [],
    vacacionesDisfrutadas: 0,
    cargasFamiliares: 0,
  };

  const result = calculatePayrollDeductionsAndContributions(employee, company, 'mensual', 0, 0, 0, 0, 0, 0, true);

  assert.equal(result.retencionIVSS, 0);
  assert.equal(result.retencionParoForzoso, 0);
  assert.equal(result.retencionFAOV, 0);
  assert.equal(result.retencionISLR, 0);
  assert.equal(result.totalDeducciones, 0);
});
