import axios from "axios";

import dotenv from "dotenv";
dotenv.config();

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { to, message } = req.body;

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/whatsapp/send-message`,
        { to, message },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      res.status(200).json(response.data);
    } catch (error) {
      console.error("Error al enviar mensaje de WhatsApp:", error);
      res.status(error.response?.status || 500).json({
        success: false,
        message: "Error al enviar mensaje de WhatsApp",
        error: error.response?.data || error.message,
      });
    }
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Método ${req.method} no permitido`);
  }
}
