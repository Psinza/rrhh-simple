'use strict';
/**
 * Administra un PostgreSQL "portable" (binarios de EDB) embebido en la aplicación:
 * crea el clúster la primera vez, lo arranca/detiene y crea la base de datos.
 * No usa Electron: se puede probar con `node` directamente.
 */
const { execFile, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');
const { Client } = require('pg');

const IS_WIN = process.platform === 'win32';

function getFreePort(preferred) {
  const tryPort = (port) =>
    new Promise((resolve) => {
      const srv = net.createServer();
      srv.once('error', () => resolve(null));
      srv.once('listening', () => srv.close(() => resolve(port)));
      srv.listen(port, '127.0.0.1');
    });
  return (async () => {
    if (preferred) {
      const ok = await tryPort(preferred);
      if (ok) return ok;
    }
    return new Promise((resolve, reject) => {
      const srv = net.createServer();
      srv.once('error', reject);
      srv.listen(0, '127.0.0.1', () => {
        const { port } = srv.address();
        srv.close(() => resolve(port));
      });
    });
  })();
}

class PgManager {
  /**
   * @param {{binDir:string, dataDir:string, logFile:string, user?:string, dbName?:string, socketDir?:string}} opts
   */
  constructor(opts) {
    this.binDir = opts.binDir;
    this.dataDir = opts.dataDir;
    this.logFile = opts.logFile;
    this.user = opts.user || 'rrhh_admin';
    this.dbName = opts.dbName || 'rrhh';
    this.socketDir = opts.socketDir || null; // solo Linux/macOS (pruebas)
    this.port = null;
  }

  bin(name) {
    return path.join(this.binDir, IS_WIN ? `${name}.exe` : name);
  }

  run(name, args, extra = {}) {
    return new Promise((resolve, reject) => {
      execFile(
        this.bin(name),
        args,
        { windowsHide: true, maxBuffer: 20 * 1024 * 1024, ...extra },
        (err, stdout, stderr) => {
          if (err) {
            err.stdout = stdout;
            err.stderr = stderr;
            return reject(err);
          }
          resolve({ stdout, stderr });
        }
      );
    });
  }

  /**
   * Ejecuta un binario sin canalizaciones (stdio 'ignore') y espera al evento 'exit'.
   * Necesario para `pg_ctl start`: en Windows el servidor hereda las tuberías de pg_ctl y
   * execFile nunca terminaría (se quedaba cargando) porque espera a que esas tuberías se cierren.
   */
  runDetached(name, args) {
    return new Promise((resolve, reject) => {
      const child = spawn(this.bin(name), args, { stdio: 'ignore', windowsHide: true });
      child.once('error', reject);
      child.once('exit', (code) => {
        if (code === 0) return resolve();
        const err = new Error(`${name} terminó con código ${code}`);
        err.code = code;
        reject(err);
      });
    });
  }

  hasBinaries() {
    return fs.existsSync(this.bin('postgres')) && fs.existsSync(this.bin('pg_ctl')) && fs.existsSync(this.bin('initdb'));
  }

  isInitialized() {
    return fs.existsSync(path.join(this.dataDir, 'PG_VERSION'));
  }

  /** Crea el clúster de datos si no existe. */
  async ensureCluster(password) {
    if (!this.hasBinaries()) {
      throw new Error(`No se encontraron los binarios de PostgreSQL en: ${this.binDir}`);
    }
    if (this.isInitialized()) return false;

    fs.mkdirSync(path.dirname(this.dataDir), { recursive: true });
    const pwFile = path.join(path.dirname(this.dataDir), '.pgpw.tmp');
    fs.writeFileSync(pwFile, password, { mode: 0o600 });
    try {
      await this.run('initdb', [
        '-D', this.dataDir,
        '-U', this.user,
        '-E', 'UTF8',
        '--locale=C',
        '-A', 'scram-sha-256',
        `--pwfile=${pwFile}`,
      ]);
    } finally {
      try { fs.unlinkSync(pwFile); } catch (_) { /* ignore */ }
    }

    // Ajustes ligeros para un equipo de oficina con un solo usuario
    fs.appendFileSync(
      path.join(this.dataDir, 'postgresql.conf'),
      [
        '',
        '# --- RRHH Simple ---',
        "listen_addresses = '127.0.0.1'",
        'max_connections = 30',
        'shared_buffers = 128MB',
        'logging_collector = off',
        "timezone = 'America/Caracas'",
        '',
      ].join('\n')
    );
    return true;
  }

  async isRunning() {
    try {
      await this.run('pg_ctl', ['status', '-D', this.dataDir]);
      return true;
    } catch (_) {
      return false;
    }
  }

  async start(port) {
    // Si quedó una instancia viva de una sesión anterior (cierre abrupto), se detiene primero.
    if (await this.isRunning()) await this.stop();

    this.port = port;
    // pg_ctl redirige su salida a este archivo; si la carpeta no existe, Windows responde
    // "El sistema no puede encontrar la ruta especificada".
    fs.mkdirSync(path.dirname(this.logFile), { recursive: true });
    let opts = `-p ${port}`;
    if (this.socketDir) {
      fs.mkdirSync(this.socketDir, { recursive: true });
      opts += ` -c unix_socket_directories=${this.socketDir}`;
    }
    try {
      await this.runDetached('pg_ctl', [
        'start', '-D', this.dataDir, '-l', this.logFile, '-w', '-t', '90', '-o', opts,
      ]);
    } catch (err) {
      let tail = '';
      try { tail = fs.readFileSync(this.logFile, 'utf8').split('\n').slice(-15).join('\n'); } catch (_) { /* ignore */ }
      err.message = `PostgreSQL no pudo iniciar.\n${err.message}\n${tail}`;
      throw err;
    }
  }

  async stop() {
    try {
      await this.run('pg_ctl', ['stop', '-D', this.dataDir, '-m', 'fast', '-w', '-t', '60']);
    } catch (_) {
      /* ya estaba detenido */
    }
  }

  connectionConfig(password, database) {
    return {
      host: '127.0.0.1',
      port: this.port,
      user: this.user,
      password,
      database: database || this.dbName,
    };
  }

  connectionString(password) {
    const enc = encodeURIComponent;
    return `postgresql://${enc(this.user)}:${enc(password)}@127.0.0.1:${this.port}/${this.dbName}`;
  }

  /** Crea la base de datos de la aplicación si no existe. */
  async ensureDatabase(password) {
    const client = new Client(this.connectionConfig(password, 'postgres'));
    await client.connect();
    try {
      const r = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [this.dbName]);
      if (r.rowCount === 0) {
        await client.query(`CREATE DATABASE "${this.dbName}" ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C'`);
        return true;
      }
      return false;
    } finally {
      await client.end();
    }
  }

  connEnv(password) {
    return { ...process.env, PGPASSWORD: password };
  }

  /** Respaldo completo en formato personalizado (.dump) */
  async backup(file, password) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await this.run(
      'pg_dump',
      ['-h', '127.0.0.1', '-p', String(this.port), '-U', this.user, '-Fc', '-f', file, this.dbName],
      { env: this.connEnv(password) }
    );
  }

  /** Restaura un respaldo .dump reemplazando el contenido actual. */
  async restore(file, password) {
    await this.run(
      'pg_restore',
      ['-h', '127.0.0.1', '-p', String(this.port), '-U', this.user, '-d', this.dbName, '--clean', '--if-exists', '--no-owner', file],
      { env: this.connEnv(password) }
    );
  }
}

module.exports = { PgManager, getFreePort };
