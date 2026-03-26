interface OnboardingCardProps {
  onDismiss: () => void;
}

export function OnboardingCard({ onDismiss }: OnboardingCardProps) {
  return (
    <div className="mb-3 rounded-lg p-3.5 border border-[#6C5CE7]/20" style={{ background: '#F8F7FF' }}>
      <p className="text-xs font-medium text-[#6C5CE7] mb-2.5">How PinAI works</p>
      <div className="space-y-1.5 text-xs text-gray-600" style={{ lineHeight: '1.6' }}>
        <p><span className="text-gray-800 font-medium">Pin</span> the best AI outputs from any conversation</p>
        <p><span className="text-gray-800 font-medium">Organize</span> into project boards with notes and actions</p>
        <p><span className="text-gray-800 font-medium">Re-inject</span> saved outputs into new chats as context</p>
      </div>
      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[#6C5CE7]/10">
        <span className="text-[11px] text-gray-400">Tip: Cmd+Shift+S to quick-save</span>
        <button
          onClick={onDismiss}
          className="text-[11px] font-medium text-[#6C5CE7] hover:text-[#5a4bd1]"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
