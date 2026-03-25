# PLAN.md — Pinboard Implementation Plan

This plan covers the full build of Pinboard from empty repo to shippable Chrome extension. It is broken into 4 phases, each producing a working (if incomplete) extension that can be loaded unpacked in Chrome for testing.

---

## Phase 1: Project scaffolding + storage layer

**Goal**: A working Chrome extension skeleton with Manifest V3, the database layer, and all data models — nothing visible yet, but the foundation is solid.

### 1.1 Initialize the project

- `npm init` with name `pinboard-extension`
- Install core dependencies:
  - `vite`, `@crxjs/vite-plugin` (or manual Vite MV3 config)
  - `react`, `react-dom`, `@types/react`, `@types/react-dom`
  - `typescript`, `tailwindcss`, `postcss`, `autoprefixer`
  - `dexie` (IndexedDB wrapper)
  - `flexsearch` (full-text search)
  - `uuid` (for generating IDs)
- Configure `tsconfig.json` with strict mode
- Configure `tailwind.config.js`
- Configure `vite.config.ts` for Chrome extension output (background, content scripts, sidepanel)

### 1.2 Create manifest.json

```json
{
  "manifest_version": 3,
  "name": "Pinboard — AI Knowledge Library",
  "version": "0.1.0",
  "description": "Save, organize, and re-use the best outputs from your AI conversations.",
  "permissions": [
    "sidePanel",
    "storage",
    "activeTab",
    "contextMenus"
  ],
  "host_permissions": [
    "https://claude.ai/*",
    "https://chatgpt.com/*",
    "https://gemini.google.com/*"
  ],
  "background": {
    "service_worker": "src/background/service-worker.ts",
    "type": "module"
  },
  "side_panel": {
    "default_path": "src/sidepanel/index.html"
  },
  "content_scripts": [
    {
      "matches": ["https://claude.ai/*"],
      "js": ["src/content-scripts/platforms/claude.ts"],
      "css": ["src/content-scripts/pinboard-inject.css"]
    },
    {
      "matches": ["https://chatgpt.com/*"],
      "js": ["src/content-scripts/platforms/chatgpt.ts"],
      "css": ["src/content-scripts/pinboard-inject.css"]
    },
    {
      "matches": ["https://gemini.google.com/*"],
      "js": ["src/content-scripts/platforms/gemini.ts"],
      "css": ["src/content-scripts/pinboard-inject.css"]
    }
  ],
  "icons": {
    "16": "public/icons/icon-16.png",
    "32": "public/icons/icon-32.png",
    "48": "public/icons/icon-48.png",
    "128": "public/icons/icon-128.png"
  },
  "action": {
    "default_title": "Open Pinboard"
  }
}
```

### 1.3 Build the storage layer

**File: `src/storage/models.ts`**

Define all TypeScript interfaces (Board, SavedItem, Action) exactly as specified in CLAUDE.md.

**File: `src/storage/db.ts`**

```typescript
import Dexie, { Table } from 'dexie';
import { Board, SavedItem } from './models';

class PinboardDB extends Dexie {
  boards!: Table<Board>;
  savedItems!: Table<SavedItem>;

  constructor() {
    super('pinboard');
    this.version(1).stores({
      boards: 'id, name, order, createdAt',
      savedItems: 'id, boardId, *tags, source.platform, createdAt, updatedAt',
    });
  }
}

export const db = new PinboardDB();
```

**File: `src/storage/migrations.ts`**

Set up a migration framework so we can evolve the schema in future versions without losing user data. For v1, this is just the initial schema.

### 1.4 Build the search index

**File: `src/sidepanel/hooks/useSearch.ts`**

- Initialize a FlexSearch `Document` index on app load
- Index fields: `contentPlain`, `note`, `action.text`, `tags`
- Populate the index from all SavedItems in IndexedDB on startup
- Update the index when items are added, edited, or deleted
- Expose a `search(query: string)` function that returns matching SavedItem IDs

### 1.5 Background service worker

**File: `src/background/service-worker.ts`**

- Register the side panel behavior: clicking the extension icon opens the side panel
- Set up `chrome.runtime.onMessage` listener to handle messages from content scripts:
  - `SAVE_ITEM`: receives extracted data from content script, writes to IndexedDB
  - `GET_BOARDS`: returns all boards (for the save dialog)
  - `GET_ITEMS_FOR_BOARD`: returns items for a specific board
- Set up a context menu item: right-click on selected text → "Save to Pinboard" (stretch goal for later)

---

## Phase 2: Content scripts + pin button injection

**Goal**: When users visit Claude, ChatGPT, or Gemini, they see a small pin icon on each AI response. Clicking it opens a save dialog.

### 2.1 Platform adapter interface

**File: `src/content-scripts/platform-adapter.ts`**

Define the `PlatformAdapter` interface as specified in CLAUDE.md. This is the contract every platform content script must implement.

### 2.2 Claude content script

**File: `src/content-scripts/platforms/claude.ts`**

This is the first and most important platform to support.

**DOM parsing strategy for claude.ai:**

- Assistant messages: look for message containers with the assistant role. Try selectors in order of stability: `[data-testid]` attributes first, then ARIA roles, then class-based selectors as fallback.
- User messages: the message immediately preceding an assistant message in the conversation thread.
- Chat input: the `contenteditable` ProseMirror editor.
- Conversation title: from the page `<title>` or sidebar active conversation element.

**Implementation steps:**

1. Define the `SELECTORS` object at the top of the file
2. Implement `getAssistantMessages()` — query all assistant message elements
3. Implement `extractContent(el)` — extract innerHTML, convert to markdown (preserve code blocks, headings, lists, bold/italic)
4. Implement `extractPrecedingPrompt(el)` — navigate DOM to find the user message directly before this assistant message
5. Implement `getConversationTitle()` — read from the page title or sidebar
6. Implement `injectPinButton(el)` — create and append the pin button element to each assistant message
7. Implement `pasteIntoInput(text)` — find the chat input, programmatically set its content, and dispatch input events so the platform's framework recognizes the change
8. Implement `observeNewMessages(callback)` — use MutationObserver on the conversation container to detect when new assistant messages are added (important for streaming responses — wait until the response is complete before showing the pin button)

**Streaming detection:**

AI responses stream in token by token. The pin button should only appear after the response is complete. Strategy:
- Observe the message element for mutations
- When mutations stop for 1.5 seconds, consider the response complete
- Then inject the pin button
- Also check for platform-specific "response complete" indicators (e.g., the copy button appearing, the feedback buttons appearing)

### 2.3 ChatGPT content script

**File: `src/content-scripts/platforms/chatgpt.ts`**

Same implementation as Claude but with ChatGPT-specific selectors.

**DOM parsing strategy for chatgpt.com:**

- Assistant messages: typically `[data-message-author-role="assistant"]` or similar data attributes
- The overall structure is a list of conversation turns, each containing a user or assistant message
- Chat input: `<textarea>` element or contenteditable div (ChatGPT has changed this multiple times)
- Conversation title: from the sidebar active conversation or page title

### 2.4 Gemini content script

**File: `src/content-scripts/platforms/gemini.ts`**

Same implementation pattern for gemini.google.com.

**DOM parsing strategy for gemini.google.com:**

- Assistant messages: look for model response containers
- Gemini uses a different DOM structure — responses may be inside shadow DOM or web components
- Chat input: the input area at the bottom
- Conversation title: from the page or sidebar

### 2.5 Pin button component

**File: `src/content-scripts/pin-button.ts`**

The pin button is a small icon injected into each assistant message. It must:

- Be visually unobtrusive — sits in the top-right corner of each assistant message, or alongside existing action buttons (copy, thumbs up/down)
- Match the visual style of the host platform (don't look out of place)
- Show a subtle hover tooltip: "Save to Pinboard"
- On click: open the save dialog as an overlay/modal
- Use a simple pushpin or bookmark SVG icon
- Be styled with inline styles or a minimal injected stylesheet (`pinboard-inject.css`) to avoid conflicts with the host platform's CSS

**File: `src/content-scripts/pinboard-inject.css`**

Minimal CSS for the pin button and save dialog. Use a unique prefix for all class names (e.g., `.pb-pin-button`, `.pb-save-dialog`) to avoid CSS collisions with the host platform. Use CSS custom properties scoped under a `.pinboard-root` container. Keep this under 100 lines.

### 2.6 Save dialog

**File: `src/content-scripts/save-dialog.ts`**

When the user clicks the pin button, a compact modal appears overlaying the page. This is NOT a React component — it's plain DOM manipulation injected by the content script (content scripts should stay lightweight).

**Save dialog contains:**

1. **Board selector**: dropdown listing all existing boards, plus an inline "New board" option. Fetch boards from IndexedDB via message to background service worker.
2. **Note field** (optional): single-line text input, placeholder "Why are you saving this?"
3. **Action field** (optional): single-line text input, placeholder "What's your next step?" — preceded by a checkbox icon to visually signal this is an action item
4. **Save button**: primary action, closes the dialog on success
5. **Cancel button**: closes without saving

**Behavior:**

- Dialog appears near the pin button that was clicked (not centered on screen — context matters)
- Board selector defaults to the most recently used board (store last-used board ID in `chrome.storage.local`)
- On save: send a message to the background service worker with all extracted data + user inputs
- Show a brief "Saved!" confirmation toast after successful save (1.5s, then auto-dismiss)
- Keyboard support: Escape to close, Enter to save, Tab between fields

**Data collected on save:**

```typescript
{
  content: string,           // Extracted from assistant message
  contentPlain: string,      // Strip HTML/markdown for search indexing
  promptContext: string,     // Extracted from preceding user message
  note: string,             // From note input field
  action: { text: string, completed: false } | undefined,
  source: {
    platform: 'claude' | 'chatgpt' | 'gemini',
    url: window.location.href,
    conversationTitle: string,
    savedAt: Date.now()
  },
  boardId: string,          // Selected board ID
  tags: []                  // Empty for now — tags are added later in sidebar
}
```

---

## Phase 3: Side panel UI

**Goal**: A fully functional sidebar with board management, saved item browsing, search, notes editing, action tracking, and the re-inject feature.

### 3.1 Side panel shell

**File: `src/sidepanel/index.html`** — minimal HTML entry point loading the React app

**File: `src/sidepanel/App.tsx`** — root component with navigation state

The side panel has three views, switchable via tabs or navigation:

1. **Boards** (default): list of all project boards
2. **Search**: full-text search across all saved items
3. **Actions**: filtered view showing only items with uncompleted action items (the "AI output inbox")

### 3.2 Board list view

**File: `src/sidepanel/components/BoardList.tsx`**

- Display all boards as cards with: name, color badge, item count, last updated date
- "New board" button at the top — inline creation (name + color picker, no separate page)
- Click a board to navigate to BoardView
- Long-press or right-click on a board: rename, change color, delete (with confirmation), export as markdown
- Boards are ordered by `order` field (allow drag-to-reorder in a future version — for now, sort by most recently updated)

### 3.3 Board view (single board)

**File: `src/sidepanel/components/BoardView.tsx`**

- Header: board name + color, item count, description (editable)
- Back button to return to board list
- List of saved items in this board, most recent first
- Each item rendered as a `SavedItemCard`
- "Export board" button: exports all items in the board as a zip of markdown files

### 3.4 Saved item card

**File: `src/sidepanel/components/SavedItemCard.tsx`**

This is the core UI component. Each card shows:

- **Content preview**: first 3-4 lines of the saved AI output, truncated. Click to expand full content.
- **Platform badge**: small icon/label showing Claude, ChatGPT, or Gemini
- **Note** (if present): displayed below the content preview in a distinct style (e.g., italic, slightly muted). Click to edit inline.
- **Action** (if present): displayed with a checkbox. Checkbox toggles the `completed` state. Text is editable. Completed actions get a strikethrough style.
- **Metadata footer**: timestamp, "View original" link (opens the original conversation URL), tags
- **Actions menu** (three-dot or on-hover): Edit note, Edit action, Add/edit tags, Move to another board, Re-inject into chat, Export as markdown, Delete

### 3.5 Note editor

**File: `src/sidepanel/components/NoteEditor.tsx`**

- Inline editable text field
- Click to enter edit mode, blur or Enter to save
- Escape to cancel edits
- Auto-saves to IndexedDB on blur
- Placeholder when empty: "Add a note — why did you save this?"

### 3.6 Actions list view

**File: `src/sidepanel/components/ActionsList.tsx`**

A filtered view across ALL boards showing only saved items that have uncompleted action items. This is the "inbox" view.

- Each item shows: the action text with checkbox, the board it belongs to, a preview of the saved content
- Completing an action (checking the box) removes it from this view (with a brief undo option)
- Sort by: most recent first (default), or grouped by board

### 3.7 Search

**File: `src/sidepanel/components/SearchBar.tsx`**

- Text input at the top of the side panel (always visible regardless of current view)
- Searches across: content, notes, action text, tags
- Results appear as SavedItemCards in a flat list
- Highlight matching text in results
- Search is instant (FlexSearch is in-memory)
- Empty state: "Search across all your saved AI outputs"

### 3.8 Re-inject button

**File: `src/sidepanel/components/ReInjectButton.tsx`**

On each SavedItemCard, a "Re-inject" button that:

1. Gets the current active tab
2. Verifies it's a supported AI platform (claude.ai, chatgpt.com, gemini.google.com)
3. Sends a message to the content script on that tab with the saved content
4. The content script's `pasteIntoInput()` method formats and pastes it into the chat input

**Re-injection format:**

When pasting into the chat input, format the content as a clear context block:

```
Here is a previous AI output I'd like to reference:

---
[The saved AI output content]
---

[Continue from here / use this as context for the following request:]
```

The user can then type their new prompt below this injected block. The formatting makes it clear to the AI that this is previous context, not a new instruction.

**Edge cases:**
- If the active tab is not a supported platform: show a tooltip "Open Claude, ChatGPT, or Gemini to re-inject"
- If the content is very long (>4000 chars): warn the user that injecting long context may affect response quality, but allow it
- Copy to clipboard as fallback if direct injection fails (DOM structures change)

### 3.9 Export functionality

**File: `src/utils/export.ts`**

**Single item export** — generates a markdown file:

```markdown
---
title: "Database schema design"
board: "SaaS MVP"
platform: claude
saved_at: 2026-03-23T14:30:00Z
source_url: https://claude.ai/chat/abc123
conversation_title: "MVP Architecture Discussion"
tags: [database, schema, postgresql]
note: "Great normalized schema — use this as starting point for the migration"
action: "Apply to migration script by Friday"
action_completed: false
---

## Prompt

Design a normalized PostgreSQL schema for a multi-tenant SaaS app with...

## Response

Here's a normalized schema that handles multi-tenancy at the row level...

[full content here]
```

**Board export** — generates a zip file containing:
- One `.md` file per saved item (filename: `{timestamp}-{sanitized-title}.md`)
- A `_board.md` index file listing all items with links

---

## Phase 4: Polish + hardening

**Goal**: Production-ready quality — handle edge cases, add keyboard shortcuts, improve UX details.

### 4.1 Keyboard shortcuts

- `Ctrl/Cmd + Shift + S`: Quick save — saves the most recent assistant message to the last-used board (no dialog, instant save with toast confirmation)
- `Ctrl/Cmd + Shift + P`: Toggle side panel open/close
- `Escape`: Close save dialog
- `Tab` / `Shift+Tab`: Navigate within save dialog

Register these in `manifest.json` under the `commands` key.

### 4.2 Empty states and onboarding

- First install: side panel shows a brief onboarding card explaining the 3 key features (project boards, notes, re-inject). Dismissible, shows only once.
- Empty board list: "Create your first project board to start saving AI outputs"
- Empty board: "Pin an AI response to add it to this board"
- Empty search: "Search across all your saved AI outputs"
- Empty actions: "No pending actions — you're all caught up!"

### 4.3 Error handling and resilience

- All DOM operations in content scripts wrapped in try-catch
- If a platform selector fails (UI update broke it), log the error and show a non-intrusive banner: "Pinboard couldn't detect AI messages on this page. Please check for an extension update."
- If IndexedDB write fails, retry once then show error toast
- If FlexSearch index gets out of sync with DB, rebuild on next side panel open
- Content script should gracefully handle SPA navigation (claude.ai, chatgpt.com are SPAs — the page doesn't reload when switching conversations). Use the MutationObserver to re-scan for messages after URL changes.

### 4.4 SPA navigation handling

All three platforms are single-page apps. The content script must:

1. Watch for URL changes (use `navigation` API or poll `location.href`)
2. On URL change: clear previously injected pin buttons, re-scan for assistant messages in the new conversation, re-inject pin buttons
3. Re-setup the MutationObserver for the new conversation container

### 4.5 Performance

- Content scripts should be lazy — only scan for messages when the page is idle, not during streaming
- Side panel React app: use `React.memo` on SavedItemCard to avoid re-renders when scrolling
- FlexSearch index: rebuild only on startup or when items change, not on every panel open
- IndexedDB reads: batch reads where possible, use Dexie's `.toArray()` with proper indexing

### 4.6 Extension icon + branding

- Create a simple, recognizable icon: a pushpin on a small board/card shape
- Use the purple (#6C5CE7) from the product definition as the brand color
- Icon variants: 16x16, 32x32, 48x48, 128x128 (PNGs)
- Consider using a badge on the extension icon showing the count of unsaved pending actions

### 4.7 Context menu integration

Add a right-click context menu option:
- When text is selected on a supported platform: "Save selection to Pinboard"
- Opens the save dialog with the selected text as the content
- This is an alternative to the pin button for when users want to save a specific portion of a response rather than the entire message

### 4.8 Testing strategy

- **Manual testing matrix**: test all features on Claude, ChatGPT, and Gemini in Chrome stable
- **Key test scenarios**:
  1. Save an output → verify it appears in the correct board
  2. Add a note → close and reopen sidebar → verify note persists
  3. Add an action → mark complete → verify it disappears from actions view
  4. Re-inject into a new conversation → verify the text appears in the input
  5. Export a board → verify markdown files have correct frontmatter
  6. Search for a saved item by note text → verify it's found
  7. Navigate between conversations (SPA) → verify pin buttons re-appear
  8. Save during a streaming response → verify it waits for completion
- **Selector regression**: after any platform UI update, run through the save flow on that platform to verify selectors still work

---

## Implementation order (recommended)

Build in this order to always have something testable:

1. **Phase 1**: Scaffold + storage (can verify DB works via console)
2. **Phase 2.2**: Claude content script only (get one platform working end-to-end first)
3. **Phase 2.5 + 2.6**: Pin button + save dialog (now you can save from Claude)
4. **Phase 3.1-3.4**: Side panel with board list + board view + item cards (now you can see what you saved)
5. **Phase 3.5**: Note editor (now notes are editable in sidebar)
6. **Phase 3.6**: Actions list view
7. **Phase 3.7**: Search
8. **Phase 3.8**: Re-inject button (the killer feature)
9. **Phase 2.3**: ChatGPT content script (second platform)
10. **Phase 2.4**: Gemini content script (third platform)
11. **Phase 3.9**: Export
12. **Phase 4**: Polish everything

Each step produces a testable increment. Resist the urge to build all three platforms in parallel — get Claude working perfectly first, then replicate the pattern.

---

## Files to create (complete list)

```
src/manifest.json
src/background/service-worker.ts
src/content-scripts/platform-adapter.ts
src/content-scripts/platforms/claude.ts
src/content-scripts/platforms/chatgpt.ts
src/content-scripts/platforms/gemini.ts
src/content-scripts/pin-button.ts
src/content-scripts/save-dialog.ts
src/content-scripts/pinboard-inject.css
src/sidepanel/index.html
src/sidepanel/main.tsx
src/sidepanel/App.tsx
src/sidepanel/components/BoardList.tsx
src/sidepanel/components/BoardView.tsx
src/sidepanel/components/SavedItemCard.tsx
src/sidepanel/components/SearchBar.tsx
src/sidepanel/components/ActionsList.tsx
src/sidepanel/components/NoteEditor.tsx
src/sidepanel/components/ReInjectButton.tsx
src/sidepanel/hooks/useBoards.ts
src/sidepanel/hooks/useSavedItems.ts
src/sidepanel/hooks/useSearch.ts
src/storage/db.ts
src/storage/models.ts
src/storage/migrations.ts
src/utils/export.ts
src/utils/reinject.ts
src/utils/platform-detect.ts
src/shared/constants.ts
src/shared/types.ts
public/icons/icon-16.png
public/icons/icon-32.png
public/icons/icon-48.png
public/icons/icon-128.png
tailwind.config.js
vite.config.ts
tsconfig.json
package.json
README.md
LICENSE
```

---

## Checklist

### Phase 1: Project scaffolding + storage layer
- [x] 1.1 Initialize the project (npm, dependencies, tsconfig, tailwind, vite config)
- [x] 1.2 Create manifest.json
- [x] 1.3 Build the storage layer (models.ts, db.ts, migrations.ts)
- [x] 1.4 Build the search index (useSearch.ts hook with FlexSearch)
- [x] 1.5 Background service worker (message handling, side panel open)

### Phase 2: Content scripts + pin button injection
- [x] 2.1 Platform adapter interface
- [x] 2.2 Claude content script (first platform, end-to-end)
- [x] 2.3 ChatGPT content script
- [x] 2.4 Gemini content script
- [x] 2.5 Pin button component + pinboard-inject.css (Shadow DOM isolated)
- [x] 2.6 Save dialog (plain DOM, board selector, note/action fields)

### Phase 3: Side panel UI
- [x] 3.1 Side panel shell (index.html, main.tsx, App.tsx with tab navigation)
- [x] 3.2 Board list view (BoardList.tsx)
- [x] 3.3 Board view — single board (BoardView.tsx)
- [x] 3.4 Saved item card (SavedItemCard.tsx)
- [x] 3.5 Note editor (NoteEditor.tsx)
- [x] 3.6 Actions list view (ActionsList.tsx)
- [x] 3.7 Search (SearchBar.tsx)
- [x] 3.8 Re-inject button (ReInjectButton.tsx)
- [x] 3.9 Export functionality (export.ts)

### Phase 4: Polish + hardening
- [ ] 4.1 Keyboard shortcuts
- [ ] 4.2 Empty states and onboarding
- [x] 4.3 Error handling and resilience (DATA_CHANGED listener for sidepanel reactivity)
- [x] 4.4 SPA navigation handling (robust: polling + Navigation API + popstate + MutationObserver)
- [ ] 4.5 Performance optimizations
- [ ] 4.6 Extension icon + branding (placeholder icons created)
- [ ] 4.7 Context menu integration
- [ ] 4.8 Testing (manual testing matrix)

---

## Execution log

### Phase 1 — 2026-03-24

**Decisions:**
- Used `@crxjs/vite-plugin` v2.4.0 as primary build tool (confirmed actively maintained).
- Used Tailwind v4 with `@tailwindcss/vite` plugin — no `tailwind.config.js` or `postcss.config.js` needed. Tailwind v4 uses `@import "tailwindcss"` in CSS instead of `@tailwind` directives.
- Used `npm` as package manager (not `uv` — this is a Node.js project).
- Pin button and save dialog will use Shadow DOM for CSS isolation (decided during planning review).

**Issues encountered:**
1. **FlexSearch ships its own `.d.ts` now (v0.8.212).** Initially created a custom `flexsearch.d.ts` type stub, but it conflicted with the bundled types. Deleted the stub and used the official types. The `Document` class requires data to conform to `DocumentData` (recursive `Record<string, DocumentValue>`), so `SavedItem` needs to be mapped to a flat `DocumentData` object before indexing — cannot pass the interface directly.
2. **Chrome API types not found by tsc.** Needed `npm install -D @types/chrome` and `"types": ["chrome"]` in `tsconfig.json`. The `@crxjs/vite-plugin` handles Chrome APIs at build time but tsc needs the type declarations separately.
3. **CSS import type error.** TypeScript couldn't resolve `import './index.css'`. Added `src/types/css.d.ts` with a module declaration for `*.css`.
4. **React 19 installed (latest).** `npm install react react-dom` pulled React 19.2.4 instead of React 18. This is fine — React 19 is stable and `@crxjs/vite-plugin` v2.4.0 supports it. The CLAUDE.md spec says "React 18" but using the latest is correct per project guidelines.
5. **Rollup vulnerability (high severity).** `npm audit` flagged rollup <2.80.0 with an arbitrary file write via path traversal. This is a transitive dependency of `@crxjs/vite-plugin` and only runs at build time on trusted input — not a runtime risk. The fix would downgrade crxjs to v1, which is a breaking change. Accepted as-is.

### Phase 2 — 2026-03-24

**Architecture:**
- **Shadow DOM isolation.** Each pin button gets its own shadow root on a `<div data-pinboard="anchor">` appended to the assistant message element. The save dialog and toast render inside a separate global shadow root (`#pinboard-root` on `document.body`). CSS is inlined into each shadow root — no stylesheets leak into or from the host page.
- **Shadow host utility (`shadow-host.ts`).** Uses Vite's `?inline` CSS import to bundle `pinboard-inject.css` as a string, then injects it as a `<style>` inside the shadow root. This is the correct approach for Shadow DOM + Vite.
- **Pin button has its own mini shadow root** (per-button) with minimal inline CSS, rather than sharing the global shadow root. This is because the button needs to be visually positioned inside the assistant message DOM, not in a detached container.

**Implementation notes:**
- All three platform scripts (claude.ts, chatgpt.ts, gemini.ts) follow the same pattern: SELECTORS object at top, PlatformAdapter implementation, streaming detection via MutationObserver + 1.5s debounce, SPA navigation via URL change detection, and a `PASTE_INTO_INPUT` message listener for re-injection.
- Streaming detection has two signals: (1) MutationObserver debounce (1.5s of no DOM changes) and (2) platform-specific "done" indicators (e.g., copy button appearing). Claude checks for `button[aria-label="Copy"]`, ChatGPT checks for `button[data-testid="copy-turn-action-button"]`, Gemini uses only the debounce.
- Save dialog state management is done with closures and mutable variables (not React) — rerender is manual via `dialog.innerHTML = buildDialogHTML(...)` + re-attaching event listeners. This keeps content scripts lightweight with no framework dependency.
- Vite correctly code-splits the shared modules: `shadow-host.ts` (8.58 kB, includes bundled CSS) is a shared chunk loaded by all three platform scripts. Each platform script is ~3.8 kB.

**Issues encountered:**
1. **Vite `?inline` CSS import needs its own type declaration.** Added `declare module '*.css?inline'` to `src/types/css.d.ts` alongside the existing `*.css` declaration.
2. **Save dialog `chrome.storage.local.get` returns `Record<string, unknown>`.** The value retrieved for `lastUsedBoardId` needed an explicit `String()` cast to satisfy TypeScript's strict mode — assigning `unknown` to `string` is not allowed.

### Phase 3 — 2026-03-24

**Architecture:**
- **App.tsx routing.** Simple state-based navigation: `view` (boards/search/actions) + `selectedBoard`. When a board is selected, the tab nav hides and `BoardView` renders with a back button. No router library needed for a side panel.
- **Each view owns its data.** `BoardView`, `ActionsList`, and `SearchBar` each instantiate their own `useSavedItems` / `useBoards` hooks. This avoids prop drilling and keeps components self-contained. The trade-off is multiple Dexie reads, but IndexedDB reads are fast and the dataset is small.
- **`SavedItemCard` is memoized** with `React.memo` to avoid re-renders when sibling items change (per Phase 4.5 performance spec).

**Implementation notes:**
- **BoardList.tsx**: Inline board creation (name + color picker), item counts loaded via Dexie `count()` query per board, delete with confirmation. Boards sorted by `order` field.
- **BoardView.tsx**: Shows all saved items for a board, most recent first. Uses `useSavedItems(boardId)` for filtered loading. Supports move-to-board via the item card menu.
- **SavedItemCard.tsx**: Content preview (first 200 chars, click to expand), platform badge with per-platform colors, inline note editor, action checkbox with strikethrough, tags, metadata footer, three-dot menu (move to board, view original, delete), re-inject button.
- **NoteEditor.tsx**: Click-to-edit inline input. Blur or Enter saves, Escape cancels. Controlled component synced with parent via `onSave` callback.
- **ActionsList.tsx**: Filters all saved items to those with uncompleted actions. Shows board name on each card (`showBoard` prop). Checking the checkbox marks the action complete and removes it from the view.
- **SearchBar.tsx**: Uses FlexSearch via `useSearch` hook. Instant results as you type. Matched items displayed as `SavedItemCard` with board names.
- **ReInjectButton.tsx**: Queries active tab via `chrome.tabs`, checks if it's a supported platform, sends `PASTE_INTO_INPUT` message to the content script. Falls back to clipboard copy if the tab isn't a supported platform or if messaging fails.
- **export.ts**: Single item export as markdown with YAML frontmatter (board, platform, URL, tags, note, action). Board export downloads an index file + individual item files. No zip dependency — downloads individual files.
- **reinject.ts**: Utility for formatting content for re-injection (shared format string). Used by content scripts.

**Issues encountered:**
1. **Save dialog board creation not reflected in side panel.** The save dialog (content script) creates boards via `CREATE_BOARD` message to the background service worker. The service worker calls `notifyDataChanged()` which sends a `DATA_CHANGED` message — but the sidepanel had no `chrome.runtime.onMessage` listener for it. Boards created from the save dialog were invisible in the side panel until a full page reload.
2. **Item counts not updating in board list after saving a pin.** Same root cause — the `BoardList.tsx` component recalculated item counts only when the `boards` array changed, but saving an item to an existing board doesn't change the boards array.

**Fixes applied:**
- Added `chrome.runtime.onMessage` listener in `useBoards.ts` that calls `loadBoards()` on `DATA_CHANGED` messages. This ensures new boards created from content scripts appear immediately in the side panel.
- Added a separate `chrome.runtime.onMessage` listener in `BoardList.tsx` that recalculates item counts on `DATA_CHANGED` messages. This ensures item counts update immediately when pins are saved.
- Also improved `useSavedItems.ts` and `shadow-host.ts` with `DATA_CHANGED` listener and context validity check respectively.
- Fixed Claude platform adapter selectors to use `.font-claude-response` (verified 2026-03-24) and improved content extraction to target specific child elements (`p.font-claude-response-body`, `pre`, `ol`, `ul`, headings, `table`).

### Phase 4 (partial) — 2026-03-25

**ChatGPT SPA navigation fix:**
The original SPA navigation handler in chatgpt.ts used a single `setTimeout(1000)` after detecting a URL change via MutationObserver. This was unreliable because ChatGPT's conversation load time varies. Also, old conversation messages kept `data-pinboard-pinned` attributes so they'd be skipped on re-scan.

**Fix applied (chatgpt.ts):**
1. **Triple navigation detection**: MutationObserver on body + Navigation API (`navigation.addEventListener('navigate')`) + `popstate` event listener. All three funnel through a single `handleNavigation()` that deduplicates via `lastUrl` comparison.
2. **Clear pinned attributes on navigation**: `clearPinnedAttributes()` removes `data-pinboard-pinned` and `[data-pinboard]` anchors from all elements, ensuring a clean slate for the new conversation.
3. **Polling for new messages**: `pollForMessages()` checks every 500ms for up to 10 seconds for assistant messages to appear. Injects pins as soon as messages are found. This handles ChatGPT's variable load times.

**Gemini selector fix (gemini.ts):**
Gemini's DOM structure was different from what the original selectors expected. Key findings:
- Assistant responses are `<model-response>` custom elements, not `message-content.model-response-text`.
- Parent container is `div.conversation-container`, not `.conversation-turn`.
- Inside `model-response`, actual text content is in `message-content div.markdown`.
- Must exclude: `div.model-thoughts` / `div.thoughts-container` (thinking section), `div.response-container-header` ("Gemini said"), `div.actions-container-v2` (buttons).

**Fix applied (gemini.ts):**
1. Updated `SELECTORS.assistantMessage` to `'model-response'`.
2. Updated `SELECTORS.turnContainer` to `'.conversation-container'`.
3. Added `markdownContent` and `contentElements` selectors for targeted content extraction.
4. `extractContent()` now scopes to `message-content div.markdown` and only grabs `p, ol, ul, pre, h3, table, hr, code` elements. Excludes thinking, header, and action buttons.
5. `contentPlain` in `onPin` handler uses same scoped selectors instead of `el.textContent` (which captured thinking/header/buttons text).
6. `extractPrecedingPrompt()` walks `.conversation-container` siblings to find preceding `user-message-text`.

**SavedItemCard expanded view (SavedItemCard.tsx + index.css):**
The expanded view rendered `item.contentPlain` — raw unformatted text with no structure.

**Fix applied:**
1. Expanded view now renders `item.content` (HTML) via `dangerouslySetInnerHTML` inside a `.pb-content` wrapper. Collapsed preview still uses `contentPlain` with `line-clamp-3`.
2. Added "Show less" button below expanded content.
3. Added `.pb-content` CSS styles in `src/sidepanel/index.css` covering: paragraph spacing, heading sizes (h1-h4), list indentation, code blocks (gray bg, rounded, `overflow-x: auto`, monospace), inline code, table borders, blockquotes with purple left border accent, strong/em, hr. All sized for narrow side panel (~320px).

### Re-injection formatting fix — 2026-03-26

**Problem:** Re-injected content in chat input fields had excessive vertical spacing between lines. The `contentPlain` text (extracted by joining block elements with `\n`) often contained runs of 3+ consecutive newlines. Chat input editors (ProseMirror on Claude, contenteditable on others) render each `\n` as a separate paragraph/line break, creating large visual gaps.

**Fix applied (claude.ts, chatgpt.ts, gemini.ts):**
1. Added whitespace normalization before formatting: `text.replace(/\n{3,}/g, '\n\n').trim()` — collapses 3+ consecutive newlines into double newlines (paragraph breaks).
2. Reduced wrapper spacing in the formatting template — removed extra blank lines around `---` separators (changed `\n\n---\n` to `\n---\n`).
3. No changes to Pinboard's internal display — `contentPlain` stored in IndexedDB and rendered in the side panel is unaffected.