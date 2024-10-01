"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderStatusService = void 0;
const common_1 = require("@nestjs/common");
const models_1 = require("../models");
const whatsAppUtils_1 = require("../utils/whatsAppUtils");
let OrderStatusService = class OrderStatusService {
    constructor() {
        this.statusMessages = {
            accepted: "Tu pedido #{orderId} ha sido aceptado y pronto comenzará a prepararse.",
            in_preparation: "Buenas noticias! Tu pedido #{orderId} está siendo preparado.",
            prepared: "Tu pedido #{orderId} está listo para ser entregado.",
            in_delivery: "Tu pedido #{orderId} está en camino. Pronto llegará a tu ubicación.",
            finished: "Tu pedido #{orderId} ha sido entregado. Esperamos que lo disfrutes!",
            canceled: "Lo sentimos, tu pedido #{orderId} ha sido cancelado. Por favor, contáctanos si tienes alguna pregunta.",
        };
    }
    async updateOrderStatus(updateOrderStatusDto) {
        const { orderId, newStatus } = updateOrderStatusDto;
        if (!orderId || !newStatus) {
            throw new common_1.BadRequestException("Se requieren orderId y newStatus.");
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
            throw new common_1.BadRequestException("Estado no válido.");
        }
        const order = await models_1.Order.findByPk(orderId);
        if (!order) {
            throw new common_1.NotFoundException("Orden no encontrada.");
        }
        order.status = newStatus;
        await order.save();
        if (this.statusMessages[newStatus]) {
            const message = this.statusMessages[newStatus].replace("{orderId}", orderId);
            await (0, whatsAppUtils_1.sendWhatsAppMessage)(order.clientId, message);
        }
        return { message: "Estado de la orden actualizado con éxito", order };
    }
};
exports.OrderStatusService = OrderStatusService;
exports.OrderStatusService = OrderStatusService = __decorate([
    (0, common_1.Injectable)()
], OrderStatusService);
//# sourceMappingURL=order-status.service.js.map