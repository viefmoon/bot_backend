import axios from "axios";

export default async function handler(req, res) {
  const { customerId } = req.query;

  if (req.method === "GET") {
    try {
      const getDeliveryInfoResponse = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/customer-delivery-info/${customerId}`
      );
      console.log("getDeliveryInfoResponse", getDeliveryInfoResponse.data);

      res.status(200).json(getDeliveryInfoResponse.data);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        // Si el cliente no tiene información de entrega, devolvemos un objeto vacío
        res.status(200).json({});
      } else {
        console.error("Error al obtener la información de entrega:", error);
        res.status(error.response?.status || 500).json({
          error:
            "Error al procesar la solicitud de obtención de información de entrega",
        });
      }
    }
  } else if (req.method === "PUT") {
    try {
      const updateDeliveryInfoResponse = await axios.put(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/customer-delivery-info/${customerId}`,
        req.body
      );

      res.status(200).json(updateDeliveryInfoResponse.data);
    } catch (error) {
      console.error("Error al actualizar la información de entrega:", error);
      res.status(error.response?.status || 500).json({
        error:
          "Error al procesar la solicitud de actualización de información de entrega",
      });
    }
  } else {
    res.setHeader("Allow", ["GET", "PUT"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
