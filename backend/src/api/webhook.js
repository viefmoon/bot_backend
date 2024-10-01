import { handleWebhookVerification } from "../handlers/webhookVerificationHandler";
import { handleStripeWebhook } from "../handlers/stripeWebhookHandler";
import { handleWhatsAppWebhook } from "../handlers/whatsAppWebhookHandler";
import dotenv from "dotenv";
dotenv.config();

export default async function handler(req, res) {
  if (req.method === "GET") {
    handleWebhookVerification(req, res);
  } else if (req.method === "POST") {
    if (req.headers["stripe-signature"]) {
      await handleStripeWebhook(req, res);
    } else {
      await handleWhatsAppWebhook(req, res);
    }
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Método ${req.method} no permitido`);
  }
}
