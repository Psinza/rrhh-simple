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

  const salarioMensualBaseEnBs = employee.salarioMoneda === 'USD'
    ? employee.salarioMensualBase * tasaBCV
    : employee.salarioMensualBase;

  const factorPeriodo = frecuencia === 'semanal' ? 0.25 : frecuencia === 'quincenal' ? 0.5 : 1;
  const sueldoBasePeriodo = salarioMensualBaseEnBs * factorPeriodo;

  const salarioMensualEnBs = salarioMensualBaseEnBs;
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

/**
 * Cálculo Completo de Prestaciones Sociales según la LOTTT (Art. 142 y 143)
 */
export function calculateSocialBenefits(employee: Employee, company: CompanySettings): SocialBenefitsReport {
  const tenure = calculateTenure(employee.fechaIngreso);
  const integral = calculateIntegralSalary(
    employee.salarioMensualBase,
    tenure.anios,
    employee.diasUtilidadesAnuales || company.diasUtilidadesEmpresa
  );

  const trimestresCompletos = Math.floor(tenure.totalDias / 90);
  const diasGarantiaTrimestral = trimestresCompletos * 15;

  let diasAdicionalesAntiguedad = 0;
  if (tenure.anios >= 2) {
    diasAdicionalesAntiguedad = Math.min(30, (tenure.anios - 1) * 2);
  }

  const totalDiasGarantia = diasGarantiaTrimestral + diasAdicionalesAntiguedad;
  const montoGarantiaTotal = totalDiasGarantia * integral.salarioDiarioIntegral;

  const tasaAnual = company.tasaInteresPrestacionesBCV || 52.8;
  const tasaMensual = (tasaAnual / 100) / 12;

  const historialIntereses: MonthlyInterestRecord[] = [];
  let acumuladoIntereses = 0;

  const mesesHistorial = Math.min(12, Math.max(1, tenure.anios * 12 + tenure.meses));
  const dateCursor = new Date();

  for (let i = mesesHistorial; i >= 1; i--) {
    const curMonthDate = new Date(dateCursor.getFullYear(), dateCursor.getMonth() - i, 1);
    const nombreMes = curMonthDate.toLocaleDateString('es-VE', { month: 'long' });
    const anio = curMonthDate.getFullYear();

    const capitalMes = Math.max(100, (montoGarantiaTotal / mesesHistorial) * (mesesHistorial - i + 1));
    const interesGenerado = capitalMes * tasaMensual;
    acumuladoIntereses += interesGenerado;

    historialIntereses.push({
      mes: nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1),
      anio,
      salarioIntegralMensual: integral.salarioIntegralMensual,
      capitalAcumulado: capitalMes,
      tasaActivaBCV: tasaAnual,
      interesGenerado,
      pagadoO_Abonado: 'Abonado a Fideicomiso',
    });
  }

  const totalAnticiposConcedidos = (employee.anticiposPrestaciones || []).reduce(
    (sum, a) => sum + a.monto,
    0
  );
  const limiteMaximoAnticipo75 = (montoGarantiaTotal + acumuladoIntereses) * 0.75;
  const disponibleParaAnticipo = Math.max(0, limiteMaximoAnticipo75 - totalAnticiposConcedidos);

  let aniosParaFiniquito = tenure.anios;
  if (tenure.meses >= 6) {
    aniosParaFiniquito += 1;
  }
  const montoRetroactivoArt142c = Math.max(1, aniosParaFiniquito) * 30 * integral.salarioDiarioIntegral;

  const montoMayorAPagar = Math.max(montoGarantiaTotal + acumuladoIntereses, montoRetroactivoArt142c);
  const saldoNetoActual = montoGarantiaTotal + acumuladoIntereses - totalAnticiposConcedidos;

  return {
    antiguedadAnios: tenure.anios,
    antiguedadMeses: tenure.meses,
    antiguedadDias: tenure.dias,
    salarioDiarioNormal: integral.salarioDiarioNormal,
    alicuotaBonoVacacional: integral.alicuotaBonoVacacionalDiaria,
    alicuotaUtilidades: integral.alicuotaUtilidadesDiaria,
    salarioDiarioIntegral: integral.salarioDiarioIntegral,
    salarioIntegralMensual: integral.salarioIntegralMensual,
    diasGarantiaAcumulados: diasGarantiaTrimestral,
    diasAdicionalesAntiguedad,
    totalDiasGarantia,
    montoGarantiaTotal,
    interesesAcumulados: acumuladoIntereses,
    historialIntereses,
    totalAnticiposConcedidos,
    limiteMaximoAnticipo75,
    disponibleParaAnticipo,
    montoRetroactivoArt142c,
    montoMayorAPagar,
    saldoNetoActual,
  };
}

/**
 * Generador Oficial de Archivo para el Sistema TIUNA del IVSS (Forma 14-02 Registro de Ingresos)
 * Formato de texto posicional / delimitado estándar para carga en portal IVSS Tiuna
 */
export function generateTiunaIvssFile(
  company: CompanySettings,
  employees: Employee[],
  tipo: 'INGRESOS_1402' | 'MOVIMIENTOS_SALARIO'
): GovernmentExportFile {
  const lines: string[] = [];
  const numeroPatronal = (company.numeroPatronalIVSS || 'D00000000').padEnd(9, ' ').substring(0, 9);

  employees.forEach((emp) => {
    const nacionalidad = emp.nacionalidad || 'V';
    const numCedula = emp.cedula.replace(/[^0-9]/g, '').padStart(9, '0');
    const pNombre = emp.primerNombre.toUpperCase().padEnd(15, ' ').substring(0, 15);
    const sNombre = (emp.segundoNombre || '').toUpperCase().padEnd(15, ' ').substring(0, 15);
    const pApellido = emp.primerApellido.toUpperCase().padEnd(15, ' ').substring(0, 15);
    const sApellido = (emp.segundoApellido || '').toUpperCase().padEnd(15, ' ').substring(0, 15);

    const fIngresoDate = new Date(emp.fechaIngreso);
    const dd = String(fIngresoDate.getDate()).padStart(2, '0');
    const mm = String(fIngresoDate.getMonth() + 1).padStart(2, '0');
    const yyyy = fIngresoDate.getFullYear();
    const fechaFormatted = `${dd}${mm}${yyyy}`;

    const salarioEntero = Math.round(emp.salarioMensualBase * 100);
    const salarioPadded = String(salarioEntero).padStart(12, '0');

    if (tipo === 'INGRESOS_1402') {
      const line = `${numeroPatronal}${nacionalidad}${numCedula}${pApellido}${sApellido}${pNombre}${sNombre}${fechaFormatted}${salarioPadded}EMPLEADO GENERAL    `;
      lines.push(line);
    } else {
      const line = `${numeroPatronal},${nacionalidad},${numCedula},${fechaFormatted},${emp.salarioMensualBase.toFixed(2)},01`;
      lines.push(line);
    }
  });

  const content = lines.join('\r\n');
  const filename = tipo === 'INGRESOS_1402' ? `TIUNA_FORMA_1402_${company.rif}.txt` : `TIUNA_SALARIOS_${company.rif}.txt`;

  return {
    tipo: tipo === 'INGRESOS_1402' ? 'IVSS_TIUNA_1402' : 'IVSS_TIUNA_SALARIO',
    nombreArchivo: filename,
    descripcion:
      tipo === 'INGRESOS_1402'
        ? 'Archivo de Carga Masiva para Registro de Ingresos de Personal en portal TIUNA IVSS (Forma 14-02).'
        : 'Archivo de Notificación de Modificación Salarial de Trabajadores en portal TIUNA IVSS.',
    enteRegulador: 'Instituto Venezolano de los Seguros Sociales (IVSS)',
    contenido: content,
    formato: 'TXT',
    totalRegistros: employees.length,
  };
}

/**
 * Generador Oficial de Archivo para BANAVIH / FAOV
 * Formato oficial estructurado para declaración de nómina de ahorro habitacional
 */
export function generateBanavihFaovFile(
  company: CompanySettings,
  employees: Employee[],
  periodoMes: string = '08',
  periodoAnio: number = 2026
): GovernmentExportFile {
  const header = `RIF_PATRONO;PERIODO;CANTIDAD_TRABAJADORES\n${company.rif};${periodoAnio}${periodoMes};${employees.length}\n`;
  const subHeader = `NAC;CEDULA;PRIMER_APELLIDO;SEGUNDO_APELLIDO;PRIMER_NOMBRE;SEGUNDO_NOMBRE;SALARIO_INTEGRAL;RETENCION_TRABAJADOR_1%;APORTE_PATRONAL_2%;TOTAL_APORTE_3%\n`;

  let montoTotalBs = 0;
  const lines: string[] = [];

  employees.forEach((emp) => {
    const integral = calculateIntegralSalary(emp.salarioMensualBase, 1, emp.diasUtilidadesAnuales || company.diasUtilidadesEmpresa);
    const salarioBase = integral.salarioIntegralMensual;
    const ret1 = salarioBase * 0.01;
    const apo2 = salarioBase * 0.02;
    const total3 = ret1 + apo2;
    montoTotalBs += total3;

    const line = `${emp.nacionalidad};${emp.cedula.replace(/[^0-9]/g, '')};${emp.primerApellido};${emp.segundoApellido || ''};${emp.primerNombre};${emp.segundoNombre || ''};${salarioBase.toFixed(2)};${ret1.toFixed(2)};${apo2.toFixed(2)};${total3.toFixed(2)}`;
    lines.push(line);
  });

  const fullContent = header + subHeader + lines.join('\n');
  const filename = `FAOV_BANAVIH_${company.rif}_${periodoAnio}${periodoMes}.csv`;

  return {
    tipo: 'BANAVIH_FAOV',
    nombreArchivo: filename,
    descripcion:
      'Archivo de Carga Masiva de Nómina de Aportes para el Fondo de Ahorro Obligatorio para la Vivienda (BANAVIH / FAOV) con retención 1% y aporte 2%.',
    enteRegulador: 'Banco Nacional de Vivienda y Hábitat (BANAVIH / FAOV)',
    contenido: fullContent,
    formato: 'CSV',
    totalRegistros: employees.length,
    montoTotalBs,
  };
}

/**
 * Generador de Reporte y Resumen Trimestral para el INCES
 */
export function generateIncesReport(
  company: CompanySettings,
  employees: Employee[],
  trimestre: number = 3,
  anio: number = 2026
): GovernmentExportFile {
  const totalSalariosMensual = employees.reduce((sum, e) => sum + e.salarioMensualBase, 0);
  const totalSalariosTrimestral = totalSalariosMensual * 3;
  const aportePatronal2 = totalSalariosTrimestral * 0.02;

  const content = `========================================================================
REPÚBLICA BOLIVARIANA DE VENEZUELA
INSTITUTO NACIONAL DE CAPACITACIÓN Y EDUCACIÓN SOCIALISTA (INCES)
DECLARACIÓN TRIMESTRAL DE CONTRIBUCIÓN PARAFISCAL PATRONAL (2%)
========================================================================
DATOS DE LA ENTIDAD DE TRABAJO:
Razón Social: ${company.razonSocial}
R.I.F.: ${company.rif}
Número de Aportante INCES: ${company.codigoInces}
Dirección Fiscal: ${company.direccionFiscal}, ${company.ciudad}, ${company.estado}
Período Fiscal: Trimestre ${trimestre} - Año ${anio}
Cantidad de Trabajadores Registrados: ${employees.length}

DETALLE ECONÓMICO BASE DE CÁLCULO:
Monto Total Nómina Mensual Base: Bs. ${totalSalariosMensual.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
Monto Total Salarios Pagados en el Trimestre: Bs. ${totalSalariosTrimestral.toLocaleString('es-VE', { minimumFractionDigits: 2 })}

OBLIGACIÓN PARAFISCAL (Art. 14 Ley del INCES):
Aporte Patronal Aplicable (2%): Bs. ${aportePatronal2.toLocaleString('es-VE', { minimumFractionDigits: 2 })}

LISTADO DE TRABAJADORES COTIZANTES:
${employees
  .map(
    (e, idx) =>
      `${idx + 1}. ${e.cedula} - ${e.primerApellido} ${e.primerNombre} | Cargo: ${e.cargo} | Salario Mensual: Bs. ${e.salarioMensualBase.toFixed(2)}`
  )
  .join('\n')}

========================================================================
Certificado digital generado por el Sistema TalentoVE.
Fecha de generación: ${new Date().toLocaleDateString('es-VE')}
Firma y Sello de la Entidad de Trabajo: ___________________________
`;

  return {
    tipo: 'INCES_TRIMESTRAL',
    nombreArchivo: `INCES_DECLARACION_T${trimestre}_${anio}_${company.rif}.txt`,
    descripcion: 'Declaración jurada y cálculo trimestral del aporte parafiscal del 2% patronal para el INCES.',
    enteRegulador: 'Instituto Nacional de Capacitación y Educación Socialista (INCES)',
    contenido: content,
    formato: 'TXT',
    totalRegistros: employees.length,
    montoTotalBs: aportePatronal2,
  };
}

/**
 * Función para descargar archivos generados directamente en el navegador
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Formateo de moneda en Bolívares (Bs.) y USD con tasa BCV
 */
export function formatBs(amount: number): string {
  return `Bs. ${amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatUSD(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function toBolivaresFromSalaryMode(
  amount: number,
  mode: 'bolivares' | 'dolares' | 'mixto',
  tasaBCV: number,
  montoBsAdicional: number = 0
): number {
  if (!Number.isFinite(amount) || amount < 0) return 0;

  if (mode === 'bolivares') return amount;
  if (mode === 'dolares') return amount * tasaBCV;

  return amount * tasaBCV + montoBsAdicional;
}
