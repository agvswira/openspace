const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const toDate = (d) => (d ? new Date(d) : null);

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
export const addDays = (d, n) => new Date(startOfDay(d).getTime() + n * 864e5);
export const sameDay = (a, b) => a && b && startOfDay(a).getTime() === startOfDay(b).getTime();
export const diffDays = (a, b) => Math.round((startOfDay(a) - startOfDay(b)) / 864e5);

export const fmtShort = (d) =>
  d ? `${String(new Date(d).getDate()).padStart(2, '0')} ${MONTHS[new Date(d).getMonth()]}` : '';
export const fmtLong = (d) => (d ? `${fmtShort(d)} ${new Date(d).getFullYear()}` : '');
export const fmtDow = (d) => DAYS[new Date(d).getDay()];
export const monthName = (d) =>
  [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ][d.getMonth()];
export { MONTHS, DAYS };

// Nilai untuk <input type="date">
export function toInputDate(d) {
  if (!d) return '';
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
export function fromInputDate(v) {
  if (!v) return null;
  const [y, m, d] = v.split('-').map(Number);
  return new Date(y, m - 1, d).toISOString();
}

export function relativeDue(d) {
  if (!d) return 'No due date';
  const n = diffDays(d, new Date());
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return '1 day ago';
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

export function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 172800) return 'Yesterday';
  return `${Math.floor(s / 86400)} days ago`;
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Good morning';
  if (h < 15) return 'Good afternoon';
  if (h < 19) return 'Good evening';
  return 'Good night';
}
