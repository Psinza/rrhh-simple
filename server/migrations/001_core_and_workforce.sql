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
