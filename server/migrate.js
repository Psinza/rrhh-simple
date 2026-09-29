const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { db, init } = require('./db');

init()
  .then(async () => {
    console.info('Migraciones PostgreSQL completadas.');
    await db.end();
  })
  .catch(async (error) => {
    console.error('No se pudieron aplicar las migraciones PostgreSQL:', error);
    await db.end();
    process.exitCode = 1;
  });
