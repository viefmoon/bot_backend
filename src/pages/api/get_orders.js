import {
  Order,
  OrderItem,
  Product,
  ProductVariant,
  SelectedPizzaIngredient,
  PizzaIngredient,
  SelectedModifier,
  Modifier,
} from "../../models";
import cors from "cors";

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
        include: [
          {
            model: OrderItem,
            as: "orderItems",
            attributes: ["quantity", "price", "comments"],
            include: [
              { model: Product, attributes: ["name", "price"] },
              { model: ProductVariant, attributes: ["name", "price"] },
              {
                model: SelectedPizzaIngredient,
                as: "selectedPizzaIngredients",
                attributes: ["half", "action"],
                include: { model: PizzaIngredient, attributes: ["name"] },
              },
              {
                model: SelectedModifier,
                as: "selectedModifiers",
                attributes: ["id"],
                include: {
                  model: Modifier,
                  attributes: ["name", "price"],
                },
              },
            ],
          },
        ],
        attributes: [
          "id",
          "dailyOrderNumber",
          "orderType",
          "status",
          "paymentStatus",
          "deliveryInfo",
          "totalCost",
          "clientId",
          "orderDate",
          "estimatedTime",
          "scheduledDeliveryTime",
          "createdAt",
          "updatedAt",
        ],
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
