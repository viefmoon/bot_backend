import axios from "axios";

import dotenv from "dotenv";
dotenv.config();

export default async function handler(req, res) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  if (req.method === "GET") {
    try {
      const response = await axios.get(`${baseUrl}/notification-phones`);
      res.status(200).json(response.data);
    } catch (error) {
      res.status(error.response?.status || 500).json({ error: error.message });
    }
  } else if (req.method === "POST") {
    try {
      const response = await axios.post(
        `${baseUrl}/notification-phones`,
        req.body,
      );
      res.status(201).json(response.data);
    } catch (error) {
      res.status(error.response?.status || 500).json({ error: error.message });
    }
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
