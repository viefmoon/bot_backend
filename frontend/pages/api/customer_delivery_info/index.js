import axios from "axios";

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { clientId, ...deliveryInfo } = req.body;

    try {
      const createDeliveryInfoResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/customer-delivery-info`,
        { clientId, ...deliveryInfo }
      );

      res.status(201).json(createDeliveryInfoResponse.data);
    } catch (error) {
      console.error("Error en el registro de información de entrega:", error);
      res.status(error.response?.status || 500).json({
        error:
          "Error al procesar la solicitud de registro de información de entrega",
      });
    }
  } else if (req.method === "PUT") {
    const { clientId, ...deliveryInfo } = req.body;

    try {
      const updateDeliveryInfoResponse = await axios.put(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/customer-delivery-info/${clientId}`,
        deliveryInfo
      );

      res.status(200).json(updateDeliveryInfoResponse.data);
    } catch (error) {
      console.error(
        "Error en la actualización de información de entrega:",
        error
      );
      res.status(error.response?.status || 500).json({
        error:
          "Error al procesar la solicitud de actualización de información de entrega",
      });
    }
  } else {
    res.setHeader("Allow", ["POST", "PUT"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
