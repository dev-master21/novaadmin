module.exports = {
  apps: [
    // ==================== BACKEND PRODUCTION ====================
    {
      name: 'nova-backend',
      cwd: './backend',
      script: 'dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '../logs/backend-error.log',
      out_file: '../logs/backend-out.log',
      log_file: '../logs/backend-combined.log',
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },

    // ==================== BACKEND DEVELOPMENT ====================
    {
      name: 'nova-backend-dev',
      cwd: './backend',
      script: 'node_modules/.bin/ts-node',
      args: 'src/server.ts',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: ['src'],
      watch_delay: 1000,
      ignore_watch: ['node_modules', 'logs', 'uploads', 'dist', 'public'],
      env: {
        NODE_ENV: 'development'
      },
      error_file: '../logs/backend-dev-error.log',
      out_file: '../logs/backend-dev-out.log',
      time: true
    },

    // ==================== FRONTEND PRODUCTION ====================
    {
      name: 'nova-frontend',
      cwd: './frontend',
      script: 'node_modules/.bin/vite',
      args: 'preview --port 4173 --host 0.0.0.0',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production'
      },
      error_file: '../logs/frontend-error.log',
      out_file: '../logs/frontend-out.log',
      time: true
    },

    // ==================== FRONTEND DEVELOPMENT ====================
    {
      name: 'nova-frontend-dev',
      cwd: './frontend',
      script: 'node_modules/.bin/vite',
      args: '--port 5173 --host 0.0.0.0',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'development'
      },
      error_file: '../logs/frontend-dev-error.log',
      out_file: '../logs/frontend-dev-out.log',
      time: true
    }
  ]
};
