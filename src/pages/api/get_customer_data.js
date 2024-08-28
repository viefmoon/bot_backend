const { connectDB } = require("../../lib/db");
const Customer = require("../../models/customer");

export default async function handler(req, res) {
  if (req.method === "GET") {
    const { clientId } = req.query;
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
  } else {
    res.setHeader("Allow", ["GET"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
