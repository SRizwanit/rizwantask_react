/* ধ্রুবক, ডিফল্ট কনফিগ, সংরক্ষিত কনফিগ লোড (Supabase-এর মান মিলিয়ে) */
import { trimSl } from './utils.js';
import { mirror } from './storage.js';

/* শোনার অতিরিক্ত সার্ভিসের ডিফল্ট কনফিগ (কী/ভয়েস/URL ব্রাউজারে থেকে যায়, রিপোতে যায় না) */
export const TTSX_DEF = {
  edge: { bn: 'bn-BD-NabanitaNeural', ar: 'ar-SA-ZariyahNeural', en: 'en-US-AriaNeural', ver: '' },
  poll: { voice: 'nova', tpl: 'https://text.pollinations.ai/{text}?model=openai-audio&voice={voice}' },
  server: { url: 'http://localhost:5000/?text={text}' },
  watson: { url: '', key: '', en: 'en-US_MichaelV3Voice', ar: 'ar-MS_OmarVoice' },
  fish: { key: '', model: 's1', ref: '' }
};

export const DEFAULTS = {
  repo: 'SunniPedia/pdftojpg', branch: '', token: '',
  pagesDir: 'pages', textsDir: 'texts', proofFile: 'proofed.json', book: '', proofDir: 'proofed',
  fs: 20, swap: false, zoom: 100, last: '', view: null, autoHead: false,
  ttsRate: 1, ttsEngine: 'auto', tts: { bn: '', ar: '', en: '' }
};

/* ---------- API (Gemini) ডিফল্ট ---------- */
export const API_NAME = { 1: 'এপি আই - ১', 2: 'এপি আই - ২' };
export const API_DEF = {
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

export const TTS_ENGINES = ['auto', 'device', 'google', 'edge', 'poll', 'server', 'watson', 'fish'];

/* স্টোরেজের কী: ইউজার + কিতাব ভেদে আলাদা */
export function keysFor(uid, bookId) {
  const sfx = ':' + uid + ':' + bookId;
  return { CK: 'kitab_proof_cfg_v1' + sfx, DK: 'kitab_proof_drafts_v1' + sfx };
}

/* সংরক্ষিত কনফিগ (localStorage) + Supabase থেকে আসা রিপো/টোকেন/কিতাব/Gemini মান */
export function loadCfg(CK, ctx) {
  let cfg = { ...DEFAULTS };
  try { cfg = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(CK) || '{}') }; } catch (e) { /* ignore */ }
  if (!cfg.repo) cfg.repo = DEFAULTS.repo;
  if (!cfg.tts || typeof cfg.tts !== 'object') cfg.tts = { bn: '', ar: '', en: '' };
  if (!TTS_ENGINES.includes(cfg.ttsEngine)) cfg.ttsEngine = 'auto';
  {   // অতিরিক্ত সার্ভিসের কনফিগ: পুরনো সংরক্ষণে না থাকলে ডিফল্ট বসবে
    const o = (cfg.ttsx && typeof cfg.ttsx === 'object') ? cfg.ttsx : {};
    cfg.ttsx = {};
    Object.keys(TTSX_DEF).forEach((k) => { cfg.ttsx[k] = { ...TTSX_DEF[k], ...(o[k] && typeof o[k] === 'object' ? o[k] : {}) }; });
  }
  // API ১ ও ২ এর সংরক্ষিত মান (পুরনো সংরক্ষণে এই ঘর না থাকলে ডিফল্ট বসবে)
  [1, 2].forEach((n) => {
    const o = cfg['api' + n];
    cfg['api' + n] = {
      key: '', model: 'gemini-3.5-flash-lite', temp: 0, prompt: API_DEF[n].prompt, sendImg: true, auto: true,
      ...(o && typeof o === 'object' ? o : {})
    };
  });
  // একবারের স্থানান্তর: আগের ডিফল্ট মডেল (gemini-3.5-flash) সংরক্ষিত থাকলে নতুন ডিফল্ট flash-lite হবে
  if (!cfg.apiMig1) {
    [1, 2].forEach((n) => { if (cfg['api' + n].model === 'gemini-3.5-flash') cfg['api' + n] = { ...cfg['api' + n], model: 'gemini-3.5-flash-lite' }; });
    cfg.apiMig1 = 1;
  }

  // ---------- Supabase থেকে কনফিগ (রিপো, টোকেন, কিতাব, Gemini) ----------
  const b = ctx.book, st = ctx.settings || {};
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
  [1, 2].forEach((n) => {
    const c = { ...cfg['api' + n] };
    if (st.gemini_api_key) c.key = st.gemini_api_key;
    if (st.gemini_model) c.model = st.gemini_model;
    if (st.gemini_temp !== null && st.gemini_temp !== undefined && st.gemini_temp !== '') c.temp = Number(st.gemini_temp) || 0;
    const p = n === 1 ? st.prompt_ocr : st.prompt_proof;
    if (p) c.prompt = p;
    cfg['api' + n] = c;
  });
  return cfg;
}

export function loadDrafts(DK) {
  try { return JSON.parse(localStorage.getItem(DK) || '{}') || {}; } catch (e) { return {}; }
}

export function saveCfgTo(CK, cfg) {
  let v; try { v = JSON.stringify(cfg); } catch (e) { return; }
  try { localStorage.setItem(CK, v); } catch (e) { /* ignore */ }
  mirror(CK, v);
}

/* কিতাবের নাম (prefix) + ফোল্ডার:
   ফোল্ডার/ফাইলের আসল নাম = কিতাবের নাম + _ + মূল নাম (যেমন bukhari_pages, bukhari_texts, bukhari_proofed.json)।
   কিতাবের নাম খালি থাকলে আগের মতোই pages / texts / proofed.json। একই রিপোতে একাধিক কিতাব রাখা যায়। */
export function repoPaths(cfg) {
  const b = trimSl(cfg.book), pre = b ? b + '_' : '';
  const pagesDir = pre + trimSl(cfg.pagesDir || 'pages');
  const textsDir = pre + trimSl(cfg.textsDir || 'texts');
  const proofDirName = typeof cfg.proofDir === 'string' ? trimSl(cfg.proofDir) : 'proofed';
  const proofName = pre + (cfg.proofFile || 'proofed.json').trim().replace(/^\/+/, '');
  return {
    pagesDir, textsDir, proofDirName, proofName,
    proofPath: (proofDirName ? proofDirName + '/' : '') + proofName,   // যেমন proofed/bukhari_proofed.json
    legacyProofPath: proofName                                         // পুরনো জায়গা: রিপোর রুট
  };
}
export const connSig = (cfg) => { const p = repoPaths(cfg); return [cfg.repo, cfg.branch, p.pagesDir, p.textsDir, p.proofPath].join('|'); };
/* কিতাব ভেদে খসড়া আলাদা (খালি নাম = আগের কী) */
export const draftKey = (cfg, stem) => cfg.repo + (trimSl(cfg.book) ? '@' + trimSl(cfg.book) : '') + '/' + stem;
