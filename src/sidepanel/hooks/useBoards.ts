import { useState, useEffect, useCallback } from 'react';
import { db } from '../../storage/db';
import type { Board } from '../../storage/models';
import { v4 as uuidv4 } from 'uuid';

export function useBoards() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBoards = useCallback(async () => {
    const all = await db.boards.orderBy('order').toArray();
    setBoards(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadBoards();
  }, [loadBoards]);

  const createBoard = useCallback(async (name: string, color: string, description?: string) => {
    const now = Date.now();
    const board: Board = {
      id: uuidv4(),
      name,
      color,
      description,
      createdAt: now,
      updatedAt: now,
      order: boards.length,
    };
    await db.boards.add(board);
    setBoards((prev) => [...prev, board]);
    return board;
  }, [boards.length]);

  const updateBoard = useCallback(async (id: string, changes: Partial<Board>) => {
    await db.boards.update(id, { ...changes, updatedAt: Date.now() });
    await loadBoards();
  }, [loadBoards]);

  const deleteBoard = useCallback(async (id: string) => {
    await db.boards.delete(id);
    await db.savedItems.where('boardId').equals(id).delete();
    await loadBoards();
  }, [loadBoards]);

  return { boards, loading, createBoard, updateBoard, deleteBoard, reload: loadBoards };
}
