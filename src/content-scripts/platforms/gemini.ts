import type { PlatformAdapter } from '../platform-adapter';
import { createPinButton, flashPinButtonSuccess } from '../pin-button';
import { showSaveDialog, type SaveDialogData } from '../save-dialog';
import { getShadowRoot, isContextValid } from '../shadow-host';
import { STORAGE_KEYS } from '../../shared/constants';

// Last verified: 2026-03-25
const SELECTORS = {
  assistantMessage: 'model-response',
  userMessage: 'message-content.user-message-text',
  chatInput: '.ql-editor[contenteditable="true"], rich-textarea .ql-editor',
  conversationTitle: 'title',
  conversationContainer: '.conversation-container, main',
  turnContainer: '.conversation-container',
  markdownContent: 'message-content div.markdown',
  contentElements: 'p, ol, ul, pre, h3, table, hr, code',
} as const;

const PINNED_ATTR = 'data-pinai-pinned';

const geminiAdapter: PlatformAdapter = {
  platform: 'gemini',

  getAssistantMessages(): HTMLElement[] {
    const els = document.querySelectorAll<HTMLElement>(SELECTORS.assistantMessage);
    return Array.from(els);
  },

  extractContent(messageEl: HTMLElement): string {
    const markdown = messageEl.querySelector(SELECTORS.markdownContent);
    if (!markdown) return '';
    const clone = markdown.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[data-pinai]').forEach((el) => el.remove());
    const parts: string[] = [];
    clone.querySelectorAll(SELECTORS.contentElements).forEach((el) => {
      parts.push(el.outerHTML);
    });
    return parts.join('\n');
  },

  extractPrecedingPrompt(messageEl: HTMLElement): string | null {
    try {
      // model-response sits inside a .conversation-container
      const container = messageEl.closest(SELECTORS.turnContainer);
      if (!container) return null;

      let prev = container.previousElementSibling;
      while (prev) {
        const userMsg = prev.querySelector(SELECTORS.userMessage);
        if (userMsg) return userMsg.textContent?.trim() || null;
        prev = prev.previousElementSibling;
      }
    } catch {
      // DOM structure changed
    }
    return null;
  },

  getConversationTitle(): string | null {
    const title = document.title;
    if (title && !title.startsWith('Gemini')) {
      return title.replace(/\s*[-–|]\s*Gemini\s*$/, '').trim() || null;
    }
    return null;
  },

  injectPinButton(messageEl: HTMLElement): void {
    if (messageEl.hasAttribute(PINNED_ATTR)) return;
    messageEl.setAttribute(PINNED_ATTR, 'true');

    const anchor = document.createElement('div');
    anchor.setAttribute('data-pinai', 'anchor');
    anchor.style.cssText = 'position:absolute;top:4px;right:4px;z-index:10;';

    const computed = window.getComputedStyle(messageEl);
    if (computed.position === 'static') {
      messageEl.style.position = 'relative';
    }
    messageEl.appendChild(anchor);

    const btnShadow = anchor.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; display: block; }
      .pinai-pin-button {
        display: inline-flex; align-items: center; justify-content: center;
        width: 28px; height: 28px; padding: 0; border: none; border-radius: 6px;
        background: transparent; color: #9ca3af; cursor: pointer;
        transition: color 0.15s, background 0.15s;
      }
      .pinai-pin-button:hover { color: #6C5CE7; background: rgba(108, 92, 231, 0.1); }
      .pinai-pin-button--saved { color: #10b981; }
    `;
    btnShadow.appendChild(style);

    const btn = createPinButton(messageEl, {
      onPin: (el) => {
        const data: SaveDialogData = {
          content: geminiAdapter.extractContent(el),
          contentPlain: Array.from(
            el.querySelectorAll(`${SELECTORS.markdownContent} ${SELECTORS.contentElements}`)
          ).map((e) => e.textContent?.trim() ?? '').filter(Boolean).join('\n'),
          promptContext: geminiAdapter.extractPrecedingPrompt(el) || undefined,
          platform: 'gemini',
          conversationTitle: geminiAdapter.getConversationTitle() || undefined,
        };
        const rect = anchor.getBoundingClientRect();
        showSaveDialog({
          data,
          anchorRect: rect,
          shadowRoot: getShadowRoot(),
          onSaved: () => flashPinButtonSuccess(btn),
        });
      },
    });
    btnShadow.appendChild(btn);
  },

  pasteIntoInput(text: string): void {
    try {
      const input = document.querySelector<HTMLElement>(SELECTORS.chatInput);
      if (!input) return;

      const normalized = text.replace(/\n{3,}/g, '\n\n').trim();
      const formatted = `Here is a previous AI output I'd like to reference:\n---\n${normalized}\n---\nContinue from here / use this as context for the following request:\n`;

      input.focus();
      document.execCommand('insertText', false, formatted);
    } catch {
      navigator.clipboard.writeText(text);
    }
  },

  observeNewMessages(callback: (messageEl: HTMLElement) => void): MutationObserver {
    const container = document.querySelector(SELECTORS.conversationContainer) || document.body;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;

          const messages = node.matches(SELECTORS.assistantMessage)
            ? [node]
            : Array.from(node.querySelectorAll<HTMLElement>(SELECTORS.assistantMessage));

          for (const msg of messages) {
            if (msg.hasAttribute(PINNED_ATTR)) continue;
            waitForStreamingComplete(msg, callback);
          }
        }
      }
    });

    observer.observe(container, { childList: true, subtree: true });
    return observer;
  },
};

function waitForStreamingComplete(messageEl: HTMLElement, callback: (el: HTMLElement) => void) {
  let timeout: ReturnType<typeof setTimeout>;

  const done = () => {
    innerObserver.disconnect();
    callback(messageEl);
  };

  const resetTimer = () => {
    clearTimeout(timeout);
    timeout = setTimeout(done, 1500);
  };

  const innerObserver = new MutationObserver(resetTimer);
  innerObserver.observe(messageEl, { childList: true, subtree: true, characterData: true });
  resetTimer();
}

async function quickSave() {
  try {
    const messages = geminiAdapter.getAssistantMessages();
    if (messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];
    const content = geminiAdapter.extractContent(lastMsg);
    const contentPlain = Array.from(
      lastMsg.querySelectorAll(`${SELECTORS.markdownContent} ${SELECTORS.contentElements}`)
    ).map(e => e.textContent?.trim() ?? '').filter(Boolean).join('\n');

    const boards = await chrome.runtime.sendMessage({ type: 'GET_BOARDS' }) as { id: string }[];
    if (!boards || boards.length === 0) {
      showQuickToast('Create a board first');
      return;
    }

    const stored = await chrome.storage.local.get(STORAGE_KEYS.lastUsedBoardId);
    const lastBoardId = String(stored[STORAGE_KEYS.lastUsedBoardId] ?? '');
    const boardId = boards.some(b => b.id === lastBoardId) ? lastBoardId : boards[0].id;

    await chrome.runtime.sendMessage({
      type: 'SAVE_ITEM',
      payload: {
        content,
        contentPlain,
        promptContext: geminiAdapter.extractPrecedingPrompt(lastMsg) || undefined,
        source: {
          platform: 'gemini',
          url: window.location.href,
          conversationTitle: geminiAdapter.getConversationTitle() || undefined,
          savedAt: Date.now(),
        },
        boardId,
        tags: [],
      },
    });

    showQuickToast('Saved!');
  } catch (err) {
    console.error('[PinAI] Quick save failed:', err);
  }
}

function showQuickToast(message: string) {
  const root = getShadowRoot();
  const toast = document.createElement('div');
  toast.className = 'pinai-toast';
  toast.textContent = message;
  root.appendChild(toast);
  setTimeout(() => toast.remove(), 1500);
}

function init() {
  if (!isContextValid()) return;
  console.log('[PinAI] Content script loaded on gemini.google.com');

  const existing = geminiAdapter.getAssistantMessages();
  for (const msg of existing) {
    geminiAdapter.injectPinButton(msg);
  }

  geminiAdapter.observeNewMessages((msg) => {
    if (!isContextValid()) return;
    geminiAdapter.injectPinButton(msg);
  });

  let lastUrl = location.href;
  const urlObserver = new MutationObserver(() => {
    if (!isContextValid()) { urlObserver.disconnect(); return; }
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(() => {
        if (!isContextValid()) return;
        const msgs = geminiAdapter.getAssistantMessages();
        for (const msg of msgs) {
          geminiAdapter.injectPinButton(msg);
        }
      }, 1000);
    }
  });
  urlObserver.observe(document.body, { childList: true, subtree: true });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'PASTE_INTO_INPUT') {
      geminiAdapter.pasteIntoInput(message.text);
    } else if (message.type === 'QUICK_SAVE') {
      quickSave();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export default geminiAdapter;
