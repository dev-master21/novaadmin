// backend/src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { config } from './config/config';
import { errorHandler } from './middlewares/error.middleware';
import routes from './routes';
import logger from './utils/logger';
import path from 'path';

const app = express();

// Security middleware
app.use(helmet());

// CORS
const allowedOrigins = [
  'https://owner.novaestate.company',
  'https://agreement.novaestate.company',
  'https://admin.novaestate.company',
  'https://novaestate.company',
  'http://owner.novaestate.company',
  'http://agreement.novaestate.company',
  'http://admin.novaestate.company',
  'http://novaestate.company',
  'https://owner.warmplus.club',
  'https://agreement.warmplus.club',
  'https://admin.warmplus.club',
  'https://warmplus.club',
  'http://owner.warmplus.club',
  'http://agreement.warmplus.club',
  'http://admin.warmplus.club',
  'http://warmplus.club'
];

app.use(cors({
  origin: (origin, callback) => {
    // Разрешаем запросы без Origin (например, Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS Denied'));
    }
  },
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '5000mb' }));
app.use(express.urlencoded({ extended: true, limit: '5000mb' }));


// Раздача статических файлов для медиа из Telegram
app.use('/uploads/telegram_media', express.static(path.join(__dirname, '../uploads/telegram_media')));

// Compression
app.use(compression());

// Logging
if (config.env === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: {
      write: (message: string) => logger.info(message.trim())
    }
  }));
}

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use(config.apiPrefix, routes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use(errorHandler);

export default app;