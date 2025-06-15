import { FunctionCallingMode } from "@google/generative-ai";

export enum AgentType {
  ORDER_MAPPER_AGENT = "ORDER_MAPPER_AGENT",
  ROUTER_AGENT = "ROUTER_AGENT",
  QUERY_AGENT = "QUERY_AGENT",
}


export interface AgentGemini {
  model: string;
  systemMessage: string | (() => Promise<string>);
  tools: any[];
  toolConfig?: {
    functionCallingConfig: {
      mode: FunctionCallingMode;
      allowedFunctionNames: string[];
    };
  };
  allowedFunctionNames?: string[];
  functionCallingMode?: FunctionCallingMode;
}


export interface AgentConfig {
  orderMapperAgent: AgentMapping;
  routerAgent: AgentMapping;
  queryAgent: AgentMapping;
}

export type AgentProvider = "GEMINI";
export interface AgentMapping {
  type: AgentType;
  provider: AgentProvider;
}
