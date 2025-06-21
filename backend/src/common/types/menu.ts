export interface ProductoInfo {
  productId: string;
  name: string;
  productVariants?: Array<{
    productVariantId: string;
    name: string;
  }>;
  modifierGroups?: Array<{
    modifierGroupId: string;
    name: string;
    minSelections: number;
    maxSelections: number;
    isRequired: boolean;
    allowMultipleSelections: boolean;
    productModifiers?: Array<{
      productModifierId: string;
      name: string;
    }>;
  }>;
  pizzaCustomizations?: Array<{
    pizzaCustomizationId: string;
    name: string;
    type: 'FLAVOR' | 'INGREDIENT';
    ingredients?: string;
  }>;
}
