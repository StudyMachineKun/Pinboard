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
  overlay.className = 'pinai-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'pinai-dialog';

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
  let newBoardName = '';
  let noteValue = '';
  let actionValue = '';

  const dialogState: DialogState = {
    data,
    boards,
    getSelectedBoardId: () => selectedBoardId,
    setSelectedBoardId: (id: string) => { selectedBoardId = id; },
    getShowNewBoardForm: () => showNewBoardForm,
    setShowNewBoardForm: (v: boolean) => { showNewBoardForm = v; },
    getSelectedColor: () => selectedColor,
    setSelectedColor: (c: string) => { selectedColor = c; },
    getNewBoardName: () => newBoardName,
    setNewBoardName: (n: string) => { newBoardName = n; },
    getNoteValue: () => noteValue,
    setNoteValue: (n: string) => { noteValue = n; },
    getActionValue: () => actionValue,
    setActionValue: (a: string) => { actionValue = a; },
    rerender: () => {
      // Preserve input values before rebuilding
      captureInputValues(dialog, dialogState);
      dialog.innerHTML = buildDialogHTML(boards, selectedBoardId, showNewBoardForm, selectedColor, newBoardName, noteValue, actionValue);
      attachDialogListeners(dialog, shadowRoot, dialogState);
    },
    onSaved,
  };

  dialog.innerHTML = buildDialogHTML(boards, selectedBoardId, showNewBoardForm, selectedColor, newBoardName, noteValue, actionValue);
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
  const existing = shadowRoot.querySelector('.pinai-overlay');
  if (existing) existing.remove();
}

/** Capture current input values before a rerender destroys them. */
function captureInputValues(dialog: HTMLElement, state: DialogState) {
  const nameInput = dialog.querySelector('#pinai-new-board-name') as HTMLInputElement | null;
  const noteInput = dialog.querySelector('#pinai-note') as HTMLInputElement | null;
  const actionInput = dialog.querySelector('#pinai-action') as HTMLInputElement | null;
  if (nameInput) state.setNewBoardName(nameInput.value);
  if (noteInput) state.setNoteValue(noteInput.value);
  if (actionInput) state.setActionValue(actionInput.value);
}

function buildDialogHTML(
  boards: Board[],
  selectedBoardId: string,
  showNewBoardForm: boolean,
  selectedColor: string,
  newBoardName: string,
  noteValue: string,
  actionValue: string,
): string {
  const colorDots = DEFAULT_BOARD_COLORS
    .map((c) => `<span class="pinai-color-dot ${c === selectedColor ? 'pinai-color-dot--selected' : ''}" data-color="${c}" style="background:${c}"></span>`)
    .join('');

  // Board field: either a dropdown OR the new board form (not both)
  let boardField: string;
  if (showNewBoardForm) {
    boardField = `
      <div class="pinai-new-board-form">
        <input class="pinai-input" id="pinai-new-board-name" placeholder="Board name" value="${escapeAttr(newBoardName)}" autofocus />
      </div>
      <div class="pinai-color-picker">${colorDots}</div>
      <button class="pinai-btn-link" id="pinai-back-to-boards">Back to boards</button>
    `;
  } else {
    const boardOptions = boards
      .map((b) => `<option value="${b.id}" ${b.id === selectedBoardId ? 'selected' : ''}>${escapeHTML(b.name)}</option>`)
      .join('');
    boardField = `
      <select class="pinai-select" id="pinai-board-select">
        ${boardOptions}
        <option value="__new__">+ New board</option>
      </select>
    `;
  }

  return `
    <div class="pinai-dialog-header">
      <span class="pinai-dialog-title">Save to PinAI</span>
      <button class="pinai-close-btn" id="pinai-close">&times;</button>
    </div>

    <div class="pinai-field">
      <label class="pinai-label">Board</label>
      ${boardField}
    </div>

    <div class="pinai-field">
      <label class="pinai-label">Note (optional)</label>
      <input class="pinai-input" id="pinai-note" placeholder="Why are you saving this?" value="${escapeAttr(noteValue)}" />
    </div>

    <div class="pinai-field">
      <label class="pinai-label">Action (optional)</label>
      <div class="pinai-action-row">
        <span class="pinai-action-icon"></span>
        <input class="pinai-input" id="pinai-action" placeholder="What's your next step?" value="${escapeAttr(actionValue)}" />
      </div>
    </div>

    <div class="pinai-buttons">
      <button class="pinai-btn pinai-btn-secondary" id="pinai-cancel">Cancel</button>
      <button class="pinai-btn pinai-btn-primary" id="pinai-save">Save</button>
    </div>
  `;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHTML(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
  getNewBoardName: () => string;
  setNewBoardName: (n: string) => void;
  getNoteValue: () => string;
  setNoteValue: (n: string) => void;
  getActionValue: () => string;
  setActionValue: (a: string) => void;
  rerender: () => void;
  onSaved: () => void;
}

function attachDialogListeners(
  dialog: HTMLElement,
  shadowRoot: ShadowRoot,
  state: DialogState
) {
  const closeBtn = dialog.querySelector('#pinai-close');
  const cancelBtn = dialog.querySelector('#pinai-cancel');
  const saveBtn = dialog.querySelector('#pinai-save');
  const boardSelect = dialog.querySelector('#pinai-board-select') as HTMLSelectElement | null;
  const backToBoards = dialog.querySelector('#pinai-back-to-boards');

  // Stop keyboard events from reaching the host page (e.g. Claude's chat input)
  dialog.addEventListener('keydown', (e) => e.stopPropagation());
  dialog.addEventListener('keyup', (e) => e.stopPropagation());
  dialog.addEventListener('keypress', (e) => e.stopPropagation());

  closeBtn?.addEventListener('click', () => closeSaveDialog(shadowRoot));
  cancelBtn?.addEventListener('click', () => closeSaveDialog(shadowRoot));

  boardSelect?.addEventListener('change', () => {
    if (boardSelect.value === '__new__') {
      state.setShowNewBoardForm(true);
      state.rerender();
    } else {
      state.setSelectedBoardId(boardSelect.value);
    }
  });

  // "Back to boards" link in new board form
  backToBoards?.addEventListener('click', () => {
    state.setShowNewBoardForm(false);
    state.setNewBoardName('');
    state.rerender();
  });

  // Color picker
  const colorDots = dialog.querySelectorAll('.pinai-color-dot');
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
        const nameInput = dialog.querySelector('#pinai-new-board-name') as HTMLInputElement | null;
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

      const noteInput = dialog.querySelector('#pinai-note') as HTMLInputElement | null;
      const actionInput = dialog.querySelector('#pinai-action') as HTMLInputElement | null;
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
      console.error('[PinAI] Save failed:', err);
    }
  });

  // Enter to save from any input (except new board name, where Enter creates the board)
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !(e.target as HTMLElement)?.matches('#pinai-new-board-name')) {
      saveBtn?.dispatchEvent(new MouseEvent('click'));
    }
  });
}

function showToast(shadowRoot: ShadowRoot, message: string) {
  const toast = document.createElement('div');
  toast.className = 'pinai-toast';
  toast.textContent = message;
  shadowRoot.appendChild(toast);
  setTimeout(() => toast.remove(), 1500);
}
