export interface Source {
  text: string;
  page: number;
  source?: string;
}

export interface ChatHistoryTurn {
  role: "user" | "assistant";
  content: string;
  route?: "pdf" | "general";
}

export interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  isStreaming?: boolean;
  responseTime?: number;
  route?: "pdf" | "general";
}
