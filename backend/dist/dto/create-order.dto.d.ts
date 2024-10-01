declare class OrderItemDto {
    productId: string;
    productVariantId?: string;
    selectedPizzaIngredients: SelectedPizzaIngredientDto[];
    selectedModifiers: SelectedModifierDto[];
    quantity: number;
    comments?: string;
}
declare class SelectedPizzaIngredientDto {
    pizzaIngredientId: string;
    half: string;
    action: string;
}
declare class SelectedModifierDto {
    modifierId: string;
}
declare class OrderDeliveryInfoDto {
    streetAddress: string;
    pickupName: string;
}
export declare class CreateOrderDto {
    orderType: string;
    orderItems: OrderItemDto[];
    orderDeliveryInfo?: OrderDeliveryInfoDto;
    clientId: string;
    scheduledDeliveryTime?: string;
}
export {};
