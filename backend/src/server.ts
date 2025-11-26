// backend/src/server.ts

// Загрузка .env
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(__dirname, '../.env');
console.log('Loading .env from:', envPath);

const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('❌ Error loading .env file:', result.error);
} else {
  console.log('✅ .env file loaded successfully');
}

// Остальные импорты
import app from './app';
import { config } from './config/config';
import logger from './utils/logger';
import telegramBot from './services/telegramBot.service';
import externalCalendarSyncJob from './jobs/externalCalendarSync.job';
import db from './config/database';

const PORT = config.port;

const server = app.listen(PORT, async () => {
  logger.info(`Server is running on port ${PORT}`);
  
  try {
    await telegramBot.initialize();
    logger.info('Telegram bot initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Telegram bot:', error);
  }
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully`);
  
  server.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      await telegramBot.stop();
      logger.info('Telegram bot stopped');
      
      await db.close();
      logger.info('Database connections closed');
      
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
  
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

externalCalendarSyncJob.start();