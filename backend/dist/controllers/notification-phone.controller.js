"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationPhoneController = void 0;
const common_1 = require("@nestjs/common");
const notification_phone_service_1 = require("../services/notification-phone.service");
let NotificationPhoneController = class NotificationPhoneController {
    constructor(notificationPhoneService) {
        this.notificationPhoneService = notificationPhoneService;
    }
    async getPhones() {
        return this.notificationPhoneService.getPhones();
    }
    async addPhone(phoneData) {
        return this.notificationPhoneService.addPhone(phoneData.phoneNumber);
    }
    async updatePhone(id, phoneData) {
        return this.notificationPhoneService.updatePhone(id, phoneData);
    }
    async deletePhone(id) {
        return this.notificationPhoneService.deletePhone(id);
    }
};
exports.NotificationPhoneController = NotificationPhoneController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], NotificationPhoneController.prototype, "getPhones", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationPhoneController.prototype, "addPhone", null);
__decorate([
    (0, common_1.Put)(":id"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], NotificationPhoneController.prototype, "updatePhone", null);
__decorate([
    (0, common_1.Delete)(":id"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], NotificationPhoneController.prototype, "deletePhone", null);
exports.NotificationPhoneController = NotificationPhoneController = __decorate([
    (0, common_1.Controller)("notification-phones"),
    __metadata("design:paramtypes", [notification_phone_service_1.NotificationPhoneService])
], NotificationPhoneController);
//# sourceMappingURL=notification-phone.controller.js.map