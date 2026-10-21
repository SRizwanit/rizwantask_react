/* Admin-এর ছোট শেয়ার্ড UI: ডায়ালগ, জেনেরিক ইনপুট-ডায়ালগ (ask), আইকন-স্প্যান, টাইল ইত্যাদি। */
import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../../components/Icon.jsx';

/* আগের `<span data-ic="…">` — আইকন + পরের লেখা */
export const Ic = ({ n }) => <span><Icon name={n} /></span>;
export const Empty = ({ children, pad }) => <div className="empty" style={pad ? { padding: '18px' } : undefined}>{children}</div>;
export const Tile = ({ n, l, hl, small }) => (
  <div className={'tile' + (hl ? ' hl' : '')}><span className="tn" style={small ? { fontSize: '17px' } : undefined}>{n}</span><span className="tl">{l}</span></div>
);
export const SegBar = ({ a, p, c, tot, mt }) => {
  const t = Math.max(tot, a + p + c, 1);
  return <div className="pg seg3" style={mt ? { marginTop: mt } : undefined}><i className="a" style={{ width: (a / t * 100) + '%' }}></i><i className="p" style={{ width: (p / t * 100) + '%' }}></i><i className="c" style={{ width: (c / t * 100) + '%' }}></i></div>;
};
export const Chips = ({ id, items, value, onPick }) => (
  <div className="chips" id={id}>
    {items.map(([v, label]) => <button key={v} className={v === value ? 'on' : ''} onClick={() => onPick(v)}>{label}</button>)}
  </div>
);

/* নেটিভ <dialog>-এর নিয়ন্ত্রিত রূপ: open=true → showModal(); বন্ধ হলে (Esc/বোতাম) onClose */
export function Dlg({ open, onClose, id, className, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal(); else if (!open && d.open) d.close();
  }, [open]);
  return <dialog ref={ref} id={id} className={className} onClose={onClose}>{children}</dialog>;
}

/* কারণ/নোট নেওয়ার জেনেরিক ডায়ালগ। ask({title,label,value,ok,required,rows}) → Promise<string|null> (বাতিল = null) */
function AskDialog({ st, onDone }) {
  const [v, setV] = useState(''), [err, setErr] = useState('');
  useEffect(() => { if (st) { setV(st.value || ''); setErr(''); } }, [st]);
  const ok = () => { const t = v.trim(); if (st.required && !t) { setErr('কিছু লিখুন'); return; } onDone(t); };
  return (
    <Dlg id="akDlg" open={!!st} onClose={() => onDone(null)}>
      <h3 id="akT">{st ? st.title : ''}</h3>
      <label className="f" htmlFor="akV" id="akL">{st ? st.label : ''}</label>
      <textarea id="akV" rows={st ? st.rows : 3} value={v} onChange={(e) => setV(e.target.value)}></textarea>
      <div className="err" id="akErr">{err}</div>
      <div className="acts">
        <button id="akNo" onClick={() => onDone(null)}>বন্ধ</button>
        <button id="akOk" className="primary" onClick={ok}>{st ? st.ok : 'ঠিক আছে'}</button>
      </div>
    </Dlg>
  );
}
export function useAsk() {
  const [st, setSt] = useState(null);
  const res = useRef(null);
  const ask = useCallback((o) => new Promise((r) => { res.current = r; setSt({ value: '', ok: 'ঠিক আছে', required: false, rows: 3, ...o }); }), []);
  const onDone = useCallback((v) => { const r = res.current; res.current = null; setSt(null); if (r) r(v); }, []);
  return [ask, <AskDialog key="ask" st={st} onDone={onDone} />];
}
