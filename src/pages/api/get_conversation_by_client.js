const axios = require('axios');
const cors = require('cors');

// Configurar CORS
const corsMiddleware = cors({
  origin: '*', // Permite todas las origenes en desarrollo. Ajusta esto en producción.
  methods: ['GET'],
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

  if (req.method === 'GET') {
    try {
      const { client_id } = req.query;

      if (!client_id) {
        return res.status(400).json({ error: 'Se requiere el ID del cliente.' });
      }

      const chatbotId = process.env.CHATBOT_ID;
      const conversationIdPrefix = '5219986399261:'; // Anteponer este número y los dos puntos al client_id
      const conversationId = `${conversationIdPrefix}${client_id}`;

      // Realizar la solicitud GET a la API de chat-data.com para obtener todas las conversaciones
      const response = await axios.get(`https://api.chat-data.com/api/v2/get-conversations/${chatbotId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.CHAT_DATA_API_TOKEN}`
        }
      });
      console.log(response.data);

      const conversations = response.data;

      if (!Array.isArray(conversations)) {
        throw new Error('La respuesta de la API no es un arreglo.');
      }

      // Filtrar la conversación que corresponde al client_id
      const conversation = conversations.find(conv => conv.id === conversationId);

      if (!conversation) {
        return res.status(404).json({ error: 'Conversación no encontrada.' });
      }

      res.status(200).json(conversation);
    } catch (error) {
      console.error('Error al obtener la conversación:', error);
      res.status(500).json({ error: 'Error al obtener la conversación' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}