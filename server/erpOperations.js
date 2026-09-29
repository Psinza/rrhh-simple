'use strict';

const express = require('express');
const ExcelJS = require('exceljs');
const { createHash, randomUUID } = require('node:crypto');

const FINANCE_ROLES = new Set(['admin_sistema', 'dueno']);
const HR_ROLES = new Set(['admin_sistema', 'dueno', 'rrhh']);
const FINANCE_REPORTS = new Set([
  'trial_balance',
  'balance_sheet',
  'income_statement',
  'general_ledger',
]);
const CONDITIONS = new Set(['new', 'good', 'fair', 'damaged']);

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
  return res.status(500).json({ error: 'No se pudo completar la operación ERP.' });
}

async function withUserTransaction(pool, req, allowedRoles, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT id, company_id, branch_id, rol, nombre
       FROM users
       WHERE id = $1 AND is_active = TRUE
       FOR SHARE`,
      [req.user.id],
    );
    const user = result.rows[0];
    if (!user || !user.company_id) {
      throw httpError(403, 'El usuario no tiene una empresa activa asignada en PostgreSQL.');
    }
    if (!allowedRoles.has(user.rol)) {
      throw httpError(403, 'El rol no tiene acceso a esta operación.');
    }
    await client.query(
      `SELECT set_config('app.user_id', $1, TRUE),
              set_config('app.client_ip', $2, TRUE)`,
      [user.id, req.ip || ''],
    );
    const value = await work(client, user);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function requiredText(value, label, maxLength = 250) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw httpError(400, `${label} es obligatorio y debe tener hasta ${maxLength} caracteres.`);
  }
  return value.trim();
}

function validDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw httpError(400, `${label} debe tener formato AAAA-MM-DD.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw httpError(400, `${label} no es una fecha válida.`);
  }
  return value;
}

function positiveNumber(value, label, allowZero = false) {
  const number = Number(value);
  if (!Number.isFinite(number) || (allowZero ? number < 0 : number <= 0)) {
    throw httpError(400, `${label} debe ser ${allowZero ? 'mayor o igual a cero' : 'mayor que cero'}.`);
  }
  return number;
}

function money2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function currencyCode(value) {
  if (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value)) {
    throw httpError(400, 'La moneda debe ser un código ISO 4217 de tres letras en mayúsculas.');
  }
  return value;
}

function normalizeEmployee(employee) {
  if (!employee || typeof employee !== 'object' || Array.isArray(employee)) {
    throw httpError(400, 'Cada empleado debe ser un objeto válido.');
  }
  const contractMap = { indeterminado: 'indeterminado', determinado: 'determinado', obra: 'obra' };
  const statusMap = {
    activo: 'activo', Activo: 'activo',
    vacaciones: 'vacaciones', Vacaciones: 'vacaciones',
    reposo: 'reposo', Reposo: 'reposo',
    egresado: 'egresado', Egresado: 'egresado',
  };
  const currencyMap = { BS: 'BS', VES: 'BS', USD: 'USD' };
  const frequencyMap = {
    semanal: 'semanal', quincenal: 'quincenal', mensual: 'mensual',
    Semanal: 'semanal', Quincenal: 'quincenal', Mensual: 'mensual',
  };
  const contractType = contractMap[employee.tipoContrato];
  const status = statusMap[employee.status];
  const nationality = String(employee.nacionalidad || '').toUpperCase();
  const sex = String(employee.sexo || '').toUpperCase();
  const salaryCurrency = currencyMap[employee.salarioMoneda || 'BS'];
  const foodCurrency = currencyMap[employee.cestaticketMoneda || 'BS'];
  const payFrequency = frequencyMap[employee.frecuenciaPago];
  if (!contractType || !status || !['V', 'E'].includes(nationality)
    || !['M', 'F'].includes(sex) || !salaryCurrency || !foodCurrency || !payFrequency) {
    throw httpError(400, 'El empleado contiene un tipo de contrato, estado, sexo, moneda o frecuencia de pago no admitidos.');
  }

  const numeric = (value, label, fallback = 0) => {
    const result = value === undefined || value === null || value === '' ? fallback : Number(value);
    if (!Number.isFinite(result) || result < 0) throw httpError(400, `${label} debe ser un número no negativo.`);
    return result;
  };
  const optionalNumber = (value, label) => (
    value === undefined || value === null || value === '' ? null : numeric(value, label)
  );
  const optionalDate = (value, label) => (
    value === undefined || value === null || value === '' ? null : validDate(value, label)
  );
  const baseSalary = numeric(employee.salarioMensualBase, 'El salario base');
  const foodAllowance = numeric(employee.cestaticketMensual, 'El cestaticket');
  const withholding = numeric(employee.porcentajeRetencionISLR, 'La retención ISLR');
  if (withholding > 100) throw httpError(400, 'La retención ISLR no puede superar 100%.');
  const profitDays = numeric(employee.diasUtilidadesAnuales, 'Los días de utilidades', 30);
  if (profitDays < 30 || profitDays > 120) throw httpError(400, 'Los días de utilidades deben estar entre 30 y 120.');

  return {
    id: requiredText(employee.id, 'El identificador del empleado', 120),
    cedula: requiredText(employee.cedula, 'La cédula', 40),
    rif: typeof employee.rif === 'string' ? employee.rif.trim() : '',
    nationality,
    firstName: requiredText(employee.primerNombre, 'El primer nombre', 120),
    middleName: typeof employee.segundoNombre === 'string' ? employee.segundoNombre.trim() : '',
    lastName: requiredText(employee.primerApellido, 'El primer apellido', 120),
    secondLastName: typeof employee.segundoApellido === 'string' ? employee.segundoApellido.trim() : '',
    birthDate: validDate(employee.fechaNacimiento, 'La fecha de nacimiento'),
    sex,
    email: typeof employee.email === 'string' ? employee.email.trim() : '',
    phone: typeof employee.telefono === 'string' ? employee.telefono.trim() : '',
    address: typeof employee.direccion === 'string' ? employee.direccion.trim() : '',
    city: typeof employee.ciudad === 'string' ? employee.ciudad.trim() : '',
    state: typeof employee.estado === 'string' ? employee.estado.trim() : '',
    jobTitle: typeof employee.cargo === 'string' ? employee.cargo.trim() : '',
    department: typeof employee.departamento === 'string' ? employee.departamento.trim() : '',
    hireDate: validDate(employee.fechaIngreso, 'La fecha de ingreso'),
    terminationDate: optionalDate(employee.fechaEgreso, 'La fecha de egreso'),
    contractType,
    status,
    ivssNumber: typeof employee.numeroAfiliacionIVSS === 'string' ? employee.numeroAfiliacionIVSS.trim() : '',
    baseSalary,
    salaryCurrency,
    originalSalary: optionalNumber(employee.salarioMensualBaseOriginal, 'El salario original'),
    payFrequency,
    foodAllowance,
    foodCurrency,
    foodApplies: employee.cestaticketAplica !== false,
    foodPaymentMethod: employee.cestaticketMetodoPago || null,
    foodBank: typeof employee.cestaticketBancoReceptor === 'string' ? employee.cestaticketBancoReceptor.trim() : '',
    profitDays,
    dayOvertime: numeric(employee.horasExtrasDiurnasPendientes, 'Las horas extras diurnas'),
    nightOvertime: numeric(employee.horasExtrasNocturnasPendientes, 'Las horas extras nocturnas'),
    withholding,
    sellerSalary: optionalNumber(employee.salarioVendedor, 'El salario del vendedor'),
    commissionPercent: optionalNumber(employee.porcentajeComision, 'El porcentaje de comisión'),
    sellerPaymentMode: employee.modalidadVendedor || null,
    sellerPaymentDescription: employee.descripcionPagoVendedor || null,
    bankName: typeof employee.banco === 'string' ? employee.banco.trim() : '',
    bankAccount: typeof employee.numeroCuenta === 'string' ? employee.numeroCuenta.trim() : '',
    bankAccountType: employee.tipoCuenta || null,
    paymentMethod: employee.metodoPago || null,
    vacationDays: numeric(employee.vacacionesDisfrutadas, 'Los días de vacaciones'),
    travelAllowance: numeric(employee.viaticosPendientes, 'Los viáticos pendientes'),
    travelAllowanceOriginal: optionalNumber(employee.viaticosPendientesOriginal, 'Los viáticos originales'),
    travelAllowanceCurrency: employee.viaticosMoneda ? currencyMap[employee.viaticosMoneda] : null,
    dependents: Math.trunc(numeric(employee.cargasFamiliares, 'Las cargas familiares')),
  };
}

async function createJournalEntry(client, companyId, userId, entryDate, description, lines) {
  const periodResult = await client.query(
    `SELECT id FROM accounting_periods
     WHERE company_id = $1 AND status = 'open'
       AND start_date <= $2 AND end_date >= $2
     ORDER BY start_date DESC LIMIT 1 FOR UPDATE`,
    [companyId, entryDate],
  );
  if (!periodResult.rowCount) {
    throw httpError(409, 'No existe un período contable abierto para la fecha seleccionada.');
  }
  if (!Array.isArray(lines) || lines.length < 2
    || Math.abs(lines.reduce((sum, line) => sum + line.debit - line.credit, 0)) > 0.005) {
    throw httpError(409, 'El asiento generado no está balanceado.');
  }
  const id = randomUUID();
  const entryNumber = `ERP-${entryDate.replaceAll('-', '')}-${id.slice(0, 8).toUpperCase()}`;
  await client.query(
    `INSERT INTO journal_entries (
       id, company_id, entry_number, entry_date, accounting_period_id,
       description, status, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,'draft',$7)`,
    [id, companyId, entryNumber, entryDate, periodResult.rows[0].id, description, userId],
  );
  for (const [index, line] of lines.entries()) {
    const debit = money2(line.debit || 0);
    const credit = money2(line.credit || 0);
    if ((debit > 0) === (credit > 0)) {
      throw httpError(409, 'Cada línea contable debe contener débito o crédito, pero no ambos.');
    }
    await client.query(
      `INSERT INTO journal_lines (
         id, journal_entry_id, line_number, account_id, description, debit, credit
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [randomUUID(), id, index + 1, line.accountId, line.description || description, debit, credit],
    );
  }
  await client.query(
    `UPDATE journal_entries
     SET status = 'posted', posted_by = $2, posted_at = CURRENT_TIMESTAMP
     WHERE company_id = $1 AND id = $3`,
    [companyId, userId, id],
  );
  return { id, entryNumber };
}

async function getReportRows(client, companyId, report, from, to) {
  if (report === 'general_ledger') {
    const result = await client.query(
      `SELECT account.code AS account_code, account.name AS account_name,
              entry.entry_date, entry.entry_number, line.description,
              line.debit::TEXT, line.credit::TEXT
       FROM journal_lines line
       JOIN journal_entries entry ON entry.id = line.journal_entry_id
       JOIN accounting_accounts account
         ON account.company_id = entry.company_id AND account.id = line.account_id
       WHERE entry.company_id = $1 AND entry.status = 'posted'
         AND entry.entry_date BETWEEN $2 AND $3
       ORDER BY account.code, entry.entry_date, entry.entry_number, line.line_number`,
      [companyId, from, to],
    );
    return result.rows.map((row) => ({ ...row, debit: Number(row.debit), credit: Number(row.credit) }));
  }

  const asAt = report === 'balance_sheet';
  const result = await client.query(
    `SELECT account.id, account.code, account.name, account.account_type,
            COALESCE(SUM(CASE WHEN entry.entry_date BETWEEN $2 AND $3
              THEN line.debit ELSE 0 END), 0)::TEXT AS period_debit,
            COALESCE(SUM(CASE WHEN entry.entry_date BETWEEN $2 AND $3
              THEN line.credit ELSE 0 END), 0)::TEXT AS period_credit,
            COALESCE(SUM(CASE WHEN entry.entry_date <= $3
              THEN line.debit ELSE 0 END), 0)::TEXT AS total_debit,
            COALESCE(SUM(CASE WHEN entry.entry_date <= $3
              THEN line.credit ELSE 0 END), 0)::TEXT AS total_credit
     FROM accounting_accounts account
     LEFT JOIN journal_lines line
       ON line.account_id = account.id
     LEFT JOIN journal_entries entry
       ON entry.id = line.journal_entry_id
      AND entry.company_id = account.company_id
      AND entry.status = 'posted'
      AND entry.entry_date <= $3
     WHERE account.company_id = $1 AND account.active AND NOT account.is_group
     GROUP BY account.id, account.code, account.name, account.account_type
     ORDER BY account.code`,
    [companyId, from, to],
  );
  let rows = result.rows.map((row) => {
    const periodDebit = Number(row.period_debit);
    const periodCredit = Number(row.period_credit);
    const totalDebit = Number(row.total_debit);
    const totalCredit = Number(row.total_credit);
    const creditNormal = ['pasivo', 'patrimonio', 'ingreso'].includes(row.account_type);
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      account_type: row.account_type,
      debit: asAt ? totalDebit : periodDebit,
      credit: asAt ? totalCredit : periodCredit,
      balance: creditNormal
        ? (asAt ? totalCredit - totalDebit : periodCredit - periodDebit)
        : (asAt ? totalDebit - totalCredit : periodDebit - periodCredit),
    };
  });

  if (report === 'income_statement') {
    rows = rows.filter((row) => ['ingreso', 'gasto'].includes(row.account_type));
  } else if (report === 'balance_sheet') {
    const balanceRows = rows.filter((row) => ['activo', 'pasivo', 'patrimonio'].includes(row.account_type));
    const yearStart = `${to.slice(0, 4)}-01-01`;
    const profitResult = await client.query(
      `SELECT COALESCE(SUM(CASE
         WHEN account.account_type = 'ingreso' THEN line.credit - line.debit
         WHEN account.account_type = 'gasto' THEN line.debit - line.credit
         ELSE 0 END), 0)::TEXT AS result
       FROM journal_lines line
       JOIN journal_entries entry ON entry.id = line.journal_entry_id
       JOIN accounting_accounts account
         ON account.company_id = entry.company_id AND account.id = line.account_id
       WHERE entry.company_id = $1 AND entry.status = 'posted'
         AND entry.entry_date BETWEEN $2 AND $3`,
      [companyId, yearStart, to],
    );
    const currentResult = Number(profitResult.rows[0].result);
    if (currentResult !== 0) {
      balanceRows.push({
        id: 'current-period-result',
        code: '',
        name: 'Resultado del ejercicio (desde enero)',
        account_type: 'patrimonio',
        debit: currentResult < 0 ? Math.abs(currentResult) : 0,
        credit: currentResult > 0 ? currentResult : 0,
        balance: currentResult,
      });
    }
    rows = balanceRows;
  }

  return rows;
}

async function writeExcel(res, report, from, to, rows) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'VEN-Nomina ERP';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Reporte');
  sheet.addRow([{
    trial_balance: 'Balance de comprobación',
    balance_sheet: 'Balance general',
    income_statement: 'Estado de resultados',
    general_ledger: 'Libro mayor',
  }[report]]);
  sheet.addRow([`Desde ${from} hasta ${to}`]);
  sheet.addRow([]);
  if (report === 'general_ledger') {
    sheet.addRow(['Código', 'Cuenta', 'Fecha', 'Asiento', 'Detalle', 'Débito', 'Crédito']);
    rows.forEach((row) => sheet.addRow([
      row.account_code, row.account_name, row.entry_date, row.entry_number,
      row.description, row.debit, row.credit,
    ]));
    sheet.columns = [
      { width: 18 }, { width: 32 }, { width: 14 }, { width: 28 },
      { width: 48 }, { width: 18 }, { width: 18 },
    ];
  } else {
    sheet.addRow(['Código', 'Cuenta', 'Tipo', 'Débitos', 'Créditos', 'Saldo']);
    rows.forEach((row) => sheet.addRow([
      row.code, row.name, row.account_type, row.debit, row.credit, row.balance,
    ]));
    sheet.columns = [
      { width: 18 }, { width: 38 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 },
    ];
  }
  sheet.getRow(4).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 4 }];
  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${report}-${from}-${to}.xlsx"`);
  res.send(Buffer.from(buffer));
}

function createErpOperationsRouter(authMiddleware, pool) {
  const router = express.Router();
  router.use(authMiddleware);

  router.get('/bootstrap', async (req, res) => {
    try {
      const data = await withUserTransaction(pool, req, FINANCE_ROLES, async (client, user) => {
        const [accounts, periods, suppliers, bankAccounts, employees] = await Promise.all([
          client.query(
            `SELECT id, code, name, account_type, is_group
             FROM accounting_accounts WHERE company_id = $1 AND active ORDER BY code`,
            [user.company_id],
          ),
          client.query(
            `SELECT id, name, start_date, end_date, status
             FROM accounting_periods WHERE company_id = $1 ORDER BY start_date DESC`,
            [user.company_id],
          ),
          client.query(
            `SELECT party.id, party.legal_name, party.trade_name, party.tax_identifier
             FROM business_parties party
             JOIN business_party_roles role
               ON role.company_id = party.company_id AND role.party_id = party.id
             WHERE party.company_id = $1 AND role.role = 'supplier'
               AND party.active AND role.active
             ORDER BY party.legal_name`,
            [user.company_id],
          ),
          client.query(
            `SELECT bank.id, bank.bank_name, bank.account_label,
                    bank.accounting_account_id, account.code, account.name
             FROM bank_accounts bank
             JOIN accounting_accounts account
               ON account.company_id = bank.company_id
              AND account.id = bank.accounting_account_id
             WHERE bank.company_id = $1 AND bank.active
             ORDER BY bank.bank_name, bank.account_label`,
            [user.company_id],
          ),
          client.query(
            `SELECT id, cedula, first_name, last_name, job_title, department, status
             FROM employees WHERE company_id = $1 ORDER BY last_name, first_name`,
            [user.company_id],
          ),
        ]);
        const mapping = await client.query(
          `SELECT receivable_account_id
           FROM commercial_account_mappings WHERE company_id = $1`,
          [user.company_id],
        );
        return {
          currentUserRole: user.rol,
          currentUserName: user.nombre,
          accounts: accounts.rows,
          periods: periods.rows,
          suppliers: suppliers.rows,
          bankAccounts: bankAccounts.rows,
          employees: employees.rows,
          receivableAccountId: mapping.rows[0]?.receivable_account_id || null,
        };
      });
      res.json(data);
    } catch (error) {
      sendError(res, error, 'ERP bootstrap');
    }
  });

  router.get('/suppliers', async (req, res) => {
    try {
      const suppliers = await withUserTransaction(pool, req, FINANCE_ROLES, async (client, user) => {
        const result = await client.query(
          `SELECT party.id, party.party_kind, party.tax_identifier, party.legal_name,
                  party.trade_name, party.email, party.phone, party.notes, party.active,
                  role.active AS supplier_active
           FROM business_parties party
           JOIN business_party_roles role
             ON role.company_id = party.company_id AND role.party_id = party.id
           WHERE party.company_id = $1 AND role.role = 'supplier'
           ORDER BY party.legal_name`,
          [user.company_id],
        );
        return result.rows;
      });
      res.json({ suppliers });
    } catch (error) {
      sendError(res, error, 'List suppliers');
    }
  });

  router.post('/suppliers', async (req, res) => {
    try {
      const supplier = await withUserTransaction(pool, req, FINANCE_ROLES, async (client, user) => {
        const body = req.body || {};
        const legalName = requiredText(body.legalName, 'La razón social');
        const partyKind = body.partyKind === 'person' ? 'person' : 'organization';
        const id = randomUUID();
        await client.query(
          `INSERT INTO business_parties (
             id, company_id, party_kind, tax_identifier, legal_name,
             trade_name, email, phone, notes
           ) VALUES ($1,$2,$3,NULLIF($4,''),$5,NULLIF($6,''),$7,$8,$9)`,
          [
            id, user.company_id, partyKind,
            typeof body.taxIdentifier === 'string' ? body.taxIdentifier.trim() : '',
            legalName,
            typeof body.tradeName === 'string' ? body.tradeName.trim() : '',
            typeof body.email === 'string' ? body.email.trim() : '',
            typeof body.phone === 'string' ? body.phone.trim() : '',
            typeof body.notes === 'string' ? body.notes.trim() : '',
          ],
        );
        await client.query(
          `INSERT INTO business_party_roles (company_id, party_id, role)
           VALUES ($1,$2,'supplier')`,
          [user.company_id, id],
        );
        return { id, legal_name: legalName };
      });
      res.status(201).json({ supplier });
    } catch (error) {
      sendError(res, error, 'Create supplier');
    }
  });

  router.patch('/suppliers/:id/status', async (req, res) => {
    try {
      await withUserTransaction(pool, req, FINANCE_ROLES, async (client, user) => {
        if (typeof req.body?.active !== 'boolean') throw httpError(400, 'Indique el estado activo del proveedor.');
        const updated = await client.query(
          `UPDATE business_parties party SET active = $3, updated_at = CURRENT_TIMESTAMP
           FROM business_party_roles role
           WHERE party.company_id = $1 AND party.id = $2
             AND role.company_id = party.company_id AND role.party_id = party.id
             AND role.role = 'supplier'`,
          [user.company_id, req.params.id, req.body.active],
        );
        if (!updated.rowCount) throw httpError(404, 'No se encontró el proveedor.');
        await client.query(
          `UPDATE business_party_roles SET active = $3
           WHERE company_id = $1 AND party_id = $2 AND role = 'supplier'`,
          [user.company_id, req.params.id, req.body.active],
        );
      });
      res.json({ ok: true });
    } catch (error) {
      sendError(res, error, 'Update supplier');
    }
  });

  router.get('/purchases', async (req, res) => {
    try {
      const documents = await withUserTransaction(pool, req, FINANCE_ROLES, async (client, user) => {
        const result = await client.query(
          `SELECT document.id, document.document_type, document.document_number,
                  document.external_reference, document.document_date, document.due_date,
                  document.status, document.currency_code, document.exchange_rate,
                  document.party_id, document.party_name_snapshot,
                  document.description, document.net_amount, document.tax_amount,
                  document.gross_amount, item.outstanding_amount, item.status AS item_status
           FROM commercial_documents document
           LEFT JOIN commercial_open_items item
             ON item.company_id = document.company_id
            AND item.source_document_id = document.id
           WHERE document.company_id = $1
             AND document.document_type IN ('purchase_order','supplier_invoice')
           ORDER BY document.document_date DESC, document.created_at DESC`,
          [user.company_id],
        );
        return result.rows;
      });
      res.json({ documents });
    } catch (error) {
      sendError(res, error, 'List purchases');
    }
  });

  router.post('/purchases', async (req, res) => {
    try {
      const document = await withUserTransaction(pool, req, FINANCE_ROLES, async (client, user) => {
        const body = req.body || {};
        const type = body.documentType;
        if (!['purchase_order', 'supplier_invoice'].includes(type)) {
          throw httpError(400, 'El tipo de compra debe ser orden de compra o factura de proveedor.');
        }
        const supplierId = requiredText(body.supplierId, 'El proveedor');
        const documentDate = validDate(body.documentDate, 'La fecha del documento');
        const dueDate = body.dueDate ? validDate(body.dueDate, 'La fecha de vencimiento') : null;
        if (dueDate && dueDate < documentDate) throw httpError(400, 'El vencimiento no puede ser anterior a la fecha del documento.');
        const currency = currencyCode(body.currencyCode || 'VES');
        const exchangeRate = currency === 'VES' ? 1 : positiveNumber(body.exchangeRate, 'La tasa de cambio');
        if (!Array.isArray(body.lines) || body.lines.length === 0 || body.lines.length > 200) {
          throw httpError(400, 'La compra requiere entre 1 y 200 líneas.');
        }
        const partyResult = await client.query(
          `SELECT party.legal_name, party.tax_identifier
           FROM business_parties party
           JOIN business_party_roles role
             ON role.company_id = party.company_id AND role.party_id = party.id
           WHERE party.company_id = $1 AND party.id = $2 AND party.active
             AND role.role = 'supplier' AND role.active`,
          [user.company_id, supplierId],
        );
        if (!partyResult.rowCount) throw httpError(404, 'El proveedor no existe o está inactivo.');

        const accountIds = [...new Set(body.lines.flatMap((line) => [
          line?.accountId,
          Number(line?.taxAmount) > 0 ? line?.taxAccountId : null,
        ]).filter(Boolean))];
        const accountResult = await client.query(
          `SELECT id, account_type, active, is_group
           FROM accounting_accounts
           WHERE company_id = $1 AND id = ANY($2::TEXT[])`,
          [user.company_id, accountIds],
        );
        const accountMap = new Map(accountResult.rows.map((account) => [account.id, account]));
        const lines = body.lines.map((line, index) => {
          const description = requiredText(line.description, `La descripción de la línea ${index + 1}`, 500);
          const quantity = positiveNumber(line.quantity, `La cantidad de la línea ${index + 1}`);
          const unitPrice = positiveNumber(line.unitPrice, `El precio de la línea ${index + 1}`, true);
          const discount = positiveNumber(line.discountAmount ?? 0, `El descuento de la línea ${index + 1}`, true);
          const tax = positiveNumber(line.taxAmount ?? 0, `El impuesto de la línea ${index + 1}`, true);
          const net = money2(quantity * unitPrice - discount);
          if (net < 0) throw httpError(400, `El descuento excede el importe de la línea ${index + 1}.`);
          const account = accountMap.get(line.accountId);
          if (!account || !account.active || account.is_group || !['activo', 'gasto'].includes(account.account_type)) {
            throw httpError(400, `Seleccione una cuenta imputable activa de activo o gasto para la línea ${index + 1}.`);
          }
          const taxAccountId = tax > 0 ? requiredText(line.taxAccountId, `La cuenta del impuesto de la línea ${index + 1}`) : null;
          if (taxAccountId) {
            const taxAccount = accountMap.get(taxAccountId);
            if (!taxAccount || !taxAccount.active || taxAccount.is_group || taxAccount.account_type !== 'activo') {
              throw httpError(400, `La cuenta del impuesto de la línea ${index + 1} debe ser un activo imputable activo.`);
            }
          }
          return {
            description, quantity, unitPrice, discount,
            net, tax: money2(tax), gross: money2(net + tax),
            accountId: line.accountId, taxAccountId,
          };
        });
        const netAmount = money2(lines.reduce((sum, line) => sum + line.net, 0));
        const taxAmount = money2(lines.reduce((sum, line) => sum + line.tax, 0));
        const grossAmount = money2(netAmount + taxAmount);
        const id = randomUUID();
        await client.query(
          `INSERT INTO commercial_documents (
             id, company_id, branch_id, document_type, party_role, party_id,
             external_reference, document_date, due_date, currency_code,
             exchange_rate, party_name_snapshot, party_tax_id_snapshot,
             description, net_amount, tax_amount, gross_amount,
             created_by, updated_by
           ) VALUES (
             $1,$2,$3,$4,'supplier',$5,NULLIF($6,''),$7,$8,$9,$10,$11,$12,$13,
             $14,$15,$16,$17,$17
           )`,
          [
            id, user.company_id, user.branch_id, type, supplierId,
            typeof body.externalReference === 'string' ? body.externalReference.trim() : '',
            documentDate, dueDate, currency, exchangeRate,
            partyResult.rows[0].legal_name, partyResult.rows[0].tax_identifier,
            typeof body.description === 'string' ? body.description.trim() : '',
            netAmount, taxAmount, grossAmount, user.id,
          ],
        );
        for (const [index, line] of lines.entries()) {
          await client.query(
            `INSERT INTO commercial_document_lines (
               id, company_id, document_id, line_number, description,
               quantity, unit_price, discount_amount, net_amount, tax_amount,
               gross_amount, metadata
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::JSONB)`,
            [
              randomUUID(), user.company_id, id, index + 1, line.description,
              line.quantity, line.unitPrice, line.discount, line.net, line.tax,
              line.gross,
              JSON.stringify({
                purchase_account_id: line.accountId,
                input_tax_account_id: line.taxAccountId,
              }),
            ],
          );
        }
        return { id, documentType: type, netAmount, taxAmount, grossAmount, currencyCode: currency };
      });
      res.status(201).json({ document });
    } catch (error) {
      sendError(res, error, 'Create purchase');
    }
  });

  router.post('/purchases/:id/approve', async (req, res) => {
    try {
      await withUserTransaction(pool, req, FINANCE_ROLES, async (client, user) => {
        const updated = await client.query(
          `UPDATE commercial_documents
           SET status = 'approved', updated_by = $3
           WHERE company_id = $1 AND id = $2 AND document_type = 'purchase_order'
             AND status = 'draft'`,
          [user.company_id, req.params.id, user.id],
        );
        if (!updated.rowCount) throw httpError(409, 'Solo se puede aprobar una orden de compra en borrador.');
      });
      res.json({ ok: true });
    } catch (error) {
      sendError(res, error, 'Approve purchase order');
    }
  });

  router.post('/purchases/:id/issue', async (req, res) => {
    try {
      const posted = await withUserTransaction(pool, req, FINANCE_ROLES, async (client, user) => {
        const result = await client.query(
          `SELECT * FROM commercial_documents
           WHERE company_id = $1 AND id = $2
             AND document_type = 'supplier_invoice' AND status = 'draft'
           FOR UPDATE`,
          [user.company_id, req.params.id],
        );
        const document = result.rows[0];
        if (!document) throw httpError(404, 'No se encontró una factura de proveedor en borrador.');
        const payableAccountId = requiredText(req.body?.payableAccountId, 'La cuenta de proveedores por pagar');
        const payable = await client.query(
          `SELECT id FROM accounting_accounts
           WHERE company_id = $1 AND id = $2 AND account_type = 'pasivo'
             AND active AND NOT is_group`,
          [user.company_id, payableAccountId],
        );
        if (!payable.rowCount) throw httpError(400, 'La cuenta por pagar debe ser un pasivo imputable activo.');
        const lineResult = await client.query(
          `SELECT description, net_amount, tax_amount, metadata
           FROM commercial_document_lines
           WHERE company_id = $1 AND document_id = $2 ORDER BY line_number`,
          [user.company_id, document.id],
        );
        const debitLines = [];
        for (const line of lineResult.rows) {
          const metadata = typeof line.metadata === 'string' ? JSON.parse(line.metadata) : line.metadata;
          const net = Number(line.net_amount) * Number(document.exchange_rate || 1);
          const tax = Number(line.tax_amount) * Number(document.exchange_rate || 1);
          debitLines.push({ accountId: metadata.purchase_account_id, debit: net, credit: 0, description: line.description });
          if (tax > 0) {
            if (!metadata.input_tax_account_id) throw httpError(409, 'Falta asignar una cuenta de impuesto recuperable a una línea con impuesto.');
            debitLines.push({ accountId: metadata.input_tax_account_id, debit: tax, credit: 0, description: `Impuesto soportado: ${line.description}` });
          }
        }
        const grossInBs = money2(Number(document.gross_amount) * Number(document.exchange_rate || 1));
        const journal = await createJournalEntry(
          client,
          user.company_id,
          user.id,
          document.document_date.toISOString?.().slice(0, 10) || String(document.document_date).slice(0, 10),
          `Factura de proveedor ${document.external_reference || document.id}`,
          [...debitLines, {
            accountId: payableAccountId,
            debit: 0,
            credit: grossInBs,
            description: `Cuenta por pagar a ${document.party_name_snapshot}`,
          }],
        );
        const update = await client.query(
          `UPDATE commercial_documents
           SET status = 'issued', updated_by = $3
           WHERE company_id = $1 AND id = $2 AND status = 'draft'`,
          [user.company_id, document.id, user.id],
        );
        if (!update.rowCount) throw httpError(409, 'La factura cambió de estado antes de contabilizarla.');
        return { journalEntryId: journal.id, entryNumber: journal.entryNumber };
      });
      res.json({ ok: true, ...posted });
    } catch (error) {
      sendError(res, error, 'Issue supplier invoice');
    }
  });

  router.get('/open-items', async (req, res) => {
    try {
      const items = await withUserTransaction(pool, req, FINANCE_ROLES, async (client, user) => {
        const role = req.query.role === 'customer' ? 'customer' : 'supplier';
        const result = await client.query(
          `SELECT item.id, item.party_role, item.party_id, party.legal_name,
                  item.source_document_id, document.external_reference,
                  document.document_date, item.due_date, item.currency_code,
                  item.original_amount::TEXT, item.outstanding_amount::TEXT,
                  item.status
           FROM commercial_open_items item
           JOIN business_parties party
             ON party.company_id = item.company_id AND party.id = item.party_id
           JOIN commercial_documents document
             ON document.company_id = item.company_id AND document.id = item.source_document_id
           WHERE item.company_id = $1 AND item.party_role = $2
             AND item.status IN ('open','partially_settled')
           ORDER BY item.due_date NULLS LAST, document.document_date`,
          [user.company_id, role],
        );
        return result.rows;
      });
      res.json({ items });
    } catch (error) {
      sendError(res, error, 'List open items');
    }
  });

  router.get('/settlements', async (req, res) => {
    try {
      const settlements = await withUserTransaction(pool, req, FINANCE_ROLES, async (client, user) => {
        const result = await client.query(
          `SELECT settlement.id, settlement.settlement_type, settlement.party_id,
                  party.legal_name, settlement.settlement_date, settlement.currency_code,
                  settlement.amount::TEXT, settlement.payment_method, settlement.reference,
                  settlement.status, settlement.journal_entry_id, entry.entry_number
           FROM commercial_settlements settlement
           JOIN business_parties party
             ON party.company_id = settlement.company_id AND party.id = settlement.party_id
           LEFT JOIN journal_entries entry
             ON entry.company_id = settlement.company_id AND entry.id = settlement.journal_entry_id
           WHERE settlement.company_id = $1
           ORDER BY settlement.settlement_date DESC, settlement.created_at DESC`,
          [user.company_id],
        );
        return result.rows;
      });
      res.json({ settlements });
    } catch (error) {
      sendError(res, error, 'List settlements');
    }
  });

  router.post('/settlements', async (req, res) => {
    try {
      const settlement = await withUserTransaction(pool, req, FINANCE_ROLES, async (client, user) => {
        const body = req.body || {};
        const type = body.settlementType;
        if (!['receivable', 'payable'].includes(type)) throw httpError(400, 'Indique si es un cobro o un pago.');
        const partyId = requiredText(body.partyId, 'La contraparte');
        const paymentDate = validDate(body.settlementDate, 'La fecha del pago/cobro');
        const currency = currencyCode(body.currencyCode);
        const exchangeRate = currency === 'VES' ? 1 : positiveNumber(body.exchangeRate, 'La tasa de cambio');
        const amount = positiveNumber(body.amount, 'El importe');
        const cashAccountId = requiredText(body.cashAccountId, 'La cuenta bancaria o de caja');
        const payableAccountId = type === 'payable'
          ? requiredText(body.payableAccountId, 'La cuenta de proveedores por pagar')
          : null;
        if (!Array.isArray(body.allocations) || body.allocations.length === 0) {
          throw httpError(400, 'Aplique el importe completo a una o más facturas pendientes.');
        }
        const party = await client.query(
          `SELECT 1 FROM business_party_roles
           WHERE company_id = $1 AND party_id = $2 AND role = $3 AND active`,
          [user.company_id, partyId, type === 'payable' ? 'supplier' : 'customer'],
        );
        if (!party.rowCount) throw httpError(404, 'La contraparte no existe o no tiene el rol comercial requerido.');
        const cash = await client.query(
          `SELECT id FROM accounting_accounts
           WHERE company_id = $1 AND id = $2 AND account_type = 'activo'
             AND active AND NOT is_group`,
          [user.company_id, cashAccountId],
        );
        if (!cash.rowCount) throw httpError(400, 'La cuenta de caja/banco debe ser un activo imputable activo.');
        let offsetAccountId = payableAccountId;
        if (type === 'receivable') {
          const mapping = await client.query(
            `SELECT receivable_account_id
             FROM commercial_account_mappings WHERE company_id = $1`,
            [user.company_id],
          );
          offsetAccountId = mapping.rows[0]?.receivable_account_id;
          if (!offsetAccountId) throw httpError(409, 'Configure primero la cuenta contable de cuentas por cobrar.');
        }
        const offsetType = type === 'payable' ? 'pasivo' : 'activo';
        const offset = await client.query(
          `SELECT id FROM accounting_accounts
           WHERE company_id = $1 AND id = $2 AND account_type = $3
             AND active AND NOT is_group`,
          [user.company_id, offsetAccountId, offsetType],
        );
        if (!offset.rowCount) throw httpError(400, 'La cuenta de contrapartida no coincide con el tipo contable esperado.');

        const id = randomUUID();
        await client.query(
          `INSERT INTO commercial_settlements (
             id, company_id, branch_id, settlement_type, party_id,
             settlement_date, currency_code, amount, payment_method,
             reference, description, created_by, cash_account_id, exchange_rate
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            id, user.company_id, user.branch_id, type, partyId, paymentDate,
            currency, amount, requiredText(body.paymentMethod, 'El medio de pago', 80),
            typeof body.reference === 'string' ? body.reference.trim() : '',
            typeof body.description === 'string' ? body.description.trim() : '',
            user.id, cashAccountId, exchangeRate,
          ],
        );
        const allocations = new Map();
        for (const allocation of body.allocations) {
          const itemId = requiredText(allocation.openItemId, 'La factura pendiente');
          if (allocations.has(itemId)) throw httpError(400, 'No repita una factura en las aplicaciones.');
          const allocationAmount = positiveNumber(allocation.amount, 'El importe aplicado');
          allocations.set(itemId, allocationAmount);
        }
        const allocatedTotal = money2([...allocations.values()].reduce((sum, value) => sum + value, 0));
        if (Math.abs(allocatedTotal - amount) > 0.005) {
          throw httpError(400, 'El total aplicado debe coincidir exactamente con el importe del pago/cobro.');
        }
        for (const [itemId, allocationAmount] of allocations) {
          await client.query(
            `INSERT INTO commercial_settlement_allocations (
               id, company_id, settlement_id, open_item_id, amount
             )
             SELECT $1, $2, $3, item.id, $5
             FROM commercial_open_items item
             WHERE item.company_id = $2 AND item.id = $4
               AND item.party_id = $6 AND item.party_role = $7
               AND item.currency_code = $8
               AND item.status IN ('open','partially_settled')
               AND item.outstanding_amount >= $5`,
            [
              randomUUID(), user.company_id, id, itemId, allocationAmount,
              partyId, type === 'payable' ? 'supplier' : 'customer', currency,
            ],
          ).then((inserted) => {
            if (!inserted.rowCount) throw httpError(409, 'Una factura ya no está pendiente o no coincide en contraparte, moneda o saldo.');
          });
        }
        return { id, amount, currencyCode: currency };
      });
      res.status(201).json({ settlement });
    } catch (error) {
      sendError(res, error, 'Create settlement');
    }
  });

  router.post('/settlements/:id/post', async (req, res) => {
    try {
      const result = await withUserTransaction(pool, req, FINANCE_ROLES, async (client, user) => {
        const settlementResult = await client.query(
          `SELECT settlement.*, party.legal_name
           FROM commercial_settlements settlement
           JOIN business_parties party
             ON party.company_id = settlement.company_id AND party.id = settlement.party_id
           WHERE settlement.company_id = $1 AND settlement.id = $2
           FOR UPDATE OF settlement`,
          [user.company_id, req.params.id],
        );
        const settlement = settlementResult.rows[0];
        if (!settlement || settlement.status !== 'draft') {
          throw httpError(409, 'Solo se puede contabilizar un pago/cobro en borrador.');
        }
        const allocationResult = await client.query(
          `SELECT amount FROM commercial_settlement_allocations
           WHERE company_id = $1 AND settlement_id = $2`,
          [user.company_id, settlement.id],
        );
        if (!allocationResult.rowCount) throw httpError(409, 'El pago/cobro no tiene facturas aplicadas.');
        const exchangeRate = Number(settlement.exchange_rate || 1);
        const amountInBs = money2(Number(settlement.amount) * exchangeRate);
        const payableAccountId = settlement.settlement_type === 'payable'
          ? requiredText(req.body?.payableAccountId, 'La cuenta de proveedores por pagar')
          : null;
        let offsetAccountId = payableAccountId;
        if (settlement.settlement_type === 'receivable') {
          const mapping = await client.query(
            `SELECT receivable_account_id
             FROM commercial_account_mappings WHERE company_id = $1`,
            [user.company_id],
          );
          offsetAccountId = mapping.rows[0]?.receivable_account_id;
          if (!offsetAccountId) throw httpError(409, 'Configure primero la cuenta contable de cuentas por cobrar.');
        }
        const accountTypes = await client.query(
          `SELECT id, account_type FROM accounting_accounts
           WHERE company_id = $1 AND id = ANY($2::TEXT[])
             AND active AND NOT is_group`,
          [user.company_id, [settlement.cash_account_id, offsetAccountId]],
        );
        const types = new Map(accountTypes.rows.map((row) => [row.id, row.account_type]));
        if (types.get(settlement.cash_account_id) !== 'activo'
          || types.get(offsetAccountId) !== (settlement.settlement_type === 'payable' ? 'pasivo' : 'activo')) {
          throw httpError(409, 'Las cuentas contables configuradas no corresponden al tipo de operación.');
        }
        const date = settlement.settlement_date.toISOString?.().slice(0, 10)
          || String(settlement.settlement_date).slice(0, 10);
        const cashLine = settlement.settlement_type === 'receivable'
          ? { accountId: settlement.cash_account_id, debit: amountInBs, credit: 0, description: 'Cobro recibido' }
          : { accountId: settlement.cash_account_id, debit: 0, credit: amountInBs, description: 'Pago emitido' };
        const offsetLine = settlement.settlement_type === 'receivable'
          ? { accountId: offsetAccountId, debit: 0, credit: amountInBs, description: 'Aplicación a cuentas por cobrar' }
          : { accountId: offsetAccountId, debit: amountInBs, credit: 0, description: 'Aplicación a cuentas por pagar' };
        const journal = await createJournalEntry(
          client,
          user.company_id,
          user.id,
          date,
          `${settlement.settlement_type === 'receivable' ? 'Cobro' : 'Pago'} a ${settlement.legal_name}`,
          [cashLine, offsetLine],
        );
        await client.query(
          `UPDATE commercial_settlements
           SET journal_entry_id = $3
           WHERE company_id = $1 AND id = $2 AND status = 'draft'`,
          [user.company_id, settlement.id, journal.id],
        );
        await client.query('SELECT post_commercial_settlement($1, $2)', [settlement.id, user.id]);
        return { journalEntryId: journal.id, entryNumber: journal.entryNumber };
      });
      res.json({ ok: true, ...result });
    } catch (error) {
      sendError(res, error, 'Post settlement');
    }
  });

  router.get('/bank/accounts', async (req, res) => {
    try {
      const accounts = await withUserTransaction(pool, req, FINANCE_ROLES, async (client, user) => {
        const result = await client.query(
          `SELECT bank.id, bank.bank_name, bank.account_label,
                  bank.account_number_last4, bank.accounting_account_id,
                  account.code, account.name
           FROM bank_accounts bank
           JOIN accounting_accounts account
             ON account.company_id = bank.company_id
            AND account.id = bank.accounting_account_id
           WHERE bank.company_id = $1 AND bank.active
           ORDER BY bank.bank_name, bank.account_label`,
          [user.company_id],
        );
        return result.rows;
      });
      res.json({ accounts });
    } catch (error) {
      sendError(res, error, 'List bank accounts');
    }
  });

  router.post('/bank/accounts', async (req, res) => {
    try {
      const account = await withUserTransaction(pool, req, FINANCE_ROLES, async (client, user) => {
        const body = req.body || {};
        const bankName = requiredText(body.bankName, 'El banco');
        const label = requiredText(body.accountLabel, 'El nombre de la cuenta');
        const accountNumber = body.accountNumberLast4 ? String(body.accountNumberLast4) : null;
        if (accountNumber && !/^\d{4}$/.test(accountNumber)) throw httpError(400, 'Solo se admiten los últimos cuatro dígitos de la cuenta.');
        const id = randomUUID();
        await client.query(
          `INSERT INTO bank_accounts (
             id, company_id, accounting_account_id, bank_name,
             account_label, account_number_last4, account_type
           ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            id, user.company_id, requiredText(body.accountingAccountId, 'La cuenta contable'),
            bankName, label, accountNumber,
            ['checking', 'savings', 'other'].includes(body.accountType) ? body.accountType : 'checking',
          ],
        );
        return { id, bankName, accountLabel: label };
      });
      res.status(201).json({ account });
    } catch (error) {
      sendError(res, error, 'Create bank account');
    }
  });

  router.post('/bank/accounts/:id/statement-lines', async (req, res) => {
    try {
      const result = await withUserTransaction(pool, req, FINANCE_ROLES, async (client, user) => {
        const account = await client.query(
          `SELECT id FROM bank_accounts WHERE company_id = $1 AND id = $2 AND active`,
          [user.company_id, req.params.id],
        );
        if (!account.rowCount) throw httpError(404, 'No se encontró una cuenta bancaria activa.');
        if (!Array.isArray(req.body?.lines) || req.body.lines.length === 0 || req.body.lines.length > 5000) {
          throw httpError(400, 'Indique entre 1 y 5000 movimientos bancarios.');
        }
        let imported = 0;
        let duplicates = 0;
        for (const line of req.body.lines) {
          const date = validDate(line.transactionDate, 'La fecha del movimiento');
          const direction = line.direction;
          if (!['debit', 'credit'].includes(direction)) throw httpError(400, 'El sentido del movimiento debe ser débito o crédito.');
          const amount = money2(positiveNumber(line.amount, 'El importe'));
          const description = typeof line.description === 'string' ? line.description.trim() : '';
          const reference = typeof line.reference === 'string' ? line.reference.trim() : '';
          const fingerprint = createHash('sha256')
            .update(JSON.stringify([date, description, reference, direction, amount]))
            .digest('hex');
          const insert = await client.query(
            `INSERT INTO bank_statement_lines (
               id, company_id, bank_account_id, transaction_date,
               description, reference, direction, amount, source_fingerprint
             ) VALUES ($1,$2,$3,$4,$5,NULLIF($6,''),$7,$8,$9)
             ON CONFLICT (company_id, bank_account_id, source_fingerprint) DO NOTHING`,
            [randomUUID(), user.company_id, req.params.id, date, description, reference, direction, amount, fingerprint],
          );
          if (insert.rowCount) imported += 1;
          else duplicates += 1;
        }
        return { imported, duplicates };
      });
      res.status(201).json(result);
    } catch (error) {
      sendError(res, error, 'Import bank statement lines');
    }
  });

  router.get('/bank/reconciliations', async (req, res) => {
    try {
      const reconciliations = await withUserTransaction(pool, req, FINANCE_ROLES, async (client, user) => {
        const result = await client.query(
          `SELECT reconciliation.*, bank.bank_name, bank.account_label
           FROM bank_reconciliations reconciliation
           JOIN bank_accounts bank
             ON bank.company_id = reconciliation.company_id
            AND bank.id = reconciliation.bank_account_id
           WHERE reconciliation.company_id = $1
           ORDER BY reconciliation.period_end DESC, reconciliation.created_at DESC`,
          [user.company_id],
        );
        return result.rows;
      });
      res.json({ reconciliations });
    } catch (error) {
      sendError(res, error, 'List bank reconciliations');
    }
  });

  router.post('/bank/reconciliations', async (req, res) => {
    try {
      const reconciliation = await withUserTransaction(pool, req, FINANCE_ROLES, async (client, user) => {
        const body = req.body || {};
        const accountId = requiredText(body.bankAccountId, 'La cuenta bancaria');
        const start = validDate(body.periodStart, 'El inicio del período');
        const end = validDate(body.periodEnd, 'El fin del período');
        if (end < start) throw httpError(400, 'El fin del período debe ser igual o posterior al inicio.');
        const statementBalance = money2(Number(body.statementBalance));
        if (!Number.isFinite(statementBalance)) throw httpError(400, 'El saldo bancario indicado no es válido.');
        const account = await client.query(
          `SELECT accounting_account_id FROM bank_accounts
           WHERE company_id = $1 AND id = $2 AND active`,
          [user.company_id, accountId],
        );
        if (!account.rowCount) throw httpError(404, 'No se encontró una cuenta bancaria activa.');
        const book = await client.query(
          `SELECT COALESCE(SUM(line.debit - line.credit), 0)::NUMERIC(16,2) AS balance
           FROM journal_lines line
           JOIN journal_entries entry ON entry.id = line.journal_entry_id
           WHERE entry.company_id = $1 AND entry.status = 'posted'
             AND entry.entry_date <= $3 AND line.account_id = $2`,
          [user.company_id, account.rows[0].accounting_account_id, end],
        );
        const bookBalance = money2(Number(book.rows[0].balance));
        const difference = money2(statementBalance - bookBalance);
        const id = randomUUID();
        await client.query(
          `INSERT INTO bank_reconciliations (
             id, company_id, bank_account_id, period_start, period_end,
             statement_balance, book_balance, difference
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [id, user.company_id, accountId, start, end, statementBalance, bookBalance, difference],
        );
        return { id, statementBalance, bookBalance, difference, status: 'draft' };
      });
      res.status(201).json({ reconciliation });
    } catch (error) {
      sendError(res, error, 'Create bank reconciliation');
    }
  });

  router.get('/bank/reconciliations/:id/lines', async (req, res) => {
    try {
      const data = await withUserTransaction(pool, req, FINANCE_ROLES, async (client, user) => {
        const reconciliation = await client.query(
          `SELECT * FROM bank_reconciliations
           WHERE company_id = $1 AND id = $2`,
          [user.company_id, req.params.id],
        );
        if (!reconciliation.rowCount) throw httpError(404, 'No se encontró la conciliación.');
        const rec = reconciliation.rows[0];
        const [statement, ledger, matches] = await Promise.all([
          client.query(
            `SELECT line.id, line.transaction_date, line.description, line.reference,
                    line.direction, line.amount::TEXT,
                    match.id AS match_id, match.journal_line_id
             FROM bank_statement_lines line
             LEFT JOIN bank_reconciliation_matches match
               ON match.company_id = line.company_id
              AND match.statement_line_id = line.id
             WHERE line.company_id = $1 AND line.bank_account_id = $2
               AND line.transaction_date BETWEEN $3 AND $4
             ORDER BY line.transaction_date, line.id`,
            [user.company_id, rec.bank_account_id, rec.period_start, rec.period_end],
          ),
          client.query(
            `SELECT line.id, entry.entry_date, entry.entry_number, line.description,
                    line.debit::TEXT, line.credit::TEXT, line.account_id,
                    match.id AS match_id, match.statement_line_id
             FROM journal_lines line
             JOIN journal_entries entry ON entry.id = line.journal_entry_id
             LEFT JOIN bank_accounts bank
               ON bank.company_id = entry.company_id
              AND bank.accounting_account_id = line.account_id
             LEFT JOIN bank_reconciliation_matches match
               ON match.company_id = entry.company_id AND match.journal_line_id = line.id
             WHERE entry.company_id = $1 AND entry.status = 'posted'
               AND entry.entry_date BETWEEN $2 AND $3
               AND bank.id = $4
             ORDER BY entry.entry_date, entry.entry_number, line.line_number`,
            [user.company_id, rec.period_start, rec.period_end, rec.bank_account_id],
          ),
          client.query(
            `SELECT id, statement_line_id, journal_line_id
             FROM bank_reconciliation_matches
             WHERE company_id = $1 AND reconciliation_id = $2`,
            [user.company_id, rec.id],
          ),
        ]);
        return { reconciliation: rec, statementLines: statement.rows, journalLines: ledger.rows, matches: matches.rows };
      });
      res.json(data);
    } catch (error) {
      sendError(res, error, 'Load reconciliation lines');
    }
  });

  router.post('/bank/reconciliations/:id/matches', async (req, res) => {
    try {
      const match = await withUserTransaction(pool, req, FINANCE_ROLES, async (client, user) => {
        const reconciliation = await client.query(
          `SELECT bank_account_id, status FROM bank_reconciliations
           WHERE company_id = $1 AND id = $2 FOR UPDATE`,
          [user.company_id, req.params.id],
        );
        if (!reconciliation.rowCount || reconciliation.rows[0].status !== 'draft') {
          throw httpError(409, 'Solo se pueden asociar movimientos en una conciliación en borrador.');
        }
        const account = await client.query(
          `SELECT accounting_account_id FROM bank_accounts
           WHERE company_id = $1 AND id = $2`,
          [user.company_id, reconciliation.rows[0].bank_account_id],
        );
        const id = randomUUID();
        await client.query(
          `INSERT INTO bank_reconciliation_matches (
             id, company_id, bank_account_id, reconciliation_id,
             statement_line_id, journal_line_id, accounting_account_id
           ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            id, user.company_id, reconciliation.rows[0].bank_account_id, req.params.id,
            requiredText(req.body?.statementLineId, 'La línea bancaria'),
            requiredText(req.body?.journalLineId, 'La línea contable'),
            account.rows[0].accounting_account_id,
          ],
        );
        return { id };
      });
      res.status(201).json({ match });
    } catch (error) {
      sendError(res, error, 'Match bank reconciliation lines');
    }
  });

  router.delete('/bank/reconciliations/:id/matches/:matchId', async (req, res) => {
    try {
      await withUserTransaction(pool, req, FINANCE_ROLES, async (client, user) => {
        const result = await client.query(
          `DELETE FROM bank_reconciliation_matches match
           USING bank_reconciliations reconciliation
           WHERE match.company_id = $1 AND match.id = $2
             AND reconciliation.company_id = match.company_id
             AND reconciliation.id = match.reconciliation_id
             AND reconciliation.id = $3 AND reconciliation.status = 'draft'`,
          [user.company_id, req.params.matchId, req.params.id],
        );
        if (!result.rowCount) throw httpError(404, 'No se encontró una coincidencia editable.');
      });
      res.json({ ok: true });
    } catch (error) {
      sendError(res, error, 'Remove bank reconciliation match');
    }
  });

  router.post('/bank/reconciliations/:id/close', async (req, res) => {
    try {
      const reconciliation = await withUserTransaction(pool, req, FINANCE_ROLES, async (client, user) => {
        const result = await client.query(
          `SELECT reconciliation.*, bank.accounting_account_id
           FROM bank_reconciliations reconciliation
           JOIN bank_accounts bank
             ON bank.company_id = reconciliation.company_id
            AND bank.id = reconciliation.bank_account_id
           WHERE reconciliation.company_id = $1 AND reconciliation.id = $2
           FOR UPDATE OF reconciliation`,
          [user.company_id, req.params.id],
        );
        const row = result.rows[0];
        if (!row || row.status !== 'draft') throw httpError(409, 'Solo se puede cerrar una conciliación en borrador.');
        const book = await client.query(
          `SELECT COALESCE(SUM(line.debit - line.credit), 0)::NUMERIC(16,2) AS balance
           FROM journal_lines line
           JOIN journal_entries entry ON entry.id = line.journal_entry_id
           WHERE entry.company_id = $1 AND entry.status = 'posted'
             AND entry.entry_date <= $3 AND line.account_id = $2`,
          [user.company_id, row.accounting_account_id, row.period_end],
        );
        const bookBalance = money2(Number(book.rows[0].balance));
        const statementBalance = Number(row.statement_balance);
        const difference = money2(statementBalance - bookBalance);
        if (difference !== 0) {
          throw httpError(409, `No se puede cerrar: diferencia entre saldo bancario y contable de ${difference.toFixed(2)} VES.`);
        }
        await client.query(
          `UPDATE bank_reconciliations
           SET book_balance = $3, difference = $4, status = 'closed',
               closed_by = $5, closed_at = CURRENT_TIMESTAMP
           WHERE company_id = $1 AND id = $2`,
          [user.company_id, row.id, bookBalance, difference, user.id],
        );
        return { id: row.id, statementBalance, bookBalance, difference, status: 'closed' };
      });
      res.json({ reconciliation });
    } catch (error) {
      sendError(res, error, 'Close bank reconciliation');
    }
  });

  router.get('/reports/:report', async (req, res) => {
    try {
      const report = req.params.report;
      if (!FINANCE_REPORTS.has(report)) throw httpError(404, 'El informe solicitado no existe.');
      const from = validDate(req.query.from, 'La fecha inicial');
      const to = validDate(req.query.to, 'La fecha final');
      if (to < from) throw httpError(400, 'La fecha final debe ser igual o posterior a la inicial.');
      const rows = await withUserTransaction(pool, req, FINANCE_ROLES, (client, user) => (
        getReportRows(client, user.company_id, report, from, to)
      ));
      if (req.query.format === 'xlsx') {
        await writeExcel(res, report, from, to, rows);
        return;
      }
      res.json({ report, from, to, rows });
    } catch (error) {
      sendError(res, error, 'Generate financial report');
    }
  });

  router.post('/workforce/employees/sync', async (req, res) => {
    try {
      const result = await withUserTransaction(pool, req, HR_ROLES, async (client, user) => {
        const employees = req.body?.employees;
        if (!Array.isArray(employees) || employees.length === 0 || employees.length > 1000) {
          throw httpError(400, 'Indique entre 1 y 1000 empleados para sincronizar.');
        }
        let synchronized = 0;
        for (const source of employees) {
          const employee = normalizeEmployee(source);
          const values = [
            employee.id, user.company_id, employee.cedula, employee.rif, employee.nationality,
            employee.firstName, employee.middleName, employee.lastName, employee.secondLastName,
            employee.birthDate, employee.sex, employee.email, employee.phone, employee.address,
            employee.city, employee.state, employee.jobTitle, employee.department,
            employee.hireDate, employee.terminationDate, employee.contractType, employee.status,
            employee.ivssNumber, employee.baseSalary, employee.salaryCurrency, employee.originalSalary,
            employee.payFrequency, employee.foodAllowance, employee.foodCurrency, employee.foodApplies,
            employee.foodPaymentMethod, employee.foodBank, employee.profitDays,
            employee.dayOvertime, employee.nightOvertime, employee.withholding, employee.sellerSalary,
            employee.commissionPercent, employee.sellerPaymentMode, employee.sellerPaymentDescription,
            employee.bankName, employee.bankAccount, employee.bankAccountType, employee.paymentMethod,
            employee.vacationDays, employee.travelAllowance, employee.travelAllowanceOriginal,
            employee.travelAllowanceCurrency, employee.dependents,
          ];
          const insert = await client.query(
            `INSERT INTO employees (
               id, company_id, cedula, rif, nationality, first_name, middle_name,
               last_name, second_last_name, birth_date, sex, email, phone, address,
               city, state, job_title, department, hire_date, termination_date,
               contract_type, status, ivss_membership_number, monthly_base_salary,
               salary_currency, original_monthly_salary, pay_frequency,
               monthly_food_allowance, food_allowance_currency, food_allowance_applies,
               food_allowance_payment_method, food_allowance_bank,
               annual_profit_sharing_days, pending_day_overtime_hours,
               pending_night_overtime_hours, income_tax_withholding_percent,
               seller_salary, commission_percent, seller_payment_mode,
               seller_payment_description, bank_name, bank_account_number,
               bank_account_type, payment_method, vacation_days_taken,
               travel_allowance_pending, travel_allowance_original,
               travel_allowance_currency, family_dependents
             ) VALUES (
               ${values.map((_, index) => `$${index + 1}`).join(',')}
             )
             ON CONFLICT (id) DO UPDATE SET
               cedula = EXCLUDED.cedula, rif = EXCLUDED.rif,
               nationality = EXCLUDED.nationality, first_name = EXCLUDED.first_name,
               middle_name = EXCLUDED.middle_name, last_name = EXCLUDED.last_name,
               second_last_name = EXCLUDED.second_last_name, birth_date = EXCLUDED.birth_date,
               sex = EXCLUDED.sex, email = EXCLUDED.email, phone = EXCLUDED.phone,
               address = EXCLUDED.address, city = EXCLUDED.city, state = EXCLUDED.state,
               job_title = EXCLUDED.job_title, department = EXCLUDED.department,
               hire_date = EXCLUDED.hire_date, termination_date = EXCLUDED.termination_date,
               contract_type = EXCLUDED.contract_type, status = EXCLUDED.status,
               ivss_membership_number = EXCLUDED.ivss_membership_number,
               monthly_base_salary = EXCLUDED.monthly_base_salary,
               salary_currency = EXCLUDED.salary_currency,
               original_monthly_salary = EXCLUDED.original_monthly_salary,
               pay_frequency = EXCLUDED.pay_frequency,
               monthly_food_allowance = EXCLUDED.monthly_food_allowance,
               food_allowance_currency = EXCLUDED.food_allowance_currency,
               food_allowance_applies = EXCLUDED.food_allowance_applies,
               food_allowance_payment_method = EXCLUDED.food_allowance_payment_method,
               food_allowance_bank = EXCLUDED.food_allowance_bank,
               annual_profit_sharing_days = EXCLUDED.annual_profit_sharing_days,
               pending_day_overtime_hours = EXCLUDED.pending_day_overtime_hours,
               pending_night_overtime_hours = EXCLUDED.pending_night_overtime_hours,
               income_tax_withholding_percent = EXCLUDED.income_tax_withholding_percent,
               seller_salary = EXCLUDED.seller_salary,
               commission_percent = EXCLUDED.commission_percent,
               seller_payment_mode = EXCLUDED.seller_payment_mode,
               seller_payment_description = EXCLUDED.seller_payment_description,
               bank_name = EXCLUDED.bank_name,
               bank_account_number = EXCLUDED.bank_account_number,
               bank_account_type = EXCLUDED.bank_account_type,
               payment_method = EXCLUDED.payment_method,
               vacation_days_taken = EXCLUDED.vacation_days_taken,
               travel_allowance_pending = EXCLUDED.travel_allowance_pending,
               travel_allowance_original = EXCLUDED.travel_allowance_original,
               travel_allowance_currency = EXCLUDED.travel_allowance_currency,
               family_dependents = EXCLUDED.family_dependents,
               updated_at = CURRENT_TIMESTAMP
             WHERE employees.company_id = EXCLUDED.company_id`,
            values,
          );
          if (!insert.rowCount) throw httpError(409, `El identificador de empleado ${employee.id} pertenece a otra empresa.`);
          synchronized += 1;
        }
        return { synchronized };
      });
      res.json(result);
    } catch (error) {
      sendError(res, error, 'Synchronize workforce');
    }
  });

  router.get('/workforce/employees', async (req, res) => {
    try {
      const employees = await withUserTransaction(pool, req, HR_ROLES, async (client, user) => {
        const result = await client.query(
          `SELECT id, cedula, first_name, middle_name, last_name, second_last_name,
                  job_title, department, status
           FROM employees WHERE company_id = $1
           ORDER BY last_name, first_name`,
          [user.company_id],
        );
        return result.rows;
      });
      res.json({ employees });
    } catch (error) {
      sendError(res, error, 'List workforce employees');
    }
  });

  router.get('/workforce/assets', async (req, res) => {
    try {
      const assets = await withUserTransaction(pool, req, HR_ROLES, async (client, user) => {
        const result = await client.query(
          `SELECT asset.id, asset.asset_tag, asset.name, asset.category,
                  asset.serial_number, asset.condition_status, asset.availability_status,
                  asset.acquired_on, asset.notes,
                  assignment.id AS assignment_id, assignment.employee_id,
                  employee.first_name, employee.last_name, assignment.delivered_at,
                  assignment.expected_return_on, assignment.condition_at_delivery,
                  assignment.delivery_notes
           FROM employee_assets asset
           LEFT JOIN employee_asset_assignments assignment
             ON assignment.company_id = asset.company_id
            AND assignment.asset_id = asset.id AND assignment.returned_at IS NULL
           LEFT JOIN employees employee
             ON employee.company_id = assignment.company_id
            AND employee.id = assignment.employee_id
           WHERE asset.company_id = $1
           ORDER BY asset.asset_tag`,
          [user.company_id],
        );
        return result.rows;
      });
      res.json({ assets });
    } catch (error) {
      sendError(res, error, 'List employee assets');
    }
  });

  router.post('/workforce/assets', async (req, res) => {
    try {
      const asset = await withUserTransaction(pool, req, HR_ROLES, async (client, user) => {
        const body = req.body || {};
        const id = randomUUID();
        const condition = CONDITIONS.has(body.conditionStatus) ? body.conditionStatus : 'good';
        const acquiredOn = body.acquiredOn ? validDate(body.acquiredOn, 'La fecha de adquisición') : null;
        await client.query(
          `INSERT INTO employee_assets (
             id, company_id, asset_tag, name, category, serial_number,
             condition_status, availability_status, acquired_on, notes, created_by
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,'available',$8,$9,$10)`,
          [
            id, user.company_id, requiredText(body.assetTag, 'El código del bien', 80),
            requiredText(body.name, 'El nombre del bien'),
            typeof body.category === 'string' ? body.category.trim() : '',
            typeof body.serialNumber === 'string' ? body.serialNumber.trim() : '',
            condition, acquiredOn,
            typeof body.notes === 'string' ? body.notes.trim() : '', user.id,
          ],
        );
        return { id };
      });
      res.status(201).json({ asset });
    } catch (error) {
      sendError(res, error, 'Create employee asset');
    }
  });

  router.post('/workforce/assets/:id/assign', async (req, res) => {
    try {
      const assignment = await withUserTransaction(pool, req, HR_ROLES, async (client, user) => {
        const body = req.body || {};
        const asset = await client.query(
          `SELECT condition_status, availability_status
           FROM employee_assets WHERE company_id = $1 AND id = $2 FOR UPDATE`,
          [user.company_id, req.params.id],
        );
        if (!asset.rowCount || asset.rows[0].availability_status !== 'available') {
          throw httpError(409, 'El bien no existe, está asignado, en mantenimiento o retirado.');
        }
        const deliveredCondition = body.conditionAtDelivery || asset.rows[0].condition_status;
        if (!CONDITIONS.has(deliveredCondition)) throw httpError(400, 'El estado de entrega del bien no es válido.');
        const id = randomUUID();
        await client.query(
          `INSERT INTO employee_asset_assignments (
             id, company_id, asset_id, employee_id, expected_return_on,
             condition_at_delivery, delivery_notes, delivered_by
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            id, user.company_id, req.params.id,
            requiredText(body.employeeId, 'El empleado'),
            body.expectedReturnOn ? validDate(body.expectedReturnOn, 'La fecha prevista de devolución') : null,
            deliveredCondition,
            typeof body.deliveryNotes === 'string' ? body.deliveryNotes.trim() : '',
            user.id,
          ],
        );
        return { id };
      });
      res.status(201).json({ assignment });
    } catch (error) {
      sendError(res, error, 'Assign employee asset');
    }
  });

  router.post('/workforce/assets/:id/return', async (req, res) => {
    try {
      await withUserTransaction(pool, req, HR_ROLES, async (client, user) => {
        const condition = req.body?.conditionAtReturn;
        if (!CONDITIONS.has(condition)) throw httpError(400, 'Indique el estado del bien al devolverlo.');
        const updated = await client.query(
          `UPDATE employee_asset_assignments
           SET returned_at = CURRENT_TIMESTAMP, condition_at_return = $4,
               return_notes = $5, returned_by = $6
           WHERE company_id = $1 AND id = $2 AND asset_id = $3
             AND returned_at IS NULL`,
          [
            user.company_id, requiredText(req.body?.assignmentId, 'La asignación'),
            req.params.id, condition,
            typeof req.body?.returnNotes === 'string' ? req.body.returnNotes.trim() : '',
            user.id,
          ],
        );
        if (!updated.rowCount) throw httpError(404, 'No se encontró una asignación pendiente de devolución.');
        await client.query(
          `UPDATE employee_assets
           SET condition_status = $3, updated_at = CURRENT_TIMESTAMP
           WHERE company_id = $1 AND id = $2`,
          [user.company_id, req.params.id, condition],
        );
      });
      res.json({ ok: true });
    } catch (error) {
      sendError(res, error, 'Return employee asset');
    }
  });

  return router;
}

module.exports = {
  createErpOperationsRouter,
  getReportRows,
  normalizeEmployee,
};
