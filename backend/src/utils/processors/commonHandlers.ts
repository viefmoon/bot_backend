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
    conversationSummary,
    orderDetails
  }: { 
    targetAgent: AgentType; 
    conversationSummary: string;
    orderDetails?: { quantity: number; description: string; }[]
  },
  messages: any[],
  agentConfig: AgentConfig
): Promise<AIResponse[]> {
  let targetAgentMapping;
  
  switch (targetAgent) {
    case AgentType.ORDER_MAPPER_AGENT:
      if (!orderDetails) {
        throw new Error('orderDetails es requerido para ORDER_MAPPER_AGENT');
      }
      targetAgentMapping = agentConfig.orderMapperAgent;
      break;
    case AgentType.ROUTER_AGENT:
      targetAgentMapping = agentConfig.routerAgent;
      break;
    case AgentType.QUERY_AGENT:
      targetAgentMapping = agentConfig.queryAgent;
      break;
    default:
      throw new Error(`Tipo de agente no soportado: ${targetAgent}`);
  }

  return preProcessMessages(
    messages,
    targetAgentMapping,
    agentConfig,
    orderDetails
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
