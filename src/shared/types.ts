export type Platform = 'claude' | 'chatgpt' | 'gemini';

/** Messages sent between content scripts and background service worker. */
export type Message =
  | { type: 'SAVE_ITEM'; payload: SaveItemPayload }
  | { type: 'GET_BOARDS' }
  | { type: 'GET_ITEMS_FOR_BOARD'; boardId: string }
  | { type: 'CREATE_BOARD'; payload: CreateBoardPayload }
  | { type: 'PASTE_INTO_INPUT'; text: string }
  | { type: 'QUICK_SAVE' };

export interface SaveItemPayload {
  content: string;
  contentPlain: string;
  promptContext?: string;
  note?: string;
  action?: { text: string; completed: false };
  source: {
    platform: Platform;
    url: string;
    conversationTitle?: string;
    savedAt: number;
  };
  boardId: string;
  tags: string[];
}

export interface CreateBoardPayload {
  name: string;
  color: string;
  description?: string;
}
