'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Credenciales generadas en la primera ejecución (contraseña de PostgreSQL y clave JWT).
 * Se guardan en la carpeta de datos del usuario de Windows (%APPDATA%\RRHH Simple),
 * que ya está protegida por los permisos de su perfil.
 */
function loadOrCreateSecrets(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed.dbPassword && parsed.jwtSecret) return parsed;
  } catch (_) { /* primera ejecución */ }
  const secrets = {
    dbPassword: crypto.randomBytes(24).toString('base64url'),
    jwtSecret: crypto.randomBytes(48).toString('base64url'),
    createdAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(secrets, null, 2), { mode: 0o600 });
  return secrets;
}

module.exports = { loadOrCreateSecrets };
