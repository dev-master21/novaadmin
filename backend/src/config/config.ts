// backend/src/config/config.ts
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  apiPrefix: process.env.API_PREFIX || '/api',


  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  
  // Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nova_database'
  },
    // ✅ ДОБАВЛЕНО: Proxy Configuration
  proxy: {
    enabled: process.env.PROXY_ENABLED === 'true',
    url: process.env.PROXY_URL || ''
  },
  
ai: {
  provider: process.env.AI_PROVIDER || 'openai',
  proxyUrl: process.env.AI_PROXY_URL || '',
  proxySecret: process.env.AI_PROXY_SECRET || '',
  openai: {
    model: 'gpt-4o', // Лучшая модель для текста и изображений
    visionModel: 'gpt-4o', // Поддерживает vision
    maxTokens: 4096,
  },
  claude: {
    model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
    maxTokens: 8192,
  }
},
  
  // Currency rates
  currencyRates: {
    THB_TO_RUB: 2.6,
    USD_TO_THB: 32
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

  uploadsDir: '/var/www/www-root/data/www/novaestate.company/backend/uploads',
  publicDir: '/var/www/www-root/data/www/novaestate.company/backend/public',
  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173'
  },

  // Client Site
  clientSiteUrl: process.env.CLIENT_SITE_URL || 'http://localhost:3000'
};