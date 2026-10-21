/* শোনার (TTS) সার্ভিসের তথ্য ও অডিও আনার কোড।
   ইঞ্জিন: (১) ফোনের নিজস্ব TTS (speechSynthesis), (২) Google Translate-এর অনলাইন অডিও (অনানুষ্ঠানিক, কী লাগে না),
   (৩) অতিরিক্ত সার্ভিস: Edge TTS, Pollinations, Piper/নিজস্ব সার্ভার, IBM Watson, Fish Audio। */
import { TTSX_DEF } from './config.js';

export const hasTTS = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
export const TTS_LANG = { bn: 'bn-BD', ar: 'ar-SA', en: 'en-US' };     // ফোনের TTS-এর ভাষা কোড
export const G_LANG = { bn: 'bn', ar: 'ar', en: 'en' };                // Google-এর ভাষা কোড
export const TTS_NAME = { bn: 'বাংলা', ar: 'আরবি', en: 'ইংরেজি' };

const EDGE_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
export const EDGE_VER = '1-143.0.3650.75';
const VOP = (a) => a.map((v) => (Array.isArray(v) ? v : [v, v]));

/* অতিরিক্ত সার্ভিসের বিবরণ + কনফিগের ঘর (fields) */
export const XENG = {
  edge: {
    short: 'Edge TTS', name: 'Edge TTS (Microsoft)',
    desc: 'Microsoft Edge-এর অনলাইন ভয়েস — ফ্রি, কী লাগে না; বাংলা/আরবি/ইংরেজি তিনটিই।',
    tags: [['ফ্রি', 'ok'], ['কী লাগে না', 'ok'], ['বাংলা আছে', 'ok'], ['অনানুষ্ঠানিক', 'warn']],
    langs: { bn: 1, ar: 1, en: 1 },
    fields: [
      { k: 'bn', t: 'sel', label: 'ভয়েস — বাংলা', opts: VOP([['bn-BD-NabanitaNeural', 'Nabanita (বাংলাদেশ, নারী)'], ['bn-BD-PradeepNeural', 'Pradeep (বাংলাদেশ, পুরুষ)'], ['bn-IN-TanishaaNeural', 'Tanishaa (ভারত, নারী)'], ['bn-IN-BashkarNeural', 'Bashkar (ভারত, পুরুষ)']]) },
      { k: 'ar', t: 'sel', label: 'ভয়েস — আরবি', opts: VOP([['ar-SA-ZariyahNeural', 'Zariyah (সৌদি, নারী)'], ['ar-SA-HamedNeural', 'Hamed (সৌদি, পুরুষ)'], ['ar-EG-SalmaNeural', 'Salma (মিশর, নারী)'], ['ar-EG-ShakirNeural', 'Shakir (মিশর, পুরুষ)']]) },
      { k: 'en', t: 'sel', label: 'ভয়েস — ইংরেজি', opts: VOP([['en-US-AriaNeural', 'Aria (US, নারী)'], ['en-US-GuyNeural', 'Guy (US, পুরুষ)'], ['en-US-JennyNeural', 'Jenny (US, নারী)'], ['en-GB-SoniaNeural', 'Sonia (UK, নারী)']]) },
      { k: 'ver', t: 'text', label: 'Sec-MS-GEC-Version (উন্নত; ফাঁকা = ডিফল্ট)', ph: EDGE_VER }
    ],
    hint: 'এটি Microsoft-এর প্রকাশ্য API নয়, অনানুষ্ঠানিক সংযোগ — Microsoft বদলালে বা ব্লক করলে ব্যর্থ হতে পারে। তখন ওপরের "Sec-MS-GEC-Version" নতুন সংস্করণে বদলে দেখুন, নইলে অন্য সার্ভিস বাছুন।'
  },
  poll: {
    short: 'Pollinations', name: 'Pollinations',
    desc: 'ফ্রি AI ভয়েস API — সাইনআপ/কী ছাড়াই; URL-এ টেক্সট দিলে অডিও আসে।',
    tags: [['ফ্রি', 'ok'], ['কী লাগে না', 'ok'], ['বাংলার মান নিজে পরখ করুন', 'warn']],
    langs: { bn: 1, ar: 1, en: 1 },
    fields: [
      { k: 'voice', t: 'sel', label: 'ভয়েস', opts: VOP(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']) },
      { k: 'tpl', t: 'text', label: 'URL টেমপ্লেট', ph: 'https://text.pollinations.ai/{text}?model=openai-audio&voice={voice}' }
    ],
    hint: '{text} = পড়ার টেক্সট, {voice} = ভয়েস। কখনো টেক্সট না পড়ে নিজে থেকে উত্তর দিলে {text}-এর আগে একটি নির্দেশ জুড়ে পরখ করুন, যেমন: https://text.pollinations.ai/Read%20aloud%3A%20{text}?model=openai-audio&voice={voice}'
  },
  server: {
    short: 'নিজস্ব সার্ভার', name: 'Piper / নিজস্ব সার্ভার (URL)',
    desc: 'নিজের কম্পিউটার/সার্ভারে চালানো যেকোনো TTS (যেমন Piper) — আনলিমিটেড ও প্রাইভেট।',
    tags: [['আনলিমিটেড', 'ok'], ['নিজে সেটআপ লাগে', 'warn']],
    langs: { bn: 1, ar: 1, en: 1 },
    fields: [{ k: 'url', t: 'text', label: 'URL টেমপ্লেট (GET → অডিও)', ph: 'http://localhost:5000/?text={text}' }],
    hint: '{text} = টেক্সট, {lang} = bn/ar/en। উদাহরণ (Piper HTTP সার্ভার): http://localhost:5000/?text={text}। HTTPS পেইজ থেকে http সার্ভার ব্রাউজার ব্লক করে (শুধু localhost বাদে), আর ফোনে localhost মানে ফোনটিই। Piper-এর বাংলা ভয়েস মডেল আছে কিনা আগে যাচাই করুন।'
  },
  watson: {
    short: 'IBM Watson', name: 'IBM Watson TTS',
    desc: 'IBM Cloud-এর ফ্রি (লাইট) প্ল্যানে সীমিত অক্ষর; আরবি ও ইংরেজি আছে।',
    tags: [['ফ্রি টিয়ার (সীমিত)', 'warn'], ['কী লাগে', 'warn'], ['বাংলা নেই', 'err']],
    langs: { ar: 1, en: 1 },
    fields: [
      { k: 'url', t: 'text', label: 'Service URL', ph: 'https://api.us-south.text-to-speech.watson.cloud.ibm.com/instances/…' },
      { k: 'key', t: 'pw', label: 'API Key' },
      { k: 'en', t: 'sel', label: 'ভয়েস — ইংরেজি', opts: VOP([['en-US_MichaelV3Voice', 'Michael (US)'], ['en-US_AllisonV3Voice', 'Allison (US)'], ['en-GB_KateV3Voice', 'Kate (UK)']]) },
      { k: 'ar', t: 'sel', label: 'ভয়েস — আরবি', opts: VOP([['ar-MS_OmarVoice', 'Omar']]) }
    ],
    hint: 'IBM Cloud-এ Text to Speech সার্ভিস বানালে তার Credentials থেকে URL ও API Key পাবেন। বাংলা অংশ নিজে থেকে ফোনের TTS/Google-এ পড়া হবে।'
  },
  fish: {
    short: 'Fish Audio', name: 'Fish Audio',
    desc: 'উচ্চমানের AI ভয়েস API। ফ্রি অ্যাক্সেস সীমিত সময়ের ছিল — এখন ফ্রি আছে কিনা তাদের সাইটে দেখুন।',
    tags: [['কী লাগে', 'warn'], ['ফ্রি অনিশ্চিত', 'warn'], ['বাংলা নেই বলে জানি', 'err']],
    langs: { ar: 1, en: 1 },
    fields: [
      { k: 'key', t: 'pw', label: 'API Key' },
      { k: 'model', t: 'text', label: 'Model (হেডার)', ph: 's1' },
      { k: 'ref', t: 'text', label: 'ভয়েস (reference_id) — ঐচ্ছিক' }
    ],
    hint: 'API Key: fish.audio → API Keys। Model-এ আপনার অ্যাকাউন্টে চালু মডেলের নাম দিন। বাংলা অংশ নিজে থেকে ফোনের TTS/Google-এ পড়া হবে।'
  }
};

export const TS_BASE = {
  auto: { name: 'স্বয়ংক্রিয় (প্রস্তাবিত)', desc: 'ফোনের TTS আগে; ভয়েস না থাকলে বা সাড়া না দিলে Google অনলাইন।', tags: [['কী লাগে না', 'ok']] },
  device: { name: 'ফোনের TTS', desc: 'ডিভাইসের নিজস্ব ইঞ্জিন — অফলাইনে চলে, আনলিমিটেড।', tags: [['অফলাইন', 'ok'], ['কী লাগে না', 'ok'], ['ভয়েস ডিভাইসের ওপর নির্ভর', 'warn']] },
  google: { name: 'Google অনলাইন', desc: 'Google Translate-এর অডিও — ভাষা নিজে চেনা হয়, ভয়েস বাছা যায় না।', tags: [['ইন্টারনেট লাগে', 'warn'], ['অনানুষ্ঠানিক — সীমিত হতে পারে', 'warn']] }
};
export const TS_ORDER = ['auto', 'device', 'google', 'edge', 'poll', 'server', 'watson', 'fish'];
export const tsMeta = (id) => TS_BASE[id] || XENG[id];

/* সার্ভিস বাছাইয়ের "শুনুন" চাপার আগে কনফিগ ঠিক আছে কি না — ত্রুটির বার্তা (ঠিক থাকলে '') */
export function tsValidate(id, cfg) {
  const x = (cfg.ttsx && cfg.ttsx[id]) || {};
  if (id === 'device' && !hasTTS) return 'এই ব্রাউজারে ফোনের টেক্সট-টু-স্পিচ নেই — অন্য সার্ভিস বাছুন';
  if (id === 'watson' && !(x.url && x.key)) return 'IBM Watson-এর Service URL ও API Key দিন';
  if (id === 'fish' && !x.key) return 'Fish Audio-র API Key দিন';
  if (id === 'poll' && !/\{text\}/.test(x.tpl || '')) return 'URL টেমপ্লেটে {text} থাকতে হবে';
  if (id === 'server' && !/\{text\}/.test(x.url || '')) return 'URL টেমপ্লেটে {text} থাকতে হবে';
  return '';
}

/* ---------- ফোনের ভয়েসের তালিকা ---------- */
const vLang = (v) => (v.lang || '').replace('_', '-').toLowerCase();
export const voicesFor = (voices, l) => voices.filter((v) => vLang(v).startsWith(l));
export function pickVoice(voices, cfg, l) {
  const want = (cfg.tts || {})[l];
  if (want) { const v = voices.find((x) => x.voiceURI === want || x.name === want); if (v) return v; }
  const list = voicesFor(voices, l);
  return list.find((v) => vLang(v) === TTS_LANG[l].toLowerCase()) || list[0] || null;
}
/* ড্রপডাউনের অপশন + বর্তমান মান (তালিকায় না থাকলে '' = স্বয়ংক্রিয়) */
export function voiceOptions(voices, l) {
  const list = voicesFor(voices, l);
  return [{ value: '', label: list.length ? 'স্বয়ংক্রিয়' : 'এই ডিভাইসে ' + TTS_NAME[l] + ' ভয়েস দেখা যাচ্ছে না' },
    ...list.map((v) => ({ value: v.voiceURI || v.name, label: v.name + ' (' + v.lang + ')' }))];
}
export const voiceValue = (opts, want) => (opts.some((o) => o.value === want) ? want : '');

/* ---------- অতিরিক্ত সার্ভিস থেকে অডিও আনা ---------- */
const tplUrl = (tpl, c, x) => String(tpl || '').replace(/\{(text|lang|voice)\}/g, (m, k) =>
  encodeURIComponent(k === 'text' ? c.t : k === 'lang' ? c.lang : (x.voice || '')));

async function fetchAudio(name, url, opt) {
  const r = await fetch(url, opt);
  if (!r.ok) { let m = ''; try { m = (await r.text()).slice(0, 120); } catch (e) { /* ignore */ } throw new Error(name + ' ' + r.status + (m ? ': ' + m : '')); }
  const b = await r.blob();
  if (!b.size || /json|text|html/i.test(b.type)) throw new Error(name + ': অডিও আসেনি');
  return URL.createObjectURL(b);
}

/* Edge-এর Sec-MS-GEC টোকেন: Windows-টিক (৫ মিনিটে গোল) + ক্লায়েন্ট টোকেনের SHA-256 */
async function edgeGec() {
  if (!(window.crypto && crypto.subtle)) throw new Error('এই ব্রাউজারে (নিরাপদ HTTPS ছাড়া) crypto নেই');
  let t = BigInt(Math.floor(Date.now() / 1000) + 11644473600); t -= t % 300n; t *= 10000000n;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t.toString() + EDGE_TOKEN));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}
async function edgeAudio(c, x, sig) {
  const voice = x[c.lang] || TTSX_DEF.edge[c.lang];
  const gec = await edgeGec();
  const rid = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()).replace(/-/g, '');
  const url = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=' + EDGE_TOKEN
    + '&ConnectionId=' + rid + '&Sec-MS-GEC=' + gec + '&Sec-MS-GEC-Version=' + encodeURIComponent(x.ver || EDGE_VER);
  const xml = c.t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return new Promise((res, rej) => {
    const parts = []; let ws, done = false;
    const end = (err) => {
      if (done) return; done = true;
      try { ws && ws.close(); } catch (e) { /* ignore */ }
      if (err) rej(err); else res(URL.createObjectURL(new Blob(parts, { type: 'audio/mpeg' })));
    };
    try { ws = new WebSocket(url); } catch (e) { rej(e); return; }
    ws.binaryType = 'arraybuffer';
    if (sig) sig.addEventListener('abort', () => end(new Error('বাতিল')));
    ws.onopen = () => {
      const ts = new Date().toUTCString().replace('GMT', 'GMT+0000 (Coordinated Universal Time)');
      ws.send('X-Timestamp:' + ts + '\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n'
        + '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n');
      ws.send('X-RequestId:' + rid + '\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:' + ts + 'Z\r\nPath:ssml\r\n\r\n'
        + "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='" + voice
        + "'><prosody pitch='+0Hz' rate='+0%' volume='+0%'>" + xml + '</prosody></voice></speak>');
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') { if (/Path:turn\.end/.test(ev.data)) end(parts.length ? null : new Error('Edge: অডিও আসেনি')); return; }
      const hl = new DataView(ev.data).getUint16(0);
      const head = new TextDecoder().decode(new Uint8Array(ev.data, 2, hl));
      if (/Path:audio/.test(head)) { const body = ev.data.slice(2 + hl); if (body.byteLength) parts.push(body); }
    };
    ws.onerror = () => end(new Error('Edge সার্ভারে সংযোগ হয়নি'));
    ws.onclose = () => end(parts.length ? null : new Error('Edge সংযোগ বন্ধ হয়ে গেছে'));
  });
}

/* একটি খণ্ডের অডিওর URL (blob: বা সরাসরি লিংক) — eng = সার্ভিসের নাম */
export async function xSrc(cfg, eng, c, sig) {
  const x = (cfg.ttsx && cfg.ttsx[eng]) || {};
  if (eng === 'poll') return tplUrl(x.tpl, c, x);
  if (eng === 'server') return tplUrl(x.url, c, x);
  if (eng === 'edge') return edgeAudio(c, x, sig);
  if (eng === 'watson') {
    const base = String(x.url || '').trim().replace(/\/v1\/.*$/, '').replace(/\/+$/, '');
    return fetchAudio('IBM Watson', base + '/v1/synthesize?voice=' + encodeURIComponent(x[c.lang] || ''), {
      method: 'POST', signal: sig,
      headers: { 'Authorization': 'Basic ' + btoa('apikey:' + (x.key || '')), 'Content-Type': 'application/json', 'Accept': 'audio/mp3' },
      body: JSON.stringify({ text: c.t })
    });
  }
  if (eng === 'fish') {
    const body = { text: c.t, format: 'mp3' }; if (x.ref) body.reference_id = x.ref;
    return fetchAudio('Fish Audio', 'https://api.fish.audio/v1/tts', {
      method: 'POST', signal: sig,
      headers: { 'Authorization': 'Bearer ' + (x.key || ''), 'Content-Type': 'application/json', 'model': x.model || 's1' },
      body: JSON.stringify(body)
    });
  }
  throw new Error('অজানা সার্ভিস');
}
