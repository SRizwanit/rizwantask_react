/* সাপোর্ট টিকেট: ফিল্টার, স্ট্যাটাস বদল, মোছা এবং লাইভ চ্যাট ডায়ালগ (Firebase Realtime Database) */
import { useEffect, useRef, useState } from 'react';
import App from '../../lib/common.js';
import { Dlg, Empty, Ic } from './ui.jsx';
import { TKST } from './helpers.js';

const { bn, fmtDT, toast } = App;
const STATUSES = [['open', 'খোলা'], ['pending', 'পেন্ডিং'], ['closed', 'বন্ধ']];

/* টিকেটের চ্যাট: মেসেজ লাইভ, ইউজারের মেসেজ দেখলে seenBy.admin=true */
function TicketDialog({ tk, id, onClose }) {
  const t = tk.tickets.find((x) => x.id === id);
  const [msgs, setMsgs] = useState([]), [text, setText] = useState('');
  const box = useRef(null);

  useEffect(() => {
    if (!id || !tk.fb.current) return undefined;
    const { D, db } = tk.fb.current;
    setMsgs([]); setText('');
    return D.onValue(D.ref(db, 'tickets/' + id + '/messages'), (snap) => {
      const v = snap.val() || {}, arr = Object.entries(v).map(([k, m]) => ({ k, ...m })).sort((a, b) => (a.time || 0) - (b.time || 0));
      setMsgs(arr);
      arr.forEach((m) => { if (m.sender === 'user' && !(m.seenBy && m.seenBy.admin)) D.update(D.ref(db, 'tickets/' + id + '/messages/' + m.k + '/seenBy'), { admin: true }).catch(() => {}); });
    });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [msgs]);

  const setStatus = async (v) => {
    const { D, db } = tk.fb.current;
    try { await D.update(D.ref(db, 'tickets/' + id), { status: v }); toast('স্ট্যাটাস বদলেছে'); } catch (x) { toast(x.message, true); }
  };
  const send = async () => {
    const v = text.trim(); if (!v || !id) return; setText('');
    const { D, db } = tk.fb.current;
    try {
      await D.push(D.ref(db, 'tickets/' + id + '/messages'), { sender: 'admin', msg: v, time: Date.now(), seenBy: { admin: true } });
      await D.update(D.ref(db, 'tickets/' + id), { lastMsg: Date.now() });
    } catch (x) { toast(x.message, true); setText(v); }
  };

  return (
    <Dlg id="tkDlg" className="big" open={!!id && !!t} onClose={onClose}>
      <div className="row">
        <h3 id="tkT" style={{ flex: '1', margin: '0' }}>{t ? t.name || '—' : ''}</h3>
        <select id="tkSt" className="sm" value={(t && t.status) || 'open'} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div className="sub" id="tkSub" style={{ margin: '4px 0 10px' }}>{t ? 'uid: ' + (t.uid || '—') + (t.phone ? ' • ' + t.phone : '') + ' • ' + fmtDT(t.createdAt) : ''}</div>
      <div className="msgs" id="tkMsgs" ref={box}>
        {msgs.map((m) => (m.type === 'system'
          ? <div className="m s" key={m.k}>{m.msg}</div>
          : <div className={'m ' + (m.sender === 'user' ? 'u' : 'a')} key={m.k}>{m.msg}<div className="sub" style={{ opacity: 0.75, marginTop: '2px', color: 'inherit' }}>{fmtDT(m.time)}</div></div>))}
      </div>
      <div className="row" style={{ marginTop: '10px', flexWrap: 'nowrap' }}>
        <input id="tkIn" type="text" placeholder="অ্যাডমিনের উত্তর লিখুন…" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} />
        <button id="tkSend" className="primary" style={{ flex: 'none' }} onClick={send}><Ic n="send" /></button>
      </div>
      <div className="acts"><button id="tkClose" onClick={onClose}>বন্ধ</button></div>
    </Dlg>
  );
}

export default function SupportTab({ d, tk, openKey }) {
  const { users } = d, { tickets } = tk;
  const [q, setQ] = useState(''), [uid, setUid] = useState(''), [st, setSt] = useState(''), [curId, setCurId] = useState(null);
  useEffect(() => { if (openKey) tk.init(); }, [openKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const ql = q.trim().toLowerCase(), uo = users.find((u) => String(u.id) === uid);
  const list = tickets.filter((t) => {
    if (st && (t.status || 'open') !== st) return false;
    if (uid && !(String(t.uid || '') === uid || (!t.uid && uo && (t.name || '').trim() === (uo.full_name || '').trim()))) return false;
    if (ql && ![t.uid, t.name, t.phone, t.desc, t.id].join(' ').toLowerCase().includes(ql)) return false;
    return true;
  });

  const byUid = (e, v) => {
    e.preventDefault();
    if (users.some((u) => String(u.id) === String(v))) setUid(String(v)); else { setUid(''); setQ(String(v)); }
  };
  const del = async (t) => {
    if (!window.confirm('এই টিকেট ও এর সব মেসেজ মুছে ফেলবেন?')) return;
    const { D, db } = tk.fb.current;
    try { await D.remove(D.ref(db, 'tickets/' + t.id)); toast('টিকেট মুছে ফেলা হয়েছে'); } catch (x) { toast(x.message, true); }
  };
  const setStatus = async (t, v) => {
    const { D, db } = tk.fb.current;
    try { await D.update(D.ref(db, 'tickets/' + t.id), { status: v }); toast('স্ট্যাটাস বদলেছে'); } catch (x) { toast(x.message, true); }
  };

  return (
    <section id="pSupp">
      <div className="row" style={{ marginBottom: '10px' }}>
        <input id="spQ" type="search" className="sm" placeholder="uid / নাম / ফোন / বিবরণ দিয়ে ফিল্টার" style={{ flex: '1', minWidth: '190px', width: 'auto' }} value={q} onChange={(e) => setQ(e.target.value)} />
        <select id="spUser" className="sm" style={{ maxWidth: '170px' }} value={uid} onChange={(e) => setUid(e.target.value)}>
          <option value="">সব ইউজার</option>{users.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.phone})</option>)}
        </select>
        <select id="spSt" className="sm" value={st} onChange={(e) => setSt(e.target.value)}>
          <option value="">সব স্ট্যাটাস</option>{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <span className="badge" id="spCount">{bn(list.length) + ' / ' + bn(tickets.length) + ' টি'}</span>
      </div>
      <div className="hint" id="spNote" style={{ marginBottom: '8px' }}>{tk.note}</div>
      <div id="spList">
        {list.length ? list.map((t) => {
          const s = TKST[t.status || 'open'] || TKST.open;
          return (
            <div className="li" key={t.id}>
              <div className="row"><b style={{ flex: 1 }}>{t.name || '—'}</b><span className={'badge ' + s[1]}>{s[0]}</span></div>
              <div className="meta">
                {t.uid ? <>uid: <a href="#" onClick={(e) => byUid(e, t.uid)} style={{ color: 'var(--pri)' }}>{t.uid}</a></> : 'uid নেই (পুরনো টিকেট)'}{t.phone ? ' • ' + t.phone : ''}<br />
                {(t.desc || '').slice(0, 160)}<br />খোলা: {fmtDT(t.createdAt)} • শেষ মেসেজ: {fmtDT(t.lastMsg)}
              </div>
              <div className="row">
                <button className="sm primary" onClick={() => setCurId(t.id)}><Ic n="headset" />খুলুন / উত্তর দিন</button>
                <select className="sm" value={t.status || 'open'} onChange={(e) => setStatus(t, e.target.value)}>{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                <button className="sm danger" onClick={() => del(t)}><Ic n="trash" /></button>
              </div>
            </div>
          );
        }) : <Empty>কোনো টিকেট নেই</Empty>}
      </div>
      <TicketDialog tk={tk} id={curId} onClose={() => setCurId(null)} />
    </section>
  );
}
