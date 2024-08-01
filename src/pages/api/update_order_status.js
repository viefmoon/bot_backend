const { connectDB } = require('../../lib/db');
const Order = require('../../models/Order');
const axios = require('axios');

// Definir mensajes predeterminados
const statusMessages = {
    accepted: 'Tu pedido #{orderId} ha sido aceptado y pronto comenzará a prepararse.',
    preparing: 'Buenas noticias! Tu pedido #{orderId} está siendo preparado.',
    delivering: 'Tu pedido #{orderId} está en camino. Pronto llegará a tu ubicación.',
    completed: 'Tu pedido #{orderId} ha sido entregado. Esperamos que lo disfrutes!',
    canceled: 'Lo sentimos, tu pedido #{orderId} ha sido cancelado. Por favor, contáctanos si tienes alguna pregunta.'
};

// Función para enviar mensaje de WhatsApp
async function sendWhatsAppMessage(phoneNumber, message) {
    try {
        const response = await axios.post(`https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'text',
            text: { body: message }
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('Mensaje de WhatsApp enviado a:', phoneNumber);
        console.log('Respuesta de WhatsApp:', response.data);
    } catch (error) {
        console.error('Error al enviar mensaje de WhatsApp:', error);
    }
}

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

            // Enviar mensaje de WhatsApp si hay un mensaje predefinido para el nuevo estado
            if (statusMessages[newStatus]) {
                const message = statusMessages[newStatus].replace('{orderId}', orderId);
                await sendWhatsAppMessage(order.phone_number, message);
            }

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