import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { UpdateOrderStatusDto } from "../dto/update-order-status.dto";
import { Order } from "../models";
import { sendWhatsAppMessage } from "../utils/whatsAppUtils";

@Injectable()
export class OrderStatusService {
  private readonly statusMessages = {
    accepted:
      "Tu pedido #{orderId} ha sido aceptado y pronto comenzará a prepararse.",
    in_preparation:
      "Buenas noticias! Tu pedido #{orderId} está siendo preparado.",
    prepared: "Tu pedido #{orderId} está listo para ser entregado.",
    in_delivery:
      "Tu pedido #{orderId} está en camino. Pronto llegará a tu ubicación.",
    finished:
      "Tu pedido #{orderId} ha sido entregado. Esperamos que lo disfrutes!",
    canceled:
      "Lo sentimos, tu pedido #{orderId} ha sido cancelado. Por favor, contáctanos si tienes alguna pregunta.",
  };

  async updateOrderStatus(updateOrderStatusDto: UpdateOrderStatusDto) {
    const { orderId, newStatus } = updateOrderStatusDto;

    if (!orderId || !newStatus) {
      throw new BadRequestException("Se requieren orderId y newStatus.");
    }

    const validStatuses = [
      "created",
      "accepted",
      "in_preparation",
      "prepared",
      "in_delivery",
      "finished",
      "canceled",
    ];
    if (!validStatuses.includes(newStatus)) {
      throw new BadRequestException("Estado no válido.");
    }

    const order = await Order.findByPk(orderId);

    if (!order) {
      throw new NotFoundException("Orden no encontrada.");
    }

    order.status = newStatus;
    await order.save();

    if (this.statusMessages[newStatus]) {
      const message = this.statusMessages[newStatus].replace(
        "{orderId}",
        orderId
      );
      await sendWhatsAppMessage(order.clientId, message);
    }

    return { message: "Estado de la orden actualizado con éxito", order };
  }
}
