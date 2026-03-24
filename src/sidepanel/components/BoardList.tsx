import { useState, useEffect } from 'react';
import type { Board } from '../../storage/models';
import { db } from '../../storage/db';
import { DEFAULT_BOARD_COLORS } from '../../shared/constants';

interface BoardListProps {
  boards: Board[];
  onSelect: (board: Board) => void;
  onCreate: (name: string, color: string) => void;
  onDelete: (id: string) => void;
}

export function BoardList({ boards, onSelect, onCreate, onDelete }: BoardListProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(DEFAULT_BOARD_COLORS[0]);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    async function loadCounts() {
      const counts: Record<string, number> = {};
      for (const board of boards) {
        counts[board.id] = await db.savedItems.where('boardId').equals(board.id).count();
      }
      setItemCounts(counts);
    }
    loadCounts();
  }, [boards]);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    onCreate(name, newColor);
    setNewName('');
    setNewColor(DEFAULT_BOARD_COLORS[0]);
    setShowCreate(false);
  };

  if (boards.length === 0 && !showCreate) {
    return (
      <div className="space-y-4">
        <p className="text-gray-400 text-sm">Create your first project board to start saving AI outputs.</p>
        <button
          onClick={() => setShowCreate(true)}
          className="w-full py-2 text-sm font-medium text-[#6C5CE7] border border-dashed border-[#6C5CE7] rounded-lg hover:bg-[#6C5CE7]/5"
        >
          + New board
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => setShowCreate(!showCreate)}
        className="w-full py-2 text-sm font-medium text-[#6C5CE7] border border-dashed border-[#6C5CE7] rounded-lg hover:bg-[#6C5CE7]/5"
      >
        + New board
      </button>

      {showCreate && (
        <div className="border border-gray-200 rounded-lg p-3 space-y-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowCreate(false); }}
            placeholder="Board name"
            className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded focus:border-[#6C5CE7] focus:ring-1 focus:ring-[#6C5CE7]/20 outline-none"
          />
          <div className="flex gap-1.5">
            {DEFAULT_BOARD_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className="w-6 h-6 rounded-full border-2 transition-all"
                style={{ background: c, borderColor: c === newColor ? '#1a1a1a' : 'transparent' }}
              />
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
            <button onClick={handleCreate} className="text-xs font-medium text-white bg-[#6C5CE7] px-3 py-1 rounded hover:bg-[#5a4bd1]">Create</button>
          </div>
        </div>
      )}

      {boards.map((board) => (
        <button
          key={board.id}
          onClick={() => onSelect(board)}
          className="w-full text-left border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: board.color }} />
              <span className="text-sm font-medium truncate">{board.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{itemCounts[board.id] ?? 0} items</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete "${board.name}" and all its saved items?`)) onDelete(board.id);
                }}
                className="text-gray-300 hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Delete
              </button>
            </div>
          </div>
          {board.description && (
            <p className="text-xs text-gray-400 mt-1 truncate">{board.description}</p>
          )}
        </button>
      ))}
    </div>
  );
}
