import Dexie, { type Table } from 'dexie';
import type { Board, SavedItem } from './models';

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
