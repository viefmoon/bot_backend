import { prisma } from '../../../lib/prisma';
import { BaseOrderItem } from '../../../common/types';
import { ValidationError, ErrorCode } from '../../../common/services/errors';
import { Product, ModifierGroup, ProductVariant, PizzaCustomization } from '@prisma/client';
import logger from '../../../common/utils/logger';

// Interfaz para estructurar los detalles de cada error individual
interface ValidationErrorDetail {
  code: ErrorCode;
  message: string;
  context: Record<string, any>;
  itemIndex?: number; // Para identificar qué item del pedido tiene el error
}

// Tipo extendido para incluir relaciones necesarias para la validación
type ProductWithDetails = Product & {
  variants: ProductVariant[];
  modifierGroups: (ModifierGroup & {
    productModifiers: { id: string; name: string; isActive: boolean }[];
  })[];
  pizzaCustomizations: PizzaCustomization[];
};

export class OrderItemValidatorService {
  /**
   * Valida una lista de orderItems contra las reglas del negocio.
   * Lanza un ValidationError si alguna regla no se cumple.
   * @param items - La lista de BaseOrderItem a validar.
   */
  public static async validateOrderItems(items: BaseOrderItem[]): Promise<void> {
    logger.info(`Starting order items validation for ${items.length} items`);
    
    if (!items || items.length === 0) {
      throw new ValidationError(ErrorCode.EMPTY_ORDER, 'La orden no puede estar vacía.');
    }

    const errors: ValidationErrorDetail[] = [];
    const productIds = [...new Set(items.map(item => item.productId))];
    const products = await this.fetchProductDetails(productIds);
    const productMap = new Map(products.map(p => [p.id, p]));

    // Validar cada item y acumular errores
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const product = productMap.get(item.productId);
      
      if (!product) {
        errors.push({
          code: ErrorCode.INVALID_PRODUCT,
          message: `El producto con ID '${item.productId}' no se encontró o está inactivo.`,
          context: { 
            productId: item.productId,
            metadata: { 
              productId: item.productId,
              validationFailure: 'PRODUCT_NOT_FOUND'
            }
          },
          itemIndex: i
        });
        continue; // Si el producto no existe, no podemos validar más sobre él
      }
      
      // Validamos este item y acumulamos los errores que encuentre
      this.validateSingleItem(item, product, errors, i);
    }

    // Si encontramos algún error, lanzamos una única excepción con todos los detalles
    if (errors.length > 0) {
      logger.warn(`Validation failed with ${errors.length} errors`);
      
      // Si solo hay un error, lo lanzamos directamente para mantener compatibilidad
      if (errors.length === 1) {
        const error = errors[0];
        throw new ValidationError(error.code, error.message, error.context);
      }
      
      // Si hay múltiples errores, los agrupamos
      throw new ValidationError(
        ErrorCode.MULTIPLE_VALIDATION_ERRORS,
        "Se encontraron múltiples errores de validación en el pedido.",
        { 
          errors,
          errorCount: errors.length,
          metadata: {
            validationFailure: 'MULTIPLE_ERRORS',
            errorSummary: errors.map(e => ({
              code: e.code,
              itemIndex: e.itemIndex,
              productId: e.context.metadata?.productId
            }))
          }
        }
      );
    }
    
    logger.info('Order items validation completed successfully');
  }

  /**
   * Obtiene los detalles completos de los productos necesarios para la validación.
   * IMPORTANTE: No filtramos por isActive para poder detectar si el usuario seleccionó algo inactivo.
   */
  private static async fetchProductDetails(productIds: string[]): Promise<ProductWithDetails[]> {
    return prisma.product.findMany({
      where: { id: { in: productIds } }, // NO filtrar por isActive aquí
      include: {
        variants: {}, // Traer TODAS las variantes
        modifierGroups: {
          include: {
            productModifiers: {
              select: { id: true, name: true, isActive: true }, // Traer todos con su estado
            },
          },
        },
        pizzaCustomizations: {}, // Traer TODAS las personalizaciones
      },
    }) as Promise<ProductWithDetails[]>;
  }

  /**
   * Ejecuta todas las validaciones para un único orderItem.
   */
  private static validateSingleItem(
    item: BaseOrderItem, 
    product: ProductWithDetails, 
    errors: ValidationErrorDetail[],
    itemIndex: number
  ): void {
    logger.debug(`Validating item ${itemIndex} for product: ${product.name}`, { 
      productId: product.id,
      hasVariants: product.hasVariants,
      isPizza: product.isPizza,
      modifierGroupCount: product.modifierGroups.length
    });
    
    // Si la validación de disponibilidad falla con errores críticos, 
    // no continuamos con las otras validaciones para este item
    if (!this.validateActiveness(item, product, errors, itemIndex)) {
      return;
    }
    
    // Continuar con el resto de validaciones
    this.validateVariantRequirement(item, product, errors, itemIndex);
    this.validateModifierGroups(item, product, errors, itemIndex);
    this.validatePizzaCustomizations(item, product, errors, itemIndex);
  }

  /**
   * REGLA: Valida que el producto y todas sus opciones seleccionadas estén activas.
   * @returns false si el producto principal está inactivo (error bloqueante), true en caso contrario
   */
  private static validateActiveness(
    item: BaseOrderItem, 
    product: ProductWithDetails, 
    errors: ValidationErrorDetail[],
    itemIndex: number
  ): boolean {
    let hasBlockingError = false;

    // 1. Validar el producto principal
    if (!product.isActive) {
      errors.push({
        code: ErrorCode.ITEM_NOT_AVAILABLE,
        message: `El producto '${product.name}' ya no está disponible.`,
        context: {
          itemName: product.name,
          itemType: 'Producto',
          metadata: {
            productId: product.id,
            productName: product.name,
            validationFailure: 'PRODUCT_INACTIVE'
          }
        },
        itemIndex
      });
      hasBlockingError = true; // Error bloqueante
    }

    // 2. Validar la variante seleccionada
    if (item.productVariantId && !hasBlockingError) {
      const variant = product.variants.find(v => v.id === item.productVariantId);
      if (!variant || !variant.isActive) {
        const itemName = variant ? variant.name : `variante con ID ${item.productVariantId}`;
        errors.push({
          code: ErrorCode.ITEM_NOT_AVAILABLE,
          message: `La opción '${itemName}' ya no está disponible.`,
          context: {
            itemName: itemName,
            itemType: 'Variante',
            metadata: {
              productId: product.id,
              productName: product.name,
              variantId: item.productVariantId,
              variantName: variant?.name,
              validationFailure: 'VARIANT_INACTIVE'
            }
          },
          itemIndex
        });
      }
    }

    // 3. Validar los modificadores seleccionados
    if (item.selectedModifiers && item.selectedModifiers.length > 0 && !hasBlockingError) {
      const allModifiers = product.modifierGroups.flatMap(g => g.productModifiers);
      for (const modifierId of item.selectedModifiers) {
        const modifier = allModifiers.find(m => m.id === modifierId);
        if (!modifier || !modifier.isActive) {
          const itemName = modifier ? modifier.name : `modificador con ID ${modifierId}`;
          errors.push({
            code: ErrorCode.ITEM_NOT_AVAILABLE,
            message: `El modificador '${itemName}' ya no está disponible.`,
            context: {
              itemName: itemName,
              itemType: 'Modificador',
              metadata: {
                productId: product.id,
                productName: product.name,
                modifierId: modifierId,
                modifierName: modifier?.name,
                validationFailure: 'MODIFIER_INACTIVE'
              }
            },
            itemIndex
          });
        }
      }
    }
    
    // 4. Validar las personalizaciones de pizza seleccionadas
    if (item.selectedPizzaCustomizations && item.selectedPizzaCustomizations.length > 0 && !hasBlockingError) {
      for (const custom of item.selectedPizzaCustomizations) {
        const pizzaCustom = product.pizzaCustomizations.find(pc => pc.id === custom.pizzaCustomizationId);
        if (!pizzaCustom || !pizzaCustom.isActive) {
          const itemName = pizzaCustom ? pizzaCustom.name : `personalización con ID ${custom.pizzaCustomizationId}`;
          errors.push({
            code: ErrorCode.ITEM_NOT_AVAILABLE,
            message: `La personalización de pizza '${itemName}' ya no está disponible.`,
            context: {
              itemName: itemName,
              itemType: 'Personalización',
              metadata: {
                productId: product.id,
                productName: product.name,
                customizationId: custom.pizzaCustomizationId,
                customizationName: pizzaCustom?.name,
                validationFailure: 'PIZZA_CUSTOMIZATION_INACTIVE'
              }
            },
            itemIndex
          });
        }
      }
    }

    return !hasBlockingError; // Continuar con otras validaciones solo si no hay error bloqueante
  }

  /**
   * REGLA: Si un producto tiene variantes, se debe seleccionar una.
   */
  private static validateVariantRequirement(
    item: BaseOrderItem, 
    product: ProductWithDetails,
    errors: ValidationErrorDetail[],
    itemIndex: number
  ): void {
    // Solo validar si el producto tiene variantes Y hay variantes activas disponibles
    if (product.hasVariants && !item.productVariantId) {
      const activeVariants = product.variants.filter(v => v.isActive);
      if (activeVariants.length === 0) {
        // Si no hay variantes activas, no podemos procesar este producto
        errors.push({
          code: ErrorCode.ITEM_NOT_AVAILABLE,
          message: `El producto '${product.name}' no tiene opciones disponibles en este momento.`,
          context: {
            itemName: product.name,
            itemType: 'Producto',
            metadata: {
              productId: product.id,
              productName: product.name,
              validationFailure: 'NO_ACTIVE_VARIANTS'
            }
          },
          itemIndex
        });
        return;
      }
      
      const availableVariants = activeVariants.map(v => v.name).join(', ');
      errors.push({
        code: ErrorCode.VARIANT_REQUIRED,
        message: `El producto '${product.name}' requiere que elijas una de las siguientes opciones: ${availableVariants}.`,
        context: {
          productName: product.name,
          variantNames: availableVariants,
          availableVariants: activeVariants.map(v => ({ id: v.id, name: v.name })),
          metadata: {
            productId: product.id,
            productName: product.name,
            validationFailure: 'MISSING_REQUIRED_VARIANT',
            requiresVariant: true,
            availableVariants: activeVariants.map(v => ({ id: v.id, name: v.name }))
          }
        },
        itemIndex
      });
    }
  }

  /**
   * REGLA: Valida los requerimientos de los grupos de modificadores (min/max/required).
   */
  private static validateModifierGroups(
    item: BaseOrderItem, 
    product: ProductWithDetails,
    errors: ValidationErrorDetail[],
    itemIndex: number
  ): void {
    const selectedModifierIds = new Set(item.selectedModifiers || []);
    
    // Solo validar grupos activos
    const activeModifierGroups = product.modifierGroups.filter(g => g.isActive);

    for (const group of activeModifierGroups) {
      const groupModifierIds = new Set(group.productModifiers.map(m => m.id));
      const selectionsInGroup = [...selectedModifierIds].filter(id => groupModifierIds.has(id));
      const selectionCount = selectionsInGroup.length;

      // Validar si es requerido
      if (group.isRequired && selectionCount === 0) {
        errors.push({
          code: ErrorCode.MODIFIER_GROUP_REQUIRED,
          message: `Para el producto '${product.name}', es necesario que elijas una opción del grupo '${group.name}'.`,
          context: {
            productName: product.name,
            groupName: group.name,
            metadata: {
              productId: product.id,
              productName: product.name,
              modifierGroupId: group.id,
              modifierGroupName: group.name,
              validationFailure: 'MISSING_REQUIRED_MODIFIER_GROUP'
            }
          },
          itemIndex
        });
        continue;
      }

      // Validar selecciones mínimas (solo si se seleccionó algo o si es requerido)
      if (selectionCount < group.minSelections && (selectionCount > 0 || group.isRequired)) {
        errors.push({
          code: ErrorCode.MODIFIER_SELECTION_COUNT_INVALID,
          message: `Para el grupo de modificadores '${group.name}', debes seleccionar al menos ${group.minSelections} opción(es).`,
          context: {
            productName: product.name,
            groupName: group.name,
            range: `al menos ${group.minSelections}`,
            min: group.minSelections,
            max: group.maxSelections,
            selected: selectionCount,
            metadata: {
              productId: product.id,
              productName: product.name,
              modifierGroupId: group.id,
              modifierGroupName: group.name,
              validationFailure: 'MODIFIER_COUNT_TOO_LOW',
              minSelections: group.minSelections,
              maxSelections: group.maxSelections,
              currentSelections: selectionCount
            }
          },
          itemIndex
        });
      }

      // Validar selecciones máximas
      if (selectionCount > group.maxSelections) {
        errors.push({
          code: ErrorCode.MODIFIER_SELECTION_COUNT_INVALID,
          message: `Para el grupo de modificadores '${group.name}', puedes seleccionar como máximo ${group.maxSelections} opción(es).`,
          context: {
            productName: product.name,
            groupName: group.name,
            range: `como máximo ${group.maxSelections}`,
            min: group.minSelections,
            max: group.maxSelections,
            selected: selectionCount,
            metadata: {
              productId: product.id,
              productName: product.name,
              modifierGroupId: group.id,
              modifierGroupName: group.name,
              validationFailure: 'MODIFIER_COUNT_TOO_HIGH',
              minSelections: group.minSelections,
              maxSelections: group.maxSelections,
              currentSelections: selectionCount
            }
          },
          itemIndex
        });
      }
    }
  }

  /**
   * REGLA: Valida las personalizaciones para productos que son pizzas.
   */
  private static validatePizzaCustomizations(
    item: BaseOrderItem, 
    product: ProductWithDetails,
    errors: ValidationErrorDetail[],
    itemIndex: number
  ): void {
    if (!product.isPizza) {
      return;
    }

    const customizations = item.selectedPizzaCustomizations || [];

    // REGLA: Una pizza debe tener al menos una personalización de tipo 'ADD'.
    const hasAddedCustomization = customizations.some(c => c.action === 'ADD');
    if (!hasAddedCustomization) {
      errors.push({
        code: ErrorCode.PIZZA_CUSTOMIZATION_REQUIRED,
        message: `Para pedir la pizza '${product.name}', debes seleccionar al menos un sabor o ingrediente.`,
        context: {
          productName: product.name,
          metadata: {
            productId: product.id,
            productName: product.name,
            validationFailure: 'PIZZA_MISSING_ADD_CUSTOMIZATION'
          }
        },
        itemIndex
      });
    }
    
    // REGLA: No se puede tener un sabor 'FULL' y al mismo tiempo un sabor en 'HALF_1' o 'HALF_2'.
    const hasFullFlavor = customizations.some(c => c.half === 'FULL');
    const hasHalfFlavor = customizations.some(c => c.half === 'HALF_1' || c.half === 'HALF_2');

    if (hasFullFlavor && hasHalfFlavor) {
      errors.push({
        code: ErrorCode.INVALID_PIZZA_CONFIGURATION,
        message: `No puedes combinar un sabor de pizza completa con sabores de mitades. Por favor, elige una pizza de un solo sabor o una de dos mitades.`,
        context: {
          productName: product.name,
          details: "Conflicto entre personalización FULL y HALF.",
          metadata: {
            productId: product.id,
            productName: product.name,
            validationFailure: 'PIZZA_FULL_HALF_CONFLICT',
            hasFullFlavor,
            hasHalfFlavor
          }
        },
        itemIndex
      });
    }
    
    // REGLA ADICIONAL: Validar que no haya más de 1 sabor principal para pizzas de mitades
    const halfFlavorCount = new Map<string, number>();
    customizations
      .filter(c => c.action === 'ADD' && c.half !== 'FULL')
      .forEach(c => {
        halfFlavorCount.set(c.half, (halfFlavorCount.get(c.half) || 0) + 1);
      });
    
    for (const [half, count] of halfFlavorCount.entries()) {
      if (count > 1) {
        errors.push({
          code: ErrorCode.INVALID_PIZZA_CONFIGURATION,
          message: `Solo puedes seleccionar un sabor principal para cada mitad de la pizza. Has seleccionado ${count} sabores para la ${half === 'HALF_1' ? 'primera mitad' : 'segunda mitad'}.`,
          context: {
            productName: product.name,
            details: `Demasiados sabores en ${half}`,
            metadata: {
              productId: product.id,
              productName: product.name,
              validationFailure: 'PIZZA_TOO_MANY_FLAVORS_PER_HALF',
              half,
              flavorCount: count
            }
          },
          itemIndex
        });
      }
    }
  }
}