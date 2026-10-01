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
