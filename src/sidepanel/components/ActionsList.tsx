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

  if (loading) return <p className="text-xs text-gray-400">Loading...</p>;

  if (actionItems.length === 0) {
    return <p className="text-sm text-gray-400">No pending actions -- you're all caught up!</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">{actionItems.length} pending action{actionItems.length !== 1 ? 's' : ''}</p>
      {actionItems.map((item) => (
        <SavedItemCard
          key={item.id}
          item={item}
          boards={boards}
          showBoard
          onUpdateNote={(id, note) => updateItem(id, { note })}
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
