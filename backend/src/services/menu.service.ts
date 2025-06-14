import {
  Product,
  ProductVariant,
  PizzaIngredient,
  Modifier,
  ModifierType,
} from "../models";

export class MenuService {
  async getFullMenu() {
    const products = await Product.findAll({
      where: { available: true },
      include: [
        {
          model: ProductVariant,
          where: { available: true },
          required: false,
          include: [
            {
              model: ModifierType,
              include: [
                {
                  model: Modifier,
                  where: { available: true },
                  required: false,
                },
              ],
            },
            {
              model: PizzaIngredient,
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
          
          if (variant.modifierTypes && variant.modifierTypes.length > 0) {
            for (const modType of variant.modifierTypes) {
              if (modType.modifiers && modType.modifiers.length > 0) {
                menuText += `    Opciones de ${modType.name}:\n`;
                for (const modifier of modType.modifiers) {
                  menuText += `      • ${modifier.name}: +$${modifier.price}\n`;
                }
              }
            }
          }
          
          if (variant.pizzaIngredients && variant.pizzaIngredients.length > 0) {
            menuText += `    Ingredientes disponibles:\n`;
            for (const ingredient of variant.pizzaIngredients) {
              menuText += `      • ${ingredient.name}\n`;
            }
          }
        }
      }
      menuText += "\n";
    }

    return menuText;
  }
}