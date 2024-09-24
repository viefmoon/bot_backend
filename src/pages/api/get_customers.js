const Customer = require("../../models/customer");
const BannedCustomer = require("../../models/bannedCustomer");
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
    try {
      // Obtener clientes con campos específicos
      const customers = await Customer.findAll({
        attributes: [
          "clientId",
          "deliveryInfo",
          "stripeCustomerId",
          "lastInteraction",
          "createdAt",
        ],
      });

      // Verificar el estado de baneo para cada cliente
      const customersWithBanStatus = await Promise.all(
        customers.map(async (customer) => {
          const bannedCustomer = await BannedCustomer.findOne({
            where: { clientId: customer.clientId },
          });
          return {
            ...customer.toJSON(),
            isBanned: !!bannedCustomer,
          };
        })
      );

      res.status(200).json(customersWithBanStatus);
    } catch (error) {
      console.error("Error al obtener los clientes:", error);
      res.status(500).json({ error: "Error al obtener los clientes" });
    }
  } else {
    res.setHeader("Allow", ["GET"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
