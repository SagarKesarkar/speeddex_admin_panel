const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const number = new Intl.NumberFormat();

export const fmtDateTime = (iso: string | null | undefined) => (iso ? dateTime.format(new Date(iso)) : '—');
export const fmtDate = (iso: string | null | undefined) => (iso ? dateOnly.format(new Date(iso)) : '—');
export const fmtNumber = (n: number | null | undefined) => (n == null ? '—' : number.format(n));
export const fmtPercent = (n: number | null | undefined) => (n == null ? '—' : `${Math.round(n * 100)}%`);

export function fmtMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** "3 min ago", "2 h ago", "4 d ago", then the date. */
export function fmtAgo(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)} d ago`;
  return fmtDate(iso);
}

/** Code-style values ("review_required", "provider_http_429") as words. */
const LABELS: Record<string, string> = {
  added_to_garage: 'In garage',
  review_required: 'Needs review',
  screen_or_print: 'Screen or print',
  no_vehicle_found: 'No vehicle found',
  not_in_catalog: 'Not in catalogue',
  repeated_image: 'Repeated photo',
  spoof_suspected: 'Spoof suspected',
  processing_timeout: 'Timed out',
  provider_http_429: 'AI daily limit reached',
  provider_timeout: 'AI timed out',
  provider_network: 'AI unreachable',
  recognition_unavailable: 'AI unavailable',
  recognition_not_configured: 'AI not configured',
  low_confidence: 'Low confidence',
  user_report: 'Reported by user',
  moderator_confirmed: 'Confirmed by moderator',
  moderator_rejected: 'Rejected by moderator',
  wrong_identification: 'Wrong identification',
  AD_WATCH: 'Watch an ad',
  PURCHASE: 'Purchase',
};

export function humanize(code: string | null | undefined) {
  if (!code) return '—';
  if (LABELS[code]) return LABELS[code];
  const http = /^provider_http_(\d+)$/.exec(code);
  if (http) return http[1] === '503' ? 'AI overloaded' : `AI error ${http[1]}`;
  const words = (code === code.toUpperCase() ? code.toLowerCase() : code).replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const BODY: Record<string, string> = { suv: 'SUV', hatch: 'Hatchback', van: 'Van / MPV' };
export const bodyLabel = (s: string) => BODY[s] ?? cap(s);

/** A random key for one admin action, so a retried request isn't applied twice. */
export const idempotencyKey = () => crypto.randomUUID();
