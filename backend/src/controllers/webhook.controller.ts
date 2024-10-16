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
      } else {
        const body = req.body;
        const events = body.entry?.[0]?.changes?.[0]?.value?.messages;

        if (events && events.length > 0) {
          console.log("Recibido webhook de mensaje entrante de WhatsApp");
          res.sendStatus(200);
          this.webhookService
            .handleWhatsAppWebhook(req, body)
            .catch((error) => {
              console.error("Error al procesar el webhook de WhatsApp:", error);
            });

          return;
        } else {
          return res.sendStatus(200);
        }
      }
    } catch (error) {
      console.error("Error al procesar el webhook:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  }
}
