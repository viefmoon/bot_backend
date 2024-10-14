import Stripe from "stripe";
import { Order, Customer } from "../models";
import { sendWhatsAppMessage } from "../utils/whatsAppUtils";
import { Request, Response } from "express";

import * as dotenv from "dotenv";
dotenv.config();

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20", // Actualizada a la versión más reciente
});

export async function handleStripeWebhook(
  req: Request,
  res: Response
): Promise<void> {
  const sig = req.headers["stripe-signature"] as string;
  let event: Stripe.Event;

  try {
    event = stripeClient.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error(`Error de firma de webhook: ${(err as Error).message}`);
    res.status(400).send(`Webhook Error: ${(err as Error).message}`);
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    try {
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
            `¡Tu pago para la orden #${order.dailyOrderNumber} ha sido confirmado! Gracias por tu compra.`
          );
        }
      }
      res.json({ received: true });
    } catch (error) {
      console.error(
        "Error procesando el evento de checkout completado:",
        error
      );
      res.status(500).json({ error: "Error interno del servidor" });
    }
  } else {
    // Manejar otros tipos de eventos aquí si es necesario
    res.json({ received: true });
  }
}
