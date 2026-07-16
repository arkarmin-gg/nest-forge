export function getKeyFromPresignedUrl(
  url: string,
  bucketName: string,
): string | null {
  try {
    if (!url || url.trim().length === 0) return null;
    const u = new URL(url);
    const bucket = (bucketName || '').toLowerCase();
    const host = (u.host || '').toLowerCase();
    let pathname = u.pathname || '';
    if (!pathname) return null;
    if (pathname.startsWith('/')) pathname = pathname.slice(1);
    if (pathname.length === 0) return null;
    if (bucket && host.startsWith(`${bucket}.`)) {
      return decodeURIComponent(pathname);
    }
    const parts = pathname.split('/');
    if (bucket && parts[0].toLowerCase() === bucket && parts.length > 1) {
      return decodeURIComponent(parts.slice(1).join('/'));
    }
    return decodeURIComponent(pathname);
  } catch {
    return null;
  }
}
