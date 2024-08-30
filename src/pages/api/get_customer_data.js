const Customer = require("../../models/customer");

export default async function handler(req, res) {
  if (req.method === "GET") {
    const { clientId } = req.query;

    const customer = await Customer.findOne({ where: { clientId } });

    if (customer) {
      res.status(200).json({
        lastDeliveryAddress: customer.lastDeliveryAddress,
        lastPickupName: customer.lastPickupName,
      });
    } else {
      res.status(200).json({});
    }
  } else {
    res.setHeader("Allow", ["GET"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
