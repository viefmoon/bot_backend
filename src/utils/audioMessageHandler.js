import dotenv from "dotenv";
dotenv.config();
import axios from "axios";
import { createWriteStream, createReadStream, unlink } from "fs";
import { promisify } from "util";
import FormData from "form-data";
import { sendWhatsAppMessage } from "./whatsAppUtils";
import { handleTextMessage } from "./textMessageHandler";

const unlinkAsync = promisify(unlink);

async function getAudioUrl(audioId) {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/v19.0/${audioId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        },
      }
    );
    return response.data.url;
  } catch (error) {
    console.error("Error al obtener la URL del audio:", error);
    return null;
  }
}

async function transcribeAudio(audioUrl) {
  try {
    const response = await axios.get(audioUrl, {
      responseType: "stream",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      },
    });
    const audioPath = `/tmp/audio.ogg`;
    const writer = createWriteStream(audioPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    const formData = new FormData();
    formData.append("file", createReadStream(audioPath));
    formData.append("model", "whisper-1");

    const whisperResponse = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    await unlinkAsync(audioPath);

    return whisperResponse.data.text;
  } catch (error) {
    console.error("Error al transcribir el audio:", error);

    if (error.response) {
      console.error("Error en la respuesta de la API:", error.response.data);
    } else if (error.request) {
      console.error("No se recibió respuesta de la API:", error.request);
    } else {
      console.error("Error al configurar la solicitud:", error.message);
    }

    return "Lo siento, no pude transcribir el mensaje de audio.";
  }
}

export async function handleAudioMessage(from, message) {
  if (message.audio && message.audio.id) {
    try {
      const audioUrl = await getAudioUrl(message.audio.id);
      if (audioUrl) {
        const transcribedText = await transcribeAudio(audioUrl);
        await handleTextMessage(from, transcribedText);
      } else {
        throw new Error("No se pudo obtener la URL del audio.");
      }
    } catch (error) {
      console.error("Error al procesar el mensaje de audio:", error);
      await sendWhatsAppMessage(
        from,
        "Hubo un problema al procesar tu mensaje de audio. Por favor, intenta nuevamente."
      );
    }
  } else {
    console.error("No se encontró el ID del audio.");
    await sendWhatsAppMessage(
      from,
      "No pude obtener la información necesaria del mensaje de audio."
    );
  }
}
