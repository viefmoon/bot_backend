import { Injectable } from "@nestjs/common";
import {
  Product,
  ProductVariant,
  PizzaIngredient,
  ModifierType,
  Modifier,
  Availability,
} from "../models";
import logger from "../utils/logger";

@Injectable()
export class MenuService {
  async getMenu() {
    try {
      const menu = await Product.findAll({
        attributes: {
          exclude: ["createdAt", "updatedAt", "ingredients"],
        },
        include: [
          {
            model: ProductVariant,
            as: "productVariants",
            attributes: {
              exclude: ["createdAt", "updatedAt", "ingredients"],
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
              exclude: ["createdAt", "updatedAt", "ingredients"],
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
      return menu;
    } catch (error) {
      logger.error(`Error al recuperar el menú: ${error.message}`, { error });
      throw new Error(`Error al recuperar el menú: ${error.message}`);
    }
  }
}
