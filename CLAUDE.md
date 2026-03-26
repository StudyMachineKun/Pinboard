# CLAUDE.md — PinAI

## What is this project?

PinAI is a free, open-source Chrome extension that lets users save, organize, annotate, and re-use the best outputs from AI conversations across Claude, ChatGPT, and Gemini. It is a **knowledge library** — not a full-conversation exporter.

The core insight: AI conversations produce brilliant outputs that vanish into scroll history. Existing tools either export entire conversations (too much noise) or save snippets without structure (no organization). PinAI connects saved outputs to real projects, preserves the context that generated them, lets users annotate *why* they saved something, and — critically — lets them re-inject saved outputs back into new conversations as context.

## Tech stack

- **Extension framework**: Chrome Extension, Manifest V3
- **UI**: React 18 + Tailwind CSS (sidebar panel + popup)
- **Build**: Vite with @crxjs/vite-plugin (or manual Vite config for MV3 output)
- **Storage**: IndexedDB via Dexie.js (local-first, no backend)
- **Search**: FlexSearch for full-text search across saved items
- **Language**: TypeScript throughout
- **License**: MIT

## Architecture overview

```
pinboard/
├── src/
│   ├── manifest.json              # MV3 manifest
│   ├── background/
│   │   └── service-worker.ts      # Background service worker — handles messages, context menus
│   ├── content-scripts/
│   │   ├── platforms/
│   │   │   ├── claude.ts          # claude.ai DOM parser + pin button injector
│   │   │   ├── chatgpt.ts         # chatgpt.com DOM parser + pin button injector
│   │   │   └── gemini.ts          # gemini.google.com DOM parser + pin button injector
│   │   ├── platform-adapter.ts    # Common interface all platform scripts implement
│   │   ├── pin-button.ts          # Pin button component injected into each response
│   │   └── save-dialog.ts         # Quick save modal (project, note, action)
│   ├── sidepanel/
│   │   ├── index.html             # Side panel entry
│   │   ├── index.css              # Tailwind + .pinai-content styles for rendered HTML
│   │   ├── App.tsx                # Root component
│   │   ├── components/
│   │   │   ├── BoardList.tsx      # List of project boards
│   │   │   ├── BoardView.tsx      # Single board with its saved items
│   │   │   ├── SavedItemCard.tsx  # Individual saved item display
│   │   │   ├── SearchBar.tsx      # Full-text search across all items
│   │   │   ├── ActionsList.tsx    # Filtered view: items with pending actions
│   │   │   ├── NoteEditor.tsx     # Editable note on a saved item
│   │   │   └── ReInjectButton.tsx # Button to paste saved output into active chat
│   │   └── hooks/
│   │       ├── useBoards.ts       # CRUD operations for boards
│   │       ├── useSavedItems.ts   # CRUD operations for saved items
│   │       └── useSearch.ts       # FlexSearch integration
│   ├── storage/
│   │   ├── db.ts                  # Dexie.js database schema and instance
│   │   ├── models.ts             # TypeScript interfaces for all data models
│   │   └── migrations.ts         # DB version migrations
│   ├── utils/
│   │   ├── export.ts             # Markdown export with YAML frontmatter
│   │   ├── reinject.ts           # Logic to paste content into chat input fields
│   │   └── platform-detect.ts    # Detect which AI platform is active
│   └── shared/
│       ├── constants.ts          # Platform URLs, default settings
│       └── types.ts              # Shared TypeScript types
├── public/
│   └── icons/                    # Extension icons (16, 32, 48, 128)
├── tailwind.config.js
├── vite.config.ts
├── tsconfig.json
├── package.json
└── PLAN.md
```

## Data models

These are the core data structures stored in IndexedDB via Dexie.js:

```typescript
interface Board {
  id: string;                // UUID
  name: string;              // e.g. "SaaS MVP", "Learning Rust"
  description?: string;
  color: string;             // Hex color for board badge
  createdAt: number;         // Unix timestamp
  updatedAt: number;
  order: number;             // For manual sorting
}

interface SavedItem {
  id: string;                // UUID
  boardId: string;           // FK to Board
  content: string;           // The AI output (markdown preserved)
  contentPlain: string;      // Plain text version for search indexing
  promptContext?: string;    // The user prompt that generated this output
  note?: string;             // User's personal annotation — "why I saved this"
  action?: Action;           // Optional action item
  source: {
    platform: 'claude' | 'chatgpt' | 'gemini';
    url: string;             // Link back to the original conversation
    conversationTitle?: string;
    savedAt: number;         // Unix timestamp
  };
  tags: string[];            // User-defined tags
  createdAt: number;
  updatedAt: number;
}

interface Action {
  text: string;              // e.g. "Apply to PR #247 by Friday"
  completed: boolean;
  completedAt?: number;      // Unix timestamp when marked done
}
```

## Key design decisions

1. **Local-first, no backend.** All data lives in IndexedDB on the user's device. No accounts, no cloud, no sync in v1. This is a feature, not a limitation — it's a privacy advantage over Savelore.

2. **Project boards, not folders.** Boards are first-class objects with names, colors, and descriptions. They represent real work ("client-pitch", "learning-rust") not generic categories ("code", "writing"). A saved item belongs to exactly one board.

3. **Notes are editable after saving.** The note field is a living annotation. Users can update it any time as their understanding evolves.

4. **Actions are lightweight.** A single text + checkbox per saved item. No due dates, priorities, or assignees. This is a "next step" reminder, not a task manager. If users need more, they export to their real task tool.

5. **Re-injection is a first-class feature.** The sidebar has a "Re-inject" button on each saved item that programmatically pastes the saved output (with optional surrounding context formatting) into the active chat input field of whichever AI platform is currently open.

6. **Context is auto-captured.** When the user clicks pin, the extension automatically grabs: the AI output, the user prompt that preceded it (the message directly above in the DOM), the platform, the URL, the conversation title, and the timestamp. The user never has to manually enter this metadata.

7. **DOM selectors are abstracted.** Each platform has its own content script implementing a common `PlatformAdapter` interface. When platforms update their UI (which happens frequently), only the platform-specific file needs updating. The rest of the codebase is platform-agnostic.

8. **Save dialog must be fast.** The quick path is: click pin → select board → done (2 clicks). Note and action fields are visible but optional. Don't add friction to the save action.

## Platform adapter interface

Every platform content script must implement this:

```typescript
interface PlatformAdapter {
  platform: 'claude' | 'chatgpt' | 'gemini';
  
  // Returns all assistant message elements currently in the DOM
  getAssistantMessages(): HTMLElement[];
  
  // Extracts the text/markdown content from an assistant message element
  extractContent(messageEl: HTMLElement): string;
  
  // Extracts the user prompt that directly preceded this assistant message
  extractPrecedingPrompt(messageEl: HTMLElement): string | null;
  
  // Returns the conversation title from the page (sidebar/header)
  getConversationTitle(): string | null;
  
  // Injects the pin button into a single assistant message element
  injectPinButton(messageEl: HTMLElement): void;
  
  // Pastes text into the chat input field (for re-injection)
  pasteIntoInput(text: string): void;
  
  // Observes DOM for new assistant messages (streaming responses)
  observeNewMessages(callback: (messageEl: HTMLElement) => void): MutationObserver;
}
```

## Content script DOM selector strategy

Platform UIs change frequently. To manage this:

- Each platform file has a `SELECTORS` object at the top containing all CSS selectors used
- Selectors are the ONLY place platform-specific DOM knowledge lives
- When a platform updates, only the `SELECTORS` object needs changing
- Add comments with the date each selector was last verified
- Use data attributes and ARIA roles as selectors where possible (more stable than class names)

```typescript
// Example: claude.ts
const SELECTORS = {
  // Last verified: 2026-03-24
  assistantMessage: '.font-claude-response',
  userMessage: '.font-user-message',
  messageContainer: '.contents',
  chatInput: '[contenteditable="true"]',
  conversationTitle: 'title',
} as const;

// Example: chatgpt.ts
const SELECTORS = {
  // Last verified: 2026-03-24
  assistantMessage: '[data-message-author-role="assistant"]',
  userMessage: '[data-message-author-role="user"]',
  chatInput: '#prompt-textarea',
  conversationTitle: 'title',
  conversationContainer: '[role="presentation"] .flex.flex-col',
  turnContainer: '[data-testid^="conversation-turn-"]',
} as const;

// Example: gemini.ts
const SELECTORS = {
  // Last verified: 2026-03-25
  assistantMessage: 'model-response',              // Custom element, NOT message-content
  userMessage: 'message-content.user-message-text',
  chatInput: '.ql-editor[contenteditable="true"], rich-textarea .ql-editor',
  conversationTitle: 'title',
  conversationContainer: '.conversation-container, main',
  turnContainer: '.conversation-container',
  markdownContent: 'message-content div.markdown', // Actual text content lives here
  contentElements: 'p, ol, ul, pre, h3, table, hr, code',
} as const;
// Gemini note: exclude div.model-thoughts, div.response-container-header,
// div.actions-container-v2 — only extract from markdownContent.
```

## Coding conventions

- Use TypeScript strict mode
- Use functional React components with hooks only (no class components)
- Use Tailwind utility classes for styling — no CSS modules or styled-components
- Custom CSS for rendered HTML content uses `.pinai-content` class in `src/sidepanel/index.css`
- Name files in kebab-case for utilities, PascalCase for React components
- Use named exports (not default exports) for everything except React page components
- Keep content scripts lean — heavy logic belongs in the background service worker or shared utils
- Use `chrome.runtime.sendMessage` for communication between content scripts and background/sidepanel
- Error handling: wrap all DOM operations in try-catch (platform UIs can change without notice)
- All user-facing strings should be in English (i18n is a future concern, not v1)
- SPA navigation in content scripts must use three detection methods together: MutationObserver on body, Navigation API (`navigation.addEventListener('navigate')`), and `popstate` events — all funneled through a single handler that deduplicates via URL comparison
- After SPA navigation, clear all `data-pinai-pinned` attributes and poll for new messages (every 500ms, up to 10s) rather than using a single timeout
- `item.content` stores extracted HTML; `item.contentPlain` stores plain text for search. The expanded view in SavedItemCard renders HTML via `dangerouslySetInnerHTML`, the collapsed preview uses `contentPlain`

## What not to build (scope boundaries)

- No cloud sync (v1 is local-only)
- No team/sharing features
- No browser history or bookmarks integration
- No AI-powered features (auto-tagging, summarization) — keep it simple
- No Firefox support in v1 (Chrome + Chromium-based only)
- No mobile support
- No Notion/Obsidian direct sync (export to .md is sufficient)
- No full-conversation export (that's what AI Exporter does — we save individual responses)