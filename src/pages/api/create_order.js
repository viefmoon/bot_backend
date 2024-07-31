const { connectDB } = require('../../lib/db');
const Order = require('../../models/Order');
const Item = require('../../models/Item');
const Customer = require('../../models/Customer');
const { verificarHorarioAtencion } = require('../../utils/timeUtils');

export default async function handler(req, res) {
    await connectDB();

    if (req.method === 'POST') {
        try {
            const estaAbierto = await verificarHorarioAtencion();
            if (!estaAbierto) {
                return res.status(400).json({ error: 'Lo sentimos, solo podre procesar tu pedido cuando el restaurante este abierto.' });
            }

            const { order_type, items, phone_number, delivery_address, pickup_name } = req.body;

            if (!['delivery', 'pickup'].includes(order_type)) {
                return res.status(400).json({ error: 'Tipo de orden inválido. Debe ser "delivery" o "pickup".' });
            }

            if (order_type === 'delivery' && !delivery_address) {
                return res.status(400).json({ error: 'Se requiere dirección de entrega para órdenes de delivery.' });
            }

            if (order_type === 'pickup' && !pickup_name) {
                return res.status(400).json({ error: 'Se requiere nombre de quien recoge para órdenes de pickup.' });
            }

            // Calcular el precio total
            const total_price = items.reduce((total, item) => total + (item.price * item.quantity), 0);

            // Crear la orden
            const newOrder = await Order.create({
                order_type,
                phone_number,
                delivery_address: order_type === 'delivery' ? delivery_address : null,
                pickup_name: order_type === 'pickup' ? pickup_name : null,
                total_price,
            });

            // Crear los items asociados a la orden
            await Promise.all(items.map(item => 
                Item.create({
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price,
                    orderId: newOrder.id,
                })
            ));

            // Actualizar o crear el cliente
            await Customer.upsert({
                phone_number,
                last_delivery_address: order_type === 'delivery' ? delivery_address : undefined,
                last_pickup_name: order_type === 'pickup' ? pickup_name : undefined,
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