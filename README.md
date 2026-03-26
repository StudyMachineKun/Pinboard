# PinAI — AI Knowledge Library

Save, organize, and re-use the best outputs from your AI conversations across Claude, ChatGPT, and Gemini.

Great AI outputs disappear into scroll history. PinAI lets you pin individual responses, organize them into project boards, add personal notes and action items, and re-inject saved outputs back into new conversations as context.

## Features

- **Pin AI responses** with one click or right-click context menu
- **Project boards** to organize saves by topic (not just folders)
- **Notes and actions** on every saved item
- **Re-inject** saved outputs into any AI chat input with one click
- **Quick save** via keyboard shortcut (Cmd+Shift+S / Ctrl+Shift+S)
- **Full-text search** across all saved outputs
- **Markdown export** for individual items or entire boards
- **Local-first** — all data stays in your browser (IndexedDB), nothing leaves your device
- **Works on** claude.ai, chatgpt.com, and gemini.google.com

## Install

### From Chrome Web Store

Coming soon.

### From source

```bash
git clone https://github.com/StudyMachineKun/PinAI.git
cd PinAI
npm install
npm run build
```

Then load in Chrome:

1. Go to `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `dist/` folder

## Usage

1. Open a conversation on Claude, ChatGPT, or Gemini
2. Hover over any AI response — a pin button appears in the top right
3. Click the pin to save it to a project board
4. Open the PinAI side panel (click the extension icon or Cmd+Shift+P) to browse, search, and manage your saved outputs
5. Click "Re-inject" on any saved item to paste it into your current chat

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| Cmd+Shift+S (Ctrl+Shift+S) | Quick save latest response |
| Cmd+Shift+P (Ctrl+Shift+P) | Toggle side panel |

## Tech stack

- Chrome Extension (Manifest V3)
- React 19 + Tailwind CSS v4
- TypeScript (strict mode)
- Vite + @crxjs/vite-plugin
- Dexie.js (IndexedDB)
- FlexSearch (full-text search)

## Project structure

```
src/
  background/       Service worker (messages, context menus)
  content-scripts/  Platform adapters (Claude, ChatGPT, Gemini)
  sidepanel/        React app (boards, search, actions)
  storage/          Dexie.js database and models
  shared/           Constants and types
```

## Privacy

PinAI stores all data locally in your browser. No data is sent to any server, API, or third party. No analytics, no tracking, no accounts. See [Privacy Policy](https://studymachinekun.github.io/PinAI/docs/privacy-policy.html).

## License

MIT
