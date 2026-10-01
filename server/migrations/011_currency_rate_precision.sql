ALTER TABLE currency_rates
  ALTER COLUMN rate TYPE NUMERIC(16, 8);

ALTER TABLE companies
  ALTER COLUMN bcv_usd_rate TYPE NUMERIC(16, 8);
