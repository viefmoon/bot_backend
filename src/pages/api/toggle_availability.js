import Availability from "../../models/availability";
const cors = require("cors");

const corsMiddleware = cors({
  origin: "*",
  methods: ["POST"],
});

export default async function handler(req, res) {
  await new Promise((resolve, reject) => {
    corsMiddleware(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });

  if (req.method === "POST") {
    try {
      const { id, type } = req.body;

      const availability = await Availability.findOne({
        where: { id, type },
      });

      if (!availability) {
        return res.status(404).json({ error: "Availability not found" });
      }

      availability.available = !availability.available;
      await availability.save();

      res.status(200).json({
        id: availability.id,
        type: availability.type,
        available: availability.available,
      });
    } catch (error) {
      console.error("Error toggling availability:", error);
      res.status(500).json({ error: "Error toggling availability" });
    }
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
