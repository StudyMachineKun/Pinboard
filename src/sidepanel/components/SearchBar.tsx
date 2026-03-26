import { useEffect } from 'react';
import { SavedItemCard } from './SavedItemCard';
import { useSearch } from '../hooks/useSearch';
import { useSavedItems } from '../hooks/useSavedItems';
import { useBoards } from '../hooks/useBoards';

export function SearchBar() {
  const { results, query, search } = useSearch();
  const { items, loadItems, updateItem, deleteItem, moveItem } = useSavedItems();
  const { boards } = useBoards();

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const matchedItems = query
    ? items.filter((item) => results.includes(item.id))
    : [];

  return (
    <div className="space-y-3">
      <input
        value={query}
        onChange={(e) => search(e.target.value)}
        placeholder="Search across all saved AI outputs..."
        className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:border-[#6C5CE7] focus:ring-1 focus:ring-[#6C5CE7]/20 outline-none"
      />

      {!query && (
        <p className="text-xs text-gray-400">Search across all your saved AI outputs.</p>
      )}

      {query && matchedItems.length === 0 && (
        <p className="text-xs text-gray-400">No results for "{query}"</p>
      )}

      {matchedItems.map((item) => (
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
