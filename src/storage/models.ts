export interface Board {
  id: string;
  name: string;
  description?: string;
  color: string;
  createdAt: number;
  updatedAt: number;
  order: number;
}

export interface Action {
  text: string;
  completed: boolean;
  completedAt?: number;
}

export interface SavedItemSource {
  platform: 'claude' | 'chatgpt' | 'gemini';
  url: string;
  conversationTitle?: string;
  savedAt: number;
}

export interface SavedItem {
  id: string;
  boardId: string;
  content: string;
  contentPlain: string;
  promptContext?: string;
  note?: string;
  action?: Action;
  source: SavedItemSource;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}
