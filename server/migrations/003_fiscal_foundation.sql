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
