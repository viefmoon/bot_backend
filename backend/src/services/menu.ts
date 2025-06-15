import { prisma } from '../server';
import { Product, ProductVariant, Category, Subcategory, ModifierType, Modifier, PizzaIngredient } from '@prisma/client';

interface MenuStructure {
  categories: Array<{
    id: string;
    name: string;
    subcategories: Array<{
      id: string;
      name: string;
      products: Array<{
        id: string;
        name: string;
        shortName: string | null;
        price: number | null;
        ingredients: string | null;
        variants: Array<{
          id: string;
          name: string;
          shortName: string | null;
          price: number;
        }>;
        modifierTypes: Array<{
          id: string;
          name: string;
          acceptsMultiple: boolean;
          required: boolean;
          modifiers: Array<{
            id: string;
            name: string;
            shortName: string | null;
            price: number;
          }>;
        }>;
        pizzaIngredients?: Array<{
          id: string;
          name: string;
          ingredientValue: number;
        }>;
      }>;
    }>;
  }>;
}

export async function getFullMenu(): Promise<MenuStructure> {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    include: {
      subcategories: {
        where: { isActive: true },
        include: {
          products: {
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
          }
        }
      }
    }
  });

  return { categories };
}

export async function getProductById(productId: string) {
  return await prisma.product.findFirst({
    where: { 
      id: productId,
      isActive: true
    },
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
}

export async function getModifierById(modifierId: string) {
  return await prisma.modifier.findFirst({
    where: { 
      id: modifierId,
      isActive: true
    }
  });
}

export async function getPizzaIngredientById(ingredientId: string) {
  return await prisma.pizzaIngredient.findFirst({
    where: { 
      id: ingredientId,
      isActive: true
    }
  });
}

export async function getProductVariantById(variantId: string) {
  return await prisma.productVariant.findFirst({
    where: { 
      id: variantId,
      isActive: true
    }
  });
}