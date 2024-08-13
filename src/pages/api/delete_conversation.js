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
    console.log("DELETE request received");
    console.log(req.query);
    try {
      const { clientId } = req.query;

      if (!clientId) {
        return res.status(400).json({ error: 'Se requiere el ID del cliente.' });
      }

      const chatbotId = process.env.CHATBOT_ID;
      const conversationIdPrefix = process.env.CONVERSATION_ID_PREFIX;
      const conversationId = `${conversationIdPrefix}${clientId}`;

      // Verificar que el token de autorización es válido
      const token = process.env.CHAT_DATA_API_TOKEN;
      if (!token) {
        return res.status(500).json({ error: 'Token de autorización no encontrado.' });
      }

      console.log('chatbotId:', chatbotId);
      console.log('conversationId:', conversationId);

      // Realizar la solicitud DELETE a la API de chat-data.com para borrar la conversación
      const url = `https://api.chat-data.com/api/v2/delete-conversation?chatbotId=${chatbotId}&conversationId=${conversationId}`;

      const response = await axios({
        method: 'delete',
        url: url,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.status === 200) {
        res.status(200).json({ mensaje: 'Conversación borrada exitosamente' });
      } else {
        res.status(response.status).json({ error: 'Error al borrar la conversación' });
      }
    } catch (error) {
      console.error('Error al borrar la conversación:', error.response ? error.response.data : error.message);
      res.status(500).json({ error: 'Error al borrar la conversación' });
    }
  } else {
    res.setHeader('Allow', ['DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}