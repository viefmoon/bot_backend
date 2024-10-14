import { Controller, Get, Post, Req, Res } from "@nestjs/common";
import { Request, Response } from "express";
import { WebhookService } from "../services/webhook.service";

@Controller("webhook")
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Get()
  async handleWebhookVerification(@Req() req: Request, @Res() res: Response) {
    return this.webhookService.handleWebhookVerification(req, res);
  }

  @Post()
  async handleWebhook(@Req() req: Request, @Res() res: Response) {
    console.log("req.headers", req.headers);
    try {
      if (req.headers["stripe-signature"]) {
        await this.webhookService.handleStripeWebhook(req, res);
      } else {
        await this.webhookService.handleWhatsAppWebhook(req, res);
      }
    } catch (error) {
      console.error("Error en el manejo del webhook:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error interno del servidor" });
      }
    }
  }
}
