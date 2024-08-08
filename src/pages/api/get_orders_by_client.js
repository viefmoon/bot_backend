const { connectDB } = require('../../lib/db');
const { Order, Item } = require('../../models');
const cors = require('cors');

// Configurar CORS
const corsMiddleware = cors({
  origin: '*', // Permite todas las origenes en desarrollo. Ajusta esto en producción.
  methods: ['GET'],
});

export default async function handler(req, res) {
  // Aplicar el middleware CORS
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
      const { client_id } = req.query;

      if (!client_id) {
        return res.status(400).json({ error: 'Se requiere el ID del cliente.' });
      }

      const orders = await Order.findAll({
        where: { client_id },
        order: [['orderDate', 'DESC'], ['dailyOrderNumber', 'DESC']],
        include: [{ model: Item, as: 'items' }]
      });

      res.status(200).json(orders);
    } catch (error) {
      console.error('Error al obtener las órdenes:', error);
      res.status(500).json({ error: 'Error al obtener las órdenes' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}