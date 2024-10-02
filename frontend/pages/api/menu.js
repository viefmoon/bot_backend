import axios from "axios";

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_BASE_URL}/menu`
      );
      res.status(200).json(response.data);
    } catch (error) {
      console.error("Error al obtener el menú:", error);
      res.status(500).json({ error: "No se pudo obtener el menú" });
    }
  } else if (req.method === "POST") {
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}/availability/toggle`,
        req.body
      );
      res.status(200).json(response.data);
    } catch (error) {
      console.error("Error al cambiar la disponibilidad:", error);
      res.status(500).json({ error: "No se pudo cambiar la disponibilidad" });
    }
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
