const OpenAI = require('openai');
const axios = require('axios');
const { Customer, Order, Item } = require('../../models');
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

async function getLatestConversation() {
    const url = `https://api.chat-data.com/api/v2/get-conversations/${process.env.CHATBOT_ID}?start=0&size=1`;

    try {
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${process.env.CHAT_DATA_API_TOKEN}`
            }
        });

        if (response.data.conversations && response.data.conversations.length > 0) {
            return response.data.conversations[0];
        }
        return null;
    } catch (error) {
        console.error("Error al obtener la última conversación:", error);
        return null;
    }
}

async function findClientId(messages) {
    const clientIdRegex = /Tu identificador de cliente: ([A-Z0-9]{6})/;
    const relevantMessages = filterRelevantMessages(messages);
    for (let i = relevantMessages.length - 1; i >= 0; i--) {
        if (relevantMessages[i].role === 'assistant') {
            const match = relevantMessages[i].content.match(clientIdRegex);
            if (match) {
                const clientId = match[1];
                // Verificar si el ID existe en la base de datos
                const customer = await Customer.findOne({ where: { client_id: clientId } });
                if (customer) {
                    return clientId;
                }
            }
        }
    }
    return null;
}

async function generateUniqueClientId() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let clientId;
    let isUnique = false;

    while (!isUnique) {
        clientId = '';
        for (let i = 0; i < 6; i++) {
            clientId += characters.charAt(Math.floor(Math.random() * characters.length));
        }

        // Verificar si el ID ya existe en la base de datos
        const existingCustomer = await Customer.findOne({ where: { client_id: clientId } });
        if (!existingCustomer) {
            isUnique = true;
        }
    }

    return clientId;
}

// Añadir esta función después de findClientId
async function getCustomerData(clientId) {
    try {
        const response = await axios.get(`${process.env.BASE_URL}/api/get_customer_data?client_id=${clientId}`);
        return response.data;
    } catch (error) {
        console.error("Error al obtener datos del cliente:", error);
        return null;
    }
}

async function createOrder(toolCall, relevantMessages) {
    const { order_type, items, phone_number, delivery_address, pickup_name } = JSON.parse(toolCall.function.arguments);
    const clientId = await findClientId(relevantMessages); // Asegurarse de que se resuelva la promesa

    // Calcular el precio total
    const total_price = items.reduce((total, item) => total + (item.price * item.quantity), 0);

    try {
        const response = await axios.post(`${process.env.BASE_URL}/api/create_order`, {
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

async function getOrderDetails(orderId, clientId) {
    try {
        const order = await Order.findOne({
            where: { id: orderId, client_id: clientId },
            include: [{ model: Item, as: 'items' }]
        });

        if (!order) {
            return { error: 'Orden no encontrada o no asociada al cliente actual' };
        }

        return {
            id: order.id,
            tipo: order.order_type,
            estado: order.status,
            telefono: order.phone_number,
            direccion_entrega: order.delivery_address,
            nombre_recogida: order.pickup_name,
            precio_total: order.total_price,
            id_cliente: order.client_id,
            fecha_creacion: order.createdAt,
            items: order.items.map(item => ({
                id: item.id,
                nombre: item.name,
                cantidad: item.quantity,
                precio: item.price
            }))
        };
    } catch (error) {
        console.error('Error al obtener los detalles de la orden:', error);
        return { error: 'Error al obtener los detalles de la orden' };
    }
}

function filterRelevantMessages(messages) {
    const keywordsUser = ['olvida lo anterior', 'nuevo pedido', 'quiero ordenar'];
    const keywordsAssistant = ['Tu pedido ha sido generado', 'Gracias por tu orden'];
    const clientIdRegex = /Tu identificador de cliente: ([A-Z0-9]{6})/;
    const MAX_MESSAGES = 20;
    
    let relevantMessages = [];
    let clientIdMessage = null;
    let foundKeyword = false;

    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        
        if (message.role === 'assistant' && !clientIdMessage) {
            const match = message.content.match(clientIdRegex);
            if (match) {
                clientIdMessage = {
                    role: 'assistant',
                    content: `Tu identificador de cliente: ${match[1]}`
                };
                if (foundKeyword) break;
            }
        }
        
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

        if (foundKeyword && clientIdMessage) break;
    }

    if (clientIdMessage) {
        relevantMessages.unshift(clientIdMessage);
    }

    return relevantMessages.length > 0 ? relevantMessages : messages.slice(-MAX_MESSAGES);
}

export default async function handler(req, res) {
    await sequelize.sync({ alter: true });
    if (req.method === 'POST') {
        validateApiKey(req, res);
        const { messages, stream } = req.body;
        
        try { 
            const filteredMessages = messages.filter(message => message.role !== 'system' && message.content.trim() !== '');
            const relevantMessages = filterRelevantMessages(filteredMessages);
            console.log("Mensajes relevantes:", relevantMessages);
            
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

            while (['queued', 'in_progress', 'requires_action'].includes(run.status)) {
                if (run.status === 'requires_action') { 
                    const toolCalls = run.required_action.submit_tool_outputs.tool_calls;
                    console.log("Tool calls:", toolCalls);

                    const toolOutputs = await Promise.all(toolCalls.map(async (toolCall) => {
                        if (toolCall.function.name === 'get_customer_data') {
                            const clientId = await findClientId(relevantMessages); // Asegurarse de que se resuelva la promesa
                            if (clientId) {
                                const customerData = await getCustomerData(clientId);
                                return {
                                    tool_call_id: toolCall.id,
                                    output: JSON.stringify(customerData)
                                };
                            } else {
                                return {
                                    tool_call_id: toolCall.id,
                                    output: JSON.stringify({ error: "No se encontró ID de cliente" })
                                };
                            }
                        } else if (toolCall.function.name === 'create_order') {
                            return await createOrder(toolCall, relevantMessages);
                        } else if (toolCall.function.name === 'get_order_details') {
                            const clientId = await findClientId(relevantMessages);
                            if (clientId) {
                                const { order_id } = JSON.parse(toolCall.function.arguments);
                                const orderDetails = await getOrderDetails(order_id, clientId);
                                return {
                                    tool_call_id: toolCall.id,
                                    output: JSON.stringify(orderDetails)
                                };
                            } else {
                                return {
                                    tool_call_id: toolCall.id,
                                    output: JSON.stringify({ error: "No se encontró ID de cliente" })
                                };
                            }
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

                    // Buscar el identificador de cliente en los mensajes anteriores y verificar en la base de datos
                    let clientId = await findClientId(relevantMessages);
                    let isNewClient = false;
                    
                    if (!clientId) {
                        // Generar nuevo identificador único si no se encuentra o no existe en la base de datos
                        clientId = await generateUniqueClientId();
                        text += `\n\nTu identificador de cliente: ${clientId}`;
                        isNewClient = true;
                    }

                    // Enviar la respuesta inmediatamente
                    res.status(200).send(text);

                    // Asociar el número de teléfono solo para nuevos clientes
                    if (isNewClient) {
                        setTimeout(async () => {
                            try {
                                const latestConversation = await getLatestConversation();
                                if (latestConversation) {
                                    const [, phoneNumber] = latestConversation.conversationId.split(':');
                                    
                                    if (phoneNumber) {
                                        // Verificar si el número de teléfono ya está asociado
                                        const existingCustomer = await Customer.findOne({ where: { phone_number: phoneNumber } });
                                        
                                        if (existingCustomer) {
                                            // Si existe, borrar la asociación anterior
                                            await Customer.destroy({ where: { phone_number: phoneNumber } });
                                            console.log("Asociación anterior eliminada para el número:", phoneNumber);
                                        }
                                        
                                        // Crear nueva asociación
                                        await Customer.create({
                                            phone_number: phoneNumber,
                                            client_id: clientId
                                        });
                                        console.log("Nuevo cliente asociado:", clientId, phoneNumber);
                                    } else {
                                        console.log("No se pudo extraer el número de teléfono del conversationId");
                                    }
                                } else {
                                    console.log("No se pudo obtener la última conversación para el nuevo cliente, no se puede asociar el número de teléfono");
                                }
                            } catch (error) {
                                console.error("Error al procesar la asociación del nuevo cliente:", error);
                            }
                        }, 1000);
                    }
                } else {
                    console.log("No assistant response found");
                    res.status(500).json({ error: 'No assistant response found' });
                }
            } else {
                console.log("Run failed with status:", run.status);
                res.status(500).json({ error: 'Failed to complete the conversation' });
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