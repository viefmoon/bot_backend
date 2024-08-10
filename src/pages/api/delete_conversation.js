const axios = require('axios');
const cors = require('cors');

// Configurar CORS
const corsMiddleware = cors({
  origin: '*', // Permite todas las origenes en desarrollo. Ajusta esto en producción.
  methods: ['DELETE'],
});

export default async function handler(req, res) {
  // Aplicar el middleware CORS
  await new Promise((resolve, reject) => {
    corsMiddleware(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });

  if (req.method === 'DELETE') {
    try {
      const { clientId } = req.query;

      if (!clientId) {
        return res.status(400).json({ error: 'Se requiere el ID del cliente.' });
      }

      const chatbotId = process.env.CHATBOT_ID;
      const conversationIdPrefix = process.env.CONVERSATION_ID_PREFIX;
      const conversationId = `${conversationIdPrefix}${clientId}`;

      // Realizar la solicitud DELETE a la API de chat-data.com para borrar la conversación
      const response = await axios.delete(`https://api.chat-data.com/api/v1/chatbot/conversation?conversationId=${conversationId}&chatbotId=${chatbotId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.CHAT_DATA_API_TOKEN}`
        }
      });

      if (response.status === 200) {
        res.status(200).json({ mensaje: 'Conversación borrada exitosamente' });
      } else {
        res.status(response.status).json({ error: 'Error al borrar la conversación' });
      }
    } catch (error) {
      console.error('Error al borrar la conversación:', error);
      res.status(500).json({ error: 'Error al borrar la conversación' });
    }
  } else {
    res.setHeader('Allow', ['DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}