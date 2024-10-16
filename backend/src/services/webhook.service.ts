import { Injectable } from "@nestjs/common";
import { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import { handleWebhookVerification } from "../handlers/webhookVerificationHandler";
import { OtpService } from "./otp.service";
import { RawBodyRequest } from "@nestjs/common";
import Stripe from "stripe";
import {
  Order,
  Customer,
  BannedCustomer,
  MessageLog,
  CustomerDeliveryInfo,
  RestaurantConfig,
} from "../models";
import { sendWhatsAppMessage } from "../utils/whatsAppUtils";
import { verificarHorarioAtencion } from "../utils/timeUtils";
import { checkMessageRateLimit } from "../utils/messageRateLimit";
import { BANNED_USER_MESSAGE } from "../config/predefinedMessages";
import { handleTextMessage } from "../utils/textMessageHandler";
import { handleInteractiveMessage } from "../utils/interactiveMessageHandler";
import { handleAudioMessage } from "../utils/audioMessageHandler";

interface WhatsAppMessage {
  from: string;
  type: string;
  id: string;
  text?: { body: string };
}

interface WebhookEntry {
  changes: Array<{
    value: {
      messages?: WhatsAppMessage[];
    };
  }>;
}

interface WebhookBody {
  object: string;
  entry: WebhookEntry[];
}

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

  async handleWhatsAppWebhook(req: Request, body: WebhookBody): Promise<void> {
    const { object, entry } = body;

    if (object === "whatsapp_business_account") {
      for (const entryItem of entry) {
        for (const change of entryItem.changes) {
          const { value } = change;
          if (value.messages && value.messages.length > 0) {
            for (const message of value.messages) {
              await this.handleIncomingWhatsAppMessage(message);
            }
          }
        }
      }
    }
  }

  private async handleIncomingWhatsAppMessage(
    message: WhatsAppMessage
  ): Promise<void> {
    const { from, type, id } = message;

    const config = await RestaurantConfig.findOne();

    if (await MessageLog.findOne({ where: { messageId: id } })) {
      return;
    }
    await MessageLog.create({ messageId: id, processed: true });

    let customer = await Customer.findOne({
      where: { clientId: from },
      include: [{ model: CustomerDeliveryInfo, as: "customerDeliveryInfo" }],
    });
    if (!customer) {
      customer = await Customer.create({ clientId: from });
    }

    await customer.update({ lastInteraction: new Date() });

    if (await this.checkBannedCustomer(from)) {
      await this.sendBannedMessage(from);
      return;
    }

    if (await checkMessageRateLimit(from)) return;

    if (!(await verificarHorarioAtencion())) {
      await sendWhatsAppMessage(
        from,
        "Lo sentimos, el restaurante está cerrado en este momento."
      );
      return;
    }

    if (!config || !config.acceptingOrders) {
      await sendWhatsAppMessage(
        from,
        "Lo sentimos, el restaurante no está aceptando pedidos en este momento, puedes intentar más tarde o llamar al restaurante."
      );
      return;
    }

    if (!customer.customerDeliveryInfo) {
      const otp = this.otpService.generateOTP();
      await this.otpService.storeOTP(from, otp);
      const registrationLink = `${process.env.FRONTEND_BASE_URL}/delivery-info-registration/${from}?otp=${otp}`;

      await sendWhatsAppMessage(
        from,
        `¡Hola! 👋 Antes de continuar, necesitamos que registres tu información de entrega. 📝\n\nPor favor, usa este enlace: 🔗 ${registrationLink}\n\n⚠️ Este enlace es válido por un tiempo limitado por razones de seguridad. 🔒`
      );
      return;
    }

    switch (type) {
      case "text":
        await handleTextMessage(from, message.text.body);
        break;
      case "interactive":
        await handleInteractiveMessage(from, message);
        break;
      case "audio":
        await handleAudioMessage(from, message);
        break;
      default:
        console.log(`Tipo de mensaje no manejado: ${type}`);
        await sendWhatsAppMessage(
          from,
          "Lo siento, no puedo procesar este tipo de mensaje. Por favor, envía un mensaje de texto, interactivo o de audio."
        );
    }
  }

  private async checkBannedCustomer(clientId: string): Promise<boolean> {
    return !!(await BannedCustomer.findOne({ where: { clientId } }));
  }

  private async sendBannedMessage(clientId: string): Promise<void> {
    await sendWhatsAppMessage(clientId, BANNED_USER_MESSAGE);
  }
}
