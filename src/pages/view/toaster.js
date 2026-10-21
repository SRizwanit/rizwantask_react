/* টোস্ট + কাস্টম লোডিং টোস্ট ("সেভ ও পরের")।
   চলাকালীন সাধারণ (সফল) বার্তাগুলো জমিয়ে রাখা হয় ও শেষে একসাথে দেখানো হয়; ত্রুটি এলে লোডিং বন্ধ হয়ে ত্রুটির টোস্ট দেখায়।
   অবস্থা একটি ছোট স্টোরে থাকে (useSyncExternalStore) — তাই % বদলালে পুরো পেইজ নয়, শুধু <Toasts> রেন্ডার হয়। */
export function createToaster() {
  let snap = { toast: { msg: '', cls: '' }, lt: { show: false, title: 'লোড হচ্ছে…', step: '', pct: 0 } };
  const subs = new Set();
  const emit = () => { snap = { toast: snap.toast, lt: snap.lt }; subs.forEach((f) => f()); };
  const setToast = (t) => { snap = { ...snap, toast: t }; emit(); };
  const setLt = (p) => { snap = { ...snap, lt: { ...snap.lt, ...p } }; emit(); };

  let toastT = 0;
  const lt = { on: false, finishing: false, total: 1, k: 1, pct: 0, notes: [], tick: 0, doneT: 0 };

  /* আসল অগ্রগতি জানা যায় না (GitHub সাড়া না দেওয়া পর্যন্ত), তাই ধাপ চলাকালীন % ধীরে ধীরে এগোয় (ধাপের ৯২% পর্যন্ত);
     ধাপ শেষ হলে সরাসরি পরের ধাপের শুরুতে লাফ দেয়; সব শেষে ১০০% */
  function tick() {
    const lo = (lt.k - 1) / lt.total * 100, hi = lt.k / lt.total * 100, cap = lo + (hi - lo) * 0.92;
    if (lt.pct < cap) lt.pct = Math.min(cap, lt.pct + Math.max(0.15, (cap - lt.pct) * 0.07));
    setLt({ pct: lt.pct });
  }
  function loadingStart(total) {
    clearInterval(lt.tick); clearTimeout(lt.doneT);
    lt.on = true; lt.finishing = false; lt.total = total; lt.k = 1; lt.pct = 0; lt.notes = [];
    clearTimeout(toastT);
    snap = { ...snap, toast: { ...snap.toast, cls: '' } };
    setLt({ show: true, pct: 0 });
    lt.tick = setInterval(tick, 120);
  }
  function loadingStep(k, msg) {
    if (!lt.on) return;
    lt.k = k; lt.pct = Math.max(lt.pct, (k - 1) / lt.total * 100);
    setLt({ title: msg, step: 'ধাপ ' + k + '/' + lt.total, pct: lt.pct });
  }
  function loadingHide() {
    clearInterval(lt.tick); clearTimeout(lt.doneT);
    lt.on = false; lt.finishing = false;
    setLt({ show: false });
  }
  function toast(msg, err, ms) {
    if (lt.on) {
      if (!err) { if (!/^সেভ হয়েছে/.test(msg)) lt.notes.push(msg); return; }
      loadingHide();                  // ত্রুটি: লোডিং সরিয়ে ত্রুটির টোস্ট
    }
    setToast({ msg, cls: 'show' + (err ? ' err' : '') });
    clearTimeout(toastT);
    toastT = setTimeout(() => setToast({ msg: snap.toast.msg, cls: '' }), ms || (err ? 5000 : 1800));
  }
  function loadingDone(msg) {         // সফল শেষ: ১০০% দেখিয়ে (০.৪৫ সেকেন্ড) লোডিং বন্ধ → সফলতার টোস্ট
    if (!lt.on) return;
    clearInterval(lt.tick);
    lt.finishing = true; lt.pct = 100; setLt({ title: 'সম্পন্ন', pct: 100 });
    lt.doneT = setTimeout(() => {
      const notes = lt.notes.slice();
      loadingHide();
      toast(notes.length ? msg + ' • ' + notes.join(' • ') : msg, false, notes.length ? 3800 : 2400);
    }, 450);
  }

  return {
    toast, loadingStart, loadingStep, loadingHide, loadingDone,
    isLoading: () => lt.on, isFinishing: () => lt.finishing,
    subscribe: (f) => { subs.add(f); return () => subs.delete(f); },
    getSnapshot: () => snap,
    dispose: () => { clearTimeout(toastT); clearInterval(lt.tick); clearTimeout(lt.doneT); }
  };
}
