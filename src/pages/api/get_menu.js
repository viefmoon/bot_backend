import Product from "../../models/product";
import ProductVariant from "../../models/productVariant";
import PizzaIngredient from "../../models/pizzaIngredient";
import ModifierType from "../../models/modifierType";
import Modifier from "../../models/modifier";
import Availability from "../../models/availability";
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
      const menu = await Product.findAll({
        include: [
          { model: ProductVariant, include: [{ model: Availability }] },
          { model: Availability },
          { model: PizzaIngredient, include: [{ model: Availability }] },
          {
            model: ModifierType,
            include: [{ model: Modifier, include: [{ model: Availability }] }],
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
