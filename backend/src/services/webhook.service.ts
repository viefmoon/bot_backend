import { Injectable } from "@nestjs/common";
import { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import { handleWebhookVerification } from "../handlers/webhookVerificationHandler";
import { handleWhatsAppWebhook } from "../handlers/whatsAppWebhookHandler";
import { OtpService } from "./otp.service";
import { RawBodyRequest } from "@nestjs/common";
import Stripe from "stripe";
import { Order, Customer } from "../models";
import { sendWhatsAppMessage } from "../utils/whatsAppUtils";

@Injectable()
export class WebhookService {
  private stripeClient: Stripe;

  constructor(
    private configService: ConfigService,
    private otpService: OtpService
  ) {
    this.stripeClient = new Stripe(
      this.configService.get<string>("STRIPE_SECRET_KEY")!,
      {
        apiVersion: "2024-06-20",
      }
    );
  }

  async handleWebhookVerification(req: Request, res: Response) {
    handleWebhookVerification(req, res);
  }

  async handleStripeWebhook(
    req: RawBodyRequest<Request>,
    res: Response
  ): Promise<void> {
    const sig = req.headers["stripe-signature"] as string;
    let event: Stripe.Event;

    try {
      event = this.stripeClient.webhooks.constructEvent(
        req.rawBody,
        sig,
        this.configService.get<string>("STRIPE_WEBHOOK_SECRET")!
      );
    } catch (err) {
      console.error(`Error de firma de webhook: ${(err as Error).message}`);
      res.status(400).send(`Webhook Error: ${(err as Error).message}`);
      return;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const order = await Order.findOne({
        where: { stripeSessionId: session.id },
      });
      if (order) {
        await order.update({ paymentStatus: "paid" });
        const customer = await Customer.findOne({
          where: { stripeCustomerId: session.customer as string },
        });
        if (customer) {
          await sendWhatsAppMessage(
            customer.clientId,
            `¡Tu pago para la orden #${order.dailyOrderNumber} ha sido confirmado! 🎉✅ Gracias por tu compra. 🛍️😊`
          );
        }
      }
    }

    res.json({ received: true });
  }

  async handleWhatsAppWebhook(req: Request, res: Response) {
    await handleWhatsAppWebhook(req, res, this.otpService);
  }
}
