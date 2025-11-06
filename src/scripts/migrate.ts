// backend/src/scripts/migrate.ts
import fs from 'fs-extra';
import path from 'path';
import db from '../config/database';
import logger from '../utils/logger';

async function runMigration() {
  try {
    logger.info('🔄 Starting database migration...');

    const migrationPath = path.join(__dirname, '../../database/migration.sql');
    const sql = await fs.readFile(migrationPath, 'utf-8');

    // Разделяем SQL на отдельные запросы
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      await db.query(statement);
    }

    logger.info('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();