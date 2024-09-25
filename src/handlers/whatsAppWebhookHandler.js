import { processMessage } from "../utils/messageProcessor";

// Manejo de mensajes de WhatsApp
export async function handleWhatsAppWebhook(req, res) {
  res.status(200).send("EVENT_RECEIVED");
  const { object, entry } = req.body;

  if (object === "whatsapp_business_account") {
    for (const entryItem of entry) {
      for (const change of entryItem.changes) {
        const { value } = change;
        if (value.messages && value.messages.length > 0) {
          for (const message of value.messages) {
            await processMessage(message);
          }
        }
      }
    }
  } else {
    res.sendStatus(404);
  }
}
