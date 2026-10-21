/* স্থায়ী সংরক্ষণ: localStorage-এর পাশাপাশি, এক্সটেনশনে হলে chrome.storage.local-এও (Token, API Key, Prompt, Model, সেটিংস, খসড়া)
   অনুলিপি রাখা হয়। শুরুতে সেখান থেকে ফিরিয়ে আনা হয়, তাই প্রতিবার নতুন করে দিতে হয় না।
   সাধারণ HTML-এ শুধু localStorage (+ স্থায়ী-স্টোরেজ অনুরোধ)। */

/* eslint-disable no-undef */
export const KP_EXT = (typeof browser !== 'undefined' && browser.storage && browser.storage.local) ? browser
  : (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) ? chrome : null;

const pend = {}; let timer = 0;

export function flushMirror() {
  clearTimeout(timer);
  const o = { ...pend }; Object.keys(pend).forEach((k) => delete pend[k]);
  if (!KP_EXT || !Object.keys(o).length) return;
  try { const p = KP_EXT.storage.local.set(o); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
}
export function mirror(k, v) {
  if (!KP_EXT) return;
  pend[k] = v; clearTimeout(timer); timer = setTimeout(flushMirror, 200);
}

/* পেইজ লোডের শুরুতে একবার: এক্সটেনশন স্টোরেজ থেকে localStorage-এ ফেরানো (বা উল্টো স্থানান্তর) */
export async function restoreFromExt(keys) {
  if (!KP_EXT) return;
  try {
    const got = await KP_EXT.storage.local.get(keys);
    for (const k of keys) {
      if (typeof got[k] === 'string' && got[k]) { try { localStorage.setItem(k, got[k]); } catch (e) { /* ignore */ } }   // এক্সটেনশন স্টোরেজই মূল
      else { let v = null; try { v = localStorage.getItem(k); } catch (e) { /* ignore */ } if (v) mirror(k, v); }         // আগের localStorage থেকে স্থানান্তর
    }
  } catch (e) { /* ignore */ }
}

/* পেইজ লুকালে/বন্ধ হলে বাকি অনুলিপি ঠেলে দেওয়া। রিটার্ন: সরানোর ফাংশন */
export function installFlushListeners() {
  const vis = () => { if (document.visibilityState === 'hidden') flushMirror(); };
  window.addEventListener('pagehide', flushMirror);
  document.addEventListener('visibilitychange', vis);
  return () => {
    flushMirror();
    window.removeEventListener('pagehide', flushMirror);
    document.removeEventListener('visibilitychange', vis);
  };
}

/* ব্রাউজার যেন ডেটা নিজে থেকে মুছে না ফেলে */
export function requestPersist() {
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignore */ }
}
