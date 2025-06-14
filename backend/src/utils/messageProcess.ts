import * as dotenv from "dotenv";
import { AIResponse } from "../utils/messageProcessUtils";
import { AgentConfig, AgentMapping } from "src/types/agents";
import { preProcessMessagesGemini } from "./processors/geminiProcessor";
dotenv.config();

export async function preProcessMessages(
  messages: any[],
  currentAgent: AgentMapping,
  agentConfig: AgentConfig,
  orderDetails?: { quantity: number; description: string }[]
): Promise<AIResponse[]> {
  const agentProvider = currentAgent.provider;

  switch (agentProvider) {
    case "GEMINI":
      return preProcessMessagesGemini(
        messages,
        currentAgent,
        agentConfig,
        orderDetails
      );
    default:
      throw new Error("Proveedor de agente no soportado");
  }
}
