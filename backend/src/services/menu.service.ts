import { Injectable } from "@nestjs/common";
import { Op } from "sequelize";

import {
  Product,
  ProductVariant,
  PizzaIngredient,
  ModifierType,
  Modifier,
  Availability,
  Category,
  Subcategory,
} from "../models";
import logger from "../utils/logger";
import { ProductoInfo } from "src/types/menu";

@Injectable()
export class MenuService {
  private readonly menuText: string = `
🍽️ Menú 🍽️

🥗 Entradas:
1. 🍗 Alitas
   - BBQ (orden $135 / media $70)
   - Picosas (orden $135 / media $70)
   - Fritas (orden $135 / media $70)
   - Mango habanero (orden $140 / media $75)
   - Mixtas BBQ y picosas ($135)
   Las alitas vienen acompañadas de chile de aceite.

2. 🍟 Papas:
   - Francesa (orden $90 / media $50)
   - Gajos (orden $105 / media $65)
   - Mixtas francesa y gajos ($100)
   🧀 Opción: Con queso y sin queso sin costo.
   Las papas vienen acompañadas de aderezo.

3. 🧀 Dedos de Queso ($90)

🍕 Pizzas:
Tamaños: Grande ($240), Mediana ($190), Chica ($140)
Opción de orilla rellena: Grande (+$30), Mediana (+$30), Chica (+$20)
Variedades:
- Especial: Pepperoni, Salchicha, Jamón, Salami, Chile morrón
- Carnes Frías: Pepperoni, Salchicha, Jamón, Salami
- Carranza: Chorizo, Jamón, Chile jalapeño, Jitomate
- Zapata: Salami, Jamón, Champiñón
- Villa: Chorizo, Tocino, Piña, Chile jalapeño
- Margarita: 3 Quesos, Jitomate, Albahaca
- Adelita: Jamón, Piña, Arándano
- Hawaiana: Jamón, Piña
- Mexicana: Chorizo, Cebolla, Chile jalapeño, Jitomate
- Rivera: Elote, Champiñón, Chile morrón
- Kahlo: Calabaza, Elote, Champiñón, Jitomate, Chile morrón
- Lupita: Carne molida, Tocino, Cebolla, Chile morrón
- Pepperoni
- La Leña: Tocino, Pierna, Chorizo, Carne molida (+$20)
- La María: Pollo BBQ, Piña, Chile jalapeño (+$20)
- Malinche: 3 Quesos, Queso de cabra, Champiñón, Jamón, Chile seco, Albahaca (+$20)
- Philadelphia: Jamon, Queso philadelphia, Chile , Albahaca (+$20)
- Personalizada con hasta 3 ingredientes de los disponibles sin costo extra.
-Ingrediente extra (+$10)
Opción de pizza mitad y mitad: Se puede armar una pizza mitad y mitad con dos variedades diferentes, sin costo adicional.
Todas las pizzas vienen acompañadas de chile de aceite y aderezo.

🍔 Hamburguesas:
Todas nuestras hamburguesas incluyen: cebolla, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema y mostaza.

- Tradicional: Carne de res, tocino, queso amarillo, queso asadero ($85)
- Especial: Carne de res, tocino, pierna, queso amarillo, queso asadero ($95)
- Hawaiana: Carne de res, tocino, piña, jamón, queso amarillo, queso asadero ($95)
- Pollo: Pechuga de pollo a la plancha, tocino, queso amarillo, queso asadero ($100)
- BBQ: Carne de res, salsa BBQ, tocino, queso amarillo, queso asadero, cebolla guisada ($100)
- Lenazo: Doble carne de sirlón, tocino, queso amarillo, queso asadero ($110)
- Cubana: Carne de res, tocino, pierna, salchicha, jamón, queso amarillo ($100)

🥔 Hamburguesas con papas: 
   - Francesa (+$10)
   - Gajos (+$15)
   - Mixtas (+$15)

🥗 Ensaladas:
- De Pollo: 
  Chica ($90) / Grande ($120)
- De Jamón: 
  Chica ($80) / Grande ($100)

Incluyen: Pollo a la plancha o jamón, chile morrón, elote, lechuga, jitomate, zanahoria, queso parmesano, aderezo, betabel crujiente

➕ Extras disponibles:
   - Con vinagreta (sin costo adicional)
   
🥤 Bebidas:
- Agua de horchata (1 Litro) ($35)
- Limonada (1 Litro) ($35)
- Limonada Mineral (1 Litro) ($35)
- Refrescos 500ml: Coca Cola, 7up, Mirinda, Sangría, Agua Mineral, Squirt ($30 c/u)
- Sangría Preparada: Con limón y sal ($35)
- Micheladas: Clara u oscura ($80)
- Café Caliente: Americano ($45), Capuchino ($45), Chocolate ($50), Mocachino ($45), Latte Vainilla ($45), Latte Capuchino ($45)
- Frappés ($70): Capuchino, Coco, Caramelo, Cajeta, Mocaccino, Galleta, Bombón
- Frappés especiales ($85): Rompope, Mazapán, Magnum

🍹 Coctelería:
- Vino tinto ($90)
- Sangría con vino ($80)
- Vampiro ($80)
- Gin de Maracuyá ($90)
- Margarita ($85)
- Ruso Blanco ($85)
- Palo santo ($80)
- Gin de pepino ($90)
- Mojito ($100)
- Piña colada ($75)
- Piñada ($70)
- Conga ($75)
- Destornillador ($75)
- Paloma ($80)
- Carajillo ($90)
- Tinto de verano ($90)
- Clericot ($80)
`;

  async getMenu() {
    try {
      const menu = await Category.findAll({
        include: [
          {
            model: Subcategory,
            as: "subcategories",
            include: [
              {
                model: Product,
                as: "products",
                include: [
                  {
                    model: ProductVariant,
                    as: "productVariants",
                    include: [
                      {
                        model: Availability,
                        as: "productVariantAvailability",
                        //attributes: ["id", "available"],
                      },
                    ],
                  },
                  {
                    model: Availability,
                    as: "productAvailability",
                    //attributes: ["id", "available"],
                  },
                  {
                    model: PizzaIngredient,
                    as: "pizzaIngredients",
                    include: [
                      {
                        model: Availability,
                        as: "pizzaIngredientAvailability",
                        //attributes: ["id", "available"],
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
                        include: [
                          {
                            model: Availability,
                            as: "modifierAvailability",
                            //attributes: ["id", "available"],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });
      console.log("menu", JSON.stringify(menu, null, 2));
      return menu;
    } catch (error) {
      logger.error(`Error al recuperar el menú: ${error.message}`, { error });
      throw new Error(`Error al recuperar el menú: ${error.message}`);
    }
  }

  async getUnavailableItems(): Promise<string> {
    try {
      const products = await Product.findAll({
        include: [
          {
            model: Availability,
          },
          {
            model: ProductVariant,
            as: "productVariants",
            include: [
              {
                model: Availability,
                where: { available: false },
                required: true,
              },
            ],
            required: false,
          },
          {
            model: PizzaIngredient,
            as: "pizzaIngredients",
            include: [
              {
                model: Availability,
                where: { available: false },
                required: true,
              },
            ],
            required: false,
          },
          {
            model: ModifierType,
            as: "modifierTypes",
            include: [
              {
                model: Modifier,
                as: "modifiers",
                include: [
                  {
                    model: Availability,
                    where: { available: false },
                    required: true,
                  },
                ],
                required: false,
              },
            ],
            required: false,
          },
        ],
        where: {
          [Op.or]: [
            { "$productVariants.Availability.available$": false },
            { "$pizzaIngredients.Availability.available$": false },
            { "$modifierTypes.modifiers.Availability.available$": false },
          ],
        },
      });

      let unavailableItemsText = "\n\n❌ Productos no disponibles:\n";
      let hasUnavailableItems = false;

      for (const product of products) {
        let productUnavailable = false;
        let unavailableDetails = "";

        if (product.Availability && !product.Availability.available) {
          productUnavailable = true;
        }

        if (product.productVariants?.length > 0) {
          const unavailableVariants = product.productVariants.filter(
            (v) => v.Availability && !v.Availability.available
          );
          if (unavailableVariants.length > 0) {
            unavailableDetails += `  • Variantes: ${unavailableVariants
              .map((v) => v.name)
              .join(", ")}\n`;
            productUnavailable = true;
          }
        }

        if (product.pizzaIngredients?.length > 0) {
          const unavailableIngredients = product.pizzaIngredients.filter(
            (i) => i.Availability && !i.Availability.available
          );
          if (unavailableIngredients.length > 0) {
            unavailableDetails += `  • Ingredientes: ${unavailableIngredients
              .map((i) => i.name)
              .join(", ")}\n`;
            productUnavailable = true;
          }
        }

        if (product.modifierTypes) {
          for (const modifierType of product.modifierTypes) {
            if (modifierType.modifiers) {
              const unavailableModifiers = modifierType.modifiers.filter(
                (m) => m.Availability && !m.Availability.available
              );
              if (unavailableModifiers.length > 0) {
                unavailableDetails += `  • ${
                  modifierType.name
                }: ${unavailableModifiers.map((m) => m.name).join(", ")}\n`;
                productUnavailable = true;
              }
            }
          }
        }

        if (productUnavailable) {
          unavailableItemsText += `- ${product.name}:\n${unavailableDetails}`;
          hasUnavailableItems = true;
        }
      }

      return hasUnavailableItems
        ? unavailableItemsText
        : "\n\nTodos los productos están disponibles.";
    } catch (error) {
      logger.error(
        `Error al obtener los productos no disponibles: ${error.message}`,
        { error }
      );
      return "\n\nError al obtener los productos no disponibles.";
    }
  }

  public async getFullMenu(): Promise<string> {
    const unavailableItems = await this.getUnavailableItems();
    return unavailableItems + this.menuText;
  }

  async getMenuAvailability(): Promise<
    ProductoInfo[] | { error: string; detalles?: string; stack?: string }
  > {
    try {
      if (
        !Product ||
        !ProductVariant ||
        !PizzaIngredient ||
        !ModifierType ||
        !Modifier ||
        !Availability
      ) {
        return { error: "Error en la configuración de los modelos" };
      }

      const products = await Product.findAll({
        include: [
          {
            model: ProductVariant,
            as: "productVariants",
            include: [{ model: Availability, where: { available: true } }],
          },
          {
            model: PizzaIngredient,
            as: "pizzaIngredients",
            include: [{ model: Availability, where: { available: true } }],
          },
          {
            model: ModifierType,
            as: "modifierTypes",
            include: [
              {
                model: Modifier,
                as: "modifiers",
                include: [{ model: Availability, where: { available: true } }],
              },
            ],
          },
          { model: Availability, where: { available: true } },
        ],
        where: {
          "$Availability.available$": true,
        },
      });

      if (!products || products.length === 0) {
        logger.error("No se encontraron productos");
        return { error: "No se encontraron productos en la base de datos" };
      }

      const menuSimplificado = products.map((producto) => {
        const productoInfo: ProductoInfo = {
          productId: producto.id.toString(),
          name: producto.name,
        };

        if (producto.productVariants?.length > 0) {
          productoInfo.productVariants = producto.productVariants.map((v) => ({
            productVariantId: v.id,
            name: v.name,
          }));
        }

        if (producto.modifierTypes?.length > 0) {
          productoInfo.modifierTypes = producto.modifierTypes.map((mt) => ({
            modifierTypeId: mt.id,
            name: mt.name,
            acceptsMultiple: mt.acceptsMultiple,
            required: mt.required,
            modifiers:
              mt.modifiers?.map((m) => ({
                modifierId: m.id,
                name: m.name,
              })) || [],
          }));
        }

        if (producto.pizzaIngredients?.length > 0) {
          productoInfo.pizzaIngredients = producto.pizzaIngredients.map(
            (i) => ({
              pizzaIngredientId: i.id,
              name: i.name,
            })
          );
        }

        return productoInfo;
      });

      return menuSimplificado as ProductoInfo[];
    } catch (error: any) {
      logger.error("Error al obtener la disponibilidad del menú:", error);
      return {
        error: "No se pudo obtener la disponibilidad del menú",
        detalles: error.message,
        stack: error.stack,
      };
    }
  }

  async getMenuForAI(): Promise<string | { error: string; detalles?: string }> {
    try {
      if (
        !Product ||
        !ProductVariant ||
        !PizzaIngredient ||
        !ModifierType ||
        !Modifier ||
        !Availability
      ) {
        return { error: "Error en la configuración de los modelos" };
      }

      const products = await Product.findAll({
        include: [
          {
            model: ProductVariant,
            as: "productVariants",
            include: [{ model: Availability, where: { available: true } }],
          },
          {
            model: PizzaIngredient,
            as: "pizzaIngredients",
            include: [{ model: Availability, where: { available: true } }],
          },
          {
            model: ModifierType,
            as: "modifierTypes",
            include: [
              {
                model: Modifier,
                as: "modifiers",
                include: [{ model: Availability, where: { available: true } }],
              },
            ],
          },
          { model: Availability, where: { available: true } },
        ],
        where: {
          "$Availability.available$": true,
        },
      });

      if (!products || products.length === 0) {
        logger.error("No se encontraron productos");
        return { error: "No se encontraron productos en la base de datos" };
      }

      const menuForAI = {
        productos: products.map((producto) => {
          const productoInfo: any = {
            nombre: producto.name,
          };

          if (producto.productVariants?.length > 0) {
            productoInfo.variantes = producto.productVariants.map(
              (v) => v.name
            );
          }

          if (producto.modifierTypes?.length > 0) {
            productoInfo.personalizacion = producto.modifierTypes.map((mt) => ({
              modificador: mt.name,
              opciones: mt.modifiers?.map((m) => m.name) || [],
            }));
          }

          if (producto.pizzaIngredients?.length > 0) {
            productoInfo.ingredientesPizza = producto.pizzaIngredients.map(
              (i) => i.name
            );
          }

          return productoInfo;
        }),
      };

      return JSON.stringify(menuForAI);
    } catch (error: any) {
      logger.error("Error al obtener el menú para IA:", error);
      return {
        error: "No se pudo obtener el menú",
        detalles: error.message,
      };
    }
  }
}
