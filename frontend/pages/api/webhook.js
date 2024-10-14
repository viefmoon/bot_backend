import axios from "axios";
import getRawBody from "raw-body";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  const { method, headers } = req;
  console.log("Stripe-Signature:", headers["stripe-signature"]);
  // Construye la URL del backend
  const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/webhook`;

  try {
    // Obtiene el cuerpo de la solicitud sin procesar
    const rawBody = await getRawBody(req);

    // Realiza la solicitud al backend
    const backendResponse = await axios({
      method: method,
      url: backendUrl,
      data: rawBody, // Enviamos el cuerpo sin procesar
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": headers["stripe-signature"],
      },
    });

    // Envía la respuesta del backend al cliente
    res.status(backendResponse.status).json(backendResponse.data);
  } catch (error) {
    console.error(
      "Error en la redirección del webhook:",
      error.response?.data || error.message
    );
    res.status(error.response?.status || 500).json({
      error: "Error al procesar la solicitud del webhook",
      details: error.response?.data || error.message,
    });
  }
}
