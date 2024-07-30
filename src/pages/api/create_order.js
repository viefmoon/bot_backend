const { connectDB } = require('../../lib/db');
const Order = require('../../models/Order');
const { verificarHorarioAtencion } = require('../../utils/timeUtils');

export default async function handler(req, res) {
    await connectDB();

    if (req.method === 'POST') {
        try {
            const estaAbierto = await verificarHorarioAtencion();
            if (!estaAbierto) {
                return res.status(400).json({ error: 'Lo sentimos, el restaurante está cerrado en este momento.' });
            }

            const { items, phone_number, delivery_address, total_price } = req.body;

            const newOrder = await Order.create({
                items,
                phone_number,
                delivery_address,
                total_price,
            });

            res.status(201).json({ message: 'Order created successfully', order: newOrder });
        } catch (error) {
            console.error('Error al crear la orden:', error);
            res.status(500).json({ error: 'Error al crear la orden' });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}