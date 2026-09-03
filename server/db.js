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

<<<<<<< HEAD
  const seedUsers = [
      {
        id: 'user-admin',
        username: 'psinza',
        email: 'petersinza@gmail.com',
        password: 'psinza',
=======
  const existing = await allAsync('SELECT COUNT(1) as c FROM users');
  if (existing && existing[0] && existing[0].c === 0) {
    // Seed default users
    const seedUsers = [
      {
        id: 'user-admin',
        username: 'admin',
        email: 'petersinza@gmail.com',
        password: 'admin',
>>>>>>> fb5f23abb61f2ec94b04b0cbd565dcf57c3185af
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
<<<<<<< HEAD
          'Dashboard de RRHH y Dashboard de Dueño',
=======
>>>>>>> fb5f23abb61f2ec94b04b0cbd565dcf57c3185af
        ]),
      },
      {
        id: 'user-rrhh',
        username: 'rrhh',
        email: 'rrhh@talentove.com',
        password: 'rrhh',
        nombre: 'Lic. Valentina Silva',
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
        username: 'dueno',
        email: 'dueno@talentove.com',
        password: 'dueno',
<<<<<<< HEAD
        nombre: 'Dueño de la Empresa',
        cargo: 'Dirección General & Propietario',
=======
        nombre: 'Dr. Alejandro Ramos',
        cargo: 'Director General & Propietario',
>>>>>>> fb5f23abb61f2ec94b04b0cbd565dcf57c3185af
        rol: 'dueno',
        rolTitulo: 'Dueño / Propietario',
        avatar: 'AR',
        badgeColor: 'bg-amber-600 text-white',
        nivelAcceso: 'Nivel 1 - Alta Dirección & Accionista',
        descripcionAcceso: 'Visión ejecutiva de costos laborales (Bs. y USD BCV), aprobación de nómina, supervisión de pasivos laborales acumulados y reportes financieros.',
        permisos: JSON.stringify([
          'Dashboard Ejecutivo con Costos BCV (USD / Bs.)',
<<<<<<< HEAD
          'Visualización del módulo de RRHH',
=======
>>>>>>> fb5f23abb61f2ec94b04b0cbd565dcf57c3185af
          'Aprobación y Autorización de Desembolso de Nómina',
          'Supervisión de Pasivos Laborales y Fideicomiso',
          'Auditoría Financiera de Parafiscales (IVSS/FAOV/INCES)',
          'Reporte Consolidado de Costo Empresa',
        ]),
      },
    ];

<<<<<<< HEAD
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
=======
    for (const u of seedUsers) {
      const hash = await bcrypt.hash(u.password, 10);
      await runAsync(
        `INSERT INTO users (id, username, email, password_hash, nombre, cargo, rol, rolTitulo, avatar, badgeColor, nivelAcceso, descripcionAcceso, permisos) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
>>>>>>> fb5f23abb61f2ec94b04b0cbd565dcf57c3185af
  }
}

module.exports = { db, init, runAsync, allAsync };
