const { connectDB } = require('../../lib/db');
import RestaurantConfig from '../../models/RestaurantConfig';

export default async function handler(req, res) {
  await connectDB();

  if (req.method === 'GET') {
    try {
      const config = await RestaurantConfig.findOne();
      if (!config) {
        return res.status(404).json({ error: 'Configuración no encontrada' });
      }
      res.status(200).json({
        config: {
          acceptingOrders: config.acceptingOrders,
          estimatedPickupTime: config.estimatedPickupTime,
          estimatedDeliveryTime: config.estimatedDeliveryTime
        }
      });
    } catch (error) {
      console.error('Error al obtener la configuración:', error);
      res.status(500).json({ error: 'Error al obtener la configuración' });
    }
  } else if (req.method === 'POST') {
    try {
      const { acceptingOrders, estimatedPickupTime, estimatedDeliveryTime } = req.body;

      let config = await RestaurantConfig.findOne();
      if (!config) {
        config = await RestaurantConfig.create({ 
          acceptingOrders, 
          estimatedPickupTime, 
          estimatedDeliveryTime 
        });
      } else {
        await config.update({ 
          acceptingOrders, 
          estimatedPickupTime, 
          estimatedDeliveryTime 
        });
      }

      res.status(200).json({ 
        mensaje: 'Configuración actualizada exitosamente', 
        config: {
          acceptingOrders: config.acceptingOrders,
          estimatedPickupTime: config.estimatedPickupTime,
          estimatedDeliveryTime: config.estimatedDeliveryTime
        }
      });
    } catch (error) {
      console.error('Error al actualizar la configuración:', error);
      res.status(500).json({ error: 'Error al actualizar la configuración' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}