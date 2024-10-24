import { FunctionCallingMode } from "@google/generative-ai";

export enum AgentType {
  GENERAL = "GENERAL",
  ORDER = "ORDER",
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

export interface AgentConfig {
  generalAgent: AgentMapping;
  orderAgent: AgentMapping;
}

export type AgentProvider = "CLAUDE" | "GEMINI";

export interface AgentMapping {
  type: AgentType;
  provider: AgentProvider;
}
