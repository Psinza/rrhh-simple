'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateLine,
  formatAmount,
  parseAmount,
  roundToMinorUnits,
} = require('../server/commercialSalesMath.cjs');

test('parseAmount preserves six-decimal precision without floating-point conversion', () => {
  assert.equal(parseAmount('123456789012345.123456', 'Monto'), 123456789012345123456n);
  assert.equal(formatAmount(parseAmount('0.000001', 'Monto')), '0.000001');
});

test('roundToMinorUnits uses half-up rounding for configured currency precision', () => {
  assert.equal(formatAmount(roundToMinorUnits(parseAmount('1.005', 'Monto'), 2)), '1.01');
  assert.equal(formatAmount(roundToMinorUnits(parseAmount('1.004', 'Monto'), 2)), '1');
});

test('calculateLine rounds the extended amount, discount, and each tax at currency precision', () => {
  const result = calculateLine({
    quantity: '3',
    unitPrice: '0.335',
    discountAmount: '0.01',
    minorUnitDigits: 2,
    rates: [{
      id: 'vat',
      code: 'VAT',
      name: 'IVA',
      tax_kind: 'vat',
      rate_percent: '16',
      is_exempt: false,
      legal_source_reference: 'operator-reviewed',
    }],
  });

  assert.equal(result.netAmount, '1');
  assert.equal(result.taxAmount, '0.16');
  assert.equal(result.grossAmount, '1.16');
  assert.equal(result.taxSnapshot[0].tax_amount, '0.16');
});

test('calculateLine rejects a discount larger than the rounded line amount', () => {
  assert.throws(
    () => calculateLine({
      quantity: '1',
      unitPrice: '2',
      discountAmount: '2.01',
      minorUnitDigits: 2,
    }),
    /descuento no puede superar/,
  );
});

test('parseAmount rejects negatives, malformed decimals, and values with excess precision', () => {
  for (const value of ['-1', '01.2', '1.1234567', '1,25']) {
    assert.throws(() => parseAmount(value, 'Monto'));
  }
});
