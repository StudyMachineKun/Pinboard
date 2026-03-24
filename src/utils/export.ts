import type { SavedItem, Board } from '../storage/models';

/** Export a single saved item as a markdown string with YAML frontmatter. */
export function exportItemAsMarkdown(item: SavedItem, boardName?: string): string {
  const date = new Date(item.source.savedAt).toISOString();
  const tags = item.tags.length > 0 ? `[${item.tags.join(', ')}]` : '[]';

  let frontmatter = `---\n`;
  if (boardName) frontmatter += `board: "${boardName}"\n`;
  frontmatter += `platform: ${item.source.platform}\n`;
  frontmatter += `saved_at: ${date}\n`;
  if (item.source.url) frontmatter += `source_url: ${item.source.url}\n`;
  if (item.source.conversationTitle) frontmatter += `conversation_title: "${item.source.conversationTitle}"\n`;
  frontmatter += `tags: ${tags}\n`;
  if (item.note) frontmatter += `note: "${item.note}"\n`;
  if (item.action) {
    frontmatter += `action: "${item.action.text}"\n`;
    frontmatter += `action_completed: ${item.action.completed}\n`;
  }
  frontmatter += `---\n\n`;

  let body = '';
  if (item.promptContext) {
    body += `## Prompt\n\n${item.promptContext}\n\n`;
  }
  body += `## Response\n\n${item.contentPlain}\n`;

  return frontmatter + body;
}

/** Trigger a file download in the browser. */
function downloadFile(filename: string, content: string, mimeType = 'text/markdown') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Export a single item as a .md download. */
export function downloadItem(item: SavedItem, boardName?: string) {
  const filename = sanitizeFilename(
    `${new Date(item.source.savedAt).toISOString().slice(0, 10)}-${item.source.platform}`
  ) + '.md';
  downloadFile(filename, exportItemAsMarkdown(item, boardName));
}

/** Export an entire board as individual .md downloads (no zip dependency). */
export function downloadBoard(board: Board, items: SavedItem[]) {
  // Create an index file
  let index = `# ${board.name}\n\n`;
  if (board.description) index += `${board.description}\n\n`;
  index += `${items.length} saved items\n\n---\n\n`;

  for (const item of items) {
    const date = new Date(item.source.savedAt).toISOString().slice(0, 10);
    const title = item.contentPlain.slice(0, 60).replace(/\n/g, ' ');
    index += `- **${date}** [${item.source.platform}] ${title}...\n`;
  }

  downloadFile(`${sanitizeFilename(board.name)}-index.md`, index);

  // Download each item
  for (const item of items) {
    downloadItem(item, board.name);
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
}
