'use strict';

const SCALE = 1_000_000n;

function parseAmount(value, label) {
  const text = typeof value === 'number' && Number.isFinite(value) ? String(value) : value;
  if (typeof text !== 'string' || !/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(text)) {
    throw new Error(`${label} debe ser un importe decimal no negativo con hasta seis decimales.`);
  }
  const [whole, fraction = ''] = text.split('.');
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, '0'));
}

function roundRatio(numerator, denominator) {
  if (denominator <= 0n) throw new Error('El divisor debe ser positivo.');
  return (numerator + denominator / 2n) / denominator;
}

function roundToMinorUnits(value, digits) {
  if (!Number.isInteger(digits) || digits < 0 || digits > 6) {
    throw new Error('La precisión monetaria debe estar entre cero y seis.');
  }
  const factor = 10n ** BigInt(6 - digits);
  return roundRatio(value, factor) * factor;
}

function formatAmount(value) {
  const whole = value / SCALE;
  const fraction = String(value % SCALE).padStart(6, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : String(whole);
}

function calculateLine({ quantity, unitPrice, discountAmount = '0', rates = [], minorUnitDigits }) {
  const quantityValue = parseAmount(quantity, 'La cantidad');
  const unitPriceValue = parseAmount(unitPrice, 'El precio unitario');
  const discountValue = roundToMinorUnits(
    parseAmount(discountAmount, 'El descuento'),
    minorUnitDigits,
  );
  const base = roundToMinorUnits(roundRatio(quantityValue * unitPriceValue, SCALE), minorUnitDigits);
  if (discountValue > base) throw new Error('El descuento no puede superar el importe de la línea.');
  const net = base - discountValue;
  let taxTotal = 0n;
  const taxSnapshots = rates.map((rate) => {
    const rateMicros = parseAmount(String(rate.rate_percent), 'La tasa fiscal');
    const amount = roundToMinorUnits(
      roundRatio(net * rateMicros, 100n * SCALE),
      minorUnitDigits,
    );
    taxTotal += amount;
    return {
      rate_id: rate.id,
      code: rate.code,
      name: rate.name,
      tax_kind: rate.tax_kind,
      rate_percent: String(rate.rate_percent),
      is_exempt: rate.is_exempt,
      legal_source_reference: rate.legal_source_reference,
      tax_amount: formatAmount(amount),
    };
  });

  return {
    quantity: formatAmount(quantityValue),
    unitPrice: formatAmount(unitPriceValue),
    discountAmount: formatAmount(discountValue),
    netAmount: formatAmount(net),
    taxAmount: formatAmount(taxTotal),
    grossAmount: formatAmount(net + taxTotal),
    taxSnapshot: taxSnapshots,
    netMicros: net,
    taxMicros: taxTotal,
    grossMicros: net + taxTotal,
  };
}

module.exports = { SCALE, calculateLine, formatAmount, parseAmount, roundRatio, roundToMinorUnits };
