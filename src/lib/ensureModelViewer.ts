import bus from "./bus";

const REMOTE_SRC =
  'https://unpkg.com/@google/model-viewer@4.1.0/dist/model-viewer.min.js';
const REMOTE_SRI =
  'sha384-T4vc5AP9W2o3EVVQC6Is5mbKqFE2eysxg1XHwaZLquK0SjtY+4cLHoN3j1mK/MmB';
const LOCAL_SRC = '/vendor/model-viewer.min.js';
const TIMEOUT_MS = 15000;

export async function ensureModelViewer() {
  // already registered?
  if (typeof window !== 'undefined' && customElements.get('model-viewer')) return;

  const load = (src: string, integrity?: string) =>
    new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.type = 'module';
      s.src = src;
      if (integrity) {
        s.integrity = integrity;
        s.crossOrigin = 'anonymous';
      }

      const timer = setTimeout(() => {
        s.remove();
        reject(new Error(`Timeout loading ${src}`));
      }, TIMEOUT_MS);

      s.onload = () => {
        clearTimeout(timer);
        resolve();
      };

      s.onerror = () => {
        clearTimeout(timer);
        reject(new Error(`Failed to load ${src}`));
      };

      document.head.appendChild(s);
    });

  try {
    await load(REMOTE_SRC, REMOTE_SRI);
  } catch (err) {
    const message = 'Falling back to local model-viewer';
    bus.emit?.('toast', { message });
    console.warn(message, err);
    await load(LOCAL_SRC);
  }
}
