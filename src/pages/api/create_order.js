const { connectDB } = require('../../lib/db');
const Order = require('../../models/Order');
const Item = require('../../models/Item');
const Customer = require('../../models/Customer');
const { verificarHorarioAtencion } = require('../../utils/timeUtils');
const { getNextDailyOrderNumber } = require('../../utils/orderUtils');
const RestaurantConfig = require('../../models/RestaurantConfig');
const axios = require('axios'); // Añadir axios para hacer la solicitud a delete_conversation

export default async function handler(req, res) {
    await connectDB();

    if (req.method === 'POST') {
        try {
            const { action } = req.body;

            switch (action) {
                case 'create':
                    return await createOrder(req, res);
                case 'modify':
                    return await modifyOrder(req, res);
                case 'cancel':
                    return await cancelOrder(req, res);
                default:
                    return res.status(400).json({ error: 'Acción no válida' });
            }
        } catch (error) {
            console.error('Error en la operación:', error);
            res.status(500).json({ error: 'Error en la operación' });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}

async function createOrder(req, res) {
    // Verificar si el restaurante está aceptando pedidos y obtener la configuración
    const config = await RestaurantConfig.findOne();
    if (!config || !config.acceptingOrders) {
        return res.status(400).json({ error: 'Lo sentimos, el restaurante no está aceptando pedidos en este momento debido a saturación, puedes intentar mas tarde o llamar al restaurante.' });
    }

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

    const mexicoTime = new Date().toLocaleString("en-US", {timeZone: "America/Mexico_City"});
    const today = new Date(mexicoTime).toISOString().split('T')[0];
    const dailyOrderNumber = await getNextDailyOrderNumber();

    // Crear la orden
    const newOrder = await Order.create({
        order_type,
        phone_number,
        delivery_address: order_type === 'delivery' ? delivery_address : null,
        pickup_name: order_type === 'pickup' ? pickup_name : null,
        total_price,
        client_id,
        status: 'created', // Añadimos el estado 'created'
        orderDate: today,
        dailyOrderNumber,
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

    // Borrar la conversación después de crear la orden
    await deleteConversation(client_id);

    // Determinar el tiempo estimado basado en el tipo de orden
    const estimatedTime = order_type === 'pickup' ? config.estimatedPickupTime : config.estimatedDeliveryTime;

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
            })),
            numeroDiario: newOrder.dailyOrderNumber,
            fecha: newOrder.orderDate,
            tiempoEstimado: estimatedTime,
        }
    });
}

async function modifyOrder(req, res) {
    const { orderId, order_type, items, phone_number, delivery_address, pickup_name, total_price, client_id } = req.body;

    const order = await Order.findByPk(orderId);
    if (!order || order.status !== 'created') {
        return res.status(400).json({ error: 'La orden no existe o no se puede modificar' });
    }

    const config = await RestaurantConfig.findOne();
    if (!config || !config.acceptingOrders) {
        return res.status(400).json({ error: 'Lo sentimos, el restaurante no está aceptando modificaciones en este momento.' });
    }

    const estaAbierto = await verificarHorarioAtencion();
    if (!estaAbierto) {
        return res.status(400).json({ error: 'Lo sentimos, solo se pueden modificar pedidos cuando el restaurante está abierto.' });
    }

    if (!['delivery', 'pickup'].includes(order_type)) {
        return res.status(400).json({ error: 'Tipo de orden inválido. Debe ser "delivery" o "pickup".' });
    }

    if (order_type === 'delivery' && !delivery_address) {
        return res.status(400).json({ error: 'Se requiere dirección de entrega para órdenes de delivery.' });
    }

    if (order_type === 'pickup' && !pickup_name) {
        return res.status(400).json({ error: 'Se requiere nombre de quien recoge para órdenes de pickup.' });
    }

    // Actualizar la orden
    await order.update({
        order_type,
        phone_number,
        delivery_address: order_type === 'delivery' ? delivery_address : null,
        pickup_name: order_type === 'pickup' ? pickup_name : null,
        total_price,
    });

    // Actualizar o crear items
    await Item.destroy({ where: { orderId: order.id } });
    const updatedItems = await Promise.all(items.map(item => 
        Item.create({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            orderId: order.id,
        })
    ));

    // Actualizar cliente si es necesario
    if (client_id) {
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
            } else {
                customer = await Customer.create({
                    client_id: client_id,
                    ...updateData
                });
            }
        } catch (error) {
            console.error('Error al actualizar el cliente:', error);
        }
    }

    // Borrar la conversación después de modificar la orden
    await deleteConversation(client_id);

    res.status(200).json({ 
        mensaje: 'Orden modificada exitosamente', 
        orden: {
            id: order.id,
            tipo: order.order_type,
            estado: order.status,
            telefono: order.phone_number,
            direccion_entrega: order.delivery_address,
            nombre_recogida: order.pickup_name,
            precio_total: order.total_price,
            items: updatedItems.map(item => ({
                nombre: item.name,
                cantidad: item.quantity,
                precio: item.price
            })),
            numeroDiario: order.dailyOrderNumber,
            fecha: order.orderDate,
        }
    });
}

async function cancelOrder(req, res) {
    const { orderId } = req.body;

    const order = await Order.findByPk(orderId);
    if (!order || order.status !== 'created') {
        return res.status(400).json({ error: 'La orden no existe o no se puede cancelar' });
    }

    await order.update({ status: 'canceled' });

    // Borrar la conversación después de cancelar la orden
    await deleteConversation(order.client_id);

    res.status(200).json({ 
        mensaje: 'Orden cancelada exitosamente', 
        orden: {
            id: order.id,
            estado: order.status,
        }
    });
}

// Función para borrar la conversación
async function deleteConversation(clientId) {
    try {
        const response = await axios.delete(`${process.env.BASE_URL}/api/delete_conversation`, {
            params: { clientId }
        });
        console.log('Conversación borrada:', response.data);
    } catch (error) {
        console.error('Error al borrar la conversación:', error.response ? error.response.data : error.message);
    }
}