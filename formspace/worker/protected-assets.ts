/** Also cover encoded/dot-segment aliases before the static asset binding is used. */
export function isProtectedPreviewPath(path: string) {
  let decoded = path;
  for (let count = 0; count < 3; count++) {
    try { const next = decodeURIComponent(decoded); if (next === decoded) break; decoded = next; } catch { break; }
  }
  const normalized = new URL('https://assets.local/' + decoded.replace(/\\/g, '/').replace(/^\/+/, '')).pathname;
  return normalized === '/protected-previews' || normalized.startsWith('/protected-previews/');
}
