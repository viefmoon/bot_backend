import axios from "axios";

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { clientId, action } = req.body;

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}/customers/ban`,
        {
          clientId,
          action,
        }
      );

      res.status(200).json(response.data);
    } catch (error) {
      res
        .status(error.response?.status || 500)
        .json({ message: error.message });
    }
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
