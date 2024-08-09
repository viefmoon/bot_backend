const { connectDB } = require('../../lib/db');
const MenuItem = require('../../models/MenuItem');
const cors = require('cors');

// Configure CORS
const corsMiddleware = cors({
  origin: '*', // Allow all origins in development. Adjust this in production.
  methods: ['GET', 'PUT'],
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

  if (req.method === 'GET') {
    try {
      // Get all menu items
      const menuItems = await MenuItem.findAll({
        attributes: ['code', 'name', 'available'], // Selecciona solo los campos necesarios
      });
      res.status(200).json(menuItems);
    } catch (error) {
      console.error('Error fetching menu:', error);
      res.status(500).json({ error: 'Error fetching menu' });
    }
  } else if (req.method === 'PUT') {
    try {
      const { code, available } = req.body;

      if (!code || available === undefined) {
        return res.status(400).json({ error: 'Code and availability are required.' });
      }

      const menuItem = await MenuItem.findByPk(code);

      if (!menuItem) {
        return res.status(404).json({ error: 'Menu item not found.' });
      }

      menuItem.available = available;
      await menuItem.save();

      res.status(200).json({ message: 'Availability updated successfully', menuItem });
    } catch (error) {
      console.error('Error updating availability:', error);
      res.status(500).json({ error: 'Error updating availability', details: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET', 'PUT']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}