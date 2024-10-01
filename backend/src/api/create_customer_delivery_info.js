import { Customer, CustomerDeliveryInfo } from "../models";

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      const { clientId, ...deliveryInfo } = req.body;

      // Encuentra o crea el Customer
      const [customer] = await Customer.findOrCreate({
        where: { clientId },
        defaults: { clientId },
      });

      // Crea o actualiza CustomerDeliveryInfo
      const [customerDeliveryInfo, created] =
        await CustomerDeliveryInfo.findOrCreate({
          where: { customerId: customer.clientId },
          defaults: { ...deliveryInfo, customerId: customer.clientId },
        });

      if (!created) {
        await customerDeliveryInfo.update(deliveryInfo);
      }

      res.status(200).json(customerDeliveryInfo);
    } catch (error) {
      console.error("Error creating/updating CustomerDeliveryInfo:", error);
      res
        .status(500)
        .json({ error: "Error creating/updating CustomerDeliveryInfo" });
    }
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
