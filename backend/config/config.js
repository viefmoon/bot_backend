require('dotenv').config();

const baseConfig = process.env.DATABASE_URL
  ? {
      url: process.env.DATABASE_URL,
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      },
      define: {
        underscored: false,
        freezeTableName: true,
        charset: 'utf8',
        collate: 'utf8_general_ci',
      },
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
      }
    }
  : {
      username: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
      host: process.env.PGHOST,
      port: parseInt(process.env.PGPORT),
      dialect: 'postgres',
      logging: false,
      define: {
        underscored: false,
        freezeTableName: true,
        charset: 'utf8',
        collate: 'utf8_general_ci',
      },
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
      }
    };

module.exports = {
  development: baseConfig,
  test: baseConfig,
  production: baseConfig
};



