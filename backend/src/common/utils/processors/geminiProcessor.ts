import { GoogleGenerativeAI } from "@google/generative-ai";
import { AGENTS_GEMINI } from "../../config/agentsGemini";
import { prepareModelGemini } from "../messageProcessUtils";
import {
  handleAgentTransfer,
  handlePreProcessOrderTool,
  handleMenuSend,
} from "./commonHandlers";
import { AgentConfig, AgentMapping, AgentType } from "../../types/agents";
import { AIResponse } from "../messageProcessUtils";
import logger from "../logger";
import { findMenuMatches } from "../orderSummaryAnalyzer";

const googleAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

export async function preProcessMessagesGemini(
  messages: any[],
  currentAgent: AgentMapping,
  agentConfig: AgentConfig,
  orderDetails?: { quantity: number; description: string }[]
): Promise<AIResponse[]> {
  try {
    const agent = AGENTS_GEMINI[currentAgent.type];
    const processedMessages =
      currentAgent.type === AgentType.ORDER_MAPPER_AGENT && orderDetails
        ? [
            {
              role: "user",
              parts: [{ text: JSON.stringify(await findMenuMatches(orderDetails)) }]
            }
          ]
        : messages.map((message) => ({
            role: message.role === "assistant" ? "model" : message.role,
            parts: [{ text: message.content }]
          }));

    const model = googleAI.getGenerativeModel(await prepareModelGemini(agent));

    console.log("systemInstruction", model.systemInstruction.parts[0].text);
    console.log(
      "processedMessages",
      JSON.stringify(processedMessages, null, 2)
    );
    const response = await model.generateContent({
      contents: processedMessages as any,
    });

    console.log("response gemini", JSON.stringify(response, null, 2));

    const responses: AIResponse[] = [];

    for (const part of response.response.candidates[0].content.parts) {
      if (part.text) {
        responses.push({
          text: part.text,
          isRelevant: true,
        });
      } else if (part.functionCall) {
        switch (part.functionCall.name) {
          case "route_to_agent":
            // Nota: Aquí necesitarás pasar agentConfig, que no está disponible en este scope.
            // Considera pasar agentConfig como un parámetro adicional a esta función.
            return await handleAgentTransfer(
              part.functionCall.args as any,
              messages,
              agentConfig
            );
          case "map_order_items":
            responses.push(
              await handlePreProcessOrderTool({ args: part.functionCall.args })
            );
            break;
          case "send_menu":
            responses.push(await handleMenuSend());
            break;
        }
      }
    }

    return responses;
  } catch (error) {
    logger.error(
      `Error en preProcessMessagesGemini con agente ${currentAgent.type}:`,
      error
    );
    return [
      {
        text: "Error al procesar el mensaje",
        isRelevant: true,
      },
    ];
  }
}
