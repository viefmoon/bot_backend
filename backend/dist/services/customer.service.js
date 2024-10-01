"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerService = void 0;
const common_1 = require("@nestjs/common");
const models_1 = require("../models");
let CustomerService = class CustomerService {
    async banCustomer(clientId, action) {
        const customer = await models_1.Customer.findOne({ where: { clientId } });
        if (!customer) {
            throw new Error("Cliente no encontrado");
        }
        if (action === "ban") {
            const [bannedCustomer, created] = await models_1.BannedCustomer.findOrCreate({
                where: { clientId },
            });
            return {
                message: created
                    ? "Cliente baneado exitosamente"
                    : "El cliente ya está baneado",
                alreadyBanned: !created,
            };
        }
        else if (action === "unban") {
            const deletedCount = await models_1.BannedCustomer.destroy({
                where: { clientId },
            });
            return {
                message: deletedCount > 0
                    ? "Cliente desbaneado exitosamente"
                    : "El cliente no está baneado",
                alreadyBanned: deletedCount === 0,
            };
        }
        throw new Error("Acción no válida");
    }
    async getCustomers() {
        const customers = await models_1.Customer.findAll({
            attributes: [
                "clientId",
                "stripeCustomerId",
                "lastInteraction",
                "createdAt",
            ],
            include: [
                {
                    model: models_1.CustomerDeliveryInfo,
                    as: "customerDeliveryInfo",
                    attributes: ["streetAddress", "pickupName"],
                },
            ],
        });
        return Promise.all(customers.map(async (customer) => {
            const bannedCustomer = await models_1.BannedCustomer.findOne({
                where: { clientId: customer.clientId },
            });
            return Object.assign(Object.assign({}, customer.toJSON()), { isBanned: !!bannedCustomer });
        }));
    }
    async getCustomerChatHistory(clientId) {
        const customer = await models_1.Customer.findOne({
            where: { clientId },
            attributes: ["fullChatHistory"],
        });
        if (!customer) {
            throw new common_1.NotFoundException("Cliente no encontrado");
        }
        return customer.fullChatHistory;
    }
};
exports.CustomerService = CustomerService;
exports.CustomerService = CustomerService = __decorate([
    (0, common_1.Injectable)()
], CustomerService);
//# sourceMappingURL=customer.service.js.map