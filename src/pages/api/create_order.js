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

            const { order_type, items, phone_number, delivery_address, pickup_name, total_price, client_id } = req.body;

            if (!['delivery', 'pickup'].includes(order_type)) {
                return res.status(400).json({ error: 'Tipo de orden inválido. Debe ser "delivery" o "pickup".' });
            }

            if (order_type === 'delivery' && !delivery_address) {
                return res.status(400).json({ error: 'Se requiere dirección de entrega para órdenes de delivery.' });
            }

            if (order_type === 'pickup' && !pickup_name) {
                return res.status(400).json({ error: 'Se requiere nombre de quien recoge para órdenes de pickup.' });
            }

            if (client_id) {
                console.log('client_id en la creacion de la orden:', client_id);
                const updateData = {};
                if (order_type === 'delivery') {
                    updateData.last_delivery_address = delivery_address;
                } else if (order_type === 'pickup') {
                    updateData.last_pickup_name = pickup_name;
                }

                try {
                    let customer = await Customer.findByPk(client_id);
                    if (customer) {
                        await customer.update(updateData);
                        console.log('Cliente actualizado:', customer.toJSON());
                    } else {
                        customer = await Customer.create({
                            client_id: client_id,
                            ...updateData
                        });
                        console.log('Nuevo cliente creado:', customer.toJSON());
                    }
                } catch (error) {
                    console.error('Error al crear o actualizar el cliente:', error);
                    // Continuar con la creación de la orden incluso si falla la actualización del cliente
                }
            } else {
                console.warn('client_id no proporcionado o inválido:', client_id);
            }

            // Crear la orden
            const newOrder = await Order.create({
                order_type,
                phone_number,
                delivery_address: order_type === 'delivery' ? delivery_address : null,
                pickup_name: order_type === 'pickup' ? pickup_name : null,
                total_price,
                client_id,
                status: 'created', // Añadimos el estado 'created'
            });

            // Crear los items asociados a la orden
            const createdItems = await Promise.all(items.map(item => 
                Item.create({
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price,
                    orderId: newOrder.id,
                })
            ));

            res.status(201).json({ 
                mensaje: 'Orden creada exitosamente', 
                orden: {
                    id: newOrder.id,
                    tipo: newOrder.order_type,
                    estado: newOrder.status,
                    telefono: newOrder.phone_number,
                    direccion_entrega: newOrder.delivery_address,
                    nombre_recogida: newOrder.pickup_name,
                    precio_total: newOrder.total_price,
                    fecha_creacion: newOrder.createdAt.toLocaleString('es-MX', {
                        timeZone: 'America/Mexico_City',
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                    }),
                    items: createdItems.map(item => ({
                        nombre: item.name,
                        cantidad: item.quantity,
                        precio: item.price
                    }))
                }
            });
        } catch (error) {
            console.error('Error al crear la orden:', error);
            res.status(500).json({ error: 'Error al crear la orden' });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}