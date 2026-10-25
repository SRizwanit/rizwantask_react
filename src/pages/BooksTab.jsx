/* কিতাব: তালিকা, রেট/অগ্রগতি, পেইজ গণনা (স্বয়ংক্রিয় + বাটন), নতুন/এডিট ডায়ালগ, JSON ইমপোর্ট এবং পিডিএফ থেকে ছবি তৈরির GitHub Actions workflow (স্ট্যাটাস পোলিং সহ) */
import { useEffect, useRef, useState } from 'react';
import App from '../../lib/common.js';
import Icon from '../../components/Icon.jsx';
import { Dlg, Empty, Ic, SegBar } from './ui.jsx';
import {
  DEF, countPages, dispatchBook, eff, fetchRunState, getSplitPref, ghTok, isActiveRun, outDirOf, pdfLinks, rateTxt, readRunsLS, setSplitPref, sl, wfFile, writeRunsLS
} from './helpers.js';

const { bn, toast, enc } = App;

/* ---- ছবি তৈরির স্ট্যাটাস বক্স (কিতাবের কার্ডে) ---- */
function RunBox({ s }) {
  const link = s && s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">বিস্তারিত</a> : null;
  if (!s) return <div className="runbox"><div className="rh"><span className="badge">ছবি তৈরি</span><span className="rs">স্ট্যাটাস আনা হচ্ছে…</span></div></div>;
  if (s.status === 'error') return <div className="runbox"><div className="rh"><span className="badge warn">ছবি তৈরি</span><span className="rs">স্ট্যাটাস আনা যায়নি: {s.err || ''}</span></div></div>;
  if (s.status === 'completed') {
    const ok = s.conclusion === 'success', cn = s.conclusion === 'cancelled';
    return <div className="runbox"><div className="rh"><span className={'badge ' + (ok ? 'ok' : cn ? 'warn' : 'bad')}>{ok ? 'ছবি তৈরি সম্পন্ন ✔' : cn ? 'ছবি তৈরি বাতিল' : 'ছবি তৈরি ব্যর্থ ✖'}</span>{link}</div></div>;
  }
  const q = s.status !== 'in_progress', pct = s.total ? Math.max(4, Math.round(s.done / s.total * 100)) : (q ? 0 : 4);
  return (
    <div className="runbox">
      <div className="rh">
        <span className="badge warn">{q ? 'ছবি তৈরি: সারিতে আছে' : 'ছবি তৈরি চলছে…'}</span>
        {s.total ? <span className="rs">ধাপ {Math.min(s.done + 1, s.total)}/{s.total}{s.step ? ' • ' + s.step : ''}</span> : null}
        {link}
      </div>
      <div className="pbar run"><i style={{ width: pct + '%' }}></i></div>
    </div>
  );
}

const blank = () => ({ name: '', author: '', cover: '', pdf: '', rate: '', tot: '', gu: '', repo: '', br: '', fold: '', run: true, split: false });
const fromBook = (b) => ({
  name: b.name || '', author: b.author || '', cover: b.cover_url || '', pdf: b.pdf_url || '', rate: b.page_rate == null ? '' : b.page_rate, tot: b.total_pages == null ? '' : b.total_pages,
  gu: b.github_username || '', repo: b.repo_name || '', br: b.branch || '', fold: b.folder || '', run: false, split: false
});

/* ---- JSON ইমপোর্ট: ফাইল পার্স করে books টেবিলের row বানায় ---- */
const BATCH = 50;
const isUrl = (u) => /^https?:\/\//i.test(u);
const keyOf = (name, pdf) => (name || '').trim().toLowerCase() + '|' + (pdf || '').trim();
function parseImport(text, existing) {
  let data = JSON.parse(text);
  if (!Array.isArray(data)) data = (data && Array.isArray(data.books)) ? data.books : [data];
  const seen = new Set((existing || []).map((b) => keyOf(b.name, b.pdf_url)));
  const rows = [], info = { total: data.length, ok: 0, dup: 0, bad: 0, noPdf: 0 };
  data.forEach((x) => {
    if (!x || typeof x !== 'object') { info.bad++; return; }
    const name = String(x.name == null ? '' : x.name).trim();
    if (!name) { info.bad++; return; }
    let pdf = String(x.pdflink || x.pdf_url || x.pdf || '').trim();
    if (!isUrl(pdf)) pdf = '';                                   // "link", "no" ইত্যাদি ভুল মান বাদ
    let cover = String(x.img || x.cover_url || x.cover || '').trim();
    if (!isUrl(cover) || /no-image-found/i.test(cover)) cover = ''; // প্লেসহোল্ডার ছবি বাদ
    const k = keyOf(name, pdf);
    if (seen.has(k)) { info.dup++; return; }
    seen.add(k);
    const row = { name, author: String(x.author == null ? '' : x.author).trim(), cover_url: cover, pdf_url: pdf };
    // ঐচ্ছিক ফিল্ড — JSON-এ থাকলে নেওয়া হবে, না থাকলে ডিফল্ট
    ['github_username', 'repo_name', 'branch'].forEach((f) => { if (x[f] != null && String(x[f]).trim()) row[f] = String(x[f]).trim(); });
    if (x.folder != null && String(x.folder).trim()) row.folder = String(x.folder).trim().replace(/^\/+|\/+$/g, '');
    if (x.page_rate != null && String(x.page_rate).trim() !== '' && Number(x.page_rate) >= 0) row.page_rate = Number(x.page_rate);
    if (x.total_pages != null && String(x.total_pages).trim() !== '' && Number(x.total_pages) >= 0) row.total_pages = Math.round(Number(x.total_pages));
    if (!pdf) info.noPdf++;
    rows.push(row); info.ok++;
  });
  return { rows, info };
}

export default function BooksTab({ d, openKey, active }) {
  const { books, S, bst, proofsLoaded } = d;
  const [runs, setRuns] = useState({}), [, bump] = useState(0);
  const [dlgOpen, setDlgOpen] = useState(false), [editId, setEditId] = useState(null), [fm, setFm] = useState(blank), [err, setErr] = useState('');
  const [counting, setCounting] = useState(''), [fCounting, setFCounting] = useState(false), [saving, setSaving] = useState(false), [allCounting, setAllCounting] = useState(false);
  /* JSON ইমপোর্ট স্টেট */
  const [impOpen, setImpOpen] = useState(false), [impRows, setImpRows] = useState([]), [impInfo, setImpInfo] = useState(null), [impErr, setImpErr] = useState('');
  const [impBusy, setImpBusy] = useState(false), [impProg, setImpProg] = useState(''), [impFile, setImpFile] = useState('');
  const [impCount, setImpCount] = useState(true), [impRun, setImpRun] = useState(false), [impSplit, setImpSplit] = useState(false);
  const runsRef = useRef({}), runsLS = useRef(readRunsLS()), pollT = useRef(0), activeRef = useRef(active); activeRef.current = active;
  const autoDone = useRef({}), fileRef = useRef(null);
  /* একাধিক কিতাব সিলেক্ট করে ডিলিট */
  const [selMode, setSelMode] = useState(false), [sel, setSel] = useState({}), [delBusy, setDelBusy] = useState(false);
  const selCount = Object.keys(sel).length;
  const toggleSel = (id) => setSel((o) => { const n = { ...o }; const k = String(id); if (n[k]) delete n[k]; else n[k] = true; return n; });
  const exitSel = () => { setSelMode(false); setSel({}); };
  const selectAll = () => { const all = {}; books.forEach((b) => { all[String(b.id)] = true; }); setSel(selCount === books.length ? {} : all); };
  const set = (k) => (e) => { const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value; setFm((o) => ({ ...o, [k]: v })); };

  /* ---- সর্বশেষ রান: Supabase-এর gh_run_* কলাম + এই ব্রাউজারের সংরক্ষণ — যেটি নতুন ---- */
  const getRun = (b) => {
    const c = [];
    if (b.gh_run_at) c.push({ id: b.gh_run_id ? String(b.gh_run_id) : null, at: b.gh_run_at });
    if (runsLS.current[b.id]) c.push(runsLS.current[b.id]);
    if (!c.length) return null;
    c.sort((x, y) => String(y.at).localeCompare(String(x.at)));
    return c[0];
  };
  const setRun = (id, s) => { runsRef.current = { ...runsRef.current, [id]: s }; setRuns(runsRef.current); };
  const saveRun = (b, info) => {
    runsLS.current[b.id] = info; writeRunsLS(runsLS.current); bump((n) => n + 1);
    App.sb.patch('books?id=eq.' + enc(b.id), { gh_run_id: info.id, gh_run_at: info.at }).then(() => { if ('gh_run_id' in b) d.patchBook(b.id, { gh_run_id: info.id, gh_run_at: info.at }); }).catch(() => {});
  };

  /* ---- স্বয়ংক্রিয় পেইজ গণনা: GitHub ফোল্ডার গুনে total_pages সংরক্ষণ করে (০ হলে কিছু বদলায় না) ---- */
  async function autoCount(b, silent) {
    try {
      const c = await countPages(d.refs.S.current, b);
      if (!c || !(c.n > 0)) { if (!silent) toast('"' + b.name + '" — ফোল্ডারে কোনো ছবি পাওয়া যায়নি', true); return null; }
      await App.sb.patch('books?id=eq.' + enc(b.id), { total_pages: c.n });
      d.patchBook(b.id, { total_pages: c.n });
      if (!silent) toast('"' + b.name + '" — মোট পেইজ: ' + bn(c.n) + (c.truncated ? ' (তালিকা অসম্পূর্ণ হতে পারে)' : ''));
      return c.n;
    } catch (e) { if (!silent) toast('গণনা ব্যর্থ: ' + e.message, true); return null; }
  }

  /* ---- স্ট্যাটাস পোলিং: ট্যাব খোলা ও পেইজ দৃশ্যমান থাকলেই GitHub-এ জিজ্ঞেস করে ---- */
  const schedulePoll = (ms) => { clearTimeout(pollT.current); pollT.current = setTimeout(pollRuns, ms || 8000); };
  async function pollRuns() {
    clearTimeout(pollT.current);
    const S0 = d.refs.S.current;
    if (document.visibilityState !== 'visible' || !activeRef.current || !ghTok(S0)) { schedulePoll(8000); return; }
    let any = false;
    await Promise.all(d.refs.books.current.map(async (b) => {
      const info = getRun(b); if (!info) return;
      const old = runsRef.current[b.id]; if (old && old.status === 'completed') return;   // শেষ হওয়া রান আর আনা হয় না
      let st;
      try { st = await fetchRunState(S0, b, info, (id) => saveRun(b, { id, at: info.at })); } catch (e) { st = { status: 'error', err: e.message }; }
      setRun(b.id, st); if (isActiveRun(st)) any = true;
      /* রান সফল শেষ হলে অটো পেইজ গণনা (এই সেশনে চলতে দেখা রান, অথবা মোট পেইজ এখনও নেই) */
      if (st.status === 'completed' && st.conclusion === 'success') {
        const ak = b.id + ':' + (info.id || info.at);
        const wasActive = old && isActiveRun(old);
        if (!autoDone.current[ak] && (wasActive || !(Number(b.total_pages) > 0))) {
          autoDone.current[ak] = true;
          autoCount(b, !wasActive).then((n) => { if (n && wasActive) toast('ছবি তৈরি শেষ — স্বয়ংক্রিয় পেইজ গণনা: ' + bn(n)); });
        }
      }
    }));
    schedulePoll(any ? 8000 : 15000);
  }
  useEffect(() => {
    schedulePoll(8000);
    const onVis = () => { if (document.visibilityState === 'visible' && activeRef.current) pollRuns(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearTimeout(pollT.current); document.removeEventListener('visibilitychange', onVis); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (openKey) { d.loadProofs(); pollRuns(); } }, [openKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const reload = async () => { const l = await d.loadBooks(); pollRuns(); return l; };
  async function startRun(b, split) {
    try {
      toast('workflow চালু করা হচ্ছে…');
      const info = await dispatchBook(d.refs.S.current, b, split);
      saveRun(b, info); setRun(b.id, { status: 'queued' });
      toast('ছবি তৈরির workflow চালু হয়েছে — স্ট্যাটাস কিতাবের কার্ডে দেখা যাবে');
      schedulePoll(3000);
      return true;
    } catch (e) { toast('workflow চালু হয়নি: ' + e.message, true); return false; }
  }

  /* ---- যেসব কিতাবে মোট পেইজ নেই, সবগুলো একসাথে গণনা ---- */
  async function countAll() {
    const list = d.refs.books.current.filter((b) => !(Number(b.total_pages) > 0));
    if (!list.length) { toast('সব কিতাবেই মোট পেইজ দেওয়া আছে'); return; }
    if (!window.confirm(list.length + 'টি কিতাবের মোট পেইজ GitHub ফোল্ডার থেকে গোনা হবে। চালাবেন?')) return;
    setAllCounting(true); let ok = 0;
    for (let i = 0; i < list.length; i++) {
      toast('পেইজ গণনা ' + bn(i + 1) + '/' + bn(list.length) + ' — ' + list[i].name);
      const n = await autoCount(list[i], true); if (n) ok++;
    }
    setAllCounting(false);
    toast('গণনা শেষ — ' + bn(ok) + 'টি কিতাবের পেইজ সংখ্যা সংরক্ষিত, ' + bn(list.length - ok) + 'টিতে ছবি পাওয়া যায়নি');
  }

  /* ---- JSON ইমপোর্ট ---- */
  const openImport = () => { setImpRows([]); setImpInfo(null); setImpErr(''); setImpFile(''); setImpProg(''); setImpSplit(false); setImpOpen(true); };
  const onPickFile = (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    setImpErr(''); setImpRows([]); setImpInfo(null); setImpFile(f.name);
    const r = new FileReader();
    r.onload = () => {
      try {
        const { rows, info } = parseImport(String(r.result || ''), d.refs.books.current);
        setImpRows(rows); setImpInfo(info);
        if (!rows.length) setImpErr('ইমপোর্ট করার মতো নতুন কিতাব পাওয়া যায়নি');
      } catch (x) { setImpErr('JSON পড়া যায়নি: ' + x.message); }
    };
    r.onerror = () => setImpErr('ফাইল পড়া যায়নি');
    r.readAsText(f, 'utf-8');
    e.target.value = '';
  };
  async function postBatch(chunk) {
    try { return await App.sb.post('books', chunk); }
    catch (e) {
      if (/page_rate|total_pages/i.test(e.message)) {                       // পুরনো স্কিমা: রেট/পেইজ কলাম নেই
        return await App.sb.post('books', chunk.map(({ page_rate, total_pages, ...rest }) => rest)); // eslint-disable-line no-unused-vars
      }
      const out = [];                                                       // ব্যাচ ব্যর্থ হলে একটা একটা করে
      for (const row of chunk) { try { const r = await App.sb.post('books', row); if (r && r[0]) out.push(r[0]); } catch (x) { /* এই row বাদ */ } }
      if (!out.length) throw e;
      return out;
    }
  }
  async function doImport() {
    if (!impRows.length) return;
    const wantRun = impRun;
    if (wantRun) {
      if (!ghTok(S)) { setImpErr('workflow চালাতে সেটিংস ট্যাবে GitHub Token দিন'); return; }
      const n = impRows.filter((r) => r.pdf_url).length;
      if (!window.confirm(n + 'টি কিতাবের জন্য আলাদা workflow চালু হবে। এটি ভারী হতে পারে। নিশ্চিত?')) return;
    }
    setImpErr(''); setImpBusy(true); setSplitPref(impSplit);
    let added = 0;
    /* ছবি তৈরির workflow চালালে JSON-এর total_pages ধরা হয় না — ছবি তৈরি শেষে পেইজ গণনা হলেই কিতাব Task পেইজে দেখাবে */
    const rowsToSave = wantRun ? impRows.map(({ total_pages, ...rest }) => (rest.pdf_url ? rest : { ...rest, total_pages })) : impRows; // eslint-disable-line no-unused-vars
    try {
      for (let i = 0; i < rowsToSave.length; i += BATCH) {
        setImpProg('সংরক্ষণ হচ্ছে… ' + bn(Math.min(i + BATCH, rowsToSave.length)) + '/' + bn(rowsToSave.length));
        const r = await postBatch(rowsToSave.slice(i, i + BATCH));
        added += (r && r.length) ? r.length : rowsToSave.slice(i, i + BATCH).length;
      }
    } catch (x) { setImpErr('ইমপোর্ট ব্যর্থ (' + bn(added) + 'টি সংরক্ষিত হয়েছে): ' + x.message); setImpBusy(false); setImpProg(''); reload(); return; }
    setImpProg('তালিকা রিফ্রেশ হচ্ছে…');
    const list = await reload();
    const keys = new Set(impRows.map((r) => keyOf(r.name, r.pdf_url)));
    const fresh = list.filter((b) => keys.has(keyOf(b.name, b.pdf_url)));
    toast(bn(added) + 'টি কিতাব ইমপোর্ট হয়েছে');
    if (impCount) {
      let ok = 0;
      for (let i = 0; i < fresh.length; i++) {
        if (Number(fresh[i].total_pages) > 0) continue;
        setImpProg('পেইজ গণনা ' + bn(i + 1) + '/' + bn(fresh.length));
        if (await autoCount(fresh[i], true)) ok++;
      }
      if (fresh.length) toast('স্বয়ংক্রিয় গণনা: ' + bn(ok) + 'টি কিতাবের পেইজ সংখ্যা পাওয়া গেছে');
    }
    if (wantRun) {
      for (let i = 0; i < fresh.length; i++) {
        if (!fresh[i].pdf_url) continue;
        setImpProg('workflow চালু ' + bn(i + 1) + '/' + bn(fresh.length));
        await startRun(fresh[i], impSplit);
      }
    }
    setImpBusy(false); setImpProg(''); setImpOpen(false);
  }

  /* ---- ডায়ালগ ---- */
  const openBook = (b) => { setEditId(b ? b.id : null); setFm(b ? fromBook(b) : blank()); setErr(''); setDlgOpen(true); };
  const nm = sl(fm.fold) || sl(fm.name);
  const runHint = nm ? 'আউটপুট ফোল্ডার: ' + nm + '_' + (S.pages_dir || DEF.pages_dir) + ' • workflow: ' + wfFile() : 'workflow: ' + wfFile();

  const formCount = async () => {
    setFCounting(true); setErr('');
    try {
      const b = { name: fm.name.trim(), folder: fm.fold.trim(), github_username: fm.gu.trim(), repo_name: fm.repo.trim(), branch: fm.br.trim() };
      if (!b.name) throw new Error('আগে কিতাবের নাম দিন');
      const c = await countPages(S, b); setFm((o) => ({ ...o, tot: String(c.n) }));
      toast(c.dir + ' — ' + bn(c.n) + 'টি ছবি' + (c.truncated ? ' (তালিকা অসম্পূর্ণ হতে পারে)' : ''));
    } catch (e) { setErr('গণনা ব্যর্থ: ' + e.message); } finally { setFCounting(false); }
  };

  const save = async () => {
    const row = { name: fm.name.trim(), author: fm.author.trim(), cover_url: fm.cover.trim(), pdf_url: fm.pdf.trim(), github_username: fm.gu.trim(), repo_name: fm.repo.trim(), branch: fm.br.trim(), folder: fm.fold.trim().replace(/^\/+|\/+$/g, '') };
    if (!row.name) { setErr('কিতাবের নাম আবশ্যক'); return; }
    const rv = String(fm.rate).trim(), tv = String(fm.tot).trim();
    if (rv !== '' && !(Number(rv) >= 0)) { setErr('সঠিক রেট দিন'); return; }
    row.page_rate = rv === '' ? null : Number(rv); row.total_pages = tv === '' ? null : Math.max(0, Math.round(Number(tv)) || 0);
    const wantRun = fm.run, split = fm.split;
    /* নতুন কিতাবে ছবি তৈরি চালালে মোট পেইজ ফাঁকা রাখা হয় — ছবি তৈরি শেষ হয়ে পেইজ গণনা হলেই কিতাব Task পেইজে দেখাবে */
    if (wantRun && !editId) row.total_pages = null;
    if (wantRun) {                                   // সংরক্ষণের আগেই যাচাই, যাতে অর্ধেক কাজ না হয়
      if (!row.pdf_url) { setErr('ছবি তৈরির জন্য পিডিএফ লিংক দিন'); return; }
      if (pdfLinks(row.pdf_url).length > 1) { setErr('একটি কিতাবে একটাই পিডিএফ লিংক দিন'); return; }
      if (!ghTok(S)) { setErr('workflow চালাতে সেটিংস ট্যাবে GitHub Token দিন'); return; }
    }
    setSplitPref(split);
    let saved = null; setSaving(true);
    try {
      let r;
      const persist = (x) => (editId ? App.sb.patch('books?id=eq.' + enc(editId), x) : App.sb.post('books', x));
      try { r = await persist(row); }
      catch (e) {
        if (/page_rate|total_pages/i.test(e.message)) { const { page_rate, total_pages, ...rest } = row; r = await persist(rest); toast('কিতাব সংরক্ষিত, কিন্তু রেট/মোট পেইজ সংরক্ষণ হয়নি — Supabase SQL Editor-এ supabase_v2.sql চালান', true); } // eslint-disable-line no-unused-vars
        else throw e;
      }
      if (editId && String(row.page_rate) !== String((d.refs.books.current.find((x) => String(x.id) === String(editId)) || {}).page_rate)) App.log('admin_rate', row.name + ' → ' + (row.page_rate == null ? 'ডিফল্ট' : row.page_rate + ' ৳'));
      saved = (r && r[0]) || { ...row, id: editId };
      setDlgOpen(false); toast('কিতাব সংরক্ষিত হয়েছে');
    } catch (x) { setErr(x.message); return; } finally { setSaving(false); }
    const list = await reload();
    const bk = list.find((x) => String(x.id) === String(saved.id)) || saved;
    if (wantRun) await startRun(bk, split);
    else if (row.total_pages == null && bk && bk.id != null) autoCount(bk, true);   // মোট পেইজ ফাঁকা থাকলে নিজে গুনে নেয়
  };

  /* ---- সিলেক্ট করা কিতাবগুলো একসাথে ডিলিট ---- */
  async function delSelected() {
    const list = d.refs.books.current.filter((b) => sel[String(b.id)]);
    if (!list.length) { toast('কোনো কিতাব সিলেক্ট করা হয়নি', true); return; }
    const names = list.slice(0, 5).map((b) => '• ' + b.name).join('\n') + (list.length > 5 ? '\n… ও আরও ' + bn(list.length - 5) + 'টি' : '');
    if (!window.confirm(bn(list.length) + 'টি কিতাব ডিলিট করবেন?\n\n' + names + '\n\n(এটি ফেরানো যাবে না)')) return;
    setDelBusy(true); let ok = 0, fail = 0, lastErr = '';
    for (let i = 0; i < list.length; i++) {
      toast('ডিলিট ' + bn(i + 1) + '/' + bn(list.length) + ' — ' + list[i].name);
      try {
        await App.sb.del('books?id=eq.' + enc(list[i].id));
        delete runsLS.current[list[i].id]; delete runsRef.current[list[i].id]; ok++;
      } catch (x) { fail++; lastErr = x.message; }
    }
    writeRunsLS(runsLS.current); runsRef.current = { ...runsRef.current }; setRuns(runsRef.current);
    setDelBusy(false); exitSel();
    toast(bn(ok) + 'টি কিতাব ডিলিট হয়েছে' + (fail ? ' • ' + bn(fail) + 'টি ব্যর্থ: ' + lastErr : ''), !!fail);
    reload();
  }

  /* ---- কার্ডের বোতাম ---- */
  const act = async (a, bk) => {
    if (a === 'edit') openBook(bk);
    else if (a === 'toggle') {                       // কিতাব লুকান / দেখান
      const hide = !bk.hidden;
      try {
        await App.sb.patch('books?id=eq.' + enc(bk.id), { hidden: hide });
        d.patchBook(bk.id, { hidden: hide });
        toast(hide ? '"' + bk.name + '" লুকানো হয়েছে — ইউজাররা আর দেখবে না' : '"' + bk.name + '" আবার দেখানো হচ্ছে');
      } catch (x) {
        toast(/hidden/i.test(x.message) ? 'Supabase SQL Editor-এ চালান: alter table books add column if not exists hidden boolean not null default false;' : x.message, true);
      }
    }
    else if (a === 'count') {
      setCounting(String(bk.id));
      try {
        const c = await countPages(S, bk);
        await App.sb.patch('books?id=eq.' + enc(bk.id), { total_pages: c.n }); d.patchBook(bk.id, { total_pages: c.n });
        toast('মোট পেইজ: ' + bn(c.n) + (c.truncated ? ' (তালিকা অসম্পূর্ণ হতে পারে)' : ''));
      } catch (x) { toast('গণনা ব্যর্থ: ' + x.message, true); } finally { setCounting(''); }
    } else if (a === 'run') {
      const sp = getSplitPref();
      if (!window.confirm('"' + bk.name + '" — পিডিএফ থেকে আবার ছবি তৈরি করবেন?\n\nআউটপুট ফোল্ডার: ' + outDirOf(S, bk) + '\nবাম-ডান ভাগ: ' + (sp ? 'হ্যাঁ' : 'না') + '\n(একই নামের ছবি নতুন করে লেখা হবে; পুরনো ছবি মুছবে না)')) return;
      await startRun(bk, sp);
    } else if (window.confirm('"' + bk.name + '" কিতাবটি ডিলিট করবেন?')) {
      try {
        await App.sb.del('books?id=eq.' + enc(bk.id));
        delete runsLS.current[bk.id]; writeRunsLS(runsLS.current);
        const { [bk.id]: gone, ...rest } = runsRef.current; runsRef.current = rest; setRuns(rest); // eslint-disable-line no-unused-vars
        toast('কিতাব ডিলিট হয়েছে'); reload();
      } catch (x) { toast(x.message, true); }
    }
  };

  return (
    <section id="pBooks">
      <div className="row" style={{ marginBottom: '12px' }}>
        <b style={{ flex: '1' }}>সব কিতাব</b>
        {' '}<button id="bRel" className="sm" title="কিতাব ও ছবি-তৈরির স্ট্যাটাস রিফ্রেশ" onClick={async () => { await reload(); toast('রিফ্রেশ হয়েছে'); }}><Ic n="refresh" /></button>
        {' '}<button id="bCountAll" className="sm" title="যেসব কিতাবে মোট পেইজ দেওয়া নেই, সবগুলোর পেইজ GitHub ফোল্ডার থেকে গুনুন" disabled={allCounting} onClick={countAll}><Ic n="refresh" />সব গণনা</button>
        {' '}<button id="bImp" className="sm" title="JSON ফাইল থেকে একসাথে অনেক কিতাব যোগ করুন" onClick={openImport}><Ic n="plus" />JSON ইমপোর্ট</button>
        {' '}<button id="bSel" className={'sm' + (selMode ? ' primary' : '')} title="এক বা একাধিক কিতাব সিলেক্ট করে ডিলিট করুন" disabled={delBusy} onClick={() => (selMode ? exitSel() : setSelMode(true))}><Ic n="check" />{selMode ? 'সিলেক্ট বন্ধ' : 'সিলেক্ট'}</button>
        {' '}<button id="bAdd" className="primary sm" onClick={() => openBook(null)}><Ic n="plus" />নতুন কিতাব</button>
      </div>
      {selMode ? (
        <div className="row" id="bSelBar" style={{ marginBottom: '12px' }}>
          <span className="meta" style={{ flex: 1 }}>সিলেক্ট করা: <b>{bn(selCount)}</b>/{bn(books.length)}</span>
          {' '}<button id="bSelAll" className="sm" disabled={delBusy || !books.length} onClick={selectAll}><Ic n="check" />{selCount && selCount === books.length ? 'সব বাদ' : 'সব সিলেক্ট'}</button>
          {' '}<button id="bSelDel" className="sm danger" disabled={delBusy || !selCount} onClick={delSelected}><Ic n="trash" />ডিলিট ({bn(selCount)})</button>
        </div>
      ) : null}
      <div id="bList">
        {books.length ? books.map((b) => {
          const x = bst[String(b.id)] || { n: 0, a: 0, p: 0, c: 0 }, tot = Number(b.total_pages) || 0, info = getRun(b);
          return (
            <div className="li" key={b.id} style={{ ...(b.hidden ? { opacity: 0.6 } : null), ...(selMode && sel[String(b.id)] ? { outline: '2px solid var(--accent, #0b5f4c)', outlineOffset: '-2px' } : null) }} onClick={selMode ? () => toggleSel(b.id) : undefined}>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                {selMode ? <input type="checkbox" aria-label={'সিলেক্ট: ' + b.name} checked={!!sel[String(b.id)]} onChange={() => toggleSel(b.id)} onClick={(e) => e.stopPropagation()} style={{ flex: 'none', width: '20px', height: '20px' }} /> : null}
                <div style={{ width: '44px', height: '58px', borderRadius: '6px', overflow: 'hidden', background: 'var(--panel2)', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
                  {b.cover_url ? <img src={b.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="book" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{b.name}</b>{b.hidden ? <span className="meta" style={{ marginLeft: '8px', fontWeight: 700 }}>🚫 লুকানো</span> : null}{!b.hidden && !tot && !x.n ? <span className="meta" style={{ marginLeft: '8px', fontWeight: 700 }}>⏳ Task পেইজে দেখাচ্ছে না (ছবি তৈরি ও পেইজ গণনা বাকি)</span> : null}
                  <div className="meta">
                    {b.author || ''}<br />{eff(S, b, 'github_username')}/{eff(S, b, 'repo_name')}{(!b.github_username && !b.repo_name) ? ' (ডিফল্ট)' : ''} &middot; {b.folder || b.name}_{S.pages_dir || DEF.pages_dir}
                    {b.pdf_url ? <><br /><a href={b.pdf_url} target="_blank" rel="noopener noreferrer">PDF লিংক</a></> : null}
                  </div>
                </div>
              </div>
              <div className="meta">রেট: <b>{rateTxt(App.rateOf(b, S))}</b>/পেইজ{b.page_rate == null || b.page_rate === '' ? ' (ডিফল্ট)' : ''} • {tot ? 'মোট ' + bn(tot) + ' পেইজ' : 'মোট পেইজ দেওয়া নেই (এডিট বা "পেইজ গণনা")'}</div>
              {proofsLoaded ? (
                <>
                  <SegBar a={x.a} p={x.p} c={x.c} tot={tot || x.n} />
                  <div className="pgt"><span>প্রুফড {bn(x.n)}{tot ? ' / ' + bn(tot) + ' • বাকি ' + bn(Math.max(0, tot - x.n)) : ''}</span><span>অনুমোদিত {bn(x.a)} • রিভিউ বাকি {bn(x.p)} • সংশোধন {bn(x.c)}</span></div>
                </>
              ) : null}
              <div className="run">{info ? <RunBox s={runs[b.id]} /> : null}</div>
              {!selMode ? <div className="row">
                <button className="sm" title="GitHub ফোল্ডার থেকে মোট পেইজ গুনুন" disabled={counting === String(b.id)} onClick={() => act('count', b)}><Ic n="refresh" />পেইজ গণনা</button>
                <button className="sm" title={b.hidden ? 'ইউজারদের কাছে আবার দেখান' : 'ইউজারদের কাছ থেকে লুকান'} onClick={() => act('toggle', b)}><Ic n={b.hidden ? 'check' : 'ban'} />{b.hidden ? 'দেখান' : 'লুকান'}</button>
                <button className="sm" onClick={() => act('edit', b)}><Ic n="edit" />এডিট</button>
                {b.pdf_url ? <button className="sm" title="পিডিএফ থেকে ছবি তৈরির workflow আবার চালান" onClick={() => act('run', b)}><Icon name="play" />ছবি তৈরি</button> : null}
                <button className="sm danger" onClick={() => act('del', b)}><Ic n="trash" />ডিলিট</button>
              </div> : null}
            </div>
          );
        }) : <Empty>কোনো কিতাব যোগ করা হয়নি</Empty>}
      </div>

      {/* কিতাব ডায়ালগ */}
      <Dlg id="bDlg" open={dlgOpen} onClose={() => setDlgOpen(false)}>
        <h3 id="bdT">{editId ? 'কিতাব এডিট' : 'নতুন কিতাব'}</h3>
        <label className="f" htmlFor="fName">কিতাবের নাম *</label>
        <input id="fName" type="text" value={fm.name} onChange={set('name')} />
        {' '}<label className="f" htmlFor="fAuth">কিতাবের লেখকের নাম</label>
        <input id="fAuth" type="text" value={fm.author} onChange={set('author')} />
        {' '}<label className="f" htmlFor="fCover">কিতাবের ছবির লিংক</label>
        <input id="fCover" type="url" placeholder="https://..." value={fm.cover} onChange={set('cover')} />
        {' '}<label className="f" htmlFor="fPdf">কিতাবের পিডিএফ লিংক</label>
        <input id="fPdf" type="url" placeholder="https://..." value={fm.pdf} onChange={set('pdf')} />
        {' '}<label className="f" htmlFor="fRate">পেইজ প্রতি রেট (৳) — ফাঁকা = ডিফল্ট রেট</label>
        <input id="fRate" type="number" step="0.01" min="0" inputMode="decimal" placeholder={'ডিফল্ট ' + App.rateOf(null, S)} value={fm.rate} onChange={set('rate')} />
        {' '}<label className="f" htmlFor="fTot">মোট পেইজ সংখ্যা (অগ্রগতির বারের জন্য — ফাঁকা থাকলে সংরক্ষণের পর নিজে গুনে নেবে)</label>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input id="fTot" type="number" min="0" step="1" inputMode="numeric" value={fm.tot} onChange={set('tot')} />
          <button id="fCount" type="button" className="sm" title="GitHub ফোল্ডার থেকে ছবির সংখ্যা গুনুন" disabled={fCounting} onClick={formCount}>গুনুন</button>
        </div>
        <label className="f" htmlFor="fGu">GitHub Username (ফাঁকা = ডিফল্ট)</label>
        <input id="fGu" type="text" autoCapitalize="off" placeholder={eff(S, {}, 'github_username')} value={fm.gu} onChange={set('gu')} />
        {' '}<label className="f" htmlFor="fRepo">Repo Name (ফাঁকা = ডিফল্ট)</label>
        <input id="fRepo" type="text" autoCapitalize="off" placeholder={eff(S, {}, 'repo_name')} value={fm.repo} onChange={set('repo')} />
        {' '}<label className="f" htmlFor="fBr">Branch (ফাঁকা = ডিফল্ট)</label>
        <input id="fBr" type="text" autoCapitalize="off" placeholder="main" value={fm.br} onChange={set('br')} />
        <p className="hint" id="fDef">{'ডিফল্ট: ' + eff(S, {}, 'github_username') + ' / ' + eff(S, {}, 'repo_name') + ' (সেটিংস ট্যাব থেকে বদলানো যায়)'}</p>
        <label className="f" htmlFor="fFold">রিপোর ফোল্ডার প্রিফিক্স</label>
        <input id="fFold" type="text" autoCapitalize="off" placeholder="যেমন: bukhari (ফাঁকা থাকলে কিতাবের নাম)" value={fm.fold} onChange={set('fold')} />
        <p className="hint">{'ফোল্ডার হবে '}<b>প্রিফিক্স_pages</b>{', '}<b>প্রিফিক্স_texts</b>{', '}<b>প্রিফিক্স_proofed.json</b></p>
        <label className="chk" htmlFor="fRun"><input id="fRun" type="checkbox" checked={fm.run} onChange={set('run')} /><span>সংরক্ষণের পর পিডিএফ থেকে ছবি তৈরির workflow চালান</span></label>
        {' '}<label className="chk" htmlFor="fSplit"><input id="fSplit" type="checkbox" checked={fm.split} onChange={set('split')} /><span>প্রতিটি পেইজ বাম-ডান দুই ভাগ (split) করুন</span></label>
        <p className="hint" id="fRunHint">{runHint}</p>
        <p className="hint">নতুন কিতাব Task পেইজে তখনই দেখাবে, যখন ছবি তৈরি শেষ হয়ে মোট পেইজ গণনা সম্পন্ন হবে।</p>
        <div className="err" id="bdErr">{err}</div>
        <div className="acts">
          <button id="bdCancel" onClick={() => setDlgOpen(false)}>বন্ধ</button>
          <button id="bdSave" className="primary" disabled={saving} onClick={save}>সংরক্ষণ</button>
        </div>
      </Dlg>

      {/* JSON ইমপোর্ট ডায়ালগ */}
      <Dlg id="bImpDlg" open={impOpen} onClose={() => { if (!impBusy) setImpOpen(false); }}>
        <h3 id="biT">JSON ইমপোর্ট</h3>
        <p className="hint">JSON ফাইলে প্রতিটি কিতাবের <b>name</b>, <b>author</b>, <b>img</b> (কভার), <b>pdflink</b> (পিডিএফ) থাকলে সেগুলো নেওয়া হবে। GitHub Username, Repo, Branch ও ফোল্ডার ফাঁকা থাকবে — অর্থাৎ ডিফল্ট ব্যবহার হবে। (<b>page_rate</b>, <b>total_pages</b>, <b>github_username</b>, <b>repo_name</b>, <b>branch</b>, <b>folder</b> থাকলে সেগুলোও নেওয়া হয়।)</p>
        <label className="f" htmlFor="impFile">JSON ফাইল বাছুন</label>
        <input id="impFile" ref={fileRef} type="file" accept=".json,application/json,text/plain" disabled={impBusy} onChange={onPickFile} />
        {impFile ? <p className="hint">ফাইল: {impFile}</p> : null}
        {impInfo ? (
          <p className="hint" id="impInfo">
            {'ফাইলে মোট '}<b>{bn(impInfo.total)}</b>{'টি • নতুন (ইমপোর্ট হবে): '}<b>{bn(impInfo.ok)}</b>{' • ডুপ্লিকেট (আগে থেকেই আছে): '}<b>{bn(impInfo.dup)}</b>{' • অচল/নামহীন: '}<b>{bn(impInfo.bad)}</b>
            {impInfo.noPdf ? <>{' • পিডিএফ লিংক নেই: '}<b>{bn(impInfo.noPdf)}</b></> : null}
          </p>
        ) : null}
        <label className="chk" htmlFor="impCount"><input id="impCount" type="checkbox" checked={impCount} disabled={impBusy} onChange={(e) => setImpCount(e.target.checked)} /><span>ইমপোর্টের পর স্বয়ংক্রিয়ভাবে মোট পেইজ গুনুন (GitHub ফোল্ডারে ছবি থাকলে)</span></label>
        {' '}<label className="chk" htmlFor="impRun"><input id="impRun" type="checkbox" checked={impRun} disabled={impBusy} onChange={(e) => setImpRun(e.target.checked)} /><span>ইমপোর্টের পর প্রতিটি কিতাবের জন্য পিডিএফ থেকে ছবি তৈরির workflow চালান (ভারী — সাবধানে)</span></label>
        {impRun ? <><label className="chk" htmlFor="impSplit"><input id="impSplit" type="checkbox" checked={impSplit} disabled={impBusy} onChange={(e) => setImpSplit(e.target.checked)} /><span>প্রতিটি পেইজ বাম-ডান দুই ভাগ (split) করুন</span></label></> : null}
        {impProg ? <p className="hint" id="impProg">{impProg}</p> : null}
        <div className="err" id="biErr">{impErr}</div>
        <div className="acts">
          <button id="biCancel" disabled={impBusy} onClick={() => setImpOpen(false)}>বন্ধ</button>
          <button id="biSave" className="primary" disabled={impBusy || !impRows.length} onClick={doImport}>{impRows.length ? 'ইমপোর্ট (' + bn(impRows.length) + 'টি)' : 'ইমপোর্ট'}</button>
        </div>
      </Dlg>
    </section>
  );
}
