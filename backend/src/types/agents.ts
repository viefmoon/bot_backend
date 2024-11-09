import { FunctionCallingMode } from "@google/generative-ai";

export enum AgentType {
  ORDER_MAPPER_AGENT = "ORDER_MAPPER_AGENT",
  ROUTER_AGENT = "ROUTER_AGENT",
  QUERY_AGENT = "QUERY_AGENT",
}

export interface AgentClaude {
  model: string;
  systemMessage: any[] | (() => Promise<any[]>);
  tools: any[];
  maxTokens: number;
  temperature?: number;
}

export interface AgentGemini {
  model: string;
  systemMessage: string | (() => Promise<string>);
  tools: any[];
  allowedFunctionNames: string[];
  functionCallingMode: FunctionCallingMode;
}

export interface AgentOpenAI {
  model: string;
  systemMessage: string | (() => Promise<{ role: string; content: string }>);
  tools: any[];
  temperature?: number;
  tool_choice?: { type: string; function: { name: string } };
}

export interface AgentConfig {
  orderMapperAgent: AgentMapping;
  routerAgent: AgentMapping;
  queryAgent: AgentMapping;
}

export type AgentProvider = "CLAUDE" | "GEMINI" | "OPENAI";
export interface AgentMapping {
  type: AgentType;
  provider: AgentProvider;
}
