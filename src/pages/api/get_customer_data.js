const { connectDB } = require('../../lib/db');
const Customer = require('../../models/Customer');

export default async function handler(req, res) {
    await connectDB();

    if (req.method === 'GET') {
        try {
            const { phone_number } = req.query;

            if (!phone_number) {
                return res.status(400).json({ error: 'Se requiere el número de teléfono.' });
            }

            const customer = await Customer.findOne({ where: { phone_number } });

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