'use strict';
const { app, BrowserWindow, Menu, dialog, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { PgManager, getFreePort } = require('./pg-manager');
const { loadOrCreateSecrets } = require('./secrets');

const APP_NAME = 'RRHH Simple';
const PREFERRED_HTTP_PORT = 47821; // fijo cuando está libre: mantiene estable el origen del navegador embebido

let mainWindow = null;
let splash = null;
let pg = null;
let secrets = null;
let httpServer = null;
let serverModule = null;
let httpPort = null;
let appToken = crypto.randomBytes(24).toString('hex');
let quitting = false;
let windowFlushed = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Pide al frontend que envíe a PostgreSQL cualquier cambio pendiente (guardado con retardo de 0,7 s).
async function flushRenderer() {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      await Promise.race([
        mainWindow.webContents.executeJavaScript('window.__rrhhFlushState ? window.__rrhhFlushState() : null'),
        sleep(5000),
      ]);
    }
  } catch (e) { log('flushRenderer:', e); }
}

// ── Rutas ──────────────────────────────────────────────────────────────────
const userData = app.getPath('userData'); // %APPDATA%\RRHH Simple
const paths = {
  data: path.join(userData, 'pgdata'),
  logs: path.join(userData, 'logs'),
  secrets: path.join(userData, 'secrets.json'),
  pgLog: path.join(userData, 'logs', 'postgres.log'),
  appLog: path.join(userData, 'logs', 'app.log'),
  backups: path.join(app.getPath('documents'), 'RRHH Simple', 'Respaldos'),
};
const resourcesDir = app.isPackaged ? process.resourcesPath : path.join(__dirname, 'resources');
const pgBinDir = path.join(resourcesDir, 'pgsql', 'bin');
const staticDir = path.join(__dirname, 'dist');

function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.map((a) => (a && a.stack) || String(a)).join(' ')}\n`;
  try {
    fs.mkdirSync(paths.logs, { recursive: true });
    fs.appendFileSync(paths.appLog, line);
  } catch (_) { /* ignore */ }
  console.log(line.trim());
}

// ── Una sola instancia ─────────────────────────────────────────────────────
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ── Ventana de arranque ────────────────────────────────────────────────────
function showSplash(text) {
  const html = `<html><body style="margin:0;font-family:Segoe UI,Arial,sans-serif;background:#0f172a;color:#e2e8f0;
    display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;">
    <div style="font-size:22px;font-weight:700;letter-spacing:.5px">${APP_NAME}</div>
    <div style="margin-top:14px;font-size:13px;color:#94a3b8" id="t">${text}</div>
    <div style="margin-top:18px;width:180px;height:4px;background:#1e293b;border-radius:4px;overflow:hidden">
      <div style="width:40%;height:100%;background:#3b82f6;animation:m 1.1s ease-in-out infinite alternate"></div></div>
    <style>@keyframes m{from{margin-left:0}to{margin-left:60%}}</style></body></html>`;
  if (!splash) {
    splash = new BrowserWindow({ width: 420, height: 240, frame: false, resizable: false, show: true, alwaysOnTop: true,
      webPreferences: { contextIsolation: true, sandbox: true } });
  }
  splash.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
}

// ── Arranque del backend (PostgreSQL + API + frontend) ─────────────────────
async function startBackend() {
  fs.mkdirSync(paths.logs, { recursive: true });
  secrets = loadOrCreateSecrets(paths.secrets);
  pg = new PgManager({ binDir: pgBinDir, dataDir: paths.data, logFile: paths.pgLog });

  const firstRun = !pg.isInitialized();
  showSplash(firstRun ? 'Preparando la base de datos por primera vez (puede tardar un minuto)…' : 'Iniciando base de datos…');

  await pg.ensureCluster(secrets.dbPassword);
  const pgPort = await getFreePort(54329);
  await pg.start(pgPort);
  await pg.ensureDatabase(secrets.dbPassword);
  log('PostgreSQL listo en el puerto', pgPort);

  showSplash('Iniciando aplicación…');
  httpPort = await getFreePort(PREFERRED_HTTP_PORT);
  process.env.PORT = String(httpPort);
  process.env.DATABASE_URL = pg.connectionString(secrets.dbPassword);
  process.env.JWT_SECRET = secrets.jwtSecret;
  process.env.APP_TOKEN = appToken;
  process.env.SERVE_STATIC = 'true';
  process.env.STATIC_DIR = staticDir;
  process.env.NODE_ENV = 'desktop';

  serverModule = require('./server/index.js');
  httpServer = await serverModule.start();
  log('Servidor HTTP listo en el puerto', httpPort);
}

async function shutdownBackend() {
  try {
    if (pg && pg.port && secrets) {
      const stamp = new Date().toISOString().slice(0, 10);
      const file = path.join(paths.backups, `auto-${stamp}.dump`);
      await pg.backup(file, secrets.dbPassword); // un respaldo por día (se sobrescribe el del mismo día)
      pruneBackups();
    }
  } catch (e) { log('Respaldo automático falló:', e); }
  try { if (serverModule) await serverModule.stop(httpServer); } catch (e) { log('Error al detener servidor:', e); }
  try { if (pg) await pg.stop(); } catch (e) { log('Error al detener PostgreSQL:', e); }
}

function pruneBackups(keep = 15) {
  try {
    const files = fs.readdirSync(paths.backups).filter((f) => /^auto-.*\.dump$/.test(f)).sort();
    files.slice(0, Math.max(0, files.length - keep)).forEach((f) => fs.unlinkSync(path.join(paths.backups, f)));
  } catch (_) { /* ignore */ }
}

// ── Ventana principal ──────────────────────────────────────────────────────
function createWindow() {
  const origin = `http://127.0.0.1:${httpPort}`;
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: [`${origin}/*`] }, (details, cb) => {
    details.requestHeaders['X-App-Token'] = appToken;
    cb({ requestHeaders: details.requestHeaders });
  });

  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1024, minHeight: 700, show: false, title: APP_NAME,
    backgroundColor: '#0f172a',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(origin)) { e.preventDefault(); if (/^https?:\/\//i.test(url)) shell.openExternal(url); }
  });
  mainWindow.once('ready-to-show', () => {
    if (splash) { splash.close(); splash = null; }
    mainWindow.maximize();
    mainWindow.show();
  });
  mainWindow.on('close', (e) => {
    if (windowFlushed) return;
    e.preventDefault();
    flushRenderer().finally(() => { windowFlushed = true; if (mainWindow) mainWindow.close(); });
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.loadURL(origin + '/');
}

// ── Menú ───────────────────────────────────────────────────────────────────
async function menuBackup() {
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Guardar respaldo de la base de datos',
    defaultPath: path.join(app.getPath('documents'), `RRHH-Simple-respaldo-${stamp}.dump`),
    filters: [{ name: 'Respaldo RRHH Simple', extensions: ['dump'] }],
  });
  if (canceled || !filePath) return;
  try {
    await pg.backup(filePath, secrets.dbPassword);
    dialog.showMessageBox(mainWindow, { type: 'info', message: 'Respaldo creado correctamente.', detail: filePath });
  } catch (e) {
    log(e);
    dialog.showErrorBox('No se pudo crear el respaldo', String(e.stderr || e.message));
  }
}

async function menuRestore() {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar respaldo a restaurar',
    filters: [{ name: 'Respaldo RRHH Simple', extensions: ['dump'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths[0]) return;
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning', buttons: ['Cancelar', 'Restaurar'], defaultId: 0, cancelId: 0,
    message: '¿Restaurar este respaldo?',
    detail: 'Se reemplazarán TODOS los datos actuales por los del respaldo. Se guardará antes una copia automática de los datos actuales.',
  });
  if (response !== 1) return;
  try {
    await pg.backup(path.join(paths.backups, `antes-de-restaurar-${Date.now()}.dump`), secrets.dbPassword);
    await pg.restore(filePaths[0], secrets.dbPassword);
    mainWindow.webContents.executeJavaScript('try{localStorage.removeItem("rrhh_simple_database_v3")}catch(e){}').catch(() => {});
    mainWindow.reload();
    dialog.showMessageBox(mainWindow, { type: 'info', message: 'Respaldo restaurado correctamente.' });
  } catch (e) {
    log(e);
    dialog.showErrorBox('No se pudo restaurar el respaldo', String(e.stderr || e.message));
  }
}

function buildMenu() {
  const template = [
    { label: 'Archivo', submenu: [
      { label: 'Respaldar base de datos…', click: menuBackup },
      { label: 'Restaurar respaldo…', click: menuRestore },
      { type: 'separator' },
      { label: 'Abrir carpeta de respaldos automáticos', click: () => { fs.mkdirSync(paths.backups, { recursive: true }); shell.openPath(paths.backups); } },
      { label: 'Abrir carpeta de registros (logs)', click: () => shell.openPath(paths.logs) },
      { type: 'separator' },
      { role: 'quit', label: 'Salir' },
    ] },
    { label: 'Ver', submenu: [
      { role: 'reload', label: 'Recargar' }, { role: 'togglefullscreen', label: 'Pantalla completa' },
      { type: 'separator' }, { role: 'resetZoom', label: 'Zoom 100%' }, { role: 'zoomIn', label: 'Acercar' }, { role: 'zoomOut', label: 'Alejar' },
    ] },
    { label: 'Ayuda', submenu: [
      { label: `Acerca de ${APP_NAME}`, click: () => dialog.showMessageBox(mainWindow, { type: 'info', message: APP_NAME, detail: `Versión ${app.getVersion()}\nBase de datos: PostgreSQL local\nDatos en: ${paths.data}` }) },
    ] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Ciclo de vida ──────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  try {
    buildMenu();
    await startBackend();
    createWindow();
  } catch (e) {
    log('Fallo al iniciar:', e);
    if (splash) { splash.close(); splash = null; }
    dialog.showErrorBox(
      `${APP_NAME} no pudo iniciar`,
      `${e.message || e}\n\nRevise el registro en:\n${paths.logs}`
    );
    try { if (pg) await pg.stop(); } catch (_) { /* ignore */ }
    app.exit(1);
  }
});

app.on('window-all-closed', () => app.quit());

app.on('before-quit', (e) => {
  if (quitting) return;
  e.preventDefault();
  quitting = true;
  (async () => {
    await flushRenderer();
    if (mainWindow) mainWindow.hide();
    showSplash('Guardando y cerrando base de datos…');
    await shutdownBackend();
    app.exit(0);
  })();
});
