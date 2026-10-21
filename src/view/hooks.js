/* ছোট রিয়্যাক্ট হুক */
import { useCallback, useRef, useState } from 'react';

/* সবসময় সর্বশেষ রেন্ডারের ফাংশন ডাকে, কিন্তু নিজের পরিচয় (identity) বদলায় না —
   ইভেন্ট/টাইমার/অ্যাসিঙ্ক কলব্যাকে পুরনো ক্লোজার আটকে যাওয়া ঠেকায়। */
export function useEvent(fn) {
  const r = useRef(fn);
  r.current = fn;
  return useCallback((...a) => r.current(...a), []);
}

/* স্টেট + রেফ একসাথে: set করলেই রেফ সাথে সাথে বদলায় (অ্যাসিঙ্ক কোড `await`-এর পরেও সর্বশেষ মান পায়),
   আর স্টেট রেন্ডার চালায়। */
export function useStateRef(init) {
  const [v, setV] = useState(init);
  const ref = useRef(v);
  const set = useCallback((x) => {
    ref.current = typeof x === 'function' ? x(ref.current) : x;
    setV(ref.current);
  }, []);
  return [v, set, ref];
}

/* ডেটা-কাঠামো (Set/Map/অবজেক্ট) রেফে রাখা হয়; বদলালে repaint() ডেকে রেন্ডার চালাতে হয় */
export function useRepaint() {
  const [rev, setRev] = useState(0);
  const repaint = useCallback(() => setRev((n) => n + 1), []);
  return [rev, repaint];
}
