const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { init, allAsync, runAsync, db } = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_with_secure_secret';

// Configure CORS dynamically. In production set ALLOWED_ORIGIN to your frontend URL (e.g. https://rrhh-simple.onrender.com)
const allowedOrigin = process.env.ALLOWED_ORIGIN || true;
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());

const path = require('path');
const staticPath = path.join(__dirname, '..', 'dist');

// Serve static frontend when running as a single fullstack service (recommended for Render).
// The SPA fallback is registered after API routes so /api/me and other GET APIs are not shadowed.
if (process.env.SERVE_STATIC === 'true') {
  app.use(express.static(staticPath));
}

// Initialize DB
init().catch((e) => {
  console.error('Failed to init DB', e);
  process.exit(1);
});

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
    const bcrypt = require('bcrypt');
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Credenciales inválidas' });
    if (selectedRole && user.rol !== selectedRole) return res.status(403).json({ error: 'Rol no coincide con perfil seleccionado' });

    const token = signUserPayload(user);
    // Cookie security options: use secure & sameSite none in production when serving across domains
    const cookieOptions = { httpOnly: true, sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' };
    if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;
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
  const bcrypt = require('bcrypt');
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
    const bcrypt = require('bcrypt');
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

if (process.env.SERVE_STATIC === 'true') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Auth server listening on ${PORT}`);
});
