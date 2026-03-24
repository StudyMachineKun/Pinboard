import type { PlatformAdapter } from '../platform-adapter';
import { createPinButton, flashPinButtonSuccess } from '../pin-button';
import { showSaveDialog, type SaveDialogData } from '../save-dialog';
import { getShadowRoot } from '../shadow-host';

// Last verified: 2026-03-24
const SELECTORS = {
  assistantMessage: '[data-is-streaming]',
  assistantMessageContainer: '.font-claude-message',
  userMessage: '.font-user-message',
  chatInput: '[contenteditable="true"].ProseMirror',
  conversationTitle: 'title',
  conversationContainer: '[data-testid="conversation-messages"], .flex.flex-col.gap-3',
} as const;

const PINNED_ATTR = 'data-pinboard-pinned';

const claudeAdapter: PlatformAdapter = {
  platform: 'claude',

  getAssistantMessages(): HTMLElement[] {
    // Claude wraps each assistant message in a container with .font-claude-message
    const els = document.querySelectorAll<HTMLElement>(SELECTORS.assistantMessageContainer);
    return Array.from(els);
  },

  extractContent(messageEl: HTMLElement): string {
    // Get the rendered markdown HTML as-is (preserves code blocks, formatting)
    const clone = messageEl.cloneNode(true) as HTMLElement;
    // Remove any injected Pinboard elements
    clone.querySelectorAll('[data-pinboard]').forEach((el) => el.remove());
    return clone.innerHTML;
  },

  extractPrecedingPrompt(messageEl: HTMLElement): string | null {
    // Walk up to the conversation turn container, then find the previous user message
    try {
      const turn = messageEl.closest('[data-testid="conversation-turn"]')
        || messageEl.closest('.group');
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
    anchor.setAttribute('data-pinboard', 'anchor');
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
          content: claudeAdapter.extractContent(el),
          contentPlain: el.textContent?.trim() || '',
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

      const formatted = `Here is a previous AI output I'd like to reference:\n\n---\n${text}\n---\n\nContinue from here / use this as context for the following request:\n`;

      input.focus();
      // ProseMirror needs us to use execCommand or input events
      document.execCommand('insertText', false, formatted);
    } catch {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(text);
    }
  },

  observeNewMessages(callback: (messageEl: HTMLElement) => void): MutationObserver {
    const container = document.querySelector(SELECTORS.conversationContainer) || document.body;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;

          // Check if the added node contains an assistant message
          const messages = node.matches(SELECTORS.assistantMessageContainer)
            ? [node]
            : Array.from(node.querySelectorAll<HTMLElement>(SELECTORS.assistantMessageContainer));

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
    const hasActions = messageEl.closest('[data-testid="conversation-turn"]')
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

// --- Initialization ---

function init() {
  console.log('[Pinboard] Content script loaded on claude.ai');

  // Inject pin buttons on existing messages
  const existing = claudeAdapter.getAssistantMessages();
  for (const msg of existing) {
    claudeAdapter.injectPinButton(msg);
  }

  // Watch for new messages
  claudeAdapter.observeNewMessages((msg) => {
    claudeAdapter.injectPinButton(msg);
  });

  // Handle SPA navigation — re-scan when URL changes
  let lastUrl = location.href;
  const urlObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      // Delay to let new page content load
      setTimeout(() => {
        const msgs = claudeAdapter.getAssistantMessages();
        for (const msg of msgs) {
          claudeAdapter.injectPinButton(msg);
        }
      }, 1000);
    }
  });
  urlObserver.observe(document.body, { childList: true, subtree: true });

  // Listen for re-inject messages from sidepanel
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'PASTE_INTO_INPUT') {
      claudeAdapter.pasteIntoInput(message.text);
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
