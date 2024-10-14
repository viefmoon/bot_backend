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
    console.log("stripe-signature", req.headers["stripe-signature"]);
    console.log("req.body", req.body);
    if (req.headers["stripe-signature"]) {
      return this.webhookService.handleStripeWebhook(req, res);
    } else {
      return this.webhookService.handleWhatsAppWebhook(req, res);
    }
  }
}
