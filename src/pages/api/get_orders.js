const { connectDB } = require('../../lib/db');
const Order = require('../../models/Order');
const cors = require('cors');

const corsMiddleware = cors({
    methods: ['GET'],
});

export default async function handler(req, res) {
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
            const orders = await Order.findAll({
                order: [['createdAt', 'DESC']]
            });

            res.status(200).json(orders);
        } catch (error) {
            console.error("Error fetching orders:", error);
            res.status(500).json({ error: 'Failed to fetch orders' });
        }
    } else {
        res.setHeader('Allow', ['GET']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}