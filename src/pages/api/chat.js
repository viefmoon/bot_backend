const OpenAI = require('openai');
const axios = require('axios');
const { Order, Item, MenuItem } = require('../../models');
const { sequelize } = require('../../lib/db');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const validateApiKey = (req, res) => {
    const authorizationHeader = req.headers['authorization'];
    if (!authorizationHeader) {
        return res.status(401).json({
            status: 'error',
            message: 'Authorization header is missing',
        });
    }
    const tokenParts = authorizationHeader.split(' ');

    if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
        return res.status(401).json({
            status: 'error',
            message: 'Invalid Authorization header format',
        });
    }
    const apiKeyStr = tokenParts[1]; // Extract the API key from the Bearer token
    if (apiKeyStr !== process.env.BEARER_TOKEN) {
        return res.status(401).json({
            status: 'error',
            message: 'Incorrect Bearer token',
        });
    }
};
// Añadir esta función después de findClientId
async function getCustomerData(clientId) {
    try {
        const response = await axios.get(`${process.env.BASE_URL}/api/get_customer_data?client_id=${clientId}`);
        return response.data;
    } catch (error) {
        console.error("El cliente no existe en la base de datos, aun no ha realizado un pedido:", error);
        return null;
    }
}

async function createOrder(toolCall, clientId) {
    const { order_type, items, phone_number, delivery_address, pickup_name } = JSON.parse(toolCall.function.arguments);
    const total_price = items.reduce((total, item) => total + (item.price * item.quantity), 0);

    try {
        const response = await axios.post(`${process.env.BASE_URL}/api/create_order`, {
            action: 'create', // Añadimos la acción
            order_type,
            items,
            phone_number,
            delivery_address,
            pickup_name,
            total_price,
            client_id: clientId
        });

        const orderResult = response.data;
        console.log("Order result:", orderResult);

        return {
            tool_call_id: toolCall.id,
            output: JSON.stringify(orderResult)
        };
    } catch (error) {
        console.error("Error creating order:", error.response ? error.response.data : error.message);
        return {
            tool_call_id: toolCall.id,
            output: JSON.stringify({ error: error.response ? error.response.data.error : "Failed to create order", details: error.message })
        };
    }
}

async function modifyOrder(toolCall, clientId) {
    const { daily_order_number, order_type, items, phone_number, delivery_address, pickup_name } = JSON.parse(toolCall.function.arguments);
    const total_price = items.reduce((total, item) => total + (item.price * item.quantity), 0);

    try {
        const response = await axios.post(`${process.env.BASE_URL}/api/create_order`, {
            action: 'modify', // Añadimos la acción
            daily_order_number,
            order_type,
            items,
            phone_number,
            delivery_address,
            pickup_name,
            total_price,
            client_id: clientId
        });

        const orderResult = response.data;
        console.log("Order modification result:", orderResult);

        return {
            tool_call_id: toolCall.id,
            output: JSON.stringify(orderResult)
        };
    } catch (error) {
        console.error("Error modifying order:", error.response ? error.response.data : error.message);
        return {
            tool_call_id: toolCall.id,
            output: JSON.stringify({ error: error.response ? error.response.data.error : "Failed to modify order", details: error.message })
        };
    }
}

async function cancelOrder(toolCall, clientId) {
    const { daily_order_number } = JSON.parse(toolCall.function.arguments);

    if (!daily_order_number) {
        console.error("Número de orden no proporcionado");
        return {
            tool_call_id: toolCall.id,
            output: JSON.stringify({ error: "Número de orden no proporcionado" })
        };
    }

    try {
        const response = await axios.post(`${process.env.BASE_URL}/api/create_order`, {
            action: 'cancel', // Añadimos la acción
            daily_order_number,
            client_id: clientId
        });

        const orderResult = response.data;
        console.log("Resultado de la cancelación de la orden:", orderResult);

        return {
            tool_call_id: toolCall.id,
            output: JSON.stringify(orderResult)
        };
    } catch (error) {
        console.error("Error al cancelar la orden:", error.response ? error.response.data : error.message);
        return {
            tool_call_id: toolCall.id,
            output: JSON.stringify({ error: error.response ? error.response.data.error : "No se pudo cancelar la orden", details: error.message })
        };
    }
}

async function getOrderDetails(dailyOrderNumber, clientId) {
    try {
        const mexicoTime = new Date().toLocaleString("en-US", {timeZone: "America/Mexico_City"});
        const today = new Date(mexicoTime).toISOString().split('T')[0];

        const order = await Order.findOne({
            where: { 
                dailyOrderNumber: dailyOrderNumber,
                client_id: clientId,
                orderDate: today
            },
            include: [{ model: Item, as: 'items' }]
        });

        if (!order) {
            return { error: 'Orden no encontrada o no asociada al cliente actual para el día de hoy' };
        }

        return {
            id: order.dailyOrderNumber,
            tipo: order.order_type,
            estado: order.status,
            telefono: order.phone_number,
            direccion_entrega: order.delivery_address,
            nombre_recogida: order.pickup_name,
            precio_total: order.total_price,
            tiempo_estimado: order.estimatedTime,
            fecha_creacion: order.createdAt.toLocaleString('es-MX', {
                timeZone: 'America/Mexico_City',
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }),
            items: order.items.map(item => ({
                id: item.id,
                nombre: item.name,
                observaciones: item.observations,
                cantidad: item.quantity,
                precio: item.price,
            }))
        };
    } catch (error) {
        console.error('Error al obtener los detalles de la orden:', error);
        return { error: 'Error al obtener los detalles de la orden' };
    }
}

function filterRelevantMessages(messages) {
    const keywordsUser = ['olvida lo anterior', 'nuevo pedido',];
    const keywordsAssistant = ['Tu pedido ha sido generado', 'Gracias por tu orden'];
    const MAX_MESSAGES = 20;
    
    let relevantMessages = [];
    let foundKeyword = false;

    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        
        if (!foundKeyword && relevantMessages.length < MAX_MESSAGES) {
            if (message.role === 'user' && keywordsUser.some(keyword => message.content.toLowerCase().includes(keyword))) {
                relevantMessages.unshift(message);
                foundKeyword = true;
            } else if (message.role === 'assistant' && keywordsAssistant.some(keyword => message.content.includes(keyword))) {
                foundKeyword = true;
            } else {
                relevantMessages.unshift(message);
            }
        }

        if (foundKeyword) break;
    }

    return relevantMessages.length > 0 ? relevantMessages : messages.slice(-MAX_MESSAGES);
}

async function getMenuAvailability() {
    const menuItems = await MenuItem.findAll();
    const availability = {};
    menuItems.forEach(item => {
        availability[item.code] = {
            disponible: item.available,
            nombre: item.name // Añadido el nombre del item
        };
    });
    return { availability };
}

export default async function handler(req, res) {
    await sequelize.sync({ alter: true });
    if (req.method === 'POST') {
        validateApiKey(req, res);
        const { messages, conversationId, stream } = req.body;
        
        try { 
            const filteredMessages = messages.filter(message => message.role !== 'system' && message.content.trim() !== '');
            const relevantMessages = filterRelevantMessages(filteredMessages);
            
            const menuAvailability = await getMenuAvailability(); // Obtener disponibilidad del menú de la base de datos
            
            // Añadir disponibilidad del menú a los mensajes relevantes
            // relevantMessages.push({
            //     role: 'assistant',
            //     content: `Disponibilidad actual del menú: ${JSON.stringify(menuAvailability.availability)}`
            // });

            console.log("Relevant messages:", relevantMessages);
            const thread = await openai.beta.threads.create({
                messages: relevantMessages
            });
 
            const QUEUE_TIMEOUT = 15000; // 15 segundos
            const startTime = Date.now();

            let run = await openai.beta.threads.runs.create(
                thread.id,
                {
                    assistant_id: process.env.ASSISTANT_ID,
                }
            );

            let shouldDeleteConversation = false; // Añadir esta variable

            while (['queued', 'in_progress', 'requires_action'].includes(run.status)) {
                if (run.status === 'requires_action') { 
                    const toolCalls = run.required_action.submit_tool_outputs.tool_calls;
                    console.log("Tool calls:", toolCalls);

                    const toolOutputs = await Promise.all(toolCalls.map(async (toolCall) => {
                        const clientId = conversationId.split(':')[1];
                        let result;
                        switch (toolCall.function.name) {
                            case 'get_customer_data':
                                const customerData = await getCustomerData(clientId);
                                return {
                                    tool_call_id: toolCall.id,
                                    output: JSON.stringify(customerData)
                                };
                            case 'create_order':
                                result = await createOrder(toolCall, clientId);
                                shouldDeleteConversation = true; // Activar el borrado
                                return result;
                            case 'modify_order':
                                result = await modifyOrder(toolCall, clientId);
                                shouldDeleteConversation = true; // Activar el borrado
                                return result;
                            case 'cancel_order':
                                result = await cancelOrder(toolCall, clientId);
                                shouldDeleteConversation = true; // Activar el borrado
                                return result;
                            case 'get_order_details':
                                const { daily_order_number } = JSON.parse(toolCall.function.arguments);
                                const orderDetails = await getOrderDetails(daily_order_number, clientId);
                                return {
                                    tool_call_id: toolCall.id,
                                    output: JSON.stringify(orderDetails)
                                };
                            default:
                                return {
                                    tool_call_id: toolCall.id,
                                    output: JSON.stringify({ error: "Unknown function" })
                                };
                        }
                    }));

                    run = await openai.beta.threads.runs.submitToolOutputs(
                        thread.id,
                        run.id,
                        { tool_outputs: toolOutputs }
                    );
                } else {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    run = await openai.beta.threads.runs.retrieve(
                        thread.id,
                        run.id
                    );
                }
                console.log("Run status:", run.status);
                
                // Verificar si se ha excedido el tiempo límite
                if (Date.now() - startTime > QUEUE_TIMEOUT && run.status === 'queued') {
                    console.log("La solicitud ha excedido el tiempo límite en estado 'queued'");
                    return res.status(504).json({ error: 'No se puede completar la solicitud en este momento. Por favor, inténtelo de nuevo más tarde.' });
                }
            }

            if (run.status === 'completed') {
                const messages = await openai.beta.threads.messages.list(thread.id);
                const lastAssistantMessage = messages.data.find(message => message.role === 'assistant');
                if (lastAssistantMessage && lastAssistantMessage.content[0].text) {
                    let text = lastAssistantMessage.content[0].text.value;
                    console.log("Assistant response:", text);
                    
                    res.status(200).send(text);
                    
                    // Mover la lógica de borrado después de enviar la respuesta
                    if (shouldDeleteConversation) {
                        const clientId = conversationId.split(':')[1];
                        try {
                            await deleteConversation(clientId);
                            console.log(`Conversación borrada para el cliente: ${clientId}`);
                        } catch (error) {
                            console.error(`Error al borrar la conversación para el cliente ${clientId}:`, error);
                        }
                    }
                } else {
                    console.log("Run failed with status:", run.status);
                    res.status(500).json({ error: 'Failed to complete the conversation' });
                }
            }

        } catch (error) {
            console.error("Error:", error);
            res.status(500).json({ error: 'Failed to fetch data from OpenAI' });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}

async function deleteConversation(clientId) {
    try {
        const deleteResponse = await axios.delete(`${process.env.BASE_URL}/api/delete_conversation`, {
            params: { clientId }
        });
        console.log('Conversación borrada:', deleteResponse.data);
    } catch (error) {
        console.error('Error al borrar la conversación:', error.response ? error.response.data : error.message);
        // No lanzamos el error aquí para evitar que afecte al flujo principal
    }
}