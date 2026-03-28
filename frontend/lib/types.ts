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

export interface Inspector {
  indexedPdf: boolean;
  retrievalQuery: string;
  historyTurns: number;
  candidateChunks: number;
  usedChunks: number;
  decisionBasis: string[];
  routerDecision?: string;
  sourceDocuments: string[];
  sourcePages: number[];
}

export interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  isStreaming?: boolean;
  responseTime?: number;
  route?: "pdf" | "general";
  inspector?: Inspector;
}
