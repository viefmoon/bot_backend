import dotenv from "dotenv";
dotenv.config();
const Order = require("../../models/order");
const cors = require("cors");
import { sendWhatsAppMessage } from "../../utils/whatsAppUtils";

// Definir mensajes predeterminados
const statusMessages = {
  accepted:
    "Tu pedido #{orderId} ha sido aceptado y pronto comenzará a prepararse.",
  in_preparation:
    "Buenas noticias! Tu pedido #{orderId} está siendo preparado.",
  prepared: "Tu pedido #{orderId} está listo para ser entregado.",
  in_delivery:
    "Tu pedido #{orderId} está en camino. Pronto llegará a tu ubicación.",
  finished:
    "Tu pedido #{orderId} ha sido entregado. Esperamos que lo disfrutes!",
  canceled:
    "Lo sentimos, tu pedido #{orderId} ha sido cancelado. Por favor, contáctanos si tienes alguna pregunta.",
};

// Configurar CORS
const corsMiddleware = cors({
  origin: true,
  methods: ["PUT"],
});

// Aplicar el middleware CORS antes del manejador principal
export default async function handler(req, res) {
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
      const { orderId, newStatus } = req.body;

      if (!orderId || !newStatus) {
        return res
          .status(400)
          .json({ error: "Se requieren orderId y newStatus." });
      }

      const validStatuses = [
        "created",
        "accepted",
        "in_preparation",
        "prepared",
        "in_delivery",
        "finished",
        "canceled",
      ];
      if (!validStatuses.includes(newStatus)) {
        return res.status(400).json({ error: "Estado no válido." });
      }

      const order = await Order.findByPk(orderId);

      if (!order) {
        return res.status(404).json({ error: "Orden no encontrada." });
      }

      order.status = newStatus;
      await order.save();

      // Enviar mensaje de WhatsApp si hay un mensaje predefinido para el nuevo estado
      if (statusMessages[newStatus]) {
        const message = statusMessages[newStatus].replace("{orderId}", orderId);
        await sendWhatsAppMessage(order.clientId, message);
      }

      res
        .status(200)
        .json({ message: "Estado de la orden actualizado con éxito", order });
    } catch (error) {
      console.error("Error detallado:", error);
      res.status(500).json({
        error: "Error al actualizar el estado de la orden",
        details: error.message,
      });
    }
  } else {
    res.setHeader("Allow", ["PUT"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
