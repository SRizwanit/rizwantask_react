/* ছবি লোডিং: গোল রিং + শতাংশ। target = ০–১০০ (নয়তো null = মোট মাপ অজানা)।
   দেখানো সংখ্যা ধীরে ধীরে লক্ষ্য শতাংশের দিকে এগোয় (মসৃণ অ্যানিমেশন)। প্রতি পেইজে key বদলে নতুন করে ০ থেকে শুরু হয়। */
import { useEffect, useRef, useState } from 'react';
import { bnNum } from './utils.js';

const R = 40, C = 2 * Math.PI * R;

export default function ImageLoader({ target }) {
  const [shown, setShown] = useState(0);
  const sh = useRef(0), raf = useRef(0), tg = useRef(target);
  tg.current = target;

  useEffect(() => {
    if (target == null) return undefined;
    const step = () => {
      raf.current = 0;
      const t = tg.current; if (t == null) return;
      const d = t - sh.current;
      sh.current = Math.abs(d) < 0.4 ? t : sh.current + Math.max(Math.abs(d) * 0.2, 0.5) * Math.sign(d);
      setShown(sh.current);
      if (sh.current !== t) raf.current = requestAnimationFrame(step);
    };
    if (!raf.current) raf.current = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf.current); raf.current = 0; };
  }, [target]);

  const v = Math.max(0, Math.min(100, shown)), r = Math.round(v);
  return (
    <div className={'ldr' + (target == null ? ' ind' : '') + (target != null && r >= 100 ? ' full' : '')}
      role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={target == null ? undefined : r}>
      <div className="ldr-ring">
        <svg viewBox="0 0 100 100">
          <circle className="trk" cx="50" cy="50" r={R} />
          <g className="ring-s"><circle className="bar" cx="50" cy="50" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - v / 100)} /></g>
        </svg>
        <div className="num"><span className="n">{target == null ? '…' : bnNum(r)}</span><small>%</small></div>
      </div>
      <div className="ldr-sub" />
    </div>
  );
}
