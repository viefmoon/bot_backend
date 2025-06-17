import { prisma } from "../server";

export class MenuService {
  async getFullMenu() {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        variants: {
          where: { isActive: true }
        },
        modifierTypes: {
          include: {
            modifiers: {
              where: { isActive: true }
            }
          }
        },
        pizzaIngredients: {
          where: { isActive: true }
        }
      }
    });

    return products;
  }

  async getMenuForAI() {
    const products = await this.getFullMenu();
    let menuText = "=== MENÚ COMPLETO ===\n\n";

    for (const product of products) {
      menuText += `**${product.name}**\n`;
      
      if (product.variants && product.variants.length > 0) {
        for (const variant of product.variants) {
          menuText += `  - ${variant.name}: $${variant.price}\n`;
          
          // Los modifierTypes y pizzaIngredients están en el Product, no en el ProductVariant
        }
      }
      
      // Agregar modifierTypes del producto
      if (product.modifierTypes && product.modifierTypes.length > 0) {
        menuText += `  Modificadores:\n`;
        for (const modType of product.modifierTypes) {
          menuText += `    ${modType.name} (${modType.acceptsMultiple ? 'múltiple' : 'único'}):\n`;
          if (modType.modifiers && modType.modifiers.length > 0) {
            for (const mod of modType.modifiers) {
              menuText += `      - ${mod.name}: +$${mod.price}\n`;
            }
          }
        }
      }
      
      // Agregar pizzaIngredients del producto
      if (product.pizzaIngredients && product.pizzaIngredients.length > 0) {
        menuText += `  Ingredientes de pizza:\n`;
        for (const ingredient of product.pizzaIngredients) {
          menuText += `    - ${ingredient.name}\n`;
        }
      }
      
      menuText += "\n";
    }

    return menuText;
  }
}