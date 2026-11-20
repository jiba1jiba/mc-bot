export const isValidNick = (nick) => /^[A-Za-z0-9_]{3,16}$/.test(String(nick ?? ''));

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const chunks = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export const truncate = (str, max = 200) => {
  const s = String(str ?? '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

export const stripMinecraftColors = (str) =>
  String(str ?? '').replace(/§[0-9a-fk-orx]/gi, '');

export function formatReason(reason) {
  if (reason === undefined || reason === null) return 'неизвестно';

  let raw;
  if (typeof reason === 'string') {
    raw = reason;
  } else {
    try {
      const text = reason.toString();
      raw = text && text !== '[object Object]' ? text : JSON.stringify(reason);
    } catch {
      raw = 'неизвестно';
    }
  }

  raw = stripMinecraftColors(raw).trim();

  // Kick reasons often arrive as a JSON-encoded string: "\"You are whitelisted\""
  if (raw.startsWith('"') && raw.endsWith('"')) {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'string') return parsed;
    } catch {
      /* ignore */
    }
  }

  // …or as a chat component: {"text":"..."} / {"translate":"..."}
  if (raw.startsWith('{') || raw.startsWith('[')) {
    try {
      const flat = flattenChat(JSON.parse(raw)).trim();
      if (flat) return flat;
    } catch {
      /* ignore */
    }
  }

  return truncate(raw, 300);
}

function flattenChat(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(flattenChat).join('');
  let out = '';
  if (node.text) out += node.text;
  if (node.translate) out += node.translate;
  if (Array.isArray(node.with)) out += node.with.map(flattenChat).join('');
  if (Array.isArray(node.extra)) out += node.extra.map(flattenChat).join('');
  return out;
}

export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  const parts = [];
  if (days) parts.push(`${days}д`);
  if (hours) parts.push(`${hours}ч`);
  if (minutes && !days) parts.push(`${minutes}м`);
  if (!days && !hours) parts.push(`${seconds}с`);
  return parts.join(' ');
}
