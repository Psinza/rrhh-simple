'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

async function buildSchema() {
  const migrationsDirectory = path.join(__dirname, 'migrations');
  const migrationFiles = (await fs.readdir(migrationsDirectory))
    .filter((file) => /^\d{3}_[a-z0-9_]+\.sql$/i.test(file))
    .sort();

  if (migrationFiles.length === 0) {
    throw new Error('No se encontraron migraciones SQL para consolidar.');
  }

  const sections = [
    '-- GENERATED FILE: run `npm run db:schema:build` to recreate this clean-install schema.',
    '-- Apply only to a new, empty database. Existing databases must use `npm run db:migrate`.',
    'BEGIN;',
    'CREATE TABLE IF NOT EXISTS schema_migrations (',
    '  version TEXT PRIMARY KEY,',
    '  applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP',
    ');',
  ];

  for (const file of migrationFiles) {
    const version = file.slice(0, file.indexOf('_'));
    const sql = await fs.readFile(path.join(migrationsDirectory, file), 'utf8');
    sections.push(
      `\n-- BEGIN ${file}\n${sql.trimEnd()}\n` +
      `INSERT INTO schema_migrations (version) VALUES ('${version}') ON CONFLICT (version) DO NOTHING;\n` +
      `-- END ${file}`,
    );
  }

  sections.push('COMMIT;');
  const output = `${sections.join('\n\n')}\n`;
  await fs.writeFile(path.join(__dirname, 'schema.sql'), output, 'utf8');
  process.stdout.write(`Esquema consolidado generado desde ${migrationFiles.length} migraciones: server/schema.sql\n`);
}

buildSchema().catch((error) => {
  console.error('No se pudo generar el esquema SQL consolidado:', error);
  process.exitCode = 1;
});
