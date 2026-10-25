/* task.html → রিয়্যাক্ট (state/hooks)। কিতাবের তালিকা + অগ্রগতি, দৈনিক লক্ষ্য/টানা দিন/চালিয়ে যান, পেমেন্ট ও আয়ের পূর্বাভাস,
   লিডারবোর্ড, নোটিশ ডায়ালগ ও প্রথমবারের গাইড — সব আগের মতো। আগের Task.logic.js আর লাগে না (runLegacy ছাড়াই চলে)।
   ছোট অংশগুলো ./task/ ফোল্ডারে: Dashboard, BookGrid, PayPane, RankPane, Dialogs, GuideDialog (+ গাইডের অ্যানিমেশন)। */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageShell from '../lib/PageShell.jsx';
import Icon, { Logo } from '../components/Icon.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import App from '../lib/common.js';
import { go } from '../lib/nav.js';
import usePinNav from '../lib/usePinNav.js';
import css from './Task.css?inline';
import Dashboard from './task/Dashboard.jsx';
import BookGrid from './task/BookGrid.jsx';
import PayPane from './task/PayPane.jsx';
import RankPane from './task/RankPane.jsx';
import GuideDialog from './task/GuideDialog.jsx';
import { GoalDialog, NoticeDialog, RequestDialog } from './task/Dialogs.jsx';
import { PM, getResume, goalKey, goalToast, guideKey, minPayout, readGoal, readSeen, resumeTarget, writeSeen } from './task/helpers.js';

const { toast, bn, enc } = App;
const TITLES = { task: 'টাস্কের তালিকা', pay: 'পেমেন্ট', rank: 'লিডারবোর্ড' };
const NAV = [['task', 'nTask', 'tasks', 'টাস্ক'], ['pay', 'nPay', 'wallet', 'পেমেন্ট'], ['rank', 'nRank', 'trophy', 'র‍্যাংক']];

const byId = (books) => Object.fromEntries(books.map((b) => [String(b.id), b]));
async function fetchMine(uid) {
  try { return await App.getAll('page_proofs?user_id=eq.' + enc(uid) + '&select=book_id,stem,review_status,review_note,rate,created_at,reviewed_at&order=created_at.desc,book_id.asc,stem.asc'); }
  catch (e) { return await App.getAll('page_proofs?user_id=eq.' + enc(uid) + '&select=book_id,stem&order=book_id.asc,stem.asc'); }
}

export default function Task() {
  /* ---------- স্টেট ---------- */
  const [me, setMe] = useState(null);
  const [theme, setTheme] = useState(App.theme.get());
  const [tab, setTab] = useState('task');
  const [query, setQuery] = useState('');
  const [books, setBooks] = useState([]);
  const [booksStatus, setBooksStatus] = useState('loading');   // loading | ready | error
  const [spinning, setSpinning] = useState(false);
  const [bookCounts, setBookCounts] = useState({});
  const [myCount, setMyCount] = useState(null);
  const [fin, setFin] = useState({ S: {}, proofs: [], pays: [], ready: false });   // সেটিংস + আমার প্রুফড পেইজ + পেমেন্ট
  const [reqBusy, setReqBusy] = useState(false);
  const [goal, setGoal] = useState(20);
  const [glVal, setGlVal] = useState(''), [glErr, setGlErr] = useState('');
  const [rq, setRq] = useState({ avail: '', min: '', pmLabel: 'পেমেন্ট নাম্বার', number: '', max: 0 });
  const [rqAmt, setRqAmt] = useState(''), [rqErr, setRqErr] = useState(''), [rqSending, setRqSending] = useState(false);
  const [rankP, setRankP] = useState('day');
  const [rank, setRank] = useState({ loading: false, data: null, error: '' });
  const [badge, setBadge] = useState(0);
  const [nList, setNList] = useState([]);
  const [nIdx, setNIdx] = useState(0);

  /* ---------- রেফ (অ্যাসিঙ্ক লোডারে সবসময় সর্বশেষ মান লাগে) ---------- */
  const meRef = useRef(null), booksRef = useRef([]), finRef = useRef(fin), goalRef = useRef(20);
  const busy = useRef({ cnt: false, money: false });
  const rankCache = useRef({}), rankReq = useRef(0), rankPRef = useRef('day');
  const allNotices = useRef([]), nListRef = useRef([]); nListRef.current = nList;
  const nav = useRef(null), glDlg = useRef(null), rqDlg = useRef(null), nDlg = useRef(null), guide = useRef(null);
  const lockDlg = useRef(null), lockBusy = useRef(false);            // "কাজ চলছে" ডায়ালগ (অন্য ইউজার কিতাবটি খুলে রাখলে)
  const [lockInfo, setLockInfo] = useState({ name: '', book: '' });
  const hidDlg = useRef(null);                                       // "অ্যাডমিন কিতাবটির এক্সেস সাময়িক বন্ধ রেখেছেন" ডায়ালগ
  const [hiddenInfo, setHiddenInfo] = useState({ book: '' });
  const repin = usePinNav(nav);

  const isAdmin = !!me && App.isAdminPhone(me.phone);
  const booksById = useMemo(() => byId(books), [books]);
  /* অ্যাডমিন যে কিতাব লুকিয়েছে তা তালিকায় দেখাবে না (হিসাবের জন্য booksById-এ সব কিতাব থাকে)।
     নতুন কিতাব তখনই দেখাবে যখন ছবি তৈরি হয়ে পেইজ গণনা সম্পন্ন (total_pages > ০) হয়েছে।
     আগের কিতাব, যেগুলোতে ইতিমধ্যে প্রুফড পেইজ আছে, সেগুলো মোট পেইজ না থাকলেও দেখাবে (যাতে পুরনো কাজ হারিয়ে না যায়)। */
  const shownBooks = useMemo(() => books.filter((b) => !b.hidden && (Number(b.total_pages) > 0 || (bookCounts[String(b.id)] || 0) > 0)), [books, bookCounts]);
  const sum = useMemo(() => (fin.ready ? App.summarize(fin.proofs, booksById, fin.S, fin.pays) : null), [fin, booksById]);
  const rateOf = useCallback((b) => App.rateOf(b, fin.S), [fin.S]);
  const resume = me ? getResume(me.id) : null;   // view.html প্রতিবার পেইজ বদলালে localStorage-এ মনে রাখে; প্রতি রেন্ডারে পড়ি

  /* ---------- আমার সম্পন্ন টাস্ক (শুধু নিজের প্রুফড পেইজ) ---------- */
  const loadCount = useCallback(async () => {
    const u = meRef.current; if (!u || busy.current.cnt) return; busy.current.cnt = true;
    try {
      let n;
      try { // দ্রুত পথ: Supabase ফাংশন (supabase_task_count.sql)
        n = await App.sb.post('rpc/my_proof_count', { p_user: String(u.id) });
        n = Number(Array.isArray(n) ? n[0] : n); if (!Number.isFinite(n)) throw new Error('bad');
      } catch (e) { // ফাংশন না থাকলে সরাসরি গুনে নিন
        n = 0;
        for (let off = 0; ; off += 1000) {
          const r = await App.sb.get('page_proofs?user_id=eq.' + enc(u.id) + '&select=stem&order=stem.asc&limit=1000&offset=' + off);
          n += r.length; if (r.length < 1000) break;
        }
      }
      setMyCount(n);
    } catch (e) { /* টেবিল নেই/নেটওয়ার্ক সমস্যা: আগের সংখ্যাই থাকুক */ }
    finally { busy.current.cnt = false; }
  }, []);

  /* ---------- সেটিংস + আয়ের হিসাব; সর্বশেষ তথ্য রিটার্ন করে (রিকোয়েস্টের আগে তাজা তথ্য লাগে) ---------- */
  const loadMoney = useCallback(async () => {
    const u = meRef.current; if (!u || busy.current.money) return finRef.current; busy.current.money = true;
    try {
      let S = finRef.current.S;
      try { S = (await App.sb.get('app_settings?id=eq.1&select=page_rate,min_payout,warn_pct,warn_min&limit=1'))[0] || {}; } catch (e) { /* আগেরটাই থাকুক */ }
      if (!booksRef.current.length) {
        try { const b = await App.sb.get('books?select=*&order=created_at.desc'); booksRef.current = b; setBooks(b); } catch (e) { /* ignore */ }
      }
      const proofs = await fetchMine(u.id);
      let pays; try { pays = await App.getAll('payments?user_id=eq.' + enc(u.id) + '&order=created_at.desc'); } catch (e) { pays = []; }
      const next = { S, proofs, pays, ready: true };
      finRef.current = next; setFin(next);
      goalToast(proofs, goalRef.current, u.id);
    } catch (e) { /* নেটওয়ার্ক/টেবিল সমস্যা: আগের তথ্য থাকুক */ }
    finally { busy.current.money = false; }
    return finRef.current;
  }, []);

  /* ---------- কিতাব তালিকা + অগ্রগতির বার ---------- */
  const loadCounts = useCallback(async () => {
    try {
      let rows;
      try { rows = await App.sb.post('rpc/book_proof_counts', {}); if (!Array.isArray(rows)) throw new Error('bad'); }
      catch (e) {
        const all = await App.getAll('page_proofs?select=book_id,stem&order=book_id.asc,stem.asc'); const m = {};
        all.forEach((r) => { m[r.book_id] = (m[r.book_id] || 0) + 1; }); rows = Object.entries(m).map(([book_id, n]) => ({ book_id, n }));
      }
      const c = {}; rows.forEach((r) => { c[String(r.book_id)] = Number(r.n) || 0; }); setBookCounts(c);
    } catch (e) { /* টেবিল নেই: বার ছাড়াই চলবে */ }
  }, []);

  const load = useCallback(async () => {
    if (!booksRef.current.length) setBooksStatus('loading'); else setSpinning(true);
    try {
      const b = await App.sb.get('books?select=*&order=created_at.desc');
      booksRef.current = b; setBooks(b); setBooksStatus('ready');
    } catch (e) {
      toast('কিতাব লোড হয়নি: ' + e.message, true);
      if (!booksRef.current.length) setBooksStatus('error');
    } finally { setSpinning(false); }
    loadCounts(); loadMoney();
  }, [loadCounts, loadMoney]);

  /* ---------- লিডারবোর্ড (প্রতি সময়কালে ৬০ সেকেন্ড ক্যাশ) ---------- */
  const loadRank = useCallback(async (period) => {
    if (!meRef.current) return;
    const token = ++rankReq.current;   // দ্রুত ট্যাব বদলালে পুরনো উত্তর নতুনটাকে ঢাকবে না
    setRank((r) => ({ ...r, loading: true }));
    try {
      const since = period === 'day' ? App.startOfDay() : period === 'week' ? (() => { const d = App.startOfDay(); d.setDate(d.getDate() - 6); return d; })() : null;
      const c = rankCache.current[period];
      let rows, names;
      if (c && Date.now() - c.t < 60000) { rows = c.rows; names = c.names; }
      else {
        try { rows = await App.sb.post('rpc/leaderboard', { p_since: since ? since.toISOString() : null }); if (!Array.isArray(rows)) throw new Error('bad'); }
        catch (e) {
          let all; const f = since ? '&created_at=gte.' + enc(since.toISOString()) : '';
          try { all = await App.getAll('page_proofs?select=user_id,review_status,book_id,stem' + f + '&order=user_id.asc,book_id.asc,stem.asc'); all = all.filter((r) => r.review_status !== 'correction'); }
          catch (e2) { all = await App.getAll('page_proofs?select=user_id,book_id,stem&order=user_id.asc,book_id.asc,stem.asc'); }
          const m = {}; all.forEach((r) => { m[r.user_id] = (m[r.user_id] || 0) + 1; });
          rows = Object.entries(m).map(([user_id, n]) => ({ user_id, n })).sort((a, b) => b.n - a.n);
        }
        names = {}; (await App.sb.get('app_users?select=id,full_name&limit=5000')).forEach((u) => { names[String(u.id)] = u.full_name || ''; });
        rankCache.current[period] = { t: Date.now(), rows, names };
      }
      rows = rows.filter((r) => Number(r.n) > 0).map((r) => ({ id: String(r.user_id), n: Number(r.n) }));
      if (token !== rankReq.current) return;
      setRank({ loading: false, data: { period, rows, names }, error: '' });
    } catch (e) {
      if (token !== rankReq.current) return;
      setRank((r) => ({ ...r, loading: false, error: e.message }));
    }
  }, []);

  /* ---------- নোটিশ / ঘোষণা ---------- */
  const openNotices = useCallback((list) => {
    setNList(list); setNIdx(0);
    if (!nDlg.current.open) nDlg.current.showModal();
  }, []);
  const loadNotices = useCallback(async () => {
    const u = meRef.current; if (!u) return;
    try {
      const list = await App.sb.get('notices?or=' + enc('(user_id.is.null,user_id.eq.' + u.id + ')') + '&order=created_at.desc&limit=40');
      allNotices.current = list;
      const seen = readSeen(u.id), joined = u.created_at ? new Date(u.created_at).getTime() - 86400000 : 0;
      const fresh = list.filter((n) => !seen.has(String(n.id)) && new Date(n.created_at).getTime() >= joined).reverse();
      setBadge(fresh.length);
      if (fresh.length && !nDlg.current.open && !guide.current.isOpen()) openNotices(fresh);
    } catch (e) { /* notices টেবিল নেই */ }
  }, [openNotices]);
  const onNoticeClosed = () => {   // দেখানো সব নোটিশ "দেখা" হিসেবে মনে রাখি
    const u = meRef.current, s = readSeen(u.id);
    nListRef.current.forEach((n) => s.add(String(n.id))); writeSeen(u.id, s);
    setBadge(allNotices.current.filter((n) => !s.has(String(n.id))).length);
  };
  const onGuideClosed = () => {
    try { localStorage.setItem(guideKey(meRef.current.id), '1'); } catch (e) { /* ignore */ }
    loadNotices();
  };

  /* ---------- ট্যাব ---------- */
  const switchTab = useCallback((t) => {
    setTab(t);
    if (t === 'pay') loadMoney();
    if (t === 'rank') loadRank(rankPRef.current);
    if (t === 'task') loadCounts();
    window.scrollTo(0, 0);
  }, [loadMoney, loadRank, loadCounts]);
  useEffect(() => { repin(); }, [tab, !!me]); // eslint-disable-line react-hooks/exhaustive-deps
  const pickPeriod = (k) => { rankPRef.current = k; setRankP(k); loadRank(k); };

  /* ---------- শুরু: লগইন যাচাই, প্রাথমিক লোড, গাইড/হ্যাশ, লিসেনার ---------- */
  useEffect(() => {
    let dead = false; const timers = [];
    App.requireAuth().then((u) => {
      if (dead) return;
      meRef.current = u; goalRef.current = readGoal(u.id); setGoal(goalRef.current); setMe(u);
      loadCount(); load();
      const h = window.location.hash; let seenGuide = false;
      try { seenGuide = localStorage.getItem(guideKey(u.id)) === '1'; } catch (e) { /* ignore */ }
      if (h === '#guide') { go('task' + window.location.search, true); timers.push(setTimeout(() => guide.current && guide.current.open(), 200)); }   // প্রোফাইলের "ব্যবহারের গাইড" বোতাম থেকে
      else if (!seenGuide) timers.push(setTimeout(() => guide.current && guide.current.open(), 500));
      else loadNotices();
      if (h === '#prof') go('profile', true);   // পুরনো লিংক: প্রোফাইল এখন আলাদা পেইজ
      else if (h === '#pay') switchTab('pay');
      else if (h === '#rank') switchTab('rank');
    });
    const refreshAll = () => { loadCount(); loadCounts(); loadMoney(); loadNotices(); };
    const retryAll = () => { if (!booksRef.current.length) load(); else refreshAll(); };
    const onRetry = (e) => { if (!meRef.current) return; e.preventDefault(); retryAll(); };   // লগইন যাচাইয়ের আগে → ডিফল্ট (রিলোড)
    const onOnline = () => { if (meRef.current) retryAll(); };
    const onShow = (e) => { if (e.persisted && meRef.current) refreshAll(); };
    const onVis = () => { if (document.visibilityState === 'visible' && meRef.current) refreshAll(); };
    window.addEventListener('kp-retry', onRetry); window.addEventListener('kp-online', onOnline);
    window.addEventListener('pageshow', onShow); document.addEventListener('visibilitychange', onVis);
    const iv = setInterval(() => { if (document.visibilityState === 'visible' && meRef.current) loadNotices(); }, 180000);
    return () => {
      dead = true; timers.forEach(clearTimeout); clearInterval(iv);
      window.removeEventListener('kp-retry', onRetry); window.removeEventListener('kp-online', onOnline);
      window.removeEventListener('pageshow', onShow); document.removeEventListener('visibilitychange', onVis);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- দৈনিক লক্ষ্য ---------- */
  const openGoal = () => { setGlVal(String(goal)); setGlErr(''); glDlg.current.showModal(); };
  const saveGoal = () => {
    const g = Math.floor(Number(glVal));
    if (!Number.isFinite(g) || g < 1 || g > 1000) { setGlErr('১ থেকে ১০০০-এর মধ্যে একটি সংখ্যা দিন'); return; }
    goalRef.current = g; setGoal(g); try { localStorage.setItem(goalKey(me.id), String(g)); } catch (e) { /* ignore */ }
    glDlg.current.close(); toast('দৈনিক লক্ষ্য: ' + bn(g) + ' পেইজ');
  };
  /* কিতাব খোলার আগে: লুকানো কিতাব আটকানো + অন্য কেউ এখন ওই কিতাবের কাজ করছে কিনা যাচাই (অ্যাডমিন সবসময় খুলতে পারবে) */
  const openBook = async (id, stem) => {
    if (lockBusy.current) return;
    lockBusy.current = true;
    try {
      const bk = booksById[String(id)];
      if (bk && bk.hidden && !isAdmin) {   // অ্যাডমিন কিতাবটি লুকিয়েছে (চালিয়ে যান বাটন থেকেও এখানে আসে) → কাস্টম ডায়ালগ
        setHiddenInfo({ book: bk.name || '' });
        if (hidDlg.current) hidDlg.current.showModal();
        return;
      }
      if (!isAdmin && me) {
        try {
          const r = await App.sb.post('rpc/book_lock_of', { p_book: String(id) });
          const l = Array.isArray(r) ? r[0] : null;
          if (l && String(l.holder_id) !== String(me.id)) {
            setLockInfo({ name: l.holder_name || 'অন্য একজন ইউজার', book: bk ? bk.name : '' });
            if (lockDlg.current) lockDlg.current.showModal();
            return;
          }
        } catch (e) { /* ফাংশন/টেবিল না থাকলে বা নেটওয়ার্ক সমস্যায় আটকাবে না — কিতাব খুলে দেবে */ }
      }
      go('view?book=' + enc(id) + (stem ? '&page=' + enc(stem) : ''));
    } finally { lockBusy.current = false; }
  };
  const openResume = () => {
    const rt = resumeTarget(getResume(me.id), booksById, fin.proofs); if (!rt) return;
    openBook(rt.bid, rt.stem);
  };

  /* ---------- পেমেন্ট রিকোয়েস্ট ---------- */
  const summaryOf = (f) => (f.ready ? App.summarize(f.proofs, byId(booksRef.current), f.S, f.pays) : null);
  const onRequest = async () => {
    setReqBusy(true);
    try {
      const f = await loadMoney(), s = summaryOf(f), min = minPayout(f.S), u = meRef.current;
      if (!s) { toast('তথ্য আনা যায়নি, আবার চেষ্টা করুন', true); return; }
      if (!u.payment_number) { toast('আগে পেমেন্ট নাম্বার দিন', true); return; }
      if (s.available < min || s.available <= 0) { toast('ন্যূনতম ' + App.money(min) + ' হলে রিকোয়েস্ট করা যাবে', true); return; }
      setRq({ avail: App.money(s.available), min: App.money(min), pmLabel: (PM[u.payment_method] || 'পেমেন্ট') + ' নাম্বার', number: u.payment_number, max: s.available });
      setRqAmt(String(s.available)); setRqErr(''); rqDlg.current.showModal();
    } finally { setReqBusy(false); }
  };
  const onSend = async () => {
    setRqSending(true);
    try {
      const f = await loadMoney(), s = summaryOf(f), min = minPayout(f.S), amt = App.r2(rqAmt), u = meRef.current;
      if (!s) throw new Error('তথ্য আনা যায়নি, আবার চেষ্টা করুন');
      if (!Number.isFinite(amt) || amt <= 0) throw new Error('সঠিক পরিমাণ দিন');
      if (amt < min) throw new Error('ন্যূনতম ' + App.money(min) + ' চাইতে হবে');
      if (amt > s.available) throw new Error('উত্তোলনযোগ্য ' + App.money(s.available) + '-এর বেশি চাওয়া যাবে না');
      await App.sb.post('payments', { user_id: String(u.id), user_name: u.full_name, amount: amt, pages: s.approved, method: u.payment_method, number: u.payment_number, status: 'requested' });
      App.log('payment_request', App.money(amt) + ' • ' + (PM[u.payment_method] || '') + ' ' + u.payment_number);
      rqDlg.current.close(); toast('পেমেন্ট রিকোয়েস্ট পাঠানো হয়েছে'); loadMoney();
    } catch (e) { setRqErr(/payments/i.test(e.message) && /404|PGRST205|42P01/i.test(e.message) ? 'পেমেন্ট টেবিল নেই — অ্যাডমিন supabase_v2.sql চালাননি' : e.message); }
    finally { setRqSending(false); }
  };

  const logout = () => { App.log('logout', ''); setTimeout(() => App.logout(), 150); };
  const cntText = myCount == null ? '–' : bn(myCount);

  return (
    <PageShell title="কাজ - কিতাব প্রুফিং" themeColor="#0b5f4c"
      viewport="width=device-width, initial-scale=1, viewport-fit=cover" sheets={['common', 'theme']} css={css}>
      <header className="top">
        <Logo className="logo-sm" as="span" />
        <h2 id="ttl">{TITLES[tab]}</h2>
        <span id="myCnt" className="cnt" hidden={myCount == null} title="আপনার সম্পন্ন টাস্ক"><span><Icon name="check" /></span><b id="cntN">{cntText}</b><small>টি সম্পন্ন</small></span>
        {' '}<ThemeToggle id="bTheme" mode={theme} onChange={setTheme} />
        {' '}<button id="bProf" className="sm" aria-label="প্রোফাইল" title={badge ? 'প্রোফাইল (' + badge + 'টি নতুন নোটিশ)' : 'প্রোফাইল'} onClick={() => go('profile')}>
          <Icon name="user" />{badge ? <span className="tbadge">{bn(badge)}</span> : null}
        </button>
        {' '}<button id="bAdmin" className="sm" hidden={!isAdmin} onClick={() => go('admin')}><span><Icon name="shield" /></span>অ্যাডমিন</button>
        {' '}<button id="bOut" className="sm" hidden={!isAdmin} title="লগআউট" onClick={logout}><span><Icon name="logout" /></span><span className="lbl">লগআউট</span></button>
      </header>

      <main className="wrap wide" style={{ paddingBottom: '90px' }}>
        {/* TASK pane */}
        <section id="pTask" hidden={tab !== 'task'}>
          <Dashboard ready={fin.ready} proofs={fin.proofs} booksById={booksById} goal={goal} resume={resume} onGoal={openGoal} onResume={openResume} />
          <div className="row" style={{ marginBottom: '14px' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
              <input id="q" type="search" placeholder="কিতাব বা লেখকের নাম খুঁজুন" style={{ paddingLeft: '36px' }} value={query} onChange={(e) => setQuery(e.target.value)} />
              {' '}<span style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', display: 'flex' }}><Icon name="search" /></span>
            </div>
            <button id="bReload" className="sm" title="রিফ্রেশ" onClick={() => { load(); loadCount(); loadNotices(); }}><span><Icon name="refresh" /></span></button>
          </div>
          <div id="noticeBar"></div>
          <BookGrid status={booksStatus} spinning={spinning} books={shownBooks} query={query} bookCounts={bookCounts}
            byBook={sum ? sum.byBook : {}} resume={resume} rateOf={rateOf} onOpen={(id) => openBook(id)} />
        </section>

        {/* PAYMENT pane */}
        <PayPane hidden={tab !== 'pay'} me={me || {}} S={fin.S} sum={sum} booksById={booksById} proofs={fin.proofs} pays={fin.pays}
          rateOf={rateOf} reqBusy={reqBusy} onRequest={onRequest} />

        {/* LEADERBOARD pane */}
        <RankPane hidden={tab !== 'rank'} period={rankP} onPeriod={pickPeriod} loading={rank.loading} data={rank.data} error={rank.error} meId={me ? String(me.id) : ''} />
      </main>

      <nav className="bottom" id="nav" ref={nav} hidden={!me}>
        {NAV.map(([k, id, icon, label]) => (
          <button key={k} id={id} className={tab === k ? 'on' : ''} onClick={() => switchTab(k)}><span><Icon name={icon} cls="lg" /></span>{label}</button>
        ))}
      </nav>

      <GoalDialog dlgRef={glDlg} value={glVal} onValue={setGlVal} err={glErr} onCancel={() => glDlg.current.close()} onSave={saveGoal} />
      <RequestDialog dlgRef={rqDlg} info={rq} amt={rqAmt} onAmt={setRqAmt} err={rqErr} busy={rqSending} onCancel={() => rqDlg.current.close()} onSend={onSend} />
      <NoticeDialog dlgRef={nDlg} list={nList} idx={nIdx} onIdx={setNIdx} onClose={() => nDlg.current.close()} onClosed={onNoticeClosed} />
      <GuideDialog ref={guide} onClosed={onGuideClosed} />
      <dialog id="hidDlg" ref={hidDlg}>
        <h3>কিতাবটি সাময়িক বন্ধ আছে</h3>
        <p className="hint" style={{ margin: '0 0 12px', fontSize: '15px', lineHeight: 1.8 }}>
          {hiddenInfo.book ? <b>"{hiddenInfo.book}"</b> : 'এই'} কিতাবটির এক্সেস অ্যাডমিন সাময়িক বন্ধ রেখেছেন।<br />আপনি অন্য কিতাবের কাজ করতে পারেন।
        </p>
        <div className="acts">
          <button id="hidOk" className="primary" onClick={() => hidDlg.current.close()}>ঠিক আছে</button>
        </div>
      </dialog>
      <dialog id="lockDlg" ref={lockDlg}>
        <h3>কিতাবটি এখন ব্যবহৃত হচ্ছে</h3>
        <p className="hint" style={{ margin: '0 0 12px', fontSize: '15px', lineHeight: 1.8 }}>
          <b>{lockInfo.name}</b> {lockInfo.book ? '"' + lockInfo.book + '" ' : ''}কিতাবটির কাজ করছেন...<br />উনি কাজ অফ করলে আপনি করতে পারবেন।
        </p>
        <div className="acts">
          <button id="lockOk" className="primary" onClick={() => lockDlg.current.close()}>ঠিক আছে</button>
        </div>
      </dialog>
    </PageShell>
  );
}
