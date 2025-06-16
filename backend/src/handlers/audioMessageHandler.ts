import axios from 'axios';
import { createWriteStream, unlink } from 'fs';
import { promisify } from 'util';
import { sendWhatsAppMessage } from '../services/whatsapp';
import { handleTextMessage } from './textMessageHandler';
import { Readable } from 'stream';
import logger from '../utils/logger';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync } from 'fs';

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
    logger.error('Error getting audio URL:', error);
    return null;
  }
}

async function transcribeAudioWithGemini(audioUrl: string): Promise<string> {
  const audioPath = `/tmp/audio_${Date.now()}.ogg`;
  try {
    // Download audio file
    const { data } = await axios.get(audioUrl, {
      responseType: 'stream',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      },
    });

    await new Promise<void>((resolve, reject) => {
      const writer = createWriteStream(audioPath);
      if (data instanceof Readable) {
        data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
      } else {
        reject(new Error('Data is not a Readable stream'));
      }
    });

    // Read the file as base64
    const audioData = readFileSync(audioPath);
    const base64Audio = audioData.toString('base64');

    // Transcribe with Gemini using inline data
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-preview-05-20',
    });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'audio/ogg',
          data: base64Audio
        },
      },
      { text: 'Transcribe este audio al español. Solo devuelve la transcripción, sin agregar comentarios adicionales.' },
    ]);
    
    const transcription = result.response.text();
    logger.info(`Audio transcribed: ${transcription}`);
    
    return transcription || 'No pude transcribir el audio.';
  } catch (error) {
    logger.error('Error transcribing audio with Gemini:', error);
    return 'Lo siento, no pude transcribir el mensaje de audio.';
  } finally {
    // Clean up temp file
    await unlinkAsync(audioPath).catch(logger.error);
  }
}

export async function handleAudioMessage(
  from: string,
  message: any
): Promise<void> {
  try {
    const audioUrl = await getAudioUrl(message.audio.id);
    if (!audioUrl) {
      throw new Error('Could not get audio URL');
    }

    const transcribedText = await transcribeAudioWithGemini(audioUrl);
    
    // Process the transcribed text as a normal text message
    await handleTextMessage(from, transcribedText);
    
  } catch (error) {
    logger.error('Error processing audio message:', error);
    await sendWhatsAppMessage(
      from,
      '🎤 Hubo un problema al procesar tu mensaje de audio. Por favor, intenta nuevamente o envía un mensaje de texto.'
    );
  }
}