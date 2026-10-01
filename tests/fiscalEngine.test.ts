import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateFiscalDocument,
  type FiscalCalculationContext,
  type FiscalTaxRule,
} from '../src/services/fiscalEngine';

const context: FiscalCalculationContext = {
  companyId: 'company-1',
  configurationId: 'fiscal-config-1',
  configurationStatus: 'active',
  configurationVerified: true,
  configurationEffectiveFrom: '2026-01-01',
  jurisdictionCode: 'VE',
  documentType: 'invoice',
  operationType: 'sale',
  issueDate: '2026-09-28',
  counterpartyCondition: 'registered',
  currencyCode: 'VES',
  minorUnitDigits: 2,
};

const baseRule: FiscalTaxRule = {
  id: 'rate-1',
  companyId: 'company-1',
  configurationId: 'fiscal-config-1',
  jurisdictionCode: 'VE',
  code: 'IVA_GENERAL',
  ratePercent: '16',
  effectiveFrom: '2026-01-01',
};

test('calculates only matching configured rates and returns a document snapshot', () => {
  const result = calculateFiscalDocument(
    context,
    [{ id: 'line-1', description: 'Configured service', taxableBase: '125.00' }],
    [
      baseRule,
      { ...baseRule, id: 'future-rate', ratePercent: '20', effectiveFrom: '2027-01-01' },
      { ...baseRule, id: 'other-company-config', configurationId: 'other-config' },
    ],
  );

  assert.equal(result.netAmount, '125.00');
  assert.equal(result.taxAmount, '20.00');
  assert.equal(result.grossAmount, '145.00');
  assert.deepEqual(result.lines[0].taxes.map((tax) => tax.taxRuleId), ['rate-1']);
});

test('filters rates by document, transaction, counterparty and product', () => {
  const result = calculateFiscalDocument(
    context,
    [{
      id: 'line-1',
      description: 'Configured service',
      productServiceCode: 'SERVICE-A',
      taxableBase: '100.00',
    }],
    [{
      ...baseRule,
      ratePercent: '10',
      documentTypes: ['invoice'],
      operationTypes: ['sale'],
      counterpartyConditions: ['registered'],
      productServiceCodes: ['SERVICE-A'],
    }, {
      ...baseRule,
      id: 'non-matching-rate',
      code: 'NOT_APPLICABLE',
      documentTypes: ['credit_note'],
    }],
  );

  assert.equal(result.taxAmount, '10.00');
  assert.deepEqual(result.lines[0].taxes.map((tax) => tax.taxCode), ['IVA_GENERAL']);
});

test('uses decimal integer arithmetic for half-up rounding', () => {
  const result = calculateFiscalDocument(
    context,
    [{ id: 'line-1', description: 'Small base', taxableBase: '0.03' }],
    [{ ...baseRule, ratePercent: '50' }],
  );

  assert.equal(result.lines[0].taxAmount, '0.02');
  assert.equal(result.grossAmount, '0.05');
});

test('accepts an explicitly configured exempt rate without inventing a default rate', () => {
  const result = calculateFiscalDocument(
    context,
    [{ id: 'line-1', description: 'Exempt line', taxableBase: '40.00' }],
    [{ ...baseRule, ratePercent: '0', exempt: true }],
  );

  assert.equal(result.taxAmount, '0.00');
  assert.equal(result.lines[0].taxes[0].exempt, true);
});

test('rejects missing rules, duplicate applicable rates and invalid monetary precision', () => {
  assert.throws(
    () => calculateFiscalDocument(
      context,
      [{ id: 'line-1', description: 'No configured rate', taxableBase: '10.00' }],
      [],
    ),
    /no se calcularán impuestos por defecto/,
  );
  assert.throws(
    () => calculateFiscalDocument(context, [
      { id: 'line-1', description: 'Ambiguous', taxableBase: '10.00' },
    ], [baseRule, { ...baseRule, id: 'rate-2' }]),
    /más de una alícuota aplicable/,
  );
  assert.throws(
    () => calculateFiscalDocument(context, [
      { id: 'line-1', description: 'Invalid precision', taxableBase: '10.001' },
    ], [baseRule]),
    /máximo 2 decimales/,
  );
});

test('rejects malformed dates, zero lines and negative rates', () => {
  assert.throws(
    () => calculateFiscalDocument({ ...context, issueDate: '2026-02-31' }, [
      { id: 'line-1', description: 'Invalid date', taxableBase: '10.00' },
    ], [baseRule]),
    /fecha válida/,
  );
  assert.throws(() => calculateFiscalDocument(context, [], [baseRule]), /al menos una línea/);
  assert.throws(
    () => calculateFiscalDocument({ ...context, configurationVerified: false }, [
      { id: 'line-1', description: 'Unverified configuration', taxableBase: '10.00' },
    ], [baseRule]),
    /configuración fiscal activa y vigente/,
  );
  assert.throws(
    () => calculateFiscalDocument({ ...context, configurationEffectiveUntil: '2026-09-27' }, [
      { id: 'line-1', description: 'Expired configuration', taxableBase: '10.00' },
    ], [baseRule]),
    /configuración fiscal activa y vigente/,
  );
  assert.throws(
    () => calculateFiscalDocument(context, [
      { id: 'line-1', description: 'Invalid rate', taxableBase: '10.00' },
    ], [{ ...baseRule, ratePercent: '-1' }]),
    /porcentaje no negativo/,
  );
});
