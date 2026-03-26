import type { PlatformAdapter } from '../platform-adapter';
import { createPinButton, flashPinButtonSuccess } from '../pin-button';
import { showSaveDialog, type SaveDialogData } from '../save-dialog';
import { getShadowRoot, isContextValid } from '../shadow-host';
import { STORAGE_KEYS } from '../../shared/constants';

// Last verified: 2026-03-24
const SELECTORS = {
  assistantMessage: '.font-claude-response',
  userMessage: '.font-user-message', 
  messageContainer: '.contents',
  chatInput: '[contenteditable="true"]',
  conversationTitle: 'title',
} as const;

const PINNED_ATTR = 'data-pinai-pinned';

const claudeAdapter: PlatformAdapter = {
  platform: 'claude',

  getAssistantMessages(): HTMLElement[] {
    const els = document.querySelectorAll<HTMLElement>(SELECTORS.assistantMessage);
    return Array.from(els);
  },

  extractContent(messageEl: HTMLElement): string {
    const contentParts: string[] = [];
    messageEl.querySelectorAll('p.font-claude-response-body, pre, ol, ul, h1, h2, h3, h4, table').forEach(el => {
      contentParts.push(el.outerHTML);
    });
    return contentParts.join('\n');
  },

  extractPrecedingPrompt(messageEl: HTMLElement): string | null {
    // Walk up to the conversation turn container, then find the previous user message
    try {
      const turn = messageEl.closest(SELECTORS.messageContainer);
      if (!turn) return null;

      let prev = turn.previousElementSibling;
      while (prev) {
        const userMsg = prev.querySelector(SELECTORS.userMessage);
        if (userMsg) return userMsg.textContent?.trim() || null;
        prev = prev.previousElementSibling;
      }
    } catch {
      // DOM structure changed — fail silently
    }
    return null;
  },

  getConversationTitle(): string | null {
    const title = document.title;
    // Claude title format: "conversation title - Claude"
    if (title && title !== 'Claude') {
      return title.replace(/\s*[-–]\s*Claude\s*$/, '').trim() || null;
    }
    return null;
  },

  injectPinButton(messageEl: HTMLElement): void {
    if (messageEl.hasAttribute(PINNED_ATTR)) return;
    messageEl.setAttribute(PINNED_ATTR, 'true');

    // Create a host element in the page DOM to anchor the button position
    const anchor = document.createElement('div');
    anchor.setAttribute('data-pinai', 'anchor');
    anchor.style.cssText = 'position:absolute;top:4px;right:4px;z-index:10;';

    // Make the message container position:relative if not already
    const computed = window.getComputedStyle(messageEl);
    if (computed.position === 'static') {
      messageEl.style.position = 'relative';
    }
    messageEl.appendChild(anchor);

    // Create button inside Shadow DOM but visually positioned via a portal-like approach:
    // Actually, for the button to appear inside the message, we use a simpler approach —
    // create a shadow root directly on the anchor element.
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
          content: claudeAdapter.extractContent(el),
          contentPlain: Array.from(el.querySelectorAll('p.font-claude-response-body, pre, ol, ul, h1, h2, h3, h4, table'))
            .map(e => e.textContent?.trim() ?? '')
            .filter(t => t.length > 0)
            .join('\n'),
          promptContext: claudeAdapter.extractPrecedingPrompt(el) || undefined,
          platform: 'claude',
          conversationTitle: claudeAdapter.getConversationTitle() || undefined,
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
      // ProseMirror needs us to use execCommand or input events
      document.execCommand('insertText', false, formatted);
    } catch {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(text);
    }
  },

  observeNewMessages(callback: (messageEl: HTMLElement) => void): MutationObserver {
    const container = document.body;

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

/**
 * Wait until streaming is complete before calling callback.
 * Uses a debounce: if no mutations for 1.5s, consider it done.
 * Also checks for platform-specific "done" indicators (copy button, feedback buttons).
 */
function waitForStreamingComplete(messageEl: HTMLElement, callback: (el: HTMLElement) => void) {
  let timeout: ReturnType<typeof setTimeout>;

  const done = () => {
    innerObserver.disconnect();
    callback(messageEl);
  };

  const resetTimer = () => {
    clearTimeout(timeout);

    // Check for "response complete" indicators: copy button or feedback thumbs
    const hasActions = messageEl.closest(SELECTORS.messageContainer)
      ?.querySelector('button[aria-label="Copy"]');
    if (hasActions) {
      done();
      return;
    }

    timeout = setTimeout(done, 1500);
  };

  const innerObserver = new MutationObserver(resetTimer);
  innerObserver.observe(messageEl, { childList: true, subtree: true, characterData: true });

  // Start the timer immediately (message might already be complete)
  resetTimer();
}

/** Quick save: save the last assistant message to the last-used board, no dialog. */
async function quickSave() {
  try {
    const messages = claudeAdapter.getAssistantMessages();
    if (messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];
    const content = claudeAdapter.extractContent(lastMsg);
    const contentPlain = Array.from(lastMsg.querySelectorAll('p.font-claude-response-body, pre, ol, ul, h1, h2, h3, h4, table'))
      .map(e => e.textContent?.trim() ?? '')
      .filter(t => t.length > 0)
      .join('\n');

    // Get last-used board, or the first board as fallback
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
        promptContext: claudeAdapter.extractPrecedingPrompt(lastMsg) || undefined,
        source: {
          platform: 'claude',
          url: window.location.href,
          conversationTitle: claudeAdapter.getConversationTitle() || undefined,
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

/** Save selected text via context menu — opens the save dialog. */
function saveSelection(text: string) {
  const data: SaveDialogData = {
    content: `<p>${text}</p>`,
    contentPlain: text,
    platform: 'claude',
    conversationTitle: claudeAdapter.getConversationTitle() || undefined,
  };
  const rect = new DOMRect(window.innerWidth / 2 - 160, 100, 320, 0);
  showSaveDialog({
    data,
    anchorRect: rect,
    shadowRoot: getShadowRoot(),
    onSaved: () => {},
  });
}

// --- Initialization ---

function init() {
  if (!isContextValid()) return;
  console.log('[PinAI] Content script loaded on claude.ai');

  // Inject pin buttons on existing messages
  const existing = claudeAdapter.getAssistantMessages();
  for (const msg of existing) {
    claudeAdapter.injectPinButton(msg);
  }

  // Watch for new messages
  claudeAdapter.observeNewMessages((msg) => {
    if (!isContextValid()) return;
    claudeAdapter.injectPinButton(msg);
  });

  // Handle SPA navigation — re-scan when URL changes
  let lastUrl = location.href;
  const urlObserver = new MutationObserver(() => {
    if (!isContextValid()) { urlObserver.disconnect(); return; }
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(() => {
        if (!isContextValid()) return;
        const msgs = claudeAdapter.getAssistantMessages();
        for (const msg of msgs) {
          claudeAdapter.injectPinButton(msg);
        }
      }, 1000);
    }
  });
  urlObserver.observe(document.body, { childList: true, subtree: true });

  // Listen for messages from sidepanel and background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'PASTE_INTO_INPUT') {
      claudeAdapter.pasteIntoInput(message.text);
    } else if (message.type === 'QUICK_SAVE') {
      quickSave();
    } else if (message.type === 'SAVE_SELECTION') {
      saveSelection(message.text);
    }
  });
}

// Run init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export default claudeAdapter;
