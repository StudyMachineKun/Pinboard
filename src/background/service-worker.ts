import { db } from '../storage/db';
import type { Board, SavedItem } from '../storage/models';
import type { Message } from '../shared/types';
import { v4 as uuidv4 } from 'uuid';

/** Open side panel when extension icon is clicked. */
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

/** Handle keyboard shortcut commands. */
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'quick-save') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'QUICK_SAVE' });
    }
  }
});

/** Handle messages from content scripts and side panel. */
chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    handleMessage(message).then(sendResponse);
    return true; // keep channel open for async response
  }
);

/** Notify side panel that data has changed so it can reload. */
function notifyDataChanged() {
  chrome.runtime.sendMessage({ type: 'DATA_CHANGED' }).catch(() => {
    // No listeners — side panel may not be open. Safe to ignore.
  });
}

async function handleMessage(message: Message): Promise<unknown> {
  switch (message.type) {
    case 'SAVE_ITEM': {
      const now = Date.now();
      const item: SavedItem = {
        id: uuidv4(),
        ...message.payload,
        createdAt: now,
        updatedAt: now,
      };
      await db.savedItems.add(item);
      notifyDataChanged();
      return { success: true, id: item.id };
    }

    case 'GET_BOARDS': {
      const boards = await db.boards.orderBy('order').toArray();
      return boards;
    }

    case 'GET_ITEMS_FOR_BOARD': {
      const items = await db.savedItems
        .where('boardId')
        .equals(message.boardId)
        .reverse()
        .sortBy('createdAt');
      return items;
    }

    case 'CREATE_BOARD': {
      const now = Date.now();
      const count = await db.boards.count();
      const board: Board = {
        id: uuidv4(),
        name: message.payload.name,
        color: message.payload.color,
        description: message.payload.description,
        createdAt: now,
        updatedAt: now,
        order: count,
      };
      await db.boards.add(board);
      notifyDataChanged();
      return board;
    }

    default:
      return { error: 'Unknown message type' };
  }
}
