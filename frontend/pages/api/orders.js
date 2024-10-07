import axios from "axios";

import dotenv from "dotenv";
dotenv.config();

export default async function handler(req, res) {
  const { method, query } = req;
  const { date, status } = query;
  let url = `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/orders`;
  
  // Construir la URL con los parámetros de consulta
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  if (status) params.append('status', status);
  if (params.toString()) url += `?${params.toString()}`;

  try {
    const response = await axios.get(url);
    let data = response.data;

    if (!Array.isArray(data)) {
      data = data ? [data] : [];
    }

    data.forEach((order) => {
      const createdAt = order.createdAt;
      if (createdAt) {
        order.updatedAt = order.updatedAt || createdAt;
      }
    });

    res.status(200).json(data);
  } catch (error) {
    console.error("Error al obtener pedidos:", error);
    res.status(500).json({
      error: "No se pudieron obtener los pedidos de la API externa",
    });
  }
}
