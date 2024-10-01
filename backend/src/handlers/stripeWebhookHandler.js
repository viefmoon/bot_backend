import stripe from "stripe";
import { Order, Customer } from "../models";
import { sendWhatsAppMessage } from "../utils/whatsAppUtils";

import * as dotenv from "dotenv";
dotenv.config();

const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

export async function handleStripeWebhook(req, res) {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripeClient.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`Error de firma de webhook: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const order = await Order.findOne({
      where: { stripeSessionId: session.id },
    });
    if (order) {
      await order.update({ paymentStatus: "paid" });
      const customer = await Customer.findOne({
        where: { stripeCustomerId: session.customer },
      });
      if (customer) {
        await sendWhatsAppMessage(
          customer.clientId,
          `¡Tu pago para la orden #${order.dailyOrderNumber} ha sido confirmado! Gracias por tu compra.`
        );
      }
    }
  }

  res.json({ received: true });
}
