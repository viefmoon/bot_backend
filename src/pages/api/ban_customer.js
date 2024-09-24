const BannedCustomer = require("../../models/bannedCustomer");
const Customer = require("../../models/customer");
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
      const { clientId } = req.body;

      if (!clientId) {
        return res.status(400).json({ error: "Se requiere el ID del cliente" });
      }

      // Verificar si el cliente existe
      const customer = await Customer.findOne({ where: { clientId } });
      if (!customer) {
        return res.status(404).json({ error: "Cliente no encontrado" });
      }

      // Verificar si el cliente ya está baneado
      const existingBan = await BannedCustomer.findOne({ where: { clientId } });
      if (existingBan) {
        return res.status(409).json({ error: "El cliente ya está baneado" });
      }

      // Crear un nuevo registro de cliente baneado
      await BannedCustomer.create({ clientId });

      res.status(200).json({ message: "Cliente baneado exitosamente" });
    } catch (error) {
      console.error("Error al banear al cliente:", error);
      res.status(500).json({ error: "Error al banear al cliente" });
    }
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Método ${req.method} no permitido`);
  }
}
