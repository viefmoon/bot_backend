import axios from "axios";

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { clientId, otp } = req.body;

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/otp/verify`,
        { clientId, otp }
      );

      res.status(200).json(response.data);
    } catch (error) {
      console.error("Error al verificar OTP:", error);
      res.status(error.response?.status || 500).json({
        error: "No se pudo verificar el OTP",
      });
    }
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Método ${req.method} no permitido`);
  }
}
