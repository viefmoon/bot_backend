import RestaurantConfig from "../../models/restaurantConfig";
const cors = require("cors");

// Configurar CORS
const corsMiddleware = cors({
  origin: "*", // Permitir todos los orígenes en desarrollo. Ajustar esto en producción.
  methods: ["PUT"],
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

  if (req.method === "PUT") {
    try {
      const { acceptingOrders, estimatedPickupTime, estimatedDeliveryTime } =
        req.body;

      const config = await RestaurantConfig.findOne();
      if (!config) {
        return res.status(404).json({ error: "Configuración no encontrada" });
      }

      await config.update({
        acceptingOrders,
        estimatedPickupTime,
        estimatedDeliveryTime,
      });
      console.log("Configuración actualizada:", config);

      res.status(200).json({
        acceptingOrders: config.acceptingOrders,
        estimatedPickupTime: config.estimatedPickupTime,
        estimatedDeliveryTime: config.estimatedDeliveryTime,
      });
    } catch (error) {
      console.error("Error al actualizar la configuración:", error);
      res.status(500).json({ error: "Error al actualizar la configuración" });
    }
  } else {
    res.setHeader("Allow", ["PUT"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
