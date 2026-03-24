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
      className="text-xs text-[#6C5CE7] hover:text-[#5a4bd1] font-medium"
    >
      Re-inject
    </button>
  );
}
