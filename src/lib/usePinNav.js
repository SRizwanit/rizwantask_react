/* নিচের নেভিগেশন বার: ব্রাউজার টুলবার/স্ক্রল বদলালেও স্ক্রিনের ভিতরে রাখে।
   (স্ক্রল উপরে করলে মোবাইল ব্রাউজারের ভিউপোর্ট ছোট হয়; তখন fixed বার নিচে সরে যেতে পারে)
   রিটার্ন: repin() — ট্যাব বদলের পরে নতুন করে ঠিক করতে ডাকুন। */
import { useCallback, useEffect, useRef } from 'react';

export default function usePinNav(navRef) {
  const sched = useRef(() => {});
  useEffect(() => {
    const el = navRef.current; if (!el) return undefined;
    let raf = 0;
    const fix = () => {
      raf = 0; if (el.hidden) return; el.style.transform = '';
      const vv = window.visualViewport, r = el.getBoundingClientRect();
      const vh = vv ? vv.height + vv.offsetTop : window.innerHeight;
      const lim = Math.min(vh, window.innerHeight || vh);
      if (r.bottom > lim + 0.5) el.style.transform = 'translateY(' + (lim - r.bottom) + 'px)';
    };
    const s = () => { if (!raf) raf = requestAnimationFrame(fix); };
    sched.current = s;
    const vv = window.visualViewport;
    window.addEventListener('scroll', s, { passive: true });
    window.addEventListener('resize', s); window.addEventListener('orientationchange', s); window.addEventListener('pageshow', s);
    if (vv) { vv.addEventListener('resize', s); vv.addEventListener('scroll', s); }
    document.addEventListener('visibilitychange', s);
    s(); const t = setTimeout(s, 300);
    return () => {
      clearTimeout(t); cancelAnimationFrame(raf); sched.current = () => {};
      window.removeEventListener('scroll', s); window.removeEventListener('resize', s);
      window.removeEventListener('orientationchange', s); window.removeEventListener('pageshow', s);
      if (vv) { vv.removeEventListener('resize', s); vv.removeEventListener('scroll', s); }
      document.removeEventListener('visibilitychange', s);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return useCallback(() => sched.current(), []);
}
