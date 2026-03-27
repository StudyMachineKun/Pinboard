import { describe, expect, it } from 'vitest';
import { isClaudeRetryingState } from '../src/content-scripts/platforms/claude-streaming';

describe('isClaudeRetryingState', () => {
  it('detects overloaded retry status', () => {
    const text = '529 {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}} Retrying in 9 seconds… (attempt 5/10)';
    expect(isClaudeRetryingState(text)).toBe(true);
  });

  it('does not mark normal response text as retrying', () => {
    const text = 'Here is the implementation plan with three steps and code examples.';
    expect(isClaudeRetryingState(text)).toBe(false);
  });
});
