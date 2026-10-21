/* Task পেইজের বিশুদ্ধ (UI-মুক্ত) সহায়ক: লক্ষ্য/স্ট্রিক/ব্যাজ, আয়ের টেক্সট, লোকাল-স্টোরেজ কী। Task.logic.js থেকে অপরিবর্তিত হিসাব। */
import App from '../../lib/common.js';

const { bn, toast } = App;

export const PM = { bkash: 'বিকাশ', nagad: 'নগদ' };
export const KIND = { notice: 'ঘোষণা', review: 'রিভিউ', payment: 'পেমেন্ট' };
export const BADGES = [[3, 'শুরু'], [7, 'এক সপ্তাহ'], [15, 'পনেরো দিন'], [30, 'এক মাস'], [60, 'দুই মাস'], [100, 'শতক']];

export const rateTxt = (r) => Number(r).toLocaleString('bn-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ৳';
export const minPayout = (S) => { const m = Number(S.min_payout); return Number.isFinite(m) && S.min_payout != null ? m : App.DEF_MIN; };

/* ---- localStorage কী (প্রতি ইউজারের আলাদা) ---- */
export const resumeKey = (id) => 'kp_resume_v1_' + id;
export const goalKey = (id) => 'kp_goal_v1_' + id;
export const noticeKey = (id) => 'kp_notice_seen_' + id;
export const guideKey = (id) => 'kp_guide_v2_' + id;

export function getResume(id) {
  try { const r = JSON.parse(localStorage.getItem(resumeKey(id)) || 'null'); return r && r.b != null ? r : null; } catch (e) { return null; }
}
export function readGoal(id) {
  try { const g = Math.floor(Number(localStorage.getItem(goalKey(id)))); return g > 0 ? g : 20; } catch (e) { return 20; }
}
export function readSeen(id) {
  try { return new Set(JSON.parse(localStorage.getItem(noticeKey(id)) || '[]').map(String)); } catch (e) { return new Set(); }
}
export function writeSeen(id, s) {
  try { localStorage.setItem(noticeKey(id), JSON.stringify([...s].slice(-300))); } catch (e) { /* ignore */ }
}

/* ---- টানা দিন (স্ট্রিক) ---- */
export const dayKey = (t) => { const d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
export function streakInfo(proofs) {
  const days = new Set(), t0 = App.startOfDay().getTime(); let today = 0;
  proofs.forEach((p) => { const t = p.created_at ? new Date(p.created_at).getTime() : 0; if (!t) return; days.add(dayKey(t)); if (t >= t0) today++; });
  const nowK = dayKey(Date.now()), doneToday = days.has(nowK);
  let cur = 0; const d = new Date(); d.setHours(12, 0, 0, 0); if (!doneToday) d.setDate(d.getDate() - 1);
  while (days.has(dayKey(d))) { cur++; d.setDate(d.getDate() - 1); }
  const nums = [...days].map((k) => { const [y, m, dd] = k.split('-').map(Number); return Date.UTC(y, m - 1, dd) / 864e5; }).sort((a, b) => a - b);
  let best = 0, run = 0, prev = null; nums.forEach((n) => { run = (prev != null && n === prev + 1) ? run + 1 : 1; prev = n; if (run > best) best = run; });
  return { today, cur, best, doneToday };
}

/* লক্ষ্য পূরণ হলে দিনে একবার বার্তা */
export function goalToast(proofs, goal, userId) {
  if (!proofs.length || proofs[0].created_at === undefined) return;
  const s = streakInfo(proofs), k = 'kp_goalhit_v1_' + userId + '_' + dayKey(Date.now());
  if (s.today >= goal) {
    try { if (localStorage.getItem(k)) return; localStorage.setItem(k, '1'); } catch (e) { /* ignore */ }
    toast('মাশাআল্লাহ! আজকের লক্ষ্য পূরণ হয়েছে (' + bn(s.today) + '/' + bn(goal) + ' পেইজ)');
  }
}

/* "চালিয়ে যান": এই ডিভাইসে রেকর্ড থাকলে সেই কিতাব/পেইজ; না থাকলে সর্বশেষ প্রুফড কিতাব */
export function resumeTarget(resume, booksById, proofs) {
  if (resume && booksById[String(resume.b)]) return { book: booksById[String(resume.b)], bid: resume.b, stem: resume.s || '' };
  if (proofs.length && proofs[0].created_at && booksById[String(proofs[0].book_id)]) return { book: booksById[String(proofs[0].book_id)], bid: proofs[0].book_id, stem: '' };
  return null;
}
