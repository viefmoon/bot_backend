export interface NewOrder {
  id: number;
  telefono: string;
  informacion_entrega: string;
  precio_total: number;
  fecha_creacion: string;
  horario_entrega_programado: string | null;
  tiempoEstimado: number;
  productos: OrderProduct[];
}

export interface OrderProduct {
  nombre: string;
  cantidad: number;
  precio: number;
  modificadores: { nombre: string; precio: number }[];
  pizzaCustomizations?: { mitad: string; nombre: string; action?: string; tipo?: string; ingredientes?: string }[];
  comments?: string;
}

export interface OrderSummaryResult {
  newOrder: NewOrder;
  orderSummary: string;
}
