import { useState, memo } from 'react';
import type { SavedItem, Board, Action } from '../../storage/models';
import { NoteEditor } from './NoteEditor';
import { ActionEditor } from './ActionEditor';
import { ReInjectButton } from './ReInjectButton';

interface SavedItemCardProps {
  item: SavedItem;
  boards?: Board[];
  showBoard?: boolean;
  onUpdateNote: (id: string, note: string) => void;
  onUpdateAction: (id: string, action: Action | undefined) => void;
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
  onUpdateAction,
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
    <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2 relative">
      {/* Header: platform badge + menu */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${PLATFORM_COLORS[item.source.platform]}`}>
            {PLATFORM_LABELS[item.source.platform]}
          </span>
          {boardName && (
            <span className="text-[11px] text-gray-400 truncate max-w-[120px]">{boardName}</span>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="text-gray-300 hover:text-gray-500 p-0.5 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
            </svg>
          </button>
          {showMenu && (
            <div className="absolute right-0 top-6 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
              {boards && onMove && (
                <div className="px-3 py-1.5">
                  <div className="text-[11px] text-gray-400 mb-1">Move to</div>
                  {boards
                    .filter((b) => b.id !== item.boardId)
                    .map((b) => (
                      <button
                        key={b.id}
                        onClick={() => { onMove(item.id, b.id); setShowMenu(false); }}
                        className="block w-full text-left text-xs py-1 text-gray-600 hover:text-[#6C5CE7] transition-colors"
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
                  className="block px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                  onClick={() => setShowMenu(false)}
                >
                  View original
                </a>
              )}
              <button
                onClick={() => { onDelete(item.id); setShowMenu(false); }}
                className="block w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 transition-colors"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content preview / expanded */}
      {expanded ? (
        <div>
          <div
            className="pinai-content"
            dangerouslySetInnerHTML={{ __html: item.content }}
          />
          <button
            onClick={() => setExpanded(false)}
            className="text-xs text-[#6C5CE7] hover:text-[#5A4BD1] mt-1.5 font-medium transition-colors"
          >
            Show less
          </button>
        </div>
      ) : (
        <div
          onClick={() => needsTruncation && setExpanded(true)}
          className={`text-sm text-gray-600 ${needsTruncation ? 'cursor-pointer hover:text-gray-800' : ''} line-clamp-3`}
          style={{ lineHeight: '1.55' }}
        >
          {previewText}
          {needsTruncation && '...'}
        </div>
      )}

      {/* Note */}
      <NoteEditor
        value={item.note}
        onSave={(note) => onUpdateNote(item.id, note)}
      />

      {/* Action */}
      <ActionEditor
        action={item.action}
        onSave={(action) => onUpdateAction(item.id, action)}
        onToggle={(completed) => onToggleAction(item.id, completed)}
      />

      {/* Tags */}
      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.tags.map((tag) => (
            <span key={tag} className="text-[11px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1.5 border-t border-gray-100">
        <span className="text-[11px] text-gray-400">{timeStr}</span>
        <ReInjectButton contentPlain={item.contentPlain} />
      </div>
    </div>
  );
});
