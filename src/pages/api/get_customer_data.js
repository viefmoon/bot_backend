const { connectDB } = require("../../lib/db");
const Customer = require("../../models/customer");

export default async function handler(req, res) {
  await connectDB();

  if (req.method === "GET") {
    try {
      const { clientId } = req.query;

      if (!clientId) {
        return res
          .status(400)
          .json({ error: "Se requiere el ID del cliente." });
      }

      // Formatear el número de teléfono de México
      let phoneNumber = clientId;
      if (phoneNumber.startsWith("521")) {
        phoneNumber = phoneNumber.slice(3);
      }

      const customer = await Customer.findOne({ where: { clientId } });

      if (customer) {
        res.status(200).json({
          phoneNumber,
          lastDeliveryAddress: customer.lastDeliveryAddress,
          lastPickupName: customer.lastPickupName,
        });
      } else {
        res.status(200).json({ phoneNumber });
      }
    } catch (error) {
      console.error("Error al obtener datos del cliente:", error);
      res.status(500).json({ error: "Error al obtener datos del cliente" });
    }
  } else {
    res.setHeader("Allow", ["GET"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
