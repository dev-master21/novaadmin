// backend/src/config/config.ts
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  apiPrefix: process.env.API_PREFIX || '/api',

  // Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nova_database'
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },

  // Upload
  upload: {
    basePath: process.env.UPLOAD_BASE_PATH || '../../novaestate.company/backend/uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5368709120', 10), // 50MB
    maxVideoSize: parseInt(process.env.MAX_VIDEO_SIZE || '5368709120', 10) // 500MB
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173'
  },

  // Client Site
  clientSiteUrl: process.env.CLIENT_SITE_URL || 'http://localhost:3000'
};