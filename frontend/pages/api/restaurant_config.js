import axios from "axios";

import dotenv from "dotenv";
dotenv.config();

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/restaurant-config`
      );

      res.status(200).json(response.data);
    } catch (error) {
      console.error(
        "Error al obtener la configuración del restaurante:",
        error
      );
      res.status(error.response?.status || 500).json({
        error: "No se pudo obtener la configuración del restaurante.",
      });
    }
  } else if (req.method === "PUT") {
    const config = req.body;

    try {
      const response = await axios.put(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/restaurant-config`,
        config
      );

      res.status(200).json(response.data);
    } catch (error) {
      console.error(
        "Error al actualizar la configuración del restaurante:",
        error
      );
      res.status(error.response?.status || 500).json({
        error: "No se pudo actualizar la configuración del restaurante.",
      });
    }
  } else {
    res.setHeader("Allow", ["GET", "PUT"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
