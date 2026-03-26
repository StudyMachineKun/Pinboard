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
    <div className="h-screen flex flex-col bg-white text-gray-900">
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h1 className="text-lg font-semibold text-[#6C5CE7]">PinAI</h1>
      </header>

      {!selectedBoard && (
        <nav className="flex border-b border-gray-200">
          {(['boards', 'search', 'actions'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setView(tab)}
              className={`flex-1 py-2 text-sm font-medium capitalize ${
                view === tab
                  ? 'text-[#6C5CE7] border-b-2 border-[#6C5CE7]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      )}

      <main className="flex-1 overflow-y-auto p-4">
        {showOnboarding && <OnboardingCard onDismiss={dismissOnboarding} />}
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
