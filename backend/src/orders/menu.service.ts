import {
  Product,
  ProductVariant,
  PizzaIngredient,
  Modifier,
  ModifierType,
  Availability,
} from "../database/entities";

export class MenuService {
  async getFullMenu() {
    const products = await Product.findAll({
      include: [
        {
          model: Availability,
          as: "pAv",
          where: { available: true },
          required: false,
        },
        {
          model: ProductVariant,
          as: "productVariants",
          required: false,
          include: [
            {
              model: Availability,
              as: "pvAv",
              where: { available: true },
              required: false,
            },
          ],
        },
        {
          model: ModifierType,
          as: "modifierTypes",
          include: [
            {
              model: Modifier,
              as: "modifiers",
              required: false,
              include: [
                {
                  model: Availability,
                  as: "mAv",
                  where: { available: true },
                  required: false,
                },
              ],
            },
          ],
        },
        {
          model: PizzaIngredient,
          as: "pizzaIngredients",
          required: false,
          include: [
            {
              model: Availability,
              as: "piAv",
              where: { available: true },
              required: false,
            },
          ],
        },
      ],
    });

    return products;
  }

  async getMenuForAI() {
    const products = await this.getFullMenu();
    let menuText = "=== MENÚ COMPLETO ===\n\n";

    for (const product of products) {
      menuText += `**${product.name}**\n`;
      
      if (product.productVariants && product.productVariants.length > 0) {
        for (const variant of product.productVariants) {
          menuText += `  - ${variant.name}: $${variant.price}\n`;
          
          // Los modifierTypes y pizzaIngredients están en el Product, no en el ProductVariant
        }
      }
      
      // Agregar modifierTypes del producto
      if (product.modifierTypes && product.modifierTypes.length > 0) {
        for (const modType of product.modifierTypes) {
          if (modType.modifiers && modType.modifiers.length > 0) {
            menuText += `  Opciones de ${modType.name}:\n`;
            for (const modifier of modType.modifiers) {
              menuText += `    • ${modifier.name}: +$${modifier.price}\n`;
            }
          }
        }
      }
      
      // Agregar pizzaIngredients del producto
      if (product.pizzaIngredients && product.pizzaIngredients.length > 0) {
        menuText += `  Ingredientes disponibles:\n`;
        for (const ingredient of product.pizzaIngredients) {
          menuText += `    • ${ingredient.name}\n`;
        }
      }
      
      menuText += "\n";
    }

    return menuText;
  }
}