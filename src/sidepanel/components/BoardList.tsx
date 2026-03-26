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

function formatRelativeDate(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function BoardList({ boards, onSelect, onCreate, onDelete }: BoardListProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(DEFAULT_BOARD_COLORS[0]);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});

  const loadCounts = async () => {
    const allItems = await db.savedItems.toArray();
    const counts: Record<string, number> = {};
    for (const item of allItems) {
      counts[item.boardId] = (counts[item.boardId] ?? 0) + 1;
    }
    setItemCounts(counts);
  };

  useEffect(() => {
    loadCounts();
  }, [boards]);

  useEffect(() => {
    const onMessage = (message: { type: string }) => {
      if (message.type === 'DATA_CHANGED') loadCounts();
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, [boards]);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    onCreate(name, newColor);
    setNewName('');
    setNewColor(DEFAULT_BOARD_COLORS[0]);
    setShowCreate(false);
  };

  // Empty state
  if (boards.length === 0 && !showCreate) {
    return (
      <div className="flex flex-col items-center pt-12 px-4 text-center">
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <path d="M17.5 14v7M14 17.5h7" />
          </svg>
        </div>
        <p className="text-sm text-gray-500 mb-1">No boards yet</p>
        <p className="text-xs text-gray-400 mb-5" style={{ lineHeight: '1.6' }}>
          Create your first project board to start saving AI outputs.
        </p>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white rounded-lg hover:opacity-90 transition-opacity"
          style={{ background: '#6C5CE7' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New board
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* New board button */}
      <button
        onClick={() => setShowCreate(!showCreate)}
        className="w-full py-2 text-xs font-medium text-[#6C5CE7] border border-dashed border-gray-200 rounded-lg hover:border-[#6C5CE7] hover:bg-[#6C5CE7]/5 transition-colors"
      >
        + New board
      </button>

      {/* Create form */}
      {showCreate && (
        <div className="border border-gray-200 rounded-lg p-3 space-y-2.5 bg-white">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowCreate(false); }}
            placeholder="Board name"
            className="w-full text-sm px-2.5 py-1.5 border border-gray-200 rounded-md focus:border-[#6C5CE7] focus:ring-1 focus:ring-[#6C5CE7]/20 outline-none"
          />
          <div className="flex gap-1.5">
            {DEFAULT_BOARD_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className="w-5.5 h-5.5 rounded-full border-2 transition-all"
                style={{
                  width: 22, height: 22,
                  background: c,
                  borderColor: c === newColor ? '#1a1a1a' : 'transparent',
                }}
              />
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1">Cancel</button>
            <button
              onClick={handleCreate}
              className="text-xs font-medium text-white px-3 py-1 rounded-md hover:opacity-90 transition-opacity"
              style={{ background: '#6C5CE7' }}
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Board cards */}
      {boards.map((board) => {
        const count = itemCounts[board.id] ?? 0;
        return (
          <button
            key={board.id}
            onClick={() => onSelect(board)}
            className="w-full text-left bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 hover:shadow-sm transition-all group"
          >
            <div className="flex">
              {/* Color stripe */}
              <div className="w-1 flex-shrink-0" style={{ background: board.color }} />
              <div className="flex-1 px-3 py-2.5 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm font-medium text-gray-800 truncate">{board.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete "${board.name}" and all its saved items?`)) onDelete(board.id);
                    }}
                    className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400">{count} {count === 1 ? 'item' : 'items'}</span>
                  <span className="text-[11px] text-gray-300">|</span>
                  <span className="text-[11px] text-gray-400">{formatRelativeDate(board.updatedAt)}</span>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
