-- GENERATED FILE: run `npm run db:schema:build` to recreate this clean-install schema.

-- Apply only to a new, empty database. Existing databases must use `npm run db:migrate`.

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (

  version TEXT PRIMARY KEY,

  applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP

);


-- BEGIN 001_core_and_workforce.sql
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  rif TEXT NOT NULL UNIQUE,
  legal_name TEXT NOT NULL,
  trade_name TEXT,
  employer_registration TEXT,
  faov_code TEXT,
  inces_code TEXT,
  fiscal_address TEXT,
  city TEXT,
  state TEXT,
  phone TEXT,
  email TEXT,
  legal_representative TEXT,
  representative_id TEXT,
  representative_title TEXT,
  ivss_risk_percent NUMERIC(5, 2) NOT NULL DEFAULT 9
    CHECK (ivss_risk_percent IN (9, 10, 11)),
  national_minimum_salary NUMERIC(16, 2) NOT NULL DEFAULT 0
    CHECK (national_minimum_salary >= 0),
  monthly_food_allowance NUMERIC(16, 2) NOT NULL DEFAULT 0
    CHECK (monthly_food_allowance >= 0),
  bcv_usd_rate NUMERIC(16, 6) NOT NULL DEFAULT 0
    CHECK (bcv_usd_rate >= 0),
  benefits_interest_rate NUMERIC(8, 4) NOT NULL DEFAULT 0
    CHECK (benefits_interest_rate >= 0),
  current_month_mondays SMALLINT NOT NULL DEFAULT 4
    CHECK (current_month_mondays IN (4, 5)),
  annual_profit_sharing_days SMALLINT NOT NULL DEFAULT 30
    CHECK (annual_profit_sharing_days BETWEEN 30 AND 120),
  logo_url TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES companies(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  permission_key TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  module TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE RESTRICT,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT,
  nombre TEXT NOT NULL DEFAULT '',
  cargo TEXT NOT NULL DEFAULT '',
  rol TEXT NOT NULL DEFAULT 'consulta',
  rolTitulo TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT '',
  badgeColor TEXT NOT NULL DEFAULT '',
  nivelAcceso TEXT NOT NULL DEFAULT '',
  descripcionAcceso TEXT NOT NULL DEFAULT '',
  permisos JSONB NOT NULL DEFAULT '[]'::JSONB,
  company_id TEXT REFERENCES companies(id) ON DELETE RESTRICT,
  branch_id TEXT REFERENCES branches(id) ON DELETE RESTRICT,
  role_id TEXT REFERENCES roles(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id TEXT
  REFERENCES companies(id) ON DELETE RESTRICT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id TEXT
  REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id TEXT
  REFERENCES roles(id) ON DELETE RESTRICT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ALTER COLUMN permisos TYPE JSONB USING
  CASE WHEN jsonb_typeof(permisos::JSONB) = 'array' THEN permisos::JSONB ELSE '[]'::JSONB END;
ALTER TABLE users ALTER COLUMN permisos SET DEFAULT '[]'::JSONB;

CREATE TABLE IF NOT EXISTS system_parameters (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES companies(id) ON DELETE RESTRICT,
  parameter_key TEXT NOT NULL,
  value JSONB NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  updated_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, parameter_key)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES companies(id) ON DELETE RESTRICT,
  user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  username TEXT NOT NULL DEFAULT '',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  ip_address INET,
  outcome TEXT NOT NULL DEFAULT 'success'
    CHECK (outcome IN ('success', 'failure')),
  reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_events_company_time
  ON audit_events (company_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity
  ON audit_events (entity_type, entity_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  branch_id TEXT REFERENCES branches(id) ON DELETE RESTRICT,
  cedula TEXT NOT NULL,
  rif TEXT NOT NULL DEFAULT '',
  nationality CHAR(1) NOT NULL CHECK (nationality IN ('V', 'E')),
  first_name TEXT NOT NULL,
  middle_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL,
  second_last_name TEXT NOT NULL DEFAULT '',
  birth_date DATE NOT NULL,
  sex CHAR(1) NOT NULL CHECK (sex IN ('M', 'F')),
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  job_title TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  hire_date DATE NOT NULL,
  termination_date DATE,
  contract_type TEXT NOT NULL CHECK (contract_type IN ('indeterminado', 'determinado', 'obra')),
  status TEXT NOT NULL DEFAULT 'activo'
    CHECK (status IN ('activo', 'vacaciones', 'reposo', 'egresado')),
  ivss_membership_number TEXT NOT NULL DEFAULT '',
  monthly_base_salary NUMERIC(16, 2) NOT NULL DEFAULT 0 CHECK (monthly_base_salary >= 0),
  salary_currency TEXT NOT NULL DEFAULT 'BS' CHECK (salary_currency IN ('BS', 'USD')),
  original_monthly_salary NUMERIC(16, 2) CHECK (original_monthly_salary >= 0),
  pay_frequency TEXT NOT NULL DEFAULT 'quincenal'
    CHECK (pay_frequency IN ('semanal', 'quincenal', 'mensual')),
  monthly_food_allowance NUMERIC(16, 2) NOT NULL DEFAULT 0 CHECK (monthly_food_allowance >= 0),
  food_allowance_currency TEXT NOT NULL DEFAULT 'BS'
    CHECK (food_allowance_currency IN ('BS', 'USD')),
  food_allowance_applies BOOLEAN NOT NULL DEFAULT TRUE,
  food_allowance_payment_method TEXT,
  food_allowance_bank TEXT NOT NULL DEFAULT '',
  annual_profit_sharing_days SMALLINT NOT NULL DEFAULT 30
    CHECK (annual_profit_sharing_days BETWEEN 30 AND 120),
  pending_day_overtime_hours NUMERIC(10, 2) NOT NULL DEFAULT 0
    CHECK (pending_day_overtime_hours >= 0),
  pending_night_overtime_hours NUMERIC(10, 2) NOT NULL DEFAULT 0
    CHECK (pending_night_overtime_hours >= 0),
  income_tax_withholding_percent NUMERIC(6, 3) NOT NULL DEFAULT 0
    CHECK (income_tax_withholding_percent BETWEEN 0 AND 100),
  seller_salary NUMERIC(16, 2) CHECK (seller_salary >= 0),
  commission_percent NUMERIC(7, 4) CHECK (commission_percent >= 0),
  seller_payment_mode TEXT,
  seller_payment_description TEXT,
  bank_name TEXT NOT NULL DEFAULT '',
  bank_account_number TEXT NOT NULL DEFAULT '',
  bank_account_type TEXT CHECK (bank_account_type IN ('Corriente', 'Ahorro')),
  payment_method TEXT,
  vacation_days_taken NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (vacation_days_taken >= 0),
  travel_allowance_pending NUMERIC(16, 2) NOT NULL DEFAULT 0 CHECK (travel_allowance_pending >= 0),
  travel_allowance_original NUMERIC(16, 2) CHECK (travel_allowance_original >= 0),
  travel_allowance_currency TEXT CHECK (travel_allowance_currency IN ('BS', 'USD')),
  family_dependents SMALLINT NOT NULL DEFAULT 0 CHECK (family_dependents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, cedula)
);
CREATE INDEX IF NOT EXISTS idx_employees_company_status
  ON employees (company_id, status);
CREATE INDEX IF NOT EXISTS idx_employees_company_department
  ON employees (company_id, department);

COMMENT ON COLUMN employees.bank_account_number IS
  'Sensitive data: not encrypted by this phase. Restrict PostgreSQL host, backups, and database access.';

CREATE TABLE IF NOT EXISTS employee_documents (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  data_url TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_employee_documents_employee
  ON employee_documents (employee_id, uploaded_at DESC);

CREATE TABLE IF NOT EXISTS employee_work_history (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  event_date DATE NOT NULL,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  previous_salary NUMERIC(16, 2) CHECK (previous_salary >= 0),
  new_salary NUMERIC(16, 2) CHECK (new_salary >= 0),
  registered_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_employee_work_history_employee_date
  ON employee_work_history (employee_id, event_date DESC);

CREATE TABLE IF NOT EXISTS employee_benefit_advances (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  advance_date DATE NOT NULL,
  amount NUMERIC(16, 2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  fund_percentage NUMERIC(7, 4) NOT NULL CHECK (fund_percentage BETWEEN 0 AND 100),
  approved_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_benefit_interest (
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  year SMALLINT NOT NULL,
  month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  monthly_integral_salary NUMERIC(16, 2) NOT NULL CHECK (monthly_integral_salary >= 0),
  accumulated_capital NUMERIC(16, 2) NOT NULL CHECK (accumulated_capital >= 0),
  annual_rate NUMERIC(8, 4) NOT NULL CHECK (annual_rate >= 0),
  interest_generated NUMERIC(16, 2) NOT NULL CHECK (interest_generated >= 0),
  payment_status TEXT NOT NULL,
  PRIMARY KEY (employee_id, year, month)
);

CREATE TABLE IF NOT EXISTS payroll_periods (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  name TEXT NOT NULL DEFAULT '',
  period_type TEXT NOT NULL CHECK (period_type IN ('Semanal', '1ra Quincena', '2da Quincena', 'Mensual')),
  month_name TEXT NOT NULL,
  year SMALLINT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  payment_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Borrador'
    CHECK (status IN ('Borrador', 'Calculada', 'Aprobada', 'Pagada')),
  total_payroll_bs NUMERIC(16, 2) NOT NULL DEFAULT 0 CHECK (total_payroll_bs >= 0),
  total_food_allowance_bs NUMERIC(16, 2) NOT NULL DEFAULT 0 CHECK (total_food_allowance_bs >= 0),
  total_employer_contributions_bs NUMERIC(16, 2) NOT NULL DEFAULT 0
    CHECK (total_employer_contributions_bs >= 0),
  total_company_cost_bs NUMERIC(16, 2) NOT NULL DEFAULT 0 CHECK (total_company_cost_bs >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_company_date
  ON payroll_periods (company_id, start_date DESC);

CREATE TABLE IF NOT EXISTS payroll_items (
  id TEXT PRIMARY KEY,
  payroll_period_id TEXT NOT NULL REFERENCES payroll_periods(id) ON DELETE RESTRICT,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  employee_snapshot JSONB NOT NULL,
  calculation_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (payroll_period_id, employee_id)
);
CREATE INDEX IF NOT EXISTS idx_payroll_items_employee
  ON payroll_items (employee_id, payroll_period_id);

CREATE TABLE IF NOT EXISTS internal_product_sales (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  seller_id TEXT REFERENCES employees(id) ON DELETE RESTRICT,
  seller_name TEXT NOT NULL,
  sale_date DATE NOT NULL,
  customer TEXT NOT NULL DEFAULT '',
  reference TEXT NOT NULL,
  amount_bs NUMERIC(16, 2) NOT NULL CHECK (amount_bs >= 0),
  commission_percent NUMERIC(7, 4) NOT NULL DEFAULT 0 CHECK (commission_percent >= 0),
  commission_bs NUMERIC(16, 2) NOT NULL DEFAULT 0 CHECK (commission_bs >= 0),
  status TEXT NOT NULL DEFAULT 'Pendiente' CHECK (status IN ('Pendiente', 'Liquidada')),
  observations TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'BS' CHECK (currency IN ('BS', 'USD')),
  original_amount NUMERIC(16, 2) CHECK (original_amount >= 0),
  payroll_period_id TEXT REFERENCES payroll_periods(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_internal_sales_company_seller_date
  ON internal_product_sales (company_id, seller_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_internal_sales_payroll_period
  ON internal_product_sales (payroll_period_id, status);

CREATE TABLE IF NOT EXISTS product_assignments (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  employee_name TEXT NOT NULL,
  product TEXT NOT NULL,
  quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
  amount_bs NUMERIC(16, 2) NOT NULL CHECK (amount_bs >= 0),
  currency TEXT NOT NULL DEFAULT 'BS' CHECK (currency IN ('BS', 'USD')),
  original_amount NUMERIC(16, 2) CHECK (original_amount >= 0),
  assignment_month TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Asignado' CHECK (status IN ('Asignado', 'Entregado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_product_assignments_employee_month
  ON product_assignments (company_id, employee_id, assignment_month);

CREATE TABLE IF NOT EXISTS product_purchases (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  employee_id TEXT REFERENCES employees(id) ON DELETE RESTRICT,
  product TEXT NOT NULL,
  supplier TEXT NOT NULL,
  quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
  amount_bs NUMERIC(16, 2) NOT NULL CHECK (amount_bs >= 0),
  currency TEXT NOT NULL DEFAULT 'BS' CHECK (currency IN ('BS', 'USD')),
  original_amount NUMERIC(16, 2) CHECK (original_amount >= 0),
  purchase_date DATE NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_loans (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  principal_bs NUMERIC(16, 2) NOT NULL CHECK (principal_bs > 0),
  principal_currency TEXT NOT NULL DEFAULT 'BS' CHECK (principal_currency IN ('BS', 'USD')),
  principal_original NUMERIC(16, 2) CHECK (principal_original >= 0),
  installment_bs NUMERIC(16, 2) NOT NULL CHECK (installment_bs > 0),
  installment_currency TEXT NOT NULL DEFAULT 'BS' CHECK (installment_currency IN ('BS', 'USD')),
  installment_original NUMERIC(16, 2) CHECK (installment_original >= 0),
  outstanding_bs NUMERIC(16, 2) NOT NULL CHECK (outstanding_bs >= 0),
  status TEXT NOT NULL DEFAULT 'Activo' CHECK (status IN ('Activo', 'Cancelado')),
  created_at DATE NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_employee_loans_employee_status
  ON employee_loans (company_id, employee_id, status);

CREATE TABLE IF NOT EXISTS payroll_adjustments (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  payroll_period_id TEXT REFERENCES payroll_periods(id) ON DELETE RESTRICT,
  overtime_day_hours NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (overtime_day_hours >= 0),
  overtime_night_hours NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (overtime_night_hours >= 0),
  travel_allowance_bs NUMERIC(16, 2) NOT NULL DEFAULT 0 CHECK (travel_allowance_bs >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_employee_period
  ON payroll_adjustments (company_id, employee_id, payroll_period_id);

CREATE TABLE IF NOT EXISTS currency_rates (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  rate_date DATE NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  currency_from TEXT NOT NULL DEFAULT 'USD',
  currency_to TEXT NOT NULL DEFAULT 'VES',
  rate NUMERIC(16, 6) NOT NULL CHECK (rate > 0),
  created_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, rate_date, currency_from, currency_to, source)
);
CREATE INDEX IF NOT EXISTS idx_currency_rates_company_date
  ON currency_rates (company_id, rate_date DESC);
INSERT INTO schema_migrations (version) VALUES ('001') ON CONFLICT (version) DO NOTHING;
-- END 001_core_and_workforce.sql


-- BEGIN 002_accounting.sql
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
INSERT INTO schema_migrations (version) VALUES ('002') ON CONFLICT (version) DO NOTHING;
-- END 002_accounting.sql


-- BEGIN 003_fiscal_foundation.sql
CREATE TABLE IF NOT EXISTS fiscal_configurations (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  jurisdiction_code TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'inactive')),
  reporting_currency_code CHAR(3) NOT NULL,
  minor_unit_digits SMALLINT NOT NULL CHECK (minor_unit_digits BETWEEN 0 AND 4),
  effective_from DATE NOT NULL,
  effective_until DATE,
  legal_source_reference TEXT,
  verified_at TIMESTAMPTZ,
  verified_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (effective_until IS NULL OR effective_until >= effective_from),
  CHECK (status <> 'active' OR (
    legal_source_reference IS NOT NULL AND verified_at IS NOT NULL AND verified_by IS NOT NULL
  )),
  UNIQUE (company_id, jurisdiction_code, version)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fiscal_configurations_one_active
  ON fiscal_configurations (company_id, jurisdiction_code)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS fiscal_taxes (
  id TEXT PRIMARY KEY,
  configuration_id TEXT NOT NULL REFERENCES fiscal_configurations(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  tax_kind TEXT NOT NULL CHECK (tax_kind IN ('iva', 'islr', 'igtf', 'other')),
  calculation_type TEXT NOT NULL DEFAULT 'percentage'
    CHECK (calculation_type IN ('percentage')),
  calculation_basis TEXT NOT NULL DEFAULT 'line_taxable_base'
    CHECK (calculation_basis IN ('line_taxable_base')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (configuration_id, code)
);

CREATE TABLE IF NOT EXISTS fiscal_tax_rates (
  id TEXT PRIMARY KEY,
  tax_id TEXT NOT NULL REFERENCES fiscal_taxes(id) ON DELETE RESTRICT,
  rate_code TEXT NOT NULL,
  rate_percent NUMERIC(12, 6) NOT NULL CHECK (rate_percent BETWEEN 0 AND 100),
  effective_from DATE NOT NULL,
  effective_until DATE,
  applies_to_document_types TEXT[] NOT NULL DEFAULT '{}',
  counterparty_conditions TEXT[] NOT NULL DEFAULT '{}',
  product_service_codes TEXT[] NOT NULL DEFAULT '{}',
  is_exempt BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  legal_source_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (effective_until IS NULL OR effective_until >= effective_from),
  CHECK (NOT is_exempt OR rate_percent = 0),
  UNIQUE (tax_id, rate_code, effective_from)
);
CREATE INDEX IF NOT EXISTS idx_fiscal_tax_rates_effective
  ON fiscal_tax_rates (tax_id, effective_from, effective_until);

CREATE TABLE IF NOT EXISTS fiscal_series (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  branch_id TEXT REFERENCES branches(id) ON DELETE RESTRICT,
  configuration_id TEXT NOT NULL REFERENCES fiscal_configurations(id) ON DELETE RESTRICT,
  document_type TEXT NOT NULL
    CHECK (document_type IN ('invoice', 'credit_note', 'debit_note', 'delivery_note')),
  series_code TEXT NOT NULL,
  number_from BIGINT NOT NULL CHECK (number_from > 0),
  number_until BIGINT CHECK (number_until IS NULL OR number_until >= number_from),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fiscal_series_code_scope
  ON fiscal_series (company_id, COALESCE(branch_id, ''), document_type, series_code);

CREATE TABLE IF NOT EXISTS fiscal_sequences (
  series_id TEXT PRIMARY KEY REFERENCES fiscal_series(id) ON DELETE RESTRICT,
  next_number BIGINT NOT NULL CHECK (next_number > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fiscal_documents (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  branch_id TEXT REFERENCES branches(id) ON DELETE RESTRICT,
  configuration_id TEXT NOT NULL REFERENCES fiscal_configurations(id) ON DELETE RESTRICT,
  series_id TEXT NOT NULL REFERENCES fiscal_series(id) ON DELETE RESTRICT,
  document_type TEXT NOT NULL
    CHECK (document_type IN ('invoice', 'credit_note', 'debit_note', 'delivery_note')),
  document_number BIGINT NOT NULL CHECK (document_number > 0),
  issue_date DATE NOT NULL,
  counterparty_id TEXT,
  counterparty_name TEXT NOT NULL,
  counterparty_tax_id TEXT,
  counterparty_condition TEXT NOT NULL,
  currency_code CHAR(3) NOT NULL,
  minor_unit_digits SMALLINT NOT NULL CHECK (minor_unit_digits BETWEEN 0 AND 4),
  exchange_rate NUMERIC(20, 8),
  net_amount NUMERIC(20, 6) NOT NULL DEFAULT 0 CHECK (net_amount >= 0),
  tax_amount NUMERIC(20, 6) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  gross_amount NUMERIC(20, 6) NOT NULL DEFAULT 0 CHECK (gross_amount >= 0),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'issued', 'voided', 'reversed')),
  reversal_of TEXT UNIQUE REFERENCES fiscal_documents(id) ON DELETE RESTRICT,
  reversed_by TEXT UNIQUE REFERENCES fiscal_documents(id) ON DELETE RESTRICT,
  void_reason TEXT,
  calculation_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  integrity_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  issued_at TIMESTAMPTZ,
  issued_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE (company_id, series_id, document_number),
  CHECK (gross_amount = net_amount + tax_amount),
  CHECK (exchange_rate IS NULL OR exchange_rate > 0),
  CHECK (status <> 'voided' OR NULLIF(BTRIM(void_reason), '') IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_company_issue_date
  ON fiscal_documents (company_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_company_type_status
  ON fiscal_documents (company_id, document_type, status, issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_counterparty
  ON fiscal_documents (company_id, counterparty_id, issue_date DESC);

CREATE TABLE IF NOT EXISTS fiscal_document_lines (
  id TEXT PRIMARY KEY,
  fiscal_document_id TEXT NOT NULL REFERENCES fiscal_documents(id) ON DELETE RESTRICT,
  line_number INTEGER NOT NULL CHECK (line_number > 0),
  product_service_code TEXT,
  description TEXT NOT NULL,
  quantity NUMERIC(20, 6) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(20, 6) NOT NULL CHECK (unit_price >= 0),
  discount_amount NUMERIC(20, 6) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  taxable_base NUMERIC(20, 6) NOT NULL CHECK (taxable_base >= 0),
  tax_amount NUMERIC(20, 6) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  gross_amount NUMERIC(20, 6) NOT NULL CHECK (gross_amount >= 0),
  tax_snapshot JSONB NOT NULL DEFAULT '[]'::JSONB,
  UNIQUE (fiscal_document_id, line_number),
  CHECK (gross_amount = taxable_base + tax_amount)
);
CREATE INDEX IF NOT EXISTS idx_fiscal_document_lines_document
  ON fiscal_document_lines (fiscal_document_id, line_number);

CREATE TABLE IF NOT EXISTS fiscal_withholdings (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  source_document_id TEXT REFERENCES fiscal_documents(id) ON DELETE RESTRICT,
  configuration_id TEXT NOT NULL REFERENCES fiscal_configurations(id) ON DELETE RESTRICT,
  withholding_kind TEXT NOT NULL CHECK (withholding_kind IN ('iva', 'islr')),
  certificate_number TEXT NOT NULL,
  withholding_date DATE NOT NULL,
  counterparty_tax_id TEXT NOT NULL,
  currency_code CHAR(3) NOT NULL,
  minor_unit_digits SMALLINT NOT NULL CHECK (minor_unit_digits BETWEEN 0 AND 4),
  exchange_rate NUMERIC(20, 8),
  taxable_base NUMERIC(20, 6) NOT NULL CHECK (taxable_base >= 0),
  withheld_amount NUMERIC(20, 6) NOT NULL CHECK (withheld_amount >= 0),
  rate_snapshot JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'voided')),
  void_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE (company_id, withholding_kind, certificate_number),
  CHECK (exchange_rate IS NULL OR exchange_rate > 0),
  CHECK (status <> 'voided' OR NULLIF(BTRIM(void_reason), '') IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_fiscal_withholdings_company_date
  ON fiscal_withholdings (company_id, withholding_date DESC, withholding_kind);

CREATE TABLE IF NOT EXISTS igtf_operations (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  source_document_id TEXT REFERENCES fiscal_documents(id) ON DELETE RESTRICT,
  configuration_id TEXT NOT NULL REFERENCES fiscal_configurations(id) ON DELETE RESTRICT,
  operation_date DATE NOT NULL,
  operation_type TEXT NOT NULL,
  currency_code CHAR(3) NOT NULL,
  minor_unit_digits SMALLINT NOT NULL CHECK (minor_unit_digits BETWEEN 0 AND 4),
  exchange_rate NUMERIC(20, 8),
  taxable_base NUMERIC(20, 6) NOT NULL CHECK (taxable_base >= 0),
  tax_amount NUMERIC(20, 6) NOT NULL CHECK (tax_amount >= 0),
  rate_snapshot JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'recorded'
    CHECK (status IN ('recorded', 'voided', 'reversed')),
  correction_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  CHECK (exchange_rate IS NULL OR exchange_rate > 0),
  CHECK (status NOT IN ('voided', 'reversed') OR NULLIF(BTRIM(correction_reason), '') IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_igtf_operations_company_date
  ON igtf_operations (company_id, operation_date DESC);

CREATE TABLE IF NOT EXISTS fiscal_books (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  configuration_id TEXT NOT NULL REFERENCES fiscal_configurations(id) ON DELETE RESTRICT,
  book_type TEXT NOT NULL CHECK (book_type IN ('purchases', 'sales')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'superseded')),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  generated_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  source_snapshot JSONB NOT NULL DEFAULT '[]'::JSONB,
  content_hash TEXT,
  supersedes_id TEXT REFERENCES fiscal_books(id) ON DELETE RESTRICT,
  CHECK (period_end >= period_start),
  UNIQUE (company_id, book_type, period_start, period_end, id)
);
CREATE INDEX IF NOT EXISTS idx_fiscal_books_company_period
  ON fiscal_books (company_id, book_type, period_start, period_end);

CREATE TABLE IF NOT EXISTS fiscal_events (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sequence_number BIGINT NOT NULL CHECK (sequence_number > 0),
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure')),
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  previous_hash TEXT,
  event_hash TEXT NOT NULL,
  UNIQUE (company_id, sequence_number),
  UNIQUE (company_id, event_hash)
);
CREATE INDEX IF NOT EXISTS idx_fiscal_events_company_time
  ON fiscal_events (company_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_fiscal_events_entity
  ON fiscal_events (company_id, entity_type, entity_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS fiscal_compliance_requirements (
  id TEXT PRIMARY KEY,
  jurisdiction_code TEXT NOT NULL,
  requirement_code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  legal_source_reference TEXT,
  legal_source_verified_at TIMESTAMPTZ,
  implementation_status TEXT NOT NULL DEFAULT 'planned'
    CHECK (implementation_status IN ('planned', 'in_progress', 'implemented', 'not_applicable')),
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'passed', 'failed', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (jurisdiction_code, requirement_code)
);

CREATE TABLE IF NOT EXISTS fiscal_compliance_evidence (
  id TEXT PRIMARY KEY,
  requirement_id TEXT NOT NULL REFERENCES fiscal_compliance_requirements(id) ON DELETE RESTRICT,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('test', 'review', 'document', 'operation')),
  evidence_reference TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('passed', 'failed', 'blocked')),
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  recorded_by TEXT REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_fiscal_compliance_evidence_requirement
  ON fiscal_compliance_evidence (requirement_id, recorded_at DESC);

CREATE OR REPLACE FUNCTION validate_fiscal_related_company_scope()
RETURNS TRIGGER AS $$
DECLARE
  configuration_company_id TEXT;
  configuration_status TEXT;
  configuration_currency CHAR(3);
  configuration_from DATE;
  configuration_until DATE;
  branch_company_id TEXT;
  source_company_id TEXT;
  operation_date_value DATE;
  record_currency CHAR(3);
  record_status TEXT;
  record_exchange_rate NUMERIC(20, 8);
BEGIN
  SELECT company_id, status, reporting_currency_code, effective_from, effective_until
    INTO configuration_company_id, configuration_status, configuration_currency,
         configuration_from, configuration_until
    FROM fiscal_configurations WHERE id = NEW.configuration_id;
  IF configuration_company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'La configuración fiscal debe pertenecer a la misma empresa del registro.';
  END IF;

  IF TG_TABLE_NAME = 'fiscal_series' THEN
    IF NEW.branch_id IS NOT NULL THEN
      SELECT company_id INTO branch_company_id FROM branches WHERE id = NEW.branch_id;
      IF branch_company_id IS DISTINCT FROM NEW.company_id THEN
        RAISE EXCEPTION 'La sucursal de la serie fiscal debe pertenecer a la misma empresa.';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.source_document_id IS NOT NULL THEN
    SELECT company_id INTO source_company_id
      FROM fiscal_documents WHERE id = NEW.source_document_id;
    IF source_company_id IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'El documento de origen debe pertenecer a la misma empresa.';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'fiscal_withholdings' THEN
    operation_date_value := NEW.withholding_date;
    record_status := NEW.status;
    record_currency := NEW.currency_code;
    record_exchange_rate := NEW.exchange_rate;
  ELSE
    operation_date_value := NEW.operation_date;
    record_status := NEW.status;
    record_currency := NEW.currency_code;
    record_exchange_rate := NEW.exchange_rate;
  END IF;

  IF (TG_TABLE_NAME = 'fiscal_withholdings' AND record_status = 'issued')
     OR (TG_TABLE_NAME = 'igtf_operations' AND record_status = 'recorded') THEN
    IF configuration_status <> 'active'
       OR operation_date_value < configuration_from
       OR (configuration_until IS NOT NULL AND operation_date_value > configuration_until)
       OR (record_currency <> configuration_currency AND record_exchange_rate IS NULL) THEN
      RAISE EXCEPTION 'El registro fiscal emitido debe usar una configuración vigente y una tasa de cambio cuando corresponda.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'fiscal_series', 'fiscal_withholdings', 'igtf_operations'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_scope ON %I', target_table, target_table);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_scope BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION validate_fiscal_related_company_scope()',
      target_table, target_table
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION validate_fiscal_document_scope()
RETURNS TRIGGER AS $$
DECLARE
  config_company_id TEXT;
  config_status TEXT;
  config_reporting_currency CHAR(3);
  config_from DATE;
  config_until DATE;
  series_company_id TEXT;
  series_branch_id TEXT;
  series_configuration_id TEXT;
  series_document_type TEXT;
  series_from BIGINT;
  series_until BIGINT;
BEGIN
  SELECT company_id, status, reporting_currency_code, effective_from, effective_until
    INTO config_company_id, config_status, config_reporting_currency, config_from, config_until
    FROM fiscal_configurations WHERE id = NEW.configuration_id;
  SELECT company_id, branch_id, configuration_id, document_type, number_from, number_until
    INTO series_company_id, series_branch_id, series_configuration_id,
         series_document_type, series_from, series_until
    FROM fiscal_series WHERE id = NEW.series_id;

  IF config_company_id IS DISTINCT FROM NEW.company_id
     OR series_company_id IS DISTINCT FROM NEW.company_id
     OR series_branch_id IS DISTINCT FROM NEW.branch_id
     OR series_configuration_id IS DISTINCT FROM NEW.configuration_id
     OR series_document_type IS DISTINCT FROM NEW.document_type THEN
    RAISE EXCEPTION 'La empresa, sucursal, configuración, serie y tipo documental deben coincidir.';
  END IF;
  IF NEW.status = 'issued' AND (
    config_status <> 'active'
    OR NEW.issue_date < config_from
    OR (config_until IS NOT NULL AND NEW.issue_date > config_until)
    OR (NEW.currency_code <> config_reporting_currency AND NEW.exchange_rate IS NULL)
    OR NEW.document_number < series_from
    OR (series_until IS NOT NULL AND NEW.document_number > series_until)
  ) THEN
    RAISE EXCEPTION 'El documento emitido no cumple la vigencia, moneda o rango de la configuración y serie.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fiscal_document_scope ON fiscal_documents;
CREATE TRIGGER trg_fiscal_document_scope
  BEFORE INSERT OR UPDATE ON fiscal_documents
  FOR EACH ROW EXECUTE FUNCTION validate_fiscal_document_scope();

CREATE OR REPLACE FUNCTION assert_issued_fiscal_document_totals()
RETURNS TRIGGER AS $$
DECLARE
  target_document_id TEXT;
  document_status TEXT;
  line_count BIGINT;
  lines_net NUMERIC(20, 6);
  lines_tax NUMERIC(20, 6);
BEGIN
  IF TG_TABLE_NAME = 'fiscal_documents' THEN
    target_document_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  ELSE
    target_document_id := CASE
      WHEN TG_OP = 'DELETE' THEN OLD.fiscal_document_id
      ELSE NEW.fiscal_document_id
    END;
  END IF;

  SELECT status INTO document_status
    FROM fiscal_documents WHERE id = target_document_id;
  IF document_status IS DISTINCT FROM 'issued' THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*), COALESCE(SUM(taxable_base), 0), COALESCE(SUM(tax_amount), 0)
    INTO line_count, lines_net, lines_tax
    FROM fiscal_document_lines
    WHERE fiscal_document_id = target_document_id;
  IF line_count = 0 OR lines_net <> (
      SELECT net_amount FROM fiscal_documents WHERE id = target_document_id
    ) OR lines_tax <> (
      SELECT tax_amount FROM fiscal_documents WHERE id = target_document_id
    ) THEN
    RAISE EXCEPTION 'El documento fiscal % no tiene líneas o sus totales no coinciden.',
      target_document_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fiscal_document_totals ON fiscal_documents;
CREATE CONSTRAINT TRIGGER trg_fiscal_document_totals
  AFTER INSERT OR UPDATE ON fiscal_documents
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_issued_fiscal_document_totals();

DROP TRIGGER IF EXISTS trg_fiscal_document_line_totals ON fiscal_document_lines;
CREATE CONSTRAINT TRIGGER trg_fiscal_document_line_totals
  AFTER INSERT OR UPDATE OR DELETE ON fiscal_document_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_issued_fiscal_document_totals();

CREATE OR REPLACE FUNCTION allocate_fiscal_number(target_series_id TEXT)
RETURNS BIGINT AS $$
DECLARE
  allocated_number BIGINT;
  series_active BOOLEAN;
  upper_bound BIGINT;
BEGIN
  SELECT active, number_until INTO series_active, upper_bound
    FROM fiscal_series
    WHERE id = target_series_id
    FOR UPDATE;
  IF NOT FOUND OR series_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'La serie fiscal no existe o está inactiva.';
  END IF;

  SELECT next_number INTO allocated_number
    FROM fiscal_sequences
    WHERE series_id = target_series_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La serie fiscal no tiene una secuencia inicializada.';
  END IF;
  IF upper_bound IS NOT NULL AND allocated_number > upper_bound THEN
    RAISE EXCEPTION 'La serie fiscal agotó su rango autorizado.';
  END IF;

  UPDATE fiscal_sequences
    SET next_number = allocated_number + 1, updated_at = CURRENT_TIMESTAMP
    WHERE series_id = target_series_id;
  RETURN allocated_number;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_fiscal_event_chain()
RETURNS TRIGGER AS $$
DECLARE
  previous_sequence_number BIGINT;
  previous_company_hash TEXT;
BEGIN
  PERFORM 1 FROM companies WHERE id = NEW.company_id FOR UPDATE;
  SELECT sequence_number, event_hash
    INTO previous_sequence_number, previous_company_hash
    FROM fiscal_events
    WHERE company_id = NEW.company_id
    ORDER BY sequence_number DESC
    LIMIT 1;
  IF NEW.sequence_number <> COALESCE(previous_sequence_number, 0) + 1 THEN
    RAISE EXCEPTION 'La secuencia de eventos fiscales debe avanzar exactamente en orden.';
  END IF;
  IF NEW.previous_hash IS DISTINCT FROM previous_company_hash THEN
    RAISE EXCEPTION 'El evento fiscal no continúa la cadena de auditoría de la empresa.';
  END IF;
  IF NULLIF(BTRIM(NEW.event_hash), '') IS NULL THEN
    RAISE EXCEPTION 'El evento fiscal requiere un hash calculado por el servicio.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fiscal_event_chain ON fiscal_events;
CREATE TRIGGER trg_fiscal_event_chain
  BEFORE INSERT ON fiscal_events
  FOR EACH ROW EXECUTE FUNCTION enforce_fiscal_event_chain();

INSERT INTO fiscal_compliance_requirements
  (id, jurisdiction_code, requirement_code, title, description)
VALUES
  ('ve-doc-integrity', 'VE', 'DOC-INTEGRITY', 'Integridad de documentos',
   'Definir controles y pruebas de integridad documental con base en fuente oficial verificada.'),
  ('ve-event-traceability', 'VE', 'EVENT-TRACEABILITY', 'Trazabilidad de eventos',
   'Definir eventos, retención, acceso y pruebas tras contrastar las obligaciones oficiales.'),
  ('ve-number-sequences', 'VE', 'NUMBER-SEQUENCES', 'Numeración documental',
   'Validar reglas oficiales de series, secuencias, anulaciones y contingencia antes de habilitar emisión.'),
  ('ve-access-control', 'VE', 'ACCESS-CONTROL', 'Control de acceso',
   'Definir y probar roles y permisos de acuerdo con los requisitos oficiales aplicables.'),
  ('ve-backup-restore', 'VE', 'BACKUP-RESTORE', 'Respaldo y restauración',
   'Definir evidencia de restauración y controles de protección a partir de requisitos verificados.')
ON CONFLICT (jurisdiction_code, requirement_code) DO NOTHING;

CREATE OR REPLACE FUNCTION enforce_fiscal_document_immutability()
RETURNS TRIGGER AS $$
DECLARE
  parent_status TEXT;
BEGIN
  IF TG_TABLE_NAME = 'fiscal_documents' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Los documentos fiscales no se eliminan; use anulación o reversión trazable.';
    END IF;
    IF OLD.status <> 'draft' THEN
      IF NEW.status = OLD.status AND NEW IS NOT DISTINCT FROM OLD THEN
        RETURN NEW;
      END IF;
      IF OLD.status = 'issued'
         AND NEW.status IN ('voided', 'reversed')
         AND (to_jsonb(NEW) - 'status' - 'void_reason' - 'reversed_by')
             IS NOT DISTINCT FROM
             (to_jsonb(OLD) - 'status' - 'void_reason' - 'reversed_by')
         AND (
           (NEW.status = 'voided'
            AND NEW.reversed_by IS NOT DISTINCT FROM OLD.reversed_by)
           OR
           (NEW.status = 'reversed'
            AND NEW.void_reason IS NOT DISTINCT FROM OLD.void_reason
            AND NEW.reversed_by IS NOT NULL)
         ) THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'Un documento fiscal emitido es inmutable salvo su anulación o reversión trazable.';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    SELECT status INTO parent_status FROM fiscal_documents WHERE id = OLD.fiscal_document_id;
  ELSE
    SELECT status INTO parent_status FROM fiscal_documents WHERE id = NEW.fiscal_document_id;
  END IF;
  IF parent_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Las líneas solo pueden cambiar mientras el documento fiscal sea borrador.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fiscal_document_immutability ON fiscal_documents;
CREATE TRIGGER trg_fiscal_document_immutability
  BEFORE UPDATE OR DELETE ON fiscal_documents
  FOR EACH ROW EXECUTE FUNCTION enforce_fiscal_document_immutability();

DROP TRIGGER IF EXISTS trg_fiscal_document_line_immutability ON fiscal_document_lines;
CREATE TRIGGER trg_fiscal_document_line_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON fiscal_document_lines
  FOR EACH ROW EXECUTE FUNCTION enforce_fiscal_document_immutability();

CREATE OR REPLACE FUNCTION prevent_fiscal_sequence_reuse()
RETURNS TRIGGER AS $$
DECLARE
  series_start BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Las secuencias fiscales no se eliminan.';
  END IF;
  SELECT number_from INTO series_start FROM fiscal_series WHERE id = NEW.series_id;
  IF NOT FOUND OR NEW.next_number < series_start THEN
    RAISE EXCEPTION 'La secuencia debe comenzar dentro del rango definido por la serie.';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW.series_id IS DISTINCT FROM OLD.series_id
    OR NEW.next_number <> OLD.next_number + 1
  ) THEN
    RAISE EXCEPTION 'La secuencia solo puede avanzar un número y no puede cambiar de serie.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fiscal_sequence_no_reuse ON fiscal_sequences;
CREATE TRIGGER trg_fiscal_sequence_no_reuse
  BEFORE INSERT OR UPDATE OR DELETE ON fiscal_sequences
  FOR EACH ROW EXECUTE FUNCTION prevent_fiscal_sequence_reuse();

CREATE OR REPLACE FUNCTION prevent_fiscal_record_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Los registros fiscales no se eliminan; use estados y eventos trazables.';
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'fiscal_configurations', 'fiscal_taxes', 'fiscal_tax_rates', 'fiscal_series',
    'fiscal_withholdings', 'igtf_operations', 'fiscal_books',
    'fiscal_compliance_requirements', 'fiscal_compliance_evidence'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_no_delete ON %I', target_table, target_table);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_no_delete BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION prevent_fiscal_record_delete()',
      target_table, target_table
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_fiscal_record_immutability()
RETURNS TRIGGER AS $$
DECLARE
  parent_configuration_status TEXT;
BEGIN
  IF NEW IS NOT DISTINCT FROM OLD THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'fiscal_configurations' THEN
    IF OLD.status = 'draft' AND NEW.status IN ('draft', 'active') THEN
      RETURN NEW;
    END IF;
    IF OLD.status = 'active' AND NEW.status = 'inactive'
       AND (to_jsonb(NEW) - 'status') IS NOT DISTINCT FROM (to_jsonb(OLD) - 'status') THEN
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'fiscal_taxes' THEN
    SELECT status INTO parent_configuration_status
      FROM fiscal_configurations WHERE id = OLD.configuration_id;
    IF parent_configuration_status = 'draft' THEN
      RETURN NEW;
    END IF;
    IF OLD.active AND NOT NEW.active
       AND (to_jsonb(NEW) - 'active') IS NOT DISTINCT FROM (to_jsonb(OLD) - 'active') THEN
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'fiscal_tax_rates' THEN
    SELECT configuration.status INTO parent_configuration_status
      FROM fiscal_taxes AS tax
      JOIN fiscal_configurations AS configuration
        ON configuration.id = tax.configuration_id
      WHERE tax.id = OLD.tax_id;
    IF parent_configuration_status = 'draft' THEN
      RETURN NEW;
    END IF;
    IF OLD.active AND NOT NEW.active
       AND (to_jsonb(NEW) - 'active') IS NOT DISTINCT FROM (to_jsonb(OLD) - 'active') THEN
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'fiscal_series' THEN
    IF OLD.active AND NOT NEW.active
       AND (to_jsonb(NEW) - 'active') IS NOT DISTINCT FROM (to_jsonb(OLD) - 'active') THEN
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'fiscal_withholdings' THEN
    IF OLD.status = 'draft' AND NEW.status IN ('draft', 'issued') THEN
      RETURN NEW;
    END IF;
    IF OLD.status = 'issued' AND NEW.status = 'voided'
       AND (to_jsonb(NEW) - 'status' - 'void_reason')
           IS NOT DISTINCT FROM (to_jsonb(OLD) - 'status' - 'void_reason')
       AND NULLIF(BTRIM(NEW.void_reason), '') IS NOT NULL THEN
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'igtf_operations' THEN
    IF OLD.status = 'recorded'
       AND NEW.status IN ('voided', 'reversed')
       AND (to_jsonb(NEW) - 'status' - 'correction_reason')
           IS NOT DISTINCT FROM (to_jsonb(OLD) - 'status' - 'correction_reason')
       AND NULLIF(BTRIM(NEW.correction_reason), '') IS NOT NULL THEN
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'fiscal_books' THEN
    IF OLD.status = 'draft' AND NEW.status IN ('draft', 'finalized') THEN
      RETURN NEW;
    END IF;
    IF OLD.status = 'finalized' AND NEW.status = 'superseded'
       AND (to_jsonb(NEW) - 'status') IS NOT DISTINCT FROM (to_jsonb(OLD) - 'status') THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'El registro fiscal % está protegido contra modificaciones fuera de su flujo de estado.',
    OLD.id;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'fiscal_configurations', 'fiscal_taxes', 'fiscal_tax_rates', 'fiscal_series',
    'fiscal_withholdings', 'igtf_operations', 'fiscal_books'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_immutability ON %I', target_table, target_table);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_immutability BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION enforce_fiscal_record_immutability()',
      target_table, target_table
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION prevent_fiscal_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Los eventos fiscales son append-only.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fiscal_event_append_only ON fiscal_events;
CREATE TRIGGER trg_fiscal_event_append_only
  BEFORE UPDATE OR DELETE ON fiscal_events
  FOR EACH ROW EXECUTE FUNCTION prevent_fiscal_event_mutation();
INSERT INTO schema_migrations (version) VALUES ('003') ON CONFLICT (version) DO NOTHING;
-- END 003_fiscal_foundation.sql


-- BEGIN 004_inventory_foundation.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_company_id_id
  ON branches (company_id, id);

CREATE TABLE IF NOT EXISTS inventory_categories (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_category_id TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, id),
  UNIQUE (company_id, code),
  FOREIGN KEY (company_id, parent_category_id)
    REFERENCES inventory_categories (company_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS inventory_units (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  precision SMALLINT NOT NULL DEFAULT 0 CHECK (precision BETWEEN 0 AND 6),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, id),
  UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS inventory_products (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  category_id TEXT,
  base_unit_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  barcode TEXT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  product_kind TEXT NOT NULL DEFAULT 'stock'
    CHECK (product_kind IN ('stock', 'service', 'non_stock')),
  tracks_lots BOOLEAN NOT NULL DEFAULT FALSE,
  tracks_serials BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, id),
  UNIQUE (company_id, sku),
  FOREIGN KEY (company_id, category_id)
    REFERENCES inventory_categories (company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, base_unit_id)
    REFERENCES inventory_units (company_id, id) ON DELETE RESTRICT,
  CHECK (product_kind = 'stock' OR (NOT tracks_lots AND NOT tracks_serials))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_products_company_barcode
  ON inventory_products (company_id, barcode)
  WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_products_company_name
  ON inventory_products (company_id, name);

CREATE TABLE IF NOT EXISTS inventory_warehouses (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  branch_id TEXT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  allow_negative_stock BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, id),
  UNIQUE (company_id, code),
  FOREIGN KEY (company_id, branch_id)
    REFERENCES branches (company_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS inventory_locations (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  warehouse_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, id),
  UNIQUE (company_id, warehouse_id, id),
  UNIQUE (company_id, warehouse_id, code),
  FOREIGN KEY (company_id, warehouse_id)
    REFERENCES inventory_warehouses (company_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS inventory_lots (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  product_id TEXT NOT NULL,
  lot_number TEXT NOT NULL,
  manufactured_on DATE,
  expires_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, id),
  UNIQUE (company_id, product_id, id),
  UNIQUE (company_id, product_id, lot_number),
  FOREIGN KEY (company_id, product_id)
    REFERENCES inventory_products (company_id, id) ON DELETE RESTRICT,
  CHECK (expires_on IS NULL OR manufactured_on IS NULL OR expires_on >= manufactured_on)
);
CREATE INDEX IF NOT EXISTS idx_inventory_lots_expiration
  ON inventory_lots (company_id, expires_on)
  WHERE expires_on IS NOT NULL;

CREATE TABLE IF NOT EXISTS inventory_serials (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  product_id TEXT NOT NULL,
  lot_id TEXT,
  serial_number TEXT NOT NULL,
  warehouse_id TEXT,
  location_id TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, id),
  UNIQUE (company_id, product_id, id),
  UNIQUE (company_id, product_id, serial_number),
  FOREIGN KEY (company_id, product_id)
    REFERENCES inventory_products (company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, product_id, lot_id)
    REFERENCES inventory_lots (company_id, product_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, warehouse_id)
    REFERENCES inventory_warehouses (company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, warehouse_id, location_id)
    REFERENCES inventory_locations (company_id, warehouse_id, id) ON DELETE RESTRICT,
  CHECK ((warehouse_id IS NULL) = (location_id IS NULL))
);

CREATE OR REPLACE FUNCTION protect_inventory_serial_position()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Los seriales de inventario se conservan; desactívelos si corresponde.';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.warehouse_id IS NOT NULL THEN
    RAISE EXCEPTION 'La ubicación de un serial se establece mediante un movimiento contabilizado.';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW.company_id <> OLD.company_id
    OR NEW.product_id <> OLD.product_id
    OR NEW.serial_number <> OLD.serial_number
    OR NEW.lot_id IS DISTINCT FROM OLD.lot_id
  ) THEN
    RAISE EXCEPTION 'No se puede cambiar la identidad de un serial.';
  END IF;
  IF TG_OP = 'UPDATE'
    AND (NEW.warehouse_id, NEW.location_id) IS DISTINCT FROM (OLD.warehouse_id, OLD.location_id)
    AND current_setting('app.inventory_posting', TRUE) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'La ubicación de un serial solo cambia al contabilizar un movimiento.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_inventory_serial_position ON inventory_serials;
CREATE TRIGGER trg_protect_inventory_serial_position
  BEFORE INSERT OR UPDATE OR DELETE ON inventory_serials
  FOR EACH ROW EXECUTE FUNCTION protect_inventory_serial_position();

CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  branch_id TEXT,
  movement_type TEXT NOT NULL
    CHECK (movement_type IN (
      'receipt', 'issue', 'transfer', 'adjustment', 'return_in', 'return_out'
    )),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'posted', 'voided')),
  movement_date DATE NOT NULL,
  source_module TEXT,
  source_document_id TEXT,
  reversal_of TEXT,
  description TEXT NOT NULL DEFAULT '',
  void_reason TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  posted_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, id),
  UNIQUE (company_id, reversal_of),
  FOREIGN KEY (company_id, reversal_of)
    REFERENCES inventory_movements (company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, branch_id)
    REFERENCES branches (company_id, id) ON DELETE RESTRICT,
  CHECK (
    (status <> 'voided') OR NULLIF(BTRIM(void_reason), '') IS NOT NULL
  ),
  CHECK (
    (status <> 'posted') OR posted_at IS NOT NULL
  )
);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_company_date
  ON inventory_movements (company_id, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_source
  ON inventory_movements (company_id, source_module, source_document_id)
  WHERE source_document_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS inventory_movement_lines (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  movement_id TEXT NOT NULL,
  line_number INTEGER NOT NULL CHECK (line_number > 0),
  product_id TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  quantity NUMERIC(20, 6) NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(20, 6) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  lot_id TEXT,
  serial_id TEXT,
  source_warehouse_id TEXT,
  source_location_id TEXT,
  destination_warehouse_id TEXT,
  destination_location_id TEXT,
  reversal_of_line_id TEXT,
  description TEXT NOT NULL DEFAULT '',
  UNIQUE (movement_id, line_number),
  UNIQUE (company_id, id),
  UNIQUE (company_id, reversal_of_line_id),
  FOREIGN KEY (company_id, movement_id)
    REFERENCES inventory_movements (company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, reversal_of_line_id)
    REFERENCES inventory_movement_lines (company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, product_id)
    REFERENCES inventory_products (company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, unit_id)
    REFERENCES inventory_units (company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, product_id, lot_id)
    REFERENCES inventory_lots (company_id, product_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, product_id, serial_id)
    REFERENCES inventory_serials (company_id, product_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, source_warehouse_id)
    REFERENCES inventory_warehouses (company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, source_warehouse_id, source_location_id)
    REFERENCES inventory_locations (company_id, warehouse_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, destination_warehouse_id)
    REFERENCES inventory_warehouses (company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, destination_warehouse_id, destination_location_id)
    REFERENCES inventory_locations (company_id, warehouse_id, id) ON DELETE RESTRICT,
  CHECK (source_warehouse_id IS NOT NULL OR destination_warehouse_id IS NOT NULL),
  CHECK (
    source_warehouse_id IS DISTINCT FROM destination_warehouse_id
    OR source_location_id IS DISTINCT FROM destination_location_id
  ),
  CHECK ((source_warehouse_id IS NULL) = (source_location_id IS NULL)),
  CHECK ((destination_warehouse_id IS NULL) = (destination_location_id IS NULL)),
  CHECK (serial_id IS NULL OR quantity = 1)
);
CREATE INDEX IF NOT EXISTS idx_inventory_movement_lines_product
  ON inventory_movement_lines (company_id, product_id, movement_id);

CREATE TABLE IF NOT EXISTS inventory_balances (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  warehouse_id TEXT NOT NULL,
  location_id TEXT,
  location_scope_id TEXT GENERATED ALWAYS AS (COALESCE(location_id, '')) STORED,
  product_id TEXT NOT NULL,
  lot_id TEXT,
  lot_scope_id TEXT GENERATED ALWAYS AS (COALESCE(lot_id, '')) STORED,
  quantity_on_hand NUMERIC(20, 6) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, warehouse_id, location_scope_id, product_id, lot_scope_id),
  FOREIGN KEY (company_id, warehouse_id)
    REFERENCES inventory_warehouses (company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, warehouse_id, location_id)
    REFERENCES inventory_locations (company_id, warehouse_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, product_id)
    REFERENCES inventory_products (company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, product_id, lot_id)
    REFERENCES inventory_lots (company_id, product_id, id) ON DELETE RESTRICT,
  CHECK (lot_id IS NULL OR lot_id <> '')
);
CREATE INDEX IF NOT EXISTS idx_inventory_balances_product
  ON inventory_balances (company_id, product_id, warehouse_id, location_scope_id);

CREATE TABLE IF NOT EXISTS inventory_counts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  warehouse_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'counting', 'completed', 'voided')),
  count_date DATE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, id),
  UNIQUE (company_id, warehouse_id, id),
  FOREIGN KEY (company_id, warehouse_id)
    REFERENCES inventory_warehouses (company_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS inventory_count_lines (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  count_id TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  location_id TEXT,
  lot_id TEXT,
  expected_quantity NUMERIC(20, 6) NOT NULL CHECK (expected_quantity >= 0),
  counted_quantity NUMERIC(20, 6) CHECK (counted_quantity IS NULL OR counted_quantity >= 0),
  counted_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  counted_at TIMESTAMPTZ,
  FOREIGN KEY (company_id, count_id)
    REFERENCES inventory_counts (company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, warehouse_id, count_id)
    REFERENCES inventory_counts (company_id, warehouse_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, warehouse_id, location_id)
    REFERENCES inventory_locations (company_id, warehouse_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, product_id)
    REFERENCES inventory_products (company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, product_id, lot_id)
    REFERENCES inventory_lots (company_id, product_id, id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_inventory_count_lines_count
  ON inventory_count_lines (count_id, product_id);

CREATE OR REPLACE FUNCTION protect_inventory_movement()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' THEN
      RAISE EXCEPTION 'Los movimientos deben crearse como borrador y contabilizarse con sus líneas.';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Los movimientos de inventario se conservan; use anulación o un movimiento correctivo.';
  END IF;
  IF OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'Los movimientos contabilizados o anulados son inmutables.';
  END IF;
  IF NEW.company_id <> OLD.company_id OR NEW.id <> OLD.id THEN
    RAISE EXCEPTION 'No se puede cambiar la identidad empresarial del movimiento.';
  END IF;
  IF NEW.status NOT IN ('draft', 'posted', 'voided')
    OR (NEW.status <> OLD.status AND NEW.status NOT IN ('posted', 'voided')) THEN
    RAISE EXCEPTION 'Transición de estado de inventario no permitida.';
  END IF;
  IF NEW.status = 'posted' THEN
    NEW.posted_at := COALESCE(NEW.posted_at, CURRENT_TIMESTAMP);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_inventory_movement ON inventory_movements;
CREATE TRIGGER trg_protect_inventory_movement
  BEFORE INSERT OR UPDATE OR DELETE ON inventory_movements
  FOR EACH ROW EXECUTE FUNCTION protect_inventory_movement();

CREATE OR REPLACE FUNCTION protect_inventory_movement_line()
RETURNS TRIGGER AS $$
DECLARE
  movement_status TEXT;
  target_company_id TEXT;
  target_movement_id TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_company_id := OLD.company_id;
    target_movement_id := OLD.movement_id;
  ELSE
    target_company_id := NEW.company_id;
    target_movement_id := NEW.movement_id;
  END IF;
  SELECT status INTO movement_status
    FROM inventory_movements
    WHERE company_id = target_company_id
      AND id = target_movement_id
    FOR UPDATE;
  IF movement_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Las líneas de movimientos contabilizados o anulados son inmutables.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_inventory_movement_line ON inventory_movement_lines;
CREATE TRIGGER trg_protect_inventory_movement_line
  BEFORE INSERT OR UPDATE OR DELETE ON inventory_movement_lines
  FOR EACH ROW EXECUTE FUNCTION protect_inventory_movement_line();

CREATE OR REPLACE FUNCTION apply_inventory_movement()
RETURNS TRIGGER AS $$
DECLARE
  movement_line RECORD;
  source_balance_id TEXT;
  source_quantity NUMERIC(20, 6);
  source_allows_negative BOOLEAN;
  serial_warehouse_id TEXT;
  serial_location_id TEXT;
  serial_lot_id TEXT;
  line_count INTEGER;
  previous_posting_setting TEXT;
  original_movement RECORD;
  original_line_count INTEGER;
BEGIN
  IF OLD.status = NEW.status OR NEW.status <> 'posted' THEN
    RETURN NULL;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(NEW.company_id));
  SELECT COUNT(*) INTO line_count
    FROM inventory_movement_lines
    WHERE company_id = NEW.company_id AND movement_id = NEW.id;
  IF line_count = 0 THEN
    RAISE EXCEPTION 'No se puede contabilizar un movimiento de inventario sin líneas.';
  END IF;

  IF NEW.reversal_of IS NOT NULL THEN
    SELECT movement_type, status INTO original_movement
      FROM inventory_movements
      WHERE company_id = NEW.company_id AND id = NEW.reversal_of
      FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Solo se puede revertir un movimiento contabilizado de la misma empresa.';
    END IF;
    IF original_movement.status <> 'posted' THEN
      RAISE EXCEPTION 'Solo se puede revertir un movimiento contabilizado de la misma empresa.';
    END IF;
    IF NEW.movement_type <> (
      CASE original_movement.movement_type
      WHEN 'receipt' THEN 'issue'
      WHEN 'issue' THEN 'receipt'
      WHEN 'return_in' THEN 'return_out'
      WHEN 'return_out' THEN 'return_in'
      ELSE original_movement.movement_type
      END
    ) THEN
      RAISE EXCEPTION 'El tipo del movimiento inverso no corresponde al movimiento original.';
    END IF;
    SELECT COUNT(*) INTO original_line_count
      FROM inventory_movement_lines
      WHERE company_id = NEW.company_id AND movement_id = NEW.reversal_of;
    IF line_count <> original_line_count OR EXISTS (
      SELECT 1
        FROM inventory_movement_lines AS reversed
        LEFT JOIN inventory_movement_lines AS original
          ON original.company_id = reversed.company_id
          AND original.id = reversed.reversal_of_line_id
        WHERE reversed.company_id = NEW.company_id
          AND reversed.movement_id = NEW.id
          AND (
            original.id IS NULL
            OR original.movement_id <> NEW.reversal_of
            OR ROW(
              reversed.product_id, reversed.unit_id, reversed.quantity,
              reversed.unit_cost, reversed.lot_id, reversed.serial_id,
              reversed.source_warehouse_id, reversed.source_location_id,
              reversed.destination_warehouse_id, reversed.destination_location_id
            ) IS DISTINCT FROM ROW(
              original.product_id, original.unit_id, original.quantity,
              original.unit_cost, original.lot_id, original.serial_id,
              original.destination_warehouse_id, original.destination_location_id,
              original.source_warehouse_id, original.source_location_id
            )
          )
    ) THEN
      RAISE EXCEPTION 'Las líneas del movimiento inverso deben espejar exactamente las líneas originales.';
    END IF;
  ELSIF EXISTS (
    SELECT 1 FROM inventory_movement_lines
    WHERE company_id = NEW.company_id
      AND movement_id = NEW.id
      AND reversal_of_line_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Una línea inversa requiere que el movimiento indique reversal_of.';
  END IF;

  previous_posting_setting := current_setting('app.inventory_posting', TRUE);
  PERFORM set_config('app.inventory_posting', 'on', TRUE);

  FOR movement_line IN
    SELECT ml.*, p.tracks_lots, p.tracks_serials, p.active AS product_active,
           p.product_kind, p.base_unit_id, u.precision AS unit_precision, u.active AS unit_active
      FROM inventory_movement_lines AS ml
      JOIN inventory_products AS p
        ON p.company_id = ml.company_id AND p.id = ml.product_id
      JOIN inventory_units AS u
        ON u.company_id = ml.company_id AND u.id = ml.unit_id
      WHERE ml.company_id = NEW.company_id AND ml.movement_id = NEW.id
      ORDER BY ml.product_id, ml.source_warehouse_id, ml.destination_warehouse_id, ml.id
  LOOP
    IF NOT movement_line.product_active THEN
      RAISE EXCEPTION 'El producto % está inactivo.', movement_line.product_id;
    END IF;
    IF movement_line.product_kind <> 'stock' THEN
      RAISE EXCEPTION 'El producto % no controla existencias.', movement_line.product_id;
    END IF;
    IF NOT movement_line.unit_active
      OR movement_line.unit_id <> movement_line.base_unit_id THEN
      RAISE EXCEPTION 'La línea debe usar la unidad base activa del producto %.',
        movement_line.product_id;
    END IF;
    IF movement_line.quantity <> ROUND(movement_line.quantity, movement_line.unit_precision) THEN
      RAISE EXCEPTION 'La cantidad excede la precisión configurada para la unidad.';
    END IF;
    IF movement_line.tracks_lots AND movement_line.lot_id IS NULL THEN
      RAISE EXCEPTION 'El producto % requiere un lote.', movement_line.product_id;
    END IF;
    IF movement_line.tracks_serials AND movement_line.serial_id IS NULL THEN
      RAISE EXCEPTION 'El producto % requiere un serial.', movement_line.product_id;
    END IF;
    IF NOT movement_line.tracks_serials AND movement_line.serial_id IS NOT NULL THEN
      RAISE EXCEPTION 'El producto % no está configurado para seguimiento serial.', movement_line.product_id;
    END IF;

    IF NEW.movement_type = 'transfer'
      AND (movement_line.source_warehouse_id IS NULL
        OR movement_line.destination_warehouse_id IS NULL) THEN
      RAISE EXCEPTION 'Una transferencia requiere almacén de origen y destino.';
    ELSIF NEW.movement_type IN ('receipt', 'return_in')
      AND (movement_line.source_warehouse_id IS NOT NULL
        OR movement_line.destination_warehouse_id IS NULL) THEN
      RAISE EXCEPTION 'Una entrada requiere únicamente almacén de destino.';
    ELSIF NEW.movement_type IN ('issue', 'return_out')
      AND (movement_line.source_warehouse_id IS NULL
        OR movement_line.destination_warehouse_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Una salida requiere únicamente almacén de origen.';
    ELSIF NEW.movement_type = 'adjustment'
      AND ((movement_line.source_warehouse_id IS NULL)
        = (movement_line.destination_warehouse_id IS NULL)) THEN
      RAISE EXCEPTION 'Un ajuste debe representar una entrada o una salida, no ambas.';
    END IF;
    IF EXISTS (
      SELECT 1
        FROM inventory_warehouses
        WHERE company_id = NEW.company_id
          AND id IN (
            movement_line.source_warehouse_id,
            movement_line.destination_warehouse_id
          )
          AND active = FALSE
    ) THEN
      RAISE EXCEPTION 'No se pueden contabilizar movimientos en almacenes inactivos.';
    END IF;

    IF movement_line.source_warehouse_id IS NOT NULL THEN
      SELECT id, quantity_on_hand INTO source_balance_id, source_quantity
        FROM inventory_balances
        WHERE company_id = NEW.company_id
          AND warehouse_id = movement_line.source_warehouse_id
          AND product_id = movement_line.product_id
          AND location_scope_id = COALESCE(movement_line.source_location_id, '')
          AND lot_scope_id = COALESCE(movement_line.lot_id, '')
        FOR UPDATE;
      SELECT allow_negative_stock INTO source_allows_negative
        FROM inventory_warehouses
        WHERE company_id = NEW.company_id AND id = movement_line.source_warehouse_id;
      IF source_balance_id IS NULL THEN
        source_quantity := 0;
      END IF;
      IF NOT source_allows_negative
        AND source_quantity < movement_line.quantity THEN
        RAISE EXCEPTION 'Existencia insuficiente para el producto %: disponible %, requerido %.',
          movement_line.product_id, source_quantity, movement_line.quantity;
      END IF;
      IF source_balance_id IS NULL THEN
        INSERT INTO inventory_balances (
          id, company_id, warehouse_id, location_id, product_id, lot_id, quantity_on_hand
        ) VALUES (
          gen_random_uuid()::TEXT, NEW.company_id, movement_line.source_warehouse_id,
          movement_line.source_location_id, movement_line.product_id, movement_line.lot_id,
          -movement_line.quantity
        );
      ELSE
        UPDATE inventory_balances
          SET quantity_on_hand = quantity_on_hand - movement_line.quantity,
              updated_at = CURRENT_TIMESTAMP,
              location_id = movement_line.source_location_id
          WHERE id = source_balance_id;
      END IF;
    END IF;

    IF movement_line.destination_warehouse_id IS NOT NULL THEN
      INSERT INTO inventory_balances (
        id, company_id, warehouse_id, location_id, product_id, lot_id, quantity_on_hand
      ) VALUES (
        gen_random_uuid()::TEXT, NEW.company_id, movement_line.destination_warehouse_id,
        movement_line.destination_location_id, movement_line.product_id, movement_line.lot_id,
        movement_line.quantity
      )
      ON CONFLICT (company_id, warehouse_id, location_scope_id, product_id, lot_scope_id)
      DO UPDATE SET
        quantity_on_hand = inventory_balances.quantity_on_hand + EXCLUDED.quantity_on_hand,
        location_id = EXCLUDED.location_id,
        updated_at = CURRENT_TIMESTAMP;
    END IF;

    IF movement_line.serial_id IS NOT NULL THEN
      SELECT warehouse_id, location_id, lot_id
        INTO serial_warehouse_id, serial_location_id, serial_lot_id
        FROM inventory_serials
        WHERE company_id = NEW.company_id
          AND product_id = movement_line.product_id
          AND id = movement_line.serial_id
          AND active
        FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'El serial % no existe o está inactivo.', movement_line.serial_id;
      END IF;
      IF serial_lot_id IS DISTINCT FROM movement_line.lot_id THEN
        RAISE EXCEPTION 'El serial % no pertenece al lote indicado.', movement_line.serial_id;
      END IF;
      IF movement_line.source_warehouse_id IS NOT NULL
        AND (serial_warehouse_id IS DISTINCT FROM movement_line.source_warehouse_id
          OR serial_location_id IS DISTINCT FROM movement_line.source_location_id) THEN
        RAISE EXCEPTION 'El serial % no está en la ubicación de origen indicada.',
          movement_line.serial_id;
      END IF;
      IF movement_line.source_warehouse_id IS NULL AND serial_warehouse_id IS NOT NULL THEN
        RAISE EXCEPTION 'El serial % ya se encuentra en inventario.', movement_line.serial_id;
      END IF;
      UPDATE inventory_serials
        SET warehouse_id = movement_line.destination_warehouse_id,
            location_id = movement_line.destination_location_id
        WHERE company_id = NEW.company_id AND id = movement_line.serial_id;
    END IF;
  END LOOP;
  PERFORM set_config(
    'app.inventory_posting',
    COALESCE(previous_posting_setting, ''),
    TRUE
  );
  INSERT INTO audit_events (
    id, company_id, user_id, username, module, action, entity_type, entity_id, details
  )
  SELECT gen_random_uuid()::TEXT, NEW.company_id, NEW.posted_by,
         COALESCE(NULLIF(u.username, ''), NULLIF(u.nombre, ''), NEW.posted_by, 'sistema'),
         'inventario', 'CONTABILIZAR_MOVIMIENTO', 'inventory_movement', NEW.id,
         jsonb_build_object(
           'movement_type', NEW.movement_type,
           'movement_date', NEW.movement_date,
           'reversal_of', NEW.reversal_of
         )
    FROM (SELECT 1) AS singleton
    LEFT JOIN users AS u ON u.id = NEW.posted_by;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_apply_inventory_movement ON inventory_movements;
CREATE TRIGGER trg_apply_inventory_movement
  AFTER UPDATE OF status ON inventory_movements
  FOR EACH ROW EXECUTE FUNCTION apply_inventory_movement();

CREATE OR REPLACE FUNCTION audit_inventory_void()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'draft' AND NEW.status = 'voided' THEN
    INSERT INTO audit_events (
      id, company_id, user_id, username, module, action, entity_type, entity_id, details
    )
    SELECT gen_random_uuid()::TEXT, NEW.company_id, NEW.created_by,
           COALESCE(NULLIF(u.username, ''), NULLIF(u.nombre, ''), NEW.created_by, 'sistema'),
           'inventario', 'ANULAR_MOVIMIENTO', 'inventory_movement', NEW.id,
           jsonb_build_object('reason', NEW.void_reason, 'movement_type', NEW.movement_type)
      FROM (SELECT 1) AS singleton
      LEFT JOIN users AS u ON u.id = NEW.created_by;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_inventory_void ON inventory_movements;
CREATE TRIGGER trg_audit_inventory_void
  AFTER UPDATE OF status ON inventory_movements
  FOR EACH ROW EXECUTE FUNCTION audit_inventory_void();

CREATE OR REPLACE FUNCTION protect_inventory_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.inventory_posting', TRUE) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Las existencias solo se modifican al contabilizar un movimiento.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Las existencias se modifican mediante movimientos, no se eliminan directamente.';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW.company_id <> OLD.company_id
    OR NEW.warehouse_id <> OLD.warehouse_id
    OR NEW.product_id <> OLD.product_id
    OR NEW.lot_id IS DISTINCT FROM OLD.lot_id
  ) THEN
    RAISE EXCEPTION 'No se puede cambiar la identidad de una existencia.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_inventory_balance ON inventory_balances;
CREATE TRIGGER trg_protect_inventory_balance
  BEFORE INSERT OR UPDATE OR DELETE ON inventory_balances
  FOR EACH ROW EXECUTE FUNCTION protect_inventory_balance();

CREATE OR REPLACE FUNCTION protect_inventory_count()
RETURNS TRIGGER AS $$
DECLARE
  parent_status TEXT;
  target_company_id TEXT;
  target_count_id TEXT;
  total_lines INTEGER;
  uncounted_lines INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'inventory_counts' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.status <> 'draft' THEN
        RAISE EXCEPTION 'Los conteos deben iniciarse como borrador.';
      END IF;
      RETURN NEW;
    END IF;
    IF TG_OP = 'DELETE' OR OLD.status IN ('completed', 'voided') THEN
      RAISE EXCEPTION 'Los conteos completados o anulados se conservan y son inmutables.';
    END IF;
    IF NEW.status <> OLD.status AND NOT (
      (OLD.status = 'draft' AND NEW.status IN ('counting', 'voided'))
      OR (OLD.status = 'counting' AND NEW.status IN ('completed', 'voided'))
    ) THEN
      RAISE EXCEPTION 'Transición de estado de conteo no permitida.';
    END IF;
    IF NEW.status = 'completed' THEN
      SELECT COUNT(*), COUNT(*) FILTER (WHERE counted_quantity IS NULL)
        INTO total_lines, uncounted_lines
        FROM inventory_count_lines
        WHERE company_id = NEW.company_id
          AND count_id = NEW.id;
      IF total_lines = 0 OR uncounted_lines > 0 THEN
        RAISE EXCEPTION 'El conteo debe tener líneas y todas deben estar contadas.';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    target_company_id := OLD.company_id;
    target_count_id := OLD.count_id;
  ELSE
    target_company_id := NEW.company_id;
    target_count_id := NEW.count_id;
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW.company_id <> OLD.company_id OR NEW.count_id <> OLD.count_id
  ) THEN
    RAISE EXCEPTION 'No se puede reasignar una línea de conteo a otra empresa o conteo.';
  END IF;
  SELECT status INTO parent_status
    FROM inventory_counts
    WHERE company_id = target_company_id
      AND id = target_count_id
    FOR UPDATE;
  IF parent_status IN ('completed', 'voided') OR parent_status IS NULL THEN
    RAISE EXCEPTION 'No se pueden modificar líneas de conteos completados o inexistentes.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_inventory_count ON inventory_counts;
CREATE TRIGGER trg_protect_inventory_count
  BEFORE UPDATE OR DELETE ON inventory_counts
  FOR EACH ROW EXECUTE FUNCTION protect_inventory_count();

DROP TRIGGER IF EXISTS trg_protect_inventory_count_line ON inventory_count_lines;
CREATE TRIGGER trg_protect_inventory_count_line
  BEFORE INSERT OR UPDATE OR DELETE ON inventory_count_lines
  FOR EACH ROW EXECUTE FUNCTION protect_inventory_count();
INSERT INTO schema_migrations (version) VALUES ('004') ON CONFLICT (version) DO NOTHING;
-- END 004_inventory_foundation.sql


-- BEGIN 005_business_parties.sql
CREATE TABLE IF NOT EXISTS business_parties (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  party_kind TEXT NOT NULL CHECK (party_kind IN ('person', 'organization')),
  tax_identifier TEXT,
  legal_name TEXT NOT NULL,
  trade_name TEXT,
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_parties_company_tax_id
  ON business_parties (company_id, upper(trim(tax_identifier)))
  WHERE tax_identifier IS NOT NULL AND trim(tax_identifier) <> '';
CREATE INDEX IF NOT EXISTS idx_business_parties_company_name
  ON business_parties (company_id, legal_name);

CREATE TABLE IF NOT EXISTS business_party_roles (
  company_id TEXT NOT NULL,
  party_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer', 'supplier')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (company_id, party_id, role),
  FOREIGN KEY (company_id, party_id)
    REFERENCES business_parties (company_id, id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_business_party_roles_company_role
  ON business_party_roles (company_id, role, active, party_id);

CREATE TABLE IF NOT EXISTS business_party_addresses (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  party_id TEXT NOT NULL,
  address_kind TEXT NOT NULL DEFAULT 'other'
    CHECK (address_kind IN ('fiscal', 'billing', 'shipping', 'other')),
  label TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  country_code CHAR(2) NOT NULL DEFAULT 'VE',
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, party_id)
    REFERENCES business_parties (company_id, id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_party_primary_address
  ON business_party_addresses (company_id, party_id, address_kind)
  WHERE is_primary AND active;
CREATE INDEX IF NOT EXISTS idx_business_party_addresses_party
  ON business_party_addresses (company_id, party_id, active);

CREATE TABLE IF NOT EXISTS business_party_contacts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  party_id TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  job_title TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, party_id)
    REFERENCES business_parties (company_id, id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_party_primary_contact
  ON business_party_contacts (company_id, party_id)
  WHERE is_primary AND active;
CREATE INDEX IF NOT EXISTS idx_business_party_contacts_party
  ON business_party_contacts (company_id, party_id, active);

CREATE OR REPLACE FUNCTION prevent_business_party_hard_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Los registros de clientes y proveedores se conservan; desactívelos en lugar de eliminarlos.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_business_parties_no_delete ON business_parties;
CREATE TRIGGER trg_business_parties_no_delete
  BEFORE DELETE ON business_parties
  FOR EACH ROW EXECUTE FUNCTION prevent_business_party_hard_delete();

DROP TRIGGER IF EXISTS trg_business_party_roles_no_delete ON business_party_roles;
CREATE TRIGGER trg_business_party_roles_no_delete
  BEFORE DELETE ON business_party_roles
  FOR EACH ROW EXECUTE FUNCTION prevent_business_party_hard_delete();

DROP TRIGGER IF EXISTS trg_business_party_addresses_no_delete ON business_party_addresses;
CREATE TRIGGER trg_business_party_addresses_no_delete
  BEFORE DELETE ON business_party_addresses
  FOR EACH ROW EXECUTE FUNCTION prevent_business_party_hard_delete();

DROP TRIGGER IF EXISTS trg_business_party_contacts_no_delete ON business_party_contacts;
CREATE TRIGGER trg_business_party_contacts_no_delete
  BEFORE DELETE ON business_party_contacts
  FOR EACH ROW EXECUTE FUNCTION prevent_business_party_hard_delete();
INSERT INTO schema_migrations (version) VALUES ('005') ON CONFLICT (version) DO NOTHING;
-- END 005_business_parties.sql


-- BEGIN 006_commercial_documents_and_settlements.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_periods_company_id
  ON accounting_periods (company_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_accounts_company_id
  ON accounting_accounts (company_id, id);

CREATE TABLE IF NOT EXISTS commercial_documents (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  branch_id TEXT,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'purchase_request', 'supplier_quote', 'purchase_order', 'goods_receipt',
    'supplier_invoice', 'supplier_credit_note', 'supplier_debit_note',
    'sales_quote', 'sales_order', 'delivery_note',
    'customer_invoice', 'customer_credit_note', 'customer_debit_note'
  )),
  party_role TEXT CHECK (party_role IN ('customer', 'supplier')),
  party_id TEXT,
  document_number BIGINT CHECK (document_number IS NULL OR document_number > 0),
  external_reference TEXT,
  document_date DATE NOT NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'approved', 'partially_fulfilled', 'fulfilled',
    'issued', 'partially_paid', 'paid', 'voided'
  )),
  currency_code CHAR(3) NOT NULL DEFAULT 'VES',
  minor_unit_digits SMALLINT NOT NULL DEFAULT 2
    CHECK (minor_unit_digits BETWEEN 0 AND 4),
  exchange_rate NUMERIC(20, 8) CHECK (exchange_rate IS NULL OR exchange_rate > 0),
  party_name_snapshot TEXT NOT NULL DEFAULT '',
  party_tax_id_snapshot TEXT,
  description TEXT NOT NULL DEFAULT '',
  payment_terms TEXT NOT NULL DEFAULT '',
  net_amount NUMERIC(20, 6) NOT NULL DEFAULT 0 CHECK (net_amount >= 0),
  tax_amount NUMERIC(20, 6) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  gross_amount NUMERIC(20, 6) NOT NULL DEFAULT 0 CHECK (gross_amount >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(metadata) = 'object'),
  created_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  approved_at TIMESTAMPTZ,
  issued_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  issued_at TIMESTAMPTZ,
  void_reason TEXT,
  branch_scope_id TEXT GENERATED ALWAYS AS (COALESCE(branch_id, '')) STORED,
  UNIQUE (company_id, id),
  UNIQUE (company_id, branch_scope_id, document_type, document_number),
  FOREIGN KEY (company_id, branch_id)
    REFERENCES branches (company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, party_id, party_role)
    REFERENCES business_party_roles (company_id, party_id, role) ON DELETE RESTRICT,
  CHECK (due_date IS NULL OR due_date >= document_date),
  CHECK (gross_amount = net_amount + tax_amount),
  CHECK (status <> 'voided' OR NULLIF(BTRIM(void_reason), '') IS NOT NULL),
  CHECK (
    (document_type = 'purchase_request' AND party_id IS NULL AND party_role IS NULL)
    OR
    (document_type IN (
      'purchase_request', 'supplier_quote', 'purchase_order', 'goods_receipt',
      'supplier_invoice', 'supplier_credit_note', 'supplier_debit_note'
    ) AND party_id IS NOT NULL AND party_role = 'supplier')
    OR
    (document_type IN (
      'sales_quote', 'sales_order', 'delivery_note',
      'customer_invoice', 'customer_credit_note', 'customer_debit_note'
    ) AND party_id IS NOT NULL AND party_role = 'customer')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_commercial_supplier_external_invoice
  ON commercial_documents (company_id, party_id, external_reference)
  WHERE document_type = 'supplier_invoice'
    AND external_reference IS NOT NULL
    AND BTRIM(external_reference) <> '';
CREATE INDEX IF NOT EXISTS idx_commercial_documents_company_type_date
  ON commercial_documents (company_id, document_type, document_date DESC);
CREATE INDEX IF NOT EXISTS idx_commercial_documents_party_date
  ON commercial_documents (company_id, party_id, document_date DESC);
CREATE INDEX IF NOT EXISTS idx_commercial_documents_status
  ON commercial_documents (company_id, status, document_date DESC);

CREATE TABLE IF NOT EXISTS commercial_document_lines (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  line_number INTEGER NOT NULL CHECK (line_number > 0),
  product_id TEXT,
  unit_id TEXT,
  item_code_snapshot TEXT,
  description TEXT NOT NULL,
  quantity NUMERIC(20, 6) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(20, 6) NOT NULL CHECK (unit_price >= 0),
  discount_amount NUMERIC(20, 6) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  net_amount NUMERIC(20, 6) NOT NULL CHECK (net_amount >= 0),
  tax_amount NUMERIC(20, 6) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  gross_amount NUMERIC(20, 6) NOT NULL CHECK (gross_amount >= 0),
  tax_snapshot JSONB NOT NULL DEFAULT '[]'::JSONB
    CHECK (jsonb_typeof(tax_snapshot) = 'array'),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB
    CHECK (jsonb_typeof(metadata) = 'object'),
  UNIQUE (company_id, id),
  UNIQUE (document_id, line_number),
  FOREIGN KEY (company_id, document_id)
    REFERENCES commercial_documents (company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, product_id)
    REFERENCES inventory_products (company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, unit_id)
    REFERENCES inventory_units (company_id, id) ON DELETE RESTRICT,
  CHECK ((product_id IS NULL) = (unit_id IS NULL)),
  CHECK (net_amount + discount_amount = quantity * unit_price),
  CHECK (gross_amount = net_amount + tax_amount)
);
CREATE INDEX IF NOT EXISTS idx_commercial_document_lines_document
  ON commercial_document_lines (company_id, document_id, line_number);
CREATE INDEX IF NOT EXISTS idx_commercial_document_lines_product
  ON commercial_document_lines (company_id, product_id, document_id)
  WHERE product_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS commercial_document_links (
  company_id TEXT NOT NULL,
  source_document_id TEXT NOT NULL,
  target_document_id TEXT NOT NULL,
  link_kind TEXT NOT NULL CHECK (link_kind IN (
    'fulfills', 'references', 'corrects', 'returns'
  )),
  created_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (company_id, source_document_id, target_document_id, link_kind),
  FOREIGN KEY (company_id, source_document_id)
    REFERENCES commercial_documents (company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, target_document_id)
    REFERENCES commercial_documents (company_id, id) ON DELETE RESTRICT,
  CHECK (source_document_id <> target_document_id)
);
CREATE INDEX IF NOT EXISTS idx_commercial_document_links_target
  ON commercial_document_links (company_id, target_document_id, link_kind);

CREATE TABLE IF NOT EXISTS commercial_document_events (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  sequence_number INTEGER NOT NULL CHECK (sequence_number > 0),
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  details JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(details) = 'object'),
  UNIQUE (company_id, document_id, sequence_number),
  FOREIGN KEY (company_id, document_id)
    REFERENCES commercial_documents (company_id, id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_commercial_document_events_history
  ON commercial_document_events (company_id, document_id, sequence_number);

CREATE TABLE IF NOT EXISTS commercial_open_items (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  party_role TEXT NOT NULL CHECK (party_role IN ('customer', 'supplier')),
  party_id TEXT NOT NULL,
  source_document_id TEXT NOT NULL,
  currency_code CHAR(3) NOT NULL,
  original_amount NUMERIC(20, 6) NOT NULL CHECK (original_amount > 0),
  outstanding_amount NUMERIC(20, 6) NOT NULL CHECK (
    outstanding_amount >= 0 AND outstanding_amount <= original_amount
  ),
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'partially_settled', 'settled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, id),
  UNIQUE (company_id, source_document_id),
  FOREIGN KEY (company_id, party_id, party_role)
    REFERENCES business_party_roles (company_id, party_id, role) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, source_document_id)
    REFERENCES commercial_documents (company_id, id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_commercial_open_items_due
  ON commercial_open_items (company_id, party_role, status, due_date);
CREATE INDEX IF NOT EXISTS idx_commercial_open_items_party
  ON commercial_open_items (company_id, party_id, status);

CREATE TABLE IF NOT EXISTS commercial_settlements (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  branch_id TEXT,
  settlement_type TEXT NOT NULL CHECK (settlement_type IN ('receivable', 'payable')),
  party_id TEXT NOT NULL,
  settlement_date DATE NOT NULL,
  currency_code CHAR(3) NOT NULL,
  amount NUMERIC(20, 6) NOT NULL CHECK (amount > 0),
  exchange_rate NUMERIC(20, 8) NOT NULL DEFAULT 1 CHECK (exchange_rate > 0),
  payment_method TEXT NOT NULL,
  reference TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'voided')),
  created_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  posted_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  posted_at TIMESTAMPTZ,
  void_reason TEXT,
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, branch_id)
    REFERENCES branches (company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, party_id)
    REFERENCES business_parties (company_id, id) ON DELETE RESTRICT,
  CHECK ((status = 'posted') = (posted_at IS NOT NULL)),
  CHECK (status <> 'voided' OR NULLIF(BTRIM(void_reason), '') IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_commercial_settlements_company_date
  ON commercial_settlements (company_id, settlement_date DESC);
CREATE INDEX IF NOT EXISTS idx_commercial_settlements_party_date
  ON commercial_settlements (company_id, party_id, settlement_date DESC);

CREATE TABLE IF NOT EXISTS commercial_settlement_allocations (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  settlement_id TEXT NOT NULL,
  open_item_id TEXT NOT NULL,
  amount NUMERIC(20, 6) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, id),
  UNIQUE (settlement_id, open_item_id),
  FOREIGN KEY (company_id, settlement_id)
    REFERENCES commercial_settlements (company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, open_item_id)
    REFERENCES commercial_open_items (company_id, id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_commercial_allocations_open_item
  ON commercial_settlement_allocations (company_id, open_item_id, settlement_id);

CREATE TABLE IF NOT EXISTS commercial_settlement_events (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  settlement_id TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  details JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(details) = 'object'),
  FOREIGN KEY (company_id, settlement_id)
    REFERENCES commercial_settlements (company_id, id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_commercial_settlement_events_history
  ON commercial_settlement_events (company_id, settlement_id, occurred_at);

CREATE OR REPLACE FUNCTION prevent_commercial_record_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Los documentos comerciales y sus eventos se conservan; use los flujos de anulación o reversión.';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION protect_commercial_document()
RETURNS TRIGGER AS $$
DECLARE
  line_count INTEGER;
  line_net NUMERIC(20, 6);
  line_tax NUMERIC(20, 6);
  line_gross NUMERIC(20, 6);
  allowed_transition BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' THEN
      RAISE EXCEPTION 'Los documentos comerciales deben crearse como borrador.';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Los documentos comerciales se conservan; no se eliminan.';
  END IF;

  IF (NEW.id, NEW.company_id, NEW.document_type, NEW.party_role, NEW.party_id)
      IS DISTINCT FROM
     (OLD.id, OLD.company_id, OLD.document_type, OLD.party_role, OLD.party_id) THEN
    RAISE EXCEPTION 'No se puede cambiar la identidad, empresa, tipo o contraparte del documento.';
  END IF;

  IF OLD.status <> 'draft' AND (
    NEW.branch_id IS DISTINCT FROM OLD.branch_id
    OR NEW.document_number IS DISTINCT FROM OLD.document_number
    OR NEW.external_reference IS DISTINCT FROM OLD.external_reference
    OR NEW.document_date IS DISTINCT FROM OLD.document_date
    OR NEW.due_date IS DISTINCT FROM OLD.due_date
    OR NEW.currency_code IS DISTINCT FROM OLD.currency_code
    OR NEW.minor_unit_digits IS DISTINCT FROM OLD.minor_unit_digits
    OR NEW.exchange_rate IS DISTINCT FROM OLD.exchange_rate
    OR NEW.party_name_snapshot IS DISTINCT FROM OLD.party_name_snapshot
    OR NEW.party_tax_id_snapshot IS DISTINCT FROM OLD.party_tax_id_snapshot
    OR NEW.description IS DISTINCT FROM OLD.description
    OR NEW.payment_terms IS DISTINCT FROM OLD.payment_terms
    OR NEW.net_amount IS DISTINCT FROM OLD.net_amount
    OR NEW.tax_amount IS DISTINCT FROM OLD.tax_amount
    OR NEW.gross_amount IS DISTINCT FROM OLD.gross_amount
    OR NEW.metadata IS DISTINCT FROM OLD.metadata
  ) THEN
    RAISE EXCEPTION 'Los datos de un documento aprobado o emitido son inmutables.';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('partially_fulfilled', 'fulfilled')
      AND NEW.document_type NOT IN (
        'purchase_request', 'purchase_order', 'goods_receipt',
        'sales_order', 'delivery_note'
      ) THEN
      RAISE EXCEPTION 'Este tipo de documento no admite estado de recepción o cumplimiento.';
    END IF;
    IF NEW.status = 'issued' AND NEW.document_type NOT IN (
      'supplier_quote', 'supplier_invoice', 'supplier_credit_note', 'supplier_debit_note',
      'sales_quote', 'delivery_note', 'customer_invoice', 'customer_credit_note',
      'customer_debit_note'
    ) THEN
      RAISE EXCEPTION 'Este tipo de documento no se puede emitir.';
    END IF;
    allowed_transition :=
      (OLD.status = 'draft' AND NEW.status IN ('approved', 'issued', 'voided'))
      OR (OLD.status = 'approved' AND NEW.status IN (
        'partially_fulfilled', 'fulfilled', 'issued', 'voided'
      ))
      OR (OLD.status = 'partially_fulfilled' AND NEW.status IN (
        'partially_fulfilled', 'fulfilled', 'voided'
      ))
      OR (OLD.status = 'fulfilled' AND NEW.status IN ('issued', 'voided'))
      OR (
        OLD.status = 'issued'
        AND NEW.status IN ('partially_paid', 'paid')
        AND current_setting('app.commercial_settlement', TRUE) = 'on'
      )
      OR (
        OLD.status = 'partially_paid'
        AND NEW.status = 'paid'
        AND current_setting('app.commercial_settlement', TRUE) = 'on'
      );

    IF allowed_transition IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'Transición comercial no permitida: % -> %.', OLD.status, NEW.status;
    END IF;

    IF NEW.status IN ('approved', 'issued') THEN
      SELECT COUNT(*), COALESCE(SUM(net_amount), 0),
             COALESCE(SUM(tax_amount), 0), COALESCE(SUM(gross_amount), 0)
        INTO line_count, line_net, line_tax, line_gross
        FROM commercial_document_lines
        WHERE company_id = NEW.company_id AND document_id = NEW.id;

      IF line_count = 0 OR line_net <> NEW.net_amount
        OR line_tax <> NEW.tax_amount OR line_gross <> NEW.gross_amount THEN
        RAISE EXCEPTION 'El documento debe tener líneas y sus totales deben coincidir antes de aprobarse o emitirse.';
      END IF;
      IF NEW.status = 'issued' AND NEW.document_type IN (
        'customer_invoice', 'supplier_invoice'
      ) AND NEW.gross_amount <= 0 THEN
        RAISE EXCEPTION 'Una factura debe tener un importe total mayor que cero.';
      END IF;
    END IF;

    IF NEW.status = 'approved' THEN
      NEW.approved_at := COALESCE(NEW.approved_at, CURRENT_TIMESTAMP);
      NEW.approved_by := COALESCE(NEW.updated_by, NEW.approved_by);
    ELSIF NEW.status = 'issued' THEN
      NEW.issued_at := COALESCE(NEW.issued_at, CURRENT_TIMESTAMP);
      NEW.issued_by := COALESCE(NEW.updated_by, NEW.issued_by);
    ELSIF NEW.status = 'voided' AND NULLIF(BTRIM(NEW.void_reason), '') IS NULL THEN
      RAISE EXCEPTION 'La anulación requiere un motivo.';
    END IF;
  END IF;

  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION record_commercial_document_event()
RETURNS TRIGGER AS $$
DECLARE
  next_sequence INTEGER;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT COALESCE(MAX(sequence_number), 0) + 1
      INTO next_sequence
      FROM commercial_document_events
      WHERE company_id = NEW.company_id AND document_id = NEW.id;
    INSERT INTO commercial_document_events (
      id, company_id, document_id, sequence_number, event_type,
      from_status, to_status, actor_id, details
    ) VALUES (
      gen_random_uuid()::TEXT, NEW.company_id, NEW.id, next_sequence,
      CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE 'status_changed' END,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END,
      NEW.status, COALESCE(NEW.updated_by, NEW.created_by),
      CASE WHEN NEW.status = 'voided'
        THEN jsonb_build_object('reason', NEW.void_reason)
        ELSE '{}'::JSONB END
    );
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION protect_commercial_document_lines()
RETURNS TRIGGER AS $$
DECLARE
  parent_company_id TEXT;
  parent_document_id TEXT;
  parent_status TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    parent_company_id := OLD.company_id;
    parent_document_id := OLD.document_id;
  ELSE
    parent_company_id := NEW.company_id;
    parent_document_id := NEW.document_id;
  END IF;

  IF TG_OP = 'UPDATE' AND (
    NEW.id IS DISTINCT FROM OLD.id
    OR NEW.company_id IS DISTINCT FROM OLD.company_id
  ) THEN
    RAISE EXCEPTION 'No se puede cambiar la identidad o empresa de una línea comercial.';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT status INTO parent_status
      FROM commercial_documents
      WHERE company_id = OLD.company_id AND id = OLD.document_id;
    IF parent_status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION 'Las líneas solo se pueden modificar mientras el documento está en borrador.';
    END IF;
  END IF;

  SELECT status INTO parent_status
    FROM commercial_documents
    WHERE company_id = parent_company_id AND id = parent_document_id;
  IF parent_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Las líneas solo se pueden modificar mientras el documento está en borrador.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_commercial_open_item()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'issued' AND OLD.status IS DISTINCT FROM 'issued'
    AND NEW.document_type IN ('customer_invoice', 'supplier_invoice') THEN
    INSERT INTO commercial_open_items (
      id, company_id, party_role, party_id, source_document_id,
      currency_code, original_amount, outstanding_amount, due_date
    ) VALUES (
      gen_random_uuid()::TEXT, NEW.company_id, NEW.party_role, NEW.party_id, NEW.id,
      NEW.currency_code, NEW.gross_amount, NEW.gross_amount, NEW.due_date
    );
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION protect_commercial_open_item()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Las cuentas por cobrar y pagar se conservan; use una aplicación o documento correctivo.';
  END IF;
  IF TG_OP = 'UPDATE'
    AND current_setting('app.commercial_settlement', TRUE) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Los saldos abiertos solo cambian al aplicar un pago o cobranza.';
  END IF;
  IF TG_OP = 'UPDATE'
    AND (NEW.company_id, NEW.party_role, NEW.party_id, NEW.source_document_id,
         NEW.currency_code, NEW.original_amount)
      IS DISTINCT FROM
        (OLD.company_id, OLD.party_role, OLD.party_id, OLD.source_document_id,
         OLD.currency_code, OLD.original_amount) THEN
    RAISE EXCEPTION 'La identidad y el importe original de una cuenta abierta son inmutables.';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.status := CASE
      WHEN NEW.outstanding_amount = 0 THEN 'settled'
      WHEN NEW.outstanding_amount < NEW.original_amount THEN 'partially_settled'
      ELSE 'open'
    END;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION protect_commercial_settlement()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' THEN
      RAISE EXCEPTION 'Las cobranzas y pagos deben crearse como borrador.';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Las cobranzas y pagos se conservan; no se eliminan.';
  END IF;
  IF OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'Una cobranza o pago contabilizado es inmutable.';
  END IF;
  IF (NEW.company_id, NEW.id, NEW.settlement_type, NEW.party_id,
      NEW.settlement_date, NEW.currency_code, NEW.amount, NEW.exchange_rate,
      NEW.payment_method)
     IS DISTINCT FROM
     (OLD.company_id, OLD.id, OLD.settlement_type, OLD.party_id,
      OLD.settlement_date, OLD.currency_code, OLD.amount, OLD.exchange_rate,
      OLD.payment_method) THEN
    RAISE EXCEPTION 'No se puede cambiar la identidad ni los importes de la operación.';
  END IF;
  IF NEW.status NOT IN ('draft', 'posted', 'voided') THEN
    RAISE EXCEPTION 'Estado de cobranza o pago no permitido.';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
    AND NEW.status = 'posted'
    AND current_setting('app.commercial_settlement', TRUE) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Use post_commercial_settlement para contabilizar pagos y cobranzas.';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
    AND NOT (OLD.status = 'draft' AND NEW.status IN ('posted', 'voided')) THEN
    RAISE EXCEPTION 'Transición de cobranza o pago no permitida: % -> %.',
      OLD.status, NEW.status;
  END IF;
  IF NEW.status = 'voided' AND NULLIF(BTRIM(NEW.void_reason), '') IS NULL THEN
    RAISE EXCEPTION 'La anulación requiere un motivo.';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM business_party_roles AS bpr
      JOIN business_parties AS bp
        ON bp.company_id = bpr.company_id AND bp.id = bpr.party_id
      WHERE bpr.company_id = NEW.company_id
        AND bpr.party_id = NEW.party_id
        AND bpr.role = CASE NEW.settlement_type
          WHEN 'receivable' THEN 'customer' ELSE 'supplier' END
        AND bpr.active
        AND bp.active
  ) THEN
    RAISE EXCEPTION 'La contraparte no tiene un rol activo compatible con esta operación.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION protect_commercial_settlement_allocations()
RETURNS TRIGGER AS $$
DECLARE
  parent_status TEXT;
BEGIN
  SELECT status INTO parent_status
    FROM commercial_settlements
    WHERE company_id = COALESCE(NEW.company_id, OLD.company_id)
      AND id = COALESCE(NEW.settlement_id, OLD.settlement_id);
  IF parent_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Las aplicaciones solo se pueden modificar mientras el pago está en borrador.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION record_commercial_settlement_event()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO commercial_settlement_events (
      id, company_id, settlement_id, from_status, to_status, actor_id, details
    ) VALUES (
      gen_random_uuid()::TEXT, NEW.company_id, NEW.id,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END,
      NEW.status, COALESCE(NEW.posted_by, NEW.created_by),
      CASE WHEN NEW.status = 'voided'
        THEN jsonb_build_object('reason', NEW.void_reason)
        ELSE '{}'::JSONB END
    );
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION post_commercial_settlement(
  target_settlement_id TEXT,
  actor_user_id TEXT
)
RETURNS VOID AS $$
DECLARE
  settlement_row commercial_settlements%ROWTYPE;
  allocation_row RECORD;
  allocated_total NUMERIC(20, 6);
  affected_item RECORD;
  previous_setting TEXT;
BEGIN
  SELECT * INTO settlement_row
    FROM commercial_settlements
    WHERE id = target_settlement_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la cobranza o pago %.', target_settlement_id;
  END IF;
  IF settlement_row.status <> 'draft' THEN
    RAISE EXCEPTION 'Solo se puede contabilizar una cobranza o pago en borrador.';
  END IF;
  IF actor_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM users WHERE id = actor_user_id AND is_active
  ) THEN
    RAISE EXCEPTION 'Se requiere un usuario activo para contabilizar la operación.';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO allocated_total
    FROM commercial_settlement_allocations
    WHERE company_id = settlement_row.company_id
      AND settlement_id = settlement_row.id;
  IF allocated_total <> settlement_row.amount THEN
    RAISE EXCEPTION 'El total aplicado (%) debe ser igual al importe de la operación (%).',
      allocated_total, settlement_row.amount;
  END IF;

  previous_setting := current_setting('app.commercial_settlement', TRUE);
  PERFORM set_config('app.commercial_settlement', 'on', TRUE);

  FOR allocation_row IN
    SELECT a.id, a.amount, oi.id AS item_id, oi.party_role, oi.party_id,
           oi.currency_code, oi.outstanding_amount, oi.source_document_id
      FROM commercial_settlement_allocations AS a
      JOIN commercial_open_items AS oi
        ON oi.company_id = a.company_id AND oi.id = a.open_item_id
      WHERE a.company_id = settlement_row.company_id
        AND a.settlement_id = settlement_row.id
      ORDER BY oi.id
      FOR UPDATE OF oi
  LOOP
    IF allocation_row.party_id <> settlement_row.party_id
      OR allocation_row.currency_code <> settlement_row.currency_code
      OR allocation_row.outstanding_amount < allocation_row.amount
      OR (settlement_row.settlement_type = 'receivable'
          AND allocation_row.party_role <> 'customer')
      OR (settlement_row.settlement_type = 'payable'
          AND allocation_row.party_role <> 'supplier') THEN
      RAISE EXCEPTION 'La aplicación % no coincide con la contraparte, moneda o saldo pendiente.',
        allocation_row.id;
    END IF;
    UPDATE commercial_open_items
      SET outstanding_amount = outstanding_amount - allocation_row.amount
      WHERE company_id = settlement_row.company_id AND id = allocation_row.item_id;

    SELECT outstanding_amount INTO affected_item
      FROM commercial_open_items
      WHERE company_id = settlement_row.company_id AND id = allocation_row.item_id;
    UPDATE commercial_documents
      SET status = CASE
        WHEN affected_item.outstanding_amount = 0 THEN 'paid'
        ELSE 'partially_paid'
      END,
      updated_by = actor_user_id
      WHERE company_id = settlement_row.company_id
        AND id = allocation_row.source_document_id
        AND status IN ('issued', 'partially_paid');
  END LOOP;

  UPDATE commercial_settlements
    SET status = 'posted', posted_by = actor_user_id, posted_at = CURRENT_TIMESTAMP
    WHERE company_id = settlement_row.company_id AND id = settlement_row.id;

  PERFORM set_config(
    'app.commercial_settlement',
    COALESCE(previous_setting, ''),
    TRUE
  );
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_commercial_document_protect ON commercial_documents;
CREATE TRIGGER trg_commercial_document_protect
  BEFORE INSERT OR UPDATE OR DELETE ON commercial_documents
  FOR EACH ROW EXECUTE FUNCTION protect_commercial_document();

DROP TRIGGER IF EXISTS trg_commercial_document_events ON commercial_documents;
CREATE TRIGGER trg_commercial_document_events
  AFTER INSERT OR UPDATE OF status ON commercial_documents
  FOR EACH ROW EXECUTE FUNCTION record_commercial_document_event();

DROP TRIGGER IF EXISTS trg_commercial_document_lines_protect ON commercial_document_lines;
CREATE TRIGGER trg_commercial_document_lines_protect
  BEFORE INSERT OR UPDATE OR DELETE ON commercial_document_lines
  FOR EACH ROW EXECUTE FUNCTION protect_commercial_document_lines();

DROP TRIGGER IF EXISTS trg_commercial_document_links_no_delete ON commercial_document_links;
CREATE TRIGGER trg_commercial_document_links_no_delete
  BEFORE UPDATE OR DELETE ON commercial_document_links
  FOR EACH ROW EXECUTE FUNCTION prevent_commercial_record_delete();

DROP TRIGGER IF EXISTS trg_commercial_document_events_no_mutation ON commercial_document_events;
CREATE TRIGGER trg_commercial_document_events_no_mutation
  BEFORE UPDATE OR DELETE ON commercial_document_events
  FOR EACH ROW EXECUTE FUNCTION prevent_commercial_record_delete();

DROP TRIGGER IF EXISTS trg_create_commercial_open_item ON commercial_documents;
CREATE TRIGGER trg_create_commercial_open_item
  AFTER UPDATE OF status ON commercial_documents
  FOR EACH ROW EXECUTE FUNCTION create_commercial_open_item();

DROP TRIGGER IF EXISTS trg_commercial_open_items_protect ON commercial_open_items;
CREATE TRIGGER trg_commercial_open_items_protect
  BEFORE UPDATE OR DELETE ON commercial_open_items
  FOR EACH ROW EXECUTE FUNCTION protect_commercial_open_item();

DROP TRIGGER IF EXISTS trg_commercial_settlement_protect ON commercial_settlements;
CREATE TRIGGER trg_commercial_settlement_protect
  BEFORE INSERT OR UPDATE OR DELETE ON commercial_settlements
  FOR EACH ROW EXECUTE FUNCTION protect_commercial_settlement();

DROP TRIGGER IF EXISTS trg_commercial_settlement_events ON commercial_settlements;
CREATE TRIGGER trg_commercial_settlement_events
  AFTER INSERT OR UPDATE OF status ON commercial_settlements
  FOR EACH ROW EXECUTE FUNCTION record_commercial_settlement_event();

DROP TRIGGER IF EXISTS trg_commercial_allocations_protect ON commercial_settlement_allocations;
CREATE TRIGGER trg_commercial_allocations_protect
  BEFORE INSERT OR UPDATE OR DELETE ON commercial_settlement_allocations
  FOR EACH ROW EXECUTE FUNCTION protect_commercial_settlement_allocations();

DROP TRIGGER IF EXISTS trg_commercial_settlement_events_no_mutation ON commercial_settlement_events;
CREATE TRIGGER trg_commercial_settlement_events_no_mutation
  BEFORE UPDATE OR DELETE ON commercial_settlement_events
  FOR EACH ROW EXECUTE FUNCTION prevent_commercial_record_delete();
INSERT INTO schema_migrations (version) VALUES ('006') ON CONFLICT (version) DO NOTHING;
-- END 006_commercial_documents_and_settlements.sql


-- BEGIN 007_security_audit_sessions.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  token_hash CHAR(64) NOT NULL CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  ip_address INET,
  user_agent TEXT NOT NULL DEFAULT '',
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  CHECK (expires_at > started_at),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_active
  ON auth_sessions (user_id, expires_at DESC)
  WHERE ended_at IS NULL;

CREATE OR REPLACE FUNCTION protect_auth_session()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Las sesiones se conservan como evidencia; ciérrelas en lugar de eliminarlas.';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.id, NEW.user_id, NEW.token_hash, NEW.ip_address, NEW.user_agent,
        NEW.started_at, NEW.expires_at)
       IS DISTINCT FROM
       (OLD.id, OLD.user_id, OLD.token_hash, OLD.ip_address, OLD.user_agent,
        OLD.started_at, OLD.expires_at)
       OR OLD.ended_at IS NOT NULL
       OR NEW.ended_at IS NULL THEN
      RAISE EXCEPTION 'Una sesión solo puede cerrarse una vez; sus datos de origen son inmutables.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auth_sessions_protect ON auth_sessions;
CREATE TRIGGER trg_auth_sessions_protect
  BEFORE UPDATE OR DELETE ON auth_sessions
  FOR EACH ROW EXECUTE FUNCTION protect_auth_session();

ALTER TABLE audit_events
  ADD COLUMN IF NOT EXISTS chain_sequence BIGINT,
  ADD COLUMN IF NOT EXISTS previous_hash CHAR(64),
  ADD COLUMN IF NOT EXISTS event_hash CHAR(64);

CREATE OR REPLACE FUNCTION calculate_audit_event_hash(event_row audit_events)
RETURNS CHAR(64) AS $$
  SELECT encode(
    digest(
      convert_to(jsonb_build_object(
        'id', event_row.id,
        'company_id', event_row.company_id,
        'user_id', event_row.user_id,
        'username', event_row.username,
        'occurred_at', event_row.occurred_at,
        'module', event_row.module,
        'action', event_row.action,
        'entity_type', event_row.entity_type,
        'entity_id', event_row.entity_id,
        'details', event_row.details,
        'ip_address', event_row.ip_address,
        'outcome', event_row.outcome,
        'reason', event_row.reason,
        'chain_sequence', event_row.chain_sequence,
        'previous_hash', event_row.previous_hash
      )::TEXT, 'UTF8'),
      'sha256'
    ),
    'hex'
  )::CHAR(64);
$$ LANGUAGE SQL IMMUTABLE STRICT;

DO $$
DECLARE
  event_row audit_events%ROWTYPE;
  current_company_id TEXT;
  next_sequence BIGINT := 0;
  previous_event_hash CHAR(64);
BEGIN
  FOR event_row IN
    SELECT * FROM audit_events
    ORDER BY company_id NULLS FIRST, occurred_at, id
  LOOP
    IF event_row.company_id IS DISTINCT FROM current_company_id THEN
      current_company_id := event_row.company_id;
      next_sequence := 0;
      previous_event_hash := NULL;
    END IF;

    next_sequence := next_sequence + 1;
    event_row.chain_sequence := next_sequence;
    event_row.previous_hash := previous_event_hash;
    event_row.event_hash := calculate_audit_event_hash(event_row);

    UPDATE audit_events
      SET chain_sequence = event_row.chain_sequence,
          previous_hash = event_row.previous_hash,
          event_hash = event_row.event_hash
      WHERE id = event_row.id;
    previous_event_hash := event_row.event_hash;
  END LOOP;
END;
$$;

ALTER TABLE audit_events
  ALTER COLUMN chain_sequence SET NOT NULL,
  ALTER COLUMN event_hash SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_events_company_chain_sequence
  ON audit_events (company_id, chain_sequence)
  WHERE company_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_events_global_chain_sequence
  ON audit_events (chain_sequence)
  WHERE company_id IS NULL;

CREATE OR REPLACE FUNCTION chain_audit_event()
RETURNS TRIGGER AS $$
DECLARE
  previous_sequence BIGINT;
  previous_event_hash CHAR(64);
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended(COALESCE(NEW.company_id, '<global>'), 731904212)
  );

  SELECT chain_sequence, event_hash
    INTO previous_sequence, previous_event_hash
    FROM audit_events
    WHERE company_id IS NOT DISTINCT FROM NEW.company_id
    ORDER BY chain_sequence DESC
    LIMIT 1;

  NEW.chain_sequence := COALESCE(previous_sequence, 0) + 1;
  NEW.previous_hash := previous_event_hash;
  NEW.event_hash := calculate_audit_event_hash(NEW);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_events_chain ON audit_events;
CREATE TRIGGER trg_audit_events_chain
  BEFORE INSERT ON audit_events
  FOR EACH ROW EXECUTE FUNCTION chain_audit_event();

CREATE OR REPLACE FUNCTION protect_audit_event()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Los eventos de auditoría son append-only; no se editan ni eliminan.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_events_append_only ON audit_events;
CREATE TRIGGER trg_audit_events_append_only
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION protect_audit_event();

CREATE OR REPLACE FUNCTION verify_audit_event_chain(target_company_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  event_row audit_events%ROWTYPE;
  expected_sequence BIGINT := 0;
  expected_previous_hash CHAR(64);
BEGIN
  FOR event_row IN
    SELECT * FROM audit_events
    WHERE company_id IS NOT DISTINCT FROM target_company_id
    ORDER BY chain_sequence
  LOOP
    expected_sequence := expected_sequence + 1;
    IF event_row.chain_sequence <> expected_sequence
       OR event_row.previous_hash IS DISTINCT FROM expected_previous_hash
       OR event_row.event_hash IS DISTINCT FROM calculate_audit_event_hash(event_row) THEN
      RETURN FALSE;
    END IF;
    expected_previous_hash := event_row.event_hash;
  END LOOP;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION audit_sensitive_row_change()
RETURNS TRIGGER AS $$
DECLARE
  before_data JSONB;
  after_data JSONB;
  source_data JSONB;
  target_company_id TEXT;
  target_entity_id TEXT;
  actor_id TEXT;
  actor_name TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    before_data := to_jsonb(OLD);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    after_data := to_jsonb(NEW);
  END IF;
  source_data := COALESCE(after_data, before_data);

  IF TG_TABLE_NAME = 'companies' THEN
    target_company_id := source_data ->> 'id';
  ELSIF TG_TABLE_NAME = 'journal_lines' THEN
    SELECT company_id INTO target_company_id
      FROM journal_entries
      WHERE id = source_data ->> 'journal_entry_id';
  ELSIF TG_TABLE_NAME = 'fiscal_document_lines' THEN
    SELECT company_id INTO target_company_id
      FROM fiscal_documents
      WHERE id = source_data ->> 'fiscal_document_id';
  ELSIF TG_TABLE_NAME = 'commercial_document_lines' THEN
    SELECT company_id INTO target_company_id
      FROM commercial_documents
      WHERE id = source_data ->> 'document_id';
  ELSIF TG_TABLE_NAME = 'commercial_settlement_allocations' THEN
    SELECT company_id INTO target_company_id
      FROM commercial_settlements
      WHERE id = source_data ->> 'settlement_id';
  ELSIF TG_TABLE_NAME = 'fiscal_tax_rates' THEN
    SELECT configuration.company_id INTO target_company_id
      FROM fiscal_taxes AS tax
      JOIN fiscal_configurations AS configuration
        ON configuration.id = tax.configuration_id
      WHERE tax.id = source_data ->> 'tax_id';
  ELSIF TG_TABLE_NAME = 'fiscal_sequences' THEN
    SELECT company_id INTO target_company_id
      FROM fiscal_series
      WHERE id = source_data ->> 'series_id';
  ELSIF TG_TABLE_NAME = 'role_permissions' THEN
    SELECT company_id INTO target_company_id
      FROM roles
      WHERE id = source_data ->> 'role_id';
  ELSIF TG_TABLE_NAME = 'auth_sessions' THEN
    SELECT company_id INTO target_company_id
      FROM users
      WHERE id = source_data ->> 'user_id';
  ELSE
    target_company_id := source_data ->> 'company_id';
  END IF;

  target_entity_id := COALESCE(
    source_data ->> 'id',
    source_data ->> 'role_id',
    source_data ->> 'permission_id',
    source_data ->> 'series_id',
    source_data ->> 'fiscal_document_id',
    source_data ->> 'document_id',
    source_data ->> 'journal_entry_id',
    source_data ->> 'settlement_id'
  );
  actor_id := COALESCE(
    NULLIF(current_setting('app.user_id', TRUE), ''),
    NULLIF(current_setting('app.usuario_id', TRUE), '')
  );
  IF actor_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(username, ''), NULLIF(nombre, ''), actor_id)
      INTO actor_name
      FROM users
      WHERE id = actor_id;
    IF actor_name IS NULL THEN
      actor_name := actor_id;
    END IF;
  ELSE
    actor_name := 'sistema';
  END IF;

  before_data := before_data - 'password_hash' - 'token_hash';
  after_data := after_data - 'password_hash' - 'token_hash';
  IF TG_TABLE_NAME = 'employees' THEN
    before_data := jsonb_build_object(
      'status', before_data -> 'status',
      'termination_date', before_data -> 'termination_date'
    );
    after_data := jsonb_build_object(
      'status', after_data -> 'status',
      'termination_date', after_data -> 'termination_date'
    );
  END IF;
  INSERT INTO audit_events (
    id, company_id, user_id, username, module, action,
    entity_type, entity_id, details, ip_address
  ) VALUES (
    gen_random_uuid()::TEXT, target_company_id, actor_id, actor_name,
    TG_TABLE_NAME, TG_OP, TG_TABLE_NAME, target_entity_id,
    jsonb_build_object('before', before_data, 'after', after_data),
    NULLIF(current_setting('app.client_ip', TRUE), '')::INET
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_critical_record_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'El registro se conserva; desactívelo o use el flujo de anulación correspondiente.';
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'companies', 'branches', 'users', 'roles', 'permissions',
    'accounting_accounts', 'accounting_periods', 'employees'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_no_hard_delete ON %I',
      target_table, target_table);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_no_hard_delete BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION prevent_critical_record_delete()',
      target_table, target_table
    );
  END LOOP;
END;
$$;

DO $$
DECLARE
  target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'companies', 'branches', 'users', 'roles', 'permissions', 'role_permissions',
    'system_parameters', 'accounting_accounts', 'accounting_periods',
    'journal_entries', 'journal_lines', 'business_parties', 'business_party_roles',
    'business_party_addresses', 'business_party_contacts',
    'commercial_documents', 'commercial_document_lines', 'commercial_document_links',
    'commercial_open_items', 'commercial_settlements',
    'commercial_settlement_allocations', 'employees', 'fiscal_configurations', 'fiscal_taxes',
    'fiscal_tax_rates', 'fiscal_series', 'fiscal_sequences', 'fiscal_documents',
    'fiscal_document_lines', 'fiscal_withholdings', 'igtf_operations', 'fiscal_books',
    'auth_sessions'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_audit_row ON %I',
      target_table, target_table);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_audit_row AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_sensitive_row_change()',
      target_table, target_table
    );
  END LOOP;
END;
$$;
INSERT INTO schema_migrations (version) VALUES ('007') ON CONFLICT (version) DO NOTHING;
-- END 007_security_audit_sessions.sql


-- BEGIN 008_bank_reconciliation.sql
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
INSERT INTO schema_migrations (version) VALUES ('008') ON CONFLICT (version) DO NOTHING;
-- END 008_bank_reconciliation.sql


-- BEGIN 009_commercial_sales_integration.sql
ALTER TABLE business_parties
  ADD COLUMN IF NOT EXISTS fiscal_condition TEXT;

DO $$
DECLARE
  target_constraint RECORD;
BEGIN
  FOR target_constraint IN
    SELECT constraint_row.conname
    FROM pg_constraint AS constraint_row
    JOIN pg_class AS target_table ON target_table.oid = constraint_row.conrelid
    JOIN pg_namespace AS target_schema ON target_schema.oid = target_table.relnamespace
    WHERE target_schema.nspname = current_schema()
      AND target_table.relname = 'commercial_document_lines'
      AND constraint_row.contype = 'c'
      AND pg_get_constraintdef(constraint_row.oid)
        LIKE '%net_amount%discount_amount%quantity%unit_price%'
  LOOP
    EXECUTE format(
      'ALTER TABLE commercial_document_lines DROP CONSTRAINT %I',
      target_constraint.conname
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION validate_commercial_line_rounding()
RETURNS TRIGGER AS $$
DECLARE
  minor_digits SMALLINT;
BEGIN
  SELECT document.minor_unit_digits INTO minor_digits
  FROM commercial_documents AS document
  WHERE document.company_id = NEW.company_id AND document.id = NEW.document_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe el documento comercial de la línea.';
  END IF;
  IF ROUND(NEW.net_amount + NEW.discount_amount, minor_digits)
      <> ROUND(NEW.quantity * NEW.unit_price, minor_digits) THEN
    RAISE EXCEPTION 'El importe neto y descuento no coinciden con la cantidad y el precio redondeados a la moneda del documento.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_commercial_line_rounding
  ON commercial_document_lines;
CREATE TRIGGER trg_validate_commercial_line_rounding
  BEFORE INSERT OR UPDATE ON commercial_document_lines
  FOR EACH ROW EXECUTE FUNCTION validate_commercial_line_rounding();

CREATE TABLE IF NOT EXISTS commercial_document_sequences (
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  branch_scope_id TEXT NOT NULL DEFAULT '',
  document_type TEXT NOT NULL CHECK (document_type IN ('sales_quote', 'delivery_note')),
  next_number BIGINT NOT NULL DEFAULT 1 CHECK (next_number > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (company_id, branch_scope_id, document_type)
);

CREATE TABLE IF NOT EXISTS accounting_entry_sequences (
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  sequence_year SMALLINT NOT NULL CHECK (sequence_year BETWEEN 2000 AND 9999),
  next_number BIGINT NOT NULL DEFAULT 1 CHECK (next_number > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (company_id, sequence_year)
);

CREATE TABLE IF NOT EXISTS commercial_account_mappings (
  company_id TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE RESTRICT,
  receivable_account_id TEXT,
  revenue_account_id TEXT,
  tax_payable_account_id TEXT,
  inventory_account_id TEXT,
  cost_of_sales_account_id TEXT,
  updated_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id, receivable_account_id)
    REFERENCES accounting_accounts (company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, revenue_account_id)
    REFERENCES accounting_accounts (company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, tax_payable_account_id)
    REFERENCES accounting_accounts (company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, inventory_account_id)
    REFERENCES accounting_accounts (company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, cost_of_sales_account_id)
    REFERENCES accounting_accounts (company_id, id) ON DELETE RESTRICT
);

CREATE OR REPLACE FUNCTION validate_commercial_account_mappings()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM (
      VALUES
        (NEW.receivable_account_id, 'activo'),
        (NEW.revenue_account_id, 'ingreso'),
        (NEW.tax_payable_account_id, 'pasivo'),
        (NEW.inventory_account_id, 'activo'),
        (NEW.cost_of_sales_account_id, 'gasto')
    ) AS mapping(account_id, expected_type)
    JOIN accounting_accounts AS account
      ON account.company_id = NEW.company_id AND account.id = mapping.account_id
    WHERE mapping.account_id IS NOT NULL
      AND (account.account_type <> mapping.expected_type
        OR NOT account.active OR account.is_group)
  ) THEN
    RAISE EXCEPTION 'Cada cuenta comercial debe ser activa, de detalle y del tipo contable requerido.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_commercial_account_mappings
  ON commercial_account_mappings;
CREATE TRIGGER trg_validate_commercial_account_mappings
  BEFORE INSERT OR UPDATE ON commercial_account_mappings
  FOR EACH ROW EXECUTE FUNCTION validate_commercial_account_mappings();

CREATE TABLE IF NOT EXISTS inventory_valuation_balances (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity_on_hand NUMERIC(20, 6) NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  inventory_value NUMERIC(20, 6) NOT NULL DEFAULT 0 CHECK (inventory_value >= 0),
  average_unit_cost NUMERIC(20, 6) NOT NULL DEFAULT 0 CHECK (average_unit_cost >= 0),
  is_initialized BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, warehouse_id, product_id),
  FOREIGN KEY (company_id, warehouse_id)
    REFERENCES inventory_warehouses (company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, product_id)
    REFERENCES inventory_products (company_id, id) ON DELETE RESTRICT,
  CHECK ((quantity_on_hand > 0) OR inventory_value = 0),
  CHECK (is_initialized OR (
    quantity_on_hand = 0 AND inventory_value = 0 AND average_unit_cost = 0
  ))
);
CREATE INDEX IF NOT EXISTS idx_inventory_valuation_product
  ON inventory_valuation_balances (company_id, product_id, warehouse_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fiscal_documents_company_id
  ON fiscal_documents (company_id, id);

CREATE TABLE IF NOT EXISTS commercial_fiscal_document_links (
  company_id TEXT NOT NULL,
  commercial_document_id TEXT NOT NULL,
  fiscal_document_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  PRIMARY KEY (company_id, commercial_document_id),
  UNIQUE (company_id, fiscal_document_id),
  FOREIGN KEY (company_id, commercial_document_id)
    REFERENCES commercial_documents (company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, fiscal_document_id)
    REFERENCES fiscal_documents (company_id, id) ON DELETE RESTRICT
);

ALTER TABLE fiscal_documents
  ADD COLUMN IF NOT EXISTS commercial_document_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_fiscal_documents_commercial_document
  ON fiscal_documents (company_id, commercial_document_id)
  WHERE commercial_document_id IS NOT NULL;
ALTER TABLE fiscal_documents
  DROP CONSTRAINT IF EXISTS fiscal_documents_company_commercial_document_fk;
ALTER TABLE fiscal_documents
  ADD CONSTRAINT fiscal_documents_company_commercial_document_fk
  FOREIGN KEY (company_id, commercial_document_id)
  REFERENCES commercial_documents (company_id, id) ON DELETE RESTRICT;

ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS source_commercial_document_id TEXT;
ALTER TABLE journal_entries
  DROP CONSTRAINT IF EXISTS journal_entries_company_source_commercial_fk;
ALTER TABLE journal_entries
  ADD CONSTRAINT journal_entries_company_source_commercial_fk
  FOREIGN KEY (company_id, source_commercial_document_id)
  REFERENCES commercial_documents (company_id, id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_journal_entries_commercial_source
  ON journal_entries (company_id, source_commercial_document_id)
  WHERE source_commercial_document_id IS NOT NULL;

CREATE OR REPLACE FUNCTION prepare_inventory_valuation_cost()
RETURNS TRIGGER AS $$
DECLARE
  required_row RECORD;
  valuation_row inventory_valuation_balances%ROWTYPE;
BEGIN
  IF OLD.status = NEW.status OR NEW.status <> 'posted'
    OR NEW.movement_type NOT IN ('issue', 'return_out', 'transfer', 'adjustment')
    OR NEW.reversal_of IS NOT NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(NEW.company_id));
  FOR required_row IN
    SELECT source_warehouse_id AS warehouse_id, product_id,
           SUM(quantity) AS required_quantity
      FROM inventory_movement_lines
      WHERE company_id = NEW.company_id AND movement_id = NEW.id
        AND source_warehouse_id IS NOT NULL
      GROUP BY source_warehouse_id, product_id
      ORDER BY source_warehouse_id, product_id
  LOOP
    SELECT * INTO valuation_row
      FROM inventory_valuation_balances
      WHERE company_id = NEW.company_id
        AND warehouse_id = required_row.warehouse_id
        AND product_id = required_row.product_id
      FOR UPDATE;
    IF NOT FOUND OR NOT valuation_row.is_initialized THEN
      RAISE EXCEPTION 'No se puede emitir: falta valoración inicial confiable para el producto % en el almacén %.',
        required_row.product_id, required_row.warehouse_id;
    END IF;
    IF valuation_row.quantity_on_hand < required_row.required_quantity THEN
      RAISE EXCEPTION 'Existencia valorizada insuficiente para el producto % en el almacén %.',
        required_row.product_id, required_row.warehouse_id;
    END IF;
  END LOOP;

  UPDATE inventory_movement_lines AS line
    SET unit_cost = valuation.average_unit_cost
    FROM inventory_valuation_balances AS valuation
    WHERE line.company_id = NEW.company_id
      AND line.movement_id = NEW.id
      AND valuation.company_id = line.company_id
      AND valuation.warehouse_id = line.source_warehouse_id
      AND valuation.product_id = line.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prepare_inventory_valuation_cost ON inventory_movements;
CREATE TRIGGER trg_prepare_inventory_valuation_cost
  BEFORE UPDATE OF status ON inventory_movements
  FOR EACH ROW EXECUTE FUNCTION prepare_inventory_valuation_cost();

CREATE OR REPLACE FUNCTION apply_inventory_valuation()
RETURNS TRIGGER AS $$
DECLARE
  movement_line RECORD;
  valuation_quantity NUMERIC(20, 6);
  valuation_value NUMERIC(20, 6);
  next_quantity NUMERIC(20, 6);
  next_value NUMERIC(20, 6);
  next_average NUMERIC(20, 6);
  target_warehouse_id TEXT;
  is_incoming BOOLEAN;
BEGIN
  IF OLD.status = NEW.status OR NEW.status <> 'posted' THEN
    RETURN NULL;
  END IF;

  FOR movement_line IN
    SELECT * FROM inventory_movement_lines
      WHERE company_id = NEW.company_id AND movement_id = NEW.id
      ORDER BY product_id, source_warehouse_id, destination_warehouse_id, id
  LOOP
    IF NEW.movement_type = 'transfer' THEN
      target_warehouse_id := movement_line.source_warehouse_id;
      is_incoming := FALSE;
      PERFORM update_inventory_valuation(
        NEW.company_id, target_warehouse_id, movement_line.product_id,
        movement_line.quantity, movement_line.unit_cost, is_incoming
      );
      target_warehouse_id := movement_line.destination_warehouse_id;
      is_incoming := TRUE;
      PERFORM update_inventory_valuation(
        NEW.company_id, target_warehouse_id, movement_line.product_id,
        movement_line.quantity, movement_line.unit_cost, is_incoming
      );
    ELSIF movement_line.source_warehouse_id IS NOT NULL THEN
      PERFORM update_inventory_valuation(
        NEW.company_id, movement_line.source_warehouse_id, movement_line.product_id,
        movement_line.quantity, movement_line.unit_cost, FALSE
      );
    ELSE
      PERFORM update_inventory_valuation(
        NEW.company_id, movement_line.destination_warehouse_id, movement_line.product_id,
        movement_line.quantity, movement_line.unit_cost, TRUE
      );
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_inventory_valuation(
  target_company_id TEXT,
  target_warehouse_id TEXT,
  target_product_id TEXT,
  movement_quantity NUMERIC,
  movement_unit_cost NUMERIC,
  incoming BOOLEAN
)
RETURNS VOID AS $$
DECLARE
  current_balance inventory_valuation_balances%ROWTYPE;
  updated_quantity NUMERIC(20, 6);
  updated_value NUMERIC(20, 6);
  updated_average NUMERIC(20, 6);
BEGIN
  INSERT INTO inventory_valuation_balances (
    id, company_id, warehouse_id, product_id, is_initialized
  ) VALUES (
    gen_random_uuid()::TEXT, target_company_id, target_warehouse_id,
    target_product_id, FALSE
  ) ON CONFLICT (company_id, warehouse_id, product_id) DO NOTHING;

  SELECT * INTO current_balance
    FROM inventory_valuation_balances
    WHERE company_id = target_company_id
      AND warehouse_id = target_warehouse_id
      AND product_id = target_product_id
    FOR UPDATE;

  IF incoming THEN
    updated_quantity := current_balance.quantity_on_hand + movement_quantity;
    updated_value := current_balance.inventory_value
      + ROUND(movement_quantity * movement_unit_cost, 6);
    updated_average := CASE WHEN updated_quantity = 0 THEN 0
      ELSE ROUND(updated_value / updated_quantity, 6) END;
  ELSE
    IF NOT current_balance.is_initialized
      OR current_balance.quantity_on_hand < movement_quantity THEN
      RAISE EXCEPTION 'Existencia sin valoración inicial o insuficiente para producto % en almacén %.',
        target_product_id, target_warehouse_id;
    END IF;
    updated_quantity := current_balance.quantity_on_hand - movement_quantity;
    updated_value := CASE WHEN updated_quantity = 0 THEN 0 ELSE GREATEST(
      0, current_balance.inventory_value - ROUND(movement_quantity * movement_unit_cost, 6)
    ) END;
    updated_average := CASE WHEN updated_quantity = 0 THEN 0
      ELSE ROUND(updated_value / updated_quantity, 6) END;
  END IF;

  UPDATE inventory_valuation_balances
    SET quantity_on_hand = updated_quantity,
        inventory_value = updated_value,
        average_unit_cost = updated_average,
        is_initialized = TRUE,
        updated_at = CURRENT_TIMESTAMP
    WHERE company_id = target_company_id
      AND warehouse_id = target_warehouse_id
      AND product_id = target_product_id;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_apply_inventory_valuation ON inventory_movements;
CREATE TRIGGER trg_apply_inventory_valuation
  AFTER UPDATE OF status ON inventory_movements
  FOR EACH ROW EXECUTE FUNCTION apply_inventory_valuation();

CREATE OR REPLACE FUNCTION prevent_commercial_fiscal_link_change()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'La relación entre factura fiscal y documento comercial es inmutable.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_commercial_fiscal_link_immutable
  ON commercial_fiscal_document_links;
CREATE TRIGGER trg_commercial_fiscal_link_immutable
  BEFORE UPDATE OR DELETE ON commercial_fiscal_document_links
  FOR EACH ROW EXECUTE FUNCTION prevent_commercial_fiscal_link_change();

DO $$
DECLARE
  target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'commercial_document_sequences', 'accounting_entry_sequences',
    'commercial_account_mappings', 'inventory_valuation_balances',
    'commercial_fiscal_document_links'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_audit_row ON %I',
      target_table, target_table);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_audit_row AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_sensitive_row_change()',
      target_table, target_table
    );
  END LOOP;
END;
$$;
INSERT INTO schema_migrations (version) VALUES ('009') ON CONFLICT (version) DO NOTHING;
-- END 009_commercial_sales_integration.sql


-- BEGIN 010_erp_operations_and_employee_assets.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_company_id
  ON employees (company_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_entries_company_id
  ON journal_entries (company_id, id);

ALTER TABLE commercial_settlements
  ADD COLUMN IF NOT EXISTS cash_account_id TEXT;
ALTER TABLE commercial_settlements
  ADD COLUMN IF NOT EXISTS journal_entry_id TEXT;
ALTER TABLE commercial_settlements
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(20, 8)
  CHECK (exchange_rate IS NULL OR exchange_rate > 0);

CREATE OR REPLACE FUNCTION protect_commercial_settlement()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' THEN
      RAISE EXCEPTION 'Las cobranzas y pagos deben crearse como borrador.';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Las cobranzas y pagos se conservan; no se eliminan.';
  END IF;
  IF OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'Una cobranza o pago contabilizado es inmutable.';
  END IF;
  IF (NEW.company_id, NEW.id, NEW.settlement_type, NEW.party_id,
      NEW.settlement_date, NEW.currency_code, NEW.amount, NEW.exchange_rate,
      NEW.payment_method)
     IS DISTINCT FROM
     (OLD.company_id, OLD.id, OLD.settlement_type, OLD.party_id,
      OLD.settlement_date, OLD.currency_code, OLD.amount, OLD.exchange_rate,
      OLD.payment_method) THEN
    RAISE EXCEPTION 'No se puede cambiar la identidad ni los importes de la operación.';
  END IF;
  IF NEW.status NOT IN ('draft', 'posted', 'voided') THEN
    RAISE EXCEPTION 'Estado de cobranza o pago no permitido.';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
    AND NEW.status = 'posted'
    AND current_setting('app.commercial_settlement', TRUE) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Use post_commercial_settlement para contabilizar pagos y cobranzas.';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
    AND NOT (OLD.status = 'draft' AND NEW.status IN ('posted', 'voided')) THEN
    RAISE EXCEPTION 'Transición de cobranza o pago no permitida: % -> %.',
      OLD.status, NEW.status;
  END IF;
  IF NEW.status = 'voided' AND NULLIF(BTRIM(NEW.void_reason), '') IS NULL THEN
    RAISE EXCEPTION 'La anulación requiere un motivo.';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM business_party_roles AS bpr
      JOIN business_parties AS bp
        ON bp.company_id = bpr.company_id AND bp.id = bpr.party_id
      WHERE bpr.company_id = NEW.company_id
        AND bpr.party_id = NEW.party_id
        AND bpr.role = CASE NEW.settlement_type
          WHEN 'receivable' THEN 'customer' ELSE 'supplier' END
        AND bpr.active
        AND bp.active
  ) THEN
    RAISE EXCEPTION 'La contraparte no tiene un rol activo compatible con esta operación.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'commercial_settlements_cash_account_company_fk'
  ) THEN
    ALTER TABLE commercial_settlements
      ADD CONSTRAINT commercial_settlements_cash_account_company_fk
      FOREIGN KEY (company_id, cash_account_id)
      REFERENCES accounting_accounts (company_id, id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'commercial_settlements_journal_company_fk'
  ) THEN
    ALTER TABLE commercial_settlements
      ADD CONSTRAINT commercial_settlements_journal_company_fk
      FOREIGN KEY (company_id, journal_entry_id)
      REFERENCES journal_entries (company_id, id) ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_commercial_settlements_journal_entry
  ON commercial_settlements (company_id, journal_entry_id)
  WHERE journal_entry_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS employee_assets (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  asset_tag TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  serial_number TEXT NOT NULL DEFAULT '',
  condition_status TEXT NOT NULL DEFAULT 'good'
    CHECK (condition_status IN ('new', 'good', 'fair', 'damaged')),
  availability_status TEXT NOT NULL DEFAULT 'available'
    CHECK (availability_status IN ('available', 'maintenance', 'retired')),
  acquired_on DATE,
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, id),
  UNIQUE (company_id, asset_tag)
);
CREATE INDEX IF NOT EXISTS idx_employee_assets_company_status
  ON employee_assets (company_id, availability_status, asset_tag);

CREATE TABLE IF NOT EXISTS employee_asset_assignments (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expected_return_on DATE,
  returned_at TIMESTAMPTZ,
  condition_at_delivery TEXT NOT NULL
    CHECK (condition_at_delivery IN ('new', 'good', 'fair', 'damaged')),
  condition_at_return TEXT
    CHECK (condition_at_return IS NULL OR condition_at_return IN ('new', 'good', 'fair', 'damaged')),
  delivery_notes TEXT NOT NULL DEFAULT '',
  return_notes TEXT NOT NULL DEFAULT '',
  delivered_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  returned_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, asset_id)
    REFERENCES employee_assets (company_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (company_id, employee_id)
    REFERENCES employees (company_id, id) ON DELETE RESTRICT,
  CHECK (expected_return_on IS NULL OR expected_return_on >= delivered_at::DATE),
  CHECK (
    (returned_at IS NULL AND condition_at_return IS NULL AND returned_by IS NULL)
    OR (returned_at IS NOT NULL AND condition_at_return IS NOT NULL AND returned_by IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_asset_one_active_custodian
  ON employee_asset_assignments (company_id, asset_id)
  WHERE returned_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_employee_asset_assignments_employee
  ON employee_asset_assignments (company_id, employee_id, delivered_at DESC);

CREATE OR REPLACE FUNCTION protect_employee_asset_history()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'El historial de custodia no se elimina.';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.returned_at IS NOT NULL THEN
    RAISE EXCEPTION 'Una devolución registrada no se puede modificar.';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW.id IS DISTINCT FROM OLD.id
    OR NEW.company_id IS DISTINCT FROM OLD.company_id
    OR NEW.asset_id IS DISTINCT FROM OLD.asset_id
    OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
    OR NEW.delivered_at IS DISTINCT FROM OLD.delivered_at
    OR NEW.condition_at_delivery IS DISTINCT FROM OLD.condition_at_delivery
    OR NEW.delivered_by IS DISTINCT FROM OLD.delivered_by
  ) THEN
    RAISE EXCEPTION 'Los datos de entrega de un bien asignado son inmutables.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_employee_asset_assignment_history
  ON employee_asset_assignments;
CREATE TRIGGER trg_employee_asset_assignment_history
  BEFORE UPDATE OR DELETE ON employee_asset_assignments
  FOR EACH ROW EXECUTE FUNCTION protect_employee_asset_history();

CREATE OR REPLACE FUNCTION validate_employee_asset_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM employees
    WHERE company_id = NEW.company_id AND id = NEW.employee_id
      AND status <> 'egresado'
  ) THEN
    RAISE EXCEPTION 'Solo se puede asignar un bien a un empleado activo de la misma empresa.';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM employee_assets
    WHERE company_id = NEW.company_id AND id = NEW.asset_id
      AND availability_status = 'available'
  ) THEN
    RAISE EXCEPTION 'El bien no está disponible para asignación.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_employee_asset_assignment_validate
  ON employee_asset_assignments;
CREATE TRIGGER trg_employee_asset_assignment_validate
  BEFORE INSERT ON employee_asset_assignments
  FOR EACH ROW EXECUTE FUNCTION validate_employee_asset_assignment();

DO $$
DECLARE
  target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'employee_assets', 'employee_asset_assignments'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_audit_row AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_sensitive_row_change()',
      target_table, target_table
    );
  END LOOP;
END;
$$;
INSERT INTO schema_migrations (version) VALUES ('010') ON CONFLICT (version) DO NOTHING;
-- END 010_erp_operations_and_employee_assets.sql

COMMIT;
