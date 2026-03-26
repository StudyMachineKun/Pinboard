interface ReInjectButtonProps {
  contentPlain: string;
}

export function ReInjectButton({ contentPlain }: ReInjectButtonProps) {
  const handleClick = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url) {
        await navigator.clipboard.writeText(contentPlain);
        return;
      }

      const supported = ['claude.ai', 'chatgpt.com', 'gemini.google.com'];
      const isSupported = supported.some((host) => tab.url!.includes(host));

      if (isSupported) {
        chrome.tabs.sendMessage(tab.id, { type: 'PASTE_INTO_INPUT', text: contentPlain });
      } else {
        await navigator.clipboard.writeText(contentPlain);
      }
    } catch {
      await navigator.clipboard.writeText(contentPlain);
    }
  };

  return (
    <button
      onClick={handleClick}
      title="Re-inject into active chat"
      className="inline-flex items-center gap-1 text-[11px] text-[#6C5CE7] hover:text-[#5a4bd1] font-medium transition-colors"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M13.8 12H3" />
      </svg>
      Re-inject
    </button>
  );
}
