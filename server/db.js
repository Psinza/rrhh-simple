const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// The DATABASE_URL (or POSTGRES_URL) will be used if provided, otherwise it will fail or try defaults.
// In Supabase, you can find the connection string and set it in your environment variables.
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false // Required for Supabase / Render connections usually
  }
});

// Helper to convert SQLite `?` params into Postgres `$1, $2, ...`
function replaceParams(sql) {
  let i = 1;
  return sql.replace(/\?/g, () => `$${i++}`);
}

async function runAsync(sql, params = []) {
  const pgSql = replaceParams(sql);
  const result = await pool.query(pgSql, params);
  return result;
}

async function allAsync(sql, params = []) {
  const pgSql = replaceParams(sql);
  const result = await pool.query(pgSql, params);
  return result.rows;
}

async function init() {
  if (!connectionString) {
    console.warn("WARNING: No DATABASE_URL or POSTGRES_URL found. Please set it to connect to Supabase.");
  }

  // Use runAsync with the postgres syntax for table creation
  await runAsync(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT,
    nombre TEXT,
    cargo TEXT,
    rol TEXT,
    rolTitulo TEXT,
    avatar TEXT,
    badgeColor TEXT,
    nivelAcceso TEXT,
    descripcionAcceso TEXT,
    permisos TEXT
  );`);

  // Employee file attachments are stored separately to keep the employee record
  // small and allow each document type to be queried independently.
  await runAsync(`CREATE TABLE IF NOT EXISTS employee_documents (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    document_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    data_url TEXT NOT NULL,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`);
  await runAsync(`CREATE INDEX IF NOT EXISTS idx_employee_documents_employee
    ON employee_documents (employee_id);`);

  await runAsync(`CREATE TABLE IF NOT EXISTS sales_records (
    id TEXT PRIMARY KEY,
    seller_id TEXT NOT NULL,
    seller_name TEXT NOT NULL,
    sale_date DATE NOT NULL,
    customer TEXT NOT NULL,
    reference TEXT NOT NULL,
    amount_bs NUMERIC(14, 2) NOT NULL CHECK (amount_bs >= 0),
    commission_percentage NUMERIC(7, 4) NOT NULL CHECK (commission_percentage >= 0),
    commission_bs NUMERIC(14, 2) NOT NULL CHECK (commission_bs >= 0),
    status TEXT NOT NULL DEFAULT 'Pendiente'
      CHECK (status IN ('Pendiente', 'Liquidada')),
    observations TEXT
  );`);
  await runAsync(`CREATE INDEX IF NOT EXISTS idx_sales_records_seller_date
    ON sales_records (seller_id, sale_date);`);

  await runAsync(`CREATE TABLE IF NOT EXISTS payroll_adjustments (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    payroll_period_id TEXT,
    overtime_day_hours NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (overtime_day_hours >= 0),
    overtime_night_hours NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (overtime_night_hours >= 0),
    travel_allowance_bs NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (travel_allowance_bs >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`);
  await runAsync(`CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_employee
    ON payroll_adjustments (employee_id, payroll_period_id);`);

  const seedUsers = [
      {
        id: 'user-admin',
        username: 'psinza',
        email: 'petersinza@gmail.com',
        password: 'Salamalenco23*',
        nombre: 'Ing. Pedro Sinza',
        cargo: 'Administrador de Sistemas & TI',
        rol: 'admin_sistema',
        rolTitulo: 'Administrador del Sistema',
        avatar: 'PS',
        badgeColor: 'bg-blue-600 text-white',
        nivelAcceso: 'Nivel 3 - Root TI & Ciberseguridad',
        descripcionAcceso: 'Control total sobre respaldos cifrados, base de datos ligera, auditoría forense, parámetros fiscales, tasas BCV y seguridad del sistema.',
        permisos: JSON.stringify([
          'Gestión de Base de Datos Ligera y Nube',
          'Gestión y Auditoría Forense',
          'Respaldos y Restauración Cifrada (AES-256 / SQL)',
          'Configuración de Empresa y Tasas BCV',
          'Monitoreo de Integridad del Sistema',
          'Acceso Global a Todos los Módulos',
          'Dashboard de RRHH y Dashboard de Dueño',
        ]),
      },
      {
        id: 'user-rrhh',
        username: 'rrhh',
        email: 'rrhh@talentove.com',
        password: 'rrhh2026**',
        nombre: 'Lic. Dubraska',
        cargo: 'Gerente de Recursos Humanos',
        rol: 'rrhh',
        rolTitulo: 'Gerente de RRHH',
        avatar: 'VS',
        badgeColor: 'bg-emerald-600 text-white',
        nivelAcceso: 'Nivel 2 - Gestión Operativa RRHH',
        descripcionAcceso: 'Control operativo integral de personal: expedientes 14-02, elaboración de nómina quincenal, prestaciones LOTTT y archivos parafiscales.',
        permisos: JSON.stringify([
          'Gestión de Expedientes y Ficha 14-02',
          'Cálculo Quincenal y Mensual de Nómina',
          'Generación y Firma Digital de Recibos LOTTT',
          'Liquidaciones y Fondo de Prestaciones (Art. 142)',
          'Generación TXT para IVSS TIUNA, FAOV y INCES',
          'Emisión de Constancias de Trabajo Oficiales',
        ]),
      },
      {
        id: 'user-dueno',
        username: 'jacobo',
        email: 'industriacouture@gmail.com',
        password: 'jacobo',
        nombre: 'JACOB AGAI BENZAQUEN',
        cargo: 'Director General & Propietario',
        rol: 'dueno',
        rolTitulo: 'Dueño de la Empresa',
        avatar: 'JA',
        badgeColor: 'bg-amber-600 text-white',
        nivelAcceso: 'Nivel 1 - Alta Dirección & Accionista',
        descripcionAcceso: 'Visión ejecutiva de costos laborales (Bs. y USD BCV), aprobación de nómina, supervisión de pasivos laborales acumulados y reportes financieros.',
        permisos: JSON.stringify([
          'Dashboard Ejecutivo con Costos BCV (USD / Bs.)',
          'Visualización del módulo de RRHH',
          'Visualización del módulo de Dueño',
          'Aprobación y Autorización de Desembolso de Nómina',
          'Supervisión de Pasivos Laborales y Fideicomiso',
          'Reporte Consolidado de Costo Empresa',
        ]),
      },
    ];

  for (const u of seedUsers) {
    const hash = await bcrypt.hash(u.password, 10);
    await runAsync(
      `INSERT INTO users (id, username, email, password_hash, nombre, cargo, rol, rolTitulo, avatar, badgeColor, nivelAcceso, descripcionAcceso, permisos)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
        username = EXCLUDED.username,
        email = EXCLUDED.email,
        password_hash = EXCLUDED.password_hash,
        nombre = EXCLUDED.nombre,
        cargo = EXCLUDED.cargo,
        rol = EXCLUDED.rol,
        rolTitulo = EXCLUDED.rolTitulo,
        avatar = EXCLUDED.avatar,
        badgeColor = EXCLUDED.badgeColor,
        nivelAcceso = EXCLUDED.nivelAcceso,
        descripcionAcceso = EXCLUDED.descripcionAcceso,
        permisos = EXCLUDED.permisos`,
      [
        u.id,
        u.username,
        u.email,
        hash,
        u.nombre,
        u.cargo,
        u.rol,
        u.rolTitulo,
        u.avatar,
        u.badgeColor,
        u.nivelAcceso,
        u.descripcionAcceso,
        u.permisos,
      ]
    );
  }
}

// Export db as pool just in case index.js references it, although we use runAsync/allAsync
module.exports = { db: pool, init, runAsync, allAsync };
