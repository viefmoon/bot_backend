import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  RawBodyRequest,
} from "@nestjs/common";
import { Request, Response } from "express";
import { WebhookService } from "../services/webhook.service";
import logger from "../utils/logger";

@Controller("webhook")
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Get()
  async handleWebhookVerification(@Req() req: Request, @Res() res: Response) {
    logger.info("Manejando verificación de webhook");
    return this.webhookService.handleWebhookVerification(req, res);
  }

  @Post()
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response
  ) {
    try {
      if (req.headers["stripe-signature"]) {
        logger.info("Procesando webhook de Stripe");
        return await this.webhookService.handleStripeWebhook(req, res);
      } else {
        logger.info("Procesando webhook de WhatsApp");
        return await this.webhookService.handleWhatsAppWebhook(req, res);
      }
    } catch (error) {
      logger.error("Error al procesar el webhook:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  }
}
