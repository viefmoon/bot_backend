import RestaurantConfig from "../../models/restaurantConfig";
const cors = require("cors");

// Configurar CORS
const corsMiddleware = cors({
  origin: "*", // Permitir todos los orígenes en desarrollo. Ajustar esto en producción.
  methods: ["GET"],
});

export default async function handler(req, res) {
  // Aplicar el middleware de CORS
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
      const config = await RestaurantConfig.findOne();
      if (!config) {
        console.log("Configuración no encontrada");
        return res.status(404).json({ error: "Configuración no encontrada" });
      }
      console.log("Configuración obtenida:", config);
      res.status(200).json({
        acceptingOrders: config.acceptingOrders,
        estimatedPickupTime: config.estimatedPickupTime,
        estimatedDeliveryTime: config.estimatedDeliveryTime,
      });
    } catch (error) {
      console.error("Error al obtener la configuración:", error);
      res.status(500).json({ error: "Error al obtener la configuración" });
    }
  } else {
    res.setHeader("Allow", ["GET"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
