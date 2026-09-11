/**
 * Cálculo de Parafiscales y Retenciones de Nómina en Venezuela (LOTTT, IVSS, RPE, FAOV, INCES)
 * Adaptado para semanas laborales de 5 días (lunes a viernes) y esquema de 4 semanas al mes (USD / BCV)
 */
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

  // Factor de periodo: 4 semanas exactas al mes (1/4 = 0.25 para $280/4 = $70)
  const factorPeriodo = frecuencia === 'semanal' ? 1 / 4 : frecuencia === 'quincenal' ? 0.5 : 1.0;
  
  // Número de lunes según el tipo de periodo
  const lunes = frecuencia === 'semanal' ? 1 : frecuencia === 'quincenal' ? Math.round(company.lunesDelMesActual / 2) : company.lunesDelMesActual;

  // Determinar si la base mensual del empleado está expresada en USD o BS
  const tasaBCV = company.tasaBCV_USD > 0 ? company.tasaBCV_USD : 1;
  const salarioMensualEnBs = employee.monedaSueldo === 'USD' 
    ? employee.salarioMensualBase * tasaBCV 
    : employee.salarioMensualBase;

  const sueldoBasePeriodo = salarioMensualEnBs * factorPeriodo;

  const cestaticketPeriodo = employee.cestaticketAplica === false
    ? 0
    : (employee.cestaticketMensual || company.montoCestaticketNacional) * factorPeriodo;

  // Cálculo de valor por hora basado en jornada semanal de 5 días (8 horas/día = 40 horas/semana)
  // Legalmente en Venezuela: Salario Diario = Salario Mensual / 30
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

  // --- RETENCIONES AL TRABAJADOR ---
  // Tope IVSS y RPE: 5 Salarios Mínimos Nacionales
  const topeIvssMensual = company.salarioMinimoNacional * 5;
  const salarioSujetoIvss = Math.min(salarioMensualEnBs, topeIvssMensual);
  const salarioSemanalIvss = (salarioSujetoIvss * 12) / 52;

  // IVSS Trabajador: 4%
  const retencionIVSS = aplicarRetencionesGubernamentales ? salarioSemanalIvss * 0.04 * lunes : 0;

  // RPE / Paro Forzoso Trabajador: 0.5%
  const retencionParoForzoso = aplicarRetencionesGubernamentales ? salarioSemanalIvss * 0.005 * lunes : 0;

  // FAOV Trabajador: 1% del salario devengado
  const retencionFAOV = aplicarRetencionesGubernamentales ? totalAsignacionesSalariales * 0.01 : 0;

  // ISLR (Forma AR-I)
  const retencionISLR = aplicarRetencionesGubernamentales ? totalAsignacionesSalariales * ((employee.porcentajeRetencionISLR || 0) / 100) : 0;

  const otrasDeducciones = 0;
  const totalDeducciones =
    retencionIVSS + retencionParoForzoso + retencionFAOV + retencionISLR + prestamosAnticipos + deduccionesProductos + otrasDeducciones;

  // Neto a cobrar en Bs y equivalente en USD a tasa BCV
  const netoCobrarBs = totalAsignaciones - totalDeducciones;
  const netoCobrarUSD = company.tasaBCV_USD > 0 ? netoCobrarBs / company.tasaBCV_USD : 0;

  // --- APORTES PATRONALES ---
  const tasaAportePatronalIvss = (company.nivelRiesgoIVSS || 10) / 100;
  const aportePatronalIVSS = salarioSemanalIvss * tasaAportePatronalIvss * lunes;
  const aportePatronalRPE = salarioSemanalIvss * 0.02 * lunes;
  const aportePatronalFAOV = totalAsignacionesSalariales * 0.02;
  const aportePatronalINCES = totalAsignacionesSalariales * 0.02;

  const totalAportesPatronales = aportePatronalIVSS + aportePatronalRPE + aportePatronalFAOV + aportePatronalINCES;

  return {
    // Asignación de 5 días hábiles trabajados para frecuencia semanal
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
