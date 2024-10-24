import * as dotenv from "dotenv";
dotenv.config();
import axios from "axios";
import { createWriteStream, createReadStream, unlink } from "fs";
import { promisify } from "util";
import FormData = require("form-data");
import { sendWhatsAppMessage } from "./whatsAppUtils";
import { handleTextMessage } from "./textMessageHandler";
import { Readable } from "stream";
import logger from "./logger";

const unlinkAsync = promisify(unlink);

async function getAudioUrl(audioId: string): Promise<string | null> {
  try {
    const { data } = await axios.get<{ url: string }>(
      `https://graph.facebook.com/v19.0/${audioId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        },
      }
    );
    return data.url;
  } catch (error) {
    logger.error("Error al obtener la URL del audio:", error);
    return null;
  }
}

async function transcribeAudio(audioUrl: string): Promise<string> {
  const audioPath = `/tmp/audio.ogg`;
  try {
    const { data } = await axios.get(audioUrl, {
      responseType: "stream",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      },
    });

    await new Promise<void>((resolve, reject) => {
      const writer = createWriteStream(audioPath);
      if (data instanceof Readable) {
        data.pipe(writer);
        writer.on("finish", resolve);
        writer.on("error", reject);
      } else {
        reject(new Error("data no es un Readable stream"));
      }
    });

    const formData = new FormData();
    formData.append("file", createReadStream(audioPath));
    formData.append("model", "whisper-1");

    const { data: whisperData } = await axios.post<{ text: string }>(
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
    logger.error("Error al transcribir el audio:", error);
    return "Lo siento, no pude transcribir el mensaje de audio.";
  } finally {
    await unlinkAsync(audioPath).catch(logger.error);
  }
}

export async function handleAudioMessage(
  from: string,
  message: any
): Promise<void> {
  try {
    const audioUrl = await getAudioUrl(message.audio.id);
    if (!audioUrl) throw new Error("No se pudo obtener la URL del audio.");

    const transcribedText = await transcribeAudio(audioUrl);
    await handleTextMessage(from, transcribedText);
  } catch (error) {
    logger.error("Error al procesar el mensaje de audio:", error);
    await sendWhatsAppMessage(
      from,
      "🎤 Hubo un problema al procesar tu mensaje de audio. Por favor, intenta nuevamente o envía un mensaje de texto."
    );
  }
}
