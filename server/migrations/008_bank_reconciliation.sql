CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_accounts_company_id
  ON accounting_accounts (company_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_lines_id_account
  ON journal_lines (id, account_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_company_id
  ON users (company_id, id);

CREATE TABLE IF NOT EXISTS bank_accounts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  accounting_account_id TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_label TEXT NOT NULL,
  account_number_last4 TEXT,
  account_type TEXT NOT NULL DEFAULT 'checking'
    CHECK (account_type IN ('checking', 'savings', 'other')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, id),
  UNIQUE (company_id, accounting_account_id),
  FOREIGN KEY (company_id, accounting_account_id)
    REFERENCES accounting_accounts (company_id, id) ON DELETE RESTRICT,
  CHECK (account_number_last4 IS NULL OR account_number_last4 ~ '^[0-9]{4}$')
);

CREATE TABLE IF NOT EXISTS bank_statement_lines (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  bank_account_id TEXT NOT NULL,
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  reference TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),
  amount NUMERIC(16, 2) NOT NULL CHECK (amount > 0),
  source_fingerprint TEXT NOT NULL
    CHECK (source_fingerprint ~ '^[a-f0-9]{64}$'),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, id),
  UNIQUE (company_id, bank_account_id, id),
  UNIQUE (company_id, bank_account_id, source_fingerprint),
  FOREIGN KEY (company_id, bank_account_id)
    REFERENCES bank_accounts (company_id, id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_account_date
  ON bank_statement_lines (company_id, bank_account_id, transaction_date);

CREATE TABLE IF NOT EXISTS bank_reconciliations (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  bank_account_id TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  statement_balance NUMERIC(16, 2) NOT NULL,
  book_balance NUMERIC(16, 2) NOT NULL,
  difference NUMERIC(16, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'closed')),
  closed_by TEXT,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, id),
  UNIQUE (company_id, bank_account_id, id),
  UNIQUE (company_id, bank_account_id, period_end),
  FOREIGN KEY (company_id, bank_account_id)
    REFERENCES bank_accounts (company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, closed_by)
    REFERENCES users (company_id, id) ON DELETE RESTRICT,
  CHECK (period_end >= period_start),
  CHECK (
    (status = 'draft' AND closed_by IS NULL AND closed_at IS NULL)
    OR (status = 'closed' AND closed_by IS NOT NULL AND closed_at IS NOT NULL)
  ),
  CHECK (status <> 'closed' OR difference = 0)
);
CREATE INDEX IF NOT EXISTS idx_bank_reconciliations_account_period
  ON bank_reconciliations (company_id, bank_account_id, period_end DESC);

CREATE TABLE IF NOT EXISTS bank_reconciliation_matches (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  bank_account_id TEXT NOT NULL,
  reconciliation_id TEXT NOT NULL,
  statement_line_id TEXT NOT NULL,
  journal_line_id TEXT NOT NULL,
  accounting_account_id TEXT NOT NULL,
  matched_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, id),
  UNIQUE (company_id, statement_line_id),
  UNIQUE (company_id, journal_line_id),
  FOREIGN KEY (company_id, bank_account_id)
    REFERENCES bank_accounts (company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, bank_account_id, reconciliation_id)
    REFERENCES bank_reconciliations (company_id, bank_account_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (company_id, bank_account_id, statement_line_id)
    REFERENCES bank_statement_lines (company_id, bank_account_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (company_id, accounting_account_id)
    REFERENCES accounting_accounts (company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (journal_line_id, accounting_account_id)
    REFERENCES journal_lines (id, account_id) ON DELETE RESTRICT
);

CREATE OR REPLACE FUNCTION validate_bank_account()
RETURNS TRIGGER AS $$
DECLARE
  target_type TEXT;
  target_is_group BOOLEAN;
BEGIN
  SELECT account_type, is_group
    INTO target_type, target_is_group
    FROM accounting_accounts
    WHERE company_id = NEW.company_id
      AND id = NEW.accounting_account_id;

  IF target_type IS DISTINCT FROM 'activo' OR target_is_group IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'La cuenta bancaria debe usar una cuenta contable imputable de activo.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bank_accounts_validate
  BEFORE INSERT OR UPDATE OF company_id, accounting_account_id ON bank_accounts
  FOR EACH ROW EXECUTE FUNCTION validate_bank_account();

CREATE OR REPLACE FUNCTION protect_bank_account_classification()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM bank_accounts
      WHERE company_id = OLD.company_id
        AND accounting_account_id = OLD.id
  ) AND (NEW.account_type <> 'activo' OR NEW.is_group) THEN
    RAISE EXCEPTION 'No se puede convertir en agrupadora o no-Activo una cuenta usada por una cuenta bancaria.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_accounting_accounts_protect_bank_classification
  BEFORE UPDATE OF account_type, is_group ON accounting_accounts
  FOR EACH ROW EXECUTE FUNCTION protect_bank_account_classification();

CREATE OR REPLACE FUNCTION protect_closed_bank_reconciliation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'closed' THEN
      RAISE EXCEPTION 'Reabra la conciliación antes de eliminarla.';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'closed' THEN
    IF NEW.status <> 'draft' THEN
      RAISE EXCEPTION 'Una conciliación cerrada es inmutable; reábrala primero.';
    END IF;
    IF (to_jsonb(NEW) - 'status' - 'closed_by' - 'closed_at')
       IS DISTINCT FROM
       (to_jsonb(OLD) - 'status' - 'closed_by' - 'closed_at') THEN
      RAISE EXCEPTION 'Reabra la conciliación en una operación separada antes de editarla.';
    END IF;
    NEW.closed_by := NULL;
    NEW.closed_at := NULL;
  ELSIF NEW.status = 'closed' THEN
    IF NEW.difference <> 0 OR NEW.closed_by IS NULL OR NEW.closed_at IS NULL THEN
      RAISE EXCEPTION 'Para cerrar la conciliación indique responsable y fecha, y deje la diferencia en cero.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bank_reconciliations_protect_closed
  BEFORE UPDATE OR DELETE ON bank_reconciliations
  FOR EACH ROW EXECUTE FUNCTION protect_closed_bank_reconciliation();

CREATE OR REPLACE FUNCTION validate_bank_reconciliation_match()
RETURNS TRIGGER AS $$
DECLARE
  reconciliation_status TEXT;
  reconciliation_start DATE;
  reconciliation_end DATE;
  statement_date DATE;
  statement_direction TEXT;
  statement_amount NUMERIC(16, 2);
  ledger_status TEXT;
  ledger_date DATE;
  ledger_debit NUMERIC(16, 2);
  ledger_credit NUMERIC(16, 2);
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT status INTO reconciliation_status
      FROM bank_reconciliations
      WHERE company_id = OLD.company_id AND id = OLD.reconciliation_id
      FOR UPDATE;
    IF reconciliation_status = 'closed' THEN
      RAISE EXCEPTION 'No se pueden modificar coincidencias de una conciliación cerrada.';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  SELECT status, period_start, period_end
    INTO reconciliation_status, reconciliation_start, reconciliation_end
    FROM bank_reconciliations
    WHERE company_id = NEW.company_id
      AND bank_account_id = NEW.bank_account_id
      AND id = NEW.reconciliation_id
    FOR UPDATE;

  IF reconciliation_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Solo se pueden asociar movimientos en una conciliación en borrador.';
  END IF;

  SELECT transaction_date, direction, amount
    INTO statement_date, statement_direction, statement_amount
    FROM bank_statement_lines
    WHERE company_id = NEW.company_id
      AND bank_account_id = NEW.bank_account_id
      AND id = NEW.statement_line_id;

  IF statement_date IS NULL
     OR statement_date < reconciliation_start
     OR statement_date > reconciliation_end THEN
    RAISE EXCEPTION 'La línea bancaria debe pertenecer al período de la conciliación.';
  END IF;

  SELECT entry.status, entry.entry_date, line.debit, line.credit
    INTO ledger_status, ledger_date, ledger_debit, ledger_credit
    FROM journal_lines AS line
    JOIN journal_entries AS entry
      ON entry.id = line.journal_entry_id
     AND entry.company_id = NEW.company_id
    WHERE line.id = NEW.journal_line_id
      AND line.account_id = NEW.accounting_account_id;

  IF ledger_status IS DISTINCT FROM 'posted' THEN
    RAISE EXCEPTION 'La línea contable debe pertenecer a un asiento contabilizado de la misma empresa.';
  END IF;

  IF ledger_date < reconciliation_start OR ledger_date > reconciliation_end THEN
    RAISE EXCEPTION 'La línea contable debe pertenecer al período de la conciliación.';
  END IF;

  IF (statement_direction = 'debit' AND
      (ledger_credit <> statement_amount OR ledger_debit <> 0))
     OR (statement_direction = 'credit' AND
      (ledger_debit <> statement_amount OR ledger_credit <> 0)) THEN
    RAISE EXCEPTION 'El importe y sentido de la línea bancaria no coincide con la línea contable.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bank_reconciliation_matches_validate
  BEFORE INSERT OR UPDATE OR DELETE ON bank_reconciliation_matches
  FOR EACH ROW EXECUTE FUNCTION validate_bank_reconciliation_match();

DO $$
DECLARE
  target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'bank_accounts'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_no_hard_delete BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION prevent_critical_record_delete()',
      target_table, target_table
    );
  END LOOP;
  FOREACH target_table IN ARRAY ARRAY[
    'bank_accounts', 'bank_statement_lines', 'bank_reconciliations',
    'bank_reconciliation_matches'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_audit_row AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_sensitive_row_change()',
      target_table, target_table
    );
  END LOOP;
END;
$$;
