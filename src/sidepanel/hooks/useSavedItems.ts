import { useState, useCallback } from 'react';
import { db } from '../../storage/db';
import type { SavedItem } from '../../storage/models';

export function useSavedItems(boardId?: string) {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadItems = useCallback(async () => {
    setLoading(true);
    let result: SavedItem[];
    if (boardId) {
      result = await db.savedItems
        .where('boardId')
        .equals(boardId)
        .reverse()
        .sortBy('createdAt');
    } else {
      result = await db.savedItems.orderBy('createdAt').reverse().toArray();
    }
    setItems(result);
    setLoading(false);
  }, [boardId]);

  const updateItem = useCallback(async (id: string, changes: Partial<SavedItem>) => {
    await db.savedItems.update(id, { ...changes, updatedAt: Date.now() });
    await loadItems();
  }, [loadItems]);

  const deleteItem = useCallback(async (id: string) => {
    await db.savedItems.delete(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const moveItem = useCallback(async (id: string, newBoardId: string) => {
    await db.savedItems.update(id, { boardId: newBoardId, updatedAt: Date.now() });
    await loadItems();
  }, [loadItems]);

  return { items, loading, loadItems, updateItem, deleteItem, moveItem };
}
