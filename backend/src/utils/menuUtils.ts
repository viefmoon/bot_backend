import {
    Product,
    ProductVariant,
    Availability,
    PizzaIngredient,
    ModifierType,
    Modifier,
  } from "../models";
import logger from "./logger";

interface ProductoInfo {
    productId: string;
    name: string;
    productVariants?: Array<{
      productVariantId: string;
      name: string;
    }>;
    modifierTypes?: Array<{
      modifierTypeId: string;
      name: string;
      acceptsMultiple: boolean;
      required: boolean;
      modifiers?: Array<{
        modifierId: string;
        name: string;
      }>;
    }>;
    pizzaIngredients?: Array<{
      pizzaIngredientId: string;
      name: string;
    }>;
  }
  
  export async function getMenuAvailability(): Promise<ProductoInfo[] | { error: string; detalles?: string; stack?: string }> {
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
    
          // Agregar modificadores
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
    
          // Agregar ingredientes de pizza
          if (producto.pizzaIngredients?.length > 0) {
            productoInfo.pizzaIngredients = producto.pizzaIngredients.map((i) => ({
              pizzaIngredientId: i.id,
              name: i.name,
            }));
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
    
interface SimpleMenuItem {
  nombre: string;
  variantes?: string[];
  modificadores?: {
    tipo: string;
    opciones: string[];
  }[];
  ingredientes?: string[];
}

export async function getMenuSimple(): Promise<SimpleMenuItem[] | { error: string; detalles?: string }> {
  try {
    const menuCompleto = await getMenuAvailability();
    
    if ('error' in menuCompleto) {
      return menuCompleto;
    }

    const menuSimple: SimpleMenuItem[] = menuCompleto.map(producto => {
      const itemMenu: SimpleMenuItem = {
        nombre: producto.name
      };

      // Agregar variantes si existen
      if (producto.productVariants && producto.productVariants.length > 0) {
        itemMenu.variantes = producto.productVariants.map(v => v.name);
      }

      // Agregar modificadores disponibles
      if (producto.modifierTypes && producto.modifierTypes.length > 0) {
        itemMenu.modificadores = producto.modifierTypes.map(tipoMod => ({
          tipo: tipoMod.name,
          opciones: tipoMod.modifiers.map(mod => mod.name)
        }));
      }

      // Agregar ingredientes de pizza si existen
      if (producto.pizzaIngredients && producto.pizzaIngredients.length > 0) {
        itemMenu.ingredientes = producto.pizzaIngredients.map(ing => ing.name);
      }

      return itemMenu;
    });

    // Filtrar elementos vacíos y ordenar por nombre
    return menuSimple
      .filter(item => item.nombre)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

  } catch (error: any) {
    logger.error("Error al obtener el menú simplificado:", error);
    return {
      error: "No se pudo obtener el menú simplificado",
      detalles: error.message
    };
  }
}
