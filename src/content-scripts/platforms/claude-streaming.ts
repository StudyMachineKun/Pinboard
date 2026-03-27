const RETRY_MARKERS = [
  /overloaded_error/i,
  /retrying in \d+\s*seconds/i,
  /attempt\s*\d+\s*\/\s*\d+/i,
] as const;

export function isClaudeRetryingState(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return false;
  return RETRY_MARKERS.some((pattern) => pattern.test(normalized));
}
