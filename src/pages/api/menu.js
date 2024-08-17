const { connectDB } = require("../../lib/db");
const product = require("../../models/product");
const productVariant = require("../../models/productVariant");
const modifier = require("../../models/modifier");
const modifierType = require("../../models/modifierType");
const pizzaIngredient = require("../../models/pizzaIngredient");
const Availability = require("../../models/availability");
const cors = require("cors");

// Configure CORS
const corsMiddleware = cors({
  origin: "*", // Allow all origins in development. Adjust this in production.
  methods: ["GET", "PUT"],
});

export default async function handler(req, res) {
  // Apply the CORS middleware
  await new Promise((resolve, reject) => {
    corsMiddleware(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });

  await connectDB();

  if (req.method === "GET") {
    try {
      const products = await product.findAll({
        attributes: ['id', 'name'],
        include: [
          {
            model: productVariant,
            as: "variants",
            attributes: ['id', 'name'],
          },
          {
            model: modifierType,
            as: "modifiers",
            attributes: ['id', 'name'],
            include: [
              {
                model: modifier,
                as: "options",
                attributes: ['id', 'name'],
              },
            ],
          },
          {
            model: pizzaIngredient,
            as: "pizzaIngredients",
            attributes: ['id', 'name'],
          },
        ],
      });

      const availabilities = await Availability.findAll();
      const availabilityMap = availabilities.reduce((acc, av) => {
        acc[av.id] = av.available;
        return acc;
      }, {});

      const productsWithAvailability = products.map(p => {
        const productJson = p.toJSON();
        productJson.available = availabilityMap[p.id] ?? true;
        
        if (productJson.variants) {
          productJson.variants = productJson.variants.map(v => ({
            id: v.id,
            name: v.name,
            available: availabilityMap[v.id] ?? true,
          }));
        }

        if (productJson.modifiers) {
          productJson.modifiers = productJson.modifiers.map(m => ({
            id: m.id,
            name: m.name,
            options: m.options.map(o => ({
              id: o.id,
              name: o.name,
              available: availabilityMap[o.id] ?? true,
            })),
          }));
        }

        if (productJson.pizzaIngredients) {
          productJson.pizzaIngredients = productJson.pizzaIngredients.map(i => ({
            id: i.id,
            name: i.name,
            available: availabilityMap[i.id] ?? true,
          }));
        }

        return productJson;
      });

      res.status(200).json(productsWithAvailability);
    } catch (error) {
      console.error("Error fetching menu:", error);
      res.status(500).json({ error: "Error fetching menu" });
    }
  } else if (req.method === "PUT") {
    try {
      const { id, type, available } = req.body;

      if (!id || !type || available === undefined) {
        return res.status(400).json({ error: "Id, type, and availability are required." });
      }

      const [availability, created] = await Availability.findOrCreate({
        where: { id, type },
        defaults: { available },
      });

      if (!created) {
        availability.available = available;
        await availability.save();
      }

      res.status(200).json({ message: "Availability updated successfully", availability });
    } catch (error) {
      console.error("Error updating availability:", error);
      res.status(500).json({ error: "Error updating availability", details: error.message });
    }
  } else {
    res.setHeader("Allow", ["GET", "PUT"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}