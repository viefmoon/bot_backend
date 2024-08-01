const OpenAI = require('openai');
const axios = require('axios');
const Customer = require('../../models/Customer');

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

function findClientId(messages) {
    const clientIdRegex = /Tu identificador de cliente: ([A-Z0-9]{6})/;
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'assistant') {
            const match = messages[i].content.match(clientIdRegex);
            if (match) {
                return match[1];
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

async function createOrder(toolCall, req) {
    const { order_type, items, phone_number, delivery_address, pickup_name } = JSON.parse(toolCall.function.arguments);
    const clientId = findClientId(req.body.messages);

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

export default async function handler(req, res) {
    // await connectDB(); // Conectar a la base de datos

    if (req.method === 'POST') {
        validateApiKey(req, res);
        const { messages, stream } = req.body;
        
        try { 
            const filteredMessages = messages.filter(message => message.role !== 'system' && message.content.trim() !== '');
            const limitedMessages = filteredMessages.slice(-1);
            console.log("Limited messages:", limitedMessages);
            const lastUserMessage = limitedMessages.findLast(message => message.role === 'user');
            console.log("Last user message:", lastUserMessage);
            
            const thread = await openai.beta.threads.create({
                messages: limitedMessages
            });
 
            let run = await openai.beta.threads.runs.create(
                thread.id,
                {
                    assistant_id: process.env.ASSISTANT_ID,
                }
            );

            while (['queued', 'in_progress', 'requires_action'].includes(run.status)) {
                if (run.status === 'requires_action') { 
                    console.log("Action required:", run.required_action);
                    const toolCalls = run.required_action.submit_tool_outputs.tool_calls;
                    console.log("Tool calls:", toolCalls);

                    const toolOutputs = await Promise.all(toolCalls.map(async (toolCall) => {
                        if (toolCall.function.name === 'get_customer_data') {
                            const clientId = findClientId(req.body.messages);
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
                            return await createOrder(toolCall, req);
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
            }

            if (run.status === 'completed') {
                const messages = await openai.beta.threads.messages.list(thread.id);
                const lastAssistantMessage = messages.data.find(message => message.role === 'assistant');
                if (lastAssistantMessage && lastAssistantMessage.content[0].text) {
                    let text = lastAssistantMessage.content[0].text.value;
                    console.log("Assistant response:", text);

                    // Buscar el identificador de cliente en los mensajes anteriores
                    let clientId = findClientId(req.body.messages);
                    let isNewClient = false;
                    
                    if (!clientId) {
                        // Generar nuevo identificador único si no se encuentra
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
                                    const phoneNumber = latestConversation.conversationId;
                                    console.log("Número de teléfono del cliente:", phoneNumber);

                                    // Asociar el número de teléfono con el identificador de cliente
                                    await Customer.upsert({
                                        phone_number: phoneNumber,
                                        client_id: clientId
                                    });
                                    console.log("Nuevo cliente asociado:", clientId, phoneNumber);
                                } else {
                                    console.log("No se pudo obtener la última conversación para el nuevo cliente");
                                }
                            } catch (error) {
                                console.error("Error al obtener la última conversación para el nuevo cliente:", error);
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