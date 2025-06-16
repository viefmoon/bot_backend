import Anthropic from "@anthropic-ai/sdk";
import { AGENTS_CLAUDE } from "src/config/agentsClaude";
import { prepareRequestPayloadClaude } from "src/utils/messageProcessUtils";
import {
  handleAgentTransfer,
  handlePreProcessOrderTool,
  handleMenuSend,
} from "src/utils/processors/commonHandlers";
import { AgentConfig, AgentMapping, AgentType } from "src/types/agents";
import { AIResponse } from "src/utils/messageProcessUtils";
import logger from "src/utils/logger";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function preProcessMessagesClaude(
  messages: any[],
  currentAgent: AgentMapping,
  agentConfig: AgentConfig,
  orderDetails?: { quantity: number; description: string }[]
): Promise<AIResponse[]> {
  try {
    const agent = AGENTS_CLAUDE[currentAgent.type];
    const processedMessages =
      currentAgent.type === AgentType.ORDER_MAPPER_AGENT && orderDetails
        ? [{ role: "user", content: orderDetails }]
        : messages;

    const response = await anthropic.beta.promptCaching.messages.create({
      ...(await prepareRequestPayloadClaude(agent, processedMessages)),
      tool_choice: { type: "auto", disable_parallel_tool_use: false },
    });

    console.log("response claude", JSON.stringify(response, null, 2));

    const responses: AIResponse[] = [];

    for (const content of response.content) {
      if (content.type === "text") {
        responses.push({
          text: content.text,
          isRelevant: true,
        });
        continue;
      }

      if (content.type === "tool_use") {
        switch (content.name) {
          case "transfer_to_agent":
            // Nota: Aquí también necesitarás pasar agentConfig.
            return await handleAgentTransfer(
              content.input as any,
              messages,
              agentConfig
            );
          case "preprocess_order":
            responses.push(
              await handlePreProcessOrderTool({ args: content.input as any })
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
      `Error en preprocessMessagesClaude con agente ${currentAgent.type}:`,
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
