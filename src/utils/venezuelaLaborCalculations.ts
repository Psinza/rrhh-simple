import type { CompanySettings, Employee, GovernmentExportFile, PayrollItem, SocialBenefitsReport } from '../types';

/**
 * Cálculo de Parafiscales y Retenciones de Nómina en Venezuela (LOTTT, IVSS, RPE, FAOV, INCES)
 * Garantiza exactamente $70 USD semanales (o su equivalente en Bs. a tasa BCV) para sueldos de $280 USD.
 */
export function convertAmountToBaseCurrency(
  amount: number,
  currency?: 'BS' | 'USD',
  exchangeRate: number = 1
): number {
  const numericAmount = Number(amount) || 0;

  if (!Number.isFinite(numericAmount)) {
    return 0;
  }

  if (currency === 'USD' && exchangeRate > 0) {
    return numericAmount * exchangeRate;
  }

  return numericAmount;
}

export function formatBs(value: number): string {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'VES',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

export function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

export function formatMoneyWithEmployeeCurrency(
  value: number,
  displayCurrency: 'BS' | 'USD',
  exchangeRate: number
): string {
  if (displayCurrency === 'USD') {
    const usdAmount = exchangeRate > 0 ? Number(value) / exchangeRate : Number(value);
    return formatUSD(usdAmount);
  }

  return formatBs(Number(value) || 0);
}

export function normalizeSalaryToBs(employee: Partial<Employee>, exchangeRate: number): number {
  const storedSalary = Number(employee.salarioMensualBase) || 0;

  if (!storedSalary || exchangeRate <= 0) {
    return storedSalary;
  }

  if (employee.salarioMoneda === 'USD') {
    const probableLegacyRawUsd = storedSalary < 1000 && storedSalary > 0;
    return probableLegacyRawUsd ? storedSalary * exchangeRate : storedSalary;
  }

  return storedSalary;
}

export function calculateTenure(fechaIngreso: string): { anios: number; meses: number; dias: number } {
  const start = new Date(fechaIngreso);
  const now = new Date();

  if (Number.isNaN(start.getTime())) {
    return { anios: 0, meses: 0, dias: 0 };
  }

  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    const priorMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += priorMonth.getDate();
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return { anios: Math.max(0, years), meses: Math.max(0, months), dias: Math.max(0, days) };
}

export function calculateIntegralSalary(
  salarioMensualBase: number,
  aniosServicio: number,
  diasUtilidadesAnuales: number
): {
  salarioDiarioNormal: number;
  alicuotaBonoVacacionalDiaria: number;
  alicuotaUtilidadesDiaria: number;
  salarioDiarioIntegral: number;
  salarioIntegralMensual: number;
  bonoVacacional: number;
  utilidades: number;
  diasBonoVacacional: number;
} {
  const salarioDiarioNormal = salarioMensualBase / 30;
  const bonoVacacional = salarioDiarioNormal * (diasUtilidadesAnuales || 30);
  const utilidades = salarioDiarioNormal * (diasUtilidadesAnuales || 30);
  const diasBonoVacacional = Math.min(30, 15 + Math.max(0, aniosServicio - 1));
  const alicuotaBonoVacacionalDiaria = salarioDiarioNormal * 0.3;
  const alicuotaUtilidadesDiaria = salarioDiarioNormal * 0.3;
  const salarioDiarioIntegral = salarioDiarioNormal + alicuotaBonoVacacionalDiaria + alicuotaUtilidadesDiaria;
  const salarioIntegralMensual = salarioMensualBase + bonoVacacional + utilidades + (aniosServicio > 0 ? salarioMensualBase * 0.12 : 0);

  return {
    salarioDiarioNormal,
    alicuotaBonoVacacionalDiaria,
    alicuotaUtilidadesDiaria,
    salarioDiarioIntegral,
    salarioIntegralMensual,
    bonoVacacional,
    utilidades,
    diasBonoVacacional,
  };
}

export function calculateSocialBenefits(
  employee: Employee,
  company: CompanySettings
): SocialBenefitsReport {
  const tenure = calculateTenure(employee.fechaIngreso);
  const salarioBase = Number(employee.salarioMensualBase) || 0;
  const salarioDiarioNormal = salarioBase / 30;
  const diasGarantiaAcumulados = 15;
  const diasAdicionalesAntiguedad = Math.max(0, tenure.anios * 2);
  const totalDiasGarantia = diasGarantiaAcumulados + diasAdicionalesAntiguedad;
  const montoGarantiaTotal = totalDiasGarantia * salarioDiarioNormal;
  const interesesAcumulados = montoGarantiaTotal * ((company.tasaInteresPrestacionesBCV || 0) / 100) * (Math.max(1, tenure.meses) / 12);
  const totalAnticiposConcedidos = (employee.anticiposPrestaciones || []).reduce((sum, item) => sum + Number(item.monto || 0), 0);
  const limiteMaximoAnticipo75 = (montoGarantiaTotal + interesesAcumulados) * 0.75;
  const disponibleParaAnticipo = Math.max(0, limiteMaximoAnticipo75 - totalAnticiposConcedidos);
  const montoRetroactivoArt142c = salarioDiarioNormal * 30;
  const montoMayorAPagar = Math.max(montoGarantiaTotal + interesesAcumulados, montoRetroactivoArt142c) - totalAnticiposConcedidos;
  const saldoNetoActual = montoGarantiaTotal + interesesAcumulados - totalAnticiposConcedidos;

  return {
    antiguedadAnios: tenure.anios,
    antiguedadMeses: tenure.meses,
    antiguedadDias: tenure.dias,
    salarioDiarioNormal,
    alicuotaBonoVacacional: salarioDiarioNormal * 0.3,
    alicuotaUtilidades: salarioDiarioNormal * 0.3,
    salarioDiarioIntegral: salarioDiarioNormal + salarioDiarioNormal * 0.3 + salarioDiarioNormal * 0.3,
    salarioIntegralMensual: salarioBase + salarioBase * 0.12,
    diasGarantiaAcumulados,
    diasAdicionalesAntiguedad,
    totalDiasGarantia,
    montoGarantiaTotal,
    interesesAcumulados,
    historialIntereses: [],
    totalAnticiposConcedidos,
    limiteMaximoAnticipo75,
    disponibleParaAnticipo,
    montoRetroactivoArt142c,
    montoMayorAPagar,
    saldoNetoActual,
  };
}

export function getSalaryBaseInBs(employee: Partial<Employee>, exchangeRate: number): number {
  return normalizeSalaryToBs(employee, exchangeRate);
}

export function calculatePayrollDeductionsAndContributions(
  employee: Employee,
  company: CompanySettings,
  frecuencia: 'semanal' | 'quincenal' | 'mensual',
  horasExtrasDiurnas: number = 0,
  horasExtrasNocturnas: number = 0,
  bonoProductividad: number = 0,
  viaticos: number = employee.viaticosPendientes || 0,
  prestamosAnticipos: number = 0,
  deduccionesProductos: number = 0,
  aplicarRetencionesGubernamentales: boolean = true
): Omit<PayrollItem, 'id' | 'employeeId' | 'employee' | 'fechaGeneracion' | 'firmadoDigitalmente' | 'hashCriptografico'> {

  const tasaBCV = company.tasaBCV_USD > 0 ? company.tasaBCV_USD : 1;
  const salarioMensualBaseBs = getSalaryBaseInBs(employee, tasaBCV);

  const factorPeriodo = frecuencia === 'semanal' ? 1 / 4 : frecuencia === 'quincenal' ? 1 / 2 : 1;
  const sueldoBasePeriodo = salarioMensualBaseBs * factorPeriodo;
  const salarioMensualEnBs = salarioMensualBaseBs;
  const lunes = frecuencia === 'semanal' ? 1 : frecuencia === 'quincenal' ? Math.round(company.lunesDelMesActual / 2) : company.lunesDelMesActual;

  const cestaticketPeriodo = employee.cestaticketAplica === false
    ? 0
    : (employee.cestaticketMensual || company.montoCestaticketNacional) * factorPeriodo;

  const salarioDiarioNormal = salarioMensualEnBs / 30;
  const valorHoraOrdinaria = salarioDiarioNormal / 8;
  const valorHoraExtraDiurna = valorHoraOrdinaria * 1.5;
  const valorHoraExtraNocturna = valorHoraOrdinaria * 1.5 * 1.3;

  const montoHorasExtrasDiurnas = horasExtrasDiurnas * valorHoraExtraDiurna;
  const montoHorasExtrasNocturnas = horasExtrasNocturnas * valorHoraExtraNocturna;
  const feriadosTrabajados = 0;

  const totalAsignacionesSalariales =
    sueldoBasePeriodo + montoHorasExtrasDiurnas + montoHorasExtrasNocturnas + feriadosTrabajados + bonoProductividad;
  const totalAsignacionesNoSalariales = viaticos;
  const totalAsignaciones = totalAsignacionesSalariales + totalAsignacionesNoSalariales;

  const topeIvssMensual = company.salarioMinimoNacional * 5;
  const salarioSujetoIvss = Math.min(salarioMensualEnBs, topeIvssMensual);
  const salarioSemanalIvss = (salarioSujetoIvss * 12) / 52;

  const retencionIVSS = aplicarRetencionesGubernamentales ? salarioSemanalIvss * 0.04 * lunes : 0;
  const retencionParoForzoso = aplicarRetencionesGubernamentales ? salarioSemanalIvss * 0.005 * lunes : 0;
  const retencionFAOV = aplicarRetencionesGubernamentales ? totalAsignacionesSalariales * 0.01 : 0;
  const retencionISLR = aplicarRetencionesGubernamentales ? totalAsignacionesSalariales * ((employee.porcentajeRetencionISLR || 0) / 100) : 0;

  const otrasDeducciones = 0;
  const totalDeducciones =
    retencionIVSS + retencionParoForzoso + retencionFAOV + retencionISLR + prestamosAnticipos + deduccionesProductos + otrasDeducciones;

  const netoCobrarBs = totalAsignaciones - totalDeducciones;
  const netoCobrarUSD = tasaBCV > 0 ? netoCobrarBs / tasaBCV : 0;

  const tasaAportePatronalIvss = (company.nivelRiesgoIVSS || 10) / 100;
  const aportePatronalIVSS = salarioSemanalIvss * tasaAportePatronalIvss * lunes;
  const aportePatronalRPE = salarioSemanalIvss * 0.02 * lunes;
  const aportePatronalFAOV = totalAsignacionesSalariales * 0.02;
  const aportePatronalINCES = totalAsignacionesSalariales * 0.02;
  const totalAportesPatronales = aportePatronalIVSS + aportePatronalRPE + aportePatronalFAOV + aportePatronalINCES;

  return {
    diasTrabajados: frecuencia === 'semanal' ? 5 : frecuencia === 'quincenal' ? 15 : 30,
    horasExtrasDiurnas,
    horasExtrasNocturnas,
    sueldoBasePeriodo,
    cestaticketPeriodo,
    montoHorasExtrasDiurnas,
    montoHorasExtrasNocturnas,
    viaticos,
    viaticosOriginal: (employee.viaticosPendientesOriginal ?? employee.viaticosPendientes ?? 0) * factorPeriodo,
    viaticosMoneda: employee.viaticosMoneda || 'BS',
    feriadosTrabajados,
    bonoProductividad,
    comisionesVentas: bonoProductividad,
    deduccionesProductos,
    totalAsignacionesSalariales,
    totalAsignacionesNoSalariales,
    totalAsignaciones,
    retencionIVSS,
    retencionParoForzoso,
    retencionFAOV,
    retencionISLR,
    prestamosAnticipos,
    otrasDeducciones,
    totalDeducciones,
    netoCobrarBs,
    netoCobrarUSD,
    aportePatronalIVSS,
    aportePatronalRPE,
    aportePatronalFAOV,
    aportePatronalINCES,
    totalAportesPatronales,
  };
}

export function generateTiunaIvssFile(
  company: CompanySettings,
  employees: Employee[],
  tipo: 'INGRESOS_1402' | 'MOVIMIENTOS_SALARIO'
): GovernmentExportFile {
  const rows = employees
    .filter((employee) => employee.status === 'activo')
    .map((employee) => {
      const baseBs = Number(employee.salarioMensualBase) || 0;
      return `${employee.cedula},${employee.primerNombre},${employee.primerApellido},${baseBs.toFixed(2)}`;
    })
    .join('\n');

  const contenido = `# Tipo=${tipo}\n# RIF=${company.rif}\n# Tasa BCV=${company.tasaBCV_USD.toFixed(2)}\n${rows}`;
  return {
    tipo: tipo === 'INGRESOS_1402' ? 'IVSS_TIUNA_1402' : 'IVSS_TIUNA_SALARIO',
    nombreArchivo: `${tipo.toLowerCase()}_${company.rif}.txt`,
    descripcion: 'Archivo de cumplimiento IVSS para carga masiva en TIUNA',
    enteRegulador: 'IVSS',
    contenido,
    formato: 'TXT',
    totalRegistros: employees.length,
    montoTotalBs: employees.reduce((sum, employee) => sum + (Number(employee.salarioMensualBase) || 0), 0),
  };
}

export function generateBanavihFaovFile(
  company: CompanySettings,
  employees: Employee[],
  mes: string,
  anio: number
): GovernmentExportFile {
  const rows = employees
    .filter((employee) => employee.status === 'activo')
    .map((employee) => {
      const baseBs = Number(employee.salarioMensualBase) || 0;
      return `${employee.cedula},${baseBs.toFixed(2)}`;
    })
    .join('\n');

  return {
    tipo: 'BANAVIH_FAOV',
    nombreArchivo: `BANAVIH_FAOV_${mes}_${anio}.csv`,
    descripcion: 'Reporte de aportes FAOV a BANAVIH',
    enteRegulador: 'BANAVIH',
    contenido: `cedula,monto_bs\n${rows}`,
    formato: 'CSV',
    totalRegistros: employees.length,
    montoTotalBs: employees.reduce((sum, employee) => sum + (Number(employee.salarioMensualBase) || 0), 0),
  };
}

export function generateIncesReport(
  company: CompanySettings,
  employees: Employee[],
  trimestre: number,
  anio: number
): GovernmentExportFile {
  const rows = employees
    .filter((employee) => employee.status === 'activo')
    .map((employee) => {
      const baseBs = Number(employee.salarioMensualBase) || 0;
      return `${employee.cedula},${baseBs.toFixed(2)}`;
    })
    .join('\n');

  return {
    tipo: 'INCES_TRIMESTRAL',
    nombreArchivo: `INCES_TRIMESTRE_${trimestre}_${anio}.csv`,
    descripcion: 'Reporte trimestral de ingreso para INCES',
    enteRegulador: 'INCES',
    contenido: `cedula,salario_bs\n${rows}`,
    formato: 'CSV',
    totalRegistros: employees.length,
    montoTotalBs: employees.reduce((sum, employee) => sum + (Number(employee.salarioMensualBase) || 0), 0),
  };
}

export function downloadFile(contenido: string, nombreArchivo: string, mimeType: string): void {
  const blob = new Blob([contenido], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nombreArchivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
