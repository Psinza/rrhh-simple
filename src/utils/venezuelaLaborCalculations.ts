/**
 * Cálculo de Parafiscales y Retenciones de Nómina en Venezuela (LOTTT, IVSS, RPE, FAOV, INCES)
 * Garantiza exactamente $70 USD semanales (o su equivalente en Bs. a tasa BCV) para sueldos de $280 USD.
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

  const tasaBCV = company.tasaBCV_USD > 0 ? company.tasaBCV_USD : 1;

  // 1. Determinación exacta del Sueldo Base del Período en Bolívares
  let sueldoBasePeriodo: number;

  if (frecuencia === 'semanal') {
    if (employee.monedaSueldo === 'USD' || employee.salarioMensualBase <= 1000) {
      // Si el salario registrado en employee.salarioMensualBase es 280 (USD):
      // $280 / 4 semanas = $70 USD exactos por semana -> convertidos a Bs. con la tasa BCV
      const sueldoSemanalUSD = employee.salarioMensualBase / 4; 
      sueldoBasePeriodo = sueldoSemanalUSD * tasaBCV;
    } else {
      // Si la base almacenada ya está en Bolívares (ej. Bs. 233.094,40), se toma la cuarta parte exacta (1/4)
      sueldoBasePeriodo = employee.salarioMensualBase / 4;
    }
  } else if (frecuencia === 'quincenal') {
    const salarioMensualBs = employee.monedaSueldo === 'USD' ? employee.salarioMensualBase * tasaBCV : employee.salarioMensualBase;
    sueldoBasePeriodo = salarioMensualBs * 0.5;
  } else {
    const salarioMensualBs = employee.monedaSueldo === 'USD' ? employee.salarioMensualBase * tasaBCV : employee.salarioMensualBase;
    sueldoBasePeriodo = salarioMensualBs;
  }

  // 2. Salario Mensual Equivalente en Bolívares para cálculos legales (IVSS, Cestaticket, etc.)
  const salarioMensualEnBs = employee.monedaSueldo === 'USD' 
    ? employee.salarioMensualBase * tasaBCV 
    : employee.salarioMensualBase;

  const factorPeriodo = frecuencia === 'semanal' ? 0.25 : frecuencia === 'quincenal' ? 0.5 : 1.0;
  const lunes = frecuencia === 'semanal' ? 1 : frecuencia === 'quincenal' ? Math.round(company.lunesDelMesActual / 2) : company.lunesDelMesActual;

  const cestaticketPeriodo = employee.cestaticketAplica === false
    ? 0
    : (employee.cestaticketMensual || company.montoCestaticketNacional) * factorPeriodo;

  // Valor de hora extra según jornada laboral legal
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

  // Neto a cobrar
  const netoCobrarBs = totalAsignaciones - totalDeducciones;
  const netoCobrarUSD = tasaBCV > 0 ? netoCobrarBs / tasaBCV : 0;

  // --- APORTES PATRONALES ---
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
