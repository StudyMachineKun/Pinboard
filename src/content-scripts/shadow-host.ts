import cssText from './pinboard-inject.css?inline';

const HOST_ID = 'pinai-root';

/** Check if the extension context is still valid (not invalidated by reload). */
export function isContextValid(): boolean {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

/** Get or create the Shadow DOM host for all PinAI UI injected into the page. */
export function getShadowRoot(): ShadowRoot {
  const existing = document.getElementById(HOST_ID);
  if (existing?.shadowRoot) return existing.shadowRoot;

  // Remove stale host element (e.g. from previous extension context)
  existing?.remove();

  const host = document.createElement('div');
  host.id = HOST_ID;
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = cssText;
  shadow.appendChild(style);

  return shadow;
}
