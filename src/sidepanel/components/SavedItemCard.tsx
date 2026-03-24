import { useState, memo } from 'react';
import type { SavedItem, Board } from '../../storage/models';
import { NoteEditor } from './NoteEditor';
import { ReInjectButton } from './ReInjectButton';

interface SavedItemCardProps {
  item: SavedItem;
  boards?: Board[];
  showBoard?: boolean;
  onUpdateNote: (id: string, note: string) => void;
  onToggleAction: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onMove?: (id: string, boardId: string) => void;
}

const PLATFORM_LABELS = {
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
} as const;

const PLATFORM_COLORS = {
  claude: 'bg-orange-100 text-orange-700',
  chatgpt: 'bg-green-100 text-green-700',
  gemini: 'bg-blue-100 text-blue-700',
} as const;

export const SavedItemCard = memo(function SavedItemCard({
  item,
  boards,
  showBoard,
  onUpdateNote,
  onToggleAction,
  onDelete,
  onMove,
}: SavedItemCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const previewText = item.contentPlain.slice(0, 200);
  const needsTruncation = item.contentPlain.length > 200;
  const timeStr = new Date(item.source.savedAt).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const boardName = showBoard && boards
    ? boards.find((b) => b.id === item.boardId)?.name
    : null;

  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-2 relative">
      {/* Header: platform badge + menu */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${PLATFORM_COLORS[item.source.platform]}`}>
            {PLATFORM_LABELS[item.source.platform]}
          </span>
          {boardName && (
            <span className="text-[10px] text-gray-400">{boardName}</span>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="text-gray-400 hover:text-gray-600 text-sm px-1"
          >
            ...
          </button>
          {showMenu && (
            <div className="absolute right-0 top-6 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
              {boards && onMove && (
                <div className="px-3 py-1.5">
                  <div className="text-[10px] text-gray-400 mb-1">Move to</div>
                  {boards
                    .filter((b) => b.id !== item.boardId)
                    .map((b) => (
                      <button
                        key={b.id}
                        onClick={() => { onMove(item.id, b.id); setShowMenu(false); }}
                        className="block w-full text-left text-xs py-1 hover:text-[#6C5CE7]"
                      >
                        {b.name}
                      </button>
                    ))}
                </div>
              )}
              {item.source.url && (
                <a
                  href={item.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-3 py-1.5 text-xs hover:bg-gray-50"
                  onClick={() => setShowMenu(false)}
                >
                  View original
                </a>
              )}
              <button
                onClick={() => { onDelete(item.id); setShowMenu(false); }}
                className="block w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content preview */}
      <div
        onClick={() => needsTruncation && setExpanded(!expanded)}
        className={`text-sm text-gray-700 ${needsTruncation ? 'cursor-pointer' : ''} ${expanded ? '' : 'line-clamp-3'}`}
      >
        {expanded ? item.contentPlain : previewText}
        {needsTruncation && !expanded && '...'}
      </div>

      {/* Note */}
      <NoteEditor
        value={item.note}
        onSave={(note) => onUpdateNote(item.id, note)}
      />

      {/* Action */}
      {item.action && (
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={item.action.completed}
            onChange={(e) => onToggleAction(item.id, e.target.checked)}
            className="rounded accent-[#6C5CE7]"
          />
          <span className={item.action.completed ? 'line-through text-gray-400' : 'text-gray-600'}>
            {item.action.text}
          </span>
        </label>
      )}

      {/* Tags */}
      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.tags.map((tag) => (
            <span key={tag} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-100">
        <span className="text-[10px] text-gray-400">{timeStr}</span>
        <ReInjectButton contentPlain={item.contentPlain} />
      </div>
    </div>
  );
});
