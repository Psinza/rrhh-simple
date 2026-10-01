'use strict';

const express = require('express');
const { createHash, randomUUID } = require('node:crypto');
const {
  SCALE, calculateLine, formatAmount, parseAmount, roundToMinorUnits,
} = require('./commercialSalesMath.cjs');

const DOCUMENT_TYPES = new Set(['sales_quote', 'delivery_note', 'customer_invoice']);
const SALES_ROLES = new Set(['admin_sistema', 'dueno']);

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function sendError(res, error, operation) {
  if (error.status) return res.status(error.status).json({ error: error.message });
  if (error.code === '23505') return res.status(409).json({ error: 'Ya existe un registro con esos datos.' });
  if (['23503', '23514', 'P0001'].includes(error.code)) {
    return res.status(409).json({ error: error.message });
  }
  console.error(`${operation}:`, error);
  return res.status(500).json({ error: 'No se pudo completar la operación comercial.' });
}

function formatCurrency(value, digits = 2) {
  const rounded = roundToMinorUnits(value, digits);
  if (digits === 0) return String(rounded / SCALE);
  const fraction = String((rounded % SCALE) / (10n ** BigInt(6 - digits))).padStart(digits, '0');
  return `${rounded / SCALE}.${fraction}`;
}

function calculateValidatedLine(options) {
  try {
    return calculateLine(options);
  } catch (error) {
    throw httpError(400, error.message);
  }
}

async function withUserTransaction(pool, req, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userResult = await client.query(
      `SELECT id, company_id, branch_id, rol
       FROM users
       WHERE id = $1 AND is_active = TRUE
       FOR SHARE`,
      [req.user.id],
    );
    const user = userResult.rows[0];
    if (!user || !user.company_id) throw httpError(403, 'El usuario no tiene una empresa activa asignada.');
    if (!SALES_ROLES.has(user.rol)) throw httpError(403, 'El rol no tiene acceso al módulo comercial-contable.');
    await client.query(
      `SELECT set_config('app.user_id', $1, TRUE),
              set_config('app.client_ip', $2, TRUE)`,
      [user.id, req.ip || ''],
    );
    const result = await work(client, user);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getActiveRates(client, companyId, date, rateIds, documentType = 'invoice') {
  if (!rateIds.length) return [];
  const result = await client.query(
    `SELECT rate.id, rate.rate_code AS code, rate.rate_percent::TEXT AS rate_percent,
            rate.is_exempt, rate.legal_source_reference,
            tax.name, tax.tax_kind
     FROM fiscal_tax_rates AS rate
     JOIN fiscal_taxes AS tax ON tax.id = rate.tax_id
     JOIN fiscal_configurations AS config ON config.id = tax.configuration_id
     WHERE config.company_id = $1
       AND config.jurisdiction_code = 'VE'
       AND config.status = 'active'
       AND config.verified_at IS NOT NULL
       AND config.verified_by IS NOT NULL
       AND config.effective_from <= $2
       AND (config.effective_until IS NULL OR config.effective_until >= $2)
       AND rate.id = ANY($3::TEXT[])
       AND rate.active
       AND rate.effective_from <= $2
       AND (rate.effective_until IS NULL OR rate.effective_until >= $2)
       AND (cardinality(rate.applies_to_document_types) = 0
         OR $4 = ANY(rate.applies_to_document_types))
     ORDER BY rate.rate_code`,
    [companyId, date, rateIds, documentType],
  );
  if (result.rowCount !== new Set(rateIds).size) {
    throw httpError(409, 'Una o más tasas seleccionadas no están verificadas y vigentes para esta fecha y documento.');
  }
  return result.rows;
}

function getRateIds(snapshot) {
  if (!Array.isArray(snapshot)) throw httpError(400, 'La información fiscal de una línea no es válida.');
  const ids = snapshot.map((rate) => rate?.rate_id);
  if (ids.some((id) => typeof id !== 'string' || !id)) {
    throw httpError(400, 'La información fiscal de una línea contiene tasas inválidas.');
  }
  return [...new Set(ids)];
}

async function readDraftLines(client, companyId, documentId, date, minorDigits, fiscal = false) {
  const result = await client.query(
    `SELECT line.*, product.product_kind, product.sku, product.tracks_lots,
            product.tracks_serials, product.base_unit_id
     FROM commercial_document_lines AS line
     LEFT JOIN inventory_products AS product
       ON product.company_id = line.company_id AND product.id = line.product_id
     WHERE line.company_id = $1 AND line.document_id = $2
     ORDER BY line.line_number`,
    [companyId, documentId],
  );
  if (!result.rowCount) throw httpError(409, 'El documento no tiene líneas.');

  const output = [];
  for (const line of result.rows) {
    const rateIds = fiscal ? getRateIds(line.tax_snapshot) : [];
    const rates = fiscal
      ? await getActiveRates(client, companyId, date, rateIds)
      : [];
    const calculated = calculateValidatedLine({
      quantity: line.quantity,
      unitPrice: line.unit_price,
      discountAmount: line.discount_amount,
      rates,
      minorUnitDigits: minorDigits,
    });
    output.push({ ...line, rates, calculated });
  }
  return output;
}

async function insertCommercialLines(client, companyId, documentId, lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    await client.query(
      `INSERT INTO commercial_document_lines (
         id, company_id, document_id, line_number, product_id, unit_id,
         item_code_snapshot, description, quantity, unit_price,
         discount_amount, net_amount, tax_amount, gross_amount, tax_snapshot
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::JSONB)`,
      [
        randomUUID(), companyId, documentId, index + 1, line.productId || null,
        line.unitId || null, line.itemCode || null, line.description,
        line.quantity, line.unitPrice, line.discountAmount || '0',
        line.netAmount, line.taxAmount, line.grossAmount,
        JSON.stringify(line.taxSnapshot || []),
      ],
    );
  }
}

async function getParty(client, companyId, partyId) {
  const result = await client.query(
    `SELECT party.id, party.legal_name, party.trade_name, party.tax_identifier,
            party.fiscal_condition
     FROM business_parties AS party
     JOIN business_party_roles AS role
       ON role.company_id = party.company_id AND role.party_id = party.id
     WHERE party.company_id = $1 AND party.id = $2
       AND role.role = 'customer' AND role.active AND party.active`,
    [companyId, partyId],
  );
  if (!result.rowCount) throw httpError(404, 'El cliente no existe o está inactivo.');
  return result.rows[0];
}

async function getCompanyFiscalConfig(client, companyId, date) {
  const result = await client.query(
    `SELECT id, reporting_currency_code AS currency_code,
            minor_unit_digits, jurisdiction_code
     FROM fiscal_configurations
     WHERE company_id = $1 AND jurisdiction_code = 'VE' AND status = 'active'
       AND verified_at IS NOT NULL AND verified_by IS NOT NULL
       AND effective_from <= $2
       AND (effective_until IS NULL OR effective_until >= $2)
     FOR SHARE`,
    [companyId, date],
  );
  if (result.rowCount !== 1) {
    throw httpError(409, 'No hay una única configuración fiscal venezolana activa y verificada para la fecha seleccionada.');
  }
  const config = result.rows[0];
  if (Number(config.minor_unit_digits) > 2) {
    throw httpError(409, 'La precisión de la configuración fiscal supera la precisión del libro contable.');
  }
  const compliance = await client.query(
    `SELECT requirement_code
     FROM fiscal_compliance_requirements
     WHERE jurisdiction_code = 'VE'
       AND requirement_code IN (
         'DOC-INTEGRITY', 'EVENT-TRACEABILITY', 'NUMBER-SEQUENCES',
         'ACCESS-CONTROL', 'BACKUP-RESTORE'
       )
       AND verification_status <> 'passed'`,
  );
  if (compliance.rowCount) {
    throw httpError(409, 'Emisión bloqueada: verifique todos los requisitos fiscales y operativos pendientes antes de emitir.');
  }
  return config;
}

async function allocateCommercialNumber(client, companyId, branchId, type) {
  const result = await client.query(
    `INSERT INTO commercial_document_sequences (
       company_id, branch_scope_id, document_type, next_number
     ) VALUES ($1, COALESCE($2, ''), $3, 2)
     ON CONFLICT (company_id, branch_scope_id, document_type)
     DO UPDATE SET next_number = commercial_document_sequences.next_number + 1,
                   updated_at = CURRENT_TIMESTAMP
     RETURNING next_number - 1 AS document_number`,
    [companyId, branchId, type],
  );
  return result.rows[0].document_number;
}

async function createJournalEntry(client, companyId, userId, date, description, sourceDocumentId, lines) {
  const activeLines = lines.filter((line) => line.debit !== '0.00' || line.credit !== '0.00');
  if (activeLines.length < 2) return null;
  const periodResult = await client.query(
    `SELECT id FROM accounting_periods
     WHERE company_id = $1 AND status = 'open'
       AND start_date <= $2 AND end_date >= $2
     ORDER BY start_date DESC
     LIMIT 1 FOR UPDATE`,
    [companyId, date],
  );
  if (!periodResult.rowCount) throw httpError(409, 'No existe un período contable abierto para la fecha del documento.');
  const sequenceResult = await client.query(
    `INSERT INTO accounting_entry_sequences (company_id, sequence_year, next_number)
     VALUES ($1, EXTRACT(YEAR FROM $2::DATE)::SMALLINT, 2)
     ON CONFLICT (company_id, sequence_year)
     DO UPDATE SET next_number = accounting_entry_sequences.next_number + 1,
                   updated_at = CURRENT_TIMESTAMP
     RETURNING next_number - 1 AS document_number`,
    [companyId, date],
  );
  const entryId = randomUUID();
  const number = String(sequenceResult.rows[0].document_number).padStart(6, '0');
  const year = String(date).slice(0, 4);
  await client.query(
    `INSERT INTO journal_entries (
       id, company_id, entry_number, entry_date, accounting_period_id,
       description, created_by, source_commercial_document_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      entryId, companyId, `VTA-${year}-${number}`, date,
      periodResult.rows[0].id, description, userId, sourceDocumentId,
    ],
  );
  for (let index = 0; index < activeLines.length; index += 1) {
    const line = activeLines[index];
    await client.query(
      `INSERT INTO journal_lines (
         id, journal_entry_id, line_number, account_id, description, debit, credit
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        randomUUID(), entryId, index + 1, line.accountId,
        line.description, line.debit, line.credit,
      ],
    );
  }
  await client.query(
    `UPDATE journal_entries
       SET status = 'posted', posted_at = CURRENT_TIMESTAMP, posted_by = $2
     WHERE id = $1`,
    [entryId, userId],
  );
  return entryId;
}

async function getAccountMappings(client, companyId) {
  const result = await client.query(
    `SELECT receivable_account_id, revenue_account_id,
            tax_payable_account_id, inventory_account_id,
            cost_of_sales_account_id
     FROM commercial_account_mappings WHERE company_id = $1`,
    [companyId],
  );
  return result.rows[0] || {};
}

async function postCostOfSales(client, companyId, userId, document, movementId) {
  const result = await client.query(
    `SELECT COALESCE(SUM(line.quantity * line.unit_cost), 0)::NUMERIC(20,6)::TEXT AS cost
     FROM inventory_movement_lines AS line
     WHERE line.company_id = $1 AND line.movement_id = $2`,
    [companyId, movementId],
  );
  const cost = parseAmount(result.rows[0].cost, 'El costo del inventario');
  if (cost === 0n) return null;
  const mappings = await getAccountMappings(client, companyId);
  if (!mappings.inventory_account_id || !mappings.cost_of_sales_account_id) {
    throw httpError(409, 'Configure las cuentas de inventario y costo de ventas antes de despachar productos.');
  }
  const amount = formatCurrency(cost);
  return createJournalEntry(
    client, companyId, userId, document.document_date,
    `Costo de ventas ${document.document_type} ${document.id}`,
    document.id,
    [
      { accountId: mappings.cost_of_sales_account_id, description: 'Costo de ventas', debit: amount, credit: '0.00' },
      { accountId: mappings.inventory_account_id, description: 'Salida de inventario', debit: '0.00', credit: amount },
    ],
  );
}

async function postInventoryIssue(client, companyId, userId, document, warehouseId) {
  const lineResult = await client.query(
    `SELECT line.*, product.product_kind, product.tracks_lots,
            product.tracks_serials, product.base_unit_id
     FROM commercial_document_lines AS line
     JOIN inventory_products AS product
       ON product.company_id = line.company_id AND product.id = line.product_id
     WHERE line.company_id = $1 AND line.document_id = $2
     ORDER BY line.line_number`,
    [companyId, document.id],
  );
  const stockLines = lineResult.rows.filter((line) => line.product_kind === 'stock');
  if (!stockLines.length) return null;
  if (!warehouseId) throw httpError(409, 'Seleccione un almacén para despachar los productos.');
  if (stockLines.some((line) => line.tracks_lots || line.tracks_serials)) {
    throw httpError(409, 'El despacho de productos con lotes o seriales requiere la pantalla de trazabilidad de inventario.');
  }
  const mapping = await getAccountMappings(client, companyId);
  if (!mapping.inventory_account_id || !mapping.cost_of_sales_account_id) {
    throw httpError(409, 'Configure las cuentas de inventario y costo de ventas antes de despachar productos.');
  }
  const movementId = randomUUID();
  await client.query(
    `INSERT INTO inventory_movements (
       id, company_id, branch_id, movement_type, status, movement_date,
       source_module, source_document_id, description, created_by
     ) VALUES ($1,$2,$3,'issue','draft',$4,'commercial_sales',$5,$6,$7)`,
    [
      movementId, companyId, document.branch_id, document.document_date,
      document.id, `Despacho comercial ${document.id}`, userId,
    ],
  );
  for (let index = 0; index < stockLines.length; index += 1) {
    const line = stockLines[index];
    await client.query(
      `INSERT INTO inventory_movement_lines (
         id, company_id, movement_id, line_number, product_id, unit_id,
         quantity, unit_cost, source_warehouse_id, description
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$9)`,
      [
        randomUUID(), companyId, movementId, index + 1, line.product_id,
        line.unit_id, line.quantity, warehouseId, line.description,
      ],
    );
  }
  await client.query(
    `UPDATE inventory_movements
       SET status = 'posted', posted_by = $2
     WHERE company_id = $1 AND id = $3`,
    [companyId, userId, movementId],
  );
  await postCostOfSales(client, companyId, userId, document, movementId);
  return movementId;
}

async function recordFiscalEvent(client, companyId, userId, documentId, number, amount) {
  await client.query('SELECT 1 FROM companies WHERE id = $1 FOR UPDATE', [companyId]);
  const previous = await client.query(
    `SELECT sequence_number, event_hash FROM fiscal_events
     WHERE company_id = $1 ORDER BY sequence_number DESC LIMIT 1`,
    [companyId],
  );
  const sequence = Number(previous.rows[0]?.sequence_number || 0) + 1;
  const previousHash = previous.rows[0]?.event_hash || null;
  const event = {
    companyId,
    documentId,
    number: String(number),
    amount,
    sequence,
    previousHash,
    type: 'customer_invoice_issued',
  };
  const hash = createHash('sha256').update(JSON.stringify(event)).digest('hex');
  await client.query(
    `INSERT INTO fiscal_events (
       id, company_id, user_id, sequence_number, event_type,
       entity_type, entity_id, outcome, details, previous_hash, event_hash
     ) VALUES ($1,$2,$3,$4,'customer_invoice_issued','fiscal_document',$5,
               'success',$6::JSONB,$7,$8)`,
    [
      randomUUID(), companyId, userId, sequence, documentId,
      JSON.stringify({ document_number: String(number), amount }),
      previousHash, hash,
    ],
  );
}

async function issueFiscalInvoice(client, user, document, lines, party) {
  const config = await getCompanyFiscalConfig(client, user.company_id, document.document_date);
  if (document.currency_code !== config.currency_code) {
    throw httpError(409, 'La primera entrega contabiliza únicamente en la moneda de reporte configurada.');
  }
  if (!party.fiscal_condition) {
    throw httpError(409, 'Complete la condición fiscal del cliente con sus datos verificados antes de emitir.');
  }
  const seriesResult = await client.query(
    `SELECT series.id, series.configuration_id, series.branch_id,
            series.document_type
     FROM fiscal_series AS series
     WHERE series.company_id = $1
       AND series.configuration_id = $2
       AND series.document_type = 'invoice'
       AND series.active
       AND series.branch_id IS NOT DISTINCT FROM $3
     ORDER BY series.created_at, series.id
     LIMIT 1 FOR UPDATE`,
    [user.company_id, config.id, document.branch_id],
  );
  if (!seriesResult.rowCount) {
    throw httpError(409, 'No existe una serie de facturación activa para la empresa y sucursal seleccionadas.');
  }
  const series = seriesResult.rows[0];
  const fiscalNumber = await client.query(
    'SELECT allocate_fiscal_number($1) AS document_number',
    [series.id],
  );
  const fiscalNumberValue = fiscalNumber.rows[0].document_number;
  const fiscalId = randomUUID();
  const netAmount = lines.reduce((sum, line) => sum + line.calculated.netMicros, 0n);
  const taxAmount = lines.reduce((sum, line) => sum + line.calculated.taxMicros, 0n);
  const grossAmount = netAmount + taxAmount;
  const totals = {
    net: formatAmount(netAmount),
    tax: formatAmount(taxAmount),
    gross: formatAmount(grossAmount),
  };

  await client.query(
    `INSERT INTO fiscal_documents (
       id, company_id, branch_id, configuration_id, series_id,
       document_type, document_number, issue_date, counterparty_id,
       counterparty_name, counterparty_tax_id, counterparty_condition,
       currency_code, minor_unit_digits, net_amount, tax_amount,
       gross_amount, status, calculation_snapshot, commercial_document_id,
       created_by, issued_by, issued_at
     ) VALUES (
       $1,$2,$3,$4,$5,'invoice',$6,$7,$8,$9,$10,$11,$12,$13,
       $14,$15,$16,'draft',$17::JSONB,$18,$19,$19,CURRENT_TIMESTAMP
     )`,
    [
      fiscalId, user.company_id, document.branch_id, config.id, series.id,
      fiscalNumberValue, document.document_date, party.id,
      party.trade_name || party.legal_name, party.tax_identifier,
      party.fiscal_condition, config.currency_code, config.minor_unit_digits,
      totals.net, totals.tax, totals.gross, JSON.stringify({
        currency_code: config.currency_code,
        minor_unit_digits: config.minor_unit_digits,
        rates: lines.flatMap((line) => line.calculated.taxSnapshot),
      }), document.id, user.id,
    ],
  );

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    await client.query(
      `INSERT INTO fiscal_document_lines (
         id, fiscal_document_id, line_number, product_service_code,
         description, quantity, unit_price, discount_amount, taxable_base,
         tax_amount, gross_amount, tax_snapshot
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::JSONB)`,
      [
        randomUUID(), fiscalId, index + 1, line.item_code_snapshot,
        line.description, line.calculated.quantity, line.calculated.unitPrice,
        line.calculated.discountAmount, line.calculated.netAmount,
        line.calculated.taxAmount, line.calculated.grossAmount,
        JSON.stringify(line.calculated.taxSnapshot),
      ],
    );
  }
  await client.query(
    `UPDATE fiscal_documents
       SET status = 'issued', issued_by = $2, issued_at = CURRENT_TIMESTAMP
     WHERE company_id = $1 AND id = $3`,
    [user.company_id, user.id, fiscalId],
  );
  await client.query(
    `INSERT INTO commercial_fiscal_document_links (
       company_id, commercial_document_id, fiscal_document_id, created_by
     ) VALUES ($1,$2,$3,$4)`,
    [user.company_id, document.id, fiscalId, user.id],
  );
  await recordFiscalEvent(
    client, user.company_id, user.id, fiscalId, fiscalNumberValue, totals.gross,
  );
  return { id: fiscalId, number: String(fiscalNumberValue), totals };
}

async function bootstrap(client, user) {
  const [
    companyResult, branches, parties, products, units, warehouses, accounts,
    periods, fiscalConfig, rates, series, mappings, valuation,
  ] = await Promise.all([
    client.query(
      `SELECT id, legal_name, trade_name, rif FROM companies
       WHERE id = $1 AND active`,
      [user.company_id],
    ),
    client.query(
      `SELECT id, name, address FROM branches
       WHERE company_id = $1 AND active ORDER BY name`,
      [user.company_id],
    ),
    client.query(
      `SELECT party.id, party.legal_name, party.trade_name,
              party.tax_identifier, party.fiscal_condition
       FROM business_parties party
       JOIN business_party_roles role
         ON role.company_id = party.company_id AND role.party_id = party.id
       WHERE party.company_id = $1 AND party.active
         AND role.role = 'customer' AND role.active
       ORDER BY party.legal_name`,
      [user.company_id],
    ),
    client.query(
      `SELECT product.id, product.sku, product.name, product.product_kind,
              product.base_unit_id, product.tracks_lots, product.tracks_serials,
              unit.name AS unit_name
       FROM inventory_products product
       JOIN inventory_units unit
         ON unit.company_id = product.company_id AND unit.id = product.base_unit_id
       WHERE product.company_id = $1 AND product.active AND unit.active
       ORDER BY product.name`,
      [user.company_id],
    ),
    client.query(
      `SELECT id, code, name, precision FROM inventory_units
       WHERE company_id = $1 AND active ORDER BY name`,
      [user.company_id],
    ),
    client.query(
      `SELECT id, code, name, branch_id FROM inventory_warehouses
       WHERE company_id = $1 AND active ORDER BY name`,
      [user.company_id],
    ),
    client.query(
      `SELECT id, code, name, account_type FROM accounting_accounts
       WHERE company_id = $1 AND active AND NOT is_group ORDER BY code`,
      [user.company_id],
    ),
    client.query(
      `SELECT id, name, start_date, end_date FROM accounting_periods
       WHERE company_id = $1 AND status = 'open' ORDER BY start_date DESC`,
      [user.company_id],
    ),
    client.query(
      `SELECT id, reporting_currency_code AS currency_code, minor_unit_digits
       FROM fiscal_configurations
       WHERE company_id = $1 AND jurisdiction_code = 'VE'
         AND status = 'active' AND verified_at IS NOT NULL
         AND verified_by IS NOT NULL
       ORDER BY effective_from DESC LIMIT 1`,
      [user.company_id],
    ),
    client.query(
      `SELECT rate.id, rate.rate_code AS code, rate.rate_percent::TEXT AS rate_percent,
              rate.is_exempt, rate.legal_source_reference, tax.name, tax.tax_kind
       FROM fiscal_tax_rates rate
       JOIN fiscal_taxes tax ON tax.id = rate.tax_id
       JOIN fiscal_configurations config ON config.id = tax.configuration_id
       WHERE config.company_id = $1 AND config.jurisdiction_code = 'VE'
         AND config.status = 'active' AND config.verified_at IS NOT NULL
         AND config.verified_by IS NOT NULL
         AND config.effective_from <= CURRENT_DATE
         AND (config.effective_until IS NULL OR config.effective_until >= CURRENT_DATE)
         AND rate.active AND rate.effective_from <= CURRENT_DATE
         AND (rate.effective_until IS NULL OR rate.effective_until >= CURRENT_DATE)
       ORDER BY tax.tax_kind, rate.rate_code`,
      [user.company_id],
    ),
    client.query(
      `SELECT series.id, series.series_code, series.branch_id
       FROM fiscal_series series
       JOIN fiscal_configurations config
         ON config.company_id = series.company_id
        AND config.id = series.configuration_id
       WHERE series.company_id = $1 AND series.active
         AND series.document_type = 'invoice'
         AND config.jurisdiction_code = 'VE' AND config.status = 'active'
         AND config.verified_at IS NOT NULL AND config.verified_by IS NOT NULL
         AND config.effective_from <= CURRENT_DATE
         AND (config.effective_until IS NULL OR config.effective_until >= CURRENT_DATE)
       ORDER BY series.series_code`,
      [user.company_id],
    ),
    getAccountMappings(client, user.company_id),
    client.query(
      `SELECT valuation.warehouse_id, warehouse.name AS warehouse_name,
              valuation.product_id, product.sku, product.name AS product_name,
              valuation.quantity_on_hand::TEXT, valuation.inventory_value::TEXT,
              valuation.average_unit_cost::TEXT, valuation.is_initialized
       FROM inventory_valuation_balances valuation
       JOIN inventory_warehouses warehouse
         ON warehouse.company_id = valuation.company_id AND warehouse.id = valuation.warehouse_id
       JOIN inventory_products product
         ON product.company_id = valuation.company_id AND product.id = valuation.product_id
       WHERE valuation.company_id = $1
       ORDER BY warehouse.name, product.name`,
      [user.company_id],
    ),
  ]);

  return {
    company: companyResult.rows[0] || null,
    currentUserBranchId: user.branch_id,
    branches: branches.rows,
    parties: parties.rows,
    products: products.rows,
    units: units.rows,
    warehouses: warehouses.rows,
    accounts: accounts.rows,
    periods: periods.rows,
    fiscalConfiguration: fiscalConfig.rows[0] || null,
    taxRates: rates.rows,
    invoiceSeries: series.rows,
    accountMappings: mappings,
    valuations: valuation.rows,
  };
}

function createCommercialSalesRouter(authMiddleware, pool) {
  const router = express.Router();
  router.use(authMiddleware);

  router.get('/bootstrap', async (req, res) => {
    try {
      const data = await withUserTransaction(pool, req, (client, user) => bootstrap(client, user));
      res.json(data);
    } catch (error) {
      sendError(res, error, 'No se pudo cargar la configuración comercial');
    }
  });

  router.get('/documents', async (req, res) => {
    try {
      const result = await withUserTransaction(pool, req, async (client, user) => {
        return client.query(
          `SELECT document.id, document.document_type, document.document_number,
                  document.document_date, document.due_date, document.status,
                  document.currency_code, document.party_name_snapshot,
                  document.net_amount::TEXT, document.tax_amount::TEXT,
                  document.gross_amount::TEXT,
                  fiscal.document_number AS fiscal_document_number,
                  fiscal.series_id AS fiscal_series_id
           FROM commercial_documents document
           LEFT JOIN commercial_fiscal_document_links link
             ON link.company_id = document.company_id
            AND link.commercial_document_id = document.id
           LEFT JOIN fiscal_documents fiscal
             ON fiscal.company_id = link.company_id AND fiscal.id = link.fiscal_document_id
           WHERE document.company_id = $1 AND document.document_type = ANY($2::TEXT[])
           ORDER BY document.document_date DESC, document.created_at DESC
           LIMIT 200`,
          [user.company_id, [...DOCUMENT_TYPES]],
        );
      });
      res.json({ documents: result.rows });
    } catch (error) {
      sendError(res, error, 'No se pudieron cargar los documentos comerciales');
    }
  });

  router.put('/account-mappings', async (req, res) => {
    const body = req.body || {};
    const keys = [
      'receivable_account_id', 'revenue_account_id', 'tax_payable_account_id',
      'inventory_account_id', 'cost_of_sales_account_id',
    ];
    if (keys.some((key) => body[key] != null && typeof body[key] !== 'string')) {
      return res.status(400).json({ error: 'Las cuentas deben seleccionarse desde el plan contable.' });
    }
    try {
      await withUserTransaction(pool, req, async (client, user) => {
        await client.query(
          `INSERT INTO commercial_account_mappings (
             company_id, receivable_account_id, revenue_account_id,
             tax_payable_account_id, inventory_account_id,
             cost_of_sales_account_id, updated_by
           ) VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (company_id) DO UPDATE SET
             receivable_account_id = EXCLUDED.receivable_account_id,
             revenue_account_id = EXCLUDED.revenue_account_id,
             tax_payable_account_id = EXCLUDED.tax_payable_account_id,
             inventory_account_id = EXCLUDED.inventory_account_id,
             cost_of_sales_account_id = EXCLUDED.cost_of_sales_account_id,
             updated_by = EXCLUDED.updated_by,
             updated_at = CURRENT_TIMESTAMP`,
          [user.company_id, ...keys.map((key) => body[key] || null), user.id],
        );
      });
      res.json({ ok: true });
    } catch (error) {
      sendError(res, error, 'No se pudieron guardar las cuentas comerciales');
    }
  });

  router.post('/inventory/opening-balances', async (req, res) => {
    const body = req.body || {};
    if (typeof body.productId !== 'string' || typeof body.warehouseId !== 'string') {
      return res.status(400).json({ error: 'Seleccione un producto y un almacén.' });
    }
    try {
      let quantity;
      let averageCost;
      try {
        quantity = parseAmount(body.quantity, 'La existencia inicial');
        averageCost = parseAmount(body.averageUnitCost, 'El costo promedio inicial');
      } catch (error) {
        throw httpError(400, error.message);
      }
      if (quantity === 0n && averageCost !== 0n) {
        throw httpError(400, 'Una existencia inicial en cero debe tener costo promedio cero.');
      }
      const inventoryValue = roundToMinorUnits(
        (quantity * averageCost + SCALE / 2n) / SCALE,
        6,
      );
      const balance = await withUserTransaction(pool, req, async (client, user) => {
        const product = await client.query(
          `SELECT id FROM inventory_products
           WHERE company_id = $1 AND id = $2 AND active
             AND product_kind = 'stock'
             AND NOT tracks_lots AND NOT tracks_serials`,
          [user.company_id, body.productId],
        );
        if (!product.rowCount) {
          throw httpError(409, 'Solo se admiten productos de inventario activos sin lotes ni seriales.');
        }
        const warehouse = await client.query(
          `SELECT id FROM inventory_warehouses
           WHERE company_id = $1 AND id = $2 AND active`,
          [user.company_id, body.warehouseId],
        );
        if (!warehouse.rowCount) throw httpError(404, 'El almacén no existe o está inactivo.');
        const result = await client.query(
          `INSERT INTO inventory_valuation_balances (
             id, company_id, warehouse_id, product_id, quantity_on_hand,
             inventory_value, average_unit_cost, is_initialized
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE)
           ON CONFLICT (company_id, warehouse_id, product_id) DO UPDATE
             SET quantity_on_hand = EXCLUDED.quantity_on_hand,
                 inventory_value = EXCLUDED.inventory_value,
                 average_unit_cost = EXCLUDED.average_unit_cost,
                 is_initialized = TRUE,
                 updated_at = CURRENT_TIMESTAMP
             WHERE inventory_valuation_balances.is_initialized = FALSE
               AND inventory_valuation_balances.quantity_on_hand = 0
               AND inventory_valuation_balances.inventory_value = 0
           RETURNING warehouse_id, product_id, quantity_on_hand::TEXT,
                     inventory_value::TEXT, average_unit_cost::TEXT, is_initialized`,
          [
            randomUUID(), user.company_id, body.warehouseId, body.productId,
            formatAmount(quantity), formatAmount(inventoryValue), formatAmount(averageCost),
          ],
        );
        if (!result.rowCount) {
          throw httpError(409, 'El saldo ya fue inicializado o tiene movimientos; no se permite sobrescribir su costo.');
        }
        return result.rows[0];
      });
      res.status(201).json({ balance });
    } catch (error) {
      sendError(res, error, 'No se pudo registrar el saldo inicial de inventario');
    }
  });

  router.post('/parties', async (req, res) => {
    const { partyKind, legalName, tradeName, taxIdentifier, fiscalCondition, email, phone } = req.body || {};
    if (!['person', 'organization'].includes(partyKind)
      || typeof legalName !== 'string' || !legalName.trim()
      || typeof fiscalCondition !== 'string' || !fiscalCondition.trim()) {
      return res.status(400).json({ error: 'Indique tipo, razón social y condición fiscal verificada del cliente.' });
    }
    try {
      const party = await withUserTransaction(pool, req, async (client, user) => {
        const id = randomUUID();
        await client.query(
          `INSERT INTO business_parties (
             id, company_id, party_kind, legal_name, trade_name,
             tax_identifier, fiscal_condition, email, phone
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            id, user.company_id, partyKind, legalName.trim(),
            typeof tradeName === 'string' ? tradeName.trim() || null : null,
            typeof taxIdentifier === 'string' ? taxIdentifier.trim() || null : null,
            fiscalCondition.trim(),
            typeof email === 'string' ? email.trim() : '',
            typeof phone === 'string' ? phone.trim() : '',
          ],
        );
        await client.query(
          `INSERT INTO business_party_roles (company_id, party_id, role)
           VALUES ($1,$2,'customer')`,
          [user.company_id, id],
        );
        return { id, legal_name: legalName.trim(), trade_name: tradeName || null, tax_identifier: taxIdentifier || null, fiscal_condition: fiscalCondition.trim() };
      });
      res.status(201).json({ party });
    } catch (error) {
      sendError(res, error, 'No se pudo crear el cliente');
    }
  });

  router.post('/documents', async (req, res) => {
    const body = req.body || {};
    if (!Array.isArray(body.lines) || body.lines.length === 0
      || typeof body.partyId !== 'string'
      || typeof body.documentDate !== 'string'
      || !/^\d{4}-\d{2}-\d{2}$/.test(body.documentDate)) {
      return res.status(400).json({ error: 'Cliente, fecha y al menos una línea válida son obligatorios.' });
    }
    try {
      const document = await withUserTransaction(pool, req, async (client, user) => {
        const party = await getParty(client, user.company_id, body.partyId);
        const date = body.documentDate;
        const config = await client.query(
          `SELECT reporting_currency_code AS currency_code, minor_unit_digits
           FROM fiscal_configurations
           WHERE company_id = $1 AND jurisdiction_code = 'VE' AND status = 'active'
             AND verified_at IS NOT NULL AND verified_by IS NOT NULL
             AND effective_from <= $2
             AND (effective_until IS NULL OR effective_until >= $2)
           ORDER BY effective_from DESC LIMIT 1`,
          [user.company_id, date],
        );
        const currencyCode = config.rows[0]?.currency_code || body.currencyCode || 'VES';
        const minorDigits = Number(config.rows[0]?.minor_unit_digits ?? 2);
        if (minorDigits > 2) throw httpError(409, 'La precisión monetaria configurada supera la precisión contable disponible.');
        const lines = [];
        for (const input of body.lines) {
          if (typeof input.description !== 'string' || !input.description.trim()) {
            throw httpError(400, 'Cada línea debe tener una descripción.');
          }
          let product = null;
          if (input.productId) {
            const productResult = await client.query(
              `SELECT product.id, product.sku, product.base_unit_id,
                      product.product_kind, product.tracks_lots, product.tracks_serials,
                      product.name
               FROM inventory_products product
               WHERE product.company_id = $1 AND product.id = $2 AND product.active`,
              [user.company_id, input.productId],
            );
            product = productResult.rows[0];
            if (!product) throw httpError(404, 'Uno de los productos no existe o está inactivo.');
            if (input.unitId && input.unitId !== product.base_unit_id) {
              throw httpError(400, 'La unidad debe ser la unidad base del producto.');
            }
          }
          if (input.taxRateIds != null
            && (!Array.isArray(input.taxRateIds)
              || input.taxRateIds.some((id) => typeof id !== 'string' || !id))) {
            throw httpError(400, 'Seleccione tasas fiscales válidas para la línea.');
          }
          const rateIds = Array.isArray(input.taxRateIds) ? [...new Set(input.taxRateIds)] : [];
          const rates = await getActiveRates(client, user.company_id, date, rateIds);
          const calculated = calculateValidatedLine({
            quantity: input.quantity,
            unitPrice: input.unitPrice,
            discountAmount: input.discountAmount || '0',
            rates,
            minorUnitDigits: minorDigits,
          });
          lines.push({
            productId: product?.id || null,
            unitId: product?.base_unit_id || null,
            itemCode: product?.sku || null,
            description: input.description.trim(),
            ...calculated,
          });
        }
        const totals = lines.reduce((acc, line) => ({
          net: acc.net + line.netMicros,
          tax: acc.tax + line.taxMicros,
          gross: acc.gross + line.grossMicros,
        }), { net: 0n, tax: 0n, gross: 0n });
        const id = randomUUID();
        const branchId = body.branchId || user.branch_id || null;
        const warehouseId = body.warehouseId || null;
        await client.query(
          `INSERT INTO commercial_documents (
             id, company_id, branch_id, document_type, party_role, party_id,
             document_date, due_date, currency_code, minor_unit_digits,
             party_name_snapshot, party_tax_id_snapshot, description,
             payment_terms, net_amount, tax_amount, gross_amount, metadata,
             created_by, updated_by
           ) VALUES (
             $1,$2,$3,'sales_quote','customer',$4,$5,$6,$7,$8,
             $9,$10,$11,$12,$13,$14,$15,$16::JSONB,$17,$17
           )`,
          [
            id, user.company_id, branchId, party.id, date,
            body.dueDate || null, currencyCode, minorDigits,
            party.trade_name || party.legal_name, party.tax_identifier,
            typeof body.description === 'string' ? body.description.trim() : '',
            typeof body.paymentTerms === 'string' ? body.paymentTerms.trim() : '',
            formatAmount(totals.net),
            formatAmount(totals.tax),
            formatAmount(totals.gross),
            JSON.stringify({ warehouseId }),
            user.id,
          ],
        );
        await insertCommercialLines(client, user.company_id, id, lines);
        return { id, documentType: 'sales_quote', status: 'draft' };
      });
      res.status(201).json({ document });
    } catch (error) {
      sendError(res, error, 'No se pudo crear el presupuesto');
    }
  });

  router.post('/documents/:id/convert', async (req, res) => {
    const body = req.body || {};
    const { targetType } = body;
    if (!['delivery_note', 'customer_invoice'].includes(targetType)) {
      return res.status(400).json({ error: 'El tipo destino debe ser nota de entrega o factura.' });
    }
    try {
      const document = await withUserTransaction(pool, req, async (client, user) => {
        const sourceResult = await client.query(
          `SELECT * FROM commercial_documents
           WHERE company_id = $1 AND id = $2 FOR UPDATE`,
          [user.company_id, req.params.id],
        );
        const source = sourceResult.rows[0];
        if (!source || source.status !== 'issued') throw httpError(409, 'Solo se convierten documentos emitidos.');
        if (!(
          (source.document_type === 'sales_quote')
          || (source.document_type === 'delivery_note' && targetType === 'customer_invoice')
        )) {
          throw httpError(409, 'La conversión solicitada no está permitida para este documento.');
        }
        if (source.document_type === 'sales_quote') {
          const linked = await client.query(
            `SELECT 1 FROM commercial_document_links
             WHERE company_id = $1 AND source_document_id = $2`,
            [user.company_id, source.id],
          );
          if (linked.rowCount) throw httpError(409, 'El presupuesto ya fue convertido y no puede facturarse de nuevo.');
        }
        if (source.document_type === 'delivery_note') {
          const linked = await client.query(
            `SELECT 1 FROM commercial_document_links
             WHERE company_id = $1 AND source_document_id = $2 AND link_kind = 'references'`,
            [user.company_id, source.id],
          );
          if (linked.rowCount) throw httpError(409, 'La nota de entrega ya fue facturada.');
        }
        const id = randomUUID();
        const metadata = typeof source.metadata === 'object' && source.metadata
          ? source.metadata : {};
        const warehouseId = body.warehouseId || metadata.warehouseId || null;
        const status = 'draft';
        await client.query(
          `INSERT INTO commercial_documents (
             id, company_id, branch_id, document_type, party_role, party_id,
             document_date, due_date, currency_code, minor_unit_digits,
             party_name_snapshot, party_tax_id_snapshot, description,
             payment_terms, net_amount, tax_amount, gross_amount, metadata,
             created_by, updated_by
           ) VALUES (
             $1,$2,$3,$4,'customer',$5,CURRENT_DATE,$6,$7,$8,$9,$10,
             $11,$12,$13,$14,$15,$16::JSONB,$17,$17
           )`,
          [
            id, user.company_id, source.branch_id, targetType, source.party_id,
            source.due_date, source.currency_code, source.minor_unit_digits,
            source.party_name_snapshot, source.party_tax_id_snapshot,
            source.description, source.payment_terms, 0, 0, 0,
            JSON.stringify({ ...metadata, warehouseId }), user.id,
          ],
        );
        const sourceLines = await client.query(
          `SELECT * FROM commercial_document_lines
           WHERE company_id = $1 AND document_id = $2 ORDER BY line_number`,
          [user.company_id, source.id],
        );
        let net = 0n;
        let tax = 0n;
        let gross = 0n;
        const convertedLines = [];
        for (const line of sourceLines.rows) {
          const rates = targetType === 'customer_invoice'
            ? await getActiveRates(
              client, user.company_id, new Date().toISOString().slice(0, 10),
              getRateIds(line.tax_snapshot),
            )
            : [];
          const calculated = calculateValidatedLine({
            quantity: line.quantity,
            unitPrice: line.unit_price,
            discountAmount: line.discount_amount,
            rates,
            minorUnitDigits: Number(source.minor_unit_digits),
          });
          net += calculated.netMicros;
          tax += calculated.taxMicros;
          gross += calculated.grossMicros;
          convertedLines.push({
            productId: line.product_id, unitId: line.unit_id,
            itemCode: line.item_code_snapshot, description: line.description,
            quantity: calculated.quantity, unitPrice: calculated.unitPrice,
            discountAmount: calculated.discountAmount, netAmount: calculated.netAmount,
            taxAmount: calculated.taxAmount, grossAmount: calculated.grossAmount,
            taxSnapshot: targetType === 'delivery_note'
              ? line.tax_snapshot : calculated.taxSnapshot,
          });
        }
        await client.query(
          `UPDATE commercial_documents
           SET net_amount = $3, tax_amount = $4, gross_amount = $5
           WHERE company_id = $1 AND id = $2`,
          [
            user.company_id, id, formatAmount(net),
            formatAmount(tax), formatAmount(gross),
          ],
        );
        await insertCommercialLines(client, user.company_id, id, convertedLines);
        await client.query(
          `INSERT INTO commercial_document_links (
             company_id, source_document_id, target_document_id, link_kind, created_by
           ) VALUES ($1,$2,$3,$4,$5)`,
          [
            user.company_id, source.id, id,
            source.document_type === 'sales_quote' ? 'fulfills' : 'references',
            user.id,
          ],
        );
        return { id, documentType: targetType, status, warehouseId };
      });
      res.status(201).json({ document });
    } catch (error) {
      sendError(res, error, 'No se pudo convertir el documento');
    }
  });

  router.post('/documents/:id/issue', async (req, res) => {
    try {
      const issued = await withUserTransaction(pool, req, async (client, user) => {
        const result = await client.query(
          `SELECT * FROM commercial_documents
           WHERE company_id = $1 AND id = $2 FOR UPDATE`,
          [user.company_id, req.params.id],
        );
        const document = result.rows[0];
        if (!document) throw httpError(404, 'Documento comercial no encontrado.');
        if (document.status !== 'draft') throw httpError(409, 'Solo se pueden emitir documentos en borrador.');
        if (!DOCUMENT_TYPES.has(document.document_type)) throw httpError(409, 'Tipo de documento no admitido.');
        const party = await getParty(client, user.company_id, document.party_id);
        const isInvoice = document.document_type === 'customer_invoice';
        let lines = await readDraftLines(
          client, user.company_id, document.id, document.document_date,
          Number(document.minor_unit_digits), document.document_type !== 'delivery_note',
        );
        const totals = lines.reduce((acc, line) => ({
          net: acc.net + line.calculated.netMicros,
          tax: acc.tax + line.calculated.taxMicros,
          gross: acc.gross + line.calculated.grossMicros,
        }), { net: 0n, tax: 0n, gross: 0n });
        for (const line of lines) {
          await client.query(
            `UPDATE commercial_document_lines
             SET net_amount = $3, tax_amount = $4, gross_amount = $5,
                 tax_snapshot = $6::JSONB
             WHERE company_id = $1 AND id = $2`,
            [
              user.company_id, line.id, line.calculated.netAmount,
              line.calculated.taxAmount, line.calculated.grossAmount,
              JSON.stringify(
                document.document_type === 'delivery_note'
                  ? line.tax_snapshot : line.calculated.taxSnapshot,
              ),
            ],
          );
        }
        const number = isInvoice
          ? null
          : await allocateCommercialNumber(
            client, user.company_id, document.branch_id, document.document_type,
          );
        let fiscalInvoice = null;
        let movementId = null;
        const metadata = typeof document.metadata === 'object' && document.metadata
          ? document.metadata : {};
        if (isInvoice) {
          fiscalInvoice = await issueFiscalInvoice(client, user, document, lines, party);
        }
        const sourceLink = await client.query(
          `SELECT source.id, source.document_type, source.status
           FROM commercial_document_links link
           JOIN commercial_documents source
             ON source.company_id = link.company_id AND source.id = link.source_document_id
           WHERE link.company_id = $1 AND link.target_document_id = $2
           ORDER BY link.created_at LIMIT 1`,
          [user.company_id, document.id],
        );
        const isFromDeliveryNote = sourceLink.rows[0]?.document_type === 'delivery_note';
        if (document.document_type === 'delivery_note' || (isInvoice && !isFromDeliveryNote)) {
          movementId = await postInventoryIssue(
            client, user.company_id, user.id, document, metadata.warehouseId,
          );
        }
        await client.query(
          `UPDATE commercial_documents
           SET status = 'issued', document_number = COALESCE($3, $4),
               net_amount = $5, tax_amount = $6, gross_amount = $7,
               updated_by = $2, issued_by = $2, issued_at = CURRENT_TIMESTAMP
           WHERE company_id = $1 AND id = $8`,
          [
            user.company_id, user.id, number,
            fiscalInvoice?.number || null,
            formatAmount(totals.net), formatAmount(totals.tax),
            formatAmount(totals.gross), document.id,
          ],
        );

        if (isInvoice) {
          const mappings = await getAccountMappings(client, user.company_id);
          if (!mappings.receivable_account_id || !mappings.revenue_account_id) {
            throw httpError(409, 'Configure las cuentas de clientes por cobrar e ingresos antes de emitir facturas.');
          }
          if (totals.tax > 0n && !mappings.tax_payable_account_id) {
            throw httpError(409, 'Configure la cuenta de impuestos por pagar antes de emitir una factura gravada.');
          }
          const debit = formatCurrency(totals.gross, Number(document.minor_unit_digits));
          const revenue = formatCurrency(totals.net, Number(document.minor_unit_digits));
          const tax = formatCurrency(totals.tax, Number(document.minor_unit_digits));
          await createJournalEntry(
            client, user.company_id, user.id, document.document_date,
            `Factura ${fiscalInvoice.number}`, document.id,
            [
              { accountId: mappings.receivable_account_id, description: 'Clientes por cobrar', debit, credit: '0.00' },
              ...(totals.net > 0n ? [{
                accountId: mappings.revenue_account_id,
                description: 'Ingresos por ventas', debit: '0.00', credit: revenue,
              }] : []),
              ...(totals.tax > 0n ? [{
                accountId: mappings.tax_payable_account_id,
                description: 'Impuestos por pagar', debit: '0.00', credit: tax,
              }] : []),
            ],
          );
        }
        if (movementId) {
          const movement = await client.query(
            `SELECT id FROM inventory_movements
             WHERE company_id = $1 AND source_document_id = $2 AND id = $3`,
            [user.company_id, document.id, movementId],
          );
          if (!movement.rowCount) throw new Error('No se pudo verificar el movimiento de inventario creado.');
        }
        return {
          id: document.id, documentType: document.document_type,
          documentNumber: String(fiscalInvoice?.number || number),
          fiscalInvoice, inventoryMovementId: movementId,
        };
      });
      res.json({ document: issued });
    } catch (error) {
      sendError(res, error, 'No se pudo emitir el documento comercial');
    }
  });

  return router;
}

module.exports = { createCommercialSalesRouter };
