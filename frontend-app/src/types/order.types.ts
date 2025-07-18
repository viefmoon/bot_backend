export interface Order {
  id: string;
  dailyNumber: number;
  status: string;
  total: number;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productName: string;
  quantity: number;
  price: number;
}