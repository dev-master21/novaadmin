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
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });

    this.testConnection();
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

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    try {
      // Используем query вместо execute - он более гибкий к типам
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

  // Вспомогательный метод для транзакций
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
}

export default new Database();