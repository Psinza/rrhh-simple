const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const readline = require('node:readline');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcrypt');
const { db, init } = require('./db');

function ask(question) {
  return new Promise((resolve) => {
    const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
    prompt.question(question, (answer) => {
      prompt.close();
      resolve(answer.trim());
    });
  });
}

function askSecret(question) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('Este comando requiere una terminal interactiva. En Docker use: docker compose exec -it app node server/bootstrap-admin.js');
  }

  return new Promise((resolve, reject) => {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdout.write(question);
    let value = '';

    const finish = (error) => {
      process.stdin.removeListener('keypress', onKeypress);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };

    const onKeypress = (character, key = {}) => {
      if (key.ctrl && key.name === 'c') {
        finish(new Error('Operación cancelada.'));
      } else if (key.name === 'return' || key.name === 'enter') {
        finish();
      } else if (key.name === 'backspace') {
        value = value.slice(0, -1);
      } else if (character && !key.ctrl && !key.meta) {
        value += character;
      }
    };

    process.stdin.on('keypress', onKeypress);
  });
}

async function main() {
  try {
    if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
      throw new Error('Falta DATABASE_URL. Ejecute este comando desde el paquete local.');
    }

    await init();
    console.log('Configuración del primer administrador local. No se mostrarán ni guardarán contraseñas en archivos.');
    const companyRif = await ask('RIF de la empresa (el mismo configurado en la aplicación): ');
    const legalName = await ask('Razón social de la empresa: ');
    const username = (await ask('Nombre de usuario para el administrador: ')).toLowerCase();
    const email = (await ask('Correo del administrador: ')).toLowerCase();
    const nombre = await ask('Nombre completo del administrador: ');
    const password = await askSecret('Contraseña nueva (mínimo 12 caracteres): ');
    const confirmation = await askSecret('Repita la contraseña: ');

    if (!companyRif || !legalName || !username || !email || !nombre) {
      throw new Error('Todos los campos son obligatorios.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('El correo no tiene un formato válido.');
    }
    if (password.length < 12 || password.length > 128) {
      throw new Error('La contraseña debe tener entre 12 y 128 caracteres.');
    }
    if (password !== confirmation) {
      throw new Error('Las contraseñas no coinciden.');
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [731904213]);

      const userCount = await client.query('SELECT COUNT(*)::INTEGER AS count FROM users');
      if (userCount.rows[0].count !== 0) {
        throw new Error('Ya existen usuarios en esta base de datos. El alta inicial está deshabilitada.');
      }

      const companyResult = await client.query(
        `SELECT id, active
       FROM companies
       WHERE UPPER(REGEXP_REPLACE(rif, '[^A-Za-z0-9]', '', 'g'))
         = UPPER(REGEXP_REPLACE($1, '[^A-Za-z0-9]', '', 'g'))
       LIMIT 1`,
        [companyRif],
      );
      let companyId;
      if (companyResult.rowCount > 0) {
        if (!companyResult.rows[0].active) {
          throw new Error('La empresa indicada existe, pero está inactiva. No se modificó.');
        }
        companyId = companyResult.rows[0].id;
      } else {
        companyId = randomUUID();
        await client.query(
          'INSERT INTO companies (id, rif, legal_name) VALUES ($1, $2, $3)',
          [companyId, companyRif, legalName],
        );
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const userId = randomUUID();
      await client.query(
        `INSERT INTO users (
           id, username, email, password_hash, nombre, cargo, rol, roltitulo,
           avatar, badgecolor, nivelacceso, descripcionacceso, permisos, company_id
         )
         VALUES ($1, $2, $3, $4, $5, 'Administrador local', 'admin_sistema',
           'Administrador del Sistema', $6, 'bg-blue-600 text-white',
           'Administrador local', 'Cuenta inicial de administración local',
           '["Acceso Global a Todos los Módulos"]'::JSONB, $7)`,
        [
          userId,
          username,
          email,
          passwordHash,
          nombre,
          nombre.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
          companyId,
        ],
      );

      await client.query('COMMIT');
      console.log(`Administrador local creado. Inicie sesión con el usuario "${username}".`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(`No se creó el administrador: ${error.message}`);
  process.exitCode = 1;
});
