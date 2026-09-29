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
