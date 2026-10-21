/* পরিষ্কার (pure) ছোট ফাংশন — রিয়্যাক্ট-নির্ভর নয় */

const te = new TextEncoder(), td = new TextDecoder();

export function toB64(str) {
  const b = te.encode(str); let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}
export function fromB64(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  return td.decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
export function bytesToB64(buf) {
  const u8 = new Uint8Array(buf); let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}

export const epath = (p) => p.split('/').map(encodeURIComponent).join('/');
export const natCmp = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
export const numOf = (stem) => { const m = stem.match(/\d+/g); return m ? parseInt(m[m.length - 1], 10) : NaN; };
export const bnNum = (n) => String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);
export const trimSl = (v) => (v || '').trim().replace(/^\/+|\/+$/g, '');
export const normRepo = (v) => v.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '');
/* textarea নিজে \r\n → \n করে; তুলনার ভিত্তি সবসময় এই স্বাভাবিক রূপ */
export const normNl = (v) => String(v == null ? '' : v).replace(/\r\n?/g, '\n');
export const encU = encodeURIComponent;

export const sleep = (ms, signal) => new Promise((res, rej) => {
  const t = setTimeout(res, ms);
  if (signal) signal.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('Aborted', 'AbortError')); }, { once: true });
});

export const MIME_BY_EXT = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
export const extOf = (name) => (name.split('.').pop() || '').toLowerCase();

/* ---------- ক্লিপবোর্ড / ট্যাব ---------- */
export async function copyPlain(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* নিচে বিকল্প */ }
  try {
    const t = document.createElement('textarea');
    t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(t); t.select(); t.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy'); t.remove(); return ok;
  } catch (e) { return false; }
}
export async function toPngBlob(blob) {
  if (blob.type === 'image/png') return blob;
  const bmp = await createImageBitmap(blob);
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  c.getContext('2d').drawImage(bmp, 0, 0);
  return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('PNG বানানো যায়নি'))), 'image/png'));
}
/* 'noopener' দিলে window.open সবসময় null ফেরত দেয়; তাই সাধারণভাবে খুলে opener ফাঁকা করা হয় */
export function openTab(url) { const w = window.open(url, '_blank'); if (w) { try { w.opener = null; } catch (e) { /* ignore */ } } return w; }

/* ---------- অটো হেডিং: পেস্ট করা টেক্সটে হেডিং শনাক্ত করে আগে (স্পেস ছাড়া) 1 বসানো ---------- */
export const AR_RE = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;   // আরবি/ফার্সি
const BN_LET = /[\u0985-\u09B9\u09CE\u09DC-\u09DF A-Za-z]/;                      // অন্তত একটি অক্ষর (শুধু সংখ্যা/চিহ্ন নয়)
const SENT_RE = /[।.?!]["”’'\)\]]*$/;                                            // আগের বাক্য শেষ হয়েছে কি না
const KEY_RE = /^(দলিল|অধ্যায়|পরিচ্ছেদ|অনুচ্ছেদ|ভূমিকা|মুখবন্ধ|সূচিপত্র|উপসংহার|পর্ব|প্রশ্ন|উত্তর|প্রসঙ্গ|বিষয়)(?![\u0980-\u09FF])/;

export function isHeading(line, prev, first) {
  const t = line.trim();
  if (!t || t.length > 80) return false;
  if (AR_RE.test(t) || !BN_LET.test(t)) return false;
  if (/^1[\u0980-\u09FF]/.test(t)) return false;
  if (/[।.?!,;]["”’'\)\]]*$/.test(t)) return false;
  if (KEY_RE.test(t)) return true;
  if (t.length > 50 || t.split(/\s+/).length > 8) return false;
  if (/[–—\-]$/.test(t) && !/[\d০-৯]/.test(t)) return false;
  if (/:$/.test(t) && t.split(/\s+/).length > 4) return false;
  const p = (prev || '').trim();
  return first || p === '' || SENT_RE.test(p);
}
export function markHeadings(text) {
  const lines = text.split(/\r?\n/);
  let n = 0;
  const out = lines.map((ln, i) => {
    if (isHeading(ln, i ? lines[i - 1] : '', i === 0)) { n++; return '1' + ln.trim(); }
    return ln;
  });
  return { text: out.join('\n'), n };
}

/* ---------- শোনা (TTS): ভাষা চেনা + খণ্ডে ভাগ ---------- */
export const TTS_MAX = 180;                                   // এক খণ্ডে সর্বোচ্চ অক্ষর (Google সীমা ~200)
const TTS_SENT = /[।.?!۔؟]["”’'\)\]]*$/;                      // বাক্য শেষ

export function wordLang(w) {
  if (AR_RE.test(w)) return 'ar';
  if (/[\u0980-\u09FF]/.test(w)) return 'bn';
  if (/[A-Za-z]/.test(w)) return 'en';
  return null;                                                // সংখ্যা/চিহ্ন: আগের ভাষাতেই থাকবে
}
/* টেক্সটকে ভাষা অনুযায়ী খণ্ডে ভাগ; প্রতিটি খণ্ডের off = মূল টেক্সটে শুরুর অবস্থান */
export function buildChunks(text, from, to) {
  const seg = text.slice(from, to), out = [];
  let c = null, last = 'bn', lastEnd = 0, inHead = false, first = true;
  const fl = () => { if (c && c.t.trim()) out.push(c); c = null; };
  const re = /\S+/g; let m;
  while ((m = re.exec(seg))) {
    const gap = seg.slice(lastEnd, m.index); lastEnd = m.index + m[0].length;
    const nl = first || /\n/.test(gap); first = false;
    let w = m[0], head = false, skip = 0;
    if (nl && /^1(?=[\u0980-\u09FF])/.test(w)) { w = w.slice(1); head = true; skip = 1; }   // হেডিং চিহ্ন 1 পড়া হবে না
    if (nl && inHead) { fl(); inHead = false; }
    if (/\n\s*\n/.test(gap)) fl();                            // ফাঁকা লাইন = অনুচ্ছেদ শেষ
    if (head) { fl(); inHead = true; }
    if (!w) continue;
    const L = wordLang(w) || (c ? c.lang : last);
    if (c && (c.lang !== L || c.t.length + w.length + 1 > TTS_MAX)) fl();
    if (!c) c = { t: '', lang: L, off: from + m.index, end: 0, w: [] };
    c.t += (c.t ? ' ' : '') + w;
    c.w.push({ p: c.t.length - w.length, o: from + m.index + skip, l: w.length });
    c.end = from + m.index + m[0].length;
    last = L;
    if (TTS_SENT.test(w)) fl();
  }
  fl();
  return out;
}

/* ভিন্ন লিপির অক্ষর / markdown ধরার সতর্কতা (শুধু জানায়, বদলায় না) */
export function checkText(text) {
  const p = [];
  if (/[\u0900-\u0963\u0966-\u097F]/.test(text)) p.push('দেবনাগরী অক্ষর');   // দাঁড়ি ।(U+0964/0965) বাংলাতেও ব্যবহৃত, তাই বাদ
  for (const tok of text.split(/\s+/)) {
    if (/[\u0980-\u09FF]/.test(tok) && AR_RE.test(tok)) { p.push('বাংলা-আরবি মিশ্র শব্দ: ' + tok); break; }
  }
  if (/\*\*|^\s{0,3}#{1,6}\s|^\s*[-*]\s/m.test(text)) p.push('markdown চিহ্ন');
  return p;
}
