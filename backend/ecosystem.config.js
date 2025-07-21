// PM2 Configuration for WhatsApp Bot
// This file configures how PM2 manages the API and worker processes

// Load environment variables from .env file
require('dotenv').config();

module.exports = {
  apps: [
    {
      // API Server Configuration (includes the worker)
      name: 'whatsapp-api',
      script: 'dist/src/server.js',
      instances: 1, // API and worker run in the same process now
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