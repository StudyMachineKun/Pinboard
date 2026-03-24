import cssText from './pinboard-inject.css?inline';

const HOST_ID = 'pinboard-root';

/** Get or create the Shadow DOM host for all Pinboard UI injected into the page. */
export function getShadowRoot(): ShadowRoot {
  let host = document.getElementById(HOST_ID);
  if (host?.shadowRoot) return host.shadowRoot;

  host = document.createElement('div');
  host.id = HOST_ID;
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  // Inject our bundled CSS into the shadow root
  const style = document.createElement('style');
  style.textContent = cssText;
  shadow.appendChild(style);

  return shadow;
}
