import * as dotenv from "dotenv";
import { AIResponse } from "../utils/messageProcessUtils";
import { AgentConfig, AgentMapping } from "src/types/agents";
import { preProcessMessagesGemini } from "./processors/geminiProcessor";
import { preProcessMessagesClaude } from "./processors/claudeProcessor";
import { preProcessMessagesOpenAI } from "./processors/openAIProcessor";
dotenv.config();

export async function preProcessMessages(
  messages: any[],
  currentAgent: AgentMapping,
  agentConfig: AgentConfig,
  orderSummary?: string
): Promise<AIResponse[]> {
  const agentProvider = currentAgent.provider;

  switch (agentProvider) {
    case "GEMINI":
      return preProcessMessagesGemini(
        messages,
        currentAgent,
        agentConfig,
        orderSummary
      );
    case "CLAUDE":
      return preProcessMessagesClaude(
        messages,
        currentAgent,
        agentConfig,
        orderSummary
      );
    case "OPENAI":
      return preProcessMessagesOpenAI(
        messages,
        currentAgent,
        agentConfig,
        orderSummary
      );
    default:
      throw new Error("Proveedor de agente no soportado");
  }
}
