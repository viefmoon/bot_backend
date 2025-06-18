export interface ProductoInfo {
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
