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
    // Check if the request method is POST
    if (req.method === 'POST') {
        validateApiKey(req, res);
        // Process a POST request
        const { messages, stream } = req.body; // Assuming the body contains a "message" field
        console.log("Request body:", req.body); // Imprime el contenido del body
        try {
            // Filtrar mensajes para eliminar aquellos con rol 'system' o contenido vacío
            const filteredMessages = messages.filter(message => message.role !== 'system' && message.content.trim() !== '');
            
            // Limitar el número de mensajes a los últimos 32
            const limitedMessages = filteredMessages.slice(-10);
            
            // Find the last user conversation. 
            const lastUserMessage = limitedMessages.findLast(message => message.role === 'user');
            console.log("Last user message:", lastUserMessage); // Imprime el contenido del último mensaje
            const thread = await openai.beta.threads.create({
                messages: limitedMessages // Enviar los últimos 32 mensajes filtrados para mantener el contexto
            });

            // We use the createAndStream SDK helper to create a run with
            // streaming. The SDK provides helpful event listeners to handle 
            // the streamed response.
            if (stream) {
                const run = openai.beta.threads.runs.createAndStream(thread.id, {
                    assistant_id: process.env.ASSISTANT_ID
                })
                    .on('end', () => {
                        res.end();
                    })
                    .on('textDelta', (textDelta, snapshot) => {
                        res.write(textDelta.value);
                    })
                    .on('toolCallCreated', (toolCall) => {
                        res.write('\n```python\n');
                    })
                    .on('toolCallDelta', (toolCallDelta, snapshot) => {
                        if (toolCallDelta.type === 'code_interpreter') {
                            if (toolCallDelta.code_interpreter.input) {
                                res.write(toolCallDelta.code_interpreter.input)
                            }
                            if (toolCallDelta.code_interpreter.outputs) {
                                toolCallDelta.code_interpreter.outputs.forEach(output => {
                                    if (output.type === "logs") {
                                        res.write(`\n${output.logs}\n`);
                                    }
                                });
                            }
                        }
                    })
                    .on('toolCallDone', (toolCallDelta, snapshot) => {
                        res.write('\n```\n');
                    });
            } else {
                let run = await openai.beta.threads.runs.create(
                    thread.id,
                    {
                        assistant_id: process.env.ASSISTANT_ID,
                    }
                );
                while (['queued', 'in_progress', 'cancelling'].includes(run.status)) {
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second
                    run = await openai.beta.threads.runs.retrieve(
                        run.thread_id,
                        run.id
                    );
                }
                const results = [];
                if (run.status === 'completed') {
                    const messages = await openai.beta.threads.messages.list(
                        run.thread_id
                    );
                    for (const message of messages.data) {
                        if (message.role === 'user') {
                            break;
                        }
                        results.push(message);
                    }

                } else {
                    console.log(run.status);
                }
                const text = results.reverse().map(result => result.content[0].text.value).join('\n');
                console.log(text);
                res.status(200).send(text);
            }

            // Manejar la función create_order
            if (messages && messages.data) {
                const functionCall = messages.data.find(message => message.function_call);
                if (functionCall && functionCall.name === 'create_order') {
                    console.log("Function call detected:", functionCall);
                    const { items, phone_number, delivery_address, total_price } = functionCall.parameters;

                    // Llamar a la función create_order en tu backend
                    const response = await axios.post(`${process.env.BASE_URL}/api/create_order`, {
                        items,
                        phone_number,
                        delivery_address,
                        total_price
                    });

                    const orderResult = response.data;
                    console.log(orderResult);

                    // Verificar si se requiere alguna acción adicional
                    if (orderResult.requires_action) {
                        console.log("Order requires additional action:", orderResult.requires_action);
                        // Manejar la acción adicional aquí
                        // Por ejemplo, podrías enviar una respuesta al cliente indicando la acción requerida
                        return res.status(200).json({
                            status: 'requires_action',
                            message: 'Se requiere una acción adicional para completar el pedido.',
                            action: orderResult.requires_action
                        });
                    } else {
                        console.log("Order does not require additional action:", orderResult);
                        // Confirmar el pedido si no se requiere ninguna acción adicional
                        return res.status(200).json({
                            status: 'success',
                            message: 'Pedido confirmado exitosamente.',
                            order: orderResult
                        });
                    }
                }
            }

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to fetch data from OpenAI' });
        }
    } else {
        // Handle any cases that are not POST
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}