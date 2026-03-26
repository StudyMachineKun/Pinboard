interface OnboardingCardProps {
  onDismiss: () => void;
}

export function OnboardingCard({ onDismiss }: OnboardingCardProps) {
  return (
    <div className="mb-4 border border-[#6C5CE7]/30 bg-[#6C5CE7]/5 rounded-lg p-4 space-y-3">
      <h2 className="text-sm font-semibold text-[#6C5CE7]">Welcome to PinAI</h2>
      <p className="text-xs text-gray-600 leading-relaxed">
        Save the best outputs from your AI conversations and organize them into project boards.
      </p>
      <ul className="text-xs text-gray-600 space-y-1.5">
        <li>
          <span className="font-medium text-gray-700">Project boards</span> — organize saves by project or topic
        </li>
        <li>
          <span className="font-medium text-gray-700">Notes & actions</span> — annotate why you saved something and track next steps
        </li>
        <li>
          <span className="font-medium text-gray-700">Re-inject</span> — paste saved outputs back into new conversations as context
        </li>
      </ul>
      <p className="text-[10px] text-gray-400">
        Tip: Use Cmd+Shift+S (Ctrl+Shift+S) to quick-save the latest response.
      </p>
      <button
        onClick={onDismiss}
        className="text-xs font-medium text-[#6C5CE7] hover:text-[#5a4bd1]"
      >
        Got it, let's go
      </button>
    </div>
  );
}
