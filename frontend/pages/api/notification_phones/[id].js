import axios from "axios";

import dotenv from "dotenv";
dotenv.config();

export default async function handler(req, res) {
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
  const { id } = req.query;

  if (req.method === "PUT") {
    try {
      const response = await axios.put(
        `${baseUrl}/notification-phones/${id}`,
        req.body
      );
      res.status(200).json(response.data);
    } catch (error) {
      res.status(error.response?.status || 500).json({ error: error.message });
    }
  } else if (req.method === "DELETE") {
    try {
      const response = await axios.delete(
        `${baseUrl}/notification-phones/${id}`
      );
      res.status(200).json(response.data);
    } catch (error) {
      res.status(error.response?.status || 500).json({ error: error.message });
    }
  } else {
    res.setHeader("Allow", ["PUT", "DELETE"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
