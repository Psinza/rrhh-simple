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
