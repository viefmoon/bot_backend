import axios from "axios";

export default async function handler(req, res) {
  try {
    const backendResponse = await axios({
      method: req.method,
      url: `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/webhook`,
      data: req.body,
      params: req.query,
      headers: req.headers,
    });

    res.status(backendResponse.status).json(backendResponse.data);
  } catch (error) {
    console.error("Error en la redirección del webhook:", error);
    res.status(error.response?.status || 500).json({
      error: "Error al procesar la solicitud del webhook",
      details: error.response?.data || error.message,
    });
  }
}
