import * as dotenv from "dotenv";
import { Request, Response } from "express";

dotenv.config();

export function handleWebhookVerification(req: Request, res: Response): void {
  const {
    "hub.mode": mode,
    "hub.verify_token": token,
    "hub.challenge": challenge,
  } = req.query as { [key: string]: string };

  // Log the values for debugging
  console.log("Received mode:", mode);
  console.log("Received token:", token);
  console.log("Expected token:", process.env.WHATSAPP_VERIFY_TOKEN);

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log("Webhook verificado exitosamente");
    res.status(200).send(challenge);
  } else {
    console.error("Fallo en la verificación del webhook");
    res.status(403).end();
  }
}
