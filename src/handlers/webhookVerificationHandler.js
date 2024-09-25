dotenv.config();
export function handleWebhookVerification(req, res) {
  const {
    "hub.mode": mode,
    "hub.verify_token": token,
    "hub.challenge": challenge,
  } = req.query;
  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log("Webhook verificado exitosamente");
    res.status(200).send(challenge);
  } else {
    console.error("Fallo en la verificación del webhook");
    res.status(403).end();
  }
}
