/* পেইজ-লজিক (আগের ইনলাইন <script>) চালায় এবং পেইজ ছাড়ার সময় তার সব পার্শ্বপ্রতিক্রিয়া গুছিয়ে নেয়:
   window/document/visualViewport লিসেনার, setInterval, <body>-এ যোগ করা এলিমেন্ট, body/html-এর ক্লাস ও স্টাইল।
   পেইজ ছাড়ার সময় `pagehide`/`beforeunload` লিসেনার একবার ডাকা হয় (view.html-এর সেভ/থামানো লজিকের জন্য)। */
import App from './common.js';
import { go } from './nav.js';

/* `location` শ্যাডো: href/replace/assign → রিয়্যাক্ট রাউটার; বাকি (search/hash/pathname/reload) আসল location */
export function makeLocation() {
  const real = window.location;
  return {
    get href() { return real.href; }, set href(v) { go(v, false); },
    replace(v) { go(v, true); }, assign(v) { go(v, false); }, reload() { real.reload(); },
    get search() { return real.search; }, get hash() { return real.hash; }, set hash(v) { real.hash = v; },
    get pathname() { return real.pathname; }, get origin() { return real.origin; },
    get protocol() { return real.protocol; }, get host() { return real.host; }, get hostname() { return real.hostname; },
    toString() { return real.href; }
  };
}

const KEEP_IDS = new Set(['root', 'toast', 'netBar']);

export default function runLegacy(logic) {
  const wl = [], dl = [], vl = [], timers = [];
  const bodyKids = new Set(Array.from(document.body.children));
  const bodyClass = document.body.getAttribute('class'), bodyStyle = document.body.getAttribute('style');
  const htmlClass = document.documentElement.getAttribute('class'), htmlStyle = document.documentElement.getAttribute('style');

  const wAdd = window.addEventListener, dAdd = document.addEventListener, sI = window.setInterval;
  const vv = window.visualViewport, vAdd = vv && vv.addEventListener;
  window.addEventListener = function (t, l, o) { wl.push([t, l, o]); return wAdd.call(this, t, l, o); };
  document.addEventListener = function (t, l, o) { dl.push([t, l, o]); return dAdd.call(this, t, l, o); };
  window.setInterval = function (...a) { const id = sI.apply(window, a); timers.push(id); return id; };
  if (vv) vv.addEventListener = function (t, l, o) { vl.push([t, l, o]); return vAdd.call(this, t, l, o); };
  const restore = () => {
    window.addEventListener = wAdd; document.addEventListener = dAdd; window.setInterval = sI;
    if (vv) vv.addEventListener = vAdd;
  };

  try { logic(App, makeLocation()); }
  catch (e) { console.error('[page logic]', e); }
  // স্ক্রিপ্ট চলার সময় (সিঙ্ক্রোনাস অংশ) প্যাচ থাকবে; এরপরও দেরিতে যোগ হওয়া লিসেনার ধরতে পেইজের পুরো জীবনকাল প্যাচ থাকে।

  return function cleanup() {
    restore();
    wl.forEach(([t, l]) => { if (t === 'pagehide' || t === 'beforeunload') { try { l.call(window, new Event(t)); } catch (e) { /* ignore */ } } });
    wl.forEach(([t, l, o]) => window.removeEventListener(t, l, o));
    dl.forEach(([t, l, o]) => document.removeEventListener(t, l, o));
    if (vv) vl.forEach(([t, l, o]) => vv.removeEventListener(t, l, o));
    timers.forEach((id) => clearInterval(id));
    Array.from(document.body.children).forEach((el) => { if (!bodyKids.has(el) && !KEEP_IDS.has(el.id)) el.remove(); });
    const put = (el, a, v) => { if (v == null) el.removeAttribute(a); else el.setAttribute(a, v); };
    put(document.body, 'class', bodyClass); put(document.body, 'style', bodyStyle);
    put(document.documentElement, 'class', htmlClass); put(document.documentElement, 'style', htmlStyle);
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
  };
}
