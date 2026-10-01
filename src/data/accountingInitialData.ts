import {
  AccountingAccount,
  AccountingPeriod,
  AccountingAccountType,
} from '../types';

export const initialAccountingAccounts: AccountingAccount[] = [
  { id: '1', code: '1', name: 'ACTIVO', type: 'activo', isGroup: true, active: true },
  { id: '1.1', code: '1.1', name: 'Activo circulante', type: 'activo', parentCode: '1', isGroup: true, active: true },
  { id: '1.1.01', code: '1.1.01', name: 'Caja y bancos', type: 'activo', parentCode: '1.1', isGroup: false, active: true },
  { id: '1.1.02', code: '1.1.02', name: 'Cuentas por cobrar', type: 'activo', parentCode: '1.1', isGroup: false, active: true },
  { id: '1.1.03', code: '1.1.03', name: 'Inventarios', type: 'activo', parentCode: '1.1', isGroup: false, active: true },
  { id: '1.2', code: '1.2', name: 'Propiedad, planta y equipo', type: 'activo', parentCode: '1', isGroup: true, active: true },
  { id: '1.2.01', code: '1.2.01', name: 'Propiedad, planta y equipo', type: 'activo', parentCode: '1.2', isGroup: false, active: true },
  { id: '2', code: '2', name: 'PASIVO', type: 'pasivo', isGroup: true, active: true },
  { id: '2.1', code: '2.1', name: 'Pasivo circulante', type: 'pasivo', parentCode: '2', isGroup: true, active: true },
  { id: '2.1.01', code: '2.1.01', name: 'Cuentas por pagar', type: 'pasivo', parentCode: '2.1', isGroup: false, active: true },
  { id: '2.1.02', code: '2.1.02', name: 'Impuestos y retenciones por pagar', type: 'pasivo', parentCode: '2.1', isGroup: false, active: true },
  { id: '3', code: '3', name: 'PATRIMONIO', type: 'patrimonio', isGroup: true, active: true },
  { id: '3.1.01', code: '3.1.01', name: 'Capital social', type: 'patrimonio', parentCode: '3', isGroup: false, active: true },
  { id: '3.2.01', code: '3.2.01', name: 'Resultados acumulados', type: 'patrimonio', parentCode: '3', isGroup: false, active: true },
  { id: '4', code: '4', name: 'INGRESOS', type: 'ingreso', isGroup: true, active: true },
  { id: '4.1.01', code: '4.1.01', name: 'Ingresos por ventas y servicios', type: 'ingreso', parentCode: '4', isGroup: false, active: true },
  { id: '5', code: '5', name: 'GASTOS', type: 'gasto', isGroup: true, active: true },
  { id: '5.1.01', code: '5.1.01', name: 'Costo de ventas', type: 'gasto', parentCode: '5', isGroup: false, active: true },
  { id: '5.2.01', code: '5.2.01', name: 'Gastos de administración', type: 'gasto', parentCode: '5', isGroup: false, active: true },
];

const monthNames = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function createAccountingPeriods(year: number): AccountingPeriod[] {
  return monthNames.map((name, index) => {
    const month = String(index + 1).padStart(2, '0');
    const lastDay = new Date(year, index + 1, 0).getDate();

    return {
      id: `${year}-${month}`,
      name: `${name} ${year}`,
      startDate: `${year}-${month}-01`,
      endDate: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
      status: 'open',
    };
  });
}

export const accountingAccountTypes: {
  value: AccountingAccountType;
  label: string;
}[] = [
  { value: 'activo', label: 'Activo' },
  { value: 'pasivo', label: 'Pasivo' },
  { value: 'patrimonio', label: 'Patrimonio' },
  { value: 'ingreso', label: 'Ingreso' },
  { value: 'gasto', label: 'Gasto' },
];
