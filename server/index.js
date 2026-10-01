const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const { init, allAsync, runAsUserAsync, db } = require('./db');
const { createCommercialSalesRouter } = require('./commercialSales');
const { createErpOperationsRouter } = require('./erpOperations');
const { fetchBcvUsdRate } = require('./bcvRate');

const app = express();
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '127.0.0.1';
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('Configure JWT_SECRET con al menos 32 caracteres antes de iniciar el servidor.');
}

// Configure CORS dynamically. In production set ALLOWED_ORIGIN to your frontend URL (e.g. https://rrhh-simple.onrender.com)
const allowedOrigin = process.env.ALLOWED_ORIGIN || true;
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());

const staticPath = path.join(__dirname, '..', 'dist');

// Serve static frontend when running as a single fullstack service (recommended for Render).
// The SPA fallback is registered after API routes so /api/me and other GET APIs are not shadowed.
if (process.env.SERVE_STATIC === 'true') {
  app.use(express.static(staticPath));
}

// Helpers
function signUserPayload(user, sessionId) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      rol: user.rol,
      nombre: user.nombre,
      jti: sessionId,
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

async function authMiddleware(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  try {
    if (typeof payload.jti !== 'string') {
      return res.status(401).json({ error: 'Session is no longer valid; please sign in again' });
    }
    const result = await db.query(
      `SELECT 1
       FROM users AS u
       JOIN auth_sessions AS s ON s.user_id = u.id
       WHERE u.id = $1 AND u.is_active
         AND s.id = $2
         AND s.token_hash = encode(digest($3, 'sha256'), 'hex')
         AND s.ended_at IS NULL
         AND s.expires_at > CURRENT_TIMESTAMP`,
      [payload.id, payload.jti, token],
    );
    if (result.rowCount === 0) return res.status(401).json({ error: 'Session is no longer valid' });
    req.user = payload;
    next();
  } catch (error) {
    console.error('Failed to validate authenticated user:', error);
    res.status(503).json({ error: 'Authentication service unavailable' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No user' });
    if (req.user.rol !== role) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

app.use('/api/commercial-sales', createCommercialSalesRouter(authMiddleware, db));
app.use('/api/erp', createErpOperationsRouter(authMiddleware, db));

function parsePermissions(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  }
  return [];
}

// Routes
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'rrhh-simple' });
});

app.get('/health/db', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ ok: true, database: 'postgresql' });
  } catch (error) {
    console.error('PostgreSQL health check failed:', error);
    res.status(503).json({ ok: false, database: 'unavailable' });
  }
});

app.post('/api/login', async (req, res) => {
  const { identifier, password, selectedRole } = req.body;
  if (!identifier || !password) return res.status(400).json({ error: 'Missing credentials' });
  try {
    const rows = await allAsync('SELECT * FROM users WHERE lower(username)=lower(?) OR lower(email)=lower(?) LIMIT 1', [identifier, identifier]);
    if (!rows || rows.length === 0) return res.status(401).json({ error: 'Credenciales inválidas' });
    const user = rows[0];
    const bcrypt = require('bcrypt');
    if (!user.is_active || !user.password_hash) return res.status(401).json({ error: 'Credenciales inválidas' });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Credenciales inválidas' });
    if (selectedRole && user.rol !== selectedRole) return res.status(403).json({ error: 'Rol no coincide con perfil seleccionado' });

    const sessionId = randomUUID();
    const token = signUserPayload(user, sessionId);
    await runAsUserAsync(
      user.id,
      req.ip,
      `INSERT INTO auth_sessions (id, user_id, token_hash, ip_address, user_agent, expires_at)
       VALUES ($1, $2, encode(digest($3, 'sha256'), 'hex'), NULLIF($4, '')::INET,
               $5, CURRENT_TIMESTAMP + INTERVAL '8 hours')`,
      [sessionId, user.id, token, req.ip || '', req.get('user-agent') || ''],
    );
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
      rolTitulo: user.roltitulo,
      avatar: user.avatar,
      badgeColor: user.badgeColor,
      nivelAcceso: user.nivelAcceso,
      descripcionAcceso: user.descripcionAcceso,
      permisos: parsePermissions(user.permisos),
    };
    res.json({ user: safe });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/logout', async (req, res) => {
  const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (typeof payload.jti === 'string' && typeof payload.id === 'string') {
        await runAsUserAsync(
          payload.id,
          req.ip,
          `UPDATE auth_sessions SET ended_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND user_id = $2 AND ended_at IS NULL`,
          [payload.jti, payload.id],
        );
      }
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
        res.clearCookie('token');
        return res.json({ ok: true });
      }
      console.error('Failed to close authenticated session:', error);
      return res.status(503).json({ error: 'Session service unavailable' });
    }
  }
  res.clearCookie('token');
  res.json({ ok: true });
});

app.get('/api/me', authMiddleware, async (req, res) => {
  const id = req.user.id;
  const rows = await allAsync('SELECT id, username, email, nombre, cargo, rol, rolTitulo AS "rolTitulo", avatar, badgeColor, nivelAcceso, descripcionAcceso, permisos FROM users WHERE id = ? LIMIT 1', [id]);
  if (!rows || rows.length === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ user: { ...rows[0], permisos: parsePermissions(rows[0].permisos) } });
});

app.get('/api/currency-rates/bcv/usd', authMiddleware, async (req, res) => {
  const requestedDate = typeof req.query.date === 'string'
    ? req.query.date
    : new Date().toISOString().slice(0, 10);
  const parsedRequestedDate = new Date(`${requestedDate}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
    || !Number.isFinite(parsedRequestedDate.getTime())
    || parsedRequestedDate.toISOString().slice(0, 10) !== requestedDate
  ) {
    return res.status(400).json({ error: 'La fecha solicitada debe tener el formato YYYY-MM-DD.' });
  }

  try {
    const userResult = await runAsUserAsync(
      req.user.id,
      req.ip,
      'SELECT company_id FROM users WHERE id = $1 AND is_active = TRUE',
      [req.user.id],
    );
    const companyId = userResult.rows[0]?.company_id;
    if (!companyId) {
      return res.status(409).json({ error: 'El usuario no tiene una empresa asociada para registrar la tasa BCV.' });
    }

    let publishedRate = null;
    let sourceError = null;
    try {
      publishedRate = await fetchBcvUsdRate();
    } catch (error) {
      sourceError = error;
      console.warn('No se pudo consultar la tasa oficial del BCV:', error);
    }

    if (publishedRate) {
      await runAsUserAsync(
        req.user.id,
        req.ip,
        `WITH saved_rate AS (
           INSERT INTO currency_rates (
             company_id, rate_date, source, currency_from, currency_to, rate, created_by
           )
           VALUES ($1, $2, 'BCV', 'USD', 'VES', $3, $4)
           ON CONFLICT (company_id, rate_date, currency_from, currency_to, source)
           DO UPDATE SET rate = EXCLUDED.rate, created_by = EXCLUDED.created_by
           RETURNING company_id, rate
         )
         UPDATE companies AS company
         SET bcv_usd_rate = saved_rate.rate, updated_at = CURRENT_TIMESTAMP
         FROM saved_rate
         WHERE company.id = saved_rate.company_id`,
        [
          companyId,
          publishedRate.effectiveDate,
          publishedRate.rate,
          req.user.id,
        ],
      );
    }

    const historicalResult = await runAsUserAsync(
      req.user.id,
      req.ip,
      `SELECT rate, rate_date::TEXT AS effective_date
       FROM currency_rates
       WHERE company_id = $1
         AND source = 'BCV'
         AND currency_from = 'USD'
         AND currency_to = 'VES'
         AND rate_date <= $2
       ORDER BY rate_date DESC
       LIMIT 1`,
      [companyId, requestedDate],
    );
    const savedRate = historicalResult.rows[0];
    if (savedRate) {
      return res.json({
        rate: Number(savedRate.rate),
        effectiveDate: savedRate.effective_date,
        source: 'BCV',
        stale: Boolean(sourceError),
        historical: requestedDate < new Date().toISOString().slice(0, 10),
        warning: sourceError
          ? 'No se pudo consultar el BCV; se usa la última tasa oficial guardada vigente para esta fecha.'
          : savedRate.effective_date < requestedDate
            ? 'Se usa la última tasa oficial registrada con fecha efectiva no posterior a la fecha solicitada.'
            : undefined,
      });
    }

    if (publishedRate) {
      return res.status(409).json({
        error: `No hay una tasa BCV guardada vigente para el período solicitado (${requestedDate}); no se aplicó la tasa de una fecha posterior.`,
      });
    }
    return res.status(503).json({
      error: 'No se pudo consultar el BCV y no existe una tasa oficial guardada vigente para esta fecha.',
    });
  } catch (error) {
    console.error('No se pudo obtener o guardar la tasa BCV:', error);
    return res.status(500).json({ error: 'No se pudo guardar la tasa oficial BCV en la base de datos.' });
  }
});

// Admin: list users
app.get('/api/users', authMiddleware, async (req, res) => {
  if (req.user.rol !== 'admin_sistema') return res.status(403).json({ error: 'Forbidden' });
  const rows = await allAsync('SELECT id, username, email, nombre, rol, rolTitulo AS "rolTitulo", avatar, badgeColor, is_active FROM users');
  res.json({ users: rows });
});

// Admin: create user
app.post('/api/users', authMiddleware, async (req, res) => {
  if (req.user.rol !== 'admin_sistema') return res.status(403).json({ error: 'Forbidden' });
  const u = req.body || {};
  const username = typeof u.username === 'string' ? u.username.trim().toLowerCase() : '';
  const email = typeof u.email === 'string' ? u.email.trim().toLowerCase() : '';
  const nombre = typeof u.nombre === 'string' ? u.nombre.trim() : '';
  const cargo = typeof u.cargo === 'string' ? u.cargo.trim() : '';
  const companyRif = typeof u.companyRif === 'string' ? u.companyRif.trim() : '';
  const allowedRoles = {
    admin_sistema: {
      title: 'Administrador del Sistema',
      badgeColor: 'bg-blue-600 text-white',
      level: 'Nivel 3 - Administración ERP',
    },
    rrhh: {
      title: 'Gerente de RRHH',
      badgeColor: 'bg-emerald-600 text-white',
      level: 'Nivel 2 - Gestión Operativa RRHH',
    },
    dueno: {
      title: 'Dueño de la Empresa',
      badgeColor: 'bg-amber-600 text-white',
      level: 'Nivel 1 - Alta Dirección',
    },
  };
  const role = typeof u.rol === 'string' && Object.hasOwn(allowedRoles, u.rol)
    ? allowedRoles[u.rol]
    : null;
  if (
    !/^[a-z0-9._-]{3,64}$/.test(username)
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || email.length > 254
    || !nombre
    || nombre.length > 160
    || cargo.length > 120
    || companyRif.length > 40
    || typeof u.password !== 'string'
    || Buffer.byteLength(u.password, 'utf8') < 12
    || Buffer.byteLength(u.password, 'utf8') > 72
    || !role
    || !companyRif
  ) {
    return res.status(400).json({ error: 'Verifique los datos, la contraseña (12–72 bytes) y el perfil seleccionado.' });
  }

  const bcrypt = require('bcrypt');
  const hash = await bcrypt.hash(u.password, 10);
  const id = randomUUID();
  try {
    const result = await runAsUserAsync(
      req.user.id,
      req.ip,
      `INSERT INTO users (
         id, username, email, password_hash, nombre, cargo, rol, rolTitulo,
         avatar, badgeColor, nivelAcceso, descripcionAcceso, permisos, company_id
       )
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]'::JSONB, company.id
       FROM companies AS company
       WHERE company.active
         AND UPPER(REGEXP_REPLACE(company.rif, '[^A-Za-z0-9]', '', 'g'))
           = UPPER(REGEXP_REPLACE(?, '[^A-Za-z0-9]', '', 'g'))
       RETURNING id, username, email, nombre, cargo, rol, rolTitulo AS "rolTitulo",
                 avatar, badgeColor, nivelAcceso, descripcionAcceso, permisos`,
      [
        id,
        username,
        email,
        hash,
        nombre,
        cargo,
        u.rol,
        role.title,
        nombre.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
        role.badgeColor,
        role.level,
        `Acceso asignado al perfil ${role.title}.`,
        companyRif,
      ],
    );
    if (result.rowCount === 0) {
      return res.status(409).json({
        error: 'La empresa indicada no está registrada como activa en la base de datos ERP. Verifique su RIF y la configuración de empresa.',
      });
    }
    res.status(201).json({ user: result.rows[0] });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'El nombre de usuario o correo ya está registrado.' });
    }
    console.error('Failed to create authenticated ERP user:', e);
    res.status(500).json({ error: 'No se pudo guardar el usuario en la base de datos.' });
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
      await runAsUserAsync(req.user.id, req.ip, 'UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
    }
    const fields = ['username','email','nombre','cargo','rol','rolTitulo','avatar','badgeColor','nivelAcceso','descripcionAcceso'];
    for (const f of fields) {
      if (u[f] !== undefined) {
        await runAsUserAsync(req.user.id, req.ip, `UPDATE users SET ${f} = ? WHERE id = ?`, [u[f], id]);
      }
    }
    if (u.permisos) {
      await runAsUserAsync(req.user.id, req.ip, 'UPDATE users SET permisos = ? WHERE id = ?', [JSON.stringify(u.permisos), id]);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Deactivate an account without deleting historical references.
app.delete('/api/users/:id', authMiddleware, async (req, res) => {
  if (req.user.rol !== 'admin_sistema') return res.status(403).json({ error: 'Forbidden' });
  const id = req.params.id;
  try {
    const result = await runAsUserAsync(
      req.user.id,
      req.ip,
      'UPDATE users SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id',
      [id],
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ ok: true, deactivatedId: id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to deactivate user' });
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
  try {
    const result = await runAsUserAsync(
      req.user.id,
      req.ip,
      `UPDATE employees
       SET status = 'egresado', termination_date = COALESCE(termination_date, CURRENT_DATE),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id`,
      [req.params.id],
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Employee not found' });
    res.json({ ok: true, deactivatedId: req.params.id });
  } catch (error) {
    console.error('Failed to deactivate employee:', error);
    res.status(500).json({ error: 'Failed to deactivate employee' });
  }
});

if (process.env.SERVE_STATIC === 'true') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
}

init()
  .then(() => {
    app.listen(PORT, HOST, () => {
      console.log(`Auth server listening on http://${HOST}:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize PostgreSQL:', error);
    process.exit(1);
  });
