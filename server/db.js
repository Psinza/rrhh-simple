const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const DB_PATH = path.join(__dirname, 'data', 'db.sqlite');
const fs = require('fs');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ensureDir(path.join(__dirname, 'data'));

const db = new sqlite3.Database(DB_PATH);

function runAsync(sql, params = []) {
  return new Promise((res, rej) => {
    db.run(sql, params, function (err) {
      if (err) rej(err);
      else res(this);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((res, rej) => {
    db.all(sql, params, (err, rows) => {
      if (err) rej(err);
      else res(rows);
    });
  });
}

async function init() {
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

  const seedUsers = [
      {
        id: 'user-admin',
        username: 'psinza',
        email: 'petersinza@gmail.com',
        password: 'psinza',
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
        password: 'rrhh',
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
        username = excluded.username,
        email = excluded.email,
        password_hash = excluded.password_hash,
        nombre = excluded.nombre,
        cargo = excluded.cargo,
        rol = excluded.rol,
        rolTitulo = excluded.rolTitulo,
        avatar = excluded.avatar,
        badgeColor = excluded.badgeColor,
        nivelAcceso = excluded.nivelAcceso,
        descripcionAcceso = excluded.descripcionAcceso,
        permisos = excluded.permisos`,
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

module.exports = { db, init, runAsync, allAsync };
