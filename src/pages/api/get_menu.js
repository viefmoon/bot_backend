const cors = require("cors");

const corsMiddleware = cors({
  origin: "*",
  methods: ["GET"],
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
      // Importa los modelos necesarios
      const {
        Product,
        ProductVariant,
        PizzaIngredient,
        ModifierType,
        Modifier,
        Availability,
      } = require("../../models");

      const menu = await Product.findAll({
        attributes: { exclude: ["createdAt", "updatedAt"] },
        include: [
          {
            model: ProductVariant,
            as: "productVariants",
            attributes: { exclude: ["createdAt", "updatedAt"] },
            include: [
              {
                model: Availability,
                attributes: { exclude: ["createdAt", "updatedAt"] },
              },
            ],
          },
          {
            model: Availability,
            attributes: { exclude: ["createdAt", "updatedAt"] },
          },
          {
            model: PizzaIngredient,
            as: "pizzaIngredients",
            attributes: { exclude: ["createdAt", "updatedAt"] },
            include: [
              {
                model: Availability,
                attributes: { exclude: ["createdAt", "updatedAt"] },
              },
            ],
          },
          {
            model: ModifierType,
            as: "modifierTypes",
            attributes: { exclude: ["createdAt", "updatedAt"] },
            include: [
              {
                model: Modifier,
                as: "modifiers",
                attributes: { exclude: ["createdAt", "updatedAt"] },
                include: [
                  {
                    model: Availability,
                    attributes: { exclude: ["createdAt", "updatedAt"] },
                  },
                ],
              },
            ],
          },
        ],
      });
      res.status(200).json(menu);
    } catch (error) {
      console.error("Error al recuperar el menú:", error);
      res.status(500).json({ error: "Error al recuperar el menú" });
    }
  } else {
    res.setHeader("Allow", ["GET"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
