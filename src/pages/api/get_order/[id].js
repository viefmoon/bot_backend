const { connectDB } = require('../../../lib/db');
const Order = require('../../../models/Order');
const Item = require('../../../models/Item');

export default async function handler(req, res) {
    await connectDB();

    if (req.method === 'GET') {
        try {
            const { id } = req.query;

            // Buscar la orden por ID
            const orden = await Order.findByPk(id, {
                include: [{ model: Item, as: 'items' }]
            });

            if (!orden) {
                return res.status(404).json({ error: 'Orden no encontrada' });
            }

            // Formatear la respuesta
            const respuesta = {
                id: orden.id,
                tipo: orden.order_type,
                estado: orden.status,
                telefono: orden.phone_number,
                direccion_entrega: orden.delivery_address,
                nombre_recogida: orden.pickup_name,
                precio_total: orden.total_price,
                id_cliente: orden.client_id,
                fecha_creacion: orden.createdAt,
                items: orden.items.map(item => ({
                    id: item.id,
                    nombre: item.name,
                    cantidad: item.quantity,
                    precio: item.price
                }))
            };

            res.status(200).json(respuesta);
        } catch (error) {
            console.error('Error al obtener la orden:', error);
            res.status(500).json({ error: 'Error al obtener la orden' });
        }
    } else {
        res.setHeader('Allow', ['GET']);
        res.status(405).end(`Método ${req.method} no permitido`);
    }
}