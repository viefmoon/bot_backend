export enum AgentType {
  GENERAL = "GENERAL",
  ORDER = "ORDER",
}

export interface Agent {
  type: AgentType;
  model: string;
  systemMessage: any[];
  tools: any[];
  maxTokens: number;
}
