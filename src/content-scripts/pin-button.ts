/** Pin button SVG icon (pushpin). */
const PIN_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 17v5"/>
  <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1 1 1 0 0 1 1 1z"/>
</svg>`;

const PINNED_CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M20 6 9 17l-5-5"/>
</svg>`;

export interface PinButtonCallbacks {
  onPin: (messageEl: HTMLElement) => void;
}

/**
 * Creates a pin button element to inject into an assistant message.
 * Returns the button element (caller places it in Shadow DOM).
 */
export function createPinButton(
  messageEl: HTMLElement,
  callbacks: PinButtonCallbacks
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'pb-pin-button';
  btn.innerHTML = PIN_ICON_SVG;
  btn.title = 'Save to Pinboard';

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    callbacks.onPin(messageEl);
  });

  return btn;
}

/** Briefly swap pin icon to checkmark, then restore. */
export function flashPinButtonSuccess(btn: HTMLButtonElement) {
  btn.innerHTML = PINNED_CHECK_SVG;
  btn.classList.add('pb-pin-button--saved');
  setTimeout(() => {
    btn.innerHTML = PIN_ICON_SVG;
    btn.classList.remove('pb-pin-button--saved');
  }, 1500);
}
