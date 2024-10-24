import { FunctionCallingMode } from "@google/generative-ai";

export enum AgentType {
  GENERAL_AGENT = "GENERAL_AGENT",
  ORDER_AGENT = "ORDER_AGENT",
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
}

export interface AgentConfig {
  generalAgent: AgentMapping;
  orderAgent: AgentMapping;
}

export type AgentProvider = "CLAUDE" | "GEMINI" | "OPENAI";
export interface AgentMapping {
  type: AgentType;
  provider: AgentProvider;
}
