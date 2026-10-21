/* ব্যবহারকারী: খোঁজা, পরিসংখ্যান, রিভিউ/বার্তা/লগে যাওয়া, PIN ও ডিভাইস রিসেট, ব্লক/আনব্লক, ডিলিট */
import { useEffect, useState } from 'react';
import App from '../../lib/common.js';
import { Dlg, Empty, Ic, Tile } from './ui.jsx';
import { PM, blkErr } from './helpers.js';

const { bn, money, toast, enc } = App;

/* ইউজারের নিজস্ব পরিসংখ্যান-টাইল */
function UserStats({ d, u }) {
  const sm = d.userSum(u.id), x = d.pst[String(u.id)] || { today: 0, w7: 0 };
  return (
    <div className="tiles" style={{ margin: 0, gridTemplateColumns: 'repeat(auto-fill,minmax(105px,1fr))' }}>
      <Tile small n={bn(sm.pages)} l="প্রুফড পেইজ" /><Tile small n={bn(sm.approved)} l="অনুমোদিত" /><Tile small n={bn(sm.pending)} l="রিভিউ বাকি" /><Tile small n={bn(sm.correction)} l="সংশোধন" />
      <Tile small n={money(sm.earned)} l="মোট আয়" /><Tile small n={money(sm.available)} l="উত্তোলনযোগ্য" /><Tile small n={money(sm.paid)} l="পরিশোধিত" /><Tile small n={bn(x.today) + ' / ' + bn(x.w7)} l="আজ / ৭ দিন" />
    </div>
  );
}

function PinDialog({ target, onClose, onDone }) {
  const [pin, setPin] = useState(''), [err, setErr] = useState('');
  useEffect(() => { if (target) { setPin(''); setErr(''); } }, [target]);
  const clear = async () => {
    try {
      await App.sb.patch('app_users?id=eq.' + enc(target.id), { password_salt: null, password_hash: null });
      onClose(); toast('PIN মুছে ফেলা হয়েছে'); App.log('admin_pin', target.full_name + ' (মুছে ফেলা)'); onDone();
    } catch (x) { setErr(x.message); }
  };
  const set = async () => {
    if (pin.length !== 4) { setErr('৪ ডিজিটের PIN দিন'); return; }
    try {
      const s = App.newSalt(), h = await App.hashPin(pin, s);
      await App.sb.patch('app_users?id=eq.' + enc(target.id), { password_salt: s, password_hash: h });
      onClose(); toast('নতুন PIN সেট হয়েছে'); App.log('admin_pin', target.full_name + ' (নতুন PIN)'); onDone();
    } catch (x) { setErr(x.message); }
  };
  return (
    <Dlg id="pDlg" open={!!target} onClose={onClose}>
      <h3>PIN রিসেট</h3>
      <p className="hint" id="pdWho">{target ? target.full_name + ' (' + target.phone + ')' : ''}</p>
      <button id="pdClear" className="block" style={{ marginTop: '10px' }} onClick={clear}>PIN মুছুন (ইউজার পরের লগইনে নতুন PIN দেবে)</button>
      {' '}<label className="f" htmlFor="pdNew">অথবা সরাসরি নতুন ৪ ডিজিটের PIN দিন</label>
      {' '}<input id="pdNew" className="pin" type="text" inputMode="numeric" maxLength="4" placeholder="----" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
      <div className="err" id="pdErr">{err}</div>
      <div className="acts">
        <button id="pdCancel" onClick={onClose}>বন্ধ</button>
        <button id="pdSet" className="primary" onClick={set}>নতুন PIN সেট</button>
      </div>
    </Dlg>
  );
}

export default function UsersTab({ d, me, openKey, ask, onReview, onMessage, onLog }) {
  const { users, proofsLoaded, lastActive } = d;
  const [q, setQ] = useState(''), [pinTarget, setPinTarget] = useState(null);

  useEffect(() => { if (openKey) { d.loadUsers().then(() => d.ensureMoney()); } }, [openKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const ql = q.trim().toLowerCase();
  const list = users.filter((u) => !ql || (u.full_name || '').toLowerCase().includes(ql) || (u.phone || '').includes(ql));

  const act = async (a, u) => {
    if (a === 'pin') setPinTarget(u);
    else if (a === 'dev') {
      if (!window.confirm(u.full_name + ' এর ডিভাইস রিসেট করবেন? ইউজার অন্য ফোনে লগইন করতে পারবে।')) return;
      try { await App.sb.patch('app_users?id=eq.' + enc(u.id), { device_id: null }); toast('ডিভাইস রিসেট হয়েছে'); App.log('admin_device', u.full_name); d.loadUsers(); } catch (x) { toast(x.message, true); }
    } else if (a === 'rev') onReview(u.id);
    else if (a === 'msg') onMessage(u.id);
    else if (a === 'log') onLog(u.id);
    else if (a === 'blk') {
      if (u.is_blocked) {
        if (!window.confirm(u.full_name + ' কে আনব্লক করবেন?')) return;
        try { await App.sb.patch('app_users?id=eq.' + enc(u.id), { is_blocked: false, blocked_reason: null }); toast('আনব্লক করা হয়েছে'); App.log('admin_unblock', u.full_name); d.loadUsers(); } catch (x) { toast(blkErr(x), true); }
      } else {
        const why = await ask({ title: u.full_name + ' কে ব্লক করুন', label: 'ব্লকের কারণ (ইউজার দেখতে পাবে)', ok: 'ব্লক করুন' }); if (why == null) return;
        try { await App.sb.patch('app_users?id=eq.' + enc(u.id), { is_blocked: true, blocked_reason: why || null }); toast('ব্লক করা হয়েছে'); App.log('admin_block', u.full_name + (why ? ' • ' + why : '')); d.loadUsers(); } catch (x) { toast(blkErr(x), true); }
      }
    } else if (a === 'del') {
      if (!window.confirm(u.full_name + ' কে মুছে ফেলবেন? এটি ফেরানো যাবে না।')) return;
      try { await App.sb.del('app_users?id=eq.' + enc(u.id)); toast('ইউজার ডিলিট হয়েছে'); App.log('admin_delete_user', u.full_name); d.loadUsers(); } catch (x) { toast(x.message, true); }
    }
  };

  return (
    <section id="pUsers">
      <div className="row" style={{ marginBottom: '12px' }}>
        <input id="uq" type="search" placeholder="নাম বা নাম্বার দিয়ে খুঁজুন" style={{ flex: '1', minWidth: '200px' }} value={q} onChange={(e) => setQ(e.target.value)} />
        {' '}<span className="badge" id="uCount">{'মোট ' + users.length + ' জন'}</span>
        {' '}<button id="uReload" className="sm" onClick={d.loadUsers}><Ic n="refresh" /></button>
      </div>
      <div id="uList">
        {list.length ? list.map((u) => {
          const bound = !App.deviceEmpty(u.device_id), self = u.id === me.id, adm = App.isAdminPhone(u.phone), la = lastActive(u);
          return (
            <div className="li" key={u.id}>
              <div className="row">
                <b style={{ flex: 1 }}>{u.full_name}{adm ? <>{' '}<span className="badge ok">অ্যাডমিন</span></> : null}{u.is_blocked ? <>{' '}<span className="badge bad">ব্লকড</span></> : null}</b>
                <span className={'badge ' + (bound ? 'ok' : 'warn')}>{bound ? 'ডিভাইস যুক্ত' : 'ডিভাইস খালি'}</span>
                <span className={'badge ' + (App.hasPin(u) ? '' : 'warn')}>{App.hasPin(u) ? 'PIN আছে' : 'PIN নেই'}</span>
              </div>
              <div className="meta">
                মোবাইল: {u.phone}<br />{PM[u.payment_method] || 'পেমেন্ট'}: {u.payment_number || '-'}<br />
                যোগ দিয়েছেন: {u.created_at ? new Date(u.created_at).toLocaleString('bn-BD') : '-'}<br />
                সর্বশেষ সক্রিয়: {App.fmtDT(la || null)}
                {u.is_blocked && u.blocked_reason ? <><br />ব্লকের কারণ: {u.blocked_reason}</> : null}
              </div>
              {proofsLoaded ? <UserStats d={d} u={u} /> : null}
              <div className="row">
                <button className="sm" onClick={() => act('rev', u)}><Ic n="check" />রিভিউ</button>
                <button className="sm" onClick={() => act('msg', u)}><Ic n="bell" />বার্তা</button>
                <button className="sm" onClick={() => act('log', u)}><Ic n="list" />লগ</button>
                <button className="sm" onClick={() => act('pin', u)}><Ic n="key" />PIN রিসেট</button>
                <button className="sm" onClick={() => act('dev', u)}><Ic n="device" />ডিভাইস রিসেট</button>
                {self || adm ? null : <button className="sm warnb" onClick={() => act('blk', u)}><Ic n="ban" />{u.is_blocked ? 'আনব্লক' : 'ব্লক'}</button>}
                {self ? null : <button className="sm danger" onClick={() => act('del', u)}><Ic n="trash" />ডিলিট</button>}
              </div>
            </div>
          );
        }) : <Empty>কোনো ইউজার নেই</Empty>}
      </div>
      <PinDialog target={pinTarget} onClose={() => setPinTarget(null)} onDone={d.loadUsers} />
    </section>
  );
}
