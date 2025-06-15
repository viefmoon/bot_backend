import { prisma } from '../server';

// Obtener productos activos
export async function getActiveProducts() {
  return await prisma.product.findMany({
    where: { isActive: true },
    include: {
      subcategory: {
        include: {
          category: true
        }
      },
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

// Obtener categorías activas con sus productos
export async function getActiveCategories() {
  return await prisma.category.findMany({
    where: { isActive: true },
    include: {
      subcategories: {
        where: { isActive: true },
        include: {
          products: {
            where: { isActive: true }
          }
        }
      }
    }
  });
}

// Verificar si un producto está activo
export async function isProductActive(productId: string): Promise<boolean> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { isActive: true }
  });
  return product?.isActive ?? false;
}

// Activar/desactivar producto
export async function toggleProductStatus(productId: string, isActive: boolean) {
  return await prisma.product.update({
    where: { id: productId },
    data: { isActive }
  });
}