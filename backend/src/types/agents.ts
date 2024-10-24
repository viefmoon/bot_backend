import { FunctionCallingMode } from "@google/generative-ai";

export enum AgentTypeClaude {
  GENERAL_CLAUDE = "GENERAL_CLAUDE",
  ORDER_CLAUDE = "ORDER_CLAUDE",
}

export enum AgentTypeGemini {
  GENERAL_GEMINI = "GENERAL_GEMINI",
  ORDER_GEMINI = "ORDER_GEMINI",
}

export interface AgentClaude {
  type: AgentTypeClaude;
  model: string;
  systemMessage: any[] | (() => Promise<any[]>);
  tools: any[];
  maxTokens: number;
  temperature?: number;
}

export interface AgentGemini {
  type: AgentTypeGemini;
  model: string;
  systemMessage: string | (() => Promise<string>);
  tools: any[];
  allowedFunctionNames: string[];
  functionCallingMode: FunctionCallingMode;
}
