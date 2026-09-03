import { doc, getDoc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { firestoreDb } from './firebase';
import { Employee, CompanySettings, AppUser, AuditLog, PayrollPeriod } from '../types';
import { initialCompanySettings, initialEmployees } from '../data/initialData';
import { predefinedUsers } from '../data/authUsers';

export interface DatabaseState {
  version: string;
  timestamp: string;
  company: CompanySettings;
  employees: Employee[];
  users: AppUser[];
  payrolls: PayrollPeriod[];
  socialBenefits: any[];
  auditLogs: AuditLog[];
  currencyRates: { date: string; rate: number; source?: string }[];
}

export type DbSyncStatus = 'local_active' | 'cloud_connected' | 'syncing' | 'synced' | 'error';

class LightweightDatabase {
  private storageKey = 'rrhh_simple_database_v3';
  private syncStatus: DbSyncStatus = 'local_active';
  private statusListeners: Array<(status: DbSyncStatus, message?: string) => void> = [];

  constructor() {
    this.initDatabase();
  }

  public addCurrencyRate(rate: number, source: string = 'manual', date?: string) {
    try {
      const state = this.loadLocal() || {
        version: '3.2.0',
        timestamp: new Date().toISOString(),
        company: initialCompanySettings,
        employees: initialEmployees,
        users: predefinedUsers,
        payrolls: [],
        socialBenefits: [],
        auditLogs: [],
        currencyRates: [],
      } as DatabaseState;

      const record = { date: date || new Date().toISOString(), rate, source };
      state.currencyRates = state.currencyRates || [];
      state.currencyRates.push(record);

      // Also update company current tasaBCV_USD for backward compatibility
      state.company.tasaBCV_USD = rate;

      this.saveLocal(state);
      this.syncToCloud(state).catch(() => {});
    } catch (e) {
      console.error('Error al agregar tasa BCV:', e);
    }
  }

  public getLatestCurrencyRate(): { date: string; rate: number; source?: string } | null {
    const state = this.loadLocal();
    if (!state || !state.currencyRates || state.currencyRates.length === 0) return null;
    return state.currencyRates[state.currencyRates.length - 1];
  }

  public subscribeStatus(listener: (status: DbSyncStatus, message?: string) => void) {
    this.statusListeners.push(listener);
    listener(this.syncStatus);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  private notifyStatus(status: DbSyncStatus, message?: string) {
    this.syncStatus = status;
    this.statusListeners.forEach((l) => l(status, message));
  }

  public getStatus(): DbSyncStatus {
    return this.syncStatus;
  }

  /**
   * Initializes local storage and checks Firestore connection
   */
  public async initDatabase(): Promise<DatabaseState> {
    let state = this.loadLocal();
    if (!state) {
      state = {
        version: '3.2.0',
        timestamp: new Date().toISOString(),
        company: initialCompanySettings,
        employees: initialEmployees,
        users: predefinedUsers,
        payrolls: [],
        socialBenefits: [],
        auditLogs: [],
        currencyRates: [],
      };
      this.saveLocal(state);
    }

    // Try cloud sync in background if Firestore is configured
    this.testAndSyncCloud().catch((err) => {
      console.warn('Modo local activo. Firestore sync opcional:', err);
    });

    return state;
  }

  /**
   * Reads from localStorage cache
   */
  public loadLocal(): DatabaseState | null {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('Error al leer base de datos local:', e);
    }
    return null;
  }

  /**
   * Writes to localStorage cache
   */
  public saveLocal(state: DatabaseState): void {
    try {
      state.timestamp = new Date().toISOString();
      localStorage.setItem(this.storageKey, JSON.stringify(state));
    } catch (e) {
      console.error('Error al escribir en base de datos local:', e);
    }
  }

  /**
   * Syncs state to Firestore if available
   */
  public async syncToCloud(state?: DatabaseState): Promise<boolean> {
    const currentState = state || this.loadLocal();
    if (!currentState || !firestoreDb) {
      return false;
    }

    try {
      this.notifyStatus('syncing', 'Sincronizando con base de datos en la nube...');
      const batch = writeBatch(firestoreDb);

      // Save Company
      const compRef = doc(firestoreDb, 'company', 'settings');
      batch.set(compRef, currentState.company);

      // Save Users (Directorio)
      for (const u of currentState.users) {
        const userRef = doc(firestoreDb, 'users', u.id);
        batch.set(userRef, u);
      }

      await batch.commit();
      this.notifyStatus('synced', 'Base de datos sincronizada con la nube.');
      return true;
    } catch (error) {
      console.warn('Sincronización en la nube en modo diferido:', error);
      this.notifyStatus('local_active', 'Base de datos ligera operando en modo local seguro.');
      return false;
    }
  }

  /**
   * Checks Firestore connectivity and loads cloud state if available
   */
  public async testAndSyncCloud(): Promise<boolean> {
    if (!firestoreDb) {
      this.notifyStatus('local_active', 'Base de datos local activa (IndexedDB / Cache)');
      return false;
    }

    try {
      this.notifyStatus('cloud_connected', 'Conectado a Firestore Cloud');
      const compDoc = await getDoc(doc(firestoreDb, 'company', 'settings'));
      if (compDoc.exists()) {
        const cloudCompany = compDoc.data() as CompanySettings;
        const local = this.loadLocal();
        if (local && !local.company.logoUrl && cloudCompany.logoUrl) {
          local.company = cloudCompany;
          this.saveLocal(local);
        }
      }
      this.notifyStatus('synced', 'Base de datos ligera conectada y sincronizada');
      return true;
    } catch (e) {
      this.notifyStatus('local_active', 'Base de datos local autónoma activa');
      return false;
    }
  }

  /**
   * Exports the entire database as a JSON download
   */
  public exportToJson(): void {
    const state = this.loadLocal() || {
      version: '3.2.0',
      timestamp: new Date().toISOString(),
      company: initialCompanySettings,
      employees: initialEmployees,
      users: predefinedUsers,
      payrolls: [],
      socialBenefits: [],
      auditLogs: [],
      currencyRates: [],
    };

    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rrhh_simple_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Imports a JSON dump into the lightweight database
   */
  public async importFromJson(jsonString: string): Promise<DatabaseState> {
    const parsed = JSON.parse(jsonString) as DatabaseState;
    if (!parsed.company || !Array.isArray(parsed.employees) || !Array.isArray(parsed.users)) {
      throw new Error('El archivo no tiene la estructura de base de datos válida de RRHH-Simple.');
    }
    this.saveLocal(parsed);
    await this.syncToCloud(parsed);
    return parsed;
  }

  /**
   * Generates a complete SQL dump script (compatible with SQLite, PostgreSQL, Cloud SQL)
   */
  public generateSqlDump(): string {
    const state = this.loadLocal();
    if (!state) return '-- Base de datos vacía';

    const { company, employees, users } = state;

    let sql = `-- ==================================================================\n`;
    sql += `-- DUMP DE BASE DE DATOS SQL - RRHH SIMPLE V3.2\n`;
    sql += `-- Repositorio: https://github.com/Psinza/rrhh-simple\n`;
    sql += `-- Producción: https://rrhh-simple.onrender.com\n`;
    sql += `-- Administrador: Ing. Pedro Sinza (petersinza@gmail.com - 04127310361)\n`;
    sql += `-- Fecha de Generación: ${new Date().toISOString()}\n`;
    sql += `-- Compatible con: SQLite, PostgreSQL, MySQL y Cloud SQL\n`;
    sql += `-- ==================================================================\n\n`;

    // 1. Tabla Company
    sql += `CREATE TABLE IF NOT EXISTS configuracion_empresa (\n`;
    sql += `  rif VARCHAR(20) PRIMARY KEY,\n`;
    sql += `  razon_social VARCHAR(255) NOT NULL,\n`;
    sql += `  numero_patronal_ivss VARCHAR(50),\n`;
    sql += `  codigo_faov VARCHAR(50),\n`;
    sql += `  codigo_inces VARCHAR(50),\n`;
    sql += `  direccion_fiscal TEXT,\n`;
    sql += `  ciudad VARCHAR(100),\n`;
    sql += `  estado VARCHAR(100),\n`;
    sql += `  telefono VARCHAR(50),\n`;
    sql += `  email VARCHAR(150),\n`;
    sql += `  representante_legal VARCHAR(150),\n`;
    sql += `  cedula_representante VARCHAR(50),\n`;
    sql += `  cargo_representante VARCHAR(100),\n`;
    sql += `  nivel_riesgo_ivss VARCHAR(20),\n`;
    sql += `  sueldo_minimo_nacional NUMERIC(15,2),\n`;
    sql += `  cestaticket_mensual NUMERIC(15,2),\n`;
    sql += `  tasa_bcv_usd NUMERIC(10,4),\n`;
    sql += `  tasa_interes_prestaciones_bcv NUMERIC(6,2),\n`;
    sql += `  dias_utilidades INT\n`;
    sql += `);\n\n`;

    sql += `INSERT INTO configuracion_empresa VALUES (\n`;
    sql += `  '${company.rif.replace(/'/g, "''")}',\n`;
    sql += `  '${company.razonSocial.replace(/'/g, "''")}',\n`;
    sql += `  '${company.numeroPatronalIVSS.replace(/'/g, "''")}',\n`;
    sql += `  '${company.codigoAportanteFAOV.replace(/'/g, "''")}',\n`;
    sql += `  '${company.codigoInces.replace(/'/g, "''")}',\n`;
    sql += `  '${company.direccionFiscal.replace(/'/g, "''")}',\n`;
    sql += `  '${company.ciudad.replace(/'/g, "''")}',\n`;
    sql += `  '${company.estado.replace(/'/g, "''")}',\n`;
    sql += `  '${company.telefono.replace(/'/g, "''")}',\n`;
    sql += `  '${company.email.replace(/'/g, "''")}',\n`;
    sql += `  '${company.representanteLegal.replace(/'/g, "''")}',\n`;
    sql += `  '${company.cedulaRepresentante.replace(/'/g, "''")}',\n`;
    sql += `  '${company.cargoRepresentante.replace(/'/g, "''")}',\n`;
    sql += `  '${company.nivelRiesgoIVSS}',\n`;
    sql += `  ${company.salarioMinimoNacional},\n`;
    sql += `  ${company.montoCestaticketNacional},\n`;
    sql += `  ${company.tasaBCV_USD},\n`;
    sql += `  ${company.tasaInteresPrestacionesBCV},\n`;
    sql += `  ${company.diasUtilidadesEmpresa}\n`;
    sql += `);\n\n`;

    // 2. Tabla Usuarios
    sql += `CREATE TABLE IF NOT EXISTS usuarios_sistema (\n`;
    sql += `  id VARCHAR(50) PRIMARY KEY,\n`;
    sql += `  username VARCHAR(50) UNIQUE NOT NULL,\n`;
    sql += `  email VARCHAR(150) NOT NULL,\n`;
    sql += `  nombre VARCHAR(150) NOT NULL,\n`;
    sql += `  cargo VARCHAR(100),\n`;
    sql += `  telefono VARCHAR(50),\n`;
    sql += `  rol VARCHAR(50) NOT NULL,\n`;
    sql += `  nivel_acceso VARCHAR(100)\n`;
    sql += `);\n\n`;

    for (const u of users) {
      sql += `INSERT INTO usuarios_sistema VALUES (\n`;
      sql += `  '${u.id}', '${u.username}', '${u.email}', '${u.nombre.replace(/'/g, "''")}',\n`;
      sql += `  '${u.cargo.replace(/'/g, "''")}', '${u.telefono || ''}', '${u.rol}', '${u.nivelAcceso}'\n`;
      sql += `);\n`;
    }
    sql += `\n`;

    // 3. Tabla Empleados (Ficha 14-02)
    sql += `CREATE TABLE IF NOT EXISTS empleados (\n`;
    sql += `  id VARCHAR(50) PRIMARY KEY,\n`;
    sql += `  cedula VARCHAR(20) UNIQUE NOT NULL,\n`;
    sql += `  nombres VARCHAR(100) NOT NULL,\n`;
    sql += `  apellidos VARCHAR(100) NOT NULL,\n`;
    sql += `  cargo VARCHAR(100),\n`;
    sql += `  departamento VARCHAR(100),\n`;
    sql += `  fecha_ingreso DATE,\n`;
    sql += `  salario_mensual_base NUMERIC(15,2),\n`;
    sql += `  cestaticket_mensual NUMERIC(15,2),\n`;
    sql += `  frecuencia_pago VARCHAR(20),\n`;
    sql += `  banco VARCHAR(100),\n`;
    sql += `  numero_cuenta VARCHAR(50)\n`;
    sql += `);\n\n`;

    for (const e of employees) {
      const nombres = `${e.primerNombre} ${e.segundoNombre || ''}`.trim();
      const apellidos = `${e.primerApellido} ${e.segundoApellido || ''}`.trim();
      sql += `INSERT INTO empleados VALUES (\n`;
      sql += `  '${e.id}', '${e.cedula}', '${nombres.replace(/'/g, "''")}', '${apellidos.replace(/'/g, "''")}',\n`;
      sql += `  '${e.cargo.replace(/'/g, "''")}', '${e.departamento.replace(/'/g, "''")}', '${e.fechaIngreso}',\n`;
      sql += `  ${e.salarioMensualBase}, ${e.cestaticketMensual}, '${e.frecuenciaPago}',\n`;
      sql += `  '${e.banco.replace(/'/g, "''")}', '${e.numeroCuenta.replace(/'/g, "''")}'\n`;
      sql += `);\n`;
    }

    // Agregar tabla e inserciones de currency_rates al dump si existen registros locales
    if (state && (state as any).currencyRates && (state as any).currencyRates.length) {
      sql += `\n-- Tabla: currency_rates (histórico de tasas BCV)\n`;
      sql += `CREATE TABLE IF NOT EXISTS currency_rates (\n`;
      sql += `  id VARCHAR(50) PRIMARY KEY,\n`;
      sql += `  fecha TIMESTAMP NOT NULL,\n`;
      sql += `  tasa_bcv_usd NUMERIC(12,4) NOT NULL,\n`;
      sql += `  origen VARCHAR(100)\n`;
      sql += `);\n\n`;
      for (const cr of (state as any).currencyRates) {
        const id = `cr-${cr.date}`.replace(/[^0-9A-Za-z\-]/g, '_');
        sql += `INSERT INTO currency_rates VALUES ('${id}', '${cr.date}', ${cr.rate}, '${(cr.source || '').replace(/'/g, "''")}');\n`;
      }
      sql += `\n`;
    }

    return sql;
  }

  /**
   * Downloads the SQL Dump
   */
  public exportSqlFile(): void {
    const sql = this.generateSqlDump();
    const blob = new Blob([sql], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rrhh_simple_database_${new Date().toISOString().split('T')[0]}.sql`;
    link.click();
    URL.revokeObjectURL(url);
  }
}

export const lightweightDb = new LightweightDatabase();
