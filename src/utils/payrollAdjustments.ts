import type {
  EmployeeLoan,
  PayrollPeriod,
  ProductAssignment,
  ProductPurchase,
  SalesRecord,
} from '../types';

export interface PayrollAdjustmentMaps {
  commissionByEmployee: Record<string, number>;
  commissionSaleIdsByEmployee: Record<string, string[]>;
  assignmentMonthlyByEmployee: Record<string, number>;
  purchaseDeductionByEmployee: Record<string, number>;
  loanInstallmentByEmployee: Record<string, number>;
}

export function buildPayrollAdjustmentMaps(
  payroll: Pick<PayrollPeriod, 'fechaInicio' | 'fechaFin'>,
  sales: SalesRecord[],
  assignments: ProductAssignment[],
  purchases: ProductPurchase[],
  loans: EmployeeLoan[]
): PayrollAdjustmentMaps {
  const commissionByEmployee: Record<string, number> = {};
  const commissionSaleIdsByEmployee: Record<string, string[]> = {};
  const assignmentMonthlyByEmployee: Record<string, number> = {};
  const purchaseDeductionByEmployee: Record<string, number> = {};
  const loanInstallmentByEmployee: Record<string, number> = {};
  const payrollMonth = payroll.fechaInicio.slice(0, 7);

  for (const sale of sales) {
    if (sale.estatus !== 'Pendiente') continue;
    commissionByEmployee[sale.vendedorId] = (commissionByEmployee[sale.vendedorId] || 0) + sale.comisionBs;
    commissionSaleIdsByEmployee[sale.vendedorId] = [
      ...(commissionSaleIdsByEmployee[sale.vendedorId] || []),
      sale.id,
    ];
  }

  for (const assignment of assignments) {
    if (assignment.status !== 'Asignado' || assignment.month !== payrollMonth) continue;
    assignmentMonthlyByEmployee[assignment.employeeId] =
      (assignmentMonthlyByEmployee[assignment.employeeId] || 0) + assignment.amountBs;
  }

  for (const purchase of purchases) {
    if (!purchase.employeeId || purchase.purchaseDate < payroll.fechaInicio || purchase.purchaseDate > payroll.fechaFin) continue;
    purchaseDeductionByEmployee[purchase.employeeId] =
      (purchaseDeductionByEmployee[purchase.employeeId] || 0) + purchase.amountBs;
  }

  for (const loan of loans) {
    if (loan.status !== 'Activo') continue;
    loanInstallmentByEmployee[loan.employeeId] =
      (loanInstallmentByEmployee[loan.employeeId] || 0) + loan.installmentBs;
  }

  return {
    commissionByEmployee,
    commissionSaleIdsByEmployee,
    assignmentMonthlyByEmployee,
    purchaseDeductionByEmployee,
    loanInstallmentByEmployee,
  };
}