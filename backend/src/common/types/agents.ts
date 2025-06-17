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
  allowedFunctionNames: string[];
  functionCallingMode: FunctionCallingMode;
}
