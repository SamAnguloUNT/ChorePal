// When is a chore due? Pure date helpers shared by the parent and child screens.
//
// A chore has a `deadline` ("YYYY-MM-DD"). For a one-time chore that is the day it is due.
// For a recurring chore it is the START day, and `repeat` says how it comes back:
//   repeat: 'none' | 'daily' | 'weekly'
//   repeatDays: [0..6]   (weekly only; 0 = Sunday)
// A recurring chore stays ONE document. Each time the child does it, the submission records
// the day it was for (`forDate`), so "done today" never carries over to tomorrow.

export type RepeatMode = 'none' | 'daily' | 'weekly';

export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// How many past days the child's "Missed" section looks back.
export const MISSED_LOOKBACK_DAYS = 7;

export const toDateStr = (d: Date) => {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

export const parseDateStr = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (s: string, n: number) => {
  const d = parseDateStr(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
};

export const todayStr = () => toDateStr(new Date());

export const hasDate = (c: any) => typeof c?.deadline === 'string' && DATE_RE.test(c.deadline);

// Older chores only had `repeatable: true`. Treat those as daily.
export function getRepeat(c: any): RepeatMode {
  if (c?.repeat === 'daily' || c?.repeat === 'weekly') return c.repeat;
  if (c?.repeat === 'none') return 'none';
  return c?.repeatable ? 'daily' : 'none';
}

export const isRecurring = (c: any) => getRepeat(c) !== 'none';

export function getRepeatDays(c: any): number[] {
  const days = Array.isArray(c?.repeatDays) ? c.repeatDays.filter((n: any) => Number.isInteger(n) && n >= 0 && n <= 6) : [];
  return days;
}

// Is the chore due on this exact day?
export function isDueOn(c: any, dateStr: string): boolean {
  const mode = getRepeat(c);
  if (mode === 'none') return hasDate(c) && c.deadline === dateStr;
  // Recurring: starts on its start day (or right away if it has none)
  if (hasDate(c) && dateStr < c.deadline) return false;
  if (mode === 'daily') return true;
  const days = getRepeatDays(c);
  if (days.length === 0) return true;
  return days.includes(parseDateStr(dateStr).getDay());
}

// One-time chore whose day has passed.
export const isPastDue = (c: any, today = todayStr()) =>
  getRepeat(c) === 'none' && hasDate(c) && c.deadline < today;

// "Daily", "Mon, Wed, Fri", "Weekdays"...
export function describeRepeat(c: any): string {
  const mode = getRepeat(c);
  if (mode === 'daily') return 'Every day';
  if (mode === 'weekly') {
    const days = [...getRepeatDays(c)].sort();
    if (days.length === 0 || days.length === 7) return 'Every day';
    if (days.join(',') === '1,2,3,4,5') return 'Weekdays';
    if (days.join(',') === '0,6') return 'Weekends';
    return days.map(d => DAY_SHORT[d]).join(', ');
  }
  return '';
}

// The day a submission counts for. Old submissions have no forDate: use the day they were sent.
export function submissionDay(s: any): string {
  if (typeof s?.forDate === 'string' && DATE_RE.test(s.forDate)) return s.forDate;
  const t = s?.submittedAt;
  const d = t?.toDate ? t.toDate() : t instanceof Date ? t : null;
  return d ? toDateStr(d) : '';
}

export const submissionMs = (s: any) => {
  const t = s?.submittedAt;
  return t?.toDate ? t.toDate().getTime() : t instanceof Date ? t.getTime() : 0;
};

// The submissions that count for a chore on a given day. One-time chores: all of them.
// Recurring chores: only the ones for that day. Newest first.
export function submissionsFor(c: any, subs: any[], dateStr: string) {
  const mine = subs.filter(s => s.choreId === c.id);
  const relevant = isRecurring(c) ? mine.filter(s => submissionDay(s) === dateStr) : mine;
  return relevant.sort((a, b) => submissionMs(b) - submissionMs(a));
}

// todo | submitted (waiting for parent) | approved | rejected
export function statusFor(c: any, subs: any[], dateStr: string): 'todo' | 'submitted' | 'approved' | 'rejected' {
  const list = submissionsFor(c, subs, dateStr);
  if (list.some(s => s.status === 'approved')) return 'approved';
  if (list.some(s => s.status === 'pending')) return 'submitted';
  if (list[0]?.status === 'rejected') return 'rejected';
  return 'todo';
}
