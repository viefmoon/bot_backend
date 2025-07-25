// PM2 Configuration for WhatsApp Bot
// This file configures how PM2 manages the API and worker processes

// Load environment variables from .env file
require('dotenv').config();

module.exports = {
  apps: [
    {
      // API Server Configuration
      name: 'whatsapp-api',
      script: 'dist/src/server.js',
      instances: 1, // API usually runs as single instance
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/api-error.log',
      out_file: 'logs/api-out.log',
      log_file: 'logs/api-combined.log',
      time: true,
    },
    {
      // Worker Process Configuration
      name: 'whatsapp-worker',
      script: 'dist/src/run-workers.js',
      instances: parseInt(process.env.NUM_WORKERS || '2', 10), // Scale workers based on env
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/worker-error.log',
      out_file: 'logs/worker-out.log',
      log_file: 'logs/worker-combined.log',
      time: true,
    },
  ],

  // Deploy section (optional, for remote deployments)
  deploy: {
    production: {
      user: 'node',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:your-username/your-repo.git',
      path: '/var/www/whatsapp-bot',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
    },
  },
};