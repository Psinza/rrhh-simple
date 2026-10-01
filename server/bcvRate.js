const BCV_URL = 'https://www.bcv.org.ve/';

const MONTHS = new Map([
  ['enero', 1],
  ['febrero', 2],
  ['marzo', 3],
  ['abril', 4],
  ['mayo', 5],
  ['junio', 6],
  ['julio', 7],
  ['agosto', 8],
  ['septiembre', 9],
  ['setiembre', 9],
  ['octubre', 10],
  ['noviembre', 11],
  ['diciembre', 12],
]);

function stripHtml(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRate(value) {
  const normalized = value.includes(',')
    ? value.replace(/\./g, '').replace(',', '.')
    : value;
  const rate = Number(normalized);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('El BCV publicó una tasa USD inválida.');
  }
  return rate;
}

function parseBcvUsdRate(html) {
  if (typeof html !== 'string' || html.length === 0) {
    throw new Error('El BCV devolvió una página vacía.');
  }

  const text = stripHtml(html);
  const usdMatch = text.match(/\bUSD\b\s*:?\s*\$?\s*([0-9][0-9.,]*)/i);
  if (!usdMatch) {
    throw new Error('No se encontró la cotización USD en la página del BCV.');
  }

  const dateMatch = text.match(
    /Fecha\s+Valor\s*:\s*(?:[\p{L}]+\s*,\s*)?(\d{1,2})\s+([\p{L}]+)\s+(\d{4})/iu,
  );
  if (!dateMatch) {
    throw new Error('No se encontró la fecha valor de la tasa publicada por el BCV.');
  }

  const day = Number(dateMatch[1]);
  const month = MONTHS.get(dateMatch[2].toLocaleLowerCase('es'));
  const year = Number(dateMatch[3]);
  if (!month) {
    throw new Error('El BCV publicó una fecha valor con un mes no reconocido.');
  }
  const effectiveDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const parsedDate = new Date(`${effectiveDate}T00:00:00.000Z`);
  if (
    !Number.isFinite(parsedDate.getTime())
    || parsedDate.toISOString().slice(0, 10) !== effectiveDate
  ) {
    throw new Error('El BCV publicó una fecha valor inválida.');
  }

  return { rate: parseRate(usdMatch[1]), effectiveDate };
}

async function fetchBcvUsdRate() {
  const response = await fetch(BCV_URL, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    throw new Error(`El BCV respondió HTTP ${response.status}.`);
  }
  const html = await response.text();
  if (html.length > 3_000_000) {
    throw new Error('La respuesta del BCV excede el tamaño permitido.');
  }
  return parseBcvUsdRate(html);
}

module.exports = { parseBcvUsdRate, fetchBcvUsdRate };
