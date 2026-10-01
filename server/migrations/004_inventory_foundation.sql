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
