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
