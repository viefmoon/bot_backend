export enum AgentType {
  GENERAL_CLAUDE = "GENERAL_CLAUDE",
  ORDER_CLAUDE = "ORDER_CLAUDE",
}

export interface AgentClaude {
  type: AgentType;
  model: string;
  systemMessage: any[] | (() => Promise<any[]>);
  tools: any[];
  maxTokens: number;
  temperature?: number;
}
