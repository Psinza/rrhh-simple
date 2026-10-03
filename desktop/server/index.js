const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { init, allAsync, runAsync, getAppState, saveAppState, close: closeDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_with_secure_secret';

// Configure CORS dynamically. In production set ALLOWED_ORIGIN to your frontend URL (e.g. https://rrhh-simple.onrender.com)
const allowedOrigin = process.env.ALLOWED_ORIGIN || true;
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json({ limit: '100mb' })); // el estado incluye expedientes/adjuntos en base64

// Protección de escritorio: solo la ventana de la aplicación conoce este token (lo inyecta Electron),
// así otro programa o navegador del mismo equipo no puede leer los datos de nómina.
const APP_TOKEN = process.env.APP_TOKEN || '';
app.use((req, res, next) => {
  if (!APP_TOKEN) return next();
  if (req.headers['x-app-token'] === APP_TOKEN) return next();
  return res.status(403).send('Acceso restringido a la aplicación de escritorio.');
});
app.use(cookieParser());

const path = require('path');
const staticPath = process.env.STATIC_DIR || path.join(__dirname, '..', 'dist');

// Serve static frontend when running as a single fullstack service (recommended for Render).
// The SPA fallback is registered after API routes so /api/me and other GET APIs are not shadowed.
if (process.env.SERVE_STATIC === 'true') {
  app.use(express.static(staticPath));
}


// Helpers
function signUserPayload(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      rol: user.rol,
      nombre: user.nombre,
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

function authMiddleware(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No user' });
    if (req.user.rol !== role) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

// Routes
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'rrhh-simple' });
});

app.post('/api/login', async (req, res) => {
  const { identifier, password, selectedRole } = req.body;
  if (!identifier || !password) return res.status(400).json({ error: 'Missing credentials' });
  try {
    const rows = await allAsync('SELECT * FROM users WHERE lower(username)=lower(?) OR lower(email)=lower(?) LIMIT 1', [identifier, identifier]);
    if (!rows || rows.length === 0) return res.status(401).json({ error: 'Credenciales inválidas' });
    const user = rows[0];
    const bcrypt = require('bcryptjs');
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Credenciales inválidas' });
    if (selectedRole && user.rol !== selectedRole) return res.status(403).json({ error: 'Rol no coincide con perfil seleccionado' });

    const token = signUserPayload(user);
    // Cookie security options: use secure & sameSite none in production when serving across domains
    const cookieOptions = { httpOnly: true, sameSite: 'lax' }; // http://127.0.0.1: sin 'secure'
    res.cookie('token', token, cookieOptions);
    // Return safe user info
    const safe = {
      id: user.id,
      username: user.username,
      email: user.email,
      nombre: user.nombre,
      cargo: user.cargo,
      rol: user.rol,
      rolTitulo: user.rolTitulo,
      avatar: user.avatar,
      badgeColor: user.badgeColor,
      nivelAcceso: user.nivelAcceso,
      descripcionAcceso: user.descripcionAcceso,
      permisos: JSON.parse(user.permisos || '[]'),
    };
    res.json({ user: safe });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

app.get('/api/me', authMiddleware, async (req, res) => {
  const id = req.user.id;
  const rows = await allAsync('SELECT id, username, email, nombre, cargo, rol, rolTitulo, avatar, badgeColor, nivelAcceso, descripcionAcceso, permisos FROM users WHERE id = ? LIMIT 1', [id]);
  if (!rows || rows.length === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ user: { ...rows[0], permisos: JSON.parse(rows[0].permisos || '[]') } });
});

// Admin: list users
app.get('/api/users', authMiddleware, async (req, res) => {
  if (req.user.rol !== 'admin_sistema') return res.status(403).json({ error: 'Forbidden' });
  const rows = await allAsync('SELECT id, username, email, nombre, rol, rolTitulo, avatar, badgeColor FROM users');
  res.json({ users: rows });
});

// Admin: create user
app.post('/api/users', authMiddleware, async (req, res) => {
  if (req.user.rol !== 'admin_sistema') return res.status(403).json({ error: 'Forbidden' });
  const u = req.body;
  if (!u.username || !u.password || !u.rol) return res.status(400).json({ error: 'Missing fields' });
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash(u.password, 10);
  const id = u.id || `user-${Date.now()}`;
  try {
    await runAsync('INSERT INTO users (id, username, email, password_hash, nombre, cargo, rol, rolTitulo, avatar, badgeColor, nivelAcceso, descripcionAcceso, permisos) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', [
      id,
      u.username,
      u.email || null,
      hash,
      u.nombre || '',
      u.cargo || '',
      u.rol,
      u.rolTitulo || '',
      u.avatar || '',
      u.badgeColor || '',
      u.nivelAcceso || '',
      u.descripcionAcceso || '',
      JSON.stringify(u.permisos || []),
    ]);
    res.json({ ok: true, id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Admin: update user
app.put('/api/users/:id', authMiddleware, async (req, res) => {
  if (req.user.rol !== 'admin_sistema') return res.status(403).json({ error: 'Forbidden' });
  const id = req.params.id;
  const u = req.body;
  try {
    if (u.password) {
    const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash(u.password, 10);
      await runAsync('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
    }
    const fields = ['username','email','nombre','cargo','rol','rolTitulo','avatar','badgeColor','nivelAcceso','descripcionAcceso'];
    for (const f of fields) {
      if (u[f] !== undefined) {
        await runAsync(`UPDATE users SET ${f} = ? WHERE id = ?`, [u[f], id]);
      }
    }
    if (u.permisos) {
      await runAsync('UPDATE users SET permisos = ? WHERE id = ?', [JSON.stringify(u.permisos), id]);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Admin delete
app.delete('/api/users/:id', authMiddleware, async (req, res) => {
  if (req.user.rol !== 'admin_sistema') return res.status(403).json({ error: 'Forbidden' });
  const id = req.params.id;
  try {
    await runAsync('DELETE FROM users WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Protected action example: approve payroll (only dueno or admin)
app.post('/api/payroll/approve', authMiddleware, async (req, res) => {
  if (req.user.rol !== 'dueno' && req.user.rol !== 'admin_sistema') return res.status(403).json({ error: 'Forbidden' });
  // In this simple server we just acknowledge
  res.json({ ok: true, approvedBy: req.user });
});

// Protected action example: delete employee (admin)
app.post('/api/employees/:id/delete', authMiddleware, async (req, res) => {
  if (req.user.rol !== 'admin_sistema') return res.status(403).json({ error: 'Forbidden' });
  // This implementation is front-end/state only. A real implementation would modify employees table.
  res.json({ ok: true, deletedId: req.params.id });
});

// ── Persistencia del estado completo de la aplicación en PostgreSQL ──
app.get('/api/state', async (req, res) => {
  try {
    const row = await getAppState();
    if (!row) return res.status(404).json({ error: 'Sin estado guardado' });
    res.json({ state: row.data, updatedAt: row.updated_at });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudo leer el estado' });
  }
});

app.put('/api/state', async (req, res) => {
  const state = req.body && req.body.state;
  if (!state || typeof state !== 'object') return res.status(400).json({ error: 'Estado inválido' });
  try {
    await saveAppState(state);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudo guardar el estado' });
  }
});

if (process.env.SERVE_STATIC === 'true') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
}

async function start() {
  await init();
  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, '127.0.0.1', () => {
      console.log(`RRHH Simple escuchando en 127.0.0.1:${PORT}`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

async function stop(server) {
  if (server) await new Promise((r) => server.close(r));
  await closeDb();
}

module.exports = { start, stop };
