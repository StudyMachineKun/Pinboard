import { useState, useEffect } from 'react';
import type { Board } from '../storage/models';
import { useBoards } from './hooks/useBoards';
import { BoardList } from './components/BoardList';
import { BoardView } from './components/BoardView';
import { SearchBar } from './components/SearchBar';
import { ActionsList } from './components/ActionsList';
import { OnboardingCard } from './components/OnboardingCard';
import { STORAGE_KEYS } from '../shared/constants';

type View = 'boards' | 'search' | 'actions';

const TAB_ICONS: Record<View, string> = {
  boards: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z',
  search: 'M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z',
  actions: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
};

export default function App() {
  const [view, setView] = useState<View>('boards');
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { boards, createBoard, deleteBoard } = useBoards();

  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEYS.onboardingDismissed, (result) => {
      if (!result[STORAGE_KEYS.onboardingDismissed]) {
        setShowOnboarding(true);
      }
    });
  }, []);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    chrome.storage.local.set({ [STORAGE_KEYS.onboardingDismissed]: true });
  };

  const handleSelectBoard = (board: Board) => setSelectedBoard(board);
  const handleBack = () => setSelectedBoard(null);

  return (
    <div className="h-screen flex flex-col bg-gray-50 text-gray-900" style={{ fontSize: '14px', lineHeight: '1.55' }}>
      {/* Header */}
      <header className="flex items-center gap-2.5 px-4 py-3 bg-white border-b border-gray-200">
        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: '#6C5CE7' }}>
          <svg width="14" height="14" viewBox="0 0 128 128" fill="none">
            <g transform="translate(64,64)" stroke="white" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round">
              <path d="M0 14 L0 42"/>
              <rect x="-26" y="-38" width="52" height="44" rx="8" fill="rgba(255,255,255,0.4)" stroke="white"/>
              <circle cx="0" cy="-16" r="10" fill="white" stroke="none"/>
            </g>
          </svg>
        </div>
        <h1 className="text-base font-medium" style={{ color: '#6C5CE7', letterSpacing: '-0.3px' }}>PinAI</h1>
      </header>

      {/* Tab nav */}
      {!selectedBoard && (
        <nav className="flex bg-white border-b border-gray-200">
          {(['boards', 'search', 'actions'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setView(tab)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium capitalize transition-colors ${
                view === tab
                  ? 'text-[#6C5CE7] border-b-2 border-[#6C5CE7]'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={TAB_ICONS[tab]} />
              </svg>
              {tab}
            </button>
          ))}
        </nav>
      )}

      <main className="flex-1 overflow-y-auto p-3">
        {showOnboarding && view === 'boards' && !selectedBoard && (
          <OnboardingCard onDismiss={dismissOnboarding} />
        )}
        {selectedBoard ? (
          <BoardView board={selectedBoard} onBack={handleBack} />
        ) : view === 'boards' ? (
          <BoardList
            boards={boards}
            onSelect={handleSelectBoard}
            onCreate={createBoard}
            onDelete={deleteBoard}
          />
        ) : view === 'search' ? (
          <SearchBar />
        ) : (
          <ActionsList />
        )}
      </main>
    </div>
  );
}
