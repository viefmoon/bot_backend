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

export default async function handler(req, res) {
    if (req.method === 'POST') {
        validateApiKey(req, res);
        const { messages, stream } = req.body;
        console.log("Request body:", req.body);
        
        try {
            const filteredMessages = messages.filter(message => message.role !== 'system' && message.content.trim() !== '');
            const limitedMessages = filteredMessages.slice(-32);
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
                    
                    const toolOutputs = await Promise.all(toolCalls.map(async (toolCall) => {
                        if (toolCall.function.name === 'create_order') {
                            const args = JSON.parse(toolCall.function.arguments);
                            const result = await createOrder(args);
                            return {
                                tool_call_id: toolCall.id,
                                output: JSON.stringify(result)
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
            }

            if (run.status === 'completed') {
                const messages = await openai.beta.threads.messages.list(thread.id);
                const assistantMessages = messages.data.filter(message => message.role === 'assistant');
                const text = assistantMessages.map(message => message.content[0].text.value).join('\n');
                console.log(text);
                res.status(200).send(text);
            } else {
                console.log("Run failed with status:", run.status);
                res.status(500).json({ error: 'Failed to complete the conversation' });
            }

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to fetch data from OpenAI' });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}

async function createOrder(args) {
    const { items, phone_number, delivery_address, total_price } = args;
    try {
        const response = await axios.post(`${process.env.BASE_URL}/api/create_order`, {
            items,
            phone_number,
            delivery_address,
            total_price
        });
        return response.data;
    } catch (error) {
        console.error("Error creating order:", error);
        return { error: 'Failed to create order' };
    }
}