/* signup.html → রিয়্যাক্ট: OTP/PIN যাচাইয়ের পর প্রোফাইল তৈরি (নাম + পেমেন্ট মাধ্যম ও নাম্বার)। */
import { useEffect, useState } from 'react';
import PageShell from '../lib/PageShell.jsx';
import { Logo } from '../components/Icon.jsx';
import App from '../lib/common.js';
import { go } from '../lib/nav.js';

const { Phone } = App;
const PM_LABEL = { bkash: 'বিকাশ', nagad: 'নগদ' };

export default function Signup() {
  const [ctx] = useState(() => {            // লগইন ধাপে সেভ করা { phone, pin }
    try { return JSON.parse(sessionStorage.getItem('kp_signup') || 'null'); } catch (e) { return null; }
  });
  const [name, setName] = useState('');
  const [pm, setPm] = useState('bkash');
  const [pnum, setPnum] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!ctx || !ctx.phone || !ctx.pin) go('login', true); }, [ctx]);
  if (!ctx || !ctx.phone || !ctx.pin) return null;

  const submit = async () => {
    const nm = name.trim(), v = Phone.validate(pnum);
    if (!nm) return setErr('পূর্ণ নাম দিন');
    if (!v.ok) return setErr(PM_LABEL[pm] + ' নাম্বার: ' + v.msg);
    setBusy(true); setErr('');
    try {
      const dev = App.deviceId();
      if (await App.findUserByDevice(dev)) throw new Error('এই ডিভাইসে ইতিমধ্যে একটি একাউন্ট যুক্ত আছে। সাহায্যের জন্য অ্যাডমিনের সাথে যোগাযোগ করুন: ' + App.ADMIN_PHONE);
      const salt = App.newSalt(), hash = await App.hashPin(ctx.pin, salt);
      const rows = await App.sb.post('app_users', { phone: ctx.phone, full_name: nm, payment_method: pm, payment_number: v.phone, password_salt: salt, password_hash: hash, device_id: dev });
      sessionStorage.removeItem('kp_signup');
      App.session.set(rows[0]);
      App.log('signup', 'নতুন অ্যাকাউন্ট', { id: rows[0].id, name: nm }).finally(() => go('task', true));
    } catch (e) {
      setErr(/duplicate|23505/i.test(e.message) ? 'এই নাম্বার বা ডিভাইসে ইতিমধ্যে একাউন্ট আছে' : e.message);
      setBusy(false);
    }
  };

  return (
    <PageShell title="প্রোফাইল তৈরি - কিতাব প্রুফিং" themeColor="#0b5f4c" viewport="width=device-width, initial-scale=1, viewport-fit=cover">
      <div className="wrap">
        <div className="brand">
          <Logo icon="user" />
          <h1>প্রোফাইল তৈরি করুন</h1>
          <p>কাজ শুরু করতে আপনার তথ্য দিন</p>
          <span className="badge ok" id="verified" style={{ marginTop: '6px' }}>{'যাচাইকৃত নাম্বার: ' + ctx.phone}</span>
        </div>
        <div className="card">
          <b>ইউজার ডিটেইলস</b>
          <label className="f" htmlFor="name">পূর্ণ নাম *</label>
          <input id="name" type="text" autoComplete="name" placeholder="আপনার নাম" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="f">পেমেন্ট মাধ্যম *</label>
          <div className="seg">
            <label><input type="radio" name="pm" value="bkash" checked={pm === 'bkash'} onChange={() => setPm('bkash')} /><span>বিকাশ</span></label>
            <label><input type="radio" name="pm" value="nagad" checked={pm === 'nagad'} onChange={() => setPm('nagad')} /><span>নগদ</span></label>
          </div>
          <label className="f" htmlFor="pnum" id="pnumLbl">{PM_LABEL[pm] + ' নাম্বার *'}</label>
          <input id="pnum" type="tel" inputMode="tel" placeholder="01XXXXXXXXX" maxLength={18} value={pnum} onChange={(e) => setPnum(e.target.value)} />
          <button id="bSubmit" className="primary block" style={{ marginTop: '22px' }} disabled={busy} onClick={submit}>প্রোফাইল সাবমিট করুন</button>
          <div className={'spin' + (busy ? ' on' : '')} id="spin"></div>
          <div className="err" id="err">{err}</div>
        </div>
        <p className="hint" style={{ textAlign: 'center', marginTop: '14px' }}>আপনার তথ্য নিরাপদে সংরক্ষিত থাকবে</p>
      </div>
    </PageShell>
  );
}
