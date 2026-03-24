import type { PlatformAdapter } from '../platform-adapter';
import { createPinButton, flashPinButtonSuccess } from '../pin-button';
import { showSaveDialog, type SaveDialogData } from '../save-dialog';
import { getShadowRoot } from '../shadow-host';

// Last verified: 2026-03-24
const SELECTORS = {
  assistantMessage: '[data-message-author-role="assistant"]',
  userMessage: '[data-message-author-role="user"]',
  chatInput: '#prompt-textarea',
  conversationTitle: 'title',
  conversationContainer: '[role="presentation"] .flex.flex-col',
  turnContainer: '[data-testid^="conversation-turn-"]',
} as const;

const PINNED_ATTR = 'data-pinboard-pinned';

const chatgptAdapter: PlatformAdapter = {
  platform: 'chatgpt',

  getAssistantMessages(): HTMLElement[] {
    const els = document.querySelectorAll<HTMLElement>(SELECTORS.assistantMessage);
    return Array.from(els);
  },

  extractContent(messageEl: HTMLElement): string {
    // ChatGPT renders markdown in a .markdown div inside the message
    const markdown = messageEl.querySelector('.markdown');
    const source = markdown || messageEl;
    const clone = source.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[data-pinboard]').forEach((el) => el.remove());
    return clone.innerHTML;
  },

  extractPrecedingPrompt(messageEl: HTMLElement): string | null {
    try {
      const turn = messageEl.closest(SELECTORS.turnContainer);
      if (!turn) return null;

      let prev = turn.previousElementSibling;
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
    if (title && title !== 'ChatGPT') {
      return title.replace(/\s*[-–|]\s*ChatGPT\s*$/, '').trim() || null;
    }
    return null;
  },

  injectPinButton(messageEl: HTMLElement): void {
    if (messageEl.hasAttribute(PINNED_ATTR)) return;
    messageEl.setAttribute(PINNED_ATTR, 'true');

    const anchor = document.createElement('div');
    anchor.setAttribute('data-pinboard', 'anchor');
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
      .pb-pin-button {
        display: inline-flex; align-items: center; justify-content: center;
        width: 28px; height: 28px; padding: 0; border: none; border-radius: 6px;
        background: transparent; color: #9ca3af; cursor: pointer;
        transition: color 0.15s, background 0.15s;
      }
      .pb-pin-button:hover { color: #6C5CE7; background: rgba(108, 92, 231, 0.1); }
      .pb-pin-button--saved { color: #10b981; }
    `;
    btnShadow.appendChild(style);

    const btn = createPinButton(messageEl, {
      onPin: (el) => {
        const data: SaveDialogData = {
          content: chatgptAdapter.extractContent(el),
          contentPlain: el.textContent?.trim() || '',
          promptContext: chatgptAdapter.extractPrecedingPrompt(el) || undefined,
          platform: 'chatgpt',
          conversationTitle: chatgptAdapter.getConversationTitle() || undefined,
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

      const formatted = `Here is a previous AI output I'd like to reference:\n\n---\n${text}\n---\n\nContinue from here / use this as context for the following request:\n`;

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
    // ChatGPT shows a copy button when done
    const hasCopy = messageEl.closest(SELECTORS.turnContainer)
      ?.querySelector('button[data-testid="copy-turn-action-button"]');
    if (hasCopy) { done(); return; }
    timeout = setTimeout(done, 1500);
  };

  const innerObserver = new MutationObserver(resetTimer);
  innerObserver.observe(messageEl, { childList: true, subtree: true, characterData: true });
  resetTimer();
}

function init() {
  console.log('[Pinboard] Content script loaded on chatgpt.com');

  const existing = chatgptAdapter.getAssistantMessages();
  for (const msg of existing) {
    chatgptAdapter.injectPinButton(msg);
  }

  chatgptAdapter.observeNewMessages((msg) => {
    chatgptAdapter.injectPinButton(msg);
  });

  // SPA navigation
  let lastUrl = location.href;
  const urlObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(() => {
        const msgs = chatgptAdapter.getAssistantMessages();
        for (const msg of msgs) {
          chatgptAdapter.injectPinButton(msg);
        }
      }, 1000);
    }
  });
  urlObserver.observe(document.body, { childList: true, subtree: true });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'PASTE_INTO_INPUT') {
      chatgptAdapter.pasteIntoInput(message.text);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export default chatgptAdapter;
