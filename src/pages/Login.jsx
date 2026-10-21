/* login.html → রিয়্যাক্ট। ধাপ: ফোন → (নতুন ইউজার হলে) OTP → PIN → (ডিভাইস সমস্যা হলে) ডিভাইস-ধাপ। লজিক আগের মতোই। */
import { useEffect, useRef, useState } from 'react';
import PageShell from '../lib/PageShell.jsx';
import { Logo } from '../components/Icon.jsx';
import App from '../lib/common.js';
import { go } from '../lib/nav.js';

const { Phone, toast } = App;
const mmss = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
const digitsOnly = (v) => v.replace(/\D/g, '');
const wa = (m) => window.open('https://wa.me/' + App.ADMIN_WA + '?text=' + encodeURIComponent(m), '_blank');

export default function Login() {
  const [step, setStep] = useState('phone');            // phone | otp | pin | dev
  const [phoneIn, setPhoneIn] = useState('');
  const [otp, setOtp] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [mode, setMode] = useState('LOGIN');            // LOGIN | SETUP_EXISTING | SETUP_NEW
  const [blockReason, setBlockReason] = useState('BOUND'); // BOUND | USED
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpTick, setOtpTick] = useState(0);              // প্রতিবার কোড দেখানোর জন্য ডায়ালগ খোলার সংকেত
  const [left, setLeft] = useState(0);                  // OTP আবার পাঠানোর কাউন্টডাউন (সেকেন্ড)

  const phone = useRef('');                             // যাচাইকৃত নাম্বার
  const user = useRef(null);
  const timer = useRef(0);
  const dlg = useRef(null);
  const refs = { phone: useRef(null), otp: useRef(null), pin: useRef(null) };

  // এই ডিভাইসে আগেই লগইন থাকলে সরাসরি টাস্কে
  useEffect(() => {
    if (App.session.get()) App.requireAuth().then(() => go('task', true));
    return () => clearInterval(timer.current);
  }, []);

  // ধাপ বদলালে সংশ্লিষ্ট ঘরে ফোকাস
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; } // প্রথমবার লোডে ফোকাস নয় (আগের মতো)
    const el = step === 'phone' ? refs.phone.current : step === 'otp' ? refs.otp.current : step === 'pin' ? refs.pin.current : null;
    if (el) el.focus();
  }, [step, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const show = (s) => { setStep(s); setErr(''); };

  const pinStep = (m) => { setMode(m); setPin(''); setPin2(''); show('pin'); };
  const devStep = (reason) => { setBlockReason(reason); show('dev'); };
  const afterUserKnown = (u) => { // ইউজার আছে: PIN নাকি ডিভাইস-ব্লক
    const dev = App.deviceId(), stored = u.device_id;
    if (!App.deviceEmpty(stored) && stored !== dev) return devStep('BOUND');
    pinStep(App.hasPin(u) ? 'LOGIN' : 'SETUP_EXISTING');
  };

  const startResend = () => {
    clearInterval(timer.current);
    let s = 120; setLeft(s);
    timer.current = setInterval(() => { s -= 1; setLeft(Math.max(0, s)); if (s <= 0) clearInterval(timer.current); }, 1000);
  };
  const startOtp = async () => {
    const code = await App.requestOtp(phone.current);
    show('otp'); setOtp(''); setOtpCode(code); setOtpTick((n) => n + 1); startResend();
  };
  useEffect(() => { if (otpTick && dlg.current && !dlg.current.open) dlg.current.showModal(); }, [otpTick]);

  const onPhone = async () => {
    const v = Phone.validate(phoneIn); if (!v.ok) return setErr(v.msg);
    phone.current = v.phone; setBusy(true); setErr('');
    try {
      user.current = await App.findUserByPhone(phone.current);
      const u = user.current;
      if (u && u.is_blocked && !App.isAdminPhone(u.phone)) { setErr('আপনার অ্যাকাউন্ট ব্লক করা হয়েছে' + (u.blocked_reason ? ': ' + u.blocked_reason : '') + '। অ্যাডমিনের সাথে যোগাযোগ করুন।'); return; }
      if (u) afterUserKnown(u); else await startOtp();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const onResend = async () => { setBusy(true); try { await startOtp(); } catch (e) { setErr(e.message); } finally { setBusy(false); } };

  const onOtp = async () => {
    const c = otp.trim(); if (c.length !== 6) return setErr('৬ ডিজিটের কোড দিন');
    setBusy(true); setErr('');
    try {
      if (!(await App.verifyOtp(phone.current, c))) return setErr('দয়া করে সঠিক ওটিপি লিখুন');
      if (await App.findUserByDevice(App.deviceId())) return devStep('USED');
      pinStep('SETUP_NEW');
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const finish = (u) => { App.session.set(u); App.log('login', '', { id: u.id, name: u.full_name }).finally(() => go('task', true)); };

  const onPin = async () => {
    if (pin.length !== 4) return setErr('৪ ডিজিটের PIN দিন');
    if (mode !== 'LOGIN' && pin !== pin2) return setErr('দুটি PIN মিলছে না');
    setBusy(true); setErr(''); const dev = App.deviceId(); const u = user.current;
    try {
      if (mode === 'LOGIN') {
        if (!(await App.verifyPin(u, pin))) { setPin(''); return setErr('PIN সঠিক নয়'); }
        if (App.deviceEmpty(u.device_id)) {
          if (await App.findUserByDevice(dev, u.id)) return devStep('USED');
          await App.sb.patch('app_users?id=eq.' + encodeURIComponent(u.id), { device_id: dev });
          u.device_id = dev;
        }
        finish(u);
      } else if (mode === 'SETUP_EXISTING') {
        if (await App.findUserByDevice(dev, u.id)) return devStep('USED');
        const salt = App.newSalt(), hash = await App.hashPin(pin, salt);
        await App.sb.patch('app_users?id=eq.' + encodeURIComponent(u.id), { password_salt: salt, password_hash: hash, device_id: dev });
        u.device_id = dev; finish(u);
      } else {
        sessionStorage.setItem('kp_signup', JSON.stringify({ phone: phone.current, pin }));
        go('signup');
      }
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const onRetry = async () => {
    setBusy(true); setErr('');
    try {
      if (blockReason === 'BOUND') {
        const u = (user.current = await App.findUserByPhone(phone.current)); if (!u) return setErr('একাউন্ট খুঁজে পাওয়া যায়নি');
        if (u.is_blocked && !App.isAdminPhone(u.phone)) return setErr('আপনার অ্যাকাউন্ট ব্লক করা হয়েছে');
        const st = u.device_id, dev = App.deviceId();
        if (App.deviceEmpty(st) || st === dev) { toast('ডিভাইস মিলেছে, এখন লগইন করুন'); pinStep(App.hasPin(u) ? 'LOGIN' : 'SETUP_EXISTING'); }
        else setErr('এখনো অ্যাডমিন ডিভাইস রিসেট করেননি, একটু পর আবার চেষ্টা করুন');
      } else if (await App.findUserByDevice(App.deviceId())) setErr('এই ডিভাইসে এখনো অন্য একাউন্ট বাঁধা আছে');
      else { toast('ডিভাইস এখন খালি আছে'); if (user.current) pinStep(App.hasPin(user.current) ? 'LOGIN' : 'SETUP_EXISTING'); else pinStep('SETUP_NEW'); }
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const onChange = () => {
    clearInterval(timer.current); phone.current = ''; user.current = null; setPhoneIn(''); show('phone');
  };

  const enter = (fn) => (e) => { if (e.key === 'Enter') fn(); };
  const setup = mode !== 'LOGIN';
  const pinLabel = mode === 'LOGIN' ? '৪ ডিজিটের PIN দিন' : mode === 'SETUP_EXISTING' ? 'আপনার অ্যাকাউন্টের জন্য নতুন ৪ ডিজিটের PIN সেট করুন' : 'আপনার নতুন একাউন্টের জন্য ৪ ডিজিটের PIN সেট করুন';
  const pinBtn = mode === 'LOGIN' ? 'লগইন করুন' : mode === 'SETUP_EXISTING' ? 'PIN সেট করুন' : 'পরবর্তী ধাপ';
  const devMsg = blockReason === 'BOUND'
    ? 'এই একাউন্টটি অন্য একটি ডিভাইসে যুক্ত আছে। অ্যাডমিন ডিভাইস রিসেট করে দিলে নিচের \u2018আবার চেষ্টা করুন\u2019 বাটনে চাপ দিন।'
    : 'এই মোবাইলে ইতিমধ্যে অন্য একটি একাউন্ট ব্যবহার করা হচ্ছে। একটি ডিভাইসে একটি মাত্র একাউন্ট চালানো যায়।';

  return (
    <PageShell title="লগইন - কিতাব প্রুফিং" themeColor="#0b5f4c" viewport="width=device-width, initial-scale=1, viewport-fit=cover">
      <div className="wrap">
        <div className="brand"><Logo /><h1>কিতাব প্রুফিং</h1><p id="sub">মোবাইল নাম্বার দিয়ে লগইন করুন</p></div>
        <div className="card">
          {/* STEP: phone */}
          <section id="sPhone" hidden={step !== 'phone'}>
            <label className="f" htmlFor="phone">ফোন নাম্বার</label>
            <input id="phone" ref={refs.phone} type="tel" inputMode="tel" autoComplete="tel" placeholder="017XXXXXXXX" maxLength={18}
              value={phoneIn} onChange={(e) => setPhoneIn(e.target.value)} onKeyDown={enter(onPhone)} />
            <button id="bPhone" className="primary block" style={{ marginTop: '16px' }} disabled={busy} onClick={onPhone}>পরবর্তী</button>
          </section>
          {/* STEP: otp */}
          <section id="sOtp" hidden={step !== 'otp'}>
            <label className="f" htmlFor="otp">৬ ডিজিটের OTP কোড দিন</label>
            <input id="otp" ref={refs.otp} className="pin" type="text" inputMode="numeric" maxLength={6} autoComplete="one-time-code" placeholder="------"
              value={otp} onChange={(e) => setOtp(digitsOnly(e.target.value))} onKeyDown={enter(onOtp)} />
            <button id="bOtp" className="primary block" style={{ marginTop: '16px' }} disabled={busy} onClick={onOtp}>ভেরিফাই করুন</button>
            <button id="bResend" className="link" disabled={left > 0} onClick={onResend}>
              {left > 0 ? 'OTP আবার পাঠান (' + mmss(left) + ')' : 'OTP আবার পাঠান'}
            </button>
          </section>
          {/* STEP: pin */}
          <section id="sPin" hidden={step !== 'pin'}>
            <label className="f" id="pinLbl" htmlFor="pin">{pinLabel}</label>
            <input id="pin" ref={refs.pin} className="pin" type="password" inputMode="numeric" maxLength={4} autoComplete="off" placeholder="----"
              value={pin} onChange={(e) => setPin(digitsOnly(e.target.value))} onKeyDown={enter(onPin)} />
            <div id="pin2Box" hidden={!setup}>
              <label className="f" htmlFor="pin2">PIN আবার দিন</label>
              <input id="pin2" className="pin" type="password" inputMode="numeric" maxLength={4} autoComplete="off" placeholder="----"
                value={pin2} onChange={(e) => setPin2(digitsOnly(e.target.value))} onKeyDown={enter(onPin)} />
            </div>
            <button id="bPin" className="primary block" style={{ marginTop: '16px' }} disabled={busy} onClick={onPin}>{pinBtn}</button>
            <button id="bForgot" className="link" hidden={setup}
              onClick={() => wa('আসসালামু আলাইকুম, আমি কিতাব প্রুফিং অ্যাপে আমার PIN ভুলে গিয়েছি। আমার ফোন নাম্বার: ' + phone.current + '। দয়া করে সাহায্য করুন।')}>
              PIN ভুলে গেছেন? অ্যাডমিনকে WhatsApp করুন
            </button>
          </section>
          {/* STEP: device blocked */}
          <section id="sDev" hidden={step !== 'dev'}>
            <p id="devMsg" style={{ lineHeight: 1.7, margin: 0, textAlign: 'center' }}>{devMsg}</p>
            <button id="bRetry" className="block" style={{ marginTop: '16px' }} disabled={busy} onClick={onRetry}>আবার চেষ্টা করুন</button>
            <button id="bDevWa" className="primary block" style={{ marginTop: '10px' }} disabled={busy}
              onClick={() => wa('আসসালামু আলাইকুম, আমি কিতাব প্রুফিং অ্যাপে অন্য একটি ডিভাইস ব্যবহার করতে চাই। আমার ফোন নাম্বার: ' + phone.current + '। দয়া করে আমার একাউন্টের ডিভাইস রিসেট করে দিন।')}>
              অ্যাডমিনকে WhatsApp এ জানান
            </button>
          </section>
          <div className={'spin' + (busy ? ' on' : '')} id="spin"></div>
          <div className="err" id="err">{err}</div>
          <button id="bChange" className="link mut" hidden={step === 'phone'} onClick={onChange}>অন্য নাম্বার ব্যবহার করবেন?</button>
        </div>
        <p className="hint" style={{ textAlign: 'center', marginTop: '16px' }}>নতুন ইউজার? OTP ভেরিফাই করার পর প্রোফাইল তৈরি করুন</p>
      </div>

      <dialog id="otpDlg" ref={dlg}>
        <h3>আপনার OTP কোড</h3>
        <div id="otpShow" className="pin" style={{ fontSize: '32px', color: 'var(--pri)', margin: '14px 0 6px' }}>{otpCode}</div>
        <p className="hint" style={{ textAlign: 'center', margin: 0 }}>২ মিনিটের মধ্যে কোডটি লিখুন</p>
        <div className="acts"><button className="primary" id="otpOk" onClick={() => dlg.current.close()}>ঠিক আছে</button></div>
      </dialog>
    </PageShell>
  );
}
