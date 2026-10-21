/* নোটিশ / ঘোষণা: সবাইকে বা একজনকে পাঠানো + পাঠানো নোটিশের তালিকা */
import { useEffect, useRef, useState } from 'react';
import App from '../../lib/common.js';
import { Empty, Ic } from './ui.jsx';
import { SQLHINT, noTbl, sendNotice } from './helpers.js';

const { fmtDT, toast, enc } = App;

export default function NoticeTab({ d, openKey, to, setTo, focusKey }) {
  const { users, uname } = d;
  const [title, setTitle] = useState(''), [body, setBody] = useState(''), [err, setErr] = useState(''), [sending, setSending] = useState(false);
  const [list, setList] = useState(null), [listErr, setListErr] = useState('');
  const titleRef = useRef(null);

  const load = async () => {
    try { setList(await App.sb.get('notices?order=created_at.desc&limit=60')); setListErr(''); }
    catch (e) { setList(null); setListErr(noTbl(e) ? 'notices টেবিল নেই — ' + SQLHINT : e.message); }
  };
  useEffect(() => { if (openKey) load(); }, [openKey]);
  useEffect(() => { if (focusKey && titleRef.current) titleRef.current.focus(); }, [focusKey]);  // ইউজার তালিকার "বার্তা" বোতাম

  const send = async () => {
    const t = title.trim(), b = body.trim();
    if (!t) { setErr('শিরোনাম লিখুন'); return; } setErr('');
    if (!to && !window.confirm('এই ঘোষণা সব ইউজারের কাছে যাবে। পাঠাবেন?')) return;
    setSending(true);
    try {
      await sendNotice({ user_id: to || null, title: t, body: b, kind: 'notice' });
      setTitle(''); setBody(''); toast('নোটিশ পাঠানো হয়েছে'); App.log('admin_notice', (to ? uname(to) : 'সবাই') + ' • ' + t); load();
    } catch (e) { setErr(noTbl(e) ? 'notices টেবিল নেই — ' + SQLHINT : e.message); } finally { setSending(false); }
  };
  const del = async (n) => {
    if (!window.confirm('এই নোটিশ মুছে ফেলবেন?')) return;
    try { await App.sb.del('notices?id=eq.' + enc(n.id)); toast('মুছে ফেলা হয়েছে'); load(); } catch (x) { toast(x.message, true); }
  };

  return (
    <section id="pNotice" style={{ maxWidth: '640px' }}>
      <div className="card" style={{ marginBottom: '16px' }}>
        <b>নতুন ঘোষণা / নোটিশ পাঠান</b>
        <p className="hint">{'ইউজারের task.html-এ একটি ডায়ালগ হয়ে আসবে (একবার দেখানোর পর আর আসবে না; প্রোফাইলে "নোটিশ ও ঘোষণা" থেকে আবার দেখা যায়)।'}</p>
        <label className="f" htmlFor="ntTo">কাকে</label>
        <select id="ntTo" value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">সবাই (ঘোষণা)</option>{users.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.phone})</option>)}
        </select>
        <label className="f" htmlFor="ntTitle">শিরোনাম *</label>
        <input id="ntTitle" ref={titleRef} type="text" maxLength="120" value={title} onChange={(e) => setTitle(e.target.value)} />
        {' '}<label className="f" htmlFor="ntBody">বিস্তারিত</label>
        <textarea id="ntBody" rows="5" value={body} onChange={(e) => setBody(e.target.value)}></textarea>
        <div className="err" id="ntErr">{err}</div>
        <button id="ntSend" className="primary block" disabled={sending} onClick={send}><Ic n="send" />পাঠান</button>
      </div>
      <b style={{ display: 'block', marginBottom: '8px' }}>পাঠানো নোটিশ</b>
      <div id="ntList">
        {listErr ? <div className="noticebox bad">{listErr}</div> : list == null ? null : list.length ? list.map((n) => (
          <div className="li" key={n.id}>
            <div className="row"><b style={{ flex: 1 }}>{n.title}</b><span className={'badge ' + (n.user_id ? 'warn' : 'ok')}>{n.user_id ? uname(n.user_id) : 'সবাই'}</span></div>
            <div className="meta" style={{ whiteSpace: 'pre-wrap' }}>{n.body || ''}</div>
            <div className="row"><span className="sub" style={{ flex: 1 }}>{fmtDT(n.created_at)} • {n.kind || 'notice'}</span><button className="sm danger" onClick={() => del(n)}><Ic n="trash" />মুছুন</button></div>
          </div>
        )) : <Empty>এখনো কোনো নোটিশ পাঠানো হয়নি</Empty>}
      </div>
    </section>
  );
}
