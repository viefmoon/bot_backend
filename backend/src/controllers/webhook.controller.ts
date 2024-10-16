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

@Controller("webhook")
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Get()
  async handleWebhookVerification(@Req() req: Request, @Res() res: Response) {
    return this.webhookService.handleWebhookVerification(req, res);
  }

  @Post()
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response
  ) {
    try {
      if (req.headers["stripe-signature"]) {
        console.log("Procesando webhook de Stripe");
        return await this.webhookService.handleStripeWebhook(req, res);
      }
      const body = req.body;
      if (
        body.entry &&
        body.entry[0].changes &&
        body.entry[0].changes[0].value.messages
      ) {
        console.log("Procesando webhook de mensaje entrante de WhatsApp");
        return await this.webhookService.handleWhatsAppWebhook(req, res);
      } else {
        console.log(
          "Ignorando webhook de WhatsApp que no es de mensaje entrante"
        );
        return res.sendStatus(200);
      }
    } catch (error) {
      console.error("Error al procesar el webhook:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  }
}
