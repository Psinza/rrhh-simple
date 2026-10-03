'use strict';
const { contextBridge } = require('electron');
// El frontend detecta este objeto para guardar/leer su estado en PostgreSQL.
contextBridge.exposeInMainWorld('rrhhDesktop', { isDesktop: true });
