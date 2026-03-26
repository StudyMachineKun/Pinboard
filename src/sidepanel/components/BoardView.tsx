import { useEffect } from 'react';
import type { Board } from '../../storage/models';
import { SavedItemCard } from './SavedItemCard';
import { useSavedItems } from '../hooks/useSavedItems';
import { useBoards } from '../hooks/useBoards';

interface BoardViewProps {
  board: Board;
  onBack: () => void;
}

export function BoardView({ board, onBack }: BoardViewProps) {
  const { items, loading, loadItems, updateItem, deleteItem, moveItem } = useSavedItems(board.id);
  const { boards } = useBoards();

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  return (
    <div className="space-y-2.5">
      {/* Header */}
      <div className="flex items-center gap-2 pb-1">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 transition-colors p-0.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: board.color }} />
        <h2 className="text-sm font-medium text-gray-800 truncate">{board.name}</h2>
        <span className="text-[11px] text-gray-400 ml-auto flex-shrink-0">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
      </div>

      {board.description && (
        <p className="text-xs text-gray-400" style={{ lineHeight: '1.5' }}>{board.description}</p>
      )}

      {/* Items */}
      {loading ? (
        <p className="text-xs text-gray-400 pt-4 text-center">Loading...</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center pt-10 text-center px-4">
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
          <p className="text-xs text-gray-400" style={{ lineHeight: '1.6' }}>
            Pin an AI response to add it to this board.
          </p>
        </div>
      ) : (
        items.map((item) => (
          <SavedItemCard
            key={item.id}
            item={item}
            boards={boards}
            onUpdateNote={(id, note) => updateItem(id, { note })}
            onUpdateAction={(id, action) => updateItem(id, { action })}
            onToggleAction={(id, completed) => {
              const action = items.find((i) => i.id === id)?.action;
              if (!action) return;
              updateItem(id, {
                action: { ...action, completed, completedAt: completed ? Date.now() : undefined },
              });
            }}
            onDelete={deleteItem}
            onMove={moveItem}
          />
        ))
      )}
    </div>
  );
}
