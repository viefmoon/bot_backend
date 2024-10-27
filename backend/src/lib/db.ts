import { Sequelize } from "sequelize";
import logger from "../utils/logger";
const dotenv = require("dotenv");
dotenv.config();

const sequelize = new Sequelize(
  process.env.PGDATABASE!,
  process.env.PGUSER!,
  process.env.PGPASSWORD!,
  {
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT!),
    dialect: "postgres",
    logging: false,
    define: {
      // Configuración global para todos los modelos
      underscored: false,
      freezeTableName: true,
      // Asegura que los nombres de atributos se mantengan como los defines
      charset: "utf8",
      collate: "utf8_general_ci",
    },
    ...(process.env.PGSSLMODE === "require" && {
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      },
    }),
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
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
