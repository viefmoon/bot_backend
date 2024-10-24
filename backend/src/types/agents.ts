export enum AgentType {
  GENERAL_CLAUDE = "GENERAL_CLAUDE",
  ORDER_CLAUDE = "ORDER_CLAUDE",
  GENERAL_GEMINI = "GENERAL_GEMINI",
  ORDER_GEMINI = "ORDER_GEMINI",
}

export interface AgentClaude {
  type: AgentType;
  model: string;
  systemMessage: any[] | (() => Promise<any[]>);
  tools: any[];
  maxTokens: number;
  temperature?: number;
}

export interface AgentGemini {
  type: AgentType;
  model: string;
  systemMessage: string | (() => Promise<string>);
  tools: any[];
}
