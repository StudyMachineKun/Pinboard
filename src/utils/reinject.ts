/** Format saved content for re-injection into a chat input. */
export function formatForReinjection(content: string): string {
  return [
    'Here is a previous AI output I\'d like to reference:',
    '',
    '---',
    content,
    '---',
    '',
    'Continue from here / use this as context for the following request:',
    '',
  ].join('\n');
}
