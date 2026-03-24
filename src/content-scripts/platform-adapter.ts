import type { Platform } from '../shared/types';

export interface PlatformAdapter {
  platform: Platform;
  getAssistantMessages(): HTMLElement[];
  extractContent(messageEl: HTMLElement): string;
  extractPrecedingPrompt(messageEl: HTMLElement): string | null;
  getConversationTitle(): string | null;
  injectPinButton(messageEl: HTMLElement): void;
  pasteIntoInput(text: string): void;
  observeNewMessages(callback: (messageEl: HTMLElement) => void): MutationObserver;
}
