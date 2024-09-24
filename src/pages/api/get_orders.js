const { Order } = require("../../models");
const cors = require("cors");

const corsMiddleware = cors({
  methods: ["GET"],
  origin: true, // Permite cualquier origen
});

export default async function handler(req, res) {
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
      const { date } = req.query;
      let whereClause = {};

      if (date) {
        whereClause.orderDate = date;
      }

      const orders = await Order.findAll({
        where: whereClause,
        order: [
          ["orderDate", "DESC"],
          ["dailyOrderNumber", "DESC"],
        ],
        include: [{ model: Item, as: "items" }],
      });

      res.status(200).json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ error: "Error al obtener los pedidos" });
    }
  } else {
    res.setHeader("Allow", ["GET"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
