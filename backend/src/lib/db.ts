import { Sequelize } from "sequelize";
import logger from "../utils/logger";
import { dbConfig } from '../config/database.config';

const env = process.env.NODE_ENV || 'development';
const config = dbConfig[env];

const sequelize = new Sequelize(
  config.database!,
  config.username!,
  config.password!,
  config
);

const connectDB = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    logger.info("Conexión a la base de datos establecida con éxito.");
  } catch (error) {
    logger.error("No se pudo conectar a la base de datos:", error);
    process.exit(1);
  }
};

// Ejecuta la conexión inmediatamente
connectDB();

export { sequelize };
