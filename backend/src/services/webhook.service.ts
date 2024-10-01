import { Injectable } from "@nestjs/common";
import { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import { handleWebhookVerification } from "../handlers/webhookVerificationHandler";
import { handleStripeWebhook } from "../handlers/stripeWebhookHandler";
import { handleWhatsAppWebhook } from "../handlers/whatsAppWebhookHandler";

@Injectable()
export class WebhookService {
  constructor(private configService: ConfigService) {}

  async handleWebhookVerification(req: Request, res: Response) {
    handleWebhookVerification(req, res);
  }

  async handleStripeWebhook(req: Request, res: Response) {
    await handleStripeWebhook(req, res);
  }

  async handleWhatsAppWebhook(req: Request, res: Response) {
    await handleWhatsAppWebhook(req, res);
  }
}
