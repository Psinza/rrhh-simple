const fs = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const sslEnabled = /^(1|true|require)$/i.test(process.env.DATABASE_SSL || '');

const pool = new Pool({
  connectionString,
  ssl: sslEnabled
    ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' }
    : false,
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (error) => {
  console.error('Error inesperado en una conexión PostgreSQL inactiva:', error);
});

function replaceParams(sql) {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

async function runAsync(sql, params = []) {
  return pool.query(replaceParams(sql), params);
}

async function runAsUserAsync(userId, ipAddress, sql, params = []) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      "SELECT set_config('app.user_id', $1, TRUE), set_config('app.client_ip', $2, TRUE)",
      [userId, ipAddress || ''],
    );
    const result = await client.query(replaceParams(sql), params);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function allAsync(sql, params = []) {
  const result = await pool.query(replaceParams(sql), params);
  return result.rows;
}

async function init() {
  if (!connectionString) {
    throw new Error(
      'Falta DATABASE_URL. Configure la conexión a PostgreSQL local antes de iniciar el servidor.',
    );
  }

  const migrationsDirectory = path.join(__dirname, 'migrations');
  const migrationFiles = (await fs.readdir(migrationsDirectory))
    .filter((file) => /^\d{3}_[a-z0-9_]+\.sql$/i.test(file))
    .sort();
  const client = await pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [731_904_212]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    for (const file of migrationFiles) {
      const version = file.slice(0, file.indexOf('_'));
      const alreadyApplied = await client.query(
        'SELECT 1 FROM schema_migrations WHERE version = $1',
        [version],
      );
      if (alreadyApplied.rowCount > 0) continue;

      const migrationSql = await fs.readFile(path.join(migrationsDirectory, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(migrationSql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
        await client.query('COMMIT');
        console.info(`Migración PostgreSQL aplicada: ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Falló la migración ${file}: ${error.message}`, { cause: error });
      }
    }
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [731_904_212]);
    } finally {
      client.release();
    }
  }
}

module.exports = { db: pool, init, runAsync, runAsUserAsync, allAsync };
