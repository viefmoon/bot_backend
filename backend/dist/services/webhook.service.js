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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const webhookVerificationHandler_1 = require("../handlers/webhookVerificationHandler");
const stripeWebhookHandler_1 = require("../handlers/stripeWebhookHandler");
const whatsAppWebhookHandler_1 = require("../handlers/whatsAppWebhookHandler");
let WebhookService = class WebhookService {
    constructor(configService) {
        this.configService = configService;
    }
    async handleWebhookVerification(req, res) {
        (0, webhookVerificationHandler_1.handleWebhookVerification)(req, res);
    }
    async handleStripeWebhook(req, res) {
        await (0, stripeWebhookHandler_1.handleStripeWebhook)(req, res);
    }
    async handleWhatsAppWebhook(req, res) {
        await (0, whatsAppWebhookHandler_1.handleWhatsAppWebhook)(req, res);
    }
};
exports.WebhookService = WebhookService;
exports.WebhookService = WebhookService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], WebhookService);
//# sourceMappingURL=webhook.service.js.map