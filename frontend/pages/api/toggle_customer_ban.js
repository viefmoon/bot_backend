import axios from "axios";

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { customerId, action } = req.body;

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/customers/ban`,
        {
          customerId,
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
