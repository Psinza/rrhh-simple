const test = require('node:test');
const assert = require('node:assert/strict');
const { parseBcvUsdRate } = require('../server/bcvRate');

test('parses the USD rate and Spanish value date from the BCV page', () => {
  const result = parseBcvUsdRate(`
    <div>USD</div><strong>857,88760000</strong>
    <p>Fecha Valor: Martes, 29 Septiembre 2026</p>
  `);

  assert.deepEqual(result, { rate: 857.8876, effectiveDate: '2026-09-29' });
});

test('parses BCV thousands separators and the alternate September spelling', () => {
  const result = parseBcvUsdRate(`
    USD <b>1.234,56780000</b>
    <p>Fecha Valor: Martes, 29 Setiembre 2026</p>
  `);

  assert.deepEqual(result, { rate: 1234.5678, effectiveDate: '2026-09-29' });
});

test('rejects pages missing the rate or effective date', () => {
  assert.throws(
    () => parseBcvUsdRate('<p>USD 857,8876</p>'),
    /fecha valor/i,
  );
  assert.throws(
    () => parseBcvUsdRate('<p>Fecha Valor: Martes, 29 Septiembre 2026</p>'),
    /cotización USD/i,
  );
});

test('rejects invalid rates and calendar dates', () => {
  assert.throws(
    () => parseBcvUsdRate('<p>USD 0</p><p>Fecha Valor: Martes, 29 Septiembre 2026</p>'),
    /tasa USD inválida/i,
  );
  assert.throws(
    () => parseBcvUsdRate('<p>USD 857,88</p><p>Fecha Valor: Martes, 31 Febrero 2026</p>'),
    /fecha valor inválida/i,
  );
});
