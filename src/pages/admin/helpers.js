/* Admin পেইজের ধ্রুবক ও বিশুদ্ধ (UI-মুক্ত) সহায়ক ফাংশন: GitHub Actions workflow, ছবি গণনা, রিভিউ বডি ইত্যাদি। */
import App from '../../lib/common.js';

const { enc } = App;

export const PM = { bkash: 'বিকাশ', nagad: 'নগদ' };
export const DEF = { github_username: 'SunniPedia', repo_name: 'pdftojpg', pages_dir: 'pages', texts_dir: 'texts', proof_file: 'proofed.json', proof_dir: 'proofed' };
export const SQLHINT = 'Supabase SQL Editor-এ supabase_v2.sql চালান';
export const STB = { pending: ['রিভিউ বাকি', 'warn'], approved: ['অনুমোদিত', 'ok'], correction: ['সংশোধন দরকার', 'bad'] };
export const TKST = { open: ['খোলা', 'ok'], pending: ['পেন্ডিং', 'warn'], closed: ['বন্ধ', 'bad'] };
export const ACT = {
  login: 'লগইন', logout: 'লগআউট', signup: 'নতুন অ্যাকাউন্ট', proof: 'প্রুফড চিহ্ন', unproof: 'প্রুফড তোলা', resubmit: 'সংশোধন করে আবার জমা',
  payment_request: 'পেমেন্ট রিকোয়েস্ট', payment_number_changed: 'পেমেন্ট নাম্বার বদল', ticket_open: 'টিকেট খোলা',
  admin_approve: '[অ্যাডমিন] পেইজ অনুমোদন', admin_correction: '[অ্যাডমিন] সংশোধন দরকার', admin_pay: '[অ্যাডমিন] পেমেন্ট পরিশোধ', admin_reject: '[অ্যাডমিন] পেমেন্ট বাতিল',
  admin_block: '[অ্যাডমিন] ব্লক', admin_unblock: '[অ্যাডমিন] আনব্লক', admin_notice: '[অ্যাডমিন] নোটিশ', admin_rate: '[অ্যাডমিন] রেট বদল', admin_pin: '[অ্যাডমিন] PIN',
  admin_device: '[অ্যাডমিন] ডিভাইস রিসেট', admin_delete_user: '[অ্যাডমিন] ইউজার ডিলিট', admin_settings: '[অ্যাডমিন] সেটিংস'
};

/* ---- ছোট ইউটিলিটি ---- */
export const tm = (t) => (t ? new Date(t).getTime() : 0);
export const T0 = () => App.startOfDay().getTime();
export const D7 = () => { const d = App.startOfDay(); d.setDate(d.getDate() - 6); return d.getTime(); };
export const sl = (v) => (v || '').trim().replace(/^\/+|\/+$/g, '');
export const rateTxt = (r) => Number(r).toLocaleString('bn-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ৳';
export const blkErr = (x) => (/is_blocked|blocked_reason/i.test(x.message) ? 'ব্লক কলাম নেই — ' + SQLHINT : x.message);
export const noTbl = (e) => /PGRST205|42P01|PGRST200|404|does not exist/i.test((e && e.message) || '');
export const rvKey = (r) => String(r.book_id) + '\u0001' + r.stem;
export const status = (p) => p.review_status || 'pending';
export const warnLimits = (S) => ({ wp: Number(S.warn_pct != null ? S.warn_pct : 20), wm: Number(S.warn_min != null ? S.warn_min : 5) });

/* বইয়ের (বা সেটিংসের/ডিফল্টের) মান */
export const eff = (S, b, k) => b[k] || S[k] || DEF[k] || '';
export const prefixOf = (b) => sl(b.folder || b.name);
export const outDirOf = (S, b) => prefixOf(b) + '_' + (S.pages_dir || DEF.pages_dir);

/* রিভিউ: অনুমোদন/সংশোধনের সময় পেইজে যা লেখা হয় */
export const bodyFor = (S, st, note, bk) => (st === 'approved'
  ? { review_status: 'approved', review_note: null, reviewed_at: new Date().toISOString(), rate: App.rateOf(bk, S) }
  : { review_status: 'correction', review_note: note || null, reviewed_at: new Date().toISOString(), rate: null });

/* ---- ব্রাউজারে সংরক্ষিত পছন্দ (workflow ফাইল, split, সর্বশেষ রান) ---- */
export const WF_DEF = 'ultimatepdftojpg(2).yml';
const WK = 'kp_wf_file_v1', SK2 = 'kp_split_pref_v1', RK = 'kp_bookrun_v1';
export const wfFile = () => { let v = ''; try { v = (localStorage.getItem(WK) || '').trim(); } catch (e) { /* ignore */ } return v || WF_DEF; };
export const saveWfFile = (v) => { try { const t = v.trim(); if (t) localStorage.setItem(WK, t); else localStorage.removeItem(WK); } catch (e) { /* ignore */ } };
export const getSplitPref = () => { try { return localStorage.getItem(SK2) !== '0'; } catch (e) { return true; } };
export const setSplitPref = (v) => { try { localStorage.setItem(SK2, v ? '1' : '0'); } catch (e) { /* ignore */ } };
export const readRunsLS = () => { try { return JSON.parse(localStorage.getItem(RK) || '{}') || {}; } catch (e) { return {}; } };
export const writeRunsLS = (o) => { try { localStorage.setItem(RK, JSON.stringify(o)); } catch (e) { /* ignore */ } };

/* ---- ছবি তৈরির workflow (GitHub Actions) ----
   নতুন কিতাবে নাম ও পিডিএফ লিংক দিয়ে সংরক্ষণ করলে workflow_dispatch দিয়ে নির্দিষ্ট workflow চলে।
   ইনপুট অটো: source=download, download_url=পিডিএফ লিংক, output_dir=<প্রিফিক্স>_<pages>, split=টিক অনুযায়ী। */
export const ghTok = (S) => (S.github_token || '').trim();
export const pdfLinks = (u) => (u || '').split(/[,\s]+/).filter(Boolean);

export function gh(S, b, path, opt) {
  const repo = eff(S, b, 'github_username') + '/' + eff(S, b, 'repo_name');
  return fetch('https://api.github.com/repos/' + repo + path, {
    cache: 'no-store', ...(opt || {}),
    headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(ghTok(S) ? { Authorization: 'Bearer ' + ghTok(S) } : {}), ...((opt && opt.headers) || {}) }
  });
}
export async function ghErr(r) {
  let m = ''; try { m = (await r.json()).message || ''; } catch (e) { /* ignore */ }
  const h = { 401: ' (টোকেন ভুল বা মেয়াদ শেষ)', 403: ' (টোকেনে Actions: Read and write / workflow অনুমতি নেই)', 404: ' (রিপো বা workflow ফাইলের নাম ভুল, অথবা টোকেনের ওই রিপোতে অ্যাক্সেস নেই)', 422: ' (workflow-এ workflow_dispatch নেই বা ব্রাঞ্চ/ইনপুট ভুল)' }[r.status] || '';
  return r.status + ': ' + m + h;
}
async function branchOf(S, b) {
  let ref = eff(S, b, 'branch');
  if (!ref) { const ri = await gh(S, b, ''); if (!ri.ok) throw new Error(await ghErr(ri)); ref = (await ri.json()).default_branch || 'main'; }
  return ref;
}
/* workflow চালু করে; ফেরত: {id, at} (id না এলে পরে রানের তালিকা থেকে খুঁজে নেওয়া হবে) */
export async function dispatchBook(S, b, split) {
  if (!ghTok(S)) throw new Error('GitHub Token দেওয়া নেই — সেটিংস ট্যাবে টোকেন দিন');
  const links = pdfLinks(b.pdf_url);
  if (!links.length) throw new Error('পিডিএফ লিংক দিন');
  if (links.length > 1) throw new Error('একটি কিতাবে একটাই পিডিএফ লিংক দিন');
  const ref = await branchOf(S, b);
  const at = new Date().toISOString();
  const r = await gh(S, b, '/actions/workflows/' + enc(wfFile()) + '/dispatches', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref, return_run_details: true, inputs: { split: String(!!split), source: 'download', folder_path: 'pdf', pdf_file: '', download_url: links[0], output_dir: outDirOf(S, b), clean_output: 'false', push_batch: '50' } })
  });
  if (!r.ok) throw new Error(await ghErr(r));
  let id = null;
  try {
    const j = await r.json();
    id = j.workflow_run_id || j.run_id || null;
    if (!id) { const m = String(j.run_url || j.html_url || '').match(/runs\/(\d+)/); if (m) id = m[1]; }
  } catch (e) { /* 204 (বডি নেই) হলে id পরে খোঁজা হবে */ }
  return { id: id ? String(id) : null, at };
}
/* রানের বর্তমান অবস্থা; dispatch আইডি না থাকলে ওই সময়ের পরের সবচেয়ে পুরনো workflow_dispatch রান খোঁজে (পেলে onId(id) ডাকে) */
export async function fetchRunState(S, b, info, onId) {
  let id = info.id;
  if (!id) {
    const r = await gh(S, b, '/actions/workflows/' + enc(wfFile()) + '/runs?event=workflow_dispatch&per_page=15');
    if (!r.ok) throw new Error(await ghErr(r));
    const t = new Date(info.at).getTime() - 60000;
    const cand = ((await r.json()).workflow_runs || []).filter((x) => new Date(x.created_at).getTime() >= t).sort((x, y) => new Date(x.created_at) - new Date(y.created_at))[0];
    if (!cand) return { status: 'queued' };
    id = String(cand.id); onId(id);
  }
  const r = await gh(S, b, '/actions/runs/' + id);
  if (!r.ok) throw new Error(await ghErr(r));
  const run = await r.json(), st = { status: run.status, conclusion: run.conclusion, url: run.html_url };
  if (run.status !== 'completed') {
    try {
      const rj = await gh(S, b, '/actions/runs/' + id + '/jobs');
      if (rj.ok) {
        const steps = ((await rj.json()).jobs || []).flatMap((j) => j.steps || []);
        st.total = steps.length; st.done = steps.filter((x) => x.status === 'completed').length;
        const cur = steps.find((x) => x.status === 'in_progress'); st.step = cur ? cur.name : '';
      }
    } catch (e) { /* ignore */ }
  }
  return st;
}
/* GitHub-এ ছবির ফোল্ডারের ছবির সংখ্যা */
export async function countPages(S, b) {
  const ref = await branchOf(S, b);
  const r = await gh(S, b, '/git/trees/' + enc(ref) + '?recursive=1'); if (!r.ok) throw new Error(await ghErr(r));
  const j = await r.json(), dir = outDirOf(S, b) + '/';
  return { n: (j.tree || []).filter((e) => e.type === 'blob' && e.path.startsWith(dir) && /\.(jpe?g|png|webp)$/i.test(e.path)).length, truncated: !!j.truncated, dir };
}
export const isActiveRun = (s) => !!s && ['queued', 'in_progress', 'waiting', 'pending'].includes(s.status);

/* নোটিশ পাঠানো */
export const sendNotice = (o) => App.sb.post('notices', { user_id: o.user_id ? String(o.user_id) : null, title: o.title, body: o.body || null, kind: o.kind || 'notice' });
