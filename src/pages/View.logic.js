/* eslint-disable */
// view.html-এর ইনলাইন <script> — অপরিবর্তিত লজিক। মার্কআপ রেন্ডার হওয়ার পর একবার চলে (PageShell → runLegacy)।
// `location` এখানে নেভিগেশন-ব্রিজ (নিচের প্যারামিটার): location.href='task.html' → রিয়্যাক্ট রাউটার।
export default function run(App, location) {

  window.__KP_READY = (async () => {
    const u = await App.requireAuth();                       // লগইন/ডিভাইস না মিললে login.html-এ পাঠায়
    const id = new URLSearchParams(location.search).get('book');
    const go = () => { location.replace('task.html'); return new Promise(() => {}); };
    if (!id) return go();
    let b = null, s = {};
    try { b = (await App.sb.get('books?id=eq.' + encodeURIComponent(id) + '&limit=1'))[0]; } catch (e) {}
    if (!b) return go();
    try { s = (await App.sb.get('app_settings?id=eq.1&limit=1'))[0] || {}; } catch (e) {}
    return {uid: u.id, isAdmin: App.isAdminPhone(u.phone), book: b, settings: s};
  })();


  /* ---- পরের <script> ব্লক ---- */

  (async () => {
    const CTX = await window.__KP_READY;
    // ---------- স্থায়ী সংরক্ষণ ----------
    // localStorage-এর পাশাপাশি, এক্সটেনশনে হলে chrome.storage.local-এও (Token, API Key, Prompt, Model, সেটিংস, খসড়া) অনুলিপি রাখা হয়।
    // শুরুতে সেখান থেকে ফিরিয়ে আনা হয়, তাই প্রতিবার নতুন করে দিতে হয় না। সাধারণ HTML-এ শুধু localStorage (+ স্থায়ী-স্টোরেজ অনুরোধ)।
    const KP_EXT = (typeof browser !== 'undefined' && browser.storage && browser.storage.local) ? browser
                 : (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) ? chrome : null;
    const KP_SFX = ':' + CTX.uid + ':' + CTX.book.id;
    const KP_KEYS = ['kitab_proof_cfg_v1' + KP_SFX, 'kitab_proof_drafts_v1' + KP_SFX];
    const kpPend = {}; let kpT = 0;
    function kpFlush() {
      clearTimeout(kpT);
      const o = {...kpPend}; Object.keys(kpPend).forEach(k => delete kpPend[k]);
      if (!KP_EXT || !Object.keys(o).length) return;
      try { const p = KP_EXT.storage.local.set(o); if (p && p.catch) p.catch(() => {}); } catch (e) {}
    }
    function kpMirror(k, v) { if (!KP_EXT) return; kpPend[k] = v; clearTimeout(kpT); kpT = setTimeout(kpFlush, 200); }
    addEventListener('pagehide', kpFlush);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') kpFlush(); });
    if (KP_EXT) {
      try {
        const got = await KP_EXT.storage.local.get(KP_KEYS);
        for (const k of KP_KEYS) {
          if (typeof got[k] === 'string' && got[k]) { try { localStorage.setItem(k, got[k]); } catch (e) {} }   // এক্সটেনশন স্টোরেজই মূল
          else { let v = null; try { v = localStorage.getItem(k); } catch (e) {} if (v) kpMirror(k, v); }         // আগের localStorage থেকে স্থানান্তর
        }
      } catch (e) {}
    }
    // ---------- ক্লিক রিপল ইফেক্ট ----------
    // বোতাম ও ড্রপডাউনের আইটেমে চাপলে (মাউস/টাচ/কিবোর্ড) চাপার জায়গা থেকে হালকা সবুজ ঢেউ ছড়ায়।
    // ঢেউ স্ক্রল/আঙুল নড়লেও মুছে যায় না; বোতামের লেখা বদলে গেলেও (যেমন শুনুন→বিরতি) ঢেউ শেষ পর্যন্ত চলে।
    // "মোশন কমান" সেটিং চালু থাকলে দেখায় না।
    (() => {
      const SEL = 'button,.dd-it';
      const reduce = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
      const recs = new WeakMap();     // বোতাম → {el, t0}
      const DUR = 750;
      function spawn(host, x, y) {
        if (host.disabled || host.getAttribute('aria-disabled') === 'true') return null;
        if (reduce && reduce.matches) return null;
        const r = host.getBoundingClientRect();
        if (!r.width || !r.height) return null;
        const cx = x == null ? r.width / 2 : x - r.left, cy = y == null ? r.height / 2 : y - r.top;
        const rad = Math.hypot(Math.max(cx, r.width - cx), Math.max(cy, r.height - cy));   // সবচেয়ে দূরের কোণ পর্যন্ত ছড়াবে
        const el = document.createElement('span');
        el.className = 'rip';
        el.style.cssText = 'width:' + rad * 2 + 'px;height:' + rad * 2 + 'px;left:' + (cx - rad) + 'px;top:' + (cy - rad) + 'px';
        el.addEventListener('animationend', () => el.remove(), {once: true});
        host.appendChild(el);
        recs.set(host, {el, t0: performance.now()});
        return el;
      }
      function revive(host) {          // বোতামের ভেতরের লেখা/আইকন নতুন করে বসালে ঢেউ মুছে যায় → বাকি সময়টুকুর জন্য ফেরত বসানো
        const rec = recs.get(host); if (!rec) return;
        const used = performance.now() - rec.t0;
        if (rec.el.isConnected || used > DUR || !host.isConnected) return;
        rec.el.style.animationDelay = '-' + used + 'ms';
        host.appendChild(rec.el);
      }
      document.addEventListener('pointerdown', e => {
        if (e.button > 0 || e.isPrimary === false) return;
        const h = e.target.closest && e.target.closest(SEL); if (h) spawn(h, e.clientX, e.clientY);
      }, true);
      document.addEventListener('click', e => {   // capture পর্বে: বোতামের নিজস্ব onclick লেখা বদলানোর আগেই বোতামটি ধরে রাখা হয়
        const h = e.target.closest && e.target.closest(SEL); if (!h) return;
        if (e.detail === 0 || !recs.get(h)) spawn(h, e.detail === 0 ? null : e.clientX, e.detail === 0 ? null : e.clientY);   // কিবোর্ড/কোড-চালিত ক্লিক বা pointer ইভেন্ট না এলে
        setTimeout(() => revive(h), 0); setTimeout(() => revive(h), 80);
      }, true);
    })();
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}   // ব্রাউজার যেন ডেটা নিজে থেকে মুছে না ফেলে

  (() => {
    const $ = id => document.getElementById(id);
    const ic = n => '<svg class="i"><use href="#i-' + n + '"/></svg>';   // ছোট ভেক্টর আইকন
    const CK = 'kitab_proof_cfg_v1' + KP_SFX;      // সেটিংস + শেষ পেইজ + স্ক্রল/কার্সর অবস্থান
    const DK = 'kitab_proof_drafts_v1' + KP_SFX;   // অসংরক্ষিত খসড়া (পেইজ ধরে ধরে)
    // শোনার অতিরিক্ত সার্ভিসের ডিফল্ট কনফিগ (কী/ভয়েস/URL ব্রাউজারে থেকে যায়, রিপোতে যায় না)
    const TTSX_DEF = {
      edge:   {bn:'bn-BD-NabanitaNeural', ar:'ar-SA-ZariyahNeural', en:'en-US-AriaNeural', ver:''},
      poll:   {voice:'nova', tpl:'https://text.pollinations.ai/{text}?model=openai-audio&voice={voice}'},
      server: {url:'http://localhost:5000/?text={text}'},
      watson: {url:'', key:'', en:'en-US_MichaelV3Voice', ar:'ar-MS_OmarVoice'},
      fish:   {key:'', model:'s1', ref:''}
    };
    const defaults = {
      repo:'SunniPedia/pdftojpg', branch:'', token:'',
      pagesDir:'pages', textsDir:'texts', proofFile:'proofed.json', book:'', proofDir:'proofed',
      fs:20, swap:false, zoom:100, last:'', view:null, autoHead:false,
      ttsRate:1, ttsEngine:'auto', tts:{bn:'', ar:'', en:''}
    };
    // ---------- API (Gemini) ডিফল্ট ----------
    const API_NAME = {1: 'এপি আই - ১', 2: 'এপি আই - ২'};
    const API_DEF = {
      1: {
        sub: 'ছবি থেকে টেক্সট (OCR)',
        prompt: [
          'এই ছবিটি একটি কিতাবের পেইজ। ছবির সব লেখা হুবহু টেক্সট আকারে তুলে দাও।',
          'নিয়ম:',
          '১) আরবি অংশ আরবি অক্ষরে, বাংলা অংশ বাংলা অক্ষরে লিখবে; এক শব্দে দুই লিপি মেশাবে না।',
          '২) আরবির হরকত/ইরাব ছবিতে থাকলে রাখবে।',
          '৩) পেইজ নম্বর, পাদটীকা ও মার্জিনের লেখাও যেমন আছে তেমন রাখবে।',
          '৪) নিজে থেকে কিছু যোগ, বাদ বা সংশোধন করবে না; পড়া না গেলে [অস্পষ্ট] লিখবে।',
          '৫) কোনো ভূমিকা, মন্তব্য বা markdown চিহ্ন (**, #, -) ব্যবহার করবে না; শুধু টেক্সট দেবে।'
        ].join('\n')
      },
      2: {
        sub: 'টেক্সট প্রুফিং',
        prompt: [
          'নিচে একটি কিতাবের পেইজের ছবি (থাকলে) এবং সেই ছবি থেকে OCR করা টেক্সট দেওয়া আছে। ছবির সাথে মিলিয়ে টেক্সটের ভুল সংশোধন করো: বানান, যুক্তাক্ষর, আরবি হরকত, বাদ পড়া বা বাড়তি শব্দ, ভুল লাইন ভাঙা।',
          'নিয়ম:',
          '১) অর্থ, ভাষা বা শব্দচয়ন বদলাবে না; নিজের থেকে কিছু যোগ করবে না।',
          '২) আরবি অংশ আরবিতে, বাংলা অংশ বাংলায় থাকবে; লিপি মেশাবে না।',
          '৩) অনুচ্ছেদ ও লাইনের কাঠামো যতটা সম্ভব আগের মতো রাখবে।',
          '৪) লাইনের শুরুতে হেডিং চিহ্ন হিসেবে 1 (স্পেস ছাড়া) থাকলে সেটা যেমন আছে তেমনই রাখবে।',
          '৫) markdown চিহ্ন ব্যবহার করবে না।',
          '৬) কোনো মন্তব্য বা ব্যাখ্যা ছাড়া শুধু সংশোধিত পূর্ণ টেক্সট দেবে।'
        ].join('\n')
      }
    };
    let cfg = {...defaults};
    try { cfg = {...defaults, ...JSON.parse(localStorage.getItem(CK) || '{}')}; } catch(e) {}
    if (!cfg.repo) cfg.repo = defaults.repo;
    if (!cfg.tts || typeof cfg.tts !== 'object') cfg.tts = {bn:'', ar:'', en:''};
    if (!['auto', 'device', 'google', 'edge', 'poll', 'server', 'watson', 'fish'].includes(cfg.ttsEngine)) cfg.ttsEngine = 'auto';
    {   // অতিরিক্ত সার্ভিসের কনফিগ: পুরনো সংরক্ষণে না থাকলে ডিফল্ট বসবে
      const o = (cfg.ttsx && typeof cfg.ttsx === 'object') ? cfg.ttsx : {};
      cfg.ttsx = {};
      Object.keys(TTSX_DEF).forEach(k => { cfg.ttsx[k] = {...TTSX_DEF[k], ...(o[k] && typeof o[k] === 'object' ? o[k] : {})}; });
    }
    // API ১ ও ২ এর সংরক্ষিত মান (পুরনো সংরক্ষণে এই ঘর না থাকলে ডিফল্ট বসবে)
    [1, 2].forEach(n => {
      const o = cfg['api' + n];
      cfg['api' + n] = {key: '', model: 'gemini-3.5-flash-lite', temp: 0, prompt: API_DEF[n].prompt, sendImg: true, auto: true,
                        ...(o && typeof o === 'object' ? o : {})};
    });
    // একবারের স্থানান্তর: আগের ডিফল্ট মডেল (gemini-3.5-flash) সংরক্ষিত থাকলে নতুন ডিফল্ট flash-lite হবে
    if (!cfg.apiMig1) {
      [1, 2].forEach(n => { if (cfg['api' + n].model === 'gemini-3.5-flash') cfg['api' + n].model = 'gemini-3.5-flash-lite'; });
      cfg.apiMig1 = 1;
    }
    const saveCfg = () => { let v; try { v = JSON.stringify(cfg); } catch(e) { return; } try { localStorage.setItem(CK, v); } catch(e) {} kpMirror(CK, v); };

    let drafts = {};
    try { drafts = JSON.parse(localStorage.getItem(DK) || '{}') || {}; } catch(e) { drafts = {}; }
    // ---------- কিতাবের নাম (prefix) + ফোল্ডার ----------
    // ফোল্ডার/ফাইলের আসল নাম = কিতাবের নাম + _ (আন্ডারস্কোর) + মূল নাম (যেমন bukhari_pages, bukhari_texts, bukhari_proofed.json)।
    // কিতাবের নাম খালি থাকলে আগের মতোই pages / texts / proofed.json। একই রিপোতে একাধিক কিতাব রাখা যায়।
    const trimSl = v => (v || '').trim().replace(/^\/+|\/+$/g, '');
    // ---------- Supabase থেকে কনফিগ (রিপো, টোকেন, কিতাব, Gemini) ----------
    document.body.classList.toggle('is-admin', !!CTX.isAdmin);
    document.title = CTX.book.name + ' - কিতাব প্রুফিং';
    (() => {
      const b = CTX.book, st = CTX.settings || {};
      // কিতাবে ফাঁকা থাকলে অ্যাডমিনের ডিফল্ট (app_settings), সেটাও ফাঁকা থাকলে SunniPedia/pdftojpg
      const gu = trimSl(b.github_username) || trimSl(st.github_username) || 'SunniPedia';
      const gr = trimSl(b.repo_name) || trimSl(st.repo_name) || 'pdftojpg';
      cfg.repo = gu + '/' + gr;
      cfg.branch = (b.branch || st.branch || '').trim();
      cfg.book = trimSl(b.folder || b.name);                  // → <কিতাব>_pages, <কিতাব>_texts, <কিতাব>_proofed.json
      if (st.pages_dir) cfg.pagesDir = trimSl(st.pages_dir);
      if (st.texts_dir) cfg.textsDir = trimSl(st.texts_dir);
      if (st.proof_file) cfg.proofFile = st.proof_file.trim().replace(/^\/+/, '');
      if (st.proof_dir) cfg.proofDir = trimSl(st.proof_dir);
      if (st.github_token) cfg.token = st.github_token;
      [1, 2].forEach(n => {
        const c = cfg['api' + n];
        if (st.gemini_api_key) c.key = st.gemini_api_key;
        if (st.gemini_model) c.model = st.gemini_model;
        if (st.gemini_temp !== null && st.gemini_temp !== undefined && st.gemini_temp !== '') c.temp = Number(st.gemini_temp) || 0;
        const p = n === 1 ? st.prompt_ocr : st.prompt_proof;
        if (p) c.prompt = p;
      });
    })();
    // ---------- অ্যাডমিনের এপি আই চালু/বন্ধ (app_settings.api_enabled; কলাম না থাকলে/ফাঁকা থাকলে চালু ধরা হয়) ----------
    let apiEnabled = !(CTX.settings && CTX.settings.api_enabled === false);
    let apiChecking = false;
    function applyApiFlag() {
      const box = $('apiBox'); if (box) box.classList.toggle('off', !apiEnabled);
      setApiUI(); applyAutoApi();
    }
    async function refreshApiFlag() {
      try {
        const r = (await App.sb.get('app_settings?id=eq.1&select=api_enabled&limit=1'))[0];
        const on = !(r && r.api_enabled === false);
        if (on !== apiEnabled) {
          apiEnabled = on; applyApiFlag();
          if (!on) { if (apiRun) apiRun.ctrl.abort(); toast('অ্যাডমিন এপি আই বন্ধ করেছেন', true); }
          else { toast('এপি আই চালু হয়েছে'); maybeAutoOcr(); }
        }
      } catch (e) {}                                   // নেটওয়ার্ক/কলাম সমস্যায় আগের অবস্থাই থাকে
      return apiEnabled;
    }
    const bookPre = () => { const b = trimSl(cfg.book); return b ? b + '_' : ''; };   // সবসময় আন্ডারস্কোর (_)
    const pagesDir = () => bookPre() + trimSl(cfg.pagesDir || 'pages');
    const textsDir = () => bookPre() + trimSl(cfg.textsDir || 'texts');
    const proofDirName = () => typeof cfg.proofDir === 'string' ? trimSl(cfg.proofDir) : 'proofed';
    const proofName = () => bookPre() + (cfg.proofFile || 'proofed.json').trim().replace(/^\/+/, '');
    const proofPath = () => (proofDirName() ? proofDirName() + '/' : '') + proofName();     // যেমন proofed/bukhari_proofed.json
    const legacyProofPath = () => proofName();                                                 // পুরনো জায়গা: রিপোর রুট
    const dk = stem => cfg.repo + (trimSl(cfg.book) ? '@' + trimSl(cfg.book) : '') + '/' + stem;   // কিতাব ভেদে খসড়া আলাদা (খালি নাম = আগের কী)
    let quotaWarned = false;
    function persistDrafts() {
      try { const v = JSON.stringify(drafts); kpMirror(DK, v); localStorage.setItem(DK, v); return true; }
      catch(e) {
        if (KP_EXT) return true;   // এক্সটেনশন স্টোরেজে খসড়া নিরাপদ আছে
        if (!quotaWarned) { quotaWarned = true; toast('লোকাল স্টোরেজে খসড়া রাখা যাচ্ছে না (জায়গা শেষ?) — দ্রুত সেভ করুন', true); }
        return false;
      }
    }

    // ---------- স্টেট ----------
    let images = [];            // [{name, stem}]
    let textSet = new Set();    // যেসব পেইজের txt আছে
    let proofed = new Set();    // প্রুফড পেইজের stem
    let proofSha = null;
    // ---------- ইউজার-ভিত্তিক প্রুফড মালিকানা (Supabase: page_proofs) ----------
    // যে ইউজার একটি পেইজ প্রুফড করেছে, সেই পেইজ শুধু সে-ই (ও অ্যাডমিন) দেখতে পায়। অন্য ইউজারের কাছে পেইজটি
    // ড্রপডাউন, আগে/পরে বাটন, নম্বরে যাও ও "পরের অপ্রুফড"-এ আসে না; অপ্রুফড পেইজগুলো সবার জন্য আগের মতোই খোলা।
    const ME = CTX.uid, BOOK_ID = String(CTX.book.id), IS_ADMIN = !!CTX.isAdmin;
    let owners = new Map();      // stem → যে ইউজার প্রুফড করেছে (user_id)
    let reviews = new Map();     // stem → {s: pending/approved/correction, note} (অ্যাডমিন রিভিউ)
    const wantPage = new URLSearchParams(location.search).get('page');   // task.html-এর "সংশোধন দরকার" লিংক থেকে সরাসরি পেইজে
    let ownerNames = new Map();  // user_id → নাম (শুধু অ্যাডমিনের জন্য)
    let proofDb = true;          // page_proofs টেবিল আছে কি না (না থাকলে পুরনো আচরণ)
    const encU = encodeURIComponent;

    // ---- আমার সম্পন্ন টাস্ক (task.html-এর মতোই: শুধু নিজের প্রুফড পেইজ, সব কিতাব মিলিয়ে) — স্ট্যাটাস লাইনের মাঝখানে বাংলা সংখ্যায় ----
    let doneCnt = null, doneBusy = false, doneAgain = false;
    async function loadDone() {
      if (doneBusy) { doneAgain = true; return; }
      doneBusy = true;
      try {
        let n;
        try {   // দ্রুত পথ: Supabase ফাংশন (supabase_task_count.sql)
          n = await App.sb.post('rpc/my_proof_count', {p_user: String(ME)});
          n = Number(Array.isArray(n) ? n[0] : n); if (!Number.isFinite(n)) throw new Error('bad');
        } catch (e) {   // ফাংশন না থাকলে সরাসরি গুনে নিন
          n = 0;
          for (let off = 0; ; off += 1000) {
            const r = await App.sb.get('page_proofs?user_id=eq.' + encodeURIComponent(ME) + '&select=stem&order=stem.asc&limit=1000&offset=' + off);
            n += r.length; if (r.length < 1000) break;
          }
        }
        doneCnt = n;
      } catch (e) { /* টেবিল নেই/নেটওয়ার্ক সমস্যা: আগের সংখ্যাই থাকুক */ }
      finally {
        doneBusy = false;
        const el = $('doneCnt');
        if (el) { el.textContent = doneCnt == null ? '' : bnNum(doneCnt); el.hidden = doneCnt == null; }
        if (doneAgain) { doneAgain = false; loadDone(); }
      }
    }
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') loadDone(); });
    let legacyProof = false;   // তালিকা পুরনো জায়গা (রুট) থেকে পড়া হয়েছে কি না
    let cur = -1, sha = null, orig = '';
    let seq = 0, busy = false, loadErr = false;
    let initing = false, initFailed = false, forceInit = false;
    let restoreOnce = true, viewReady = false;
    const imgCache = new Map(); // name -> Promise<objectURL>
    let apiRun = null;          // চলমান API: {n, stem, ctrl, chars}
    let defaultBranch = '';     // রিপোর ডিফল্ট ব্রাঞ্চ (raw লিংকের জন্য)
    let repoPrivate = null;     // রিপো প্রাইভেট কিনা (Google Lens-এর জন্য): true/false/null=অজানা
    let autoT = 0, autoPause = false;   // অটো OCR: ডিবাউন্স টাইমার; Key/কোটা ত্রুটিতে সাময়িক বিরতি
    const autoTried = new Set();        // এই সেশনে যেসব পেইজে API-১ একবার চলেছে (অটো বা হাতে)

    const ta = $('ta'), img = $('img'), sel = $('sel'), imgBox = $('imgBox');

    // ---------- হেল্পার ----------
    const te = new TextEncoder(), td = new TextDecoder();
    function toB64(str){
      const b = te.encode(str); let s = '';
      for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
      return btoa(s);
    }
    function fromB64(b64){
      const bin = atob(b64.replace(/\s/g, ''));
      return td.decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
    }
    const epath = p => p.split('/').map(encodeURIComponent).join('/');
    const refQ = () => cfg.branch ? '?ref=' + encodeURIComponent(cfg.branch) : '';
    const natCmp = (a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'});
    const numOf = stem => { const m = stem.match(/\d+/g); return m ? parseInt(m[m.length - 1], 10) : NaN; };
    const dirty = () => cur >= 0 && !ta.disabled && ta.value !== orig;

    let toastT;
    // ---------- কাস্টম লোডিং টোস্ট ----------
    // চলাকালীন সাধারণ (সফল) বার্তাগুলো জমিয়ে রাখা হয় ও শেষে একসাথে দেখানো হয়; ত্রুটি এলে লোডিং বন্ধ হয়ে ত্রুটির টোস্ট দেখায়।
    const lt = {on: false, finishing: false, total: 1, k: 1, pct: 0, notes: [], tick: 0, doneT: 0};
    function ltPaint() {                // % সংখ্যা ও প্রগ্রেস বার একসাথে হালনাগাদ
      $('ltPct').textContent = Math.round(lt.pct) + '%';
      $('ltoast').querySelector('.lt-bar').style.width = lt.pct + '%';
    }
    // আসল অগ্রগতি জানা যায় না (GitHub সাড়া না দেওয়া পর্যন্ত), তাই ধাপ চলাকালীন % ধীরে ধীরে এগোয় (ধাপের ৯২% পর্যন্ত);
    // ধাপ শেষ হলে সরাসরি পরের ধাপের শুরুতে লাফ দেয়; সব শেষে ১০০%
    function ltTick() {
      const lo = (lt.k - 1) / lt.total * 100, hi = lt.k / lt.total * 100, cap = lo + (hi - lo) * 0.92;
      if (lt.pct < cap) lt.pct = Math.min(cap, lt.pct + Math.max(0.15, (cap - lt.pct) * 0.07));
      ltPaint();
    }
    function loadingStart(total) {
      clearInterval(lt.tick); clearTimeout(lt.doneT);
      lt.on = true; lt.finishing = false; lt.total = total; lt.k = 1; lt.pct = 0; lt.notes = [];
      clearTimeout(toastT); $('toast').className = '';
      ltPaint();
      const t = $('ltoast'); t.classList.add('show'); t.setAttribute('aria-hidden', 'false');
      lt.tick = setInterval(ltTick, 120);
    }
    function loadingStep(k, msg) {
      if (!lt.on) return;
      lt.k = k; lt.pct = Math.max(lt.pct, (k - 1) / lt.total * 100);
      $('ltTitle').textContent = msg;
      $('ltStep').textContent = 'ধাপ ' + k + '/' + lt.total;
      ltPaint();
    }
    function loadingHide() {
      clearInterval(lt.tick); clearTimeout(lt.doneT);
      lt.on = false; lt.finishing = false;
      const t = $('ltoast'); t.classList.remove('show'); t.setAttribute('aria-hidden', 'true');
    }
    function loadingDone(msg) {         // সফল শেষ: ১০০% দেখিয়ে (০.৪৫ সেকেন্ড) লোডিং বন্ধ → সফলতার টোস্ট
      if (!lt.on) return;
      clearInterval(lt.tick);
      lt.finishing = true; lt.pct = 100; $('ltTitle').textContent = 'সম্পন্ন'; ltPaint();
      lt.doneT = setTimeout(() => {
        const notes = lt.notes.slice();
        loadingHide();
        toast(notes.length ? msg + ' • ' + notes.join(' • ') : msg, false, notes.length ? 3800 : 2400);
      }, 450);
    }
    function toast(msg, err, ms) {
      if (lt.on) {
        if (!err) { if (!/^সেভ হয়েছে/.test(msg)) lt.notes.push(msg); return; }
        loadingHide();                  // ত্রুটি: লোডিং সরিয়ে ত্রুটির টোস্ট
      }
      const t = $('toast'); t.textContent = msg; t.className = 'show' + (err ? ' err' : '');
      clearTimeout(toastT); toastT = setTimeout(() => t.className = '', ms || (err ? 5000 : 1800));
    }

    // ---------- নিজস্ব ড্রপডাউন ----------
    // ব্রাউজারের নিজস্ব <select> পপআপ সিস্টেম ফন্টে দেখায়; তাই প্রতিটি <select> লুকিয়ে তার জায়গায়
    // বাটন + নিজস্ব পপআপ তালিকা বসানো হয় (একই Anek Bangla ফন্ট)। আসল <select> ভেতরে থাকে,
    // তাই .value / .options / onchange আগের মতোই কাজ করে।
    const selValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    let ddOpen = null;
    function closeDD() {
      if (!ddOpen) return;
      ddOpen.pop.remove(); ddOpen.btn.setAttribute('aria-expanded', 'false'); ddOpen = null;
    }
    function openDD(el, btn) {
      const pop = document.createElement('div');
      pop.className = 'dd-pop'; pop.setAttribute('role', 'listbox');
      const curIdx = el.selectedIndex;
      Array.from(el.options).forEach((o, i) => {
        const it = document.createElement('div');
        it.className = 'dd-it' + (i === curIdx ? ' sel' : '');
        it.setAttribute('role', 'option');
        const t = document.createElement('span'); t.textContent = o.textContent; it.appendChild(t);
        if (i === curIdx) it.insertAdjacentHTML('beforeend', ic('check'));
        it.onclick = e => {
          e.stopPropagation();
          el.selectedIndex = i; el._sync();
          closeDD();
          el.dispatchEvent(new Event('change', {bubbles: true}));
        };
        pop.appendChild(it);
      });
      // মডাল ডায়ালগের ভেতরের ড্রপডাউন ডায়ালগের ভেতরেই বসাতে হয়, নইলে ডায়ালগের নিচে ঢাকা পড়ে
      (btn.closest('dialog') || document.body).appendChild(pop);
      const r = btn.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
      pop.style.minWidth = Math.min(Math.max(r.width, 150), vw - 16) + 'px';
      const below = vh - r.bottom - 8, above = r.top - 8;
      const down = below >= 260 || below >= above;
      const maxH = Math.max(120, Math.min(vh * 0.6, down ? below : above));
      pop.style.maxHeight = maxH + 'px';
      const h = Math.min(pop.scrollHeight, maxH);
      pop.style.top = (down ? r.bottom + 4 : Math.max(8, r.top - 4 - h)) + 'px';
      const w = pop.offsetWidth;
      let left = r.left; if (left + w > vw - 8) left = Math.max(8, vw - 8 - w);
      pop.style.left = left + 'px';
      const s = pop.querySelector('.sel');
      if (s) pop.scrollTop = s.offsetTop - pop.clientHeight / 2 + s.offsetHeight / 2;   // বর্তমানটি মাঝখানে
      btn.setAttribute('aria-expanded', 'true');
      ddOpen = {pop, btn};
    }
    function enhanceSelect(el) {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'dd-btn'; btn.dataset.for = el.id;
      btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false');
      if (el.title) btn.title = el.title;
      if (el.getAttribute('aria-label')) btn.setAttribute('aria-label', el.getAttribute('aria-label'));
      el.style.display = 'none'; el.after(btn);
      const sync = () => {
        const o = el.options[el.selectedIndex];
        btn.innerHTML = '<span class="dd-t"></span><svg class="i dd-ch"><use href="#i-down"/></svg>';
        btn.firstChild.textContent = o ? o.textContent : '';
      };
      // কোড থেকে select.value বদলালেও বাটনের লেখা নিজে থেকে হালনাগাদ হবে
      Object.defineProperty(el, 'value', {configurable: true, get() { return selValue.get.call(el); }, set(v) { selValue.set.call(el, v); sync(); }});
      new MutationObserver(sync).observe(el, {childList: true, subtree: true, characterData: true});
      btn.onclick = e => {
        e.stopPropagation();
        if (ddOpen && ddOpen.btn === btn) { closeDD(); return; }
        closeDD(); openDD(el, btn);
      };
      el._sync = sync; sync();
    }
    document.addEventListener('click', e => { if (ddOpen && !ddOpen.pop.contains(e.target)) closeDD(); });
    window.addEventListener('resize', closeDD);
    window.addEventListener('scroll', e => { if (ddOpen && !ddOpen.pop.contains(e.target)) closeDD(); }, true);

    // হেডার/ফুটারে মাউসের চাকা ঘোরালে আড়াআড়ি স্ক্রল (ডেস্কটপের জন্য)
    [$('hdr'), $('ftr')].forEach(bar => bar.addEventListener('wheel', e => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && bar.scrollWidth > bar.clientWidth) { bar.scrollLeft += e.deltaY; e.preventDefault(); }
    }, {passive: false}));

    async function api(path, opts = {}) {
      const headers = {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(cfg.token ? {'Authorization': 'Bearer ' + cfg.token} : {}),
        ...(opts.headers || {})
      };
      // no-store: সেভের পর পুরনো (ক্যাশ করা) টেক্সট/sha ফেরত আসা ঠেকায়
      return fetch('https://api.github.com/repos/' + cfg.repo + path, {cache: 'no-store', ...opts, headers});
    }
    async function errMsg(r) {
      let m = ''; try { m = (await r.json()).message || ''; } catch(e) {}
      let hint = '';
      if (r.status === 401) hint = ' (টোকেন ভুল বা মেয়াদ শেষ)';
      else if (r.status === 403) hint = ' (অনুমতি নেই বা রেট-লিমিট; টোকেন দিন)';
      else if (r.status === 404) hint = ' (রিপো/ফোল্ডার/ফাইল পাওয়া যায়নি — নাম বা টোকেনের অ্যাক্সেস দেখুন)';
      return r.status + ': ' + m + hint;
    }

    // ---------- খসড়া (লোকাল স্টোরেজে স্বয়ংক্রিয় সংরক্ষণ) ----------
    let draftT;
    function stashDraft() {
      clearTimeout(draftT);
      if (cur < 0 || ta.disabled) return;          // লোড চলাকালীন বা ব্যর্থ হলে খসড়া ছুঁবে না
      const k = dk(images[cur].stem);
      if (ta.value !== orig) drafts[k] = {t: ta.value, ts: Date.now()};
      else if (k in drafts) delete drafts[k];
      else return;
      persistDrafts();
      updateOption(cur);
    }

    // ---------- শেষ অবস্থান (স্ক্রল/কার্সর) সংরক্ষণ ----------
    let viewT;
    function saveView() {
      clearTimeout(viewT);
      if (cur < 0 || !viewReady) return;
      cfg.view = {
        stem: images[cur].stem,
        it: Math.round(imgBox.scrollTop), il: Math.round(imgBox.scrollLeft),
        tt: Math.round(ta.scrollTop), c: ta.selectionStart || 0
      };
      saveCfg();
    }
    const lazyView = () => { clearTimeout(viewT); viewT = setTimeout(saveView, 400); };
    const flush = () => { stashDraft(); saveView(); };

    // ---------- UI আপডেট ----------
    const hiddenStem = stem => !IS_ADMIN && proofDb && owners.has(stem) && owners.get(stem) !== ME;   // অন্য ইউজারের প্রুফড পেইজ
    const isHid = i => i >= 0 && i < images.length && hiddenStem(images[i].stem);
    const visIdx = () => { const o = []; for (let i = 0; i < images.length; i++) if (!isHid(i)) o.push(i); return o; };
    function stepVis(from, dir) {        // from থেকে dir (+1/-1) দিকে প্রথম দৃশ্যমান পেইজ; না থাকলে -1
      for (let i = from + dir; i >= 0 && i < images.length; i += dir) if (!isHid(i)) return i;
      return -1;
    }
    const ownerTag = stem => {            // অ্যাডমিন অন্যের প্রুফড পেইজে নাম দেখে
      if (!IS_ADMIN || !owners.has(stem) || owners.get(stem) === ME) return '';
      const n = ownerNames.get(owners.get(stem));
      return n ? ': ' + n : '';
    };
    const label = im => im.stem
      + (proofed.has(im.stem) ? ' (প্রুফড' + ownerTag(im.stem) + ')' : '')
      + (drafts[dk(im.stem)] ? ' •' : '')
      + (textSet.has(im.stem) ? '' : ' (txt নেই)');
    function updateOption(i) {
      const o = Array.prototype.find.call(sel.options, x => x.value === String(i));
      if (o) o.textContent = label(images[i]);
    }

    function updateStatus() {
      const st = $('stText');
      if (cur < 0) { st.textContent = ''; st.className = ''; }
      else {
        const stem = images[cur].stem;
        const d = dirty();
        const vis = visIdx();
        let t = (vis.indexOf(cur) + 1) + '/' + vis.length;
        if (loadErr) t += ' • টেক্সট লোড ব্যর্থ (রিলোড চাপুন)';
        else if (ta.disabled) t += ' • লোড হচ্ছে…';
        else t += d ? ' • অসংরক্ষিত' : (sha ? ' • সেভড' : ' • টেক্সট নেই (পেস্ট করে সেভ করুন)');
        if (proofed.has(stem)) t += ' • প্রুফড' + ownerTag(stem);
        { const rv = reviews.get(stem); if (rv && owners.get(stem) === ME) t += rv.s === 'approved' ? ' • অনুমোদিত ✔' : rv.s === 'correction' ? ' • সংশোধন দরকার' + (rv.note ? ' (' + rv.note + ')' : '') : ' • রিভিউ বাকি'; }
        if (!apiEnabled) t += ' • এপি আই বন্ধ';
        if (apiRun) t += ' • ' + API_NAME[apiRun.n] + ' চলছে' + (apiRun.stem !== stem ? ' (' + apiRun.stem + ')' : '') + (apiRun.chars ? ' ' + apiRun.chars + ' অক্ষর' : '') + '…';
        st.textContent = t;
        st.className = (d || loadErr) ? 'dirty' : '';
        const pf = proofed.has(stem), tb = $('btnToggleProof');
        tb.innerHTML = ic(pf ? 'checksq' : 'square') + '<span>প্রুফড</span>';
        tb.classList.toggle('on', pf);
        tb.title = pf ? 'প্রুফড চিহ্ন আছে — বাতিল করতে চাপুন' : 'প্রুফড হিসেবে চিহ্নিত করুন';
        const nd = Object.keys(drafts).filter(k => k.startsWith(cfg.repo + '/')).length;
        $('txtInfo').textContent = ta.value.length + ' অক্ষর' + (nd ? ' • খসড়া ' + nd : '');
      }
    }
    function renderSelect() {
      const keep = cur;
      sel.innerHTML = '';
      images.forEach((im, i) => {
        if (isHid(i)) return;               // অন্য ইউজারের প্রুফড পেইজ তালিকায় আসে না
        const o = document.createElement('option');
        o.value = i;
        o.textContent = label(im);
        sel.appendChild(o);
      });
      if (keep >= 0 && !isHid(keep)) sel.value = keep;
    }
    const applyZoom = () => { img.style.width = cfg.zoom + '%'; $('zVal').textContent = cfg.zoom + '%'; };
    const applyFont = () => document.documentElement.style.setProperty('--fs', cfg.fs + 'px');
    const applySwap = () => $('main').classList.toggle('swap', !!cfg.swap);

    // ---------- ছবি ----------
    // ---------- ছবি লোডের শতাংশ ----------
    const imgPct = new Map();            // ছবির নাম → শতাংশ (null = মোট মাপ অজানা)
    const ldr = {on: false, target: 0, shown: 0, raf: 0};
    const bnNum = n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
    const LDR_R = 40, LDR_C = 2 * Math.PI * LDR_R;
    function setImgMsg(t) {              // সাধারণ লেখা বসানো (লোডার সরে যায়)
      ldr.on = false; cancelAnimationFrame(ldr.raf); ldr.raf = 0;
      $('imgMsg').textContent = t;
    }
    function ldrShow(pct) {
      const m = $('imgMsg');
      m.innerHTML = '<div class="ldr' + (pct == null ? ' ind' : '') + '" role="progressbar" aria-valuemin="0" aria-valuemax="100">'
        + '<div class="ldr-ring"><svg viewBox="0 0 100 100"><circle class="trk" cx="50" cy="50" r="' + LDR_R + '"/>'
        + '<g class="ring-s"><circle class="bar" cx="50" cy="50" r="' + LDR_R + '" stroke-dasharray="' + LDR_C + '" stroke-dashoffset="' + LDR_C + '"/></g></svg>'
        + '<div class="num"><span class="n">০</span><small>%</small></div></div><div class="ldr-sub"></div></div>';
      ldr.on = true; ldr.shown = 0; ldr.target = pct;
      cancelAnimationFrame(ldr.raf); ldr.raf = 0;
      ldrStep();
    }
    function ldrSet(pct) {
      if (!ldr.on) return;
      const box = $('imgMsg').querySelector('.ldr'); if (box) box.classList.toggle('ind', pct == null);
      ldr.target = pct;
      if (!ldr.raf) ldr.raf = requestAnimationFrame(ldrStep);
    }
    function ldrStep() {                 // দেখানো সংখ্যা ধীরে ধীরে লক্ষ্য শতাংশের দিকে এগোয় (মসৃণ অ্যানিমেশন)
      ldr.raf = 0;
      if (!ldr.on) return;
      const box = $('imgMsg').querySelector('.ldr'); if (!box) return;
      const bar = box.querySelector('.bar'), n = box.querySelector('.n'), sub = box.querySelector('.ldr-sub');
      if (ldr.target == null) { n.textContent = '…'; sub.textContent = ''; return; }
      const d = ldr.target - ldr.shown;
      ldr.shown = Math.abs(d) < 0.4 ? ldr.target : ldr.shown + Math.max(Math.abs(d) * 0.2, 0.5) * Math.sign(d);
      const v = Math.max(0, Math.min(100, ldr.shown));
      bar.setAttribute('stroke-dashoffset', String(LDR_C * (1 - v / 100)));
      n.textContent = bnNum(Math.round(v));
      box.classList.toggle('full', Math.round(v) >= 100);
      box.setAttribute('aria-valuenow', String(Math.round(v)));
      if (ldr.shown !== ldr.target) ldr.raf = requestAnimationFrame(ldrStep);
    }
    function imgProg(name, pct) {
      imgPct.set(name, pct);
      if (cur >= 0 && images[cur] && images[cur].name === name) ldrSet(pct);
    }
    function getImage(name) {
      if (imgCache.has(name)) return imgCache.get(name);
      const p = (async () => {
        const r = await api('/contents/' + epath(pagesDir() + '/' + name) + refQ(),
                            {cache: 'default', headers: {'Accept': 'application/vnd.github.raw+json'}});
        if (!r.ok) throw new Error(await errMsg(r));
        const ext = (name.split('.').pop() || '').toLowerCase();
        const type = {jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp'}[ext] || 'image/jpeg';
        const total = parseInt(r.headers.get('Content-Length') || '0', 10) || 0;
        if (!r.body || !r.body.getReader) { imgProg(name, null); const b = await r.blob(); imgProg(name, 100); return URL.createObjectURL(b); }
        imgProg(name, total ? 0 : null);
        const rd = r.body.getReader(), parts = []; let got = 0;
        for (;;) {
          const {done, value} = await rd.read();
          if (done) break;
          parts.push(value); got += value.length;
          if (total) imgProg(name, Math.min(99, got / total * 100));
        }
        imgProg(name, 100);
        return URL.createObjectURL(new Blob(parts, {type}));
      })();
      imgCache.set(name, p);
      p.catch(() => { imgCache.delete(name); imgPct.delete(name); });
      if (imgCache.size > 6) {
        const k = imgCache.keys().next().value;
        imgCache.get(k).then(u => URL.revokeObjectURL(u)).catch(() => {});
        imgCache.delete(k);
      }
      return p;
    }

    // ---------- মূল ছবি ডাউনলোড ----------
    async function downloadCurrent() {
      if (cur < 0) { toast('কোনো ছবি খোলা নেই', true); return; }
      const im = images[cur];
      const ext = (im.name.split('.').pop() || '').toLowerCase();
      const mime = {jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp'}[ext] || 'application/octet-stream';
      try {
        toast('মূল ছবি আনা হচ্ছে…', false, 4000);
        // ক্যাশ নয়, রিপো থেকে সরাসরি মূল ফাইল (raw) আনা হচ্ছে
        const path = '/contents/' + epath(pagesDir() + '/' + im.name) + refQ();
        let r = await api(path, {headers: {'Accept': 'application/vnd.github.raw+json'}});
        if (!r.ok) throw new Error(await errMsg(r));
        let buf = await r.arrayBuffer();

        // খুব ছোট হলে (ভুল/এরর রেসপন্স হতে পারে) download_url দিয়ে আবার চেষ্টা
        if (buf.byteLength < 2048) {
          const rj = await api(path);
          if (rj.ok) {
            const j = await rj.json();
            if (j.download_url) {
              const r2 = await fetch(j.download_url, {cache: 'no-store'});
              if (r2.ok) buf = await r2.arrayBuffer();
            }
          }
        }
        if (buf.byteLength < 2048) throw new Error('ফাইল ঠিকমতো আসেনি (' + buf.byteLength + ' বাইট)');

        const blob = new Blob([buf], {type: mime});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = im.name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        toast('ডাউনলোড: ' + im.name + ' (' + (buf.byteLength / 1048576).toFixed(2) + ' MB)');
      } catch (e) { toast('ডাউনলোড ব্যর্থ: ' + e.message, true); }
    }

    // ---------- লাইটবক্স (পপআপ) ----------
    const lb = $('lb'), lbImg = $('lbImg');
    function openLightbox() {
      if (cur < 0 || !img.getAttribute('src')) return;
      lbImg.src = img.src;
      $('lbTitle').textContent = images[cur].name;
      lb.classList.add('open'); lb.setAttribute('aria-hidden', 'false');
    }
    function closeLightbox() {
      if (!lb.classList.contains('open')) return;
      lb.classList.remove('open'); lb.setAttribute('aria-hidden', 'true');
      lbImg.removeAttribute('src');
    }
    img.addEventListener('click', openLightbox);
    lb.addEventListener('click', closeLightbox);           // যেকোনো জায়গায় ক্লিক = বন্ধ
    $('lbDl').addEventListener('click', e => { e.stopPropagation(); downloadCurrent(); });
    $('btnDl').onclick = downloadCurrent;

    // ---------- Google Lens ----------
    // পাবলিক রিপো: ছবির raw URL দিয়ে সরাসরি Lens খোলে।
    // প্রাইভেট/অজানা রিপো: ছবি ক্লিপবোর্ডে কপি করে lens.google.com খোলে — সেখানে Ctrl+V করলেই হবে।
    async function toPngBlob(blob) {
      if (blob.type === 'image/png') return blob;
      const bmp = await createImageBitmap(blob);
      const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
      c.getContext('2d').drawImage(bmp, 0, 0);
      return await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('PNG বানানো যায়নি')), 'image/png'));
    }
    // 'noopener' দিলে window.open সবসময় null ফেরত দেয় (ট্যাব খুললেও); তাই সাধারণভাবে খুলে opener ফাঁকা করা হয়
    function openTab(url) { const w = window.open(url, '_blank'); if (w) { try { w.opener = null; } catch (e) {} } return w; }
    async function openLens() {
      if (cur < 0) { toast('কোনো ছবি খোলা নেই', true); return; }
      const im = images[cur];
      if (repoPrivate === false) {
        const raw = 'https://raw.githubusercontent.com/' + cfg.repo + '/' + (cfg.branch ? encodeURIComponent(cfg.branch) : 'HEAD')
                  + '/' + epath(pagesDir() + '/' + im.name);
        const w = openTab('https://lens.google.com/uploadbyurl?url=' + encodeURIComponent(raw));
        toast(w ? 'Google Lens খোলা হয়েছে — সেখানে "Text" চেপে টেক্সট কপি করুন'
                : 'পপ-আপ ব্লক করা আছে — এই সাইটের জন্য পপ-আপ অনুমতি দিন', !w, 5000);
        return;
      }
      try {
        toast('ছবি কপি করা হচ্ছে…', false, 4000);
        const blob = await (await fetch(await getImage(im.name))).blob();
        await navigator.clipboard.write([new ClipboardItem({'image/png': await toPngBlob(blob)})]);
        const w = openTab('https://lens.google.com/');
        toast(w ? 'ছবি কপি হয়েছে — Lens পেইজে Ctrl+V (মোবাইলে পেস্ট) করুন'
                : 'ছবি কপি হয়েছে, কিন্তু পপ-আপ ব্লক — lens.google.com হাতে খুলে পেস্ট করুন', !w, 6000);
      } catch (e) {
        toast('ছবি স্বয়ংক্রিয়ভাবে দেওয়া যায়নি (' + (e && e.message || e) + ') — ডাউনলোড করে lens.google.com-এ আপলোড করুন', true, 7000);
      }
    }
    $('btnLens').onclick = openLens;

    // ---------- Ai: GitHub ডাউনলোড অংশ + ছবির raw লিংক + OCR প্রম্পট (Supabase) → একটি প্রম্পট কপি ----------
    function rawImageUrl(im) {
      const br = (cfg.branch || defaultBranch || 'main').split('/').map(encodeURIComponent).join('/');
      return 'https://raw.githubusercontent.com/' + cfg.repo + '/refs/heads/' + br + '/' + epath(pagesDir() + '/' + im.name);
    }
    function buildAiPrompt(im) {
      const head = [
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
        '`' + rawImageUrl(im) + '`'
      ].join('\n');
      return head + '\n\n' + (cfg.api1.prompt || API_DEF[1].prompt).trim() + '\n';
    }
    async function copyPlain(text) {
      try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
      try {
        const t = document.createElement('textarea');
        t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
        document.body.appendChild(t); t.select(); t.setSelectionRange(0, text.length);
        const ok = document.execCommand('copy'); t.remove(); return ok;
      } catch (e) { return false; }
    }
    $('btnAiCopy').onclick = async () => {
      if (cur < 0) { toast('কোনো ছবি খোলা নেই', true); return; }
      const im = images[cur];
      const ok = await copyPlain(buildAiPrompt(im));
      if (!ok) { toast('কপি ব্যর্থ — ব্রাউজার ক্লিপবোর্ডে লিখতে দিচ্ছে না', true); return; }
      toast(repoPrivate === true
        ? 'প্রম্পট কপি হয়েছে (পেইজ ' + im.stem + ') — তবে রিপো প্রাইভেট, AI এই raw লিংক খুলতে পারবে না'
        : 'AI প্রম্পট কপি হয়েছে (পেইজ ' + im.stem + ') — AI চ্যাটে পেস্ট করুন', repoPrivate === true, 4500);
    };

    // ---------- পেইজ লোড ----------
    async function loadPage() {
      stopPlay();                         // পেইজ বদলালে শোনা বন্ধ
      const my = ++seq, im = images[cur];
      // শেষবার বন্ধ হওয়ার অবস্থান ফেরত আনা হবে শুধু প্রথম লোডে
      const pv = (restoreOnce && cfg.view && cfg.view.stem === im.stem) ? cfg.view : null;
      restoreOnce = false;
      viewReady = false; loadErr = false;
      closeLightbox();
      ta.value = ''; ta.disabled = true; ta.placeholder = ''; orig = ''; sha = null;
      img.removeAttribute('src');
      ldrShow(imgPct.has(im.name) ? imgPct.get(im.name) : 0);
      updateStatus();

      const imgP = getImage(im.name).then(url => new Promise(res => {
        if (my !== seq) return res();
        if (ldr.on) ldrSet(100);
        img.onload = () => {
          if (my === seq) { setImgMsg(''); if (pv) imgBox.scrollTo(pv.il || 0, pv.it || 0); }
          res();
        };
        img.onerror = () => { if (my === seq) setImgMsg('ছবি দেখানো যায়নি'); res(); };
        img.src = url;
        imgBox.scrollTo(0, 0);
      })).catch(e => { if (my === seq) setImgMsg('ছবি লোড ব্যর্থ: ' + e.message); });

      const txtP = (async () => {
        const r = await api('/contents/' + epath(textsDir() + '/' + im.stem + '.txt') + refQ());
        if (my !== seq) return;
        let ok = true;
        if (r.status === 404) { sha = null; ta.value = ''; orig = ''; }   // ফাইল/ফোল্ডার নেই → ফাঁকা ঘর
        else if (r.ok) {
          const j = await r.json();
          if (my !== seq) return;
          sha = j.sha;
          ta.value = j.content ? fromB64(j.content) : '';
          orig = ta.value;   // textarea নিজে নতুন লাইন স্বাভাবিক করে, তাই তার মানই তুলনার ভিত্তি
        } else { ok = false; toast(await errMsg(r), true); }
        if (my !== seq) return;
        if (ok) {
          const k = dk(im.stem), d = drafts[k];
          if (d && d.t !== orig) { ta.value = d.t; toast('অসংরক্ষিত খসড়া ফিরিয়ে আনা হয়েছে — সেভ করলে পুশ হবে', false, 3500); }
          else if (d) { delete drafts[k]; persistDrafts(); }
          ta.disabled = false; ta.scrollTop = 0;
          ta.placeholder = 'এই পেইজের টেক্সট এখনো নেই — এখানে টেক্সট পেস্ট করে সেভ করুন';
          updateOption(cur);
        } else { loadErr = true; }
        updateStatus();
      })().catch(e => { if (my === seq) { loadErr = true; toast('টেক্সট লোড ব্যর্থ: ' + e.message, true); updateStatus(); } });

      await Promise.all([imgP, txtP]);
      if (my !== seq) return;
      if (pv && !ta.disabled) {
        const c = Math.min(pv.c || 0, ta.value.length);
        try { ta.setSelectionRange(c, c); } catch(e) {}
        ta.scrollTop = pv.tt || 0;
      }
      viewReady = true;
      maybeAutoOcr();                     // টেক্সট ফাঁকা হলে এপি আই - ১ নিজে থেকে চলবে
      { const nx = stepVis(cur, 1); if (nx >= 0) getImage(images[nx].name).catch(() => {}); } // পরের (দৃশ্যমান) ছবি আগাম লোড
    }

    async function go(i) {
      if (i < 0 || i >= images.length || i === cur) { sel.value = cur; return; }
      if (isHid(i)) { toast('এই পেইজ অন্য ইউজার প্রুফড করেছেন — আপনি দেখতে পারবেন না', true); sel.value = cur; return; }
      if (busy) { toast('সেভ চলছে, একটু অপেক্ষা করুন'); sel.value = cur; return; }
      stopPlay();
      flush();  // বর্তমান পেইজের খসড়া লোকালে রেখে যাই (কোনো কিছু হারাবে না)
      cur = i; cfg.last = images[i].stem;
      if (!(restoreOnce && cfg.view && cfg.view.stem === cfg.last)) cfg.view = null;
      saveCfg();
      // task.html-এর "চালিয়ে যান" বাটনের জন্য: শেষ কিতাব ও পেইজ মনে রাখি (শুধু এই ডিভাইসে)
      try { localStorage.setItem('kp_resume_v1_' + ME, JSON.stringify({b: BOOK_ID, s: cfg.last, t: Date.now()})); } catch (e) {}
      sel.value = i;
      await loadPage();
    }

    // ---------- সেভ ----------
    async function saveText() {
      if (cur < 0 || ta.disabled) return false;
      if (!dirty()) return true;
      if (busy) return false;
      stashDraft();                       // নেটওয়ার্ক ব্যর্থ হলেও লোকালে লেখা থেকে যাবে
      busy = true; $('stText').textContent = 'সেভ হচ্ছে…';
      let blocked = false;
      try {
        if (!(await ownerOk(images[cur].stem))) { blocked = true; return false; }   // অন্য ইউজার প্রুফড করে ফেললে সেভ হবে না
        const im = images[cur], text = ta.value;
        const body = {message: 'Proofread ' + im.stem + '.txt', content: toB64(text)};
        if (sha) body.sha = sha;
        if (cfg.branch) body.branch = cfg.branch;
        // texts/ ফোল্ডার না থাকলে GitHub এই পাথে ফাইল তৈরির সময় ফোল্ডারও তৈরি করে দেয়
        const r = await api('/contents/' + epath(textsDir() + '/' + im.stem + '.txt'),
                            {method: 'PUT', body: JSON.stringify(body), headers: {'Content-Type': 'application/json'}});
        if (!r.ok) {
          toast(await errMsg(r) + (r.status === 409 || r.status === 422 ? ' — রিলোড বাটন চেপে আবার চেষ্টা করুন (আপনার লেখা খসড়ায় নিরাপদ আছে)' : ''), true, 7000);
          return false;
        }
        const j = await r.json();
        sha = j.content.sha; orig = text; textSet.add(im.stem);
        stashDraft();                     // সেভের মধ্যে আবার কিছু লিখলে সেটা খসড়া থাকবে, নইলে খসড়া মুছে যাবে
        updateOption(cur); toast('সেভ হয়েছে (GitHub-এ পুশ)');
        return true;
      } catch (e) { toast('সেভ ব্যর্থ: ' + e.message + ' (লেখা খসড়ায় নিরাপদ আছে)', true); return false; }
      finally { busy = false; updateStatus(); if (blocked) applyProofs(); }
    }

    // ---- Supabase: page_proofs (book_id, stem, user_id) — একটি পেইজের মালিক একজনই (unique) ----
    const isNoTable = e => /PGRST205|PGRST200|42P01|relation .*page_proofs|404/i.test((e && e.message) || '');
    async function fetchProofRows() {
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
    }
    // সর্বশেষ মালিকানা আনে। ফেরত: true = হালনাগাদ হয়েছে, false = পারেনি (নেটওয়ার্ক), 'none' = টেবিল নেই
    async function refreshProofs() {
      let rows;
      try { rows = await fetchProofRows(); }
      catch (e) { if (isNoTable(e)) { proofDb = false; owners = new Map(); return 'none'; } return false; }
      proofDb = true;
      const m = new Map();
      reviews = new Map();
      rows.forEach(r => { m.set(r.stem, r.user_id); proofed.add(r.stem); if (r.review_status) reviews.set(r.stem, {s: r.review_status, note: r.review_note || ''}); });
      owners.forEach((_, stem) => { if (!m.has(stem)) proofed.delete(stem); });   // মালিক প্রুফড তুলে নিয়েছে
      owners = m;
      if (IS_ADMIN) {
        try { (await App.sb.get('app_users?select=id,full_name')).forEach(u => ownerNames.set(String(u.id), u.full_name || '')); } catch (e) {}
      }
      return true;
    }
    function showNone() {                 // আপনার জন্য কোনো পেইজ নেই (সবই অন্যের প্রুফড)
      ++seq; stopPlay(); cur = -1; viewReady = false;
      ta.value = ''; ta.disabled = true; ta.placeholder = ''; orig = ''; sha = null;
      img.removeAttribute('src');
      setImgMsg('আপনার জন্য কোনো পেইজ বাকি নেই — সব পেইজ অন্য ইউজার প্রুফড করেছেন');
      updateStatus();
    }
    // মালিকানা বদলালে: ড্রপডাউন নতুন করে সাজানো; খোলা পেইজ অন্যের হয়ে গেলে নিকটতম দৃশ্যমান পেইজে সরানো
    function applyProofs() {
      closeDD();
      renderSelect();
      if (cur >= 0 && isHid(cur)) {
        const nx = stepVis(cur, 1) >= 0 ? stepVis(cur, 1) : stepVis(cur, -1);
        toast('এই পেইজ অন্য ইউজার প্রুফড করেছেন — অন্য পেইজে নেওয়া হলো (আপনার অসংরক্ষিত লেখা খসড়ায় আছে)', true, 6000);
        if (nx >= 0) go(nx); else showNone();
      } else updateStatus();
    }
    // সেভ/প্রুফের আগে ওই পেইজ অন্য কেউ প্রুফড করেছে কি না তাজা তথ্যে যাচাই (নেটওয়ার্ক ব্যর্থ হলে আটকানো হয় না)
    async function ownerOk(stem) {
      if (!proofDb || IS_ADMIN) return true;
      try {
        const r = (await App.sb.get('page_proofs?book_id=eq.' + encU(BOOK_ID) + '&stem=eq.' + encU(stem) + '&select=user_id&limit=1'))[0];
        if (r && r.user_id !== ME) {
          owners.set(stem, r.user_id); proofed.add(stem);
          toast('এই পেইজ অন্য ইউজার প্রুফড করেছেন — সেভ হয়নি (আপনার লেখা খসড়ায় নিরাপদ আছে)', true, 6000);
          return false;
        }
      } catch (e) {}
      return true;
    }
    // GitHub-এর প্রুফড তালিকায় (proofed.json) শুধু এই একটি পেইজ যোগ/বাদ — প্রতিবার তাজা ফাইল পড়ে, তাই অন্যের এন্ট্রি মোছে না
    async function syncProofJson(stem, val) {
      let lastErr = null;
      for (let att = 0; att < 2; att++) {
        const r0 = await api('/contents/' + epath(proofPath()) + refQ());
        let set, sh = null;
        if (r0.ok) {
          const j = await r0.json(); sh = j.sha; set = new Set();
          try { (JSON.parse(fromB64(j.content)).proofed || []).forEach(x => set.add(x)); } catch (e) {}
        } else if (r0.status === 404) set = new Set(proofed);          // নতুন ফাইল: এখনকার জানা তালিকা থেকে শুরু
        else throw new Error(await errMsg(r0));
        if (val) set.add(stem); else set.delete(stem);
        const body = {message: 'Proofing status: ' + stem, content: toB64(JSON.stringify({proofed: [...set].sort(natCmp)}, null, 2) + '\n')};
        if (sh) body.sha = sh;
        if (cfg.branch) body.branch = cfg.branch;
        const r = await api('/contents/' + epath(proofPath()),
                            {method: 'PUT', body: JSON.stringify(body), headers: {'Content-Type': 'application/json'}});
        if (r.ok) {
          proofSha = (await r.json()).content.sha;
          if (legacyProof) {
            legacyProof = false;
            toast('প্রুফড তালিকা এখন ' + proofPath() + '-এ সংরক্ষিত — রিপোর রুটের পুরনো ' + legacyProofPath() + ' চাইলে মুছে ফেলতে পারেন', false, 7000);
          }
          return;
        }
        lastErr = new Error(await errMsg(r));
        if (r.status !== 409 && r.status !== 422) break;               // শুধু sha-সংঘর্ষে আবার চেষ্টা
      }
      throw lastErr;
    }

    async function setProofed(stem, val) {
      const refresh = () => { const i = images.findIndex(im => im.stem === stem); if (i >= 0) updateOption(i); updateStatus(); };
      if (proofDb) {
        try {
          if (val) {
            try { await App.sb.post('page_proofs', {book_id: BOOK_ID, stem, user_id: ME}); owners.set(stem, ME); }
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
      if (jerr && !proofDb) {                                            // পুরনো মোডে GitHub-ই একমাত্র সংরক্ষণ
        toast('প্রুফড তালিকা সেভ ব্যর্থ: ' + jerr.message, true);
        refresh(); return false;
      }
      if (val) proofed.add(stem); else proofed.delete(stem);
      if (proofDb) { loadDone(); try { App.log(val ? 'proof' : 'unproof', (CTX.book.name || BOOK_ID) + ' / ' + stem); } catch (e) {} }
      if (!val) reviews.delete(stem); else if (!reviews.has(stem)) reviews.set(stem, {s: 'pending', note: ''});
      if (jerr) toast('প্রুফড চিহ্ন সংরক্ষিত হয়েছে, কিন্তু GitHub-এর প্রুফড ফাইল হালনাগাদ হয়নি: ' + jerr.message, true, 6000);
      refresh();
      return true;
    }

    // ---------- ইনিশিয়ালাইজ ----------
    async function init() {
      if (initing) return;
      initing = true; initFailed = false;
      autoTried.clear();
      flush();
      $('stText').textContent = 'লোড হচ্ছে…';
      try {
        if (!cfg.token) toast('টোকেন নেই — শুধু দেখা যাবে, সেভ/পুশ হবে না (সেটিংস থেকে টোকেন দিন)', true, 4500);

        // ডিফল্ট ব্রাঞ্চ ও লেখার অনুমতি জানা
        const ri = await api('');
        if (!ri.ok) throw new Error(await errMsg(ri));
        const info = await ri.json();
        repoPrivate = !!info.private;
        defaultBranch = info.default_branch || '';
        if (cfg.token && info.permissions && info.permissions.push === false)
          toast('এই টোকেনে রিপোতে লেখার অনুমতি নেই (Contents: Read and write দিন)', true, 6000);
        const br = cfg.branch || info.default_branch;

        // এক রিকোয়েস্টে পুরো ফাইল তালিকা (১০০০-এর বেশি পেইজেও কাজ করে)
        const rt = await api('/git/trees/' + encodeURIComponent(br) + '?recursive=1');
        if (!rt.ok) throw new Error(await errMsg(rt));
        const tj = await rt.json();
        if (tj.truncated) toast('সতর্কতা: রিপো খুব বড়, ফাইল তালিকা অসম্পূর্ণ হতে পারে', true);
        const blobs = (tj.tree || []).filter(e => e.type === 'blob');

        const pp = pagesDir() + '/', tp = textsDir() + '/';
        const direct = (e, pre) => e.path.startsWith(pre) && e.path.indexOf('/', pre.length) < 0;

        const imgs = blobs.filter(e => direct(e, pp) && /\.(jpe?g|png|webp)$/i.test(e.path))
                          .map(e => { const name = e.path.slice(pp.length); return {name, stem: name.replace(/\.[^.]+$/, '')}; })
                          .sort((a, b) => natCmp(a.name, b.name));
        if (!imgs.length) throw new Error(pagesDir() + '/ ফোল্ডারে কোনো ছবি নেই');

        const ts = new Set();
        blobs.forEach(e => { if (direct(e, tp) && /\.txt$/i.test(e.path)) ts.add(e.path.slice(tp.length).replace(/\.txt$/i, '')); });
        if (!blobs.some(e => e.path.startsWith(tp)))
          toast(textsDir() + '/ ফোল্ডার এখনো নেই — প্রথম সেভ করলেই নিজে থেকে তৈরি হবে', false, 4500);

        let ps = new Set(), psha = null;
        const readProof = async path => {
          const r3 = await api('/contents/' + epath(path) + refQ());
          if (!r3.ok) return null;
          const j = await r3.json(), out = new Set();
          try { (JSON.parse(fromB64(j.content)).proofed || []).forEach(s => out.add(s)); } catch(e) {}
          return {sha: j.sha, set: out};
        };
        legacyProof = false;
        if (blobs.some(e => e.path === proofPath())) {
          const r = await readProof(proofPath());
          if (r) { psha = r.sha; ps = r.set; }
        } else if (proofDirName() && blobs.some(e => e.path === legacyProofPath())) {
          // পুরনো জায়গা (রিপোর রুট) থেকে পড়া: প্রথম সেভে নতুন ফোল্ডারে ফাইল তৈরি হবে
          const r = await readProof(legacyProofPath());
          if (r) { ps = r.set; psha = null; legacyProof = true; }
        }

        images = imgs; textSet = ts; proofed = ps; proofSha = psha;
        owners = new Map();
        const pr = await refreshProofs();                            // কে কোন পেইজ প্রুফড করেছে (Supabase)
        if (pr === false) throw new Error('প্রুফড মালিকানা আনা যায়নি (নেটওয়ার্ক) — রিলোড চাপুন');
        if (pr === 'none') toast(IS_ADMIN ? 'Supabase-এ page_proofs টেবিল নেই — supabase_page_proofs.sql চালান; তার আগে ইউজার-ভিত্তিক লুকানো কাজ করবে না' : 'প্রুফড মালিকানা সক্রিয় নেই (অ্যাডমিনকে জানান)', true, 7000);
        cur = -1; renderSelect();
        let start = images.findIndex(im => im.stem === (wantPage || cfg.last));   // লিংকের পেইজ, নইলে যেখানে ছিলেন সেখান থেকে শুরু
        if (start < 0 || isHid(start)) start = stepVis(-1, 1);       // নইলে প্রথম দৃশ্যমান পেইজ
        if (start < 0) { showNone(); return; }
        restoreOnce = true;
        await go(start);
      } catch (e) {
        initFailed = true;
        $('stText').textContent = '';
        toast('সংযোগ ব্যর্থ: ' + e.message, true);
        openSettings();
      } finally { initing = false; }
    }

    // ---------- সেটিংস ----------
    function fillVoiceSel(selId, l) {
      const s = $(selId), list = voicesFor(l), want = (cfg.tts || {})[l] || '';
      s.innerHTML = '';
      const o0 = document.createElement('option');
      o0.value = '';
      o0.textContent = list.length ? 'স্বয়ংক্রিয়' : 'এই ডিভাইসে ' + TTS_NAME[l] + ' ভয়েস দেখা যাচ্ছে না';
      s.appendChild(o0);
      list.forEach(v => {
        const o = document.createElement('option');
        o.value = v.voiceURI || v.name;
        o.textContent = v.name + ' (' + v.lang + ')';
        s.appendChild(o);
      });
      s.value = want;
      if (s.value !== want) s.value = '';
    }
    function openSettings() {
      $('cRepo').value = cfg.repo; $('cBranch').value = cfg.branch; $('cToken').value = cfg.token;
      $('cBook').value = cfg.book || ''; $('cProofDir').value = proofDirName();
      $('cPages').value = cfg.pagesDir; $('cTexts').value = cfg.textsDir; $('cProof').value = cfg.proofFile;
      updatePreview();
      $('cEngine').value = cfg.ttsEngine;
      loadVoices();
      fillVoiceSel('cVoiceBn', 'bn'); fillVoiceSel('cVoiceAr', 'ar'); fillVoiceSel('cVoiceEn', 'en');
      const d = $('dlg'); if (!d.open) d.showModal();
    }
    $('btnSettings').onclick = openSettings;
    $('cCancel').onclick = () => $('dlg').close();
    $('cClearTok').onclick = () => { $('cToken').value = ''; cfg.token = ''; saveCfg(); toast('টোকেন মুছে ফেলা হয়েছে'); };
    $('cSave').onclick = () => {
      const oldSig = connected.sig;
      const repo = $('cRepo').value.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '');
      if (!/^[^\/\s]+\/[^\/\s]+$/.test(repo)) { toast('রিপো owner/repo আকারে দিন', true); return; }
      cfg.repo = repo;
      cfg.branch = $('cBranch').value.trim();
      cfg.token = $('cToken').value.trim();
      cfg.pagesDir = $('cPages').value.trim().replace(/^\/+|\/+$/g, '') || 'pages';
      cfg.textsDir = $('cTexts').value.trim().replace(/^\/+|\/+$/g, '') || 'texts';
      cfg.proofFile = $('cProof').value.trim().replace(/^\/+/, '') || 'proofed.json';
      cfg.book = trimSl($('cBook').value); cfg.proofDir = trimSl($('cProofDir').value);
      cfg.ttsEngine = $('cEngine').value;
      cfg.tts = {bn: $('cVoiceBn').value, ar: $('cVoiceAr').value, en: $('cVoiceEn').value};
      tts.forceG = false;                 // ইঞ্জিন/ভয়েস বদলালে স্বয়ংক্রিয় ফলব্যাক আবার প্রথম থেকে
      if (connSig() !== oldSig) { cfg.last = ''; cfg.view = null; }   // রিপো/ব্রাঞ্চ/কিতাব/ফোল্ডার বদলালে শেষ-পেইজ রিসেট
      connected.repo = cfg.repo; connected.branch = cfg.branch; connected.sig = connSig();
      saveCfg();
      imgCache.clear();
      forceInit = true;
      $('dlg').close();
    };
    // ---------- স্বয়ংক্রিয় সংরক্ষণ (সেটিংস): ফর্মে যা বদলাবে সাথে সাথে সংরক্ষিত হবে ----------
    const connSig = () => [cfg.repo, cfg.branch, pagesDir(), textsDir(), proofPath()].join('|');
    const connected = {repo: cfg.repo, branch: cfg.branch, sig: connSig()};   // সর্বশেষ যে রিপো/ব্রাঞ্চ/কিতাব-ফোল্ডারে সংযোগ হয়েছে
    function updatePreview() {          // কোন ফোল্ডার/ফাইল আসলে ব্যবহার হবে তা দেখায়
      const el = $('cPreview'); if (!el) return;
      el.textContent = 'এখন ব্যবহার হবে → ছবি: ' + pagesDir() + '/ • টেক্সট: ' + textsDir() + '/ • প্রুফড: ' + proofPath();
    }
    const normRepo = v => v.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '');
    const SETTINGS_FIELDS = {
      cRepo:    v => { const r = normRepo(v); if (/^[^\/\s]+\/[^\/\s]+$/.test(r)) cfg.repo = r; },
      cBranch:  v => { cfg.branch = v.trim(); },
      cToken:   v => { cfg.token = v.trim(); },
      cBook:    v => { cfg.book = trimSl(v); },
      cProofDir: v => { cfg.proofDir = trimSl(v); },
      cPages:   v => { cfg.pagesDir = v.trim().replace(/^\/+|\/+$/g, '') || 'pages'; },
      cTexts:   v => { cfg.textsDir = v.trim().replace(/^\/+|\/+$/g, '') || 'texts'; },
      cProof:   v => { cfg.proofFile = v.trim().replace(/^\/+/, '') || 'proofed.json'; },
      cEngine:  v => { cfg.ttsEngine = v; tts.forceG = false; },
      cVoiceBn: v => { cfg.tts = {...cfg.tts, bn: v}; },
      cVoiceAr: v => { cfg.tts = {...cfg.tts, ar: v}; },
      cVoiceEn: v => { cfg.tts = {...cfg.tts, en: v}; }
    };
    Object.keys(SETTINGS_FIELDS).forEach(id => {
      const el = $(id), h = () => { SETTINGS_FIELDS[id](el.value); saveCfg(); updatePreview(); };
      el.addEventListener('input', h); el.addEventListener('change', h);
    });

    // ডায়ালগ বন্ধ হলে: সেভ করলে বা প্রথমবার (তালিকা নেই) হলে সংযোগ শুরু
    $('dlg').addEventListener('close', () => {
      closeDD();
      if (connSig() !== connected.sig) {   // রিপো/ব্রাঞ্চ/কিতাব/ফোল্ডার বদলেছে (স্বয়ংক্রিয় সংরক্ষিত): বন্ধ করলেই নতুন সেটিংয়ে সংযোগ হয়, যাতে পুরনো তালিকা থেকে ভুল ফোল্ডারে সেভ না হয়
        cfg.last = ''; cfg.view = null;
        connected.repo = cfg.repo; connected.branch = cfg.branch; connected.sig = connSig();
        saveCfg(); imgCache.clear(); forceInit = true;
      }
      if (forceInit || (!images.length && !initFailed && !initing)) { forceInit = false; init(); }
    });
    // খোলা ড্রপডাউনে Esc চাপলে শুধু ড্রপডাউন বন্ধ হবে, পুরো ডায়ালগ নয়
    $('dlg').addEventListener('cancel', e => { if (ddOpen) { e.preventDefault(); closeDD(); } });

    // ---------- ইভেন্ট ----------
    $('btnReload').onclick = () => { imgCache.clear(); init(); };
    $('btnPrev').onclick = () => go(stepVis(cur, -1));      // অন্যের প্রুফড পেইজ বাদ দিয়ে আগের পেইজ
    $('btnNext').onclick = () => go(stepVis(cur, 1));       // অন্যের প্রুফড পেইজ বাদ দিয়ে পরের পেইজ
    sel.onchange = () => go(parseInt(sel.value, 10));
    function jumpTo() {
      const n = parseInt($('jump').value, 10);
      if (!n) return;
      let i = images.findIndex(im => numOf(im.stem) === n);
      if (i < 0 && n >= 1 && n <= images.length) i = n - 1;
      if (i < 0) { toast('এই নম্বরের পেইজ নেই', true); return; }
      if (isHid(i)) { toast('এই পেইজ অন্য ইউজার প্রুফড করেছেন — আপনি দেখতে পারবেন না', true); return; }
      go(i);
    }
    $('btnGo').onclick = jumpTo;
    $('jump').addEventListener('keydown', e => { if (e.key === 'Enter') jumpTo(); });
    $('btnNextUn').onclick = () => {
      for (let k = 1; k <= images.length; k++) {
        const i = (cur + k) % images.length;
        if (!isHid(i) && !proofed.has(images[i].stem)) { go(i); return; }
      }
      toast('সব পেইজ প্রুফড!');
    };
    $('btnSwap').onclick = () => { cfg.swap = !cfg.swap; saveCfg(); applySwap(); };
    $('zIn').onclick  = () => { cfg.zoom = Math.min(400, cfg.zoom + 25); saveCfg(); applyZoom(); };
    $('zOut').onclick = () => { cfg.zoom = Math.max(50, cfg.zoom - 25); saveCfg(); applyZoom(); };
    $('zFit').onclick = () => { cfg.zoom = 100; saveCfg(); applyZoom(); };
    $('fIn').onclick  = () => { cfg.fs = Math.min(40, cfg.fs + 2); saveCfg(); applyFont(); };
    $('fOut').onclick = () => { cfg.fs = Math.max(12, cfg.fs - 2); saveCfg(); applyFont(); };

    // টাইপ করলেই (০.৩ সেকেন্ড থেমে) লোকাল স্টোরেজে খসড়া সংরক্ষণ
    ta.addEventListener('input', () => {
      updateStatus();
      clearTimeout(draftT); draftT = setTimeout(stashDraft, 300);
      lazyView();
    });
    ta.addEventListener('scroll', lazyView, {passive: true});
    ta.addEventListener('keyup', lazyView);
    ta.addEventListener('click', lazyView);
    imgBox.addEventListener('scroll', lazyView, {passive: true});

    // ---------- কপি / পেস্ট (পেস্টের পর কার্সর শুরুতে) ----------
    // ---------- অটো হেডিং: পেস্ট করা টেক্সটে হেডিং শনাক্ত করে আগে (স্পেস ছাড়া) 1 বসানো ----------
    const AR_RE   = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;           // আরবি/ফার্সি লাইন বাদ
    const BN_LET  = /[\u0985-\u09B9\u09CE\u09DC-\u09DF A-Za-z]/;                         // অন্তত একটি অক্ষর (শুধু সংখ্যা/চিহ্ন নয়)
    const END_RE  = /[।.?!,;:]["”’'\)\]]*$/;                                            // বাক্যের শেষ চিহ্ন
    const SENT_RE = /[।.?!]["”’'\)\]]*$/;                                               // আগের বাক্য শেষ হয়েছে কি না
    const KEY_RE  = /^(দলিল|অধ্যায়|পরিচ্ছেদ|অনুচ্ছেদ|ভূমিকা|মুখবন্ধ|সূচিপত্র|উপসংহার|পর্ব|প্রশ্ন|উত্তর|প্রসঙ্গ|বিষয়)(?![\u0980-\u09FF])/;
    function isHeading(line, prev, first) {
      const t = line.trim();
      if (!t || t.length > 80) return false;
      if (AR_RE.test(t) || !BN_LET.test(t)) return false;      // আরবি লাইন, পেইজ নম্বর ইত্যাদি নয়
      if (/^1[\u0980-\u09FF]/.test(t)) return false;           // আগেই চিহ্নিত
      if (/[।.?!,;]["”’'\)\]]*$/.test(t)) return false;        // বাক্য শেষ হলে হেডিং নয়
      if (KEY_RE.test(t)) return true;                         // দলিল/অধ্যায়… দিয়ে শুরু
      if (t.length > 50 || t.split(/\s+/).length > 8) return false;   // হেডিং ছোট হয়
      if (/[–—\-]$/.test(t) && !/[\d০-৯]/.test(t)) return false;      // "…আছে–" ধরনের পরিচায়ক লাইন নয়
      if (/:$/.test(t) && t.split(/\s+/).length > 4) return false;
      const p = (prev || '').trim();
      return first || p === '' || SENT_RE.test(p);              // আগের প্যারাগ্রাফ শেষ হয়ে নতুন লাইনে এসেছে
    }
    function markHeadings(text) {
      const lines = text.split(/\r?\n/);
      let n = 0;
      const out = lines.map((ln, i) => {
        if (isHeading(ln, i ? lines[i - 1] : '', i === 0)) { n++; return '1' + ln.trim(); }
        return ln;
      });
      return {text: out.join('\n'), n};
    }
    function applyAuto() {
      const b = $('btnAuto');
      b.classList.toggle('on', !!cfg.autoHead);
      b.setAttribute('aria-pressed', cfg.autoHead ? 'true' : 'false');
      b.innerHTML = ic('tag') + '<span>হেডিং: ' + (cfg.autoHead ? 'চালু' : 'বন্ধ') + '</span>';
    }
    $('btnAuto').onclick = () => {
      cfg.autoHead = !cfg.autoHead; saveCfg(); applyAuto();
      toast(cfg.autoHead ? 'অটো হেডিং চালু — পেস্টে হেডিংয়ের আগে 1 বসবে' : 'অটো হেডিং বন্ধ');
    };

    // replaceAll = true হলে আগের সব টেক্সট মুছে নতুন টেক্সট বসবে (আনডু (Ctrl+Z) কাজ করবে)
    // নইলে বর্তমান নির্বাচন/কার্সরের জায়গায় বসবে। উভয় ক্ষেত্রে বসানোর পর কার্সর বসানো টেক্সটের শুরুতে থাকে।
    function insertAtStart(text, replaceAll, quiet) {
      if (!text) return -1;
      let hn = -1;
      if (cfg.autoHead) { const r = markHeadings(text); text = r.text; hn = r.n; }
      ta.focus({preventScroll: true});
      if (replaceAll) ta.setSelectionRange(0, ta.value.length);   // পুরো টেক্সট নির্বাচন → নতুন টেক্সট তার জায়গা নেবে
      const s = ta.selectionStart, e = ta.selectionEnd;
      let done = false;
      try { done = document.execCommand('insertText', false, text); } catch(_) {}   // আনডু ঠিক রাখে
      if (!done) {
        ta.setRangeText(text, s, e, 'end');
        ta.dispatchEvent(new Event('input', {bubbles: true}));
      }
      ta.setSelectionRange(s, s);               // কার্সর বসানো টেক্সটের শুরুতে
      if (s === 0) ta.scrollTop = 0;            // শুরু থেকে দেখাবে
      if (!quiet) {
        if (replaceAll) toast('আগের টেক্সট মুছে নতুন টেক্সট বসানো হয়েছে' + (hn >= 0 ? ' • ' + hn + 'টি হেডিং চিহ্নিত (1 বসানো)' : ''));
        else if (hn >= 0) toast(hn + 'টি হেডিং চিহ্নিত হয়েছে (1 বসানো)');
      }
      lazyView();
      return hn;
    }
    $('btnPaste').onclick = async () => {
      if (cur < 0 || ta.disabled) return;
      try {
        const t = await navigator.clipboard.readText();
        if (!t) { toast('ক্লিপবোর্ড খালি', true); return; }
        insertAtStart(t, true);                 // পেস্ট বাটন: আগের সব টেক্সট মুছে নতুন টেক্সট
      } catch (e) {
        ta.focus();
        ta.select();                            // সব নির্বাচিত থাকবে, তাই হাতে পেস্ট করলেও আগের টেক্সট মুছে যাবে
        toast('ব্রাউজার ক্লিপবোর্ড পড়তে দিচ্ছে না — পুরো টেক্সট নির্বাচিত আছে, টেক্সট বক্সে চেপে ধরে/Ctrl+V দিয়ে পেস্ট করুন (আগের টেক্সট মুছে নতুনটি বসবে)', true, 6500);
      }
    };
    // সাধারণ পেস্ট (Ctrl+V / লং-প্রেস): নির্বাচন/কার্সরের জায়গায় বসে, তারপর কার্সর শুরুতে থাকে
    ta.addEventListener('paste', e => {
      const t = e.clipboardData && e.clipboardData.getData('text');
      if (!t) return;
      e.preventDefault();
      insertAtStart(t, false);
    });
    $('btnCopy').onclick = async () => {
      if (cur < 0) return;
      const a = ta.selectionStart, b = ta.selectionEnd;
      const part = a !== b;
      const text = part ? ta.value.slice(a, b) : ta.value;
      if (!text) { toast('কপি করার মতো টেক্সট নেই', true); return; }
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; }
      catch (e) {
        try { ta.focus(); if (!part) ta.select(); ok = document.execCommand('copy'); if (!part) ta.setSelectionRange(a, b); } catch (_) {}
      }
      toast(ok ? (part ? 'নির্বাচিত অংশ কপি হয়েছে' : 'পুরো টেক্সট কপি হয়েছে') : 'কপি ব্যর্থ', !ok);
    };

    // ---------- শোনা (TTS) ----------
    // ইঞ্জিন: (১) ফোনের নিজস্ব TTS (speechSynthesis), (২) Google Translate-এর অনলাইন অডিও (অনানুষ্ঠানিক, কী লাগে না),
    // (৩) অতিরিক্ত সার্ভিস: Edge TTS, Pollinations, Piper/নিজস্ব সার্ভার, IBM Watson, Fish Audio (নিচে "শোনার সার্ভিস বাছাই" অংশে)।
    // "শুনুন" চাপলে প্রতিবার সার্ভিস বাছার ডায়ালগ আসে। "স্বয়ংক্রিয়" মোডে ফোনের TTS (ও সেই ভাষার ভয়েস) থাকলে সেটা, না থাকলে বা সাড়া না দিলে Google অনলাইন।
    // নির্বাচিত অংশ থাকলে সেটুকু, নইলে কার্সর থেকে শেষ পর্যন্ত পড়ে। বাংলা/আরবি/ইংরেজি আলাদা করে চিনে।
    const hasTTS = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
    const TTS_LANG = {bn:'bn-BD', ar:'ar-SA', en:'en-US'};     // ফোনের TTS-এর ভাষা কোড
    const G_LANG   = {bn:'bn', ar:'ar', en:'en'};              // Google-এর ভাষা কোড
    const TTS_NAME = {bn:'বাংলা', ar:'আরবি', en:'ইংরেজি'};
    const TTS_MAX  = 180;                                      // এক খণ্ডে সর্বোচ্চ অক্ষর (Google সীমা ~200)
    const TTS_SENT = /[।.?!۔؟]["”’'\)\]]*$/;                    // বাক্য শেষ
    let voices = [], ttsWarned = {};
    const tts = {id:0, chunks:[], i:0, state:'idle', start:0, u:null, ga:null, cache:{}, xc:{}, forceG:false, noG:false, retry:{}, wd:0, stale:false, reselect:false};   // state: idle | playing | paused

    function loadVoices() { try { voices = hasTTS ? (speechSynthesis.getVoices() || []) : []; } catch(e) { voices = []; } }
    if (hasTTS) { loadVoices(); try { speechSynthesis.addEventListener('voiceschanged', loadVoices); } catch(e) {} }
    const cancelDev = () => { if (hasTTS) { try { speechSynthesis.cancel(); } catch(e) {} } };
    const vLang = v => (v.lang || '').replace('_', '-').toLowerCase();
    const voicesFor = l => voices.filter(v => vLang(v).startsWith(l));
    function pickVoice(l) {
      const want = (cfg.tts || {})[l];
      if (want) { const v = voices.find(v => v.voiceURI === want || v.name === want); if (v) return v; }
      const list = voicesFor(l);
      return list.find(v => vLang(v) === TTS_LANG[l].toLowerCase()) || list[0] || null;
    }
    function wordLang(w) {
      if (AR_RE.test(w)) return 'ar';
      if (/[\u0980-\u09FF]/.test(w)) return 'bn';
      if (/[A-Za-z]/.test(w)) return 'en';
      return null;                              // সংখ্যা/চিহ্ন: আগের ভাষাতেই থাকবে
    }
    // টেক্সটকে ভাষা অনুযায়ী খণ্ডে ভাগ; প্রতিটি খণ্ডের off = ta.value-তে শুরুর অবস্থান
    function buildChunks(text, from, to) {
      const seg = text.slice(from, to), out = [];
      let c = null, last = 'bn', lastEnd = 0, inHead = false, first = true;
      const fl = () => { if (c && c.t.trim()) out.push(c); c = null; };
      const re = /\S+/g; let m;
      while ((m = re.exec(seg))) {
        const gap = seg.slice(lastEnd, m.index); lastEnd = m.index + m[0].length;
        const nl = first || /\n/.test(gap); first = false;
        let w = m[0], head = false, skip = 0;
        if (nl && /^1(?=[\u0980-\u09FF])/.test(w)) { w = w.slice(1); head = true; skip = 1; }   // হেডিং চিহ্ন 1 পড়া হবে না
        if (nl && inHead) { fl(); inHead = false; }                // হেডিং লাইন শেষ
        if (/\n\s*\n/.test(gap)) fl();                             // ফাঁকা লাইন = অনুচ্ছেদ শেষ
        if (head) { fl(); inHead = true; }
        if (!w) continue;
        const L = wordLang(w) || (c ? c.lang : last);
        if (c && (c.lang !== L || c.t.length + w.length + 1 > TTS_MAX)) fl();
        if (!c) c = {t: '', lang: L, off: from + m.index, end: 0, w: []};
        c.t += (c.t ? ' ' : '') + w;
        c.w.push({p: c.t.length - w.length, o: from + m.index + skip, l: w.length});   // শব্দের অবস্থান: c.t-তে (p) ও মূল টেক্সটে (o)
        c.end = from + m.index + m[0].length;
        last = L;
        if (TTS_SENT.test(w)) fl();
      }
      fl();
      return out;
    }
    function ttsUI() {
      const b = $('btnPlay'); if (!b) return;
      const pl = tts.state === 'playing';
      b.innerHTML = ic(pl ? 'pause' : 'play') + '<span>' + (pl ? 'বিরতি' : (tts.state === 'paused' ? 'চালান' : 'শুনুন')) + '</span>';
      b.classList.toggle('on', pl);
      $('btnStop').disabled = tts.state === 'idle';
    }
    // ---------- পড়ার সময় টেক্সট হাইলাইট ----------
    // বর্তমান খণ্ড (বাক্য) হালকা হলুদে; ফোনের TTS শব্দ-সীমা (boundary) জানালে বর্তমান শব্দ গাঢ় কমলায়।
    // textarea-র পেছনে একই ফন্ট/মাপের আয়না-স্তর (#hl) থেকে রং আসে, তাই ফোকাস/কিবোর্ড লাগে না।
    const hlEl = $('hl');
    const hlEsc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    function hlClear() { hlEl.style.display = 'none'; hlEl.textContent = ''; }
    function hlShow(a, b, wa, wb) {
      const t = ta.value;
      if (tts.stale || b <= a || b > t.length) return false;       // টেক্সট বদলে গেছে → আর হাইলাইট নয়
      let h;
      if (wa >= a && wb > wa && wb <= b)
        h = hlEsc(t.slice(0, a)) + '<mark class="c">' + hlEsc(t.slice(a, wa)) + '<mark class="w">' + hlEsc(t.slice(wa, wb)) + '</mark>'
          + hlEsc(t.slice(wb, b)) + '</mark>' + hlEsc(t.slice(b));
      else h = hlEsc(t.slice(0, a)) + '<mark class="c">' + hlEsc(t.slice(a, b)) + '</mark>' + hlEsc(t.slice(b));
      hlEl.innerHTML = h + '\u200b';
      hlEl.style.display = 'block';
      const m = hlEl.querySelector('mark.w') || hlEl.querySelector('mark.c');
      if (m) {                                                      // হাইলাইট দেখার জায়গার বাইরে গেলে স্ক্রল করে ওপরের দিকে আনা
        const top = m.offsetTop, bot = top + m.offsetHeight, vh = ta.clientHeight;
        if (top < ta.scrollTop + vh * 0.08 || bot > ta.scrollTop + vh * 0.8) ta.scrollTop = Math.max(0, top - vh * 0.25);
      }
      hlEl.scrollTop = ta.scrollTop;
      return true;
    }
    ta.addEventListener('scroll', () => { if (hlEl.style.display !== 'none') hlEl.scrollTop = ta.scrollTop; }, {passive: true});
    // শোনার মধ্যে টেক্সট বদলালে অবস্থান-হিসাব মেলে না: হাইলাইট মুছে দেওয়া হয় (পরের বার "শুনুন" চাপলে আবার চলবে)
    ta.addEventListener('input', () => { if (tts.state !== 'idle' && !tts.stale) { tts.stale = true; hlClear(); } });

    // পড়ার সাথে সাথে কার্সর/স্ক্রল অনুসরণ + হাইলাইট (ফোকাস না নিয়ে, তাই কিবোর্ড খুলবে না)
    function follow(c) {
      try { ta.setSelectionRange(c.off, c.off); } catch(e) {}
      if (hlShow(c.off, c.end, -1, -1)) return;
      const ratio = c.off / Math.max(1, ta.value.length);
      ta.scrollTop = Math.max(0, ta.scrollHeight * ratio - ta.clientHeight * 0.3);
    }
    function killAudio(a) {
      if (!a) return;
      try { a.onplay = a.onplaying = a.onended = a.onerror = null; a.pause(); a.removeAttribute('src'); a.load(); } catch(e) {}
      if (a._blob) { try { URL.revokeObjectURL(a._blob); } catch(e) {} a._blob = ''; }   // Edge/Watson/Fish-এর মেমোরি-অডিও ছেড়ে দেওয়া
    }
    function clearG() {
      killAudio(tts.ga); tts.ga = null;
      Object.keys(tts.cache).forEach(k => killAudio(tts.cache[k]));
      tts.cache = {};
      Object.keys(tts.xc).forEach(k => dropX(k));
    }
    function stopPlay() {
      tts.reselect = false;
      tts.id++;
      clearTimeout(tts.wd);
      cancelDev();
      clearG();
      tts.state = 'idle'; tts.u = null;
      hlClear();
      ttsUI();
    }
    function finishPlay() {
      tts.state = 'idle'; tts.i = 0; tts.u = null; clearG(); hlClear(); ttsUI();
      try { ta.setSelectionRange(tts.start, tts.start); } catch(e) {}
      toast('পড়া শেষ');
    }

    // --- Google অনলাইন অডিও ---
    function gAudio(i, bust) {
      if (tts.cache[i]) return tts.cache[i];
      const c = tts.chunks[i]; if (!c) return null;
      const a = new Audio();
      a.preload = 'auto';
      try { a.referrerPolicy = 'no-referrer'; } catch(e) {}
      a.src = 'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=' + G_LANG[c.lang] + '&total=1&idx=0&textlen=' + c.t.length + '&q=' + encodeURIComponent(c.t) + (bust ? '&_=' + Date.now() : '');
      tts.cache[i] = a;
      return a;
    }
    // Google অডিও ব্যর্থ হলে: ৩ বার পুনঃচেষ্টা (বিরতি বাড়িয়ে) → তারপর ফোনের TTS (থাকলে) → নইলে ওই খণ্ডে থেমে থাকে; "চালান" চাপলে সেখান থেকেই চলে
    const G_RETRY = 3, G_WAIT = [1500, 4000, 9000];
    function playG(i, id, bust) {
      if (id !== tts.id) return;
      const c = tts.chunks[i], a = gAudio(i, bust);
      if (!a) { stopPlay(); return; }
      tts.ga = a;
      try { a.playbackRate = Math.min(2, Math.max(0.5, parseFloat(cfg.ttsRate) || 1)); a.preservesPitch = true; } catch(e) {}
      let settled = false;
      const pauseHere = (msg, re = true) => {
        tts.id++; clearTimeout(tts.wd); cancelDev(); clearG();
        tts.state = 'paused'; tts.i = i; tts.reselect = re; ttsUI();
        toast(msg, true, 9000);
      };
      const fail = why => {
        if (id !== tts.id || settled) return;
        settled = true; clearTimeout(tts.wd);
        killAudio(a); delete tts.cache[i]; if (tts.ga === a) tts.ga = null;
        const n = tts.retry[i] = (tts.retry[i] || 0) + 1;
        if (n <= G_RETRY) {
          toast('Google অডিও আটকেছে (' + why + ') — আবার চেষ্টা ' + n + '/' + G_RETRY + '…', false, G_WAIT[n - 1]);
          tts.wd = setTimeout(() => playG(i, id, true), G_WAIT[n - 1]);
          return;
        }
        if ((cfg.ttsEngine || 'auto') === 'auto' && hasTTS && pickVoice(c.lang)) {
          tts.noG = true;
          toast('Google অনলাইন অডিও বারবার ব্যর্থ — বাকিটা ফোনের TTS-এ চলছে', false, 4000);
          speakChunk(i, id); return;
        }
        pauseHere('Google অডিও পাওয়া যাচ্ছে না (' + why + ') — সার্ভিসটি সাময়িক ব্লক/সীমিত হতে পারে। কিছুক্ষণ পরে বা অন্য সার্ভিস বেছে নিয়ে "চালান" চাপুন — এই জায়গা থেকেই চলবে। (স্থায়ী সমাধান: সেটিংসে "শুধু ফোনের TTS" + ফোনে বাংলা ভয়েস ডেটা)');
      };
      a.onplay    = () => { if (id === tts.id) follow(c); };
      a.onplaying = () => { clearTimeout(tts.wd); };
      a.onended   = () => { if (id === tts.id) { delete tts.cache[i]; speakChunk(i + 1, id); } };
      a.onerror   = () => fail('সার্ভার অডিও দেয়নি');
      clearTimeout(tts.wd); tts.wd = setTimeout(() => fail('সাড়া আসেনি'), 15000);   // নেটওয়ার্ক ঝুলে গেলে
      const p = a.play();
      if (p && p.catch) p.catch(err => {
        if (id !== tts.id) return;
        const nm = (err && err.name) || '';
        if (nm === 'AbortError') return;
        if (nm === 'NotAllowedError') { pauseHere('ব্রাউজার অডিও চালাতে দেয়নি — আবার "চালান" চাপুন', false); return; }
        fail(nm === 'NotSupportedError' ? 'সার্ভার অডিও ফেরত দেয়নি, সম্ভবত রেট-লিমিট' : (nm || 'অজানা ত্রুটি'));
      });
      if (i + 1 < tts.chunks.length) gAudio(i + 1);     // পরের খণ্ড আগাম লোড
    }

    // --- ফোনের TTS ---
    function speakChunk(i, id) {
      if (id !== tts.id) return;
      if (i >= tts.chunks.length) { finishPlay(); return; }
      tts.i = i;
      const c = tts.chunks[i];
      let eng = cfg.ttsEngine || 'auto';
      if (XENG[eng]) {                          // অতিরিক্ত সার্ভিস (Edge/Pollinations/সার্ভার/Watson/Fish)
        if (XENG[eng].langs[c.lang]) { playX(i, id); return; }
        if (!ttsWarned['x' + c.lang]) {         // সার্ভিসটি এই ভাষা পারে না → শুধু এই অংশ ফোনের TTS / Google-এ
          ttsWarned['x' + c.lang] = 1;
          toast(XENG[eng].short + '-এ ' + TTS_NAME[c.lang] + ' নেই — ' + TTS_NAME[c.lang] + ' অংশ ফোনের TTS/Google-এ পড়া হচ্ছে', false, 4500);
        }
        eng = 'auto';
      }
      const v = hasTTS ? pickVoice(c.lang) : null;
      const wantG = tts.forceG || !hasTTS || !v;
      const useG = eng === 'google' || (eng === 'auto' && wantG && !(tts.noG && hasTTS && v));
      if (useG) { playG(i, id); return; }
      if (!hasTTS) { stopPlay(); toast('এই ব্রাউজারে ফোনের টেক্সট-টু-স্পিচ নেই — সেটিংসে ইঞ্জিন "স্বয়ংক্রিয়" বা "Google অনলাইন" করুন', true, 6000); return; }

      const fallbackToG = why => {
        if (id !== tts.id || eng !== 'auto') return false;
        tts.forceG = true; clearTimeout(tts.wd); cancelDev();
        toast('ফোনের TTS ' + why + ' — Google অনলাইন ভয়েস ব্যবহার হচ্ছে', false, 3500);
        playG(i, id);
        return true;
      };
      const u = new SpeechSynthesisUtterance(c.t);
      u.lang = TTS_LANG[c.lang];
      if (v) { u.voice = v; u.lang = v.lang; }
      else if (voices.length && !ttsWarned[c.lang]) {
        ttsWarned[c.lang] = 1;
        toast(TTS_NAME[c.lang] + ' ভয়েস পাওয়া যায়নি — ফোনের টেক্সট-টু-স্পিচ সেটিংসে ভয়েস ডেটা ডাউনলোড করুন', true, 6000);
      }
      u.rate = parseFloat(cfg.ttsRate) || 1;
      let started = false;
      u.onstart = () => { started = true; clearTimeout(tts.wd); if (id === tts.id) follow(c); };
      u.onboundary = ev => {                    // শব্দ-সীমা: সব ইঞ্জিন পাঠায় না; পেলে বর্তমান শব্দ গাঢ় হাইলাইট
        if (id !== tts.id || tts.stale || (ev.name && ev.name !== 'word') || !c.w) return;
        let wd = null;
        for (let k = 0; k < c.w.length; k++) { if (c.w[k].p <= ev.charIndex) wd = c.w[k]; else break; }
        if (wd) hlShow(c.off, c.end, wd.o, wd.o + wd.l);
      };
      u.onend   = () => { clearTimeout(tts.wd); if (id === tts.id) speakChunk(i + 1, id); };
      u.onerror = e => {
        if (id !== tts.id) return;
        if (e.error === 'canceled' || e.error === 'interrupted') return;
        if (fallbackToG('সাড়া দেয়নি (' + (e.error || 'ত্রুটি') + ')')) return;
        stopPlay();
        toast('পড়তে সমস্যা: ' + (e.error || 'অজানা') + (e.error === 'language-unavailable' ? ' (এই ভাষার ভয়েস নেই)' : ''), true);
      };
      tts.u = u;                                // ব্রাউজার যেন অবজেক্ট মুছে না ফেলে
      try { speechSynthesis.speak(u); } catch(err) { if (!fallbackToG('চালু করা যায়নি')) { stopPlay(); toast('TTS চালু করা যায়নি', true); } return; }
      if (eng === 'auto') {                     // কিছু ফোনে TTS কোনো ত্রুটি ছাড়াই নীরব থাকে → ৪ সেকেন্ডে সাড়া না এলে Google
        clearTimeout(tts.wd);
        tts.wd = setTimeout(() => { if (id === tts.id && !started) fallbackToG('সাড়া দিচ্ছে না'); }, 4000);
      }
    }
    // ---------- শোনার সার্ভিস বাছাই (ডায়ালগ) + অতিরিক্ত সার্ভিস ----------
    // "শুনুন" চাপলে (নতুন করে শুরুর সময়) ডায়ালগ আসে: স্বয়ংক্রিয় / ফোনের TTS / Google অনলাইন + নিচের সার্ভিসগুলো থেকে একটি বাছতে হয়।
    // প্রতিটি সার্ভিসের কনফিগ (কী, ভয়েস, URL) ব্রাউজারে থেকে যায় (cfg.ttsx) — আবার টাইপ করতে হয় না।
    // সার্ভিস যে ভাষা পারে না (যেমন Watson/Fish-এ বাংলা), শুধু সেই অংশ নিজে থেকে ফোনের TTS/Google-এ পড়া হয়।
    // বিরতির পর "চালান" চাপলে ডায়ালগ আসে না (একই সার্ভিসে চলে); সার্ভিস ব্যর্থ হয়ে থামলে পরের "চালান"-এ আবার ডায়ালগ আসে।
    const EDGE_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
    const EDGE_VER = '1-143.0.3650.75';
    const VOP = a => a.map(v => Array.isArray(v) ? v : [v, v]);
    const XENG = {
      edge: {
        short: 'Edge TTS', name: 'Edge TTS (Microsoft)',
        desc: 'Microsoft Edge-এর অনলাইন ভয়েস — ফ্রি, কী লাগে না; বাংলা/আরবি/ইংরেজি তিনটিই।',
        tags: [['ফ্রি', 'ok'], ['কী লাগে না', 'ok'], ['বাংলা আছে', 'ok'], ['অনানুষ্ঠানিক', 'warn']],
        langs: {bn: 1, ar: 1, en: 1},
        fields: [
          {k: 'bn', t: 'sel', label: 'ভয়েস — বাংলা', opts: VOP([['bn-BD-NabanitaNeural', 'Nabanita (বাংলাদেশ, নারী)'], ['bn-BD-PradeepNeural', 'Pradeep (বাংলাদেশ, পুরুষ)'], ['bn-IN-TanishaaNeural', 'Tanishaa (ভারত, নারী)'], ['bn-IN-BashkarNeural', 'Bashkar (ভারত, পুরুষ)']])},
          {k: 'ar', t: 'sel', label: 'ভয়েস — আরবি', opts: VOP([['ar-SA-ZariyahNeural', 'Zariyah (সৌদি, নারী)'], ['ar-SA-HamedNeural', 'Hamed (সৌদি, পুরুষ)'], ['ar-EG-SalmaNeural', 'Salma (মিশর, নারী)'], ['ar-EG-ShakirNeural', 'Shakir (মিশর, পুরুষ)']])},
          {k: 'en', t: 'sel', label: 'ভয়েস — ইংরেজি', opts: VOP([['en-US-AriaNeural', 'Aria (US, নারী)'], ['en-US-GuyNeural', 'Guy (US, পুরুষ)'], ['en-US-JennyNeural', 'Jenny (US, নারী)'], ['en-GB-SoniaNeural', 'Sonia (UK, নারী)']])},
          {k: 'ver', t: 'text', label: 'Sec-MS-GEC-Version (উন্নত; ফাঁকা = ডিফল্ট)', ph: EDGE_VER}
        ],
        hint: 'এটি Microsoft-এর প্রকাশ্য API নয়, অনানুষ্ঠানিক সংযোগ — Microsoft বদলালে বা ব্লক করলে ব্যর্থ হতে পারে। তখন ওপরের "Sec-MS-GEC-Version" নতুন সংস্করণে বদলে দেখুন, নইলে অন্য সার্ভিস বাছুন।'
      },
      poll: {
        short: 'Pollinations', name: 'Pollinations',
        desc: 'ফ্রি AI ভয়েস API — সাইনআপ/কী ছাড়াই; URL-এ টেক্সট দিলে অডিও আসে।',
        tags: [['ফ্রি', 'ok'], ['কী লাগে না', 'ok'], ['বাংলার মান নিজে পরখ করুন', 'warn']],
        langs: {bn: 1, ar: 1, en: 1},
        fields: [
          {k: 'voice', t: 'sel', label: 'ভয়েস', opts: VOP(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'])},
          {k: 'tpl', t: 'text', label: 'URL টেমপ্লেট', ph: 'https://text.pollinations.ai/{text}?model=openai-audio&voice={voice}'}
        ],
        hint: '{text} = পড়ার টেক্সট, {voice} = ভয়েস। কখনো টেক্সট না পড়ে নিজে থেকে উত্তর দিলে {text}-এর আগে একটি নির্দেশ জুড়ে পরখ করুন, যেমন: https://text.pollinations.ai/Read%20aloud%3A%20{text}?model=openai-audio&voice={voice}'
      },
      server: {
        short: 'নিজস্ব সার্ভার', name: 'Piper / নিজস্ব সার্ভার (URL)',
        desc: 'নিজের কম্পিউটার/সার্ভারে চালানো যেকোনো TTS (যেমন Piper) — আনলিমিটেড ও প্রাইভেট।',
        tags: [['আনলিমিটেড', 'ok'], ['নিজে সেটআপ লাগে', 'warn']],
        langs: {bn: 1, ar: 1, en: 1},
        fields: [{k: 'url', t: 'text', label: 'URL টেমপ্লেট (GET → অডিও)', ph: 'http://localhost:5000/?text={text}'}],
        hint: '{text} = টেক্সট, {lang} = bn/ar/en। উদাহরণ (Piper HTTP সার্ভার): http://localhost:5000/?text={text}। HTTPS পেইজ থেকে http সার্ভার ব্রাউজার ব্লক করে (শুধু localhost বাদে), আর ফোনে localhost মানে ফোনটিই। Piper-এর বাংলা ভয়েস মডেল আছে কিনা আগে যাচাই করুন।'
      },
      watson: {
        short: 'IBM Watson', name: 'IBM Watson TTS',
        desc: 'IBM Cloud-এর ফ্রি (লাইট) প্ল্যানে সীমিত অক্ষর; আরবি ও ইংরেজি আছে।',
        tags: [['ফ্রি টিয়ার (সীমিত)', 'warn'], ['কী লাগে', 'warn'], ['বাংলা নেই', 'err']],
        langs: {ar: 1, en: 1},
        fields: [
          {k: 'url', t: 'text', label: 'Service URL', ph: 'https://api.us-south.text-to-speech.watson.cloud.ibm.com/instances/…'},
          {k: 'key', t: 'pw', label: 'API Key'},
          {k: 'en', t: 'sel', label: 'ভয়েস — ইংরেজি', opts: VOP([['en-US_MichaelV3Voice', 'Michael (US)'], ['en-US_AllisonV3Voice', 'Allison (US)'], ['en-GB_KateV3Voice', 'Kate (UK)']])},
          {k: 'ar', t: 'sel', label: 'ভয়েস — আরবি', opts: VOP([['ar-MS_OmarVoice', 'Omar']])}
        ],
        hint: 'IBM Cloud-এ Text to Speech সার্ভিস বানালে তার Credentials থেকে URL ও API Key পাবেন। বাংলা অংশ নিজে থেকে ফোনের TTS/Google-এ পড়া হবে।'
      },
      fish: {
        short: 'Fish Audio', name: 'Fish Audio',
        desc: 'উচ্চমানের AI ভয়েস API। ফ্রি অ্যাক্সেস সীমিত সময়ের ছিল — এখন ফ্রি আছে কিনা তাদের সাইটে দেখুন।',
        tags: [['কী লাগে', 'warn'], ['ফ্রি অনিশ্চিত', 'warn'], ['বাংলা নেই বলে জানি', 'err']],
        langs: {ar: 1, en: 1},
        fields: [
          {k: 'key', t: 'pw', label: 'API Key'},
          {k: 'model', t: 'text', label: 'Model (হেডার)', ph: 's1'},
          {k: 'ref', t: 'text', label: 'ভয়েস (reference_id) — ঐচ্ছিক'}
        ],
        hint: 'API Key: fish.audio → API Keys। Model-এ আপনার অ্যাকাউন্টে চালু মডেলের নাম দিন। বাংলা অংশ নিজে থেকে ফোনের TTS/Google-এ পড়া হবে।'
      }
    };
    const TS_BASE = {
      auto:   {name: 'স্বয়ংক্রিয় (প্রস্তাবিত)', desc: 'ফোনের TTS আগে; ভয়েস না থাকলে বা সাড়া না দিলে Google অনলাইন।', tags: [['কী লাগে না', 'ok']]},
      device: {name: 'ফোনের TTS', desc: 'ডিভাইসের নিজস্ব ইঞ্জিন — অফলাইনে চলে, আনলিমিটেড।', tags: [['অফলাইন', 'ok'], ['কী লাগে না', 'ok'], ['ভয়েস ডিভাইসের ওপর নির্ভর', 'warn']]},
      google: {name: 'Google অনলাইন', desc: 'Google Translate-এর অডিও — ভাষা নিজে চেনা হয়, ভয়েস বাছা যায় না।', tags: [['ইন্টারনেট লাগে', 'warn'], ['অনানুষ্ঠানিক — সীমিত হতে পারে', 'warn']]}
    };
    const TS_ORDER = ['auto', 'device', 'google', 'edge', 'poll', 'server', 'watson', 'fish'];
    const tsMeta = id => TS_BASE[id] || XENG[id];

    // --- অতিরিক্ত সার্ভিস থেকে অডিও আনা ---
    const tplUrl = (tpl, c, x) => String(tpl || '').replace(/\{(text|lang|voice)\}/g, (m, k) =>
      encodeURIComponent(k === 'text' ? c.t : k === 'lang' ? c.lang : (x.voice || '')));
    async function fetchAudio(name, url, opt) {
      const r = await fetch(url, opt);
      if (!r.ok) { let m = ''; try { m = (await r.text()).slice(0, 120); } catch(e) {} throw new Error(name + ' ' + r.status + (m ? ': ' + m : '')); }
      const b = await r.blob();
      if (!b.size || /json|text|html/i.test(b.type)) throw new Error(name + ': অডিও আসেনি');
      return URL.createObjectURL(b);
    }
    async function edgeGec() {                  // Edge-এর Sec-MS-GEC টোকেন: Windows-টিক (৫ মিনিটে গোল) + ক্লায়েন্ট টোকেনের SHA-256
      if (!(window.crypto && crypto.subtle)) throw new Error('এই ব্রাউজারে (নিরাপদ HTTPS ছাড়া) crypto নেই');
      let t = BigInt(Math.floor(Date.now() / 1000) + 11644473600); t -= t % 300n; t *= 10000000n;
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t.toString() + EDGE_TOKEN));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    }
    async function edgeAudio(c, x, sig) {
      const voice = x[c.lang] || TTSX_DEF.edge[c.lang];
      const gec = await edgeGec();
      const rid = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()).replace(/-/g, '');
      const url = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=' + EDGE_TOKEN +
                  '&ConnectionId=' + rid + '&Sec-MS-GEC=' + gec + '&Sec-MS-GEC-Version=' + encodeURIComponent(x.ver || EDGE_VER);
      const xml = c.t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return new Promise((res, rej) => {
        const parts = []; let ws, done = false;
        const end = err => {
          if (done) return; done = true;
          try { ws && ws.close(); } catch(e) {}
          if (err) rej(err); else res(URL.createObjectURL(new Blob(parts, {type: 'audio/mpeg'})));
        };
        try { ws = new WebSocket(url); } catch(e) { rej(e); return; }
        ws.binaryType = 'arraybuffer';
        if (sig) sig.addEventListener('abort', () => end(new Error('বাতিল')));
        ws.onopen = () => {
          const ts = new Date().toUTCString().replace('GMT', 'GMT+0000 (Coordinated Universal Time)');
          ws.send('X-Timestamp:' + ts + '\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n' +
            '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n');
          ws.send('X-RequestId:' + rid + '\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:' + ts + 'Z\r\nPath:ssml\r\n\r\n' +
            "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='" + voice +
            "'><prosody pitch='+0Hz' rate='+0%' volume='+0%'>" + xml + '</prosody></voice></speak>');
        };
        ws.onmessage = ev => {
          if (typeof ev.data === 'string') { if (/Path:turn\.end/.test(ev.data)) end(parts.length ? null : new Error('Edge: অডিও আসেনি')); return; }
          const hl = new DataView(ev.data).getUint16(0);
          const head = new TextDecoder().decode(new Uint8Array(ev.data, 2, hl));
          if (/Path:audio/.test(head)) { const body = ev.data.slice(2 + hl); if (body.byteLength) parts.push(body); }
        };
        ws.onerror = () => end(new Error('Edge সার্ভারে সংযোগ হয়নি'));
        ws.onclose = () => end(parts.length ? null : new Error('Edge সংযোগ বন্ধ হয়ে গেছে'));
      });
    }
    async function xSrc(eng, c, sig) {
      const x = cfg.ttsx[eng] || {};
      if (eng === 'poll') return tplUrl(x.tpl, c, x);
      if (eng === 'server') return tplUrl(x.url, c, x);
      if (eng === 'edge') return edgeAudio(c, x, sig);
      if (eng === 'watson') {
        const base = String(x.url || '').trim().replace(/\/v1\/.*$/, '').replace(/\/+$/, '');
        return fetchAudio('IBM Watson', base + '/v1/synthesize?voice=' + encodeURIComponent(x[c.lang] || ''), {
          method: 'POST', signal: sig,
          headers: {'Authorization': 'Basic ' + btoa('apikey:' + (x.key || '')), 'Content-Type': 'application/json', 'Accept': 'audio/mp3'},
          body: JSON.stringify({text: c.t})
        });
      }
      if (eng === 'fish') {
        const body = {text: c.t, format: 'mp3'}; if (x.ref) body.reference_id = x.ref;
        return fetchAudio('Fish Audio', 'https://api.fish.audio/v1/tts', {
          method: 'POST', signal: sig,
          headers: {'Authorization': 'Bearer ' + (x.key || ''), 'Content-Type': 'application/json', 'model': x.model || 's1'},
          body: JSON.stringify(body)
        });
      }
      throw new Error('অজানা সার্ভিস');
    }
    function dropX(i) {                         // একটি খণ্ডের আনা/আসছে-অডিও বাতিল ও মুছে ফেলা
      const h = tts.xc[i]; if (!h) return;
      delete tts.xc[i];
      try { h.ac.abort(); } catch(e) {}
      h.p.then(a => killAudio(a), () => {});
    }
    function xFetch(i) {                        // খণ্ডের অডিও আনা শুরু (ক্যাশে থাকলে সেটাই)
      if (tts.xc[i]) return tts.xc[i];
      const c = tts.chunks[i]; if (!c) return null;
      const ac = new AbortController();
      const p = xSrc(cfg.ttsEngine, c, ac.signal).then(url => {
        const a = new Audio(); a.preload = 'auto';
        try { a.referrerPolicy = 'no-referrer'; } catch(e) {}
        if (/^blob:/.test(url)) a._blob = url;
        a.src = url;
        return a;
      });
      p.catch(() => {});                        // বাতিল/ব্যর্থ হলে "unhandled" সতর্কতা নয়; ব্যবহারকারী নিচে নিজে ধরে
      return (tts.xc[i] = {p, ac});
    }
    const errShort = e => ((e && e.name === 'TypeError') ? 'নেটওয়ার্ক/CORS ত্রুটি' : ((e && e.message) || 'অজানা ত্রুটি')).slice(0, 90);
    // অতিরিক্ত সার্ভিসে পড়া: ব্যর্থ হলে ৩ বার পুনঃচেষ্টা (বিরতি বাড়িয়ে) → তারপর থেমে যায়; পরের "চালান"-এ সার্ভিস আবার বাছার ডায়ালগ আসে
    function playX(i, id, bust) {
      if (id !== tts.id) return;
      const eng = cfg.ttsEngine, M = XENG[eng], c = tts.chunks[i];
      if (!M || !c) { stopPlay(); return; }
      if (bust) dropX(i);
      const h = xFetch(i);
      let settled = false, cura = null;
      const pauseHere = (msg, re = true) => {
        tts.id++; clearTimeout(tts.wd); cancelDev(); clearG();
        tts.state = 'paused'; tts.i = i; tts.reselect = re; ttsUI();
        toast(msg, true, 9000);
      };
      const fail = why => {
        if (id !== tts.id || settled) return;
        settled = true; clearTimeout(tts.wd);
        if (cura) { killAudio(cura); if (tts.ga === cura) tts.ga = null; }
        dropX(i);
        const n = tts.retry[i] = (tts.retry[i] || 0) + 1;
        if (n <= G_RETRY) {
          toast(M.short + ' আটকেছে (' + why + ') — আবার চেষ্টা ' + n + '/' + G_RETRY + '…', false, G_WAIT[n - 1]);
          tts.wd = setTimeout(() => playX(i, id, true), G_WAIT[n - 1]);
          return;
        }
        pauseHere(M.short + ' থেকে অডিও পাওয়া যাচ্ছে না (' + why + ')। "চালান" চাপলে অন্য সার্ভিস বেছে নিতে পারবেন — এই জায়গা থেকেই চলবে।');
      };
      clearTimeout(tts.wd); tts.wd = setTimeout(() => fail('সাড়া আসেনি'), 20000);
      h.p.then(a => {
        if (id !== tts.id || settled) return;
        cura = a; tts.ga = a;
        try { a.playbackRate = Math.min(2, Math.max(0.5, parseFloat(cfg.ttsRate) || 1)); a.preservesPitch = true; } catch(e) {}
        a.onplay    = () => { if (id === tts.id) follow(c); };
        a.onplaying = () => { clearTimeout(tts.wd); };
        a.onended   = () => { if (id === tts.id) { dropX(i); speakChunk(i + 1, id); } };
        a.onerror   = () => fail('অডিও চালানো যায়নি');
        const p = a.play();
        if (p && p.catch) p.catch(err => {
          if (id !== tts.id) return;
          const nm = (err && err.name) || '';
          if (nm === 'AbortError') return;
          if (nm === 'NotAllowedError') { pauseHere('ব্রাউজার অডিও চালাতে দেয়নি — আবার "চালান" চাপুন', false); return; }
          fail(nm === 'NotSupportedError' ? 'সার্ভার অডিও ফেরত দেয়নি' : (nm || 'অজানা ত্রুটি'));
        });
      }, err => fail(errShort(err)));
      if (i + 1 < tts.chunks.length) xFetch(i + 1);   // পরের খণ্ড আগাম আনা
    }

    // --- সার্ভিস বাছাইয়ের ডায়ালগ ---
    let tsSel = 'auto', tsCb = null;
    const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
    function buildTtsDlg() {
      closeDD(); loadVoices();
      const box = $('tsList'); box.innerHTML = '';
      const sels = [];
      TS_ORDER.forEach(id => {
        const m = tsMeta(id);
        const item = mk('div', 'tsItem' + (id === tsSel ? ' sel' : '')); item.dataset.id = id;
        box.appendChild(item);                  // আগে DOM-এ বসাই (fillVoiceSel / enhanceSelect-এর জন্য)
        const pick = mk('button', 'tsPick'); pick.type = 'button';
        const b = mk('b'); b.append(mk('span', 'tsDot'), document.createTextNode(m.name));
        const tg = mk('span', 'tsTags'); (m.tags || []).forEach(([t, k]) => tg.append(mk('span', 'tsTag ' + k, t)));
        pick.append(b, mk('span', 's', m.desc), tg);
        pick.onclick = () => {
          tsSel = id; closeDD();
          box.querySelectorAll('.tsItem').forEach(it => it.classList.toggle('sel', it.dataset.id === id));
          $('tsErr').hidden = true;
          setTimeout(() => item.scrollIntoView({block: 'nearest', behavior: 'smooth'}), 30);
        };
        const panel = mk('div', 'tsPanel');
        item.append(pick, panel);
        if (id === 'device') {                  // ফোনের ভয়েস (সেটিংসের একই কনফিগ)
          if (!hasTTS) panel.append(mk('small', '', 'এই ব্রাউজারে ফোনের টেক্সট-টু-স্পিচ নেই।'));
          [['bn', 'tdVoiceBn'], ['ar', 'tdVoiceAr'], ['en', 'tdVoiceEn']].forEach(([l, sid]) => {
            const lb = mk('label', '', 'ফোনের ভয়েস — ' + TTS_NAME[l]); lb.htmlFor = sid;
            const s = document.createElement('select'); s.id = sid;
            panel.append(lb, s);
            fillVoiceSel(sid, l);
            s.addEventListener('change', () => { cfg.tts = {...cfg.tts, [l]: s.value}; saveCfg(); });
            sels.push(s);
          });
          panel.append(mk('small', '', 'ভয়েস ডিভাইসের টেক্সট-টু-স্পিচ ইঞ্জিন থেকে আসে। "স্বয়ংক্রিয়" রাখলে ডিভাইসের সেরা মিল ব্যবহার হবে। বাংলা ভয়েস না দেখালে ফোনের সেটিংসে ভয়েস ডেটা ডাউনলোড করুন, বা ডিভাইসের TTS ইঞ্জিন বদলান।'));
        }
        const M = XENG[id];
        if (M) {
          const x = cfg.ttsx[id];
          M.fields.forEach(f => {
            const fid = 'tx_' + id + '_' + f.k;
            const lb = mk('label', '', f.label); lb.htmlFor = fid;
            let el;
            if (f.t === 'sel') {
              el = document.createElement('select');
              f.opts.forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; el.appendChild(o); });
            } else {
              el = document.createElement('input'); el.type = f.t === 'pw' ? 'password' : 'text';
              el.setAttribute('autocapitalize', 'off'); el.setAttribute('autocomplete', 'off'); el.spellcheck = false;
              if (f.ph) el.placeholder = f.ph;
            }
            el.id = fid;
            panel.append(lb, el);
            el.value = x[f.k] != null ? x[f.k] : '';
            if (f.t === 'sel') sels.push(el);
            const h = () => { cfg.ttsx[id][f.k] = el.value.trim(); saveCfg(); };
            el.addEventListener('input', h); el.addEventListener('change', h);
          });
          if (M.hint) panel.append(mk('small', '', M.hint));
        }
      });
      sels.forEach(enhanceSelect);              // নিজস্ব ফন্টের ড্রপডাউন
      const first = box.querySelector('.tsItem.sel'); if (first) setTimeout(() => first.scrollIntoView({block: 'nearest'}), 30);
    }
    function tsValidate(id) {
      const x = cfg.ttsx[id] || {};
      if (id === 'device' && !hasTTS) return 'এই ব্রাউজারে ফোনের টেক্সট-টু-স্পিচ নেই — অন্য সার্ভিস বাছুন';
      if (id === 'watson' && !(x.url && x.key)) return 'IBM Watson-এর Service URL ও API Key দিন';
      if (id === 'fish' && !x.key) return 'Fish Audio-র API Key দিন';
      if (id === 'poll' && !/\{text\}/.test(x.tpl || '')) return 'URL টেমপ্লেটে {text} থাকতে হবে';
      if (id === 'server' && !/\{text\}/.test(x.url || '')) return 'URL টেমপ্লেটে {text} থাকতে হবে';
      return '';
    }
    function askTts(cb) {
      tsCb = cb;
      tsSel = TS_ORDER.includes(cfg.ttsEngine) ? cfg.ttsEngine : 'auto';   // শেষ বাছাই আগে থেকে চিহ্নিত
      $('tsErr').hidden = true;
      buildTtsDlg();
      const d = $('dlgTts'); if (!d.open) d.showModal();
    }
    $('tsCancel').onclick = () => $('dlgTts').close();
    $('dlgTts').addEventListener('close', () => { tsCb = null; closeDD(); });
    $('tsGo').onclick = () => {
      const e = tsValidate(tsSel), er = $('tsErr');
      er.hidden = !e; er.textContent = e;
      if (e) return;
      cfg.ttsEngine = tsSel; saveCfg();
      try { $('cEngine').value = tsSel; } catch(_) {}   // সেটিংস ডায়ালগের ইঞ্জিনও মিলিয়ে রাখা
      tts.forceG = false; clearG();
      const cb = tsCb; tsCb = null;
      $('dlgTts').close();
      if (cb) cb();
    };

    function startFrom(i) {
      tts.id++;
      const id = tts.id;
      tts.retry = {}; tts.noG = false;      // নতুন করে শুরু/চালান: Google আবার প্রথম থেকে চেষ্টা
      clearTimeout(tts.wd);
      cancelDev();
      tts.state = 'playing'; ttsUI();
      setTimeout(() => speakChunk(i, id), 80);  // cancel-এর পরপরই speak করলে কিছু ব্রাউজার গিলে ফেলে
    }
    function playClick() {
      if (cur < 0 || ta.disabled) return;
      if (tts.state === 'playing') {            // বিরতি: থামিয়ে এই খণ্ডটির শুরু থেকে আবার চালানো হয় (Android-এ pause অনির্ভরযোগ্য)
        tts.id++;
        clearTimeout(tts.wd);
        cancelDev();
        killAudio(tts.ga); tts.ga = null; delete tts.cache[tts.i]; dropX(tts.i);
        tts.state = 'paused'; ttsUI();
        return;
      }
      if (tts.state === 'paused') {
        if (!tts.reselect) { startFrom(tts.i); return; }          // সাধারণ বিরতি: একই সার্ভিসে চালু
        askTts(() => { tts.reselect = false; startFrom(tts.i); });  // সার্ভিস ব্যর্থ হয়ে থেমেছিল: আবার সার্ভিস বাছুন
        return;
      }
      const text = ta.value;
      if (!text.trim()) { toast('পড়ার মতো টেক্সট নেই', true); return; }
      let a = ta.selectionStart, b = ta.selectionEnd;
      if (a === b) { b = text.length; if (a >= b - 1) a = 0; }   // নির্বাচন নেই → কার্সর থেকে শেষ (শেষে থাকলে শুরু থেকে)
      loadVoices(); ttsWarned = {};
      tts.chunks = buildChunks(text, a, b);
      tts.stale = false;
      if (!tts.chunks.length) { toast('পড়ার মতো টেক্সট নেই', true); return; }
      tts.start = a;
      const langs = [...new Set(tts.chunks.map(c => TTS_NAME[c.lang]))].join(' + ');
      askTts(() => {                            // সার্ভিস বাছাই হলে তবেই শোনা শুরু
        const m = tsMeta(cfg.ttsEngine);
        toast('শোনা শুরু • ভাষা: ' + langs + (m ? ' • ' + m.name : ''));
        startFrom(0);
      });
    }
    $('btnPlay').onclick = playClick;
    $('btnStop').onclick = () => { stopPlay(); toast('শোনা বন্ধ'); };
    $('ttsRate').value = String(cfg.ttsRate || 1);
    if ($('ttsRate').value !== String(cfg.ttsRate || 1)) $('ttsRate').value = '1';
    $('ttsRate').onchange = () => {
      cfg.ttsRate = parseFloat($('ttsRate').value) || 1; saveCfg();
      try { if (tts.ga) tts.ga.playbackRate = Math.min(2, Math.max(0.5, cfg.ttsRate)); } catch(e) {}   // Google অডিওতে সাথে সাথে প্রযোজ্য
    };
    ttsUI();

    $('btnSave').onclick = () => saveText();
    let proofRunning = false;           // চলার সময় আবার চাপলে দ্বিতীয়বার চলবে না
    $('btnProof').onclick = async () => {
      if (cur < 0 || ta.disabled || proofRunning) return;
      if (!sha && !ta.value.trim() && !confirm('এই পেইজে কোনো টেক্সট নেই। তবুও প্রুফড চিহ্নিত করবেন?')) return;
      proofRunning = true; $('btnProof').setAttribute('aria-busy', 'true');
      const stem = images[cur].stem, nxt = stepVis(cur, 1), isLast = nxt < 0, needProof = !proofed.has(stem);
      let k = 0;
      loadingStart(1 + (needProof ? 1 : 0) + (isLast ? 0 : 1));
      try {
        loadingStep(++k, dirty() ? 'টেক্সট সেভ হচ্ছে (GitHub-এ পুশ)…' : 'সেভ যাচাই হচ্ছে…');
        const ok = await saveText();
        if (!ok) { loadingHide(); return; }
        if (needProof) {
          loadingStep(++k, 'প্রুফড চিহ্নিত হচ্ছে…');
          if (!(await setProofed(stem, true))) { loadingHide(); return; }
        } else if (proofDb && reviews.get(stem) && reviews.get(stem).s === 'correction' && owners.get(stem) === ME) {
          // অ্যাডমিন "সংশোধন দরকার" দিয়েছিলেন → ঠিক করে আবার জমা: রিভিউ আবার "বাকি"
          try {
            await App.sb.patch('page_proofs?book_id=eq.' + encU(BOOK_ID) + '&stem=eq.' + encU(stem) + '&user_id=eq.' + encU(ME), {review_status: 'pending', review_note: null, reviewed_at: null});
            reviews.set(stem, {s: 'pending', note: ''}); updateStatus();
            try { App.log('resubmit', (CTX.book.name || BOOK_ID) + ' / ' + stem); } catch (e) {}
            toast('সংশোধিত পেইজ আবার রিভিউয়ের জন্য জমা হয়েছে');
          } catch (e) { toast('পুনরায় জমা ব্যর্থ: ' + e.message, true); }
        }
        if (!isLast) {
          loadingStep(++k, 'পরের পেইজ লোড হচ্ছে…');
          await go(nxt);
          loadingDone('সেভ ও প্রুফড হয়েছে • পরের পেইজ খোলা হয়েছে');
        } else loadingDone('শেষ পেইজ — সেভ ও প্রুফড হয়েছে');
      } finally {
        if (lt.on && !lt.finishing) loadingHide();
        proofRunning = false; $('btnProof').removeAttribute('aria-busy');
      }
    };
    $('btnToggleProof').onclick = async () => {
      if (cur < 0) return;
      const stem = images[cur].stem;
      await setProofed(stem, !proofed.has(stem));
    };
    $('btnDiscard').onclick = () => {
      if (cur < 0 || ta.disabled) return;
      if (!dirty()) { toast('বাতিল করার মতো অসংরক্ষিত পরিবর্তন নেই'); return; }
      if (!confirm('এই পেইজের অসংরক্ষিত পরিবর্তন/খসড়া বাতিল করে রিপোর টেক্সট ফিরিয়ে আনবেন?')) return;
      ta.value = orig; stashDraft(); updateStatus(); toast('খসড়া বাতিল হয়েছে');
    };

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && ddOpen) { e.preventDefault(); closeDD(); return; }
      if (e.key === 'Escape' && lb.classList.contains('open')) { e.preventDefault(); closeLightbox(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveText(); }
      else if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); go(stepVis(cur, 1)); }
      else if (e.altKey && e.key === 'ArrowLeft')  { e.preventDefault(); go(stepVis(cur, -1)); }
    });

    // ব্রাউজার বন্ধ/ব্যাকগ্রাউন্ডে গেলে/ক্র্যাশের আগমুহূর্তে সবকিছু লোকালে রেখে দেওয়া
    // (স্ক্রিন লক করলেও শোনা চলতে পারে; পেইজ বন্ধ হলে শোনা থামবে)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    window.addEventListener('pagehide', () => { flush(); stopPlay(); });
    window.addEventListener('beforeunload', () => { flush(); stopPlay(); });


    // ---------- API (Gemini): এপি আই - ১ = ছবি → টেক্সট, এপি আই - ২ = টেক্সট প্রুফিং ----------
    // ফল সরাসরি টেক্সট বক্সে বসে (পেস্টের মতোই: অটো হেডিং চালু থাকলে 1 বসে, আনডু চলে)।
    // কিছু রিপোতে পুশ হয় না — দেখে নিয়ে আপনি সেভ করলে তবেই পুশ হবে।
    const MIME_BY_EXT = {jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp'};
    const sleep = (ms, signal) => new Promise((res, rej) => {
      const t = setTimeout(res, ms);
      if (signal) signal.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('Aborted', 'AbortError')); }, {once: true});
    });

    function bytesToB64(buf) {
      const u8 = new Uint8Array(buf); let s = '';
      for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      return btoa(s);
    }
    async function imageB64(im) {
      let buf;
      try {
        const url = await getImage(im.name);
        buf = await (await fetch(url)).arrayBuffer();
      } catch (e) {                                   // ক্যাশ-URL বাতিল হয়ে গেলে সরাসরি রিপো থেকে
        const r = await api('/contents/' + epath(pagesDir() + '/' + im.name) + refQ(),
                            {headers: {'Accept': 'application/vnd.github.raw+json'}});
        if (!r.ok) throw new Error('ছবি আনা যায়নি: ' + await errMsg(r));
        buf = await r.arrayBuffer();
      }
      const ext = (im.name.split('.').pop() || '').toLowerCase();
      return {mime: MIME_BY_EXT[ext] || 'image/jpeg', data: bytesToB64(buf)};
    }

    function geminiHint(status, msg) {
      const low = (msg || '').toLowerCase();
      if (status === 400 && (low.includes('api key') || low.includes('api_key'))) return ' (API Key ভুল)';
      if (status === 401 || status === 403) return ' (Key-তে অনুমতি নেই / ব্লক / মেয়াদ শেষ)';
      if (status === 404) return ' (মডেলের নাম ভুল হতে পারে)';
      if (status === 429) return ' (কোটা/রেট-লিমিট — একটু পরে আবার চেষ্টা করুন)';
      return '';
    }

    // Gemini streaming (SSE) কল — ছোট ছোট খণ্ডে আসে, তাই বড় পেইজেও সংযোগ ঝুলে যায় না
    async function callGemini(o) {
      const model = o.model.replace(/^models\//, '');
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model)
                + ':streamGenerateContent?alt=sse&key=' + encodeURIComponent(o.key);
      const body = JSON.stringify({contents: [{role: 'user', parts: o.parts}], generationConfig: {temperature: o.temp}});
      let lastErr = null;
      for (let att = 1; att <= 3; att++) {
        let r;
        try {
          r = await fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body, signal: o.signal});
        } catch (e) {
          if (e.name === 'AbortError') throw e;
          lastErr = new Error('নেটওয়ার্ক সমস্যা: ' + e.message);
          if (att < 3) { await sleep(3000 * att, o.signal); continue; }
          throw lastErr;
        }
        if (!r.ok) {
          const t = await r.text(); let m = '';
          try { m = JSON.parse(t).error.message || ''; } catch (e) { m = t.slice(0, 200); }
          lastErr = new Error(r.status + ': ' + m.slice(0, 300) + geminiHint(r.status, m));
          if ([500, 502, 503, 504].includes(r.status) && att < 3) { await sleep(4000 * att, o.signal); continue; }
          throw lastErr;
        }
        const chunks = []; let finish = null, chars = 0;
        const handle = line => {
          if (!line.startsWith('data:')) return;
          const d = line.slice(5).trim();
          if (!d || d === '[DONE]') return;
          let j; try { j = JSON.parse(d); } catch (e) { return; }
          if (j.error) throw new Error((j.error.message || 'API ত্রুটি').slice(0, 300));
          if (j.promptFeedback && j.promptFeedback.blockReason) throw new Error('Gemini ব্লক করেছে: ' + j.promptFeedback.blockReason);
          (j.candidates || []).forEach(c => {
            ((c.content && c.content.parts) || []).forEach(p => { if (typeof p.text === 'string' && !p.thought) { chunks.push(p.text); chars += p.text.length; } });
            if (c.finishReason) finish = c.finishReason;
          });
          if (o.onProgress) o.onProgress(chars);
        };
        const reader = r.body.getReader(), dec = new TextDecoder('utf-8');
        let buf = '';
        for (;;) {
          const {done, value} = await reader.read();
          if (done) break;
          buf += dec.decode(value, {stream: true});
          const lines = buf.split('\n'); buf = lines.pop();
          lines.forEach(l => handle(l.replace(/\r$/, '')));
        }
        buf += dec.decode();
        if (buf) handle(buf.replace(/\r$/, ''));
        let text = chunks.join('').trim();
        const fence = text.match(/^```[A-Za-z]*\r?\n([\s\S]*?)\r?\n```$/);      // ভুলে পুরো আউটপুট কোড-ফেন্সে মুড়ে দিলে খুলে নেওয়া
        if (fence) text = fence[1].trim();
        if (!text) {
          lastErr = new Error('খালি রেসপন্স (finishReason=' + finish + ')');
          if (att < 3) { await sleep(3000 * att, o.signal); continue; }
          throw lastErr;
        }
        return {text, finish};
      }
      throw lastErr || new Error('অজানা ত্রুটি');
    }

    // ভিন্ন লিপির অক্ষর / markdown ধরার সতর্কতা (শুধু জানায়, বদলায় না)
    function checkText(text) {
      const p = [];
      if (/[\u0900-\u0963\u0966-\u097F]/.test(text)) p.push('দেবনাগরী অক্ষর');   // দাঁড়ি ।(U+0964/0965) বাংলাতেও ব্যবহৃত, তাই বাদ
      for (const tok of text.split(/\s+/)) {
        if (/[\u0980-\u09FF]/.test(tok) && AR_RE.test(tok)) { p.push('বাংলা-আরবি মিশ্র শব্দ: ' + tok); break; }
      }
      if (/\*\*|^\s{0,3}#{1,6}\s|^\s*[-*]\s/m.test(text)) p.push('markdown চিহ্ন');
      return p;
    }

    function setApiUI() {
      const b = $('btnApi');
      b.classList.toggle('run', !!apiRun);
      b.title = !apiEnabled ? 'এপি আই বন্ধ (অ্যাডমিন বন্ধ রেখেছেন)' : apiRun ? API_NAME[apiRun.n] + ' চলছে — থামাতে চাপুন' : 'API — ছবি থেকে টেক্সট (এপি আই - ১) / টেক্সট প্রুফিং (এপি আই - ২)';
      updateStatus();
    }

    function applyApiResult(n, stem, text, before, finish) {
      const nm = API_NAME[n];
      const probs = checkText(text);
      const warn = [];
      if (finish === 'MAX_TOKENS') warn.push('আউটপুট অসম্পূর্ণ হতে পারে (MAX_TOKENS)');
      if (probs.length) warn.push(probs.join(' | '));
      const i = images.findIndex(im => im.stem === stem);

      if (cur >= 0 && images[cur].stem === stem && !ta.disabled) {
        if (ta.value !== before && !confirm(nm + ' চলার সময় এই পেইজের টেক্সট বদলেছে। তবুও ফল দিয়ে সব টেক্সট বদলাবেন?')) {
          try { const p = navigator.clipboard.writeText(text); if (p && p.catch) p.catch(() => {}); } catch (e) {}
          toast('ফল বসানো হয়নি (ক্লিপবোর্ডে কপির চেষ্টা করা হয়েছে)', true, 5000);
          return;
        }
        const hn = insertAtStart(text, true, true);        // পেস্টের মতো: আনডু চলে, অটো হেডিং চালু থাকলে 1 বসে
        try { if (window.matchMedia && matchMedia('(pointer:coarse)').matches) ta.blur(); } catch (e) {}   // ফোনে কিবোর্ড খুলে থাকবে না
        const msg = nm + ' সম্পন্ন • ' + text.length + ' অক্ষর' + (hn > 0 ? ' • ' + hn + 'টি হেডিং চিহ্নিত' : '') + ' • দেখে নিয়ে সেভ করুন';
        if (warn.length) toast('সতর্কতা: ' + warn.join(' • ') + ' — ' + msg, true, 9000); else toast(msg, false, 4000);
      } else {
        // চলার সময় অন্য পেইজে চলে গেলে: ফল ওই পেইজের খসড়ায় রাখা হয়
        if (cfg.autoHead) text = markHeadings(text).text;
        drafts[dk(stem)] = {t: text, ts: Date.now()}; persistDrafts();
        if (i >= 0) updateOption(i);
        updateStatus();
        toast(nm + ' সম্পন্ন — ফল পেইজ ' + stem + '-এর খসড়ায় রাখা হয়েছে (ওই পেইজে গেলে দেখা যাবে, সেভ করলে পুশ হবে)' + (warn.length ? ' • সতর্কতা: ' + warn.join(' • ') : ''), warn.length > 0, 7000);
      }
    }

    async function runApi(n, opts) {
      const auto = !!(opts && opts.auto);
      if (apiRun) { toast(API_NAME[apiRun.n] + ' চলছে — শেষ হওয়া পর্যন্ত অপেক্ষা করুন', true); return; }
      if (apiChecking) return;
      apiChecking = true;
      try { await refreshApiFlag(); } finally { apiChecking = false; }   // চালানোর ঠিক আগে অ্যাডমিনের সর্বশেষ অবস্থা দেখে নেওয়া
      if (!apiEnabled) { if (!auto) toast('এপি আই বন্ধ আছে — অ্যাডমিন চালু করলে ব্যবহার করা যাবে', true); return; }
      if (apiRun) return;
      if (cur < 0 || ta.disabled) { toast('আগে পেইজ লোড হতে দিন', true); return; }
      const c = cfg['api' + n], nm = API_NAME[n];
      const key = (c.key || (n === 2 ? cfg.api1.key : '') || '').trim();
      if (!key) { toast(nm + ': API Key দেওয়া নেই', true); openApiCfg(n); return; }
      if (!c.model) { toast(nm + ': Model দেওয়া নেই', true); openApiCfg(n); return; }
      if (!c.prompt) { toast(nm + ': Prompt খালি', true); openApiCfg(n); return; }

      const im = images[cur], stem = im.stem, before = ta.value;
      if (n === 1 && before.trim() && !confirm('এই পেইজে আগে থেকেই টেক্সট আছে। ' + nm + ' চালালে ছবি থেকে নতুন টেক্সট এসে আগেরটা বদলে দেবে (সেভ না করা পর্যন্ত রিপোতে বদলায় না; আনডু চলে)। চালাবেন?')) return;
      if (n === 2 && !before.trim()) { toast('প্রুফ করার মতো টেক্সট নেই — আগে ' + API_NAME[1] + ' চালান বা টেক্সট বসান', true); return; }

      const ctrl = new AbortController();
      apiRun = {n, stem, ctrl, chars: 0};
      if (n === 1) autoTried.add(stem);   // হাতে চালালেও এই পেইজে আর অটো চলবে না (থামালে আবার নিজে থেকে শুরু হবে না)
      setApiUI();
      toast((auto ? 'অটো: ' : '') + nm + ' চলছে — পেইজ ' + stem + '…', false, 2500);
      let lastUI = 0;
      try {
        const parts = [];
        if (n === 1) {
          const img64 = await imageB64(im);
          parts.push({text: c.prompt}, {inline_data: {mime_type: img64.mime, data: img64.data}});
        } else {
          let p = c.prompt;
          if (/\{\{TEXT\}\}/.test(p)) p = p.replace(/\{\{TEXT\}\}/g, () => before);
          else p += '\n\n===== OCR টেক্সট শুরু =====\n' + before + '\n===== OCR টেক্সট শেষ =====\n';
          parts.push({text: p});
          if (c.sendImg) { const img64 = await imageB64(im); parts.push({inline_data: {mime_type: img64.mime, data: img64.data}}); }
        }
        const res = await callGemini({
          key, model: c.model, parts, temp: Number.isFinite(+c.temp) ? +c.temp : 0, signal: ctrl.signal,
          onProgress: ch => { if (apiRun) { apiRun.chars = ch; const t = Date.now(); if (t - lastUI > 400) { lastUI = t; updateStatus(); } } }
        });
        apiRun = null; setApiUI();
        applyApiResult(n, stem, res.text, before, res.finish);
      } catch (e) {
        const em = (e && e.message) || String(e);
        if (e && e.name === 'AbortError') toast(nm + ' থামানো হয়েছে');
        else if (auto && /^(400|401|403|404|429):/.test(em)) {
          autoPause = true;               // Key/মডেল/কোটার সমস্যায় প্রতি পেইজে একই ত্রুটি না দেখিয়ে অটো থামানো
          toast('অটো ' + nm + ' ব্যর্থ: ' + em + ' — অটো সাময়িক বন্ধ (API ডায়ালগে সংরক্ষণ করলে আবার চালু)', true, 9000);
        }
        else toast((auto ? 'অটো ' : '') + nm + ' ব্যর্থ: ' + em + (auto ? ' — হাতে চালাতে API আইকন চাপুন' : ''), true, 8000);
      } finally { apiRun = null; setApiUI(); maybeAutoOcr(); }
    }

    // টেক্সট ফাঁকা পেইজ খুললে (এবং এপি আই - ১ কনফিগার করা থাকলে) নিজে থেকেই এপি আই - ১ চালায়
    function maybeAutoOcr() {
      clearTimeout(autoT);
      autoT = setTimeout(() => {
        const c = cfg.api1;
        if (!apiEnabled) return;                                            // অ্যাডমিন এপি আই বন্ধ রেখেছেন
        if (!c.auto || autoPause || apiRun) return;
        if (!c.key || !c.model || !c.prompt) return;                       // এপি আই - ১ কনফিগার করা নেই
        if (cur < 0 || ta.disabled || loadErr || initing) return;           // পেইজ/টেক্সট ঠিকমতো লোড হয়নি
        if (document.querySelector('dialog[open]') || lb.classList.contains('open')) return;
        if (ta.value.trim()) return;                                        // টেক্সট (বা খসড়া) আছে
        const stem = images[cur].stem;
        if (proofed.has(stem) || autoTried.has(stem)) return;               // প্রুফড বা এই সেশনে আগেই চলেছে
        runApi(1, {auto: true});
      }, 900);                                                              // দ্রুত পেইজ উল্টানোর সময় অযথা কল ঠেকাতে সামান্য অপেক্ষা
    }

    // ---------- অটো OCR টগল (সবুজ = চালু, লাল = বন্ধ) ----------
    function applyAutoApi() {
      const b = $('btnAutoApi'), on = !!cfg.api1.auto;
      b.classList.toggle('on', on); b.classList.toggle('off', !on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.title = !apiEnabled ? 'এপি আই বন্ধ — অ্যাডমিন বন্ধ রেখেছেন, তাই অটো OCR চলবে না' : on
        ? 'অটো OCR চালু (সবুজ) — ' + API_NAME[1] + '-এর Key দেওয়া থাকলে টেক্সট ফাঁকা পেইজ খুললে নিজে থেকে চলবে। বন্ধ করতে চাপুন'
        : 'অটো OCR বন্ধ (লাল) — API কনফিগার থাকলেও নিজে থেকে চলবে না (হাতে API আইকন থেকে চালানো যাবে)। চালু করতে চাপুন';
    }
    $('btnAutoApi').onclick = () => {
      const c = cfg.api1;
      c.auto = !c.auto; autoPause = false; saveCfg(); applyAutoApi();
      if (!apiEnabled) { toast('এপি আই এখন বন্ধ (অ্যাডমিন) — চালু হলে এই সেটিং কাজ করবে', true); return; }
      if (c.auto) {
        toast(!c.key ? 'অটো OCR চালু — তবে ' + API_NAME[1] + '-এর Key এখনো দেওয়া নেই' : 'অটো OCR চালু (সবুজ)');
        maybeAutoOcr();
      } else { clearTimeout(autoT); toast('অটো OCR বন্ধ (লাল) — নিজে থেকে আর চলবে না'); }
    };

    // ---------- API ডায়ালগ ----------
    let apiN = 1;
    const keyState = n => (cfg['api' + n].key || (n === 2 && cfg.api1.key)) ? 'Key সেট আছে' : 'Key নেই';
    function openApiPick() {
      [1, 2].forEach(n => { $('apiSub' + n).textContent = API_DEF[n].sub + ' • ' + (cfg['api' + n].model || '—') + ' • ' + keyState(n)
                                                    + (n === 1 && cfg.api1.auto && cfg.api1.key ? ' • অটো চালু' : ''); });
      $('apiOffNote').hidden = apiEnabled;
      const d = $('dlgApi'); if (!d.open) d.showModal();
    }
    function openApiCfg(n) {
      apiN = n;
      const c = cfg['api' + n];
      $('aTitle').textContent = API_NAME[n];
      $('aSub').textContent = API_DEF[n].sub + ' • বর্তমান পেইজ: ' + (cur >= 0 ? images[cur].stem : '—');
      $('aKey').value = c.key; $('aModel').value = c.model; $('aPrompt').value = c.prompt; $('aTemp').value = c.temp;
      $('aKey').placeholder = n === 2 ? 'খালি রাখলে ' + API_NAME[1] + '-এর Key ব্যবহার হবে' : 'AIza...';
      $('aKeyHint').textContent = '';
      $('aPromptHint').textContent = n === 1
        ? 'বর্তমান পেইজের ছবি এই প্রম্পটের সাথে পাঠানো হবে; ফল টেক্সট বক্সে বসবে।'
        : 'টেক্সট বক্সের লেখা প্রুফ হবে। প্রম্পটে {{TEXT}} লিখলে টেক্সট ঠিক ঐ জায়গায় বসবে; না লিখলে প্রম্পটের নিচে যুক্ত হবে।';
      $('aImgRow').style.display = n === 2 ? '' : 'none';
      $('aImg').checked = !!c.sendImg;
      $('aAutoRow').style.display = n === 1 ? '' : 'none';
      $('aAutoHint').style.display = n === 1 ? '' : 'none';
      $('aAuto').checked = !!c.auto;
      if ($('dlgApi').open) $('dlgApi').close();
      const d = $('dlgCfg'); if (!d.open) d.showModal();
    }
    function readApiForm() {
      const c = cfg['api' + apiN];
      c.key = $('aKey').value.trim();
      c.model = $('aModel').value.trim().replace(/^models\//, '') || 'gemini-3.5-flash-lite';
      c.prompt = $('aPrompt').value.trim();
      const t = parseFloat($('aTemp').value);
      c.temp = Number.isFinite(t) ? Math.min(2, Math.max(0, t)) : 0;
      if (apiN === 2) c.sendImg = $('aImg').checked;
      if (apiN === 1) c.auto = $('aAuto').checked;
      autoPause = false;                  // নতুন করে সংরক্ষণ করলে অটো আবার চালু
      saveCfg(); applyAutoApi();
    }
    $('btnApi').onclick = () => {
      if (apiRun) { if (confirm(API_NAME[apiRun.n] + ' চলছে। থামাবেন?')) apiRun.ctrl.abort(); return; }
      openApiPick();
    };
    $('apiPick1').onclick = () => openApiCfg(1);
    $('apiPick2').onclick = () => openApiCfg(2);
    $('apiPickClose').onclick = () => $('dlgApi').close();
    $('aCancel').onclick = () => $('dlgCfg').close();
    $('aDefault').onclick = () => { $('aPrompt').value = API_DEF[apiN].prompt; readApiForm(); toast('ডিফল্ট প্রম্পট বসানো ও সংরক্ষিত হয়েছে'); };
    $('aSave').onclick = () => { readApiForm(); $('dlgCfg').close(); toast(API_NAME[apiN] + ' সংরক্ষিত'); };
    $('aRun').onclick = () => {
      readApiForm();
      const c = cfg['api' + apiN];
      if (!(c.key || (apiN === 2 && cfg.api1.key))) { $('aKeyHint').textContent = 'API Key দিন'; $('aKey').focus(); return; }
      if (!c.prompt) { $('aPromptHint').textContent = 'Prompt খালি রাখা যাবে না'; $('aPrompt').focus(); return; }
      $('dlgCfg').close();
      runApi(apiN);
    };

    // API ফর্মের যেকোনো ঘর বদলালেই সাথে সাথে স্বয়ংক্রিয় সংরক্ষণ (Key, Model, Prompt, Temperature, টিক-বক্স)
    ['aKey', 'aModel', 'aPrompt', 'aTemp', 'aImg', 'aAuto'].forEach(id => {
      const el = $(id), h = () => { if ($('dlgCfg').open) readApiForm(); };
      el.addEventListener('input', h); el.addEventListener('change', h);
    });

    // সব <select> কে নিজস্ব ফন্টের ড্রপডাউনে রূপান্তর
    ['sel', 'ttsRate', 'cEngine', 'cVoiceBn', 'cVoiceAr', 'cVoiceEn'].forEach(id => enhanceSelect($(id)));

    applyZoom(); applyFont(); applySwap(); applyAuto(); applyAutoApi(); applyApiFlag(); updateStatus(); loadDone();
    // অ্যাডমিনের এপি আই চালু/বন্ধ লাইভ ধরতে: ট্যাবে ফিরলে ও প্রতি ৩০ সেকেন্ডে সর্বশেষ অবস্থা দেখে নেয়
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshApiFlag(); });
    setInterval(() => { if (document.visibilityState === 'visible') refreshApiFlag(); }, 30000);
    // অন্য ইউজারের নতুন প্রুফড পেইজ ধরতে: ট্যাবে ফিরলে ও প্রতি ৬০ সেকেন্ডে মালিকানা নতুন করে আনে
    const syncProofs = async () => { if (initing || busy || !images.length) return; if (await refreshProofs() === true) applyProofs(); };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncProofs(); });
    setInterval(() => { if (document.visibilityState === 'visible') syncProofs(); }, 60000);
    if (!cfg.token && CTX.isAdmin) openSettings();   // অ্যাডমিন: টোকেন না থাকলে সেটিংস খুলবে; ইউজারের টোকেন Supabase থেকে আসে
    else init();
  })();
  })();

}
