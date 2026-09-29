export interface FiscalCalculationContext {
  companyId: string;
  configurationId: string;
  configurationStatus: 'active' | 'draft' | 'inactive';
  configurationVerified: boolean;
  configurationEffectiveFrom: string;
  configurationEffectiveUntil?: string | null;
  jurisdictionCode: string;
  documentType: string;
  operationType: string;
  issueDate: string;
  counterpartyCondition: string;
  currencyCode: string;
  minorUnitDigits: number;
}

export interface FiscalTaxRule {
  id: string;
  companyId: string;
  configurationId: string;
  jurisdictionCode: string;
  code: string;
  ratePercent: string;
  effectiveFrom: string;
  effectiveUntil?: string | null;
  documentTypes?: string[];
  operationTypes?: string[];
  counterpartyConditions?: string[];
  productServiceCodes?: string[];
  exempt?: boolean;
  active?: boolean;
}

export interface FiscalCalculationLine {
  id: string;
  description: string;
  productServiceCode?: string | null;
  taxableBase: string;
}

export interface CalculatedFiscalTax {
  taxRuleId: string;
  taxCode: string;
  ratePercent: string;
  exempt: boolean;
  amount: string;
}

export interface CalculatedFiscalLine {
  lineId: string;
  taxableBase: string;
  taxes: CalculatedFiscalTax[];
  taxAmount: string;
  grossAmount: string;
}

export interface FiscalDocumentCalculation {
  companyId: string;
  configurationId: string;
  jurisdictionCode: string;
  documentType: string;
  operationType: string;
  issueDate: string;
  counterpartyCondition: string;
  currencyCode: string;
  lines: CalculatedFiscalLine[];
  netAmount: string;
  taxAmount: string;
  grossAmount: string;
}

const RATE_SCALE = 1_000_000n;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function assertIsoDate(value: string, field: string): void {
  if (!ISO_DATE.test(value)) {
    throw new Error(`${field} debe usar una fecha válida con formato AAAA-MM-DD.`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${field} debe usar una fecha válida con formato AAAA-MM-DD.`);
  }
}

function parseMinorUnits(amount: string, digits: number, field: string): bigint {
  const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(amount);
  if (!match || (match[2]?.length ?? 0) > digits) {
    throw new Error(`${field} debe ser un importe no negativo con máximo ${digits} decimales.`);
  }
  const factor = 10n ** BigInt(digits);
  const fractional = (match[2] ?? '').padEnd(digits, '0');
  return BigInt(match[1]) * factor + BigInt(fractional || '0');
}

function formatMinorUnits(amount: bigint, digits: number): string {
  const factor = 10n ** BigInt(digits);
  const major = amount / factor;
  if (digits === 0) return major.toString();
  return `${major}.${(amount % factor).toString().padStart(digits, '0')}`;
}

function parseRate(ratePercent: string): bigint {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,6}))?$/.exec(ratePercent);
  if (!match) throw new Error('La alícuota debe ser un porcentaje no negativo de hasta 6 decimales.');
  const rate = BigInt(match[1]) * RATE_SCALE
    + BigInt((match[2] ?? '').padEnd(6, '0') || '0');
  if (rate > 100n * RATE_SCALE) throw new Error('La alícuota porcentual no puede superar 100.');
  return rate;
}

function matches(scope: string[] | undefined, value: string): boolean {
  return !scope?.length || scope.includes(value);
}

function ruleApplies(
  rule: FiscalTaxRule,
  context: FiscalCalculationContext,
  line: FiscalCalculationLine,
): boolean {
  if (rule.active === false
      || rule.companyId !== context.companyId
      || rule.configurationId !== context.configurationId
      || rule.jurisdictionCode !== context.jurisdictionCode) return false;
  assertIsoDate(rule.effectiveFrom, 'La vigencia inicial de la alícuota');
  if (rule.effectiveUntil) assertIsoDate(rule.effectiveUntil, 'La vigencia final de la alícuota');
  if (rule.effectiveUntil && rule.effectiveUntil < rule.effectiveFrom) {
    throw new Error(`La regla ${rule.code} tiene un rango de vigencia inválido.`);
  }
  return rule.effectiveFrom <= context.issueDate
    && (!rule.effectiveUntil || context.issueDate <= rule.effectiveUntil)
    && matches(rule.documentTypes, context.documentType)
    && matches(rule.operationTypes, context.operationType)
    && matches(rule.counterpartyConditions, context.counterpartyCondition)
    && matches(rule.productServiceCodes, line.productServiceCode ?? '');
}

function calculateTax(base: bigint, rate: bigint): bigint {
  const numerator = base * rate;
  const denominator = 100n * RATE_SCALE;
  return (numerator + denominator / 2n) / denominator;
}

export function calculateFiscalDocument(
  context: FiscalCalculationContext,
  lines: FiscalCalculationLine[],
  rules: FiscalTaxRule[],
): FiscalDocumentCalculation {
  assertIsoDate(context.issueDate, 'La fecha de emisión');
  assertIsoDate(context.configurationEffectiveFrom, 'La vigencia inicial de la configuración');
  if (context.configurationEffectiveUntil) {
    assertIsoDate(context.configurationEffectiveUntil, 'La vigencia final de la configuración');
  }
  if (context.configurationEffectiveUntil
      && context.configurationEffectiveUntil < context.configurationEffectiveFrom) {
    throw new Error('La configuración fiscal tiene un rango de vigencia inválido.');
  }
  if (context.configurationStatus !== 'active'
      || !context.configurationVerified
      || context.issueDate < context.configurationEffectiveFrom
      || (context.configurationEffectiveUntil
        && context.issueDate > context.configurationEffectiveUntil)) {
    throw new Error('No hay una configuración fiscal activa y vigente para la fecha de emisión.');
  }
  if (!context.companyId.trim() || !context.configurationId.trim()) {
    throw new Error('La empresa y la configuración fiscal deben estar identificadas.');
  }
  if (!/^[A-Z]{3}$/.test(context.currencyCode)) {
    throw new Error('La moneda debe indicarse con un código ISO de tres letras en mayúsculas.');
  }
  if (!Number.isInteger(context.minorUnitDigits) || context.minorUnitDigits < 0
      || context.minorUnitDigits > 4) {
    throw new Error('La precisión monetaria debe estar configurada entre 0 y 4 decimales.');
  }
  if (lines.length === 0) throw new Error('El documento debe incluir al menos una línea.');

  const seenLineIds = new Set<string>();
  let documentNet = 0n;
  let documentTax = 0n;

  const calculatedLines = lines.map((line): CalculatedFiscalLine => {
    if (!line.id.trim() || seenLineIds.has(line.id)) {
      throw new Error('Cada línea fiscal debe tener un identificador único.');
    }
    seenLineIds.add(line.id);
    if (!line.description.trim()) throw new Error(`La línea ${line.id} requiere una descripción.`);

    const base = parseMinorUnits(line.taxableBase, context.minorUnitDigits, 'La base imponible');
    const applicableRules = rules.filter((rule) => ruleApplies(rule, context, line));
    if (applicableRules.length === 0) {
      throw new Error(`No hay una alícuota configurada para la línea ${line.id}; no se calcularán impuestos por defecto.`);
    }
    const codes = new Set<string>();
    const taxes = applicableRules.map((rule): CalculatedFiscalTax => {
      if (!rule.id.trim() || !rule.code.trim()) {
        throw new Error('Cada regla fiscal debe tener identificador y código.');
      }
      if (codes.has(rule.code)) {
        throw new Error(`Hay más de una alícuota aplicable para el impuesto ${rule.code} en ${line.id}.`);
      }
      codes.add(rule.code);
      const rate = parseRate(rule.ratePercent);
      if (rule.exempt && rate !== 0n) {
        throw new Error(`La regla exenta ${rule.code} debe tener alícuota cero.`);
      }
      return {
        taxRuleId: rule.id,
        taxCode: rule.code,
        ratePercent: rule.ratePercent,
        exempt: rule.exempt ?? false,
        amount: formatMinorUnits(calculateTax(base, rate), context.minorUnitDigits),
      };
    });

    const lineTax = taxes.reduce(
      (sum, tax) => sum + parseMinorUnits(tax.amount, context.minorUnitDigits, 'El impuesto calculado'),
      0n,
    );
    documentNet += base;
    documentTax += lineTax;
    return {
      lineId: line.id,
      taxableBase: formatMinorUnits(base, context.minorUnitDigits),
      taxes,
      taxAmount: formatMinorUnits(lineTax, context.minorUnitDigits),
      grossAmount: formatMinorUnits(base + lineTax, context.minorUnitDigits),
    };
  });

  return {
    companyId: context.companyId,
    configurationId: context.configurationId,
    jurisdictionCode: context.jurisdictionCode,
    documentType: context.documentType,
    operationType: context.operationType,
    issueDate: context.issueDate,
    counterpartyCondition: context.counterpartyCondition,
    currencyCode: context.currencyCode,
    lines: calculatedLines,
    netAmount: formatMinorUnits(documentNet, context.minorUnitDigits),
    taxAmount: formatMinorUnits(documentTax, context.minorUnitDigits),
    grossAmount: formatMinorUnits(documentNet + documentTax, context.minorUnitDigits),
  };
}
