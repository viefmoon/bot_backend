import OpenAI from "openai";
import axios from 'axios';

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

export default async function handler(req, res) {
    if (req.method === 'POST') {
        validateApiKey(req, res);
        const { messages, stream } = req.body;
        console.log("Request body:", req.body);
        
        try {
            const filteredMessages = messages.filter(message => message.role !== 'system' && message.content.trim() !== '');
            const limitedMessages = filteredMessages.slice(-10);
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
                        if (toolCall.function.name === 'create_order') {
                            console.log("Function call detected:", JSON.stringify(toolCall, null, 2));
                            const { items, phone_number, delivery_address, total_price } = JSON.parse(toolCall.function.arguments);

                            try {
                                const response = await axios.post(`${process.env.BASE_URL}/api/create_order`, {
                                    items,
                                    phone_number,
                                    delivery_address,
                                    total_price
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
                                    output: JSON.stringify({ error: "Failed to create order", details: error.message })
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
            }

            if (run.status === 'completed') {
                const messages = await openai.beta.threads.messages.list(thread.id);
                const lastAssistantMessage = messages.data.find(message => message.role === 'assistant');
                if (lastAssistantMessage && lastAssistantMessage.content[0].text) {
                    const text = lastAssistantMessage.content[0].text.value;
                    console.log("Assistant response:", text);

                    // Enviar la respuesta inmediatamente
                    res.status(200).send(text);

                    // Obtener la última conversación después de enviar la respuesta
                    setTimeout(async () => {
                        try {
                            const latestConversation = await getLatestConversation();
                            if (latestConversation) {
                                const lastMessage = latestConversation.messages[latestConversation.messages.length - 1];
                                console.log("Último mensaje de la conversación:", lastMessage);
                                const phoneNumber = latestConversation.conversationId;
                                console.log("Número de teléfono del cliente:", phoneNumber);
                            } else {
                                console.log("No se pudo obtener la última conversación");
                            }
                        } catch (error) {
                            console.error("Error al obtener la última conversación:", error);
                        }
                    }, 1000);
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