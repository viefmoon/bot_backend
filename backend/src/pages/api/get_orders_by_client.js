const {
  Order,
  OrderItem,
  Product,
  ProductVariant,
  SelectedPizzaIngredient,
  PizzaIngredient,
  SelectedModifier,
  Modifier,
  OrderDeliveryInfo,
} = require("../../models");
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
      const { clientId } = req.query;

      if (!clientId) {
        return res
          .status(400)
          .json({ error: "Se requiere el ID del cliente." });
      }

      const orders = await Order.findAll({
        where: { clientId },
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
          {
            model: OrderDeliveryInfo,
            as: "orderDeliveryInfo",
            attributes: ["streetAddress", "pickupName"],
          },
        ],
        attributes: [
          "id",
          "dailyOrderNumber",
          "orderType",
          "status",
          "paymentStatus",
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
      console.error("Error al obtener las órdenes:", error);
      res.status(500).json({ error: "Error al obtener las órdenes" });
    }
  } else {
    res.setHeader("Allow", ["GET"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
