const { connectDB } = require('../../lib/db');
const Order = require('../../models/Order');

export default async function handler(req, res) {
    await connectDB();

    if (req.method === 'PUT') {
        try {
            const { orderId, newStatus } = req.body;

            if (!orderId || !newStatus) {
                return res.status(400).json({ error: 'Se requieren orderId y newStatus.' });
            }

            const validStatuses = ['created', 'accepted', 'preparing', 'delivering', 'completed', 'canceled'];
            if (!validStatuses.includes(newStatus)) {
                return res.status(400).json({ error: 'Estado no válido.' });
            }

            const order = await Order.findByPk(orderId);

            if (!order) {
                return res.status(404).json({ error: 'Orden no encontrada.' });
            }

            order.status = newStatus;
            await order.save();

            res.status(200).json({ message: 'Estado de la orden actualizado con éxito', order });
        } catch (error) {
            console.error('Error al actualizar el estado de la orden:', error);
            res.status(500).json({ error: 'Error al actualizar el estado de la orden' });
        }
    } else {
        res.setHeader('Allow', ['PUT']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}