/**
 * URL validation + normalization for audit submissions.
 * - https-only (upgrade http → https)
 * - public-ish hosts only (blocks localhost, RFC1918, .local, empty TLDs)
 * - strips trailing slash
 */

export type UrlValidationResult =
  | { ok: true; url: string; hostname: string }
  | { ok: false; error: string };

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^fe80::/i
];

// Own site intentionally NOT blocked — we want to audit parallaxandpixel.com too.
// Private/local hosts are still blocked by PRIVATE_HOST_PATTERNS above.
const BLOCKED_HOSTS = ['localhost'];

export function normalizeAndValidateUrl(raw: string): UrlValidationResult {
  if (!raw || typeof raw !== 'string') {
    return { ok: false, error: 'Enter a URL to audit.' };
  }

  let trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: 'Enter a URL to audit.' };

  // Add https:// if no protocol present
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "That doesn't look like a fetchable URL. Try https://example.com." };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Only http and https URLs are supported.' };
  }

  // Upgrade http to https for the canonical form
  if (parsed.protocol === 'http:') {
    parsed.protocol = 'https:';
  }

  const hostname = parsed.hostname.toLowerCase();

  if (!hostname || !hostname.includes('.')) {
    return { ok: false, error: 'That URL is missing a domain. Try https://example.com.' };
  }

  for (const pat of PRIVATE_HOST_PATTERNS) {
    if (pat.test(hostname)) {
      return { ok: false, error: 'Private and local hostnames are not allowed.' };
    }
  }

  if (BLOCKED_HOSTS.includes(hostname)) {
    return { ok: false, error: 'Pick a different URL // this one is on the blocklist.' };
  }

  // Strip trailing slash on root paths, keep otherwise
  let pathname = parsed.pathname;
  if (pathname === '/' || pathname === '') {
    pathname = '/';
  } else if (pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }

  const normalized = `${parsed.protocol}//${hostname}${pathname}${parsed.search}`;

  return { ok: true, url: normalized, hostname };
}
