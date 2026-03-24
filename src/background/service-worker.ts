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

/** Handle messages from content scripts and side panel. */
chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    handleMessage(message).then(sendResponse);
    return true; // keep channel open for async response
  }
);

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
      return board;
    }

    default:
      return { error: 'Unknown message type' };
  }
}
