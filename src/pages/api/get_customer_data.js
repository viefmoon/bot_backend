const { connectDB } = require('../../lib/db');
const Customer = require('../../models/Customer');

export default async function handler(req, res) {
    await connectDB();

    if (req.method === 'GET') {
        try {
            const { client_id } = req.query;

            if (!client_id) {
                return res.status(400).json({ error: 'Se requiere el ID del cliente.' });
            }

            const customer = await Customer.findOne({ where: { client_id } });

            if (customer) {
                res.status(200).json({
                    phone_number: customer.phone_number,
                    last_delivery_address: customer.last_delivery_address,
                    last_pickup_name: customer.last_pickup_name,
                });
            } else {
                res.status(404).json({ error: 'Cliente no encontrado.' });
            }
        } catch (error) {
            console.error('Error al obtener datos del cliente:', error);
            res.status(500).json({ error: 'Error al obtener datos del cliente' });
        }
    } else {
        res.setHeader('Allow', ['GET']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}