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
    const { data } = await axios.get(
      `https://graph.facebook.com/v19.0/${audioId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        },
      }
    );
    return data.url;
  } catch (error) {
    console.error("Error al obtener la URL del audio:", error);
    return null;
  }
}

async function transcribeAudio(audioUrl) {
  const audioPath = `/tmp/audio.ogg`;
  try {
    const { data } = await axios.get(audioUrl, {
      responseType: "stream",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      },
    });

    await new Promise((resolve, reject) => {
      const writer = createWriteStream(audioPath);
      data.pipe(writer);
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    const formData = new FormData();
    formData.append("file", createReadStream(audioPath));
    formData.append("model", "whisper-1");

    const { data: whisperData } = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    return whisperData.text;
  } catch (error) {
    console.error("Error al transcribir el audio:", error);
    return "Lo siento, no pude transcribir el mensaje de audio.";
  } finally {
    await unlinkAsync(audioPath).catch(console.error);
  }
}

export async function handleAudioMessage(from, message) {
  try {
    const audioUrl = await getAudioUrl(message.audio.id);
    if (!audioUrl) throw new Error("No se pudo obtener la URL del audio.");

    const transcribedText = await transcribeAudio(audioUrl);
    await handleTextMessage(from, transcribedText);
  } catch (error) {
    console.error("Error al procesar el mensaje de audio:", error);
    await sendWhatsAppMessage(
      from,
      "Hubo un problema al procesar tu mensaje de audio. Por favor, intenta nuevamente o envia un mensaje de texto."
    );
  }
}
