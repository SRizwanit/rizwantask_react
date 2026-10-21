/* Admin-এর শেয়ার্ড ডেটা: ইউজার, কিতাব, সেটিংস, প্রুফড পেইজ, পেমেন্ট + হিসাব (ব্যাজ, ইউজার/কিতাবভিত্তিক পরিসংখ্যান)।
   async কোডে সর্বশেষ মান লাগে বলে প্রতিটির একটি ref-ও রাখা হয় (সেট করার সাথে সাথে হালনাগাদ)। */
import { useCallback, useMemo, useRef, useState } from 'react';
import App from '../../lib/common.js';
import { bodyFor, rvKey, status, T0, D7, tm } from './helpers.js';

const { toast } = App;

export default function useAdminData() {
  const [users, setUsersS] = useState([]);
  const [books, setBooksS] = useState([]);
  const [S, setSS] = useState({});
  const [proofs, setProofsS] = useState([]);
  const [pays, setPaysS] = useState([]);
  const [proofsLoaded, setProofsLoaded] = useState(false);
  const [payTbl, setPayTbl] = useState(true);
  const usersRef = useRef([]), booksRef = useRef([]), SRef = useRef({}), proofsRef = useRef([]), paysRef = useRef([]);
  const proofsAt = useRef(0);

  const setUsers = useCallback((v) => { usersRef.current = v; setUsersS(v); }, []);
  const setBooks = useCallback((v) => { booksRef.current = v; setBooksS(v); }, []);
  const setS = useCallback((v) => { SRef.current = v; setSS(v); }, []);
  const setProofs = useCallback((v) => { proofsRef.current = v; setProofsS(v); }, []);
  const setPays = useCallback((v) => { paysRef.current = v; setPaysS(v); }, []);

  const uname = useCallback((id) => { const u = usersRef.current.find((x) => String(x.id) === String(id)); return u ? u.full_name : 'ইউজার'; }, []);
  const bname = useCallback((id) => { const b = booksRef.current.find((x) => String(x.id) === String(id)); return b ? b.name : 'কিতাব'; }, []);
  const booksMapNow = useCallback(() => Object.fromEntries(booksRef.current.map((b) => [String(b.id), b])), []);

  /* ---- লোডার ---- */
  const loadUsers = useCallback(async () => {
    try { const u = await App.sb.get('app_users?select=*&order=created_at.desc'); setUsers(u); return u; }
    catch (e) { toast(e.message, true); return usersRef.current; }
  }, [setUsers]);
  const loadBooks = useCallback(async () => {
    try { const b = await App.sb.get('books?select=*&order=created_at.desc'); setBooks(b); return b; }
    catch (e) { toast(e.message, true); return booksRef.current; }
  }, [setBooks]);
  const fetchS = useCallback(async () => {
    let s = {};
    try { s = (await App.sb.get('app_settings?id=eq.1&limit=1'))[0] || {}; } catch (e) { s = {}; toast(e.message, true); }
    setS(s); return s;
  }, [setS]);
  const loadProofs = useCallback(async (force) => {
    if (!force && proofsAt.current && Date.now() - proofsAt.current < 20000) return proofsRef.current;
    let r;
    try { r = await App.getAll('page_proofs?select=user_id,book_id,stem,review_status,rate,created_at&order=book_id.asc,stem.asc'); }
    catch (e) { try { r = await App.getAll('page_proofs?select=user_id,book_id,stem&order=book_id.asc,stem.asc'); } catch (e2) { r = []; } }
    proofsAt.current = Date.now(); setProofs(r); setProofsLoaded(true);
    return r;
  }, [setProofs]);
  const loadPaysQuiet = useCallback(async () => {
    try { setPays(await App.getAll('payments?order=created_at.desc,id.desc')); setPayTbl(true); }
    catch (e) { setPays([]); setPayTbl(false); }
  }, [setPays]);
  const ensureMoney = useCallback(() => Promise.all([loadProofs(), loadPaysQuiet()]), [loadProofs, loadPaysQuiet]);

  /* ---- স্থানীয় হালনাগাদ (সার্ভারে পাঠানোর পরে) ---- */
  /* keyset-এর পেইজগুলোকে অনুমোদিত/সংশোধন করে (অপরিবর্তনীয়ভাবে) */
  const applyStatus = useCallback((keyset, st, note) => {
    const bm = booksMapNow(), S0 = SRef.current;
    setProofs(proofsRef.current.map((p) => (keyset.has(rvKey(p)) ? { ...p, ...bodyFor(S0, st, note, bm[String(p.book_id)]) } : p)));
  }, [booksMapNow, setProofs]);
  const patchPay = useCallback((id, patch) => setPays(paysRef.current.map((p) => (String(p.id) === String(id) ? { ...p, ...patch } : p))), [setPays]);
  const patchBook = useCallback((id, patch) => setBooks(booksRef.current.map((b) => (String(b.id) === String(id) ? { ...b, ...patch } : b))), [setBooks]);

  /* ---- হিসাব: ইউজার/কিতাবভিত্তিক পরিসংখ্যান (আগের buildStats) ---- */
  const { pst, bst } = useMemo(() => {
    const t0 = T0(), w0 = D7(), pst = {}, bst = {};
    proofs.forEach((p) => {
      const k = String(p.user_id), x = pst[k] || (pst[k] = { n: 0, today: 0, w7: 0, last: 0, list: [] }), t = tm(p.created_at);
      x.n++; x.list.push(p); if (t >= t0) x.today++; if (t >= w0) x.w7++; if (t > x.last) x.last = t;
      const b = bst[String(p.book_id)] || (bst[String(p.book_id)] = { n: 0, a: 0, p: 0, c: 0 }), st = status(p);
      b.n++; if (st === 'approved') b.a++; else if (st === 'correction') b.c++; else b.p++;
    });
    return { pst, bst };
  }, [proofs]);
  const booksMap = useMemo(() => Object.fromEntries(books.map((b) => [String(b.id), b])), [books]);
  const lastActive = useCallback((u) => Math.max(tm(u.last_active_at), (pst[String(u.id)] || {}).last || 0), [pst]);
  const userSum = useCallback((uid) => App.summarize((pst[String(uid)] || {}).list || [], booksMap, S, pays.filter((p) => String(p.user_id) === String(uid))), [pst, booksMap, S, pays]);

  return {
    users, books, S, proofs, pays, payTbl, proofsLoaded, pst, bst, booksMap,
    refs: { users: usersRef, books: booksRef, S: SRef, proofs: proofsRef, pays: paysRef },
    setS, setProofs, setPays, uname, bname, lastActive, userSum,
    loadUsers, loadBooks, fetchS, loadProofs, loadPaysQuiet, ensureMoney, applyStatus, patchPay, patchBook
  };
}
