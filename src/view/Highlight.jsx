/* শোনার সময় হাইলাইট: textarea-র পেছনে একই ফন্ট/মাপের আয়না-স্তর (#hl); লেখা স্বচ্ছ, শুধু mark-এর রং দেখা যায়।
   বর্তমান খণ্ড (বাক্য) হালকা হলুদে; ফোনের TTS শব্দ-সীমা (boundary) জানালে বর্তমান শব্দ গাঢ় কমলায়।
   ছোট স্টোর (useSyncExternalStore) ব্যবহার হয়, তাই প্রতি শব্দে শুধু এই কম্পোনেন্ট রেন্ডার হয়। */
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';

export function createHlStore() {
  let h = null; const subs = new Set();
  return {
    set(v) { h = v; subs.forEach((f) => f()); },
    get: () => h,
    subscribe: (f) => { subs.add(f); return () => subs.delete(f); }
  };
}

export default function Highlight({ store, taRef }) {
  const h = useSyncExternalStore(store.subscribe, store.get);
  const el = useRef(null);
  const t = h && taRef.current ? taRef.current.value : '';

  useLayoutEffect(() => {
    const ta = taRef.current, hl = el.current;
    if (!h || !ta || !hl) return;
    const m = hl.querySelector('mark.w') || hl.querySelector('mark.c');
    if (m) {                                                    // হাইলাইট দেখার জায়গার বাইরে গেলে স্ক্রল করে ওপরের দিকে আনা
      const top = m.offsetTop, bot = top + m.offsetHeight, vh = ta.clientHeight;
      if (top < ta.scrollTop + vh * 0.08 || bot > ta.scrollTop + vh * 0.8) ta.scrollTop = Math.max(0, top - vh * 0.25);
    }
    hl.scrollTop = ta.scrollTop;
  }, [h, taRef]);

  useEffect(() => {                                             // textarea স্ক্রল করলে আয়নাও একসাথে স্ক্রল
    const ta = taRef.current; if (!ta) return undefined;
    const f = () => { if (el.current && el.current.style.display !== 'none') el.current.scrollTop = ta.scrollTop; };
    ta.addEventListener('scroll', f, { passive: true });
    return () => ta.removeEventListener('scroll', f);
  }, [taRef]);

  let body = null;
  if (h) {
    const { a, b, wa, wb } = h;
    body = (wa >= a && wb > wa && wb <= b)
      ? <>{t.slice(0, a)}<mark className="c">{t.slice(a, wa)}<mark className="w">{t.slice(wa, wb)}</mark>{t.slice(wb, b)}</mark>{t.slice(b)}</>
      : <>{t.slice(0, a)}<mark className="c">{t.slice(a, b)}</mark>{t.slice(b)}</>;
  }
  return <div id="hl" dir="ltr" aria-hidden="true" ref={el} style={{ display: h ? 'block' : 'none' }}>{body}{h ? '\u200b' : null}</div>;
}
