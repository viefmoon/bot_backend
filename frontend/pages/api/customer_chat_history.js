import axios from "axios";

import dotenv from "dotenv";
dotenv.config();

export default async function handler(req, res) {
  const { query } = req;
  const { customerId } = query;

  if (!customerId) {
    return res.status(400).json({ error: "Se requiere el parámetro customerId" });
  }

  const url = `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/customers/${customerId}/chat-history`;

  try {
    const response = await axios.get(url);
    res.status(200).json(response.data);
  } catch (error) {
    console.error("Error al obtener el historial de chat del cliente:", error);
    res.status(500).json({
      error: "No se pudo obtener el historial de chat del cliente",
    });
  }
}
