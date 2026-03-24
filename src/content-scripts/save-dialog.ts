import type { Board } from '../storage/models';
import type { Platform, SaveItemPayload } from '../shared/types';
import { DEFAULT_BOARD_COLORS, STORAGE_KEYS } from '../shared/constants';

export interface SaveDialogData {
  content: string;
  contentPlain: string;
  promptContext?: string;
  platform: Platform;
  conversationTitle?: string;
}

interface SaveDialogOptions {
  data: SaveDialogData;
  anchorRect: DOMRect;
  shadowRoot: ShadowRoot;
  onSaved: () => void;
}

/** Show the save dialog inside the Shadow DOM. */
export function showSaveDialog(options: SaveDialogOptions) {
  const { data, anchorRect, shadowRoot, onSaved } = options;

  closeSaveDialog(shadowRoot);

  const overlay = document.createElement('div');
  overlay.className = 'pb-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'pb-dialog';

  // Position near the pin button
  const top = anchorRect.bottom + 8;
  const left = Math.min(anchorRect.left, window.innerWidth - 340);
  dialog.style.top = `${top}px`;
  dialog.style.left = `${Math.max(8, left)}px`;

  // Mutable state
  let boards: Board[] = [];
  let selectedBoardId = '';
  let showNewBoardForm = false;
  let selectedColor = DEFAULT_BOARD_COLORS[0];

  const dialogState: DialogState = {
    data,
    boards,
    getSelectedBoardId: () => selectedBoardId,
    setSelectedBoardId: (id: string) => { selectedBoardId = id; },
    getShowNewBoardForm: () => showNewBoardForm,
    setShowNewBoardForm: (v: boolean) => { showNewBoardForm = v; },
    getSelectedColor: () => selectedColor,
    setSelectedColor: (c: string) => { selectedColor = c; },
    rerender: () => {
      dialog.innerHTML = buildDialogHTML(boards, selectedBoardId, showNewBoardForm, selectedColor);
      attachDialogListeners(dialog, shadowRoot, dialogState);
    },
    onSaved,
  };

  dialog.innerHTML = buildDialogHTML(boards, selectedBoardId, showNewBoardForm, selectedColor);
  overlay.appendChild(dialog);
  shadowRoot.appendChild(overlay);

  // Load boards from background
  chrome.runtime.sendMessage({ type: 'GET_BOARDS' }, (response: Board[]) => {
    boards = response || [];
    dialogState.boards = boards;

    // Restore last-used board
    chrome.storage.local.get(STORAGE_KEYS.lastUsedBoardId, (result) => {
      const lastId = String(result[STORAGE_KEYS.lastUsedBoardId] ?? '');
      if (lastId && boards.some((b) => b.id === lastId)) {
        selectedBoardId = lastId;
      } else if (boards.length > 0) {
        selectedBoardId = boards[0].id;
      }
      dialogState.rerender();
    });
  });

  // Close on overlay click (outside dialog)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeSaveDialog(shadowRoot);
  });

  // Close on Escape
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeSaveDialog(shadowRoot);
      document.removeEventListener('keydown', onKeyDown);
    }
  };
  document.addEventListener('keydown', onKeyDown);
}

export function closeSaveDialog(shadowRoot: ShadowRoot) {
  const existing = shadowRoot.querySelector('.pb-overlay');
  if (existing) existing.remove();
}

function buildDialogHTML(
  boards: Board[],
  selectedBoardId: string,
  showNewBoardForm: boolean,
  selectedColor: string
): string {
  const boardOptions = boards
    .map((b) => `<option value="${b.id}" ${b.id === selectedBoardId ? 'selected' : ''}>${b.name}</option>`)
    .join('');

  const colorDots = DEFAULT_BOARD_COLORS
    .map((c) => `<span class="pb-color-dot ${c === selectedColor ? 'pb-color-dot--selected' : ''}" data-color="${c}" style="background:${c}"></span>`)
    .join('');

  const newBoardSection = showNewBoardForm
    ? `<div class="pb-new-board-form">
        <input class="pb-input" id="pb-new-board-name" placeholder="Board name" autofocus />
      </div>
      <div class="pb-color-picker">${colorDots}</div>`
    : '';

  return `
    <div class="pb-dialog-header">
      <span class="pb-dialog-title">Save to Pinboard</span>
      <button class="pb-close-btn" id="pb-close">&times;</button>
    </div>

    <div class="pb-field">
      <label class="pb-label">Board</label>
      <select class="pb-select" id="pb-board-select">
        ${boardOptions}
        <option value="__new__">+ New board</option>
      </select>
      ${newBoardSection}
    </div>

    <div class="pb-field">
      <label class="pb-label">Note (optional)</label>
      <input class="pb-input" id="pb-note" placeholder="Why are you saving this?" />
    </div>

    <div class="pb-field">
      <label class="pb-label">Action (optional)</label>
      <div class="pb-action-row">
        <span class="pb-action-icon"></span>
        <input class="pb-input" id="pb-action" placeholder="What's your next step?" />
      </div>
    </div>

    <div class="pb-buttons">
      <button class="pb-btn pb-btn-secondary" id="pb-cancel">Cancel</button>
      <button class="pb-btn pb-btn-primary" id="pb-save">Save</button>
    </div>
  `;
}

interface DialogState {
  data: SaveDialogData;
  boards: Board[];
  getSelectedBoardId: () => string;
  setSelectedBoardId: (id: string) => void;
  getShowNewBoardForm: () => boolean;
  setShowNewBoardForm: (v: boolean) => void;
  getSelectedColor: () => string;
  setSelectedColor: (c: string) => void;
  rerender: () => void;
  onSaved: () => void;
}

function attachDialogListeners(
  dialog: HTMLElement,
  shadowRoot: ShadowRoot,
  state: DialogState
) {
  const closeBtn = dialog.querySelector('#pb-close');
  const cancelBtn = dialog.querySelector('#pb-cancel');
  const saveBtn = dialog.querySelector('#pb-save');
  const boardSelect = dialog.querySelector('#pb-board-select') as HTMLSelectElement | null;

  closeBtn?.addEventListener('click', () => closeSaveDialog(shadowRoot));
  cancelBtn?.addEventListener('click', () => closeSaveDialog(shadowRoot));

  boardSelect?.addEventListener('change', () => {
    if (boardSelect.value === '__new__') {
      state.setShowNewBoardForm(true);
      state.rerender();
    } else {
      state.setSelectedBoardId(boardSelect.value);
      state.setShowNewBoardForm(false);
    }
  });

  // Color picker
  const colorDots = dialog.querySelectorAll('.pb-color-dot');
  colorDots.forEach((dot) => {
    dot.addEventListener('click', () => {
      state.setSelectedColor((dot as HTMLElement).dataset.color || DEFAULT_BOARD_COLORS[0]);
      state.rerender();
    });
  });

  saveBtn?.addEventListener('click', async () => {
    try {
      let boardId = state.getSelectedBoardId();

      // Create new board if needed
      if (state.getShowNewBoardForm()) {
        const nameInput = dialog.querySelector('#pb-new-board-name') as HTMLInputElement | null;
        const boardName = nameInput?.value.trim();
        if (!boardName) {
          nameInput?.focus();
          return;
        }
        const newBoard = await chrome.runtime.sendMessage({
          type: 'CREATE_BOARD',
          payload: { name: boardName, color: state.getSelectedColor() },
        }) as Board;
        boardId = newBoard.id;
        state.boards.push(newBoard);
      }

      if (!boardId) return;

      const noteInput = dialog.querySelector('#pb-note') as HTMLInputElement | null;
      const actionInput = dialog.querySelector('#pb-action') as HTMLInputElement | null;
      const note = noteInput?.value.trim() || undefined;
      const actionText = actionInput?.value.trim();

      const payload: SaveItemPayload = {
        content: state.data.content,
        contentPlain: state.data.contentPlain,
        promptContext: state.data.promptContext,
        note,
        action: actionText ? { text: actionText, completed: false } : undefined,
        source: {
          platform: state.data.platform,
          url: window.location.href,
          conversationTitle: state.data.conversationTitle,
          savedAt: Date.now(),
        },
        boardId,
        tags: [],
      };

      await chrome.runtime.sendMessage({ type: 'SAVE_ITEM', payload });

      // Remember last-used board
      chrome.storage.local.set({ [STORAGE_KEYS.lastUsedBoardId]: boardId });

      closeSaveDialog(shadowRoot);
      showToast(shadowRoot, 'Saved!');
      state.onSaved();
    } catch (err) {
      console.error('[Pinboard] Save failed:', err);
    }
  });

  // Enter to save from any input (except new board name, where Enter creates the board)
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !(e.target as HTMLElement)?.matches('#pb-new-board-name')) {
      saveBtn?.dispatchEvent(new MouseEvent('click'));
    }
  });
}

function showToast(shadowRoot: ShadowRoot, message: string) {
  const toast = document.createElement('div');
  toast.className = 'pb-toast';
  toast.textContent = message;
  shadowRoot.appendChild(toast);
  setTimeout(() => toast.remove(), 1500);
}
