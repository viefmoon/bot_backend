const BannedCustomer = require("../models/bannedCustomer");
const Customer = require("../models/customer");
const cors = require("cors");

// Configurar CORS
const corsMiddleware = cors({
  origin: "*", // Permite todas las origenes en desarrollo. Ajusta esto en producción.
  methods: ["POST"],
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

  if (req.method === "POST") {
    try {
      const { clientId, action } = req.body;

      if (!clientId || !action) {
        return res.status(400).json({
          error: "Se requiere el ID del cliente y la acción (ban o unban)",
        });
      }

      // Verificar si el cliente existe
      const customer = await Customer.findOne({ where: { clientId } });
      if (!customer) {
        return res.status(404).json({ error: "Cliente no encontrado" });
      }

      if (action === "ban") {
        // Verificar si el cliente ya está baneado
        const existingBan = await BannedCustomer.findOne({
          where: { clientId },
        });
        if (existingBan) {
          return res.status(200).json({
            message: "El cliente ya está baneado",
            alreadyBanned: true,
          });
        }

        // Crear un nuevo registro de cliente baneado
        await BannedCustomer.create({ clientId });

        res.status(200).json({
          message: "Cliente baneado exitosamente",
          alreadyBanned: false,
        });
      } else if (action === "unban") {
        // Verificar si el cliente está baneado
        const existingBan = await BannedCustomer.findOne({
          where: { clientId },
        });
        if (!existingBan) {
          return res.status(200).json({
            message: "El cliente no está baneado",
            alreadyBanned: false,
          });
        }

        // Eliminar el registro de cliente baneado
        await BannedCustomer.destroy({ where: { clientId } });

        res.status(200).json({
          message: "Cliente desbaneado exitosamente",
          alreadyBanned: false,
        });
      } else {
        return res
          .status(400)
          .json({ error: "Acción no válida. Use 'ban' o 'unban'" });
      }
    } catch (error) {
      console.error("Error al procesar la acción del cliente:", error);
      res
        .status(500)
        .json({ error: "Error al procesar la acción del cliente" });
    }
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Método ${req.method} no permitido`);
  }
}
