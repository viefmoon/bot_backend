import axios from "axios";

export default async function handler(req, res) {
  const { preOrderId } = req.query;
  const { clientId, ...deliveryInfo } = req.body;

  if (req.method === "PUT") {
    try {
      const updateDeliveryInfoResponse = await axios.put(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/customer-delivery-info/${clientId}?preOrderId=${preOrderId}`,
        deliveryInfo
      );

      // Devolver la respuesta completa del backend
      res.status(200).json(updateDeliveryInfoResponse.data);
    } catch (error) {
      console.error(
        "Error al actualizar la información de entrega de la preorden:",
        error
      );
      res.status(error.response?.status || 500).json({
        error:
          "Error al procesar la solicitud de actualización de información de entrega de la preorden",
      });
    }
  } else {
    res.setHeader("Allow", ["PUT"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
