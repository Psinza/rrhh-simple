CREATE TABLE IF NOT EXISTS accounting_accounts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL
    CHECK (account_type IN ('activo', 'pasivo', 'patrimonio', 'ingreso', 'gasto')),
  parent_account_id TEXT REFERENCES accounting_accounts(id) ON DELETE RESTRICT,
  is_group BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, code)
);
CREATE INDEX IF NOT EXISTS idx_accounting_accounts_parent
  ON accounting_accounts (company_id, parent_account_id);

CREATE TABLE IF NOT EXISTS accounting_periods (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  closed_at TIMESTAMPTZ,
  closed_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_date >= start_date),
  UNIQUE (company_id, start_date, end_date)
);
CREATE INDEX IF NOT EXISTS idx_accounting_periods_company_dates
  ON accounting_periods (company_id, start_date, end_date);

CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  entry_number TEXT NOT NULL,
  entry_date DATE NOT NULL,
  accounting_period_id TEXT NOT NULL REFERENCES accounting_periods(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'voided')),
  reversal_of TEXT UNIQUE REFERENCES journal_entries(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  posted_at TIMESTAMPTZ,
  posted_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  voided_at TIMESTAMPTZ,
  voided_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  void_reason TEXT,
  UNIQUE (company_id, entry_number)
);
CREATE INDEX IF NOT EXISTS idx_journal_entries_company_date
  ON journal_entries (company_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_period_status
  ON journal_entries (accounting_period_id, status);

CREATE TABLE IF NOT EXISTS journal_lines (
  id TEXT PRIMARY KEY,
  journal_entry_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE RESTRICT,
  line_number SMALLINT NOT NULL CHECK (line_number > 0),
  account_id TEXT NOT NULL REFERENCES accounting_accounts(id) ON DELETE RESTRICT,
  description TEXT NOT NULL DEFAULT '',
  debit NUMERIC(16, 2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit NUMERIC(16, 2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)),
  UNIQUE (journal_entry_id, line_number)
);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account_entry
  ON journal_lines (account_id, journal_entry_id);

CREATE OR REPLACE FUNCTION enforce_journal_immutability()
RETURNS TRIGGER AS $$
DECLARE
  parent_status TEXT;
BEGIN
  IF TG_TABLE_NAME = 'journal_entries' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Los asientos no se eliminan; anule el borrador o cree un contra-asiento.';
    END IF;
    IF OLD.status IN ('posted', 'voided') THEN
      RAISE EXCEPTION 'Los asientos contabilizados o anulados son inmutables.';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP <> 'INSERT' THEN
    SELECT status INTO parent_status
      FROM journal_entries
      WHERE id = OLD.journal_entry_id;
    IF parent_status IN ('posted', 'voided') THEN
      RAISE EXCEPTION 'Las líneas de un asiento contabilizado o anulado son inmutables.';
    END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    SELECT status INTO parent_status
      FROM journal_entries
      WHERE id = NEW.journal_entry_id;
    IF parent_status IN ('posted', 'voided') THEN
      RAISE EXCEPTION 'Las líneas de un asiento contabilizado o anulado son inmutables.';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_journal_entry_immutability ON journal_entries;
CREATE TRIGGER trg_journal_entry_immutability
  BEFORE UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION enforce_journal_immutability();

DROP TRIGGER IF EXISTS trg_journal_line_immutability ON journal_lines;
CREATE TRIGGER trg_journal_line_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION enforce_journal_immutability();

CREATE OR REPLACE FUNCTION assert_posted_journal_balanced()
RETURNS TRIGGER AS $$
DECLARE
  target_entry_id TEXT;
  target_status TEXT;
  line_count INTEGER;
  debit_total NUMERIC(18, 2);
  credit_total NUMERIC(18, 2);
  entry_date DATE;
  period_start DATE;
  period_end DATE;
  period_status TEXT;
BEGIN
  IF TG_TABLE_NAME = 'journal_entries' THEN
    target_entry_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  ELSE
    target_entry_id := CASE
      WHEN TG_OP = 'DELETE' THEN OLD.journal_entry_id
      ELSE NEW.journal_entry_id
    END;
  END IF;

  SELECT je.status, je.entry_date, ap.start_date, ap.end_date, ap.status
    INTO target_status, entry_date, period_start, period_end, period_status
    FROM journal_entries AS je
    JOIN accounting_periods AS ap ON ap.id = je.accounting_period_id
    WHERE je.id = target_entry_id;
  IF target_status IS DISTINCT FROM 'posted' THEN
    RETURN NULL;
  END IF;

  IF period_status <> 'open' OR entry_date < period_start OR entry_date > period_end THEN
    RAISE EXCEPTION 'El asiento % debe pertenecer a un período abierto y contener su fecha.',
      target_entry_id;
  END IF;

  SELECT COUNT(*), COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
    INTO line_count, debit_total, credit_total
    FROM journal_lines
    WHERE journal_entry_id = target_entry_id;

  IF line_count < 2 OR debit_total <= 0 OR debit_total <> credit_total THEN
    RAISE EXCEPTION 'El asiento % no está balanceado: líneas %, debe %, haber %.',
      target_entry_id, line_count, debit_total, credit_total;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM journal_lines AS jl
      JOIN accounting_accounts AS aa ON aa.id = jl.account_id
      JOIN journal_entries AS je ON je.id = jl.journal_entry_id
      WHERE jl.journal_entry_id = target_entry_id
        AND (aa.company_id <> je.company_id OR aa.active = FALSE OR aa.is_group = TRUE)
  ) THEN
    RAISE EXCEPTION 'El asiento % contiene una cuenta inactiva, agrupadora o de otra empresa.',
      target_entry_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_journal_entry_balance ON journal_entries;
CREATE CONSTRAINT TRIGGER trg_journal_entry_balance
  AFTER INSERT OR UPDATE ON journal_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_posted_journal_balanced();

DROP TRIGGER IF EXISTS trg_journal_lines_balance ON journal_lines;
CREATE CONSTRAINT TRIGGER trg_journal_lines_balance
  AFTER INSERT OR UPDATE OR DELETE ON journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_posted_journal_balanced();
