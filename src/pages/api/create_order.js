const { connectDB } = require('../../lib/db');
const Order = require('../../models/Order');

export default async function handler(req, res) {
    await connectDB();

    if (req.method === 'POST') {
        try {
            const { items, phone_number, delivery_address, total_price } = req.body;

            const newOrder = await Order.create({
                items,
                phone_number,
                delivery_address,
                total_price,
            });

            res.status(201).json({ message: 'Order created successfully', order: newOrder });
        } catch (error) {
            res.status(500).json({ error: 'Failed to create order' });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}