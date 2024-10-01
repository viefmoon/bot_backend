const Customer = require("../models/customer");
const cors = require("cors");

// Configurar CORS
const corsMiddleware = cors({
  origin: "*", // Permite todas las origenes en desarrollo. Ajusta esto en producción.
  methods: ["GET"],
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

  if (req.method === "GET") {
    const { clientId } = req.query;

    if (!clientId) {
      return res
        .status(400)
        .json({ error: "Se requiere el parámetro clientId" });
    }

    try {
      // Obtener el fullChatHistory del cliente específico
      const customer = await Customer.findOne({
        where: { clientId },
        attributes: ["fullChatHistory"],
      });

      if (!customer) {
        return res.status(404).json({ error: "Cliente no encontrado" });
      }

      res.status(200).json(customer.fullChatHistory);
    } catch (error) {
      console.error(
        "Error al obtener el historial de chat del cliente:",
        error
      );
      res
        .status(500)
        .json({ error: "Error al obtener el historial de chat del cliente" });
    }
  } else {
    res.setHeader("Allow", ["GET"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
