import { useState, useCallback, useEffect } from 'react';
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

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') loadItems();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const onMessage = (message: { type: string }) => {
      if (message.type === 'DATA_CHANGED') loadItems();
    };
    chrome.runtime.onMessage.addListener(onMessage);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      chrome.runtime.onMessage.removeListener(onMessage);
    };
  }, [loadItems]);

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
