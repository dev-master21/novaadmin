// backend/src/server.ts
import app from './app';
import { config } from './config/config';
import logger from './utils/logger';

const PORT = config.port;

app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📌 Environment: ${config.env}`);
  logger.info(`🔗 API: http://localhost:${PORT}${config.apiPrefix}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  process.exit(0);
});