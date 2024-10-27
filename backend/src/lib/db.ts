import { Sequelize } from "sequelize";
import logger from "../utils/logger";

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE,
  username: process.env.PGUSER,
  password: process.env.PGPASSWORD,
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
});

const connectDB = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    logger.info("Conexión a la base de datos establecida con éxito.");
  } catch (error) {
    logger.error("No se pudo conectar a la base de datos:", error);
    process.exit(1);
  }
};

connectDB();

export { sequelize };
