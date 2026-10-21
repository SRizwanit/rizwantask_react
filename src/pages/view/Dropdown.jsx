/* নিজস্ব ড্রপডাউন: ব্রাউজারের নিজস্ব <select> পপআপ সিস্টেম ফন্টে দেখায়, তাই বাটন + নিজস্ব পপআপ তালিকা (একই Anek Bangla ফন্ট)।
   options = [{value, label}], value = বর্তমান মান (স্ট্রিং)। */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Ic } from './Sprite.jsx';

let activeClose = null;
/* খোলা ড্রপডাউন থাকলে বন্ধ করে true দেয় (ডায়ালগের Esc ও বাইরের ক্লিকে ব্যবহার হয়) */
export function closeDropdown() {
  if (!activeClose) return false;
  const f = activeClose; f();
  return true;
}

export default function Dropdown({ id, value, options, onChange, title, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const btn = useRef(null), pop = useRef(null);
  const idx = options.findIndex((o) => o.value === value);
  const curIdx = idx >= 0 ? idx : (options.length ? 0 : -1);   // সাধারণ <select>-এর মতো: না মিললে প্রথমটি
  const label = curIdx >= 0 ? options[curIdx].label : '';

  const close = () => setOpen(false);

  /* খোলা থাকাকালীন: বাইরে ক্লিক / রিসাইজ / স্ক্রল / Esc = বন্ধ */
  useEffect(() => {
    if (!open) return undefined;
    const closer = () => setOpen(false);
    activeClose = closer;
    const onDoc = (e) => { if (pop.current && !pop.current.contains(e.target) && !(btn.current && btn.current.contains(e.target))) closer(); };
    const onScroll = (e) => { if (pop.current && !pop.current.contains(e.target)) closer(); };
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); closer(); } };
    document.addEventListener('click', onDoc);
    window.addEventListener('resize', closer);
    window.addEventListener('scroll', onScroll, true);
    document.addEventListener('keydown', onKey);
    return () => {
      if (activeClose === closer) activeClose = null;
      document.removeEventListener('click', onDoc);
      window.removeEventListener('resize', closer);
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /* পপআপের অবস্থান: বাটনের নিচে (জায়গা কম হলে ওপরে); বর্তমানটি মাঝখানে */
  useLayoutEffect(() => {
    if (!open || !pop.current || !btn.current) return;
    const p = pop.current, r = btn.current.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
    p.style.minWidth = Math.min(Math.max(r.width, 150), vw - 16) + 'px';
    const below = vh - r.bottom - 8, above = r.top - 8;
    const down = below >= 260 || below >= above;
    const maxH = Math.max(120, Math.min(vh * 0.6, down ? below : above));
    p.style.maxHeight = maxH + 'px';
    const h = Math.min(p.scrollHeight, maxH);
    p.style.top = (down ? r.bottom + 4 : Math.max(8, r.top - 4 - h)) + 'px';
    const w = p.offsetWidth;
    let left = r.left; if (left + w > vw - 8) left = Math.max(8, vw - 8 - w);
    p.style.left = left + 'px';
    const s = p.querySelector('.sel');
    if (s) p.scrollTop = s.offsetTop - p.clientHeight / 2 + s.offsetHeight / 2;
  }, [open]);

  // মডাল ডায়ালগের ভেতরের ড্রপডাউন ডায়ালগের ভেতরেই বসাতে হয়, নইলে ডায়ালগের নিচে ঢাকা পড়ে
  const host = open && btn.current ? (btn.current.closest('dialog') || document.body) : null;

  return (
    <>
      <button type="button" className="dd-btn" data-for={id} ref={btn} title={title} aria-label={ariaLabel}
        aria-haspopup="listbox" aria-expanded={open ? 'true' : 'false'}
        onClick={(e) => { e.stopPropagation(); if (open) close(); else { closeDropdown(); setOpen(true); } }}>
        <span className="dd-t">{label}</span>
        <Ic n="down" className="dd-ch" />
      </button>
      {host ? createPortal(
        <div className="dd-pop" role="listbox" ref={pop} style={{ top: 0, left: 0 }}>
          {options.map((o, i) => (
            <div key={i + '|' + o.value} className={'dd-it' + (i === curIdx ? ' sel' : '')} role="option" aria-selected={i === curIdx}
              onClick={(e) => { e.stopPropagation(); close(); onChange(o.value); }}>
              <span>{o.label}</span>
              {i === curIdx ? <Ic n="check" /> : null}
            </div>
          ))}
        </div>, host) : null}
    </>
  );
}
