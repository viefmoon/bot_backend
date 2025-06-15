import { GoogleGenerativeAI } from '@google/generative-ai';
import { Customer } from '@prisma/client';
import logger from '../utils/logger';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

export async function generateAIResponse(customer: Customer, userMessage: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    // Build context from chat history
    const chatHistory = customer.relevantChatHistory as any[] || [];
    const context = chatHistory.map((msg: any) => 
      `${msg.from === 'user' ? 'Usuario' : 'Asistente'}: ${msg.message}`
    ).join('\n');
    
    const prompt = `Eres un asistente de pedidos para una pizzería. 
    Tu trabajo es ayudar a los clientes a hacer pedidos, responder preguntas sobre el menú y proporcionar información sobre entregas.
    
    Contexto de la conversación:
    ${context}
    
    Usuario: ${userMessage}
    
    Responde de manera amigable y profesional en español:`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    return text || 'Lo siento, no pude procesar tu solicitud. ¿Podrías reformularla?';
    
  } catch (error) {
    logger.error('Error generating AI response:', error);
    return 'Lo siento, estoy teniendo problemas técnicos. Por favor intenta de nuevo en unos momentos.';
  }
}