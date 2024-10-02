import { Injectable } from "@nestjs/common";
import {
  Product,
  ProductVariant,
  PizzaIngredient,
  ModifierType,
  Modifier,
  Availability,
} from "../models";

@Injectable()
export class MenuService {
  async getMenu() {
    try {
      // Agregar logging para depuración
      console.log("Iniciando recuperación del menú");
      const menu = await Product.findAll({
        attributes: {
          exclude: ["createdAt", "updatedAt", "keywords", "ingredients"],
        },
        include: [
          {
            model: ProductVariant,
            as: "productVariants",
            attributes: {
              exclude: ["createdAt", "updatedAt", "keywords", "ingredients"],
            },
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
            attributes: {
              exclude: ["createdAt", "updatedAt", "keywords", "ingredients"],
            },
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
                attributes: { exclude: ["createdAt", "updatedAt", "keywords"] },
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
      return menu;
    } catch (error) {
      // Mejorar el manejo de errores
      console.error("Error al recuperar el menú:", error);
      console.error("Stack trace:", error.stack);
      throw new Error(`Error al recuperar el menú: ${error.message}`);
    }
  }
}
