export interface FormattedOrder {
  id?: string;
  dailyNumber?: number;
  orderType?: string;
  customerId?: string;
  phoneNumber: string;
  deliveryInfo: string;
  totalPrice: number;
  createdAt: string;
  scheduledDeliveryTime: string | null;
  estimatedDeliveryTime?: string;
  products: FormattedOrderProduct[];
}

export interface FormattedOrderProduct {
  name: string;
  quantity: number;
  price: number;
  modifiers: { name: string; price: number }[];
  pizzaCustomizations?: { 
    half: string; 
    name: string; 
    action?: string; 
    type?: string; 
    ingredients?: string;
  }[];
  comments?: string;
}

export interface OrderSummaryResult {
  formattedOrder: FormattedOrder;
  orderSummary: string;
}
