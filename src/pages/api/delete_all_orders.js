dotenv.config();
const Order = require("../../models/order");
const { sequelize } = require("../../lib/db");
const cors = require("cors");

// Configurar CORS
const corsMiddleware = cors({
  origin: "*", // Permite todas las origenes en desarrollo. Ajusta esto en producción.
  methods: ["DELETE"],
});

export default async function handler(req, res) {
  // Aplicar el middleware CORS
  await new Promise((resolve, reject) => {
    corsMiddleware(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });

  if (req.method === "DELETE") {
    // Verificar el Bearer token si es necesario
    const authHeader = req.headers.authorization;
    if (
      process.env.BEARER_TOKEN &&
      (!authHeader || authHeader !== `Bearer ${process.env.BEARER_TOKEN}`)
    ) {
      return res.status(401).json({ error: "No autorizado" });
    }

    try {
      // Iniciar una transacción
      const transaction = await sequelize.transaction();

      try {
        // Borrar todos los items asociados a órdenes
        await Item.destroy({ where: {}, transaction });

        // Borrar todas las órdenes
        await Order.destroy({ where: {}, transaction });

        // Reiniciar la secuencia del auto-incremento
        await sequelize.query("ALTER TABLE Orders AUTO_INCREMENT = 1;", {
          transaction,
        });
        await sequelize.query("ALTER TABLE Items AUTO_INCREMENT = 1;", {
          transaction,
        });

        // Confirmar la transacción
        await transaction.commit();

        res.status(200).json({
          message:
            "Todas las órdenes han sido borradas y los contadores reiniciados.",
        });
      } catch (error) {
        // Si hay un error, revertir la transacción
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error("Error al borrar las órdenes:", error);
      res
        .status(500)
        .json({ error: "Error al borrar las órdenes", details: error.message });
    }
  } else {
    res.setHeader("Allow", ["DELETE"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
