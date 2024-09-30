const { NotificationPhone } = require("../../models");
const cors = require("cors");

const corsMiddleware = cors({
  origin: true,
  methods: ["GET", "POST", "DELETE", "PUT"],
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

  if (req.method === "GET") {
    try {
      const phones = await NotificationPhone.findAll({
        attributes: ["id", "phoneNumber", "isActive"],
      });
      res.status(200).json(phones);
    } catch (error) {
      console.error("Error al obtener los números de teléfono:", error);
      res
        .status(500)
        .json({ error: "Error al obtener los números de teléfono" });
    }
  } else if (req.method === "POST") {
    try {
      const { phoneNumber } = req.body;
      if (!phoneNumber) {
        return res
          .status(400)
          .json({ error: "Se requiere el número de teléfono" });
      }
      const [phone, created] = await NotificationPhone.findOrCreate({
        where: { phoneNumber },
        defaults: { isActive: true },
      });
      if (!created) {
        return res
          .status(409)
          .json({ error: "El número de teléfono ya existe" });
      }
      res.status(201).json(phone);
    } catch (error) {
      console.error("Error al agregar el número de teléfono:", error);
      res.status(500).json({ error: "Error al agregar el número de teléfono" });
    }
  } else if (req.method === "DELETE") {
    try {
      const id = req.query.id || req.url.split("/").pop();
      console.log("ID recibido para eliminación:", id);

      if (!id) {
        return res
          .status(400)
          .json({ error: "Se requiere el ID del número de teléfono" });
      }
      const deletedCount = await NotificationPhone.destroy({ where: { id } });
      console.log("Cantidad eliminada:", deletedCount);

      if (deletedCount === 0) {
        return res
          .status(404)
          .json({ error: "Número de teléfono no encontrado" });
      }
      res
        .status(200)
        .json({ message: "Número de teléfono eliminado con éxito" });
    } catch (error) {
      console.error("Error al eliminar el número de teléfono:", error);
      res
        .status(500)
        .json({ error: "Error al eliminar el número de teléfono" });
    }
  } else if (req.method === "PUT") {
    try {
      const { id } = req.query;
      const { phoneNumber, isActive } = req.body;

      if (!id) {
        return res
          .status(400)
          .json({ error: "Se requiere el ID del número de teléfono" });
      }

      const [updatedCount] = await NotificationPhone.update(
        { phoneNumber, isActive },
        { where: { id } }
      );

      if (updatedCount === 0) {
        return res
          .status(404)
          .json({ error: "Número de teléfono no encontrado" });
      }

      const updatedPhone = await NotificationPhone.findByPk(id);
      res.status(200).json(updatedPhone);
    } catch (error) {
      console.error("Error al actualizar el número de teléfono:", error);
      res
        .status(500)
        .json({ error: "Error al actualizar el número de teléfono" });
    }
  } else {
    res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
