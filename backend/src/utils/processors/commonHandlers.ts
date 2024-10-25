import { MenuService } from "src/services/menu.service";
import { extractMentionedProduct } from "../productExtractor";
import {
  getErrorsAndWarnings,
  PreprocessedContent,
  AIResponse,
} from "../messageProcessUtils";
import { AgentConfig, AgentType } from "src/types/agents";
import { preProcessMessages } from "../messageProcess";

const menuService = new MenuService();

export async function handleAgentTransfer(
  {
    targetAgent,
    orderSummary,
  }: { targetAgent: AgentType; orderSummary: string },
  messages: any[],
  agentConfig: AgentConfig
): Promise<AIResponse[]> {
  const targetAgentMapping =
    targetAgent === AgentType.ORDER_AGENT
      ? agentConfig.orderAgent
      : agentConfig.generalAgent;

  return preProcessMessages(
    messages,
    targetAgentMapping,
    agentConfig,
    orderSummary
  );
}

export async function handlePreProcessOrderTool({
  args,
}: {
  args: any;
}): Promise<AIResponse> {
  const preprocessedContent: PreprocessedContent = args;

  for (const item of preprocessedContent.orderItems) {
    if (item?.description) {
      const extractedProduct = await extractMentionedProduct(item.description);
      Object.assign(item, extractedProduct);
    }
  }

  const { errorMessage, hasErrors } = getErrorsAndWarnings(preprocessedContent);

  if (hasErrors) {
    return {
      text: errorMessage,
      isRelevant: true,
    };
  }

  return {
    isRelevant: true,
    preprocessedContent,
  };
}

export async function handleMenuSend(): Promise<AIResponse> {
  return {
    text: await menuService.getFullMenu(),
    isRelevant: false,
    confirmationMessage:
      "El menú ha sido enviado. ¿Hay algo más en lo que pueda ayudarte?",
  };
}
