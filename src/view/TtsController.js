/* শোনা (TTS) চালানোর স্টেট-মেশিন — রিয়্যাক্টের বাইরের (অডিও/টাইমার/WebSocket) কাজ।
   রিয়্যাক্টের সাথে যোগাযোগ কেবল deps-এর মাধ্যমে:
     getCfg()            সর্বশেষ কনফিগ            getText()  টেক্সট বক্সের লেখা
     getSel() → {a, b}   নির্বাচন/কার্সর            canPlay()  পেইজ ও টেক্সট তৈরি কিনা
     setCaret(pos)       কার্সর বসানো               scrollRatio(r) টেক্সট বক্স স্ক্রল
     onHighlight(h|null) {a,b,wa,wb} — বাক্য/শব্দ হাইলাইট    onState('idle'|'playing'|'paused')
     toast(msg, err, ms)                           ask(cb)    সার্ভিস বাছার ডায়ালগ খুলে বাছাই হলে cb()
     getVoices()/refreshVoices()  ফোনের ভয়েস তালিকা
   state: idle | playing | paused
   যে ক্ষেত্রে সার্ভিস ব্যর্থ হয়ে থামে (reselect), পরের "চালান"-এ আবার সার্ভিস বাছার ডায়ালগ আসে। */
import { buildChunks } from './utils.js';
import { TTS_LANG, TTS_NAME, G_LANG, XENG, hasTTS, pickVoice, tsMeta, xSrc } from './ttsEngines.js';

const G_RETRY = 3, G_WAIT = [1500, 4000, 9000];
const errShort = (e) => ((e && e.name === 'TypeError') ? 'নেটওয়ার্ক/CORS ত্রুটি' : ((e && e.message) || 'অজানা ত্রুটি')).slice(0, 90);

export default class TtsController {
  constructor(deps) {
    this.d = deps;
    this.id = 0; this.chunks = []; this.i = 0; this.state = 'idle'; this.start = 0;
    this.u = null; this.ga = null; this.cache = {}; this.xc = {};
    this.forceG = false; this.noG = false; this.retry = {}; this.wd = 0;
    this.stale = false; this.reselect = false; this.warned = {};
  }

  /* ---------- ছোট সহায়ক ---------- */
  _set(s) { this.state = s; this.d.onState(s); }
  cancelDev() { if (hasTTS) { try { speechSynthesis.cancel(); } catch (e) { /* ignore */ } } }
  pick(l) { return pickVoice(this.d.getVoices(), this.d.getCfg(), l); }
  rate() { return Math.min(2, Math.max(0.5, parseFloat(this.d.getCfg().ttsRate) || 1)); }
  setRate() { try { if (this.ga) this.ga.playbackRate = this.rate(); } catch (e) { /* ignore */ } }   // Google অডিওতে সাথে সাথে প্রযোজ্য
  resetForce() { this.forceG = false; }                                                              // ইঞ্জিন/ভয়েস বদলালে ফলব্যাক আবার প্রথম থেকে

  /* ---------- পড়ার সময় টেক্সট হাইলাইট ---------- */
  hlClear() { this.d.onHighlight(null); }
  hlShow(a, b, wa, wb) {
    const t = this.d.getText();
    if (this.stale || b <= a || b > t.length) return false;       // টেক্সট বদলে গেছে → আর হাইলাইট নয়
    this.d.onHighlight({ a, b, wa, wb });
    return true;
  }
  /* শোনার মধ্যে টেক্সট বদলালে অবস্থান-হিসাব মেলে না: হাইলাইট মুছে দেওয়া হয় (পরের বার "শুনুন" চাপলে আবার চলবে) */
  markStale() { if (this.state !== 'idle' && !this.stale) { this.stale = true; this.hlClear(); } }
  /* পড়ার সাথে সাথে কার্সর/স্ক্রল অনুসরণ + হাইলাইট (ফোকাস না নিয়ে, তাই কিবোর্ড খুলবে না) */
  follow(c) {
    this.d.setCaret(c.off);
    if (this.hlShow(c.off, c.end, -1, -1)) return;
    this.d.scrollRatio(c.off / Math.max(1, this.d.getText().length));
  }

  /* ---------- অডিও পরিষ্কার ---------- */
  killAudio(a) {
    if (!a) return;
    try { a.onplay = a.onplaying = a.onended = a.onerror = null; a.pause(); a.removeAttribute('src'); a.load(); } catch (e) { /* ignore */ }
    if (a._blob) { try { URL.revokeObjectURL(a._blob); } catch (e) { /* ignore */ } a._blob = ''; }   // Edge/Watson/Fish-এর মেমোরি-অডিও ছেড়ে দেওয়া
  }
  clearG() {
    this.killAudio(this.ga); this.ga = null;
    Object.keys(this.cache).forEach((k) => this.killAudio(this.cache[k]));
    this.cache = {};
    Object.keys(this.xc).forEach((k) => this.dropX(k));
  }
  stop() {
    this.reselect = false;
    this.id++;
    clearTimeout(this.wd);
    this.cancelDev();
    this.clearG();
    this.u = null;
    this.hlClear();
    this._set('idle');
  }
  finish() {
    this.i = 0; this.u = null; this.clearG(); this.hlClear(); this._set('idle');
    this.d.setCaret(this.start);
    this.d.toast('পড়া শেষ');
  }
  /* ব্যর্থ হয়ে থামা: "চালান" চাপলে এই খণ্ড থেকেই চলবে (re = true হলে আগে সার্ভিস বাছতে হবে) */
  pauseHere(i, msg, re = true) {
    this.id++; clearTimeout(this.wd); this.cancelDev(); this.clearG();
    this.i = i; this.reselect = re; this._set('paused');
    this.d.toast(msg, true, 9000);
  }

  /* ---------- Google অনলাইন অডিও ---------- */
  gAudio(i, bust) {
    if (this.cache[i]) return this.cache[i];
    const c = this.chunks[i]; if (!c) return null;
    const a = new Audio();
    a.preload = 'auto';
    try { a.referrerPolicy = 'no-referrer'; } catch (e) { /* ignore */ }
    a.src = 'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=' + G_LANG[c.lang] + '&total=1&idx=0&textlen=' + c.t.length + '&q=' + encodeURIComponent(c.t) + (bust ? '&_=' + Date.now() : '');
    this.cache[i] = a;
    return a;
  }
  /* ব্যর্থ হলে: ৩ বার পুনঃচেষ্টা (বিরতি বাড়িয়ে) → তারপর ফোনের TTS (থাকলে) → নইলে ওই খণ্ডে থেমে থাকে */
  playG(i, id, bust) {
    if (id !== this.id) return;
    const c = this.chunks[i], a = this.gAudio(i, bust);
    if (!a) { this.stop(); return; }
    this.ga = a;
    try { a.playbackRate = this.rate(); a.preservesPitch = true; } catch (e) { /* ignore */ }
    let settled = false;
    const fail = (why) => {
      if (id !== this.id || settled) return;
      settled = true; clearTimeout(this.wd);
      this.killAudio(a); delete this.cache[i]; if (this.ga === a) this.ga = null;
      const n = this.retry[i] = (this.retry[i] || 0) + 1;
      if (n <= G_RETRY) {
        this.d.toast('Google অডিও আটকেছে (' + why + ') — আবার চেষ্টা ' + n + '/' + G_RETRY + '…', false, G_WAIT[n - 1]);
        this.wd = setTimeout(() => this.playG(i, id, true), G_WAIT[n - 1]);
        return;
      }
      if ((this.d.getCfg().ttsEngine || 'auto') === 'auto' && hasTTS && this.pick(c.lang)) {
        this.noG = true;
        this.d.toast('Google অনলাইন অডিও বারবার ব্যর্থ — বাকিটা ফোনের TTS-এ চলছে', false, 4000);
        this.speak(i, id); return;
      }
      this.pauseHere(i, 'Google অডিও পাওয়া যাচ্ছে না (' + why + ') — সার্ভিসটি সাময়িক ব্লক/সীমিত হতে পারে। কিছুক্ষণ পরে বা অন্য সার্ভিস বেছে নিয়ে "চালান" চাপুন — এই জায়গা থেকেই চলবে। (স্থায়ী সমাধান: সেটিংসে "শুধু ফোনের TTS" + ফোনে বাংলা ভয়েস ডেটা)');
    };
    a.onplay = () => { if (id === this.id) this.follow(c); };
    a.onplaying = () => { clearTimeout(this.wd); };
    a.onended = () => { if (id === this.id) { delete this.cache[i]; this.speak(i + 1, id); } };
    a.onerror = () => fail('সার্ভার অডিও দেয়নি');
    clearTimeout(this.wd); this.wd = setTimeout(() => fail('সাড়া আসেনি'), 15000);   // নেটওয়ার্ক ঝুলে গেলে
    const p = a.play();
    if (p && p.catch) p.catch((err) => {
      if (id !== this.id) return;
      const nm = (err && err.name) || '';
      if (nm === 'AbortError') return;
      if (nm === 'NotAllowedError') { this.pauseHere(i, 'ব্রাউজার অডিও চালাতে দেয়নি — আবার "চালান" চাপুন', false); return; }
      fail(nm === 'NotSupportedError' ? 'সার্ভার অডিও ফেরত দেয়নি, সম্ভবত রেট-লিমিট' : (nm || 'অজানা ত্রুটি'));
    });
    if (i + 1 < this.chunks.length) this.gAudio(i + 1);     // পরের খণ্ড আগাম লোড
  }

  /* ---------- ফোনের TTS (এবং ইঞ্জিন বেছে নেওয়ার কেন্দ্র) ---------- */
  speak(i, id) {
    if (id !== this.id) return;
    if (i >= this.chunks.length) { this.finish(); return; }
    this.i = i;
    const c = this.chunks[i], cfg = this.d.getCfg();
    let eng = cfg.ttsEngine || 'auto';
    if (XENG[eng]) {                          // অতিরিক্ত সার্ভিস (Edge/Pollinations/সার্ভার/Watson/Fish)
      if (XENG[eng].langs[c.lang]) { this.playX(i, id); return; }
      if (!this.warned['x' + c.lang]) {       // সার্ভিসটি এই ভাষা পারে না → শুধু এই অংশ ফোনের TTS / Google-এ
        this.warned['x' + c.lang] = 1;
        this.d.toast(XENG[eng].short + '-এ ' + TTS_NAME[c.lang] + ' নেই — ' + TTS_NAME[c.lang] + ' অংশ ফোনের TTS/Google-এ পড়া হচ্ছে', false, 4500);
      }
      eng = 'auto';
    }
    const v = hasTTS ? this.pick(c.lang) : null;
    const wantG = this.forceG || !hasTTS || !v;
    const useG = eng === 'google' || (eng === 'auto' && wantG && !(this.noG && hasTTS && v));
    if (useG) { this.playG(i, id); return; }
    if (!hasTTS) { this.stop(); this.d.toast('এই ব্রাউজারে ফোনের টেক্সট-টু-স্পিচ নেই — সেটিংসে ইঞ্জিন "স্বয়ংক্রিয়" বা "Google অনলাইন" করুন', true, 6000); return; }

    const fallbackToG = (why) => {
      if (id !== this.id || eng !== 'auto') return false;
      this.forceG = true; clearTimeout(this.wd); this.cancelDev();
      this.d.toast('ফোনের TTS ' + why + ' — Google অনলাইন ভয়েস ব্যবহার হচ্ছে', false, 3500);
      this.playG(i, id);
      return true;
    };
    const u = new SpeechSynthesisUtterance(c.t);
    u.lang = TTS_LANG[c.lang];
    if (v) { u.voice = v; u.lang = v.lang; }
    else if (this.d.getVoices().length && !this.warned[c.lang]) {
      this.warned[c.lang] = 1;
      this.d.toast(TTS_NAME[c.lang] + ' ভয়েস পাওয়া যায়নি — ফোনের টেক্সট-টু-স্পিচ সেটিংসে ভয়েস ডেটা ডাউনলোড করুন', true, 6000);
    }
    u.rate = parseFloat(cfg.ttsRate) || 1;
    let started = false;
    u.onstart = () => { started = true; clearTimeout(this.wd); if (id === this.id) this.follow(c); };
    u.onboundary = (ev) => {                  // শব্দ-সীমা: সব ইঞ্জিন পাঠায় না; পেলে বর্তমান শব্দ গাঢ় হাইলাইট
      if (id !== this.id || this.stale || (ev.name && ev.name !== 'word') || !c.w) return;
      let wd = null;
      for (let k = 0; k < c.w.length; k++) { if (c.w[k].p <= ev.charIndex) wd = c.w[k]; else break; }
      if (wd) this.hlShow(c.off, c.end, wd.o, wd.o + wd.l);
    };
    u.onend = () => { clearTimeout(this.wd); if (id === this.id) this.speak(i + 1, id); };
    u.onerror = (e) => {
      if (id !== this.id) return;
      if (e.error === 'canceled' || e.error === 'interrupted') return;
      if (fallbackToG('সাড়া দেয়নি (' + (e.error || 'ত্রুটি') + ')')) return;
      this.stop();
      this.d.toast('পড়তে সমস্যা: ' + (e.error || 'অজানা') + (e.error === 'language-unavailable' ? ' (এই ভাষার ভয়েস নেই)' : ''), true);
    };
    this.u = u;                               // ব্রাউজার যেন অবজেক্ট মুছে না ফেলে
    try { speechSynthesis.speak(u); } catch (err) { if (!fallbackToG('চালু করা যায়নি')) { this.stop(); this.d.toast('TTS চালু করা যায়নি', true); } return; }
    if (eng === 'auto') {                     // কিছু ফোনে TTS কোনো ত্রুটি ছাড়াই নীরব থাকে → ৪ সেকেন্ডে সাড়া না এলে Google
      clearTimeout(this.wd);
      this.wd = setTimeout(() => { if (id === this.id && !started) fallbackToG('সাড়া দিচ্ছে না'); }, 4000);
    }
  }

  /* ---------- অতিরিক্ত সার্ভিস ---------- */
  dropX(i) {                                  // একটি খণ্ডের আনা/আসছে-অডিও বাতিল ও মুছে ফেলা
    const h = this.xc[i]; if (!h) return;
    delete this.xc[i];
    try { h.ac.abort(); } catch (e) { /* ignore */ }
    h.p.then((a) => this.killAudio(a), () => {});
  }
  xFetch(i) {                                 // খণ্ডের অডিও আনা শুরু (ক্যাশে থাকলে সেটাই)
    if (this.xc[i]) return this.xc[i];
    const c = this.chunks[i]; if (!c) return null;
    const ac = new AbortController();
    const p = xSrc(this.d.getCfg(), this.d.getCfg().ttsEngine, c, ac.signal).then((url) => {
      const a = new Audio(); a.preload = 'auto';
      try { a.referrerPolicy = 'no-referrer'; } catch (e) { /* ignore */ }
      if (/^blob:/.test(url)) a._blob = url;
      a.src = url;
      return a;
    });
    p.catch(() => {});                        // বাতিল/ব্যর্থ হলে "unhandled" সতর্কতা নয়; ব্যবহারকারী নিচে নিজে ধরে
    return (this.xc[i] = { p, ac });
  }
  /* ব্যর্থ হলে ৩ বার পুনঃচেষ্টা (বিরতি বাড়িয়ে) → তারপর থেমে যায়; পরের "চালান"-এ সার্ভিস আবার বাছার ডায়ালগ আসে */
  playX(i, id, bust) {
    if (id !== this.id) return;
    const eng = this.d.getCfg().ttsEngine, M = XENG[eng], c = this.chunks[i];
    if (!M || !c) { this.stop(); return; }
    if (bust) this.dropX(i);
    const h = this.xFetch(i);
    let settled = false, cura = null;
    const fail = (why) => {
      if (id !== this.id || settled) return;
      settled = true; clearTimeout(this.wd);
      if (cura) { this.killAudio(cura); if (this.ga === cura) this.ga = null; }
      this.dropX(i);
      const n = this.retry[i] = (this.retry[i] || 0) + 1;
      if (n <= G_RETRY) {
        this.d.toast(M.short + ' আটকেছে (' + why + ') — আবার চেষ্টা ' + n + '/' + G_RETRY + '…', false, G_WAIT[n - 1]);
        this.wd = setTimeout(() => this.playX(i, id, true), G_WAIT[n - 1]);
        return;
      }
      this.pauseHere(i, M.short + ' থেকে অডিও পাওয়া যাচ্ছে না (' + why + ')। "চালান" চাপলে অন্য সার্ভিস বেছে নিতে পারবেন — এই জায়গা থেকেই চলবে।');
    };
    clearTimeout(this.wd); this.wd = setTimeout(() => fail('সাড়া আসেনি'), 20000);
    h.p.then((a) => {
      if (id !== this.id || settled) return;
      cura = a; this.ga = a;
      try { a.playbackRate = this.rate(); a.preservesPitch = true; } catch (e) { /* ignore */ }
      a.onplay = () => { if (id === this.id) this.follow(c); };
      a.onplaying = () => { clearTimeout(this.wd); };
      a.onended = () => { if (id === this.id) { this.dropX(i); this.speak(i + 1, id); } };
      a.onerror = () => fail('অডিও চালানো যায়নি');
      const p = a.play();
      if (p && p.catch) p.catch((err) => {
        if (id !== this.id) return;
        const nm = (err && err.name) || '';
        if (nm === 'AbortError') return;
        if (nm === 'NotAllowedError') { this.pauseHere(i, 'ব্রাউজার অডিও চালাতে দেয়নি — আবার "চালান" চাপুন', false); return; }
        fail(nm === 'NotSupportedError' ? 'সার্ভার অডিও ফেরত দেয়নি' : (nm || 'অজানা ত্রুটি'));
      });
    }, (err) => fail(errShort(err)));
    if (i + 1 < this.chunks.length) this.xFetch(i + 1);   // পরের খণ্ড আগাম আনা
  }

  /* ---------- শুরু / বিরতি / চালান ---------- */
  startFrom(i) {
    this.id++;
    const id = this.id;
    this.retry = {}; this.noG = false;        // নতুন করে শুরু/চালান: Google আবার প্রথম থেকে চেষ্টা
    clearTimeout(this.wd);
    this.cancelDev();
    this._set('playing');
    setTimeout(() => this.speak(i, id), 80);  // cancel-এর পরপরই speak করলে কিছু ব্রাউজার গিলে ফেলে
  }
  click() {
    const d = this.d;
    if (!d.canPlay()) return;
    if (this.state === 'playing') {           // বিরতি: থামিয়ে এই খণ্ডটির শুরু থেকে আবার চালানো হয় (Android-এ pause অনির্ভরযোগ্য)
      this.id++;
      clearTimeout(this.wd);
      this.cancelDev();
      this.killAudio(this.ga); this.ga = null; delete this.cache[this.i]; this.dropX(this.i);
      this._set('paused');
      return;
    }
    if (this.state === 'paused') {
      if (!this.reselect) { this.startFrom(this.i); return; }          // সাধারণ বিরতি: একই সার্ভিসে চালু
      d.ask(() => { this.reselect = false; this.startFrom(this.i); });  // সার্ভিস ব্যর্থ হয়ে থেমেছিল: আবার সার্ভিস বাছুন
      return;
    }
    const text = d.getText();
    if (!text.trim()) { d.toast('পড়ার মতো টেক্সট নেই', true); return; }
    let { a, b } = d.getSel();
    if (a === b) { b = text.length; if (a >= b - 1) a = 0; }   // নির্বাচন নেই → কার্সর থেকে শেষ (শেষে থাকলে শুরু থেকে)
    d.refreshVoices(); this.warned = {};
    this.chunks = buildChunks(text, a, b);
    this.stale = false;
    if (!this.chunks.length) { d.toast('পড়ার মতো টেক্সট নেই', true); return; }
    this.start = a;
    const langs = [...new Set(this.chunks.map((c) => TTS_NAME[c.lang]))].join(' + ');
    d.ask(() => {                             // সার্ভিস বাছাই হলে তবেই শোনা শুরু
      const m = tsMeta(d.getCfg().ttsEngine);
      d.toast('শোনা শুরু • ভাষা: ' + langs + (m ? ' • ' + m.name : ''));
      this.startFrom(0);
    });
  }
}
