import axios from "axios";

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { phoneNumber, otp, deliveryInfo } = req.body;

    try {
      // Verificar OTP
      const otpVerificationResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/verify-otp`,
        { phoneNumber, otp }
      );

      if (!otpVerificationResponse.data.success) {
        return res.status(400).json({ error: "OTP inválido" });
      }

      // Crear CustomerDeliveryInfo
      const createDeliveryInfoResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/customer-delivery-info`,
        { clientId: phoneNumber, ...deliveryInfo }
      );

      res.status(201).json(createDeliveryInfoResponse.data);
    } catch (error) {
      console.error("Error en el registro de información de entrega:", error);
      res.status(error.response?.status || 500).json({
        error:
          "Error al procesar la solicitud de registro de información de entrega",
      });
    }
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
