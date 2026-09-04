import test from 'node:test';
import assert from 'node:assert/strict';
import { convertAmountToBaseCurrency } from '../src/utils/venezuelaLaborCalculations.js';

test('convertAmountToBaseCurrency converts USD to Bs using BCV rate', () => {
  assert.equal(convertAmountToBaseCurrency(100, 'USD', 45.5), 4550);
  assert.equal(convertAmountToBaseCurrency(1000, 'BS', 45.5), 1000);
  assert.equal(convertAmountToBaseCurrency(250, 'USD', 0), 250);
});
