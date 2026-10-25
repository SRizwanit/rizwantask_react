/* view.html → রিয়্যাক্ট (state/hooks)। কিতাবের পেইজ: ছবি + টেক্সট প্রুফিং, GitHub-এ সেভ, প্রুফড মালিকানা (Supabase),
   Gemini OCR/প্রুফিং, শোনা (TTS) — সব আগের মতো। আগের View.logic.js আর লাগে না (runLegacy ছাড়াই চলে)।
   ছোট অংশগুলো ./view/ ফোল্ডারে: config/storage (কনফিগ), github, gemini, ttsEngines + TtsController (শোনা),
   এবং UI: Dropdown, Dialog, Toasts, ImageLoader, Highlight, SettingsDialog, ApiDialogs, TtsDialog।

   কাঠামো: রেন্ডারে যা দেখা যায় (cur, লেখা, ফ্ল্যাগ, ডায়ালগ) তা useState/useStateRef-এ;
   বড় ডেটা-কাঠামো (images, proofed, owners…) রেফে রেখে বদলালে repaint() ডাকা হয়। অ্যাসিঙ্ক কোড সবসময় রেফ থেকে
   সর্বশেষ মান পড়ে (await-এর পরে ক্লোজার পুরনো হয়ে যায়)। টেক্সট বক্স uncontrolled — মান ref দিয়ে বসে/পড়া হয়, আনডু ঠিক থাকে। */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import PageShell from '../lib/PageShell.jsx';
import App from '../lib/common.js';
import { go as navTo } from '../lib/nav.js';
import css from './View.css?inline';
import Sprite, { Ic } from './view/Sprite.jsx';
import Dropdown, { closeDropdown } from './view/Dropdown.jsx';
import Toasts from './view/Toasts.jsx';
import ImageLoader from './view/ImageLoader.jsx';
import Highlight, { createHlStore } from './view/Highlight.jsx';
import SettingsDialog, { normalizedPatch } from './view/SettingsDialog.jsx';
import ApiDialogs from './view/ApiDialogs.jsx';
import TtsDialog from './view/TtsDialog.jsx';
import TtsController from './view/TtsController.js';
import useRipple from './view/useRipple.js';
import { createToaster } from './view/toaster.js';
import { createGithub } from './view/github.js';
import { callGemini } from './view/gemini.js';
import { useEvent, useRepaint, useStateRef } from './view/hooks.js';
import { API_DEF, API_NAME, connSig, draftKey, keysFor, loadCfg, loadDrafts, repoPaths, saveCfgTo } from './view/config.js';
import { KP_EXT, installFlushListeners, mirror, requestPersist, restoreFromExt } from './view/storage.js';
import { hasTTS } from './view/ttsEngines.js';
import {
  MIME_BY_EXT, bnNum, bytesToB64, checkText, copyPlain, encU, epath, extOf, fromB64, markHeadings, natCmp, normNl, normRepo,
  numOf, openTab, toB64, toPngBlob
} from './view/utils.js';

/* ভেক্টর (SVG) আইকন: আগে যেগুলো লেখা-চিহ্ন (− + A− A+ ✕) ছিল; stroke=currentColor, তাই থিম/ডার্ক মোডে নিজে রং বদলায় */
const VP = {
  minus: <path d="M5 12h14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  fit: <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  fontDown: <><path d="M3 18 8 6l5 12M5 14h6" /><path d="M16 12h5" /></>,
  fontUp: <><path d="M3 18 8 6l5 12M5 14h6" /><path d="M18.5 9.5v5M16 12h5" /></>
};
const V = ({ n }) => (<svg className="i" viewBox="0 0 24 24" aria-hidden="true" focusable="false">{VP[n]}</svg>);

const RATES = ['0.6', '0.8', '1', '1.2', '1.5', '1.8', '2'].map((v) => ({ value: v, label: v + '×' }));
const isNoTable = (e) => /PGRST205|PGRST200|42P01|relation .*page_proofs|404/i.test((e && e.message) || '');

/* ================= প্রবেশদ্বার: লগইন + কিতাব + সেটিংস লোড ================= */
export default function View() {
  const [ctx, setCtx] = useState(null);

  useEffect(() => {
    let dead = false;
    (async () => {
      const u = await App.requireAuth();                       // লগইন/ডিভাইস না মিললে login-এ পাঠায়
      const id = new URLSearchParams(window.location.search).get('book');
      if (!id) { navTo('task', true); return; }
      let b = null, s = {};
      try { b = (await App.sb.get('books?id=eq.' + encodeURIComponent(id) + '&limit=1'))[0]; } catch (e) { /* ignore */ }
      if (!b) { navTo('task', true); return; }
      if (b.hidden && !App.isAdminPhone(u.phone)) {             // অ্যাডমিন কিতাবটি লুকিয়েছে: সরাসরি লিংক/বুকমার্ক দিয়েও ইউজার ঢুকতে পারবে না (অ্যাডমিন পারবে)
        window.alert('"' + (b.name || '') + '" কিতাবটির এক্সেস অ্যাডমিন সাময়িক বন্ধ রেখেছেন।\nআপনি অন্য কিতাবের কাজ করতে পারেন।');
        navTo('task', true); return;
      }
      try { s =(await App.sb.get('app_settings?id=eq.1&limit=1'))[0] || {}; } catch (e) { /* ignore */ }
      const { CK, DK } = keysFor(u.id, b.id);
      await restoreFromExt([CK, DK]);                           // এক্সটেনশন স্টোরেজ থেকে কী/টোকেন/খসড়া ফেরানো
      if (!dead) setCtx({ uid: u.id, uname: u.full_name || u.name || '', isAdmin: App.isAdminPhone(u.phone), book: b, settings: s });
    })();
    return () => { dead = true; };
  }, []);

  useEffect(() => {
    requestPersist();
    return installFlushListeners();
  }, []);

  return (
    <PageShell
      title={ctx ? ctx.book.name + ' - কিতাব প্রুফিং' : 'কিতাব প্রুফিং'}
      themeColor="#0b5f4c"
      viewport="width=device-width, initial-scale=1"
      sheets={['theme']}
      css={css}
      cssFirst
    >
      {ctx ? <ViewPage ctx={ctx} /> : (
        <main className="view-entry-loading" role="status" aria-live="polite" aria-busy="true">
          <section className="view-entry-loading__card" aria-label="কিতাবের তথ্য প্রস্তুত হচ্ছে">
            <div className="view-entry-loading__mark" aria-hidden="true">
              <span className="view-entry-loading__orbit" />
              <span className="view-entry-loading__book">
                <svg viewBox="0 0 32 32" focusable="false">
                  <path d="M16 9.2C12.7 6.9 8.7 6.5 4.8 8v16c4-1.5 7.9-1.1 11.2 1.2 3.3-2.3 7.2-2.7 11.2-1.2V8c-3.9-1.5-7.9-1.1-11.2 1.2Z" />
                  <path d="M16 9.4v15.7M8.2 11.3c2-.4 4.1 0 5.8 1.1M8.2 15.1c2-.4 4.1 0 5.8 1.1M23.8 11.3c-2-.4-4.1 0-5.8 1.1M23.8 15.1c-2-.4-4.1 0-5.8 1.1" />
                </svg>
              </span>
              <span className="view-entry-loading__dot view-entry-loading__dot--one" />
              <span className="view-entry-loading__dot view-entry-loading__dot--two" />
            </div>
            <p className="view-entry-loading__eyebrow">RIZWANTASK <span /> কিতাব প্রুফিং</p>
            <h2 className="view-entry-loading__title">কিতাব প্রস্তুত করা হচ্ছে</h2>
            <p className="view-entry-loading__description">আপনার কিতাবের তথ্য ও সেটিংস লোড হচ্ছে।</p>
            <div className="view-entry-loading__progress" aria-hidden="true"><span /></div>
            <p className="view-entry-loading__hint">অনুগ্রহ করে অপেক্ষা করুন…</p>
          </section>
        </main>
      )}
    </PageShell>
  );
}

/* ================= মূল পেইজ ================= */
function ViewPage({ ctx }) {
  const ME = ctx.uid, BOOK = ctx.book, BOOK_ID = String(BOOK.id), IS_ADMIN = !!ctx.isAdmin;
  const { CK, DK } = useMemo(() => keysFor(ME, BOOK.id), [ME, BOOK.id]);
  const wantPage = useMemo(() => new URLSearchParams(window.location.search).get('page'), []);   // task-এর "সংশোধন দরকার" লিংক থেকে সরাসরি পেইজে
  useRipple();

  /* ---------- টোস্ট ---------- */
  const toasterRef = useRef(null);
  if (!toasterRef.current) toasterRef.current = createToaster();
  const T = toasterRef.current, toast = T.toast;
  useEffect(() => () => T.dispose(), [T]);

  /* ---------- "কাজ চলছে" সংকেত: এই কিতাবে কাজ করার সময় প্রতি ২০ সেকেন্ডে জানায়; বের হলে ছেড়ে দেয়।
     অন্য ইউজার Task পেজে কিতাবটিতে ক্লিক করলে "(নাম) কাজ করছেন" ডায়ালগ দেখে। অ্যাডমিন লক ধরে না।
     (Supabase-এ book_locks টেবিল ও book_lock_* ফাংশন না থাকলে চুপচাপ উপেক্ষা করে — কাজ ব্যাহত হয় না) ---------- */
  useEffect(() => {
    if (IS_ADMIN) return undefined;
    let alive = true, held = false;
    const args = { p_book: BOOK_ID, p_user: String(ME) };
    const beat = async () => {
      try {
        const holder = await App.sb.post('rpc/book_lock_beat', { ...args, p_name: ctx.uname || '' });
        if (!alive) return;
        if (holder) {                                   // অন্য কেউ এই কিতাবে সক্রিয় (সরাসরি লিংকে ঢুকলে)
          if (!held) { alive = false; window.alert(holder + ' এই কিতাবটির কাজ করছেন...\nউনি কাজ অফ করলে আপনি করতে পারবেন।'); navTo('task', true); }
          return;
        }
        held = true;
      } catch (e) { /* উপেক্ষা */ }
    };
    const release = () => { App.sb.post('rpc/book_lock_release', args).catch(() => {}); };
    const onVis = () => { if (document.visibilityState === 'visible') beat(); };
    beat();
    const t = setInterval(beat, 20000);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', release);
    return () => {
      alive = false; clearInterval(t);
      document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pagehide', release);
      if (held) release();
    };
  }, [ME, BOOK_ID, IS_ADMIN]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- কনফিগ (সংরক্ষিত; বদলালেই localStorage + এক্সটেনশন স্টোরেজে) ---------- */
  const cfgRef = useRef(null);
  if (!cfgRef.current) cfgRef.current = loadCfg(CK, ctx);
  const [, forceCfg] = useState(0);
  const setCfg = useEvent((patch, silent) => {   // silent = রেন্ডার ছাড়াই শুধু সংরক্ষণ (স্ক্রল/শেষ পেইজ)
    const next = typeof patch === 'function' ? patch(cfgRef.current) : { ...cfgRef.current, ...patch };
    cfgRef.current = next;
    saveCfgTo(CK, next);
    if (!silent) forceCfg((n) => n + 1);
  });
  const cfg = cfgRef.current;

  /* ---------- খসড়া (পেইজ ধরে ধরে, লোকাল স্টোরেজে স্বয়ংক্রিয় সংরক্ষণ) ---------- */
  const draftsRef = useRef(null);
  if (!draftsRef.current) draftsRef.current = loadDrafts(DK);
  const quotaWarned = useRef(false);
  const persistDrafts = useEvent(() => {
    try { const v = JSON.stringify(draftsRef.current); mirror(DK, v); localStorage.setItem(DK, v); return true; }
    catch (e) {
      if (KP_EXT) return true;   // এক্সটেনশন স্টোরেজে খসড়া নিরাপদ আছে
      if (!quotaWarned.current) { quotaWarned.current = true; toast('লোকাল স্টোরেজে খসড়া রাখা যাচ্ছে না (জায়গা শেষ?) — দ্রুত সেভ করুন', true); }
      return false;
    }
  });
  const dk = (stem) => draftKey(cfgRef.current, stem);

  /* ---------- স্টেট ---------- */
  const [rev, repaint] = useRepaint();                 // images/proofed/owners… বদলালে রেন্ডার চালায়
  const imagesRef = useRef([]);                         // [{name, stem}]
  const textSetRef = useRef(new Set());                 // যেসব পেইজের txt আছে
  const proofedRef = useRef(new Set());                 // প্রুফড পেইজের stem
  const ownersRef = useRef(new Map());                  // stem → যে ইউজার প্রুফড করেছে
  const reviewsRef = useRef(new Map());                 // stem → {s: pending/approved/correction, note}
  const ownerNamesRef = useRef(new Map());              // user_id → নাম (শুধু অ্যাডমিন)
  const proofDbRef = useRef(true);                      // page_proofs টেবিল আছে কি না (না থাকলে পুরনো আচরণ)

  const [cur, setCur, curRef] = useStateRef(-1);
  const [text, setText] = useState('');                 // টেক্সট বক্সের মান (রেন্ডারের জন্য; আসল মান textarea-তেই)
  const [orig, setOrig, origRef] = useStateRef('');     // রিপোর টেক্সট (তুলনার ভিত্তি)
  const [sha, setSha, shaRef] = useStateRef(null);
  const [taLoading, setTaLoading, taLoadingRef] = useStateRef(true);   // textarea disabled
  const [loadErr, setLoadErr, loadErrRef] = useStateRef(false);
  const [placeholder, setPlaceholder] = useState('');
  const [imgMsg, setImgMsgState] = useState('');
  const [ldr, setLdr] = useState(undefined);            // ছবি লোডার: undefined = নেই, null = অজানা %, সংখ্যা = %
  const [ldrKey, setLdrKey] = useState(0);
  const [lb, setLb, lbRef] = useStateRef({ open: false, src: '', title: '' });
  const [apiRun, setApiRun, apiRunRef] = useStateRef(null);   // {n, stem, chars, ctrl}
  const [apiEnabled, setApiEnabled, apiEnabledRef] = useStateRef(!(ctx.settings && ctx.settings.api_enabled === false));
  const [doneCnt, setDoneCnt] = useState(null);
  const [override, setOverride] = useState(null);       // স্ট্যাটাসে সাময়িক লেখা ("সেভ হচ্ছে…")
  const [ttsState, setTtsState] = useState('idle');
  const [proofBusy, setProofBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiPickOpen, setApiPickOpen] = useState(false);
  const [apiCfgN, setApiCfgN] = useState(null);
  const [tsOpen, setTsOpen] = useState(false);
  const [voices, setVoices, voicesRef] = useStateRef([]);

  /* অ্যাসিঙ্ক/টাইমারের জন্য পরিবর্তনশীল মান */
  const seq = useRef(0), busy = useRef(false), initing = useRef(false), initFailed = useRef(false), forceInit = useRef(false);
  const restoreOnce = useRef(true), viewReady = useRef(false), legacyProof = useRef(false), proofRunning = useRef(false);
  const apiChecking = useRef(false), autoT = useRef(0), autoPause = useRef(false), autoTried = useRef(new Set());
  const defaultBranch = useRef(''), repoPrivate = useRef(null);
  const draftT = useRef(0), viewT = useRef(0), imgWait = useRef(null), tsCb = useRef(null);
  const doneBusy = useRef(false), doneAgain = useRef(false);
  const connected = useRef({ sig: connSig(cfg) });      // সর্বশেষ যে রিপো/ব্রাঞ্চ/কিতাব-ফোল্ডারে সংযোগ হয়েছে

  const taRef = useRef(null), imgRef = useRef(null), imgBoxRef = useRef(null), jumpRef = useRef(null);
  const hdrRef = useRef(null), ftrRef = useRef(null);

  /* ---------- GitHub + ছবি ক্যাশ ---------- */
  const gh = useMemo(() => createGithub(() => cfgRef.current, IS_ADMIN), []);
  const imgProg = useEvent((name, pct) => {
    const im = imagesRef.current[curRef.current];
    if (im && im.name === name) setLdr((v) => (v === undefined ? v : pct));
  });
  const imgCache = useMemo(() => gh.createImageCache((n, p) => imgProg(n, p)), [gh, imgProg]);

  /* ---------- ফোনের ভয়েস তালিকা ---------- */
  const refreshVoices = useEvent(() => {
    try { setVoices(hasTTS ? (speechSynthesis.getVoices() || []) : []); } catch (e) { setVoices([]); }
  });
  useEffect(() => {
    refreshVoices();
    if (!hasTTS) return undefined;
    try { speechSynthesis.addEventListener('voiceschanged', refreshVoices); } catch (e) { /* ignore */ }
    return () => { try { speechSynthesis.removeEventListener('voiceschanged', refreshVoices); } catch (e) { /* ignore */ } };
  }, [refreshVoices]);

  /* ---------- পেইজ-তালিকা সহায়ক (রেফ থেকে পড়ে) ---------- */
  const hiddenStem = (stem) => !IS_ADMIN && proofDbRef.current && ownersRef.current.has(stem) && ownersRef.current.get(stem) !== ME;   // অন্য ইউজারের প্রুফড পেইজ
  const isHid = (i) => i >= 0 && i < imagesRef.current.length && hiddenStem(imagesRef.current[i].stem);
  const visIdx = () => { const o = []; for (let i = 0; i < imagesRef.current.length; i++) if (!isHid(i)) o.push(i); return o; };
  const stepVis = (from, dir) => {       // from থেকে dir (+1/-1) দিকে প্রথম দৃশ্যমান পেইজ; না থাকলে -1
    for (let i = from + dir; i >= 0 && i < imagesRef.current.length; i += dir) if (!isHid(i)) return i;
    return -1;
  };
  const ownerTag = (stem) => {           // অ্যাডমিন অন্যের প্রুফড পেইজে নাম দেখে
    const ow = ownersRef.current;
    if (!IS_ADMIN || !ow.has(stem) || ow.get(stem) === ME) return '';
    const n = ownerNamesRef.current.get(ow.get(stem));
    return n ? ': ' + n : '';
  };
  const labelOf = (im) => im.stem
    + (proofedRef.current.has(im.stem) ? ' (প্রুফড' + ownerTag(im.stem) + ')' : '')
    + (draftsRef.current[dk(im.stem)] ? ' •' : '')
    + (textSetRef.current.has(im.stem) ? '' : ' (txt নেই)');
  const isDirty = () => curRef.current >= 0 && !taLoadingRef.current && !!taRef.current && taRef.current.value !== origRef.current;
  const updateStatus = () => setOverride(null);

  /* টেক্সট বক্সে মান বসানো (আনডু ইতিহাস মোছে — পেইজ বদলের সময়); স্বাভাবিক (\n) মান ফেরত */
  const putText = (v) => { const ta = taRef.current; ta.value = v; const nv = ta.value; setText(nv); return nv; };

  /* ---------- ছবি লোডার / বার্তা ---------- */
  const setImgMsg = (t) => { setLdr(undefined); setImgMsgState(t); };
  const ldrShow = (pct) => { setLdrKey((k) => k + 1); setImgMsgState(''); setLdr(pct); };

  /* ---------- খসড়া সংরক্ষণ ---------- */
  const stashDraft = useEvent(() => {
    clearTimeout(draftT.current);
    const i = curRef.current, ta = taRef.current;
    if (i < 0 || taLoadingRef.current || !ta) return;       // লোড চলাকালীন বা ব্যর্থ হলে খসড়া ছুঁবে না
    const d = draftsRef.current, k = dk(imagesRef.current[i].stem), v = ta.value;
    if (v !== origRef.current) d[k] = { t: v, ts: Date.now() };
    else if (k in d) delete d[k];
    else return;
    persistDrafts(); repaint();
  });

  /* ---------- শেষ অবস্থান (স্ক্রল/কার্সর) সংরক্ষণ ---------- */
  const saveView = useEvent(() => {
    clearTimeout(viewT.current);
    const i = curRef.current, ta = taRef.current, box = imgBoxRef.current;
    if (i < 0 || !viewReady.current || !ta || !box) return;
    const stem = imagesRef.current[i].stem;
    setCfg((c) => ({ ...c, view: { stem, it: Math.round(box.scrollTop), il: Math.round(box.scrollLeft), tt: Math.round(ta.scrollTop), c: ta.selectionStart || 0 } }), true);
  });
  const lazyView = useEvent(() => { clearTimeout(viewT.current); viewT.current = setTimeout(saveView, 400); });
  const flush = useEvent(() => { stashDraft(); saveView(); });

  /* ---------- আমার সম্পন্ন টাস্ক (শুধু নিজের প্রুফড পেইজ, সব কিতাব মিলিয়ে) ---------- */
  const loadDone = useEvent(async () => {
    if (doneBusy.current) { doneAgain.current = true; return; }
    doneBusy.current = true;
    try {
      let n;
      try {   // দ্রুত পথ: Supabase ফাংশন (supabase_task_count.sql)
        n = await App.sb.post('rpc/my_proof_count', { p_user: String(ME) });
        n = Number(Array.isArray(n) ? n[0] : n); if (!Number.isFinite(n)) throw new Error('bad');
      } catch (e) {   // ফাংশন না থাকলে সরাসরি গুনে নিন
        n = 0;
        for (let off = 0; ; off += 1000) {
          const r = await App.sb.get('page_proofs?user_id=eq.' + encU(ME) + '&select=stem&order=stem.asc&limit=1000&offset=' + off);
          n += r.length; if (r.length < 1000) break;
        }
      }
      setDoneCnt(n);
    } catch (e) { /* টেবিল নেই/নেটওয়ার্ক সমস্যা: আগের সংখ্যাই থাকুক */ }
    finally {
      doneBusy.current = false;
      if (doneAgain.current) { doneAgain.current = false; loadDone(); }
    }
  });

  /* ---------- লাইটবক্স ---------- */
  const openLightbox = () => {
    const img = imgRef.current;
    if (curRef.current < 0 || !img || !img.getAttribute('src')) return;
    setLb({ open: true, src: img.src, title: imagesRef.current[curRef.current].name });
  };
  const closeLightbox = useEvent(() => { if (lbRef.current.open) setLb({ open: false, src: '', title: '' }); });

  /* ---------- মূল ছবি ডাউনলোড ---------- */
  const downloadCurrent = useEvent(async () => {
    if (curRef.current < 0) { toast('কোনো ছবি খোলা নেই', true); return; }
    const im = imagesRef.current[curRef.current];
    const mime = MIME_BY_EXT[extOf(im.name)] || 'application/octet-stream';
    try {
      toast('মূল ছবি আনা হচ্ছে…', false, 4000);
      // ক্যাশ নয়, রিপো থেকে সরাসরি মূল ফাইল (raw) আনা হচ্ছে
      const path = gh.rawPath(im.name);
      const r = await gh.api(path, { headers: { 'Accept': 'application/vnd.github.raw+json' } });
      if (!r.ok) throw new Error(await gh.errMsg(r));
      let buf = await r.arrayBuffer();
      if (buf.byteLength < 2048) {   // খুব ছোট হলে (ভুল/এরর রেসপন্স হতে পারে) download_url দিয়ে আবার চেষ্টা
        const rj = await gh.api(path);
        if (rj.ok) {
          const j = await rj.json();
          if (j.download_url) { const r2 = await fetch(j.download_url, { cache: 'no-store' }); if (r2.ok) buf = await r2.arrayBuffer(); }
        }
      }
      if (buf.byteLength < 2048) throw new Error('ফাইল ঠিকমতো আসেনি (' + buf.byteLength + ' বাইট)');
      const url = URL.createObjectURL(new Blob([buf], { type: mime }));
      const a = document.createElement('a');
      a.href = url; a.download = im.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      toast('ডাউনলোড: ' + im.name + ' (' + (buf.byteLength / 1048576).toFixed(2) + ' MB)');
    } catch (e) { toast('ডাউনলোড ব্যর্থ: ' + e.message, true); }
  });

  /* ---------- Google Lens: পাবলিক রিপোতে সরাসরি; নইলে ছবি ক্লিপবোর্ডে কপি করে Lens খোলে ---------- */
  const openLens = useEvent(async () => {
    if (curRef.current < 0) { toast('কোনো ছবি খোলা নেই', true); return; }
    const im = imagesRef.current[curRef.current], c = cfgRef.current;
    if (repoPrivate.current === false) {
      const raw = 'https://raw.githubusercontent.com/' + c.repo + '/' + (c.branch ? encodeURIComponent(c.branch) : 'HEAD') + '/' + epath(repoPaths(c).pagesDir + '/' + im.name);
      const w = openTab('https://lens.google.com/uploadbyurl?url=' + encodeURIComponent(raw));
      toast(w ? 'Google Lens খোলা হয়েছে — সেখানে "Text" চেপে টেক্সট কপি করুন' : 'পপ-আপ ব্লক করা আছে — এই সাইটের জন্য পপ-আপ অনুমতি দিন', !w, 5000);
      return;
    }
    try {
      toast('ছবি কপি করা হচ্ছে…', false, 4000);
      const blob = await (await fetch(await imgCache.get(im.name))).blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': await toPngBlob(blob) })]);
      const w = openTab('https://lens.google.com/');
      toast(w ? 'ছবি কপি হয়েছে — Lens পেইজে Ctrl+V (মোবাইলে পেস্ট) করুন' : 'ছবি কপি হয়েছে, কিন্তু পপ-আপ ব্লক — lens.google.com হাতে খুলে পেস্ট করুন', !w, 6000);
    } catch (e) {
      toast('ছবি স্বয়ংক্রিয়ভাবে দেওয়া যায়নি (' + (e && e.message || e) + ') — ডাউনলোড করে lens.google.com-এ আপলোড করুন', true, 7000);
    }
  });

  /* ---------- Ai: GitHub ডাউনলোড অংশ + ছবির raw লিংক + OCR প্রম্পট → একটি প্রম্পট কপি ---------- */
  const buildAiPrompt = (im) => [
    '# UNIVERSAL MASTER PROMPT (v8.1): GitHub Public Image Fetch + Faithful OCR / Retyping, Any Language, Plain Text',
    '',
    '## ROLE',
    'You are an expert at fetching public images from GitHub and an expert OCR transcriber for ANY language and script (Bangla, Arabic, Urdu, Persian, English etc.). You download the image first, then retype it with 100% fidelity.',
    '',
    '## TASK',
    '1. Download the image from the provided GitHub URL.',
    '2. If the URL is a `github.com/.../blob/...` link, you MUST convert it to `raw.githubusercontent.com` link first. Handle URL-encoded Bengali folder names correctly (keep %E0%A6... encoding).',
    '3. Carefully read the downloaded image and retype ALL of the body content into clean, editable digital text. Do not summarize, translate, or correct.',
    '',
    'Input URL for this task:',
    '`' + gh.rawImageUrl(im, defaultBranch.current) + '`'
  ].join('\n') + '\n\n' + (cfgRef.current.api1.prompt || API_DEF[1].prompt).trim() + '\n';

  const aiCopy = useEvent(async () => {
    if (curRef.current < 0) { toast('কোনো ছবি খোলা নেই', true); return; }
    const im = imagesRef.current[curRef.current];
    if (!(await copyPlain(buildAiPrompt(im)))) { toast('কপি ব্যর্থ — ব্রাউজার ক্লিপবোর্ডে লিখতে দিচ্ছে না', true); return; }
    toast(repoPrivate.current === true
      ? 'প্রম্পট কপি হয়েছে (পেইজ ' + im.stem + ') — তবে ছবির লিংক প্রাইভেট, AI এটি খুলতে পারবে না'
      : 'AI প্রম্পট কপি হয়েছে (পেইজ ' + im.stem + ') — AI চ্যাটে পেস্ট করুন', repoPrivate.current === true, 4500);
  });

  /* ---------- শোনা (TTS) ---------- */
  const hlStore = useMemo(createHlStore, []);
  const askTts = useEvent((cb) => { tsCb.current = cb; refreshVoices(); setTsOpen(true); });
  const tts = useMemo(() => new TtsController({
    getCfg: () => cfgRef.current,
    getText: () => (taRef.current ? taRef.current.value : ''),
    getSel: () => ({ a: taRef.current.selectionStart, b: taRef.current.selectionEnd }),
    canPlay: () => curRef.current >= 0 && !taLoadingRef.current,
    setCaret: (p) => { try { taRef.current.setSelectionRange(p, p); } catch (e) { /* ignore */ } },
    scrollRatio: (r) => { const ta = taRef.current; if (ta) ta.scrollTop = Math.max(0, ta.scrollHeight * r - ta.clientHeight * 0.3); },
    onHighlight: (h) => hlStore.set(h),
    onState: setTtsState,
    toast,
    ask: askTts,
    getVoices: () => voicesRef.current,
    refreshVoices
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const onTsGo = (engine) => {
    setCfg({ ttsEngine: engine });
    tts.resetForce(); tts.clearG();
    const cb = tsCb.current; tsCb.current = null;
    setTsOpen(false);
    if (cb) cb();
  };
  const onTsClose = () => { tsCb.current = null; closeDropdown(); setTsOpen(false); };

  /* ---------- ইউজার-ভিত্তিক প্রুফড মালিকানা (Supabase: page_proofs) ----------
     একটি পেইজের মালিক একজনই। যে প্রুফড করেছে সেই পেইজ শুধু সে-ই (ও অ্যাডমিন) দেখে; অন্যের কাছে তালিকা/বাটন/"পরের অপ্রুফড" থেকে বাদ। */
  const fetchProofRows = async () => {
    const rows = [], PAGE = 1000;
    for (let off = 0; ; off += PAGE) {
      const q = 'page_proofs?book_id=eq.' + encU(BOOK_ID) + '&order=stem.asc&limit=' + PAGE + '&offset=' + off;
      let r;
      try { r = await App.sb.get(q + '&select=stem,user_id,review_status,review_note'); }
      catch (e) { if (/review_|42703|PGRST204/i.test(e.message)) r = await App.sb.get(q + '&select=stem,user_id'); else throw e; }
      rows.push(...r);
      if (r.length < PAGE) break;
    }
    return rows;
  };
  /* ফেরত: true = হালনাগাদ, false = পারেনি (নেটওয়ার্ক), 'none' = টেবিল নেই */
  const refreshProofs = useEvent(async () => {
    let rows;
    try { rows = await fetchProofRows(); }
    catch (e) { if (isNoTable(e)) { proofDbRef.current = false; ownersRef.current = new Map(); repaint(); return 'none'; } return false; }
    proofDbRef.current = true;
    const m = new Map(), rv = new Map();
    rows.forEach((r) => { m.set(r.stem, r.user_id); proofedRef.current.add(r.stem); if (r.review_status) rv.set(r.stem, { s: r.review_status, note: r.review_note || '' }); });
    reviewsRef.current = rv;
    ownersRef.current.forEach((_, stem) => { if (!m.has(stem)) proofedRef.current.delete(stem); });   // মালিক প্রুফড তুলে নিয়েছে
    ownersRef.current = m;
    if (IS_ADMIN) {
      try { (await App.sb.get('app_users?select=id,full_name')).forEach((u) => ownerNamesRef.current.set(String(u.id), u.full_name || '')); } catch (e) { /* ignore */ }
    }
    repaint();
    return true;
  });

  /* সেভ/প্রুফের আগে ওই পেইজ অন্য কেউ প্রুফড করেছে কি না তাজা তথ্যে যাচাই (নেটওয়ার্ক ব্যর্থ হলে আটকানো হয় না) */
  const ownerOk = async (stem) => {
    if (!proofDbRef.current || IS_ADMIN) return true;
    try {
      const r = (await App.sb.get('page_proofs?book_id=eq.' + encU(BOOK_ID) + '&stem=eq.' + encU(stem) + '&select=user_id&limit=1'))[0];
      if (r && r.user_id !== ME) {
        ownersRef.current.set(stem, r.user_id); proofedRef.current.add(stem);
        toast('এই পেইজ অন্য ইউজার প্রুফড করেছেন — সেভ হয়নি (আপনার লেখা খসড়ায় নিরাপদ আছে)', true, 6000);
        return false;
      }
    } catch (e) { /* ignore */ }
    return true;
  };

  /* আপনার জন্য কোনো পেইজ নেই (সবই অন্যের প্রুফড) */
  const showNone = useEvent(() => {
    ++seq.current; tts.stop(); setCur(-1); viewReady.current = false;
    putText(''); setTaLoading(true); setPlaceholder(''); setOrig(''); setSha(null);
    if (imgRef.current) imgRef.current.removeAttribute('src');
    setImgMsg('আপনার জন্য কোনো পেইজ বাকি নেই — সব পেইজ অন্য ইউজার প্রুফড করেছেন');
    updateStatus();
  });

  /* মালিকানা বদলালে: তালিকা নতুন করে সাজানো; খোলা পেইজ অন্যের হয়ে গেলে নিকটতম দৃশ্যমান পেইজে সরানো */
  const applyProofs = useEvent(() => {
    closeDropdown(); repaint();
    const c = curRef.current;
    if (c >= 0 && isHid(c)) {
      const nx = stepVis(c, 1) >= 0 ? stepVis(c, 1) : stepVis(c, -1);
      toast('এই পেইজ অন্য ইউজার প্রুফড করেছেন — অন্য পেইজে নেওয়া হলো (আপনার অসংরক্ষিত লেখা খসড়ায় আছে)', true, 6000);
      if (nx >= 0) goPage(nx); else showNone();
    } else updateStatus();
  });

  /* GitHub-এর প্রুফড তালিকায় (proofed.json) শুধু এই একটি পেইজ যোগ/বাদ — প্রতিবার তাজা ফাইল পড়ে, তাই অন্যের এন্ট্রি মোছে না */
  const syncProofJson = async (stem, val) => {
    let lastErr = null;
    for (let att = 0; att < 2; att++) {
      const P = repoPaths(cfgRef.current);
      const r0 = await gh.api('/contents/' + epath(P.proofPath) + gh.refQ());
      let set, sh = null;
      if (r0.ok) {
        const j = await r0.json(); sh = j.sha; set = new Set();
        try { (JSON.parse(fromB64(j.content)).proofed || []).forEach((x) => set.add(x)); } catch (e) { /* ignore */ }
      } else if (r0.status === 404) set = new Set(proofedRef.current);          // নতুন ফাইল: এখনকার জানা তালিকা থেকে শুরু
      else throw new Error(await gh.errMsg(r0));
      if (val) set.add(stem); else set.delete(stem);
      const body = { message: 'Proofing status: ' + stem, content: toB64(JSON.stringify({ proofed: [...set].sort(natCmp) }, null, 2) + '\n') };
      if (sh) body.sha = sh;
      if (cfgRef.current.branch) body.branch = cfgRef.current.branch;
      const r = await gh.api('/contents/' + epath(P.proofPath), { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
      if (r.ok) {
        if (legacyProof.current) {
          legacyProof.current = false;
          if (IS_ADMIN) toast('প্রুফড তালিকা এখন ' + P.proofPath + '-এ সংরক্ষিত — রিপোর রুটের পুরনো ' + P.legacyProofPath + ' চাইলে মুছে ফেলতে পারেন', false, 7000);
        }
        return;
      }
      lastErr = new Error(await gh.errMsg(r));
      if (r.status !== 409 && r.status !== 422) break;               // শুধু sha-সংঘর্ষে আবার চেষ্টা
    }
    throw lastErr;
  };

  /* প্রুফড চিহ্ন দেওয়া/তোলা। ফেরত: সফল কিনা */
  const setProofedFlag = useEvent(async (stem, val) => {
    const refresh = () => { repaint(); updateStatus(); };
    const owners = ownersRef.current, proofed = proofedRef.current, reviews = reviewsRef.current;
    if (proofDbRef.current) {
      try {
        if (val) {
          try { await App.sb.post('page_proofs', { book_id: BOOK_ID, stem, user_id: ME }); owners.set(stem, ME); }
          catch (e) {
            if (!/409|23505|duplicate/i.test(e.message)) throw e;
            const r = (await App.sb.get('page_proofs?book_id=eq.' + encU(BOOK_ID) + '&stem=eq.' + encU(stem) + '&select=user_id&limit=1'))[0];
            if (r) owners.set(stem, r.user_id);
            if (r && r.user_id !== ME && !IS_ADMIN) {                 // অন্য ইউজার আগেই প্রুফড করে ফেলেছে
              proofed.add(stem); applyProofs();
              toast('এই পেইজ অন্য ইউজার আগেই প্রুফড করেছেন — আপনি এটি প্রুফড করতে পারবেন না', true, 6000);
              return false;
            }
          }
        } else {
          if (!IS_ADMIN && reviews.get(stem) && reviews.get(stem).s === 'approved') {
            toast('এই পেইজ অ্যাডমিন অনুমোদন করেছেন — প্রুফড চিহ্ন তোলা যাবে না', true, 5000);
            return false;
          }
          await App.sb.del('page_proofs?book_id=eq.' + encU(BOOK_ID) + '&stem=eq.' + encU(stem) + (IS_ADMIN ? '' : '&user_id=eq.' + encU(ME)));
          owners.delete(stem);
        }
      } catch (e) {
        toast('প্রুফড তালিকা সেভ ব্যর্থ: ' + e.message, true);
        refresh(); return false;
      }
    }
    let jerr = null;
    try { await syncProofJson(stem, val); } catch (e) { jerr = e; }
    if (jerr && !proofDbRef.current) {                                // পুরনো মোডে GitHub-ই একমাত্র সংরক্ষণ
      toast('প্রুফড তালিকা সেভ ব্যর্থ: ' + jerr.message, true);
      refresh(); return false;
    }
    if (val) proofed.add(stem); else proofed.delete(stem);
    if (proofDbRef.current) { loadDone(); try { App.log(val ? 'proof' : 'unproof', (BOOK.name || BOOK_ID) + ' / ' + stem); } catch (e) { /* ignore */ } }
    if (!val) reviews.delete(stem); else if (!reviews.has(stem)) reviews.set(stem, { s: 'pending', note: '' });
    if (jerr) toast('প্রুফড চিহ্ন সংরক্ষিত হয়েছে, কিন্তু প্রুফড তালিকা হালনাগাদ হয়নি: ' + jerr.message, true, 6000);
    refresh();
    return true;
  });

  /* ---------- সেভ ---------- */
  const saveText = useEvent(async () => {
    const i = curRef.current;
    if (i < 0 || taLoadingRef.current) return false;
    if (!isDirty()) return true;
    if (busy.current) return false;
    stashDraft();                       // নেটওয়ার্ক ব্যর্থ হলেও লোকালে লেখা থেকে যাবে
    busy.current = true; setOverride('সেভ হচ্ছে…');
    let blocked = false;
    try {
      if (!(await ownerOk(imagesRef.current[i].stem))) { blocked = true; return false; }   // অন্য ইউজার প্রুফড করে ফেললে সেভ হবে না
      const im = imagesRef.current[i], value = taRef.current.value;
      const body = { message: 'Proofread ' + im.stem + '.txt', content: toB64(value) };
      if (shaRef.current) body.sha = shaRef.current;
      if (cfgRef.current.branch) body.branch = cfgRef.current.branch;
      // texts/ ফোল্ডার না থাকলে GitHub এই পাথে ফাইল তৈরির সময় ফোল্ডারও তৈরি করে দেয়
      const r = await gh.api('/contents/' + epath(repoPaths(cfgRef.current).textsDir + '/' + im.stem + '.txt'),
        { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
      if (!r.ok) {
        toast(await gh.errMsg(r) + (r.status === 409 || r.status === 422 ? ' — রিলোড বাটন চেপে আবার চেষ্টা করুন (আপনার লেখা খসড়ায় নিরাপদ আছে)' : ''), true, 7000);
        return false;
      }
      const j = await r.json();
      setSha(j.content.sha); setOrig(value); textSetRef.current.add(im.stem);
      stashDraft();                     // সেভের মধ্যে আবার কিছু লিখলে সেটা খসড়া থাকবে, নইলে খসড়া মুছে যাবে
      repaint(); toast('সেভ হয়েছে');
      return true;
    } catch (e) { toast('সেভ ব্যর্থ: ' + e.message + ' (লেখা খসড়ায় নিরাপদ আছে)', true); return false; }
    finally { busy.current = false; updateStatus(); if (blocked) applyProofs(); }
  });

  /* ---------- পেইজ লোড ---------- */
  const maybeAutoOcr = useEvent(() => {
    clearTimeout(autoT.current);
    autoT.current = setTimeout(() => {
      const c = cfgRef.current.api1, i = curRef.current;
      if (!apiEnabledRef.current) return;                                  // অ্যাডমিন এপি আই বন্ধ রেখেছেন
      if (!c.auto || autoPause.current || apiRunRef.current) return;
      if (!c.key || !c.model || !c.prompt) return;                         // এপি আই - ১ কনফিগার করা নেই
      if (i < 0 || taLoadingRef.current || loadErrRef.current || initing.current) return;   // পেইজ/টেক্সট ঠিকমতো লোড হয়নি
      if (document.querySelector('dialog[open]') || lbRef.current.open) return;
      if (taRef.current.value.trim()) return;                              // টেক্সট (বা খসড়া) আছে
      const stem = imagesRef.current[i].stem;
      if (proofedRef.current.has(stem) || autoTried.current.has(stem)) return;   // প্রুফড বা এই সেশনে আগেই চলেছে
      runApi(1, { auto: true });
    }, 900);                                                               // দ্রুত পেইজ উল্টানোর সময় অযথা কল ঠেকাতে সামান্য অপেক্ষা
  });

  const onImgLoad = () => {
    const w = imgWait.current; if (!w) return;
    imgWait.current = null;
    if (w.my === seq.current) { setImgMsg(''); if (w.pv && imgBoxRef.current) imgBoxRef.current.scrollTo(w.pv.il || 0, w.pv.it || 0); }
    w.res();
  };
  const onImgError = () => {
    const w = imgWait.current; if (!w) return;
    imgWait.current = null;
    if (w.my === seq.current) setImgMsg('ছবি দেখানো যায়নি');
    w.res();
  };

  const loadPage = useEvent(async () => {
    tts.stop();                          // পেইজ বদলালে শোনা বন্ধ
    const my = ++seq.current, im = imagesRef.current[curRef.current], ta = taRef.current, imgEl = imgRef.current;
    // শেষবার বন্ধ হওয়ার অবস্থান ফেরত আনা হবে শুধু প্রথম লোডে
    const cv = cfgRef.current.view;
    const pv = (restoreOnce.current && cv && cv.stem === im.stem) ? cv : null;
    restoreOnce.current = false;
    viewReady.current = false; setLoadErr(false);
    closeLightbox();
    putText(''); setTaLoading(true); setPlaceholder(''); setOrig(''); setSha(null);
    imgEl.removeAttribute('src');
    ldrShow(imgCache.has(im.name) ? imgCache.pct(im.name) : 0);
    updateStatus();

    const imgP = imgCache.get(im.name).then((url) => new Promise((res) => {
      if (my !== seq.current) return res();
      setLdr((v) => (v === undefined ? v : 100));
      imgWait.current = { my, res, pv };
      imgEl.src = url;
      imgBoxRef.current.scrollTo(0, 0);
    })).catch((e) => { if (my === seq.current) setImgMsg('ছবি লোড ব্যর্থ: ' + e.message); });

    const txtP = (async () => {
      const r = await gh.api('/contents/' + epath(repoPaths(cfgRef.current).textsDir + '/' + im.stem + '.txt') + gh.refQ());
      if (my !== seq.current) return;
      let ok = true;
      if (r.status === 404) { setSha(null); putText(''); setOrig(''); }      // ফাইল/ফোল্ডার নেই → ফাঁকা ঘর
      else if (r.ok) {
        const j = await r.json();
        if (my !== seq.current) return;
        setSha(j.sha);
        setOrig(putText(j.content ? fromB64(j.content) : ''));              // textarea নিজে নতুন লাইন স্বাভাবিক করে, তাই তার মানই তুলনার ভিত্তি
      } else { ok = false; toast(await gh.errMsg(r), true); }
      if (my !== seq.current) return;
      if (ok) {
        const k = dk(im.stem), d = draftsRef.current[k];
        if (d && normNl(d.t) !== origRef.current) { putText(d.t); toast('অসংরক্ষিত খসড়া ফিরিয়ে আনা হয়েছে — সেভ করলে সংরক্ষিত হবে', false, 3500); }
        else if (d) { delete draftsRef.current[k]; persistDrafts(); }
        setTaLoading(false); ta.scrollTop = 0;
        setPlaceholder('এই পেইজের টেক্সট এখনো নেই — এখানে টেক্সট পেস্ট করে সেভ করুন');
        repaint();
      } else setLoadErr(true);
      updateStatus();
    })().catch((e) => { if (my === seq.current) { setLoadErr(true); toast('টেক্সট লোড ব্যর্থ: ' + e.message, true); updateStatus(); } });

    await Promise.all([imgP, txtP]);
    if (my !== seq.current) return;
    if (pv && !taLoadingRef.current) {
      const c = Math.min(pv.c || 0, ta.value.length);
      try { ta.setSelectionRange(c, c); } catch (e) { /* ignore */ }
      ta.scrollTop = pv.tt || 0;
    }
    viewReady.current = true;
    maybeAutoOcr();                      // টেক্সট ফাঁকা হলে এপি আই - ১ নিজে থেকে চলবে
    { const nx = stepVis(curRef.current, 1); if (nx >= 0) imgCache.get(imagesRef.current[nx].name).catch(() => {}); }   // পরের (দৃশ্যমান) ছবি আগাম লোড
  });

  const goPage = useEvent(async (i) => {
    const imgs = imagesRef.current;
    if (i < 0 || i >= imgs.length || i === curRef.current) return;
    if (isHid(i)) { toast('এই পেইজ অন্য ইউজার প্রুফড করেছেন — আপনি দেখতে পারবেন না', true); return; }
    if (busy.current) { toast('সেভ চলছে, একটু অপেক্ষা করুন'); return; }
    tts.stop();
    flush();                             // বর্তমান পেইজের খসড়া লোকালে রেখে যাই (কোনো কিছু হারাবে না)
    setCur(i);
    const stem = imgs[i].stem;
    setCfg((c) => ({ ...c, last: stem, view: (restoreOnce.current && c.view && c.view.stem === stem) ? c.view : null }), true);
    // task-এর "চালিয়ে যান" বাটনের জন্য: শেষ কিতাব ও পেইজ মনে রাখি (শুধু এই ডিভাইসে)
    try { localStorage.setItem('kp_resume_v1_' + ME, JSON.stringify({ b: BOOK_ID, s: stem, t: Date.now() })); } catch (e) { /* ignore */ }
    await loadPage();
  });

  /* ---------- সেটিংস ডায়ালগ ---------- */
  const openSettings = useEvent(() => {
    if (!IS_ADMIN) return;               // সেটিংস শুধু অ্যাডমিনের (অদৃশ্য মডাল খুললে পুরো পেইজ আটকে যেত)
    refreshVoices(); setSettingsOpen(true);
  });

  /* ---------- ইনিশিয়ালাইজ ---------- */
  const init = useEvent(async () => {
    if (initing.current) return;
    initing.current = true; initFailed.current = false;
    autoTried.current.clear();
    flush();
    setOverride('লোড হচ্ছে…');
    try {
      if (!cfgRef.current.token) toast('টোকেন নেই — শুধু দেখা যাবে, সেভ হবে না (সেটিংস থেকে টোকেন দিন)', true, 4500);

      // ডিফল্ট ব্রাঞ্চ ও লেখার অনুমতি জানা
      const ri = await gh.api('');
      if (!ri.ok) throw new Error(await gh.errMsg(ri));
      const info = await ri.json();
      repoPrivate.current = !!info.private;
      defaultBranch.current = info.default_branch || '';
      if (cfgRef.current.token && info.permissions && info.permissions.push === false)
        toast(IS_ADMIN ? 'এই টোকেনে রিপোতে লেখার অনুমতি নেই (Contents: Read and write দিন)' : 'এই টোকেনে সেভ করার অনুমতি নেই — টোকেন বদলে নিন', true, 6000);
      const br = cfgRef.current.branch || info.default_branch;

      // এক রিকোয়েস্টে পুরো ফাইল তালিকা (১০০০-এর বেশি পেইজেও কাজ করে)
      const rt = await gh.api('/git/trees/' + encodeURIComponent(br) + '?recursive=1');
      if (!rt.ok) throw new Error(await gh.errMsg(rt));
      const tj = await rt.json();
      if (tj.truncated) toast(IS_ADMIN ? 'সতর্কতা: রিপো খুব বড়, ফাইল তালিকা অসম্পূর্ণ হতে পারে' : 'সতর্কতা: পেইজ তালিকা অসম্পূর্ণ হতে পারে', true);
      const blobs = (tj.tree || []).filter((e) => e.type === 'blob');

      const P = repoPaths(cfgRef.current);
      const pp = P.pagesDir + '/', tp = P.textsDir + '/';
      const direct = (e, pre) => e.path.startsWith(pre) && e.path.indexOf('/', pre.length) < 0;

      const imgs = blobs.filter((e) => direct(e, pp) && /\.(jpe?g|png|webp)$/i.test(e.path))
        .map((e) => { const name = e.path.slice(pp.length); return { name, stem: name.replace(/\.[^.]+$/, '') }; })
        .sort((a, b) => natCmp(a.name, b.name));
      if (!imgs.length) throw new Error(P.pagesDir + '/ ফোল্ডারে কোনো ছবি নেই');

      const ts = new Set();
      blobs.forEach((e) => { if (direct(e, tp) && /\.txt$/i.test(e.path)) ts.add(e.path.slice(tp.length).replace(/\.txt$/i, '')); });
      if (!blobs.some((e) => e.path.startsWith(tp)))
        toast(IS_ADMIN ? P.textsDir + '/ ফোল্ডার এখনো নেই — প্রথম সেভ করলেই নিজে থেকে তৈরি হবে' : 'এখনো কোনো টেক্সট সেভ হয়নি — প্রথম সেভ করলেই শুরু হবে', false, 4500);

      let ps = new Set();
      const readProof = async (path) => {
        const r3 = await gh.api('/contents/' + epath(path) + gh.refQ());
        if (!r3.ok) return null;
        const j = await r3.json(), out = new Set();
        try { (JSON.parse(fromB64(j.content)).proofed || []).forEach((s) => out.add(s)); } catch (e) { /* ignore */ }
        return out;
      };
      legacyProof.current = false;
      if (blobs.some((e) => e.path === P.proofPath)) {
        const r = await readProof(P.proofPath);
        if (r) ps = r;
      } else if (P.proofDirName && blobs.some((e) => e.path === P.legacyProofPath)) {
        // পুরনো জায়গা (রিপোর রুট) থেকে পড়া: প্রথম সেভে নতুন ফোল্ডারে ফাইল তৈরি হবে
        const r = await readProof(P.legacyProofPath);
        if (r) { ps = r; legacyProof.current = true; }
      }

      imagesRef.current = imgs; textSetRef.current = ts; proofedRef.current = ps;
      ownersRef.current = new Map();
      const pr = await refreshProofs();                            // কে কোন পেইজ প্রুফড করেছে (Supabase)
      if (pr === false) throw new Error('প্রুফড মালিকানা আনা যায়নি (নেটওয়ার্ক) — রিলোড চাপুন');
      if (pr === 'none') toast(IS_ADMIN ? 'Supabase-এ page_proofs টেবিল নেই — supabase_page_proofs.sql চালান; তার আগে ইউজার-ভিত্তিক লুকানো কাজ করবে না' : 'প্রুফড মালিকানা সক্রিয় নেই (অ্যাডমিনকে জানান)', true, 7000);
      setCur(-1); repaint();
      let start = imgs.findIndex((im) => im.stem === (wantPage || cfgRef.current.last));   // লিংকের পেইজ, নইলে যেখানে ছিলেন সেখান থেকে শুরু
      if (start < 0 || isHid(start)) start = stepVis(-1, 1);       // নইলে প্রথম দৃশ্যমান পেইজ
      if (start < 0) { showNone(); return; }
      restoreOnce.current = true;
      await goPage(start);
    } catch (e) {
      initFailed.current = true;
      setOverride('');
      toast('সংযোগ ব্যর্থ: ' + e.message, true);
      openSettings();
    } finally { initing.current = false; }
  });

  /* রিপো/ব্রাঞ্চ/কিতাব/ফোল্ডার বদলালে শেষ-পেইজ রিসেট ও নতুন সংযোগ, যাতে পুরনো তালিকা থেকে ভুল ফোল্ডারে সেভ না হয় */
  const applyConnChange = () => {
    const c = cfgRef.current;
    if (connSig(c) !== connected.current.sig) {
      setCfg((x) => ({ ...x, last: '', view: null }));
      connected.current = { sig: connSig(c) };
      imgCache.clear(); forceInit.current = true;
    }
  };
  const onSettingsClose = () => {        // ডায়ালগ বন্ধ হলে: বদলালে বা প্রথমবার (তালিকা নেই) হলে সংযোগ শুরু
    setSettingsOpen(false); closeDropdown();
    applyConnChange();
    if (forceInit.current || (!imagesRef.current.length && !initFailed.current && !initing.current)) { forceInit.current = false; init(); }
  };
  const saveSettings = (f) => {
    if (!/^[^/\s]+\/[^/\s]+$/.test(normRepo(f.repo))) { toast('রিপো owner/repo আকারে দিন', true); return; }
    setCfg(normalizedPatch(f));
    tts.resetForce();                    // ইঞ্জিন/ভয়েস বদলালে স্বয়ংক্রিয় ফলব্যাক আবার প্রথম থেকে
    applyConnChange();
    imgCache.clear(); forceInit.current = true;
    setSettingsOpen(false);
  };

  /* ---------- কপি / পেস্ট (পেস্টের পর কার্সর শুরুতে) ---------- */
  /* replaceAll = true হলে আগের সব টেক্সট মুছে নতুন টেক্সট বসবে (আনডু (Ctrl+Z) কাজ করবে); নইলে নির্বাচন/কার্সরের জায়গায়।
     উভয় ক্ষেত্রে বসানোর পর কার্সর বসানো টেক্সটের শুরুতে থাকে। */
  const insertAtStart = (value, replaceAll, quiet) => {
    const ta = taRef.current;
    if (!value) return -1;
    let hn = -1;
    if (cfgRef.current.autoHead) { const r = markHeadings(value); value = r.text; hn = r.n; }
    ta.focus({ preventScroll: true });
    if (replaceAll) ta.setSelectionRange(0, ta.value.length);   // পুরো টেক্সট নির্বাচন → নতুন টেক্সট তার জায়গা নেবে
    const s = ta.selectionStart, e = ta.selectionEnd;
    let done = false;
    try { done = document.execCommand('insertText', false, value); } catch (_) { /* ignore */ }   // আনডু ঠিক রাখে
    if (!done) {
      ta.setRangeText(value, s, e, 'end');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
    ta.setSelectionRange(s, s);          // কার্সর বসানো টেক্সটের শুরুতে
    if (s === 0) ta.scrollTop = 0;
    if (!quiet) {
      if (replaceAll) toast('আগের টেক্সট মুছে নতুন টেক্সট বসানো হয়েছে' + (hn >= 0 ? ' • ' + hn + 'টি হেডিং চিহ্নিত (1 বসানো)' : ''));
      else if (hn >= 0) toast(hn + 'টি হেডিং চিহ্নিত হয়েছে (1 বসানো)');
    }
    lazyView();
    return hn;
  };
  const pasteClick = async () => {
    const ta = taRef.current;
    if (curRef.current < 0 || taLoadingRef.current) return;
    try {
      const t = await navigator.clipboard.readText();
      if (!t) { toast('ক্লিপবোর্ড খালি', true); return; }
      insertAtStart(t, true);            // পেস্ট বাটন: আগের সব টেক্সট মুছে নতুন টেক্সট
    } catch (e) {
      ta.focus();
      ta.select();                       // সব নির্বাচিত থাকবে, তাই হাতে পেস্ট করলেও আগের টেক্সট মুছে যাবে
      toast('ব্রাউজার ক্লিপবোর্ড পড়তে দিচ্ছে না — পুরো টেক্সট নির্বাচিত আছে, টেক্সট বক্সে চেপে ধরে/Ctrl+V দিয়ে পেস্ট করুন (আগের টেক্সট মুছে নতুনটি বসবে)', true, 6500);
    }
  };
  const copyClick = async () => {
    const ta = taRef.current;
    if (curRef.current < 0) return;
    const a = ta.selectionStart, b = ta.selectionEnd, part = a !== b;
    const value = part ? ta.value.slice(a, b) : ta.value;
    if (!value) { toast('কপি করার মতো টেক্সট নেই', true); return; }
    let ok = false;
    try { await navigator.clipboard.writeText(value); ok = true; }
    catch (e) {
      try { ta.focus(); if (!part) ta.select(); ok = document.execCommand('copy'); if (!part) ta.setSelectionRange(a, b); } catch (_) { /* ignore */ }
    }
    toast(ok ? (part ? 'নির্বাচিত অংশ কপি হয়েছে' : 'পুরো টেক্সট কপি হয়েছে') : 'কপি ব্যর্থ', !ok);
  };

  /* ---------- API (Gemini): এপি আই - ১ = ছবি → টেক্সট, এপি আই - ২ = টেক্সট প্রুফিং ----------
     ফল সরাসরি টেক্সট বক্সে বসে (পেস্টের মতোই: অটো হেডিং চালু থাকলে 1 বসে, আনডু চলে)। রিপোতে পুশ হয় না — দেখে সেভ করলে তবেই পুশ। */
  const imageB64 = async (im) => {
    let buf;
    try { buf = await (await fetch(await imgCache.get(im.name))).arrayBuffer(); }
    catch (e) {                                   // ক্যাশ-URL বাতিল হয়ে গেলে সরাসরি রিপো থেকে
      const r = await gh.api(gh.rawPath(im.name), { headers: { 'Accept': 'application/vnd.github.raw+json' } });
      if (!r.ok) throw new Error('ছবি আনা যায়নি: ' + await gh.errMsg(r));
      buf = await r.arrayBuffer();
    }
    return { mime: MIME_BY_EXT[extOf(im.name)] || 'image/jpeg', data: bytesToB64(buf) };
  };

  const applyApiResult = (n, stem, value, before, finish) => {
    const nm = API_NAME[n], ta = taRef.current;
    const probs = checkText(value), warn = [];
    if (finish === 'MAX_TOKENS') warn.push('আউটপুট অসম্পূর্ণ হতে পারে (MAX_TOKENS)');
    if (probs.length) warn.push(probs.join(' | '));
    const i = curRef.current;

    if (i >= 0 && imagesRef.current[i].stem === stem && !taLoadingRef.current) {
      if (ta.value !== before && !window.confirm(nm + ' চলার সময় এই পেইজের টেক্সট বদলেছে। তবুও ফল দিয়ে সব টেক্সট বদলাবেন?')) {
        try { const p = navigator.clipboard.writeText(value); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
        toast('ফল বসানো হয়নি (ক্লিপবোর্ডে কপির চেষ্টা করা হয়েছে)', true, 5000);
        return;
      }
      const hn = insertAtStart(value, true, true);        // পেস্টের মতো: আনডু চলে, অটো হেডিং চালু থাকলে 1 বসে
      try { if (window.matchMedia && matchMedia('(pointer:coarse)').matches) ta.blur(); } catch (e) { /* ignore */ }   // ফোনে কিবোর্ড খুলে থাকবে না
      const msg = nm + ' সম্পন্ন • ' + value.length + ' অক্ষর' + (hn > 0 ? ' • ' + hn + 'টি হেডিং চিহ্নিত' : '') + ' • দেখে নিয়ে সেভ করুন';
      if (warn.length) toast('সতর্কতা: ' + warn.join(' • ') + ' — ' + msg, true, 9000); else toast(msg, false, 4000);
    } else {
      // চলার সময় অন্য পেইজে চলে গেলে: ফল ওই পেইজের খসড়ায় রাখা হয়
      if (cfgRef.current.autoHead) value = markHeadings(value).text;
      draftsRef.current[dk(stem)] = { t: value, ts: Date.now() }; persistDrafts();
      repaint(); updateStatus();
      toast(nm + ' সম্পন্ন — ফল পেইজ ' + stem + '-এর খসড়ায় রাখা হয়েছে (ওই পেইজে গেলে দেখা যাবে, সেভ করলে সংরক্ষিত হবে)' + (warn.length ? ' • সতর্কতা: ' + warn.join(' • ') : ''), warn.length > 0, 7000);
    }
  };

  const openApiCfg = useEvent((n) => {
    if (!IS_ADMIN) return;
    setApiPickOpen(false); setApiCfgN(n);
  });

  const refreshApiFlag = useEvent(async () => {   // অ্যাডমিনের এপি আই চালু/বন্ধ (app_settings.api_enabled; ফাঁকা/কলাম না থাকলে চালু)
    try {
      const r = (await App.sb.get('app_settings?id=eq.1&select=api_enabled&limit=1'))[0];
      const on = !(r && r.api_enabled === false);
      if (on !== apiEnabledRef.current) {
        setApiEnabled(on);
        if (!on) { if (apiRunRef.current) apiRunRef.current.ctrl.abort(); toast('অ্যাডমিন এপি আই বন্ধ করেছেন', true); }
        else { toast('এপি আই চালু হয়েছে'); maybeAutoOcr(); }
      }
    } catch (e) { /* নেটওয়ার্ক/কলাম সমস্যায় আগের অবস্থাই থাকে */ }
    return apiEnabledRef.current;
  });

  const runApi = useEvent(async (n, opts) => {
    const auto = !!(opts && opts.auto);
    if (apiRunRef.current) { toast(API_NAME[apiRunRef.current.n] + ' চলছে — শেষ হওয়া পর্যন্ত অপেক্ষা করুন', true); return; }
    if (apiChecking.current) return;
    apiChecking.current = true;
    try { await refreshApiFlag(); } finally { apiChecking.current = false; }   // চালানোর ঠিক আগে অ্যাডমিনের সর্বশেষ অবস্থা দেখে নেওয়া
    if (!apiEnabledRef.current) { if (!auto) toast('এপি আই বন্ধ আছে — অ্যাডমিন চালু করলে ব্যবহার করা যাবে', true); return; }
    if (apiRunRef.current) return;
    if (curRef.current < 0 || taLoadingRef.current) { toast('আগে পেইজ লোড হতে দিন', true); return; }
    const c = cfgRef.current['api' + n], nm = API_NAME[n];
    const key = (c.key || (n === 2 ? cfgRef.current.api1.key : '') || '').trim();
    if (!key) { toast(nm + ': API Key দেওয়া নেই', true); openApiCfg(n); return; }
    if (!c.model) { toast(nm + ': Model দেওয়া নেই', true); openApiCfg(n); return; }
    if (!c.prompt) { toast(nm + ': Prompt খালি', true); openApiCfg(n); return; }

    const im = imagesRef.current[curRef.current], stem = im.stem, before = taRef.current.value;
    if (n === 1 && before.trim() && !window.confirm('এই পেইজে আগে থেকেই টেক্সট আছে। ' + nm + ' চালালে ছবি থেকে নতুন টেক্সট এসে আগেরটা বদলে দেবে (সেভ না করা পর্যন্ত রিপোতে বদলায় না; আনডু চলে)। চালাবেন?')) return;
    if (n === 2 && !before.trim()) { toast('প্রুফ করার মতো টেক্সট নেই — আগে ' + API_NAME[1] + ' চালান বা টেক্সট বসান', true); return; }

    const ctrl = new AbortController();
    setApiRun({ n, stem, ctrl, chars: 0 });
    if (n === 1) autoTried.current.add(stem);   // হাতে চালালেও এই পেইজে আর অটো চলবে না (থামালে আবার নিজে থেকে শুরু হবে না)
    toast((auto ? 'অটো: ' : '') + nm + ' চলছে — পেইজ ' + stem + '…', false, 2500);
    let lastUI = 0;
    try {
      const parts = [];
      if (n === 1) {
        const img64 = await imageB64(im);
        parts.push({ text: c.prompt }, { inline_data: { mime_type: img64.mime, data: img64.data } });
      } else {
        let p = c.prompt;
        if (/\{\{TEXT\}\}/.test(p)) p = p.replace(/\{\{TEXT\}\}/g, () => before);
        else p += '\n\n===== OCR টেক্সট শুরু =====\n' + before + '\n===== OCR টেক্সট শেষ =====\n';
        parts.push({ text: p });
        if (c.sendImg) { const img64 = await imageB64(im); parts.push({ inline_data: { mime_type: img64.mime, data: img64.data } }); }
      }
      const res = await callGemini({
        key, model: c.model, parts, temp: Number.isFinite(+c.temp) ? +c.temp : 0, signal: ctrl.signal,
        onProgress: (ch) => { const t = Date.now(); if (t - lastUI > 400) { lastUI = t; setApiRun((r) => (r ? { ...r, chars: ch } : r)); } }
      });
      setApiRun(null);
      applyApiResult(n, stem, res.text, before, res.finish);
    } catch (e) {
      const em = (e && e.message) || String(e);
      if (e && e.name === 'AbortError') toast(nm + ' থামানো হয়েছে');
      else if (auto && /^(400|401|403|404|429):/.test(em)) {
        autoPause.current = true;          // Key/মডেল/কোটার সমস্যায় প্রতি পেইজে একই ত্রুটি না দেখিয়ে অটো থামানো
        toast('অটো ' + nm + ' ব্যর্থ: ' + em + ' — অটো সাময়িক বন্ধ (API ডায়ালগে সংরক্ষণ করলে আবার চালু)', true, 9000);
      } else toast((auto ? 'অটো ' : '') + nm + ' ব্যর্থ: ' + em + (auto ? ' — হাতে চালাতে API আইকন চাপুন' : ''), true, 8000);
    } finally { setApiRun(null); maybeAutoOcr(); }
  });

  const toggleAutoApi = () => {
    const on = !cfgRef.current.api1.auto;
    setCfg((c) => ({ ...c, api1: { ...c.api1, auto: on } })); autoPause.current = false;
    if (!apiEnabledRef.current) { toast('এপি আই এখন বন্ধ (অ্যাডমিন) — চালু হলে এই সেটিং কাজ করবে', true); return; }
    if (on) {
      toast(!cfgRef.current.api1.key ? 'অটো OCR চালু — তবে ' + API_NAME[1] + '-এর Key এখনো দেওয়া নেই' : 'অটো OCR চালু (সবুজ)');
      maybeAutoOcr();
    } else { clearTimeout(autoT.current); toast('অটো OCR বন্ধ (লাল) — নিজে থেকে আর চলবে না'); }
  };
  const apiBtnClick = () => {
    const r = apiRunRef.current;
    if (r) { if (window.confirm(API_NAME[r.n] + ' চলছে। থামাবেন?')) r.ctrl.abort(); return; }
    setApiPickOpen(true);
  };

  /* ---------- বাটনের কাজ ---------- */
  const jumpTo = () => {
    const n = parseInt(jumpRef.current.value, 10);
    if (!n) return;
    const imgs = imagesRef.current;
    let i = imgs.findIndex((im) => numOf(im.stem) === n);
    if (i < 0 && n >= 1 && n <= imgs.length) i = n - 1;
    if (i < 0) { toast('এই নম্বরের পেইজ নেই', true); return; }
    if (isHid(i)) { toast('এই পেইজ অন্য ইউজার প্রুফড করেছেন — আপনি দেখতে পারবেন না', true); return; }
    goPage(i);
  };
  const nextUnproofed = () => {
    const imgs = imagesRef.current;
    for (let k = 1; k <= imgs.length; k++) {
      const i = (curRef.current + k) % imgs.length;
      if (!isHid(i) && !proofedRef.current.has(imgs[i].stem)) { goPage(i); return; }
    }
    toast('সব পেইজ প্রুফড!');
  };
  const toggleAutoHead = () => {
    const on = !cfgRef.current.autoHead; setCfg({ autoHead: on });
    toast(on ? 'অটো হেডিং চালু — পেস্টে হেডিংয়ের আগে 1 বসবে' : 'অটো হেডিং বন্ধ');
  };

  /* "সেভ ও পরের": সেভ → প্রুফড চিহ্ন → পরের পেইজ (লোডিং টোস্টসহ) */
  const proofAndNext = async () => {
    const ta = taRef.current;
    if (curRef.current < 0 || taLoadingRef.current || proofRunning.current) return;
    if (!shaRef.current && !ta.value.trim() && !window.confirm('এই পেইজে কোনো টেক্সট নেই। তবুও প্রুফড চিহ্নিত করবেন?')) return;
    proofRunning.current = true; setProofBusy(true);
    const i = curRef.current, stem = imagesRef.current[i].stem, nxt = stepVis(i, 1), isLast = nxt < 0, needProof = !proofedRef.current.has(stem);
    let k = 0;
    T.loadingStart(1 + (needProof ? 1 : 0) + (isLast ? 0 : 1));
    try {
      T.loadingStep(++k, isDirty() ? 'টেক্সট সেভ হচ্ছে…' : 'সেভ যাচাই হচ্ছে…');
      if (!(await saveText())) { T.loadingHide(); return; }
      if (needProof) {
        T.loadingStep(++k, 'প্রুফড চিহ্নিত হচ্ছে…');
        if (!(await setProofedFlag(stem, true))) { T.loadingHide(); return; }
      } else {
        const rv = reviewsRef.current.get(stem);
        if (proofDbRef.current && rv && rv.s === 'correction' && ownersRef.current.get(stem) === ME) {
          // অ্যাডমিন "সংশোধন দরকার" দিয়েছিলেন → ঠিক করে আবার জমা: রিভিউ আবার "বাকি"
          try {
            await App.sb.patch('page_proofs?book_id=eq.' + encU(BOOK_ID) + '&stem=eq.' + encU(stem) + '&user_id=eq.' + encU(ME), { review_status: 'pending', review_note: null, reviewed_at: null });
            reviewsRef.current.set(stem, { s: 'pending', note: '' }); repaint(); updateStatus();
            try { App.log('resubmit', (BOOK.name || BOOK_ID) + ' / ' + stem); } catch (e) { /* ignore */ }
            toast('সংশোধিত পেইজ আবার রিভিউয়ের জন্য জমা হয়েছে');
          } catch (e) { toast('পুনরায় জমা ব্যর্থ: ' + e.message, true); }
        }
      }
      if (!isLast) {
        T.loadingStep(++k, 'পরের পেইজ লোড হচ্ছে…');
        await goPage(nxt);
        T.loadingDone('সেভ ও প্রুফড হয়েছে • পরের পেইজ খোলা হয়েছে');
      } else T.loadingDone('শেষ পেইজ — সেভ ও প্রুফড হয়েছে');
    } finally {
      if (T.isLoading() && !T.isFinishing()) T.loadingHide();
      proofRunning.current = false; setProofBusy(false);
    }
  };
  const toggleProofClick = async () => {
    if (curRef.current < 0) return;
    const stem = imagesRef.current[curRef.current].stem;
    await setProofedFlag(stem, !proofedRef.current.has(stem));
  };
  const discardClick = () => {
    if (curRef.current < 0 || taLoadingRef.current) return;
    if (!isDirty()) { toast('বাতিল করার মতো অসংরক্ষিত পরিবর্তন নেই'); return; }
    if (!window.confirm('এই পেইজের অসংরক্ষিত পরিবর্তন/খসড়া বাতিল করে রিপোর টেক্সট ফিরিয়ে আনবেন?')) return;
    putText(origRef.current); stashDraft(); updateStatus(); toast('খসড়া বাতিল হয়েছে');
  };

  const zoom = (d) => setCfg((c) => ({ ...c, zoom: d === 0 ? 100 : Math.min(400, Math.max(50, c.zoom + d)) }));
  const fontSize = (d) => setCfg((c) => ({ ...c, fs: Math.min(40, Math.max(12, c.fs + d)) }));

  const onTaInput = () => {
    setText(taRef.current.value);
    clearTimeout(draftT.current); draftT.current = setTimeout(stashDraft, 300);   // টাইপ করলেই (০.৩ সেকেন্ড থেমে) খসড়া সংরক্ষণ
    lazyView(); tts.markStale();
  };
  const onTaPaste = (e) => {   // সাধারণ পেস্ট (Ctrl+V / লং-প্রেস): নির্বাচন/কার্সরের জায়গায় বসে, তারপর কার্সর শুরুতে থাকে
    const t = e.clipboardData && e.clipboardData.getData('text');
    if (!t) return;
    e.preventDefault();
    insertAtStart(t, false);
  };

  /* ---------- কিবোর্ড শর্টকাট ---------- */
  const onKey = useEvent((e) => {
    if (e.key === 'Escape' && lbRef.current.open) { e.preventDefault(); closeLightbox(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveText(); }
    else if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); goPage(stepVis(curRef.current, 1)); }
    else if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); goPage(stepVis(curRef.current, -1)); }
  });

  /* ---------- জীবনচক্র ---------- */
  useLayoutEffect(() => {                  // সেটিংস ও API বাটন শুধু অ্যাডমিনের জন্য দৃশ্যমান (CSS: body.is-admin)
    document.body.classList.toggle('is-admin', IS_ADMIN);
    return () => document.body.classList.remove('is-admin');
  }, [IS_ADMIN]);

  useLayoutEffect(() => () => {            // পেইজ ছাড়ার সময়: সবকিছু লোকালে রেখে শোনা বন্ধ (এলিমেন্ট থাকতেই)
    flush(); tts.stop();
    clearTimeout(autoT.current); clearTimeout(draftT.current); clearTimeout(viewT.current);
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const syncProofs = async () => { if (initing.current || busy.current || !imagesRef.current.length) return; if (await refreshProofs() === true) applyProofs(); };
    const onVis = () => {
      if (document.visibilityState === 'hidden') { flush(); return; }
      loadDone(); refreshApiFlag(); syncProofs();     // ট্যাবে ফিরলে: সংখ্যা, এপি আই চালু/বন্ধ, অন্যদের নতুন প্রুফড পেইজ
    };
    const onHide = () => { flush(); tts.stop(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onHide);
    document.addEventListener('keydown', onKey);
    const t1 = setInterval(() => { if (document.visibilityState === 'visible') refreshApiFlag(); }, 30000);
    const t2 = setInterval(() => { if (document.visibilityState === 'visible') syncProofs(); }, 60000);
    const wheel = (bar) => (e) => {          // হেডার/ফুটারে মাউসের চাকা ঘোরালে আড়াআড়ি স্ক্রল (ডেস্কটপের জন্য)
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && bar.scrollWidth > bar.clientWidth) { bar.scrollLeft += e.deltaY; e.preventDefault(); }
    };
    const bars = [hdrRef.current, ftrRef.current].filter(Boolean).map((b) => { const f = wheel(b); b.addEventListener('wheel', f, { passive: false }); return [b, f]; });
    loadDone();
    if (!cfgRef.current.token && IS_ADMIN) openSettings();   // অ্যাডমিন: টোকেন না থাকলে সেটিংস খুলবে; ইউজারের টোকেন Supabase থেকে আসে
    else init();
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onHide);
      document.removeEventListener('keydown', onKey);
      clearInterval(t1); clearInterval(t2);
      bars.forEach(([b, f]) => b.removeEventListener('wheel', f));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ================= রেন্ডারের জন্য হিসাব ================= */
  const images = imagesRef.current;
  const hasCur = cur >= 0 && !!images[cur];
  const dirty = hasCur && !taLoading && text !== orig;
  const stem = hasCur ? images[cur].stem : '';
  const pf = hasCur && proofedRef.current.has(stem);
  const autoOn = !!cfg.api1.auto;

  const pageOptions = useMemo(() => {
    const o = [];
    imagesRef.current.forEach((im, i) => { if (!isHid(i)) o.push({ value: String(i), label: labelOf(im) }); });
    return o;
  }, [rev]); // eslint-disable-line react-hooks/exhaustive-deps

  let stText = '', stCls = '';
  if (override != null) stText = override;
  else if (hasCur) {
    const vis = visIdx();
    let t = (vis.indexOf(cur) + 1) + '/' + vis.length;
    if (loadErr) t += ' • টেক্সট লোড ব্যর্থ (রিলোড চাপুন)';
    else if (taLoading) t += ' • লোড হচ্ছে…';
    else t += dirty ? ' • অসংরক্ষিত' : (sha ? ' • সেভড' : ' • টেক্সট নেই (পেস্ট করে সেভ করুন)');
    if (pf) t += ' • প্রুফড' + ownerTag(stem);
    const rv = reviewsRef.current.get(stem);
    if (rv && ownersRef.current.get(stem) === ME) t += rv.s === 'approved' ? ' • অনুমোদিত' : rv.s === 'correction' ? ' • সংশোধন দরকার' + (rv.note ? ' (' + rv.note + ')' : '') : ' • রিভিউ বাকি';
    if (!apiEnabled) t += ' • এপি আই বন্ধ';
    if (apiRun) t += ' • ' + API_NAME[apiRun.n] + ' চলছে' + (apiRun.stem !== stem ? ' (' + apiRun.stem + ')' : '') + (apiRun.chars ? ' ' + apiRun.chars + ' অক্ষর' : '') + '…';
    stText = t; stCls = (dirty || loadErr) ? 'dirty' : '';
  }
  const nDrafts = Object.keys(draftsRef.current).filter((k) => k.startsWith(cfg.repo + '/')).length;
  const playing = ttsState === 'playing';

  return (
    <>
      <Sprite />
      <header id="hdr" ref={hdrRef}>
        <button id="btnBack" className="ico" title="কাজের তালিকায় ফিরুন" aria-label="ফিরুন" onClick={() => navTo('task')}><Ic n="left" /></button>{' '}
        <button id="btnSettings" className="ico" title="সেটিংস / টোকেন" aria-label="সেটিংস" onClick={openSettings}><Ic n="settings" /></button>{' '}
        <button id="btnReload" className="ico" title="রিপো থেকে তালিকা ও বর্তমান পেইজ নতুন করে লোড করুন" aria-label="রিলোড" onClick={() => { imgCache.clear(); init(); }}><Ic n="refresh" /></button>{' '}
        <button id="btnPrev" className="ico" title="আগের পেইজ (Alt+←)" aria-label="আগের পেইজ" onClick={() => goPage(stepVis(curRef.current, -1))}><Ic n="left" /></button>
        <Dropdown id="sel" value={String(cur)} options={pageOptions} onChange={(v) => goPage(parseInt(v, 10))} />
        <button id="btnNext" className="ico" title="পরের পেইজ (Alt+→)" aria-label="পরের পেইজ" onClick={() => goPage(stepVis(curRef.current, 1))}><Ic n="right" /></button>{' '}
        <input id="jump" ref={jumpRef} type="number" min="1" inputMode="numeric" placeholder="পেইজ" onKeyDown={(e) => { if (e.key === 'Enter') jumpTo(); }} />{' '}
        <button id="btnGo" onClick={jumpTo}>যাও</button>{' '}
        <button id="btnNextUn" title="পরের অপ্রুফড পেইজে যান" onClick={nextUnproofed}><Ic n="skip" /><span /></button>{' '}
        <button id="btnSwap" className="ico" title="ছবি ও টেক্সটের পাশ বদলান" aria-label="পাশ বদলান" onClick={() => setCfg({ swap: !cfg.swap })}><Ic n="swap" /></button>{' '}
        <button id="btnAuto" className={cfg.autoHead ? 'on' : ''} aria-pressed={cfg.autoHead ? 'true' : 'false'}
          title="চালু থাকলে পেস্ট করা টেক্সটের প্রতিটি হেডিংয়ের আগে (স্পেস ছাড়া) 1 বসবে" onClick={toggleAutoHead}>
          <Ic n="tag" /><span>হেডিং: {cfg.autoHead ? 'চালু' : 'বন্ধ'}</span>
        </button>{' '}
        <span id="ttsBox">
          <button id="btnPlay" className={playing ? 'on' : ''} onClick={() => tts.click()}
            title="টেক্সট শুনুন — নির্বাচিত অংশ, না থাকলে কার্সর থেকে শেষ পর্যন্ত (শুরুর সময় সার্ভিস বাছার ডায়ালগ আসবে)">
            <Ic n={playing ? 'pause' : 'play'} /><span>{playing ? 'বিরতি' : (ttsState === 'paused' ? 'চালান' : 'শুনুন')}</span>
          </button>{' '}
          <button id="btnStop" className="ico" title="শোনা বন্ধ করুন" aria-label="থামান" disabled={ttsState === 'idle'} onClick={() => { tts.stop(); toast('শোনা বন্ধ'); }}><Ic n="stop" /></button>
          <Dropdown id="ttsRate" value={RATES.some((r) => r.value === String(cfg.ttsRate || 1)) ? String(cfg.ttsRate || 1) : '1'} options={RATES}
            title="পড়ার গতি" ariaLabel="পড়ার গতি" onChange={(v) => { setCfg({ ttsRate: parseFloat(v) || 1 }); tts.setRate(); }} />
        </span>{' '}
        <span id="apiBox" className={apiEnabled ? '' : 'off'}>
          <button id="btnAutoApi" className={'ico ' + (autoOn ? 'on' : 'off')} aria-label="অটো OCR" aria-pressed={autoOn ? 'true' : 'false'} onClick={toggleAutoApi}
            title={!apiEnabled ? 'এপি আই বন্ধ — অ্যাডমিন বন্ধ রেখেছেন, তাই অটো OCR চলবে না' : autoOn
              ? 'অটো OCR চালু (সবুজ) — ' + API_NAME[1] + '-এর Key দেওয়া থাকলে টেক্সট ফাঁকা পেইজ খুললে নিজে থেকে চলবে। বন্ধ করতে চাপুন'
              : 'অটো OCR বন্ধ (লাল) — API কনফিগার থাকলেও নিজে থেকে চলবে না (হাতে API আইকন থেকে চালানো যাবে)। চালু করতে চাপুন'}>
            <Ic n="bolt" />
          </button>
          <button id="btnApi" className={'ico' + (apiRun ? ' run' : '')} aria-label="API" onClick={apiBtnClick}
            title={!apiEnabled ? 'এপি আই বন্ধ (অ্যাডমিন বন্ধ রেখেছেন)' : apiRun ? API_NAME[apiRun.n] + ' চলছে — থামাতে চাপুন' : 'API — ছবি থেকে টেক্সট (এপি আই - ১) / টেক্সট প্রুফিং (এপি আই - ২)'}>
            <Ic n="api" />
          </button>
        </span>
      </header>

      <div id="status">
        <span id="imgTools">
          <button id="btnDl" className="ico" title="এই পেইজের মূল ছবি ডাউনলোড করুন" aria-label="ডাউনলোড" onClick={downloadCurrent}><Ic n="download" /></button>{' '}
          <button id="btnLens" className="ico" title="এই পেইজের ছবি Google Lens-এ খুলুন (টেক্সট কপি করার জন্য)" aria-label="Google Lens" onClick={openLens}><Ic n="lens" /></button>{' '}
          <button id="btnAiCopy" className="ico" title="AI প্রম্পট কপি — GitHub ডাউনলোড অংশ + এই পেইজের ছবির raw লিংক + OCR প্রম্পট (Supabase), একসাথে ক্লিপবোর্ডে" aria-label="AI প্রম্পট কপি" onClick={aiCopy}><Ic n="sparkle" /></button>
        </span>{' '}
        <span id="doneCnt" hidden={doneCnt == null} title="আপনার সম্পন্ন (প্রুফড) টাস্ক" aria-label="আপনার সম্পন্ন টাস্ক">{doneCnt == null ? '' : bnNum(doneCnt)}</span>{' '}
        <span id="stText" className={stCls} role="status" aria-live="polite">{stText}</span>
      </div>

      <main id="main" className={cfg.swap ? 'swap' : ''} style={{ '--fs': cfg.fs + 'px' }}>
        <section className="pane pane-img">
          <div className="bar">
            <span>ছবি</span>{' '}
            <span className="seg" role="group" aria-label="ছবির জুম">
              <button id="zOut" className="ico" title="ছোট করুন" aria-label="জুম আউট" onClick={() => zoom(-25)}><V n="minus" /></button>
              <span id="zVal" aria-live="polite">{cfg.zoom}%</span>
              <button id="zIn" className="ico" title="বড় করুন" aria-label="জুম ইন" onClick={() => zoom(25)}><V n="plus" /></button>
            </span>
            <button id="zFit" title="ছবি প্যানেলে ফিট করুন (১০০%)" onClick={() => zoom(0)}><V n="fit" /><span>ফিট</span></button>
          </div>
          <div className="body" id="imgBox" ref={imgBoxRef} onScroll={lazyView}>
            <img id="img" ref={imgRef} alt="" title="বড় করে দেখতে ক্লিক করুন" style={{ width: cfg.zoom + '%' }} onClick={openLightbox} onLoad={onImgLoad} onError={onImgError} />
            <div className="msg" id="imgMsg">{ldr !== undefined ? <ImageLoader key={ldrKey} target={ldr} /> : imgMsg}</div>
          </div>
        </section>
        <section className="pane pane-txt">
          <div className="bar">
            <span>টেক্সট</span>{' '}
            <span className="seg" role="group" aria-label="ফন্টের মাপ">
              <button id="fOut" className="ico" title="ফন্ট ছোট" aria-label="ফন্ট ছোট" onClick={() => fontSize(-2)}><V n="fontDown" /></button>
              <button id="fIn" className="ico" title="ফন্ট বড়" aria-label="ফন্ট বড়" onClick={() => fontSize(2)}><V n="fontUp" /></button>
            </span>{' '}
            <button id="btnCopy" className="ico" title="কপি (নির্বাচিত অংশ, না থাকলে পুরো টেক্সট)" aria-label="কপি" onClick={copyClick}><Ic n="copy" /></button>{' '}
            <button id="btnPaste" className="ico" title="পেস্ট (আগের সব টেক্সট মুছে নতুন টেক্সট বসবে, কার্সর শুরুতে থাকবে)" aria-label="পেস্ট" onClick={pasteClick}><Ic n="paste" /></button>{' '}
            <span id="txtInfo" title="খসড়া = এই ব্রাউজারে সংরক্ষিত অসংরক্ষিত খসড়ার সংখ্যা">{hasCur ? text.length + ' অক্ষর' + (nDrafts ? ' • খসড়া ' + nDrafts : '') : ''}</span>
          </div>
          <div className="body">
            <Highlight store={hlStore} taRef={taRef} />
            <textarea id="ta" ref={taRef} spellCheck="false" dir="ltr" disabled={taLoading} placeholder={placeholder}
              onInput={onTaInput} onPaste={onTaPaste} onScroll={lazyView} onKeyUp={lazyView} onClick={lazyView} />
          </div>
        </section>
      </main>

      <footer id="ftr" ref={ftrRef}>
        <button id="btnSave" title="এই পেইজের টেক্সট সেভ" onClick={() => saveText()}><Ic n="save" /><span>সেভ</span></button>{' '}
        <button id="btnProof" className="primary" title="সেভ করে প্রুফড চিহ্নিত করুন এবং পরের পেইজে যান" aria-busy={proofBusy ? 'true' : undefined} onClick={proofAndNext}><Ic n="checkc" /><span>সেভ ও পরের</span></button>{' '}
        <button id="btnToggleProof" className={pf ? 'on' : ''} title={pf ? 'প্রুফড চিহ্ন আছে — বাতিল করতে চাপুন' : 'প্রুফড হিসেবে চিহ্নিত করুন'} onClick={toggleProofClick}><Ic n={pf ? 'checksq' : 'square'} /><span>প্রুফড</span></button>{' '}
        <button id="btnDiscard" title="এই পেইজের অসংরক্ষিত পরিবর্তন/খসড়া বাতিল করে রিপোর টেক্সট ফিরিয়ে আনুন" onClick={discardClick}><Ic n="trash" /><span>বাতিল</span></button>
      </footer>

      {/* লাইটবক্স: ছবিতে ক্লিক করলে পপআপ, যেকোনো জায়গায় ক্লিক করলে বন্ধ */}
      <div id="lb" className={lb.open ? 'open' : ''} aria-hidden={lb.open ? 'false' : 'true'} onClick={closeLightbox}>
        <div id="lbTitle">{lb.title}</div>
        <button id="lbDl" title="মূল ছবি ডাউনলোড" aria-label="ডাউনলোড" onClick={(e) => { e.stopPropagation(); downloadCurrent(); }}><Ic n="download" /></button>{' '}
        <button id="lbClose" title="বন্ধ করুন (Esc)" aria-label="বন্ধ করুন" onClick={(e) => { e.stopPropagation(); closeLightbox(); }}><V n="close" /></button>{' '}
        <img id="lbImg" alt="" src={lb.open ? lb.src : undefined} />
      </div>

      <SettingsDialog open={settingsOpen} onClose={onSettingsClose} cfg={cfg} setCfg={setCfg} voices={voices}
        onEngine={(v) => { setCfg({ ttsEngine: v }); tts.resetForce(); }}
        onClearToken={() => { setCfg({ token: '' }); toast('টোকেন মুছে ফেলা হয়েছে'); }}
        onSave={saveSettings} />
      <ApiDialogs pickOpen={apiPickOpen} onPickClose={() => setApiPickOpen(false)} onPick={openApiCfg}
        cfgN={apiCfgN} onCfgClose={() => setApiCfgN(null)} cfg={cfg} setCfg={setCfg} apiEnabled={apiEnabled}
        stem={stem} onRun={runApi} onFormSaved={() => { autoPause.current = false; }} toast={toast} />
      <TtsDialog open={tsOpen} onClose={onTsClose} cfg={cfg} setCfg={setCfg} voices={voices} onGo={onTsGo} />
      <Toasts toaster={T} />
    </>
  );
}
