export async function ensureModelViewer() {
  // already registered?
  if (typeof window !== 'undefined' && customElements.get('model-viewer')) return;

  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.type = 'module';
    // decoupled from our bundle, no peer-dep conflicts
    s.src = 'https://unpkg.com/@google/model-viewer@4.1.0/dist/model-viewer.min.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load @google/model-viewer'));
    document.head.appendChild(s);
  });
}
