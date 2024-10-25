import OpenAI from "openai";
import { AGENTS_OPENAI } from "src/config/agentsOpenAI";
import { prepareRequestPayloadOpenAI } from "src/utils/messageProcessUtils";
import {
  handleAgentTransfer,
  handlePreProcessOrderTool,
  handleMenuSend,
} from "src/utils/processors/commonHandlers";
import { AgentConfig, AgentMapping, AgentType } from "src/types/agents";
import { AIResponse } from "src/utils/messageProcessUtils";
import logger from "src/utils/logger";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function preProcessMessagesOpenAI(
  messages: any[],
  currentAgent: AgentMapping,
  agentConfig: AgentConfig,
  orderSummary?: string
): Promise<AIResponse[]> {
  try {
    const agent = AGENTS_OPENAI[currentAgent.type];

    // Obtener el mensaje del sistema
    const systemMessage =
      typeof agent.systemMessage === "function"
        ? await agent.systemMessage()
        : { role: "system", content: agent.systemMessage };

    // Construir los mensajes procesados incluyendo el mensaje del sistema
    const processedMessages = [
      systemMessage,
      ...(currentAgent.type === AgentType.ORDER_AGENT && orderSummary
        ? [{ role: "user", content: orderSummary }]
        : messages),
    ];

    const requestPayload = await prepareRequestPayloadOpenAI(
      agent,
      processedMessages
    );
    const response = await openai.chat.completions.create(requestPayload);

    console.log("response openai", JSON.stringify(response, null, 2));

    const responses: AIResponse[] = [];

    // Procesar la respuesta del modelo
    if (response.choices[0].message.tool_calls) {
      for (const toolCall of response.choices[0].message.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);

        switch (toolCall.function.name) {
          case "transfer_to_agent":
            return await handleAgentTransfer(args, messages, agentConfig);
          case "preprocess_order":
            responses.push(await handlePreProcessOrderTool({ args }));
            break;
          case "send_menu":
            responses.push(await handleMenuSend());
            break;
        }
      }
    } else if (response.choices[0].message.content) {
      responses.push({
        text: response.choices[0].message.content,
        isRelevant: true,
      });
    }

    return responses;
  } catch (error) {
    logger.error(
      `Error en preProcessMessagesOpenAI con agente ${currentAgent.type}:`,
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
