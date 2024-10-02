import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

export default async function handler(req, res) {
  // Usa process.env para leer la variable de entorno
  const url = `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/customers`;

  try {
    const response = await axios.get(url);
    let data = response.data;

    // Verifica que la respuesta sea un arreglo
    if (!Array.isArray(data)) {
      data = data ? [data] : [];
    }

    // Elimina propiedades no deseadas antes de enviar la respuesta
    data.forEach((client) => {
      delete client.fullChatHistory;
    });

    // Responde con los datos obtenidos
    res.status(200).json(data);
  } catch (error) {
    // Imprime el error en consola y responde con un mensaje de error
    console.error("Error al obtener clientes:", error);
    res.status(500).json({
      error: "No se pudieron obtener los clientes de la API externa",
    });
  }
}
