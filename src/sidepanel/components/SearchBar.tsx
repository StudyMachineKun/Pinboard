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
    <div className="space-y-2.5">
      <div className="relative">
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Search saved outputs..."
          className="w-full text-sm pl-8 pr-3 py-2 border border-gray-200 rounded-lg bg-white focus:border-[#6C5CE7] focus:ring-1 focus:ring-[#6C5CE7]/20 outline-none"
        />
      </div>

      {!query && (
        <div className="flex flex-col items-center pt-8 text-center px-4">
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <p className="text-xs text-gray-400">Search across all your saved AI outputs.</p>
        </div>
      )}

      {query && matchedItems.length === 0 && (
        <div className="flex flex-col items-center pt-8 text-center px-4">
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <p className="text-xs text-gray-500">No results found</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Try a different search term.</p>
        </div>
      )}

      {query && matchedItems.length > 0 && (
        <p className="text-[11px] text-gray-400">{matchedItems.length} result{matchedItems.length !== 1 ? 's' : ''}</p>
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
