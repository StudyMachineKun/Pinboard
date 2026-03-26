import { useEffect } from 'react';
import { SavedItemCard } from './SavedItemCard';
import { useSavedItems } from '../hooks/useSavedItems';
import { useBoards } from '../hooks/useBoards';

export function ActionsList() {
  const { items, loading, loadItems, updateItem, deleteItem, moveItem } = useSavedItems();
  const { boards } = useBoards();

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const actionItems = items.filter((item) => item.action && !item.action.completed);

  if (loading) return <p className="text-xs text-gray-400 pt-4 text-center">Loading...</p>;

  if (actionItems.length === 0) {
    return (
      <div className="flex flex-col items-center pt-12 text-center px-4">
        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center mb-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
        </div>
        <p className="text-xs text-gray-500">No pending actions</p>
        <p className="text-[11px] text-gray-400 mt-0.5">You're all caught up!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <p className="text-[11px] text-gray-400">{actionItems.length} pending action{actionItems.length !== 1 ? 's' : ''}</p>
      {actionItems.map((item) => (
        <SavedItemCard
          key={item.id}
          item={item}
          boards={boards}
          showBoard
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
      ))}
    </div>
  );
}
