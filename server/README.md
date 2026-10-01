# Local PostgreSQL setup

This backend uses PostgreSQL on the same computer by default. The numbered SQL
migrations create and evolve the schema; running them does not yet move the
browser's existing `localStorage` data into PostgreSQL or connect every screen
to the API.

## 1. Install PostgreSQL

Install a supported PostgreSQL release for Windows or Linux and start its
database service. Keep the database bound to localhost for this single-machine
test.

Create a dedicated local role and database using `psql` as a PostgreSQL
administrator (replace the example password with a private value):

```sql
CREATE ROLE rrhh_simple LOGIN PASSWORD 'choose-a-local-password';
CREATE DATABASE rrhh_simple_local OWNER rrhh_simple;
```

## 2. Configure and install

From the project root, copy `.env.example` to `.env` and set `DATABASE_URL` to
the role, password, host, port, and database created above. Set `JWT_SECRET` to
a private random value of at least 32 characters. Do not commit `.env`.

Install the backend dependencies and apply the migrations:

```sh
npm ci --prefix server
npm run db:migrate
```

Migrations execute in filename order, each in its own transaction. The API does
not start if the database is unreachable or a migration fails.

## Supabase on Render

The Render service installs the backend's PostgreSQL driver and reads
`DATABASE_URL` as an unsynchronized secret. In the Render dashboard, set it to
the PostgreSQL connection string for the intended Supabase project. Prefer the
Supabase session pooler when the Render instance does not have IPv6 connectivity.
`DATABASE_SSL=true` is configured by the Render blueprint; do not put database
credentials in this repository or in frontend variables.

On server startup, `server/db.js` runs the numbered migrations before accepting
requests. It uses a PostgreSQL advisory lock and the `schema_migrations` table
to serialize startup and skip migrations already recorded as applied. A
connection or migration error prevents the server from starting. Render must
deploy a branch that contains the backend, migration files, and this blueprint
change for the database to be updated.

Before connecting an existing production database, take a backup and review
the migrations against its actual schema and data. These migrations evolve the
RR. HH. and ERP PostgreSQL schema; they are not a substitute for importing
existing browser `localStorage` data. Do not use `server/schema.sql` on an
existing database; it is only for a clean installation.

## Consolidated SQL for a clean installation

The numbered migrations remain the source of truth and are still applied
incrementally by `npm run db:migrate`. To regenerate their reproducible,
single-file equivalent, run:

```sh
npm run db:schema:build
```

This writes `server/schema.sql`, including migration-version records. Apply that
file only to a new, empty PostgreSQL database, for example with
`psql -v ON_ERROR_STOP=1 -d rrhh_simple_local -f server/schema.sql`. Do not use
the consolidated file to upgrade a database that already contains application
tables; use the migration runner so prior schema versions are respected.

## 3. Start and verify

```sh
npm run dev:server
```

Open `http://127.0.0.1:4000/health/db`; a successful response confirms the API
can query PostgreSQL. `npm run dev` starts the Vite frontend separately.

The schema covers companies, branches, users and role permissions, audit
events, employee records and related history/documents, payroll records,
internal product sales, basic accounting, a configurable fiscal foundation,
and an inventory ledger. Internal product sales remain separate from customer
invoices and commercial quotes. The inventory schema provides company-scoped
catalogs, warehouses and locations, lots and serials, stock balances, movement
history and count sheets. Posting a movement updates the balance in the same
PostgreSQL transaction; posted movements cannot be edited or deleted and can
be corrected with a linked inverse movement.

Migration `005_business_parties.sql` adds company-scoped customer and supplier
records, allowing one party to hold both roles, with separate contact and
address records. Tax identifiers are unique within a company when supplied.
These records and their related roles, contacts and addresses are deactivated
rather than hard-deleted. The current commercial API and screen use this foundation for customer setup and customer
sales documents. Supplier setup and purchase workflows are provided by the ERP
operations module.

Migration `006_commercial_documents_and_settlements.sql` adds the shared
commercial document model for purchase requests, supplier quotes and orders,
goods receipts, sales quotes and orders, delivery notes, and customer/supplier
invoices and adjustments. It records document lines and snapshots, links
documents across workflow stages, validates lifecycle transitions, preserves
an append-only event history, and blocks deletion or edits after approval.
Issuing a customer or supplier invoice creates its receivable/payable open
item. The `post_commercial_settlement` PostgreSQL function applies a recorded
payment or collection atomically to matching outstanding items.

The sales-document API and screen implement drafting quotes, converting them
to delivery notes or invoices, and issuing invoices. Migration 010 adds
supplier creation, purchase invoices and orders, supplier invoice posting,
payment/collection allocation and posting, bank statement-line import,
reconciliation matching and closing, financial reports with XLSX export, and
employee synchronization and asset-custody history. Purchase documents are
accounted for when posted; they do not automatically receive inventory or
create stock movements. Invoice issuance integrates with the existing fiscal,
inventory and accounting foundations as described for migration 009 below;
this does not constitute a statutory-compliance claim.

Migration `007_security_audit_sessions.sql` adds persisted, revocable JWT
sessions, append-only audit events with a per-company SHA-256 hash chain, and
automatic audit records for company, user/role, accounting, fiscal, commercial,
and selected employee-status changes. Password hashes and session-token hashes
are excluded from audit snapshots. Existing JWTs issued before this migration
do not have persisted sessions and require signing in again. Authenticated
server writes should use `runAsUserAsync` so the database records the acting
user and request IP in the same transaction.

The audit chain is tamper-evident, not tamper-proof: a PostgreSQL owner or
superuser can alter data or disable triggers. The verifier checks the current
database chain; it does not independently authenticate the server, and no
external anchoring or immutable backup is configured. This security
foundation does not establish SENIAT compliance, certification, or
homologation. The existing fiscal-series and document schema remains a
configuration foundation only; official numbering rules must be validated
against authoritative sources before production use.

The inventory movement and count-sheet schema is broader than the commercial
screens. Migration 009 adds weighted-average opening valuation and connects
supported sales dispatches to inventory valuation and accounting entries.
Purchasing documents currently post their expense/asset and tax lines to
accounting but are not integrated with goods receipts, warehouse administration,
count-sheet correction flows, or automatic stock movements.

Migration `008_bank_reconciliation.sql` adds company-scoped bank accounts,
deduplicated statement lines, reconciliation snapshots and one-to-one matches
to posted journal lines. It reuses the existing accounting accounts, journal
entries, users and audit trail instead of creating parallel ledgers or audit
tables. The account number is limited to its last four digits. Statement
fingerprints must be SHA-256 hex strings supplied by the importing service;
the database uniqueness constraint prevents importing the same fingerprint
twice for one bank account. Matching currently requires an exact amount and
opposite debit/credit direction, and supports one statement line per journal
line. A closed reconciliation can only be edited after it is explicitly
reopened. Migration 010 adds authenticated endpoints and a UI for statement-line import
and reconciliation matching. The API calculates the difference between the
reported statement balance and the posted ledger balance through the period
end, then recalculates it before closing and rejects a nonzero result.
Automatic bank feeds, currency conversion, and matching suggestions are not
included. Closing does not require every imported statement line to be matched;
a zero balance difference alone is not proof of reconciliation or audit
compliance.

Proposed tables for invoices, products, tax rates, withholdings, IGTF,
payments, users and audit were checked against the existing fiscal, inventory,
commercial-settlement and security schemas to avoid parallel models.
Migrations 009 and 010 connect the supported customer-sales, purchasing,
settlement, banking, financial-reporting and employee-asset workflows to these
foundations. The integrations do not provide SENIAT certification.

The authenticated operations API is mounted at `/api/erp`. Finance endpoints
for suppliers, purchases, settlements, bank accounts/reconciliations and
financial reports are restricted to `admin_sistema` and `dueno`. Employee
roster synchronization and employee-asset custody endpoints use HR role checks.
The `/bootstrap` endpoint returns accounting and banking data only to finance
roles; HR clients use the dedicated `/workforce/employees` and
`/workforce/assets` endpoints. Reports can return JSON or XLSX and are derived
from posted accounting entries. Reconciliation closing recalculates the
statement-versus-ledger balance difference, but does not independently ensure
all statement lines are matched.

Migration `009_commercial_sales_integration.sql` connects customer quotes,
delivery notes and invoices to the existing party, inventory, fiscal and
accounting foundations. The authenticated commercial API and its separate
front-end module support customer setup, quote drafting, document conversion,
invoice issuance, account mappings, weighted-average opening inventory
valuation and Excel export of commercial documents. Invoice emission requires
active reviewed fiscal configuration, a valid series, configured accounts,
customer fiscal data and sufficient initialized stock where a dispatch is
posted. These controls do not certify SENIAT compliance. The current screen is
limited to company owners and system administrators; the existing HR
“Ventas y Comisiones” screen remains a separate internal commission workflow.

## Fiscal foundation (phases 5–6)

Migration `003_fiscal_foundation.sql` adds versioned, company-scoped fiscal
configuration; configurable taxes and effective-dated rates; document series
and sequences; draft/issued fiscal documents and line snapshots; storage
foundations for withholdings, IGTF operations and purchase/sales books; an
append-only fiscal event chain; and a requirement/evidence matrix.

The TypeScript calculation service applies only explicitly configured rates
for an active, recorded-as-verified configuration. It uses integer minor units
and does not supply tax rates, legal interpretations, withholding rules, IGTF
rules or filing logic. The `verified` marker records an operator's review; it
does not independently authenticate a legal source. Currency precision and
exchange rates must be supplied by the caller. A foreign-currency document
requires an exchange-rate snapshot in the database, but this foundation does
not convert or revalue amounts.

These migrations and the calculation service are local development foundations,
not a fiscal integration or a claim of SENIAT compliance or homologation.
Official legal sources, requirements, tests and evidence must be reviewed
before enabling real fiscal document issuance. Event hashes are supplied by
the application service; this migration enforces event ordering and prevents
updates/deletes, but does not independently recompute or authenticate hashes.
The fiscal and inventory migrations have been exercised against disposable
PostgreSQL instances in development. That does not install them in your local
business database; run `npm run db:migrate` with the intended local connection
and back up existing data before applying new migrations.

Run the isolated configurable-calculation tests from the project root:

```sh
npm run test:fiscal
```
