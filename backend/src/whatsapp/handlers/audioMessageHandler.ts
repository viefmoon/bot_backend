import * as dotenv from "dotenv";
dotenv.config();
import axios from "axios";
import { createWriteStream, createReadStream, unlink } from "fs";
import { promisify } from "util";
import FormData = require("form-data");
import { sendWhatsAppMessage } from "../../services/whatsapp";
import { handleTextMessage } from "./textMessageHandler";
import { Readable } from "stream";
import logger from "../../common/utils/logger";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const unlinkAsync = promisify(unlink);

// Añadir esta enumeración al inicio del archivo
export enum TranscriptionModel {
  GEMINI = "gemini",
}

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

async function transcribeAudio(
  audioUrl: string,
  model: TranscriptionModel = TranscriptionModel.GEMINI
): Promise<string> {
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

    // Implementación de Gemini por defecto
      const fileManager = new GoogleAIFileManager(
        process.env.GOOGLE_AI_API_KEY
      );
      const audioFile = await fileManager.uploadFile(audioPath, {
        mimeType: "audio/ogg",
      });

      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
      const genModel = genAI.getGenerativeModel({
        model: "gemini-1.5-flash-002",
      });

      const result = await genModel.generateContent([
        {
          fileData: {
            mimeType: audioFile.file.mimeType,
            fileUri: audioFile.file.uri,
          },
        },
        { text: "Generate a transcript of the speech." },
      ]);
      return result.response.candidates[0].content.parts[0].text;
  } catch (error) {
    logger.error("Error al transcribir el audio:", error);
    return "Lo siento, no pude transcribir el mensaje de audio.";
  } finally {
    await unlinkAsync(audioPath).catch(logger.error);
  }
}

export async function handleAudioMessage(
  from: string,
  message: any,
  model: TranscriptionModel = TranscriptionModel.GEMINI
): Promise<void> {
  try {
    const audioUrl = await getAudioUrl(message.audio.id);
    if (!audioUrl) throw new Error("No se pudo obtener la URL del audio.");

    const transcribedText = await transcribeAudio(audioUrl, model);
    await handleTextMessage(from, transcribedText);
  } catch (error) {
    logger.error("Error al procesar el mensaje de audio:", error);
    await sendWhatsAppMessage(
      from,
      "🎤 Hubo un problema al procesar tu mensaje de audio. Por favor, intenta nuevamente o envía un mensaje de texto."
    );
  }
}
