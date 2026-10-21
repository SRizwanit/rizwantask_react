/* support.html → রিয়্যাক্ট: টিকেট খোলা + অ্যাডমিনের সাথে লাইভ চ্যাট (Firebase Realtime Database)।
   আগে Firebase CDN থেকে import হতো; এখন npm প্যাকেজ `firebase` — একই কনফিগ ও ডেটা-কাঠামো (tickets/{id}, tickets/{id}/messages)। */
import { useEffect, useRef, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, onChildAdded, onValue, update } from 'firebase/database';
import PageShell from '../lib/PageShell.jsx';
import Icon, { Logo } from '../components/Icon.jsx';
import App from '../lib/common.js';
import { go } from '../lib/nav.js';
import css from './Support.css?inline';

const firebaseConfig = {
  apiKey: 'AIzaSyDqjbhRTpFgwRtZrqCG-ckO-UM_uZqh2Rc',
  authDomain: 'srizwanchat.firebaseapp.com',
  projectId: 'srizwanchat',
  storageBucket: 'srizwanchat.firebasestorage.app',
  messagingSenderId: '101112162367',
  appId: '1:101112162367:web:5d33f592297f4f9967b08a',
  measurementId: 'G-8XHB9HQTMR'
};
const db = getDatabase(initializeApp(firebaseConfig));

const toBanglaNum = (n) => n.toString().replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);
function formatTime(ts) {
  const d = new Date(ts);
  let h = d.getHours(), m = d.getMinutes();
  const ap = h >= 12 ? 'পিএম' : 'এএম';
  h = h % 12 || 12;
  return toBanglaNum(h) + ':' + toBanglaNum(m < 10 ? '0' + m : m) + ' ' + ap;
}
const STATUS = { open: ['খোলা', 'status-open'], pending: ['পেন্ডিং', 'status-pending'], closed: ['বন্ধ', 'status-closed'] };

/* একটি চ্যাট মেসেজ: অ্যাডমিনের মেসেজ দেখলে seenBy.user=true; নিজের মেসেজে অ্যাডমিন দেখলে "দেখা হয়েছে" */
function Message({ m, ticketId }) {
  const isMe = m.sender === 'user';
  const [showTime, setShowTime] = useState(false);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!isMe && m.seenBy && !m.seenBy.user) update(ref(db, `tickets/${ticketId}/messages/${m.key}/seenBy`), { user: true });
    if (!isMe) return undefined;
    return onValue(ref(db, `tickets/${ticketId}/messages/${m.key}/seenBy`), (s) => { const sd = s.val() || {}; if (sd.admin) setSeen(true); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="message-wrapper">
      {!isMe && <div className="sender-name">অ্যাডমিন</div>}
      <div className={`message ${isMe ? 'me' : 'other'}`} onClick={() => setShowTime((v) => !v)}><div>{m.msg}</div></div>
      <div className={`info-row ${isMe ? 'me-info' : 'other-info'}`}>
        <span className={'time-stamp' + (showTime ? ' show-info' : '')}>{formatTime(m.time)}</span>
        {isMe && <span className="seen-status" style={seen ? { display: 'block' } : undefined}>দেখা হয়েছে</span>}
      </div>
    </div>
  );
}

export default function Support() {
  const [screen, setScreen] = useState(() => (localStorage.getItem('ticket_id') ? 'chat' : 'form'));
  const [ticketId, setTicketId] = useState(() => localStorage.getItem('ticket_id'));
  const [myName, setMyName] = useState(() => localStorage.getItem('ticket_name'));
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [fName, setFName] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [nameLocked, setNameLocked] = useState(false);
  const [text, setText] = useState('');
  const box = useRef(null);

  const closed = !!ticket && ticket.status === 'closed';

  // নতুন টিকেটের ফর্ম রিসেট (আগের নাম থাকলে সেটাই, লকড)
  const resetForm = () => {
    const savedName = localStorage.getItem('ticket_name');
    if (savedName) { setFName(savedName); setNameLocked(true); }
    else {
      let sess = '';
      try { sess = (App.session.get() && App.session.get().name) || ''; } catch (e) { /* ignore */ }
      setFName(sess); setNameLocked(false);
    }
    setFDesc('');
  };
  useEffect(() => { if (!ticketId) resetForm(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // টিকেটের তথ্য + মেসেজ লাইভ লোড
  useEffect(() => {
    if (!ticketId) return undefined;
    setMessages([]); setTicket(null);
    const seen = new Set();
    const offT = onValue(ref(db, `tickets/${ticketId}`), (snap) => {
      const t = snap.val();
      if (!t) { // টিকেট মুছে গেছে
        localStorage.removeItem('ticket_id'); setTicketId(null); setScreen('form'); resetForm(); return;
      }
      setTicket(t);
    });
    const offM = onChildAdded(ref(db, `tickets/${ticketId}/messages`), (snap) => {
      if (seen.has(snap.key)) return;
      seen.add(snap.key);
      setMessages((list) => [...list, { key: snap.key, ...snap.val() }]);
    });
    return () => { offT(); offM(); };
  }, [ticketId]); // eslint-disable-line react-hooks/exhaustive-deps

  // নতুন মেসেজ এলে নিচে স্ক্রল
  useEffect(() => { const c = box.current; if (c) c.scrollTop = c.scrollHeight; }, [messages, screen]);

  // ভিউপোর্ট ফিক্স (মোবাইল কিবোর্ড খুললে চ্যাটের উচ্চতা)
  useEffect(() => {
    const vv = window.visualViewport;
    if (screen !== 'chat' || !vv) return undefined;
    const fix = () => { document.body.style.height = vv.height + 'px'; if (box.current) box.current.scrollTop = box.current.scrollHeight; };
    vv.addEventListener('resize', fix);
    return () => { vv.removeEventListener('resize', fix); document.body.style.height = ''; };
  }, [screen]);

  const back = () => go('task#prof'); // → টাস্ক → প্রোফাইল

  const openTicket = () => {
    let name = fName.trim();
    const desc = fDesc.trim();
    if (!name) { const saved = localStorage.getItem('ticket_name'); if (saved) { name = saved; setFName(saved); } }
    if (!name || !desc) { alert('নাম ও সমস্যার বিবরণ দিন'); return; }
    if (ticketId) localStorage.removeItem('ticket_id');
    let uid = '', phone = '';
    try { const ss = App.session.get(); if (ss) { uid = String(ss.id || ''); phone = ss.phone || ''; } } catch (e) { /* ignore */ }
    const ticketRef = push(ref(db, 'tickets'), { name, uid, phone, desc, status: 'open', createdAt: Date.now(), lastMsg: Date.now() });
    const id = ticketRef.key;
    localStorage.setItem('ticket_id', id);
    localStorage.setItem('ticket_name', name);
    try { App.log('ticket_open', desc.slice(0, 120)); } catch (e) { /* ignore */ }
    push(ref(db, `tickets/${id}/messages`), { type: 'system', msg: `টিকেট খোলা হয়েছে। সমস্যা: ${desc}`, time: Date.now() });
    setMyName(name); setTicketId(id); setScreen('chat');
  };

  const openNewTicket = () => {
    localStorage.removeItem('ticket_id');
    setTicketId(null); setTicket(null); setMessages([]);
    setScreen('form'); resetForm();
  };

  const sendMsg = () => {
    const t = text.trim();
    if (!t || closed || !ticketId) return;
    push(ref(db, `tickets/${ticketId}/messages`), { sender: 'user', msg: t, time: Date.now(), seenBy: { user: true } });
    update(ref(db, `tickets/${ticketId}`), { lastMsg: Date.now() });
    setText('');
    setTimeout(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, 100);
  };

  const [stLabel, stCls] = STATUS[(ticket && ticket.status) || 'open'] || STATUS.open;
  const desc = ticket && ticket.desc;

  return (
    <PageShell title="সাপোর্ট - কিতাব প্রুফিং" themeColor="#0b5f4c" viewport="width=device-width, initial-scale=1.0, viewport-fit=cover" css={css}>
      {/* ===== টিকেট ফর্ম ===== */}
      <div id="form-screen" className={'screen' + (screen === 'form' ? ' active' : '')}>
        <header className="top">
          <button className="sm back" id="bBackForm" type="button" aria-label="ফিরে যান" title="ফিরে যান" onClick={back}><span><Icon name="left" /></span></button>
          <Logo className="logo-sm" as="span" />
          <h2>সাপোর্ট</h2>
        </header>
        <div className="form-scroll">
          <div className="card form-card">
            <div className="brand">
              <Logo icon="headset" />
              <h1>সাপোর্ট</h1>
              <p id="form-subtitle">{nameLocked ? 'নতুন সমস্যার বিবরণ দিন' : 'আপনার সমস্যা জানান, আমরা সাহায্য করব'}</p>
            </div>
            <div id="name-group" style={{ opacity: nameLocked ? '0.8' : '1' }}>
              <label className="f" htmlFor="f-name">আপনার নাম *</label>
              <input id="f-name" type="text" placeholder="নাম লিখুন" value={fName} readOnly={nameLocked} onChange={(e) => setFName(e.target.value)} />
            </div>
            <label className="f" htmlFor="f-desc">সমস্যার বিবরণ *</label>
            <textarea id="f-desc" placeholder="আপনার সমস্যা বিস্তারিত লিখুন..." value={fDesc} onChange={(e) => setFDesc(e.target.value)}></textarea>
            <button className="primary block" type="button" onClick={openTicket}><span><Icon name="ticket" /></span>টিকেট খুলুন</button>
          </div>
        </div>
      </div>

      {/* ===== চ্যাট ===== */}
      <div id="chat-screen" className={'screen' + (screen === 'chat' ? ' active' : '')}>
        <header className="top" id="chat-header">
          <button className="sm back" id="bBackChat" type="button" aria-label="ফিরে যান" title="ফিরে যান" onClick={back}><span><Icon name="left" /></span></button>
          <div className="chat-header-info">
            <div className="chat-title" id="header-name">{(ticket && ticket.name) || myName || '—'}</div>
            <div className="chat-sub" id="header-sub">{desc ? (desc.length > 40 ? desc.slice(0, 40) + '...' : desc) : '—'}</div>
          </div>
          <span className={'status-badge ' + stCls} id="header-status">{stLabel}</span>
        </header>

        <div id="msg-container" ref={box}>
          {messages.map((m) => (m.type === 'system'
            ? <div className="sys-msg" key={m.key}>{m.msg}</div>
            : <Message key={m.key} m={m} ticketId={ticketId} />))}
        </div>

        <div id="input-box" style={{ display: closed ? 'none' : 'flex' }}>
          <input id="input" placeholder="মেসেজ লিখুন..." autoComplete="off" value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) sendMsg(); }} />
          <button id="send-btn" type="button" aria-label="পাঠান" onClick={sendMsg}><span><Icon name="send" /></span></button>
        </div>

        {closed && (
          <div id="closed-notice" className="closed-notice">
            <span>এই টিকেটটি বন্ধ করা হয়েছে।</span>
            <button className="primary" onClick={openNewTicket}><Icon name="plus" />নতুন টিকেট খুলুন</button>
          </div>
        )}
      </div>
    </PageShell>
  );
}
