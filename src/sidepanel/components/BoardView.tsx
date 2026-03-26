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
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 text-sm">&larr;</button>
        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: board.color }} />
        <h2 className="text-sm font-semibold truncate">{board.name}</h2>
        <span className="text-xs text-gray-400 ml-auto">{items.length} items</span>
      </div>

      {board.description && (
        <p className="text-xs text-gray-400">{board.description}</p>
      )}

      {/* Items */}
      {loading ? (
        <p className="text-xs text-gray-400">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-gray-400">Pin an AI response to add it to this board.</p>
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
