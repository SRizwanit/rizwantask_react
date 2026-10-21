/* index.html (স্প্ল্যাশ) → রিয়্যাক্ট কম্পোনেন্ট: নাম অক্ষর ধরে ওঠে, তারা ঝিলমিল করে, শতাংশ লোডিং বারের সাথে মেলে,
   তারপর লগইন থাকলে টাস্কে, না থাকলে লগইনে পাঠায় (আসল যাচাই ওই পেইজেই হয়)। */
import { useEffect, useMemo, useState } from 'react';
import PageShell from '../lib/PageShell.jsx';
import { go } from '../lib/nav.js';
import css from './Splash.css?inline';

const NAME = 'RizwanTask';
const T_DELAY = 600, DUR = 2300;
const TYPE_START = 1000, TYPE_STEP = 190, END_HOLD = 650; // টাইপিং শুরু, প্রতি অক্ষরের বিরতি, শেষে থামার সময় (ms)
const ease = (t) => (t < 0.35 ? (t / 0.35) * 0.38 : t < 0.7 ? 0.38 + ((t - 0.35) / 0.35) * 0.34 : 0.72 + ((t - 0.7) / 0.3) * 0.28);
const reducedMotion = () => !!window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;

export default function Splash() {
  const [pct, setPct] = useState(0);
  const [typed, setTyped] = useState(0); // কয়টি অক্ষর টাইপ হয়েছে

  // ঝিলিমিলি তারা (একবারই তৈরি হয়)
  const stars = useMemo(() => {
    const N = window.innerWidth < 600 ? 26 : 46;
    return Array.from({ length: N }, () => {
      const z = 1.5 + Math.random() * 2.2;
      return { left: Math.random() * 100 + '%', top: Math.random() * 100 + '%', width: z + 'px', height: z + 'px', '--d': 2.4 + Math.random() * 3.6 + 's', '--l': Math.random() * 4 + 's' };
    });
  }, []);

  // শতাংশ (লোডিং বারের সাথে মেলানো)
  useEffect(() => {
    const reduce = reducedMotion();
    const T0 = performance.now() + T_DELAY;
    let raf = 0;
    const tick = (now) => {
      const t = Math.min(1, Math.max(0, (now - T0) / DUR));
      setPct(Math.round((reduce ? 1 : ease(t)) * 100));
      if (t < 1 && !reduce) raf = requestAnimationFrame(tick);
    };
    tick(performance.now());
    return () => cancelAnimationFrame(raf);
  }, []);

  // টাইপিং ইফেক্ট; টাইপিং শেষ হলে লগইন থাকলে টাস্কে, না থাকলে লগইনে; স্ক্রিনে চাপ দিলে সাথে সাথে
  useEffect(() => {
    const reduce = reducedMotion();
    let has = false;
    try { has = !!localStorage.getItem('kp_session_v1'); } catch (e) { /* ignore */ }
    const to = has ? 'task' : 'login';
    let gone = false;
    const timers = [];
    const later = (f, ms) => { timers.push(setTimeout(f, ms)); };
    const leave = () => {
      if (gone) return; gone = true;
      document.body.classList.add('out');
      later(() => go(to, true), reduce ? 0 : 420);
    };
    if (reduce) {
      setTyped(NAME.length);
      later(leave, 700);
    } else {
      let i = 0;
      const step = () => {
        i += 1; setTyped(i);
        if (i < NAME.length) later(step, TYPE_STEP);
        else later(leave, END_HOLD); // টাইপিং শেষ → পরের পেইজ
      };
      later(step, TYPE_START);
    }
    document.body.addEventListener('click', leave);
    return () => { timers.forEach(clearTimeout); document.body.removeEventListener('click', leave); document.body.classList.remove('out'); };
  }, []);

  return () => cancelAnimationFrame(raf);
  }, []);

  // লগইন থাকলে টাস্কে, না থাকলে লগইনে; স্ক্রিনে চাপ দিলে সাথে সাথে
  useEffect(() => {
    const reduce = reducedMotion();
    let has = false;
    try { has = !!localStorage.getItem('kp_session_v1'); } catch (e) { /* ignore */ }
    const to = has ? 'task' : 'login';
    let gone = false, t2 = 0;
    const leave = () => {
      if (gone) return; gone = true;
      document.body.classList.add('out');
      t2 = setTimeout(() => go(to, true), reduce ? 0 : 420);
    };
    const t1 = setTimeout(leave, reduce ? 700 : 3250);
    document.body.addEventListener('click', leave);
    return () => { clearTimeout(t1); clearTimeout(t2); document.body.removeEventListener('click', leave); document.body.classList.remove('out'); };
  }, []);

  return (
    <PageShell title="RizwanTask" themeColor="#06231c" sheets={[]} css={css}>
      <div className="lattice"></div>
      <div className="vig"></div>
      <div id="tw" aria-hidden="true">
        {stars.map((s, i) => <i key={i} style={s} />)}
      </div>
      <div className="shoot" style={{ '--y': '12%', '--w': '1.2s' }} aria-hidden="true"></div>
      <div className="shoot" style={{ '--y': '34%', '--w': '4.4s' }} aria-hidden="true"></div>

    <main className="stage" aria-label="RizwanTask">
      <p className="bsm" lang="ar">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
      <div className="mk">
        <div className="halo"></div>
        <div className="ring" aria-hidden="true">
          <svg viewBox="0 0 100 100" fill="none" stroke="#f2d27a" strokeOpacity=".55" strokeWidth=".7" strokeDasharray="1.4 3.2" strokeLinecap="round">
            <circle cx="50" cy="50" r="48" />
          </svg>
        </div>
        {/* ভেক্টর মার্ক: গম্বুজ-খিলান, মাথায় চাঁদ-তারা, গোলাপ-নকশা, ভেতরে রেহালে খোলা কুরআন ও প্রুফের টিক */}
        <svg className="mark" viewBox="0 0 64 64" role="img" aria-label="RizwanTask লোগো">
          <path className="plate" d="M9 61V35a23 23 0 0 1 46 0V61z" />
          <path className="pg" d="M32 38C28 35.5 22 35.5 17 37V51C22 49.5 28 49.5 32 52 36 49.5 42 49.5 47 51V37C42 35.5 36 35.5 32 38z" />
          <path className="d" pathLength="1" style={{ "--t": "1.5s", "--s": ".15s", stroke: "#f2d27a", strokeWidth: "2" }} d="M9 61V35a23 23 0 0 1 46 0V61" />
          <path className="d" pathLength="1" style={{ "--t": ".7s", "--s": ".2s", stroke: "#f2d27a", strokeWidth: "2" }} d="M4 61H60" />
          <g transform="translate(32 25)" style={{ stroke: "#f2d27a", strokeWidth: "1.2", fill: "none" }}>
            <circle className="d" pathLength="1" style={{ "--t": ".8s", "--s": "1.1s" }} r="1.4" />
            <ellipse className="d" pathLength="1" style={{ "--t": ".9s", "--s": "1.1s" }} rx="1.7" ry="5" />
            <ellipse className="d" pathLength="1" style={{ "--t": ".9s", "--s": "1.2s" }} rx="1.7" ry="5" transform="rotate(45)" />
            <ellipse className="d" pathLength="1" style={{ "--t": ".9s", "--s": "1.3s" }} rx="1.7" ry="5" transform="rotate(90)" />
            <ellipse className="d" pathLength="1" style={{ "--t": ".9s", "--s": "1.4s" }} rx="1.7" ry="5" transform="rotate(135)" />
          </g>
          <path className="d" pathLength="1" style={{ "--t": ".6s", "--s": "1.2s", stroke: "#f3fff9", strokeWidth: "2.2" }} d="M32 52V38" />
          <path className="d" pathLength="1" style={{ "--t": "1s", "--s": "1.3s", stroke: "#f3fff9", strokeWidth: "2.2" }} d="M32 38C28 35.5 22 35.5 17 37V51C22 49.5 28 49.5 32 52" />
          <path className="d" pathLength="1" style={{ "--t": "1s", "--s": "1.4s", stroke: "#f3fff9", strokeWidth: "2.2" }} d="M32 38C36 35.5 42 35.5 47 37V51C42 49.5 36 49.5 32 52" />
          <path className="d" pathLength="1" style={{ "--t": ".7s", "--s": "1.7s", stroke: "#f2d27a", strokeWidth: "1.8" }} d="M19 57C25 56.5 29 55 32 52C35 55 39 56.5 45 57" />
          <path className="d" pathLength="1" style={{ "--t": ".5s", "--s": "2s", stroke: "#f2d27a", strokeWidth: "2.2" }} d="M36.5 44l2.8 2.8 4.6-5.8" />
          <path className="cr" d="M35 1.4A5.5 5.5 0 1 0 35 10.6A4.6 4.6 0 1 1 35 1.4z" />
          <path className="sp" d="M40.50 3.30 L41.18 5.07 L43.07 5.17 L41.59 6.36 L42.09 8.18 L40.50 7.15 L38.91 8.18 L39.41 6.36 L37.93 5.17 L39.82 5.07z" />
        </svg>
      </div>
      <h1 id="nm" aria-label="RizwanTask" className={typed >= NAME.length ? 'done' : ''}>
        {[...NAME].map((c, n) => (
          <span key={n} className={n < typed ? (n === typed - 1 ? 'on last' : 'on') : ''} style={{ '--n': n }} aria-hidden="true">{c}</span>
        ))}
      </h1>
      <p className="tag">
        কিতাব প্রুফিং
      </p>
      <div className="rule" aria-hidden="true">
        <b></b>
        <svg viewBox="-7 -7 14 14">
          <path d="M1.2 -5.6A5.6 5.6 0 1 0 1.2 5.6A4.7 4.7 0 1 1 1.2 -5.6z" />
          <path d="M4.4 -1.6 5.1 .1 6.9 .2 5.5 1.3 6 3 4.4 2 2.9 3 3.4 1.3 2 .2 3.8 .1z" transform="translate(.4 -.2) scale(.9)" />
        </svg>
        <b></b>
      </div>
      <div className="load" role="progressbar" aria-label="লোড হচ্ছে">
        <div className="rail">
          <div className="fill"></div>
        </div>
        <div className="lt">
          <span>
            লোড হচ্ছে
            <span className="dots">
              <i>.</i>
              <i>.</i>
              <i>.</i>
            </span>
          </span>
          <span id="pc">{pct}%</span>
        </div>
      </div>
    </main>
    </PageShell>
  );
}
