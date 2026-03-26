import Dexie, { type Table } from 'dexie';
import type { Board, SavedItem } from './models';

class PinAIDB extends Dexie {
  boards!: Table<Board>;
  savedItems!: Table<SavedItem>;

  constructor() {
    // TODO: Migrate database name from 'pinboard' to 'pinai' before public release
    super('pinboard');
    this.version(1).stores({
      boards: 'id, name, order, createdAt',
      savedItems: 'id, boardId, *tags, source.platform, createdAt, updatedAt',
    });
  }
}

export const db = new PinAIDB();
