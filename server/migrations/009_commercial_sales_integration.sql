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
