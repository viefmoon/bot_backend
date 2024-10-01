"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationPhoneService = void 0;
const common_1 = require("@nestjs/common");
const models_1 = require("../models");
let NotificationPhoneService = class NotificationPhoneService {
    async getPhones() {
        return models_1.NotificationPhone.findAll({
            attributes: ["id", "phoneNumber", "isActive"],
        });
    }
    async addPhone(phoneNumber) {
        const [phone, created] = await models_1.NotificationPhone.findOrCreate({
            where: { phoneNumber },
            defaults: { isActive: true },
        });
        if (!created) {
            throw new common_1.ConflictException("El número de teléfono ya existe");
        }
        return phone;
    }
    async updatePhone(id, phoneData) {
        const [updatedCount] = await models_1.NotificationPhone.update(phoneData, {
            where: { id },
        });
        if (updatedCount === 0) {
            throw new common_1.NotFoundException("Número de teléfono no encontrado");
        }
        return models_1.NotificationPhone.findByPk(id);
    }
    async deletePhone(id) {
        const deletedCount = await models_1.NotificationPhone.destroy({ where: { id } });
        if (deletedCount === 0) {
            throw new common_1.NotFoundException("Número de teléfono no encontrado");
        }
        return { message: "Número de teléfono eliminado con éxito" };
    }
};
exports.NotificationPhoneService = NotificationPhoneService;
exports.NotificationPhoneService = NotificationPhoneService = __decorate([
    (0, common_1.Injectable)()
], NotificationPhoneService);
//# sourceMappingURL=notification-phone.service.js.map