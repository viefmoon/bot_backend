import { Injectable } from "@nestjs/common";
import { Request, Response } from "express";
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
import {
  sendWhatsAppMessage,
} from "../utils/whatsAppUtils";
import { getUTCTime, isBusinessOpen } from "../utils/timeUtils";
import { checkMessageRateLimit } from "../utils/messageRateLimit";
import {
  BANNED_USER_MESSAGE,
  DELIVERY_INFO_REGISTRATION_MESSAGE,
  PAYMENT_CONFIRMATION_MESSAGE,
  RESTAURANT_NOT_ACCEPTING_ORDERS_MESSAGE,
} from "../config/predefinedMessages";
import { handleTextMessage } from "../utils/handlers/textMessageHandler";
import { handleInteractiveMessage } from "../utils/handlers/interactiveMessageHandler";
import {
  handleAudioMessage,
  TranscriptionModel,
} from "../utils/handlers/audioMessageHandler";
import { Queue } from "queue-typescript";
import * as moment from "moment-timezone";
import { RESTAURANT_CLOSED_MESSAGE } from "../config/predefinedMessages";
import { WhatsAppMessage, WebhookBody } from "../types/webhook.types";
import * as dotenv from "dotenv";
import logger from "../utils/logger";

dotenv.config();

@Injectable()
export class WebhookService {
  private stripeClient: Stripe;
  private customerQueues: Map<string, Queue<WhatsAppMessage>> = new Map();
  private processingCustomers: Set<string> = new Set();

  constructor(private otpService: OtpService) {
    this.stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2024-10-28.acacia",
    });
  }

  async handleWebhookVerification(req: Request, res: Response) {
    try {
      const {
        "hub.mode": mode,
        "hub.verify_token": token,
        "hub.challenge": challenge,
      } = req.query as { [key: string]: string };

      logger.info(`Modo recibido: ${mode}`);
      logger.info(`Token recibido: ${token}`);
      logger.info(`Token esperado: ${process.env.WHATSAPP_VERIFY_TOKEN}`);

      if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        logger.info("Webhook verificado exitosamente");
        res.status(200).send(challenge);
      } else {
        logger.error("Fallo en la verificación del webhook");
        res.status(403).end();
      }
    } catch (error) {
      logger.error(`Error en la verificación del webhook: ${error}`);
      res.status(500).end();
    }
  }

  config = {
    api: {
      bodyParser: false,
    },
  };

  async handleStripeWebhook(req: Request, res: Response): Promise<void> {
    const sig = req.headers["stripe-signature"] as string;
    const rawBodyBuffer = (req as any).rawBody;
    const rawBody = rawBodyBuffer.toString("utf-8");
    console.log("rawBody", rawBody);

    try {
      const event = this.stripeClient.webhooks.constructEvent(
        rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );

      logger.info(`Evento de Stripe recibido: ${event.type}`);

      if (event.type === "checkout.session.completed") {
        try {
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
                customer.customerId,
                PAYMENT_CONFIRMATION_MESSAGE(order.dailyOrderNumber)
              );
              // await sendWhatsAppNotification(
              //   "Se ha realizado el pago de un pedido"
              // );
            }
          }
        } catch (error) {
          logger.error(
            `Error al procesar el evento de pago completado: ${error}`
          );
        }
      }

      res.json({ received: true });
    } catch (err) {
      logger.error(`Error de firma de webhook: ${(err as Error).message}`);
      res.status(400).send(`Webhook Error: ${(err as Error).message}`);
      return;
    }
  }

  async handleWhatsAppWebhook(req: Request, res: Response): Promise<void> {
    const body = req.body as WebhookBody;

    if (
      body.object !== "whatsapp_business_account" ||
      !body.entry ||
      !Array.isArray(body.entry)
    ) {
      logger.warn("Webhook inválido o no es de WhatsApp Business");
      res.sendStatus(400);
      return;
    }

    const messages = body.entry.flatMap(
      (entry) =>
        entry.changes?.flatMap((change) => change.value?.messages || []) || []
    );

    if (messages.length === 0) {
      res.sendStatus(200);
      return;
    }

    res.sendStatus(200);

    try {
      for (const message of messages) {
        if (!this.isMessageTooOld(message)) {
          this.enqueueMessage(message);
        } else {
          logger.info(`Mensaje ${message.id} es demasiado antiguo, ignorando.`);
        }
      }

      this.processCustomerQueues();
    } catch (error) {
      logger.error(`Error al procesar el webhook de WhatsApp: ${error}`);
    }
  }

  private enqueueMessage(message: WhatsAppMessage): void {
    const customerId = message.from;
    if (!this.customerQueues.has(customerId)) {
      this.customerQueues.set(customerId, new Queue<WhatsAppMessage>());
    }
    this.customerQueues.get(customerId).enqueue(message);
  }

  private async processCustomerQueues(): Promise<void> {
    for (const [customerId, queue] of this.customerQueues.entries()) {
      if (!this.processingCustomers.has(customerId) && queue.length > 0) {
        this.processCustomerQueue(customerId);
      }
    }
  }

  private async processCustomerQueue(customerId: string): Promise<void> {
    this.processingCustomers.add(customerId);

    const queue = this.customerQueues.get(customerId);
    while (queue.length > 0) {
      const message = queue.dequeue();
      logger.info(`Procesando mensaje ${message.id} del cliente ${customerId}`);

      try {
        // Establecer un tiempo límite de 20 segundos para procesar cada mensaje
        await Promise.race([
          this.handleIncomingWhatsAppMessage(message),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Tiempo de espera agotado")),
              20000
            )
          ),
        ]);
      } catch (error) {
        logger.error(
          `Error al procesar mensaje ${message.id}: ${error.message}`
        );
        try {
          await sendWhatsAppMessage(
            customerId,
            "Lo siento, ha ocurrido un error al procesar tu mensaje. 😔 Por favor, intenta nuevamente más tarde. 🔄🕑"
          );
        } catch (sendError) {
          logger.error(`Error al enviar mensaje de error: ${sendError}`);
        }
      }
    }

    this.processingCustomers.delete(customerId);
    this.customerQueues.delete(customerId);

    // Verificar si hay más colas para procesar
    this.processCustomerQueues();
  }

  private isMessageTooOld(message: WhatsAppMessage): boolean {
    const messageTimestamp = moment(parseInt(message.timestamp) * 1000);
    const currentTime = getUTCTime();
    const differenceInMinutes = currentTime.diff(messageTimestamp, "minutes");
    return differenceInMinutes > 1; // Ignorar mensajes de más de 1 minuto
  }

  private async handleIncomingWhatsAppMessage(
    message: WhatsAppMessage
  ): Promise<void> {
    const { from, type, id } = message;

    try {
      const config = await RestaurantConfig.findOne();

      if (await MessageLog.findOne({ where: { messageId: id } })) {
        return;
      }
      await MessageLog.create({ messageId: id, processed: true });

      let customer = await Customer.findOne({
        where: { customerId: from },
        include: [{ model: CustomerDeliveryInfo, as: "customerDeliveryInfo" }],
      });
      if (!customer) {
        customer = await Customer.create({ customerId: from });
      }

      await customer.update({ lastInteraction: new Date() });

      if (await this.checkBannedCustomer(from)) {
        await this.sendBannedMessage(from);
        return;
      }

      if (await checkMessageRateLimit(from)) return;

      // if (!isBusinessOpen()) {
      //   await sendWhatsAppMessage(from, RESTAURANT_CLOSED_MESSAGE);
      //   return;
      // }

      if (!config || !config.acceptingOrders) {
        await sendWhatsAppMessage(
          from,
          RESTAURANT_NOT_ACCEPTING_ORDERS_MESSAGE
        );
        return;
      }
      if (!customer.customerDeliveryInfo) {
        const otp = this.otpService.generateOTP();
        await this.otpService.storeOTP(from, otp);
        const registrationLink = `${process.env.FRONTEND_BASE_URL}/delivery-info-registration/${from}?otp=${otp}`;

        await sendWhatsAppMessage(
          from,
          DELIVERY_INFO_REGISTRATION_MESSAGE(registrationLink)
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
          await handleAudioMessage(from, message, TranscriptionModel.GEMINI);
          break;
        default:
          logger.info(`Tipo de webhook de WhatsApp no manejado: ${type}`);
          await sendWhatsAppMessage(
            from,
            "Lo siento, no puedo procesar este tipo de mensaje. 😅 Por favor, envía un mensaje de texto 📝, interactivo 🔘 o de audio 🎤."
          );
      }
    } catch (error) {
      logger.error(
        `Error al procesar el mensaje de WhatsApp: ${error.message}`
      );
      await sendWhatsAppMessage(
        from,
        "Lo siento, ha ocurrido un error al procesar tu mensaje. 😔 Por favor, intenta nuevamente más tarde. 🔄🕑"
      );
    }
  }

  private async checkBannedCustomer(customerId: string): Promise<boolean> {
    return !!(await BannedCustomer.findOne({ where: { customerId } }));
  }

  private async sendBannedMessage(customerId: string): Promise<void> {
    await sendWhatsAppMessage(customerId, BANNED_USER_MESSAGE);
  }
}
