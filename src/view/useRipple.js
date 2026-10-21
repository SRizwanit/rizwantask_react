/* ক্লিক রিপল ইফেক্ট: বোতাম ও ড্রপডাউনের আইটেমে চাপলে (মাউস/টাচ/কিবোর্ড) চাপার জায়গা থেকে হালকা সবুজ ঢেউ ছড়ায়।
   ঢেউ স্ক্রল/আঙুল নড়লেও মুছে যায় না; বোতামের লেখা বদলে গেলেও (যেমন শুনুন→বিরতি) ঢেউ শেষ পর্যন্ত চলে।
   "মোশন কমান" সেটিং চালু থাকলে দেখায় না। */
import { useEffect } from 'react';

export default function useRipple() {
  useEffect(() => {
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
      el.addEventListener('animationend', () => el.remove(), { once: true });
      host.appendChild(el);
      recs.set(host, { el, t0: performance.now() });
      return el;
    }
    function revive(host) {          // বোতামের ভেতরের লেখা/আইকন নতুন করে বসালে ঢেউ মুছে যায় → বাকি সময়টুকুর জন্য ফেরত বসানো
      const rec = recs.get(host); if (!rec) return;
      const used = performance.now() - rec.t0;
      if (rec.el.isConnected || used > DUR || !host.isConnected) return;
      rec.el.style.animationDelay = '-' + used + 'ms';
      host.appendChild(rec.el);
    }
    const down = (e) => {
      if (e.button > 0 || e.isPrimary === false) return;
      const h = e.target.closest && e.target.closest(SEL); if (h) spawn(h, e.clientX, e.clientY);
    };
    const click = (e) => {   // capture পর্বে: বোতামের নিজস্ব onclick লেখা বদলানোর আগেই বোতামটি ধরে রাখা হয়
      const h = e.target.closest && e.target.closest(SEL); if (!h) return;
      if (e.detail === 0 || !recs.get(h)) spawn(h, e.detail === 0 ? null : e.clientX, e.detail === 0 ? null : e.clientY);   // কিবোর্ড/কোড-চালিত ক্লিক
      setTimeout(() => revive(h), 0); setTimeout(() => revive(h), 80);
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('click', click, true);
    return () => { document.removeEventListener('pointerdown', down, true); document.removeEventListener('click', click, true); };
  }, []);
}
