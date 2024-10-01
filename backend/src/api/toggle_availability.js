import Availability from "../../models/availability";
import Product from "../../models/product";
import ProductVariant from "../../models/productVariant";
import Modifier from "../../models/modifier";
import ModifierType from "../../models/modifierType";
import PizzaIngredient from "../../models/pizzaIngredient";
const cors = require("cors");
const { Op } = require("sequelize");

const corsMiddleware = cors({
  origin: "*",
  methods: ["POST"],
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

  if (req.method === "POST") {
    try {
      const { id, type } = req.body;

      const availability = await Availability.findOne({
        where: { id, type },
      });

      if (!availability) {
        return res.status(404).json({ error: "Availability not found" });
      }

      availability.available = !availability.available;
      await availability.save();

      // Si es un producto, actualizar la disponibilidad de sus relaciones
      if (type === "product") {
        const product = await Product.findByPk(id);
        if (product) {
          // Obtener IDs de todas las relaciones
          const productVariantIds = (
            await ProductVariant.findAll({
              where: { productId: id },
              attributes: ["id"],
            })
          ).map((pv) => pv.id);

          const pizzaIngredientIds = (
            await PizzaIngredient.findAll({
              where: { productId: id },
              attributes: ["id"],
            })
          ).map((pi) => pi.id);

          const modifierTypeIds = (
            await ModifierType.findAll({
              where: { productId: id },
              attributes: ["id"],
            })
          ).map((mt) => mt.id);

          const modifierIds = (
            await Modifier.findAll({
              where: { modifierTypeId: modifierTypeIds },
              attributes: ["id"],
            })
          ).map((m) => m.id);

          // Verificar si el producto tiene relaciones
          if (
            productVariantIds.length > 0 ||
            pizzaIngredientIds.length > 0 ||
            modifierIds.length > 0
          ) {
            // Actualizar Availability solo para las relaciones existentes
            await Availability.update(
              { available: availability.available },
              {
                where: {
                  id: {
                    [Op.or]: [
                      ...productVariantIds,
                      ...pizzaIngredientIds,
                      ...modifierIds,
                    ],
                  },
                },
              }
            );
          }
        }
      }

      res.status(200).json({
        id: availability.id,
        type: availability.type,
        available: availability.available,
      });
    } catch (error) {
      console.error("Error toggling availability:", error);
      res.status(500).json({ error: "Error toggling availability" });
    }
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
