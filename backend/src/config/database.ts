// backend/src/config/database.ts
import mysql from 'mysql2/promise';
import { config } from './config';

class Database {
  private pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.database,
      waitForConnections: true,
      connectionLimit: 50, // Увеличено с 10 до 50
      queueLimit: 100, // Ограничена очередь (было 0 = бесконечно)
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      connectTimeout: 10000, // 10 секунд таймаут на подключение
      // acquireTimeout - УДАЛЕНО, не поддерживается mysql2
    });

    this.testConnection();
    this.monitorPool();
  }

  private async testConnection() {
    try {
      const connection = await this.pool.getConnection();
      console.log('✅ Database connected successfully');
      connection.release();
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      process.exit(1);
    }
  }

  // Мониторинг connection pool
  private monitorPool() {
    setInterval(() => {
      const poolStats = {
        total: (this.pool as any)._allConnections?.length || 0,
        active: (this.pool as any)._allConnections?.length - (this.pool as any)._freeConnections?.length || 0,
        idle: (this.pool as any)._freeConnections?.length || 0,
        queue: (this.pool as any)._connectionQueue?.length || 0
      };

      // Логируем только если есть проблемы
      if (poolStats.queue > 10 || poolStats.active > 40) {
        console.warn('⚠️ Database pool warning:', poolStats);
      }
    }, 30000); // Каждые 30 секунд
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    try {
      const [rows] = await this.pool.query(sql, params || []);
      return rows as T[];
    } catch (error) {
      console.error('Database query error:', error);
      console.error('SQL:', sql);
      console.error('Params:', params);
      throw error;
    }
  }

  async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  getPool(): mysql.Pool {
    return this.pool;
  }

  async beginTransaction(): Promise<mysql.PoolConnection> {
    const connection = await this.pool.getConnection();
    await connection.beginTransaction();
    return connection;
  }

  async commit(connection: mysql.PoolConnection): Promise<void> {
    await connection.commit();
    connection.release();
  }

  async rollback(connection: mysql.PoolConnection): Promise<void> {
    await connection.rollback();
    connection.release();
  }

  async transaction<T>(
    callback: (connection: mysql.PoolConnection) => Promise<T>
  ): Promise<T> {
    const connection = await this.beginTransaction();
    try {
      const result = await callback(connection);
      await this.commit(connection);
      return result;
    } catch (error) {
      await this.rollback(connection);
      throw error;
    }
  }

  // Graceful shutdown
  async close(): Promise<void> {
    await this.pool.end();
    console.log('✅ Database pool closed');
  }
}

export default new Database();