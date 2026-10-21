/* profile.html → রিয়্যাক্ট (state/hooks)। প্রোফাইল, সম্পন্ন টাস্ক, আয়, কিতাব-ভিত্তিক অগ্রগতি, পেমেন্ট নাম্বার পরিবর্তন,
   নোটিশ/ঘোষণা ডায়ালগ, থিম, হোম স্ক্রিনে ইনস্টল (PWA), সাপোর্ট বোতাম — সব আগের মতো। */
import { useCallback, useEffect, useRef, useState } from 'react';
import PageShell from '../lib/PageShell.jsx';
import Icon, { Logo } from '../components/Icon.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import App from '../lib/common.js';
import { go } from '../lib/nav.js';
import css from './Profile.css?inline';

const { Phone, toast, bn, money, fmtDT, enc } = App;
const PM = { bkash: 'বিকাশ', nagad: 'নগদ' };
const KIND = { notice: 'ঘোষণা', review: 'রিভিউ', payment: 'পেমেন্ট' };

function ProgLine({ book, done }) {
  const total = Number(book && book.total_pages) || 0;
  if (total > 0) {
    const pct = Math.min(100, (done / total) * 100), left = Math.max(0, total - done);
    return (<>
      <div className="pg"><i style={{ width: pct + '%' }}></i></div>
      <div className="pgt"><span>সম্পন্ন {bn(done)} / {bn(total)} ({bn(Math.round(pct))}%)</span><span>বাকি {bn(left)}</span></div>
    </>);
  }
  return <div className="pgt"><span>মোট সম্পন্ন {bn(done)} পেইজ</span></div>;
}

export default function Profile() {
  const [me, setMe] = useState(null);
  const meRef = useRef(null);
  const [theme, setTheme] = useState(App.theme.get());
  const [myCount, setMyCount] = useState(null);
  const [sum, setSum] = useState(null);
  const [booksById, setBooksById] = useState({});
  const [bookCounts, setBookCounts] = useState({});
  const [installState, setInstallState] = useState('hidden');   // hidden | show
  const [installHint, setInstallHint] = useState('');
  const [allNotices, setAllNotices] = useState([]);
  const [badge, setBadge] = useState(0);
  const [nList, setNList] = useState([]);
  const [nIdx, setNIdx] = useState(0);
  const [edit, setEdit] = useState({ pm: 'bkash', num: '', err: '' });

  const books = useRef([]);
  const nMark = useRef(true);
  const busy = useRef({ cnt: false, money: false });
  const dlg = useRef(null), nDlg = useRef(null), nav = useRef(null);
  const nListRef = useRef([]); nListRef.current = nList;

  const isAdmin = !!me && App.isAdminPhone(me.phone);

  /* ---------- নোটিশ: দেখা-সেট (localStorage) ---------- */
  const NK = () => 'kp_notice_seen_' + meRef.current.id;
  const seenSet = () => { try { return new Set(JSON.parse(localStorage.getItem(NK()) || '[]').map(String)); } catch (e) { return new Set(); } };
  const saveSeen = (s) => { try { localStorage.setItem(NK(), JSON.stringify([...s].slice(-300))); } catch (e) { /* ignore */ } };
  const unseenCount = (list) => { const s = seenSet(); return list.filter((n) => !s.has(String(n.id))).length; };

  const loadNotices = useCallback(async () => {
    const u = meRef.current; if (!u) return [];
    try {
      const list = await App.sb.get('notices?or=' + enc('(user_id.is.null,user_id.eq.' + u.id + ')') + '&order=created_at.desc&limit=40');
      setAllNotices(list);
      const seen = seenSet(), joined = u.created_at ? new Date(u.created_at).getTime() - 86400000 : 0;
      setBadge(list.filter((n) => !seen.has(String(n.id)) && new Date(n.created_at).getTime() >= joined).length);
      return list;
    } catch (e) { return []; /* notices টেবিল নেই */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- সম্পন্ন টাস্কের সংখ্যা ---------- */
  const loadCount = useCallback(async () => {
    const u = meRef.current; if (!u || busy.current.cnt) return; busy.current.cnt = true;
    try {
      let n;
      try { // দ্রুত পথ: Supabase ফাংশন (supabase_task_count.sql)
        n = await App.sb.post('rpc/my_proof_count', { p_user: String(u.id) });
        n = Number(Array.isArray(n) ? n[0] : n); if (!Number.isFinite(n)) throw new Error('bad');
      } catch (e) { // ফাংশন না থাকলে সরাসরি গুনে নিন
        n = 0;
        for (let off = 0; ; off += 1000) {
          const r = await App.sb.get('page_proofs?user_id=eq.' + enc(u.id) + '&select=stem&order=stem.asc&limit=1000&offset=' + off);
          n += r.length; if (r.length < 1000) break;
        }
      }
      setMyCount(n);
    } catch (e) { /* টেবিল নেই/নেটওয়ার্ক সমস্যা: আগের সংখ্যাই থাকুক */ }
    finally { busy.current.cnt = false; }
  }, []);

  /* ---------- আয়ের হিসাব ---------- */
  const loadMoney = useCallback(async () => {
    const u = meRef.current; if (!u || busy.current.money) return; busy.current.money = true;
    try {
      let S = {};
      try { S = (await App.sb.get('app_settings?id=eq.1&select=page_rate,min_payout,warn_pct,warn_min&limit=1'))[0] || {}; } catch (e) { /* ignore */ }
      if (!books.current.length) {
        try { books.current = await App.sb.get('books?select=*&order=created_at.desc'); setBooksById(Object.fromEntries(books.current.map((b) => [String(b.id), b]))); } catch (e) { /* ignore */ }
      }
      let proofs;
      try { proofs = await App.getAll('page_proofs?user_id=eq.' + enc(u.id) + '&select=book_id,stem,review_status,review_note,rate,created_at,reviewed_at&order=created_at.desc,book_id.asc,stem.asc'); }
      catch (e) { proofs = await App.getAll('page_proofs?user_id=eq.' + enc(u.id) + '&select=book_id,stem&order=book_id.asc,stem.asc'); }
      let pays = [];
      try { pays = await App.getAll('payments?user_id=eq.' + enc(u.id) + '&order=created_at.desc'); } catch (e) { pays = []; }
      const byId = Object.fromEntries(books.current.map((b) => [String(b.id), b]));
      setSum(App.summarize(proofs, byId, S, pays));
    } catch (e) { /* নেটওয়ার্ক/টেবিল সমস্যা: আগের তথ্য থাকুক */ }
    finally { busy.current.money = false; }
  }, []);

  const loadCounts = useCallback(async () => {
    try {
      let rows;
      try { rows = await App.sb.post('rpc/book_proof_counts', {}); if (!Array.isArray(rows)) throw new Error('bad'); }
      catch (e) {
        const all = await App.getAll('page_proofs?select=book_id,stem&order=book_id.asc,stem.asc'); const m = {};
        all.forEach((r) => { m[r.book_id] = (m[r.book_id] || 0) + 1; }); rows = Object.entries(m).map(([book_id, n]) => ({ book_id, n }));
      }
      const c = {}; rows.forEach((r) => { c[String(r.book_id)] = Number(r.n) || 0; }); setBookCounts(c);
    } catch (e) { /* টেবিল নেই: বার ছাড়াই চলবে */ }
  }, []);

  const refreshAll = useCallback(() => { loadCount(); loadCounts(); loadMoney(); loadNotices(); }, [loadCount, loadCounts, loadMoney, loadNotices]);
  const refreshRef = useRef(refreshAll); refreshRef.current = refreshAll;

  /* ---------- শুরু: লগইন যাচাই, প্রাথমিক লোড, লিসেনার ---------- */
  useEffect(() => {
    let dead = false;
    App.requireAuth().then((u) => {
      if (dead) return;
      meRef.current = u; setMe(u);
      loadCount(); loadMoney(); loadCounts(); loadNotices();
    });
    const onShow = (e) => { if (e.persisted && meRef.current) refreshRef.current(); };
    const onVis = () => { if (document.visibilityState === 'visible' && meRef.current) refreshRef.current(); };
    const onRetry = (e) => { e.preventDefault(); window.location.reload(); };
    window.addEventListener('pageshow', onShow);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('kp-retry', onRetry);
    const iv = setInterval(() => { if (document.visibilityState === 'visible' && meRef.current) loadNotices(); }, 180000);
    return () => { dead = true; window.removeEventListener('pageshow', onShow); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('kp-retry', onRetry); clearInterval(iv); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- ইনস্টল বোতাম (PWA) ---------- */
  useEffect(() => {
    const paint = () => {
      if (App.Install.standalone()) { setInstallState('hidden'); setInstallHint(''); return; }
      setInstallState(App.Install.can() || App.Install.ios() ? 'show' : 'hidden'); setInstallHint('');
    };
    paint();
    window.addEventListener('kp-installable', paint); window.addEventListener('kp-installed', paint);
    return () => { window.removeEventListener('kp-installable', paint); window.removeEventListener('kp-installed', paint); };
  }, []);
  const onInstall = async () => {
    if (App.Install.can()) {
      const r = await App.Install.prompt(); if (r === 'accepted') toast('অ্যাপ ইনস্টল হচ্ছে…');
      setInstallState(App.Install.can() || App.Install.ios() ? 'show' : 'hidden'); return;
    }
    if (App.Install.ios()) { setInstallHint('Safari-তে নিচের শেয়ার (⬆) বাটনে চাপ দিয়ে "Add to Home Screen" বেছে নিন।'); return; }
    toast('এই ব্রাউজারে ইনস্টল সমর্থিত নয় — ব্রাউজারের মেনু থেকে "Add to Home screen" দিন', true);
  };

  /* ---------- নিচের নেভিগেশন বার: ব্রাউজার টুলবার/স্ক্রল বদলালেও স্ক্রিনের ভিতরে ---------- */
  useEffect(() => {
    const el = nav.current; if (!el) return undefined; let raf = 0;
    const fix = () => {
      raf = 0; if (el.hidden) return; el.style.transform = '';
      const vv = window.visualViewport, r = el.getBoundingClientRect();
      const vh = vv ? vv.height + vv.offsetTop : window.innerHeight;
      const lim = Math.min(vh, window.innerHeight || vh);
      if (r.bottom > lim + 0.5) el.style.transform = 'translateY(' + (lim - r.bottom) + 'px)';
    };
    const sched = () => { if (!raf) raf = requestAnimationFrame(fix); };
    const vv = window.visualViewport;
    window.addEventListener('scroll', sched, { passive: true });
    window.addEventListener('resize', sched); window.addEventListener('orientationchange', sched); window.addEventListener('pageshow', sched);
    if (vv) { vv.addEventListener('resize', sched); vv.addEventListener('scroll', sched); }
    document.addEventListener('visibilitychange', sched);
    sched(); const t = setTimeout(sched, 300);
    return () => {
      clearTimeout(t); cancelAnimationFrame(raf);
      window.removeEventListener('scroll', sched); window.removeEventListener('resize', sched);
      window.removeEventListener('orientationchange', sched); window.removeEventListener('pageshow', sched);
      if (vv) { vv.removeEventListener('resize', sched); vv.removeEventListener('scroll', sched); }
      document.removeEventListener('visibilitychange', sched);
    };
  }, []);

  /* ---------- অ্যাকশন ---------- */
  const logout = () => { App.log('logout', ''); setTimeout(() => App.logout(), 150); };
  const whatsapp = () => {
    const m = 'আসসালামু আলাইকুম, আমি কিতাব প্রুফিং অ্যাপের ইউজার। নাম: ' + ((me && me.full_name) || '-') + '। ফোন নাম্বার: ' + ((me && me.phone) || '-') + '। আমার একটি সাহায্য প্রয়োজন।';
    window.open('https://wa.me/' + App.ADMIN_WA + '?text=' + encodeURIComponent(m), '_blank', 'noopener');
  };
  const pickTheme = (t) => { App.theme.set(t); setTheme(t); toast('থিম: ' + App.theme.label()); };

  const openEdit = () => {
    setEdit({ pm: me.payment_method || 'bkash', num: me.payment_number || '', err: '' });
    dlg.current.showModal();
  };
  const saveEdit = async () => {
    const v = Phone.validate(edit.num); if (!v.ok) { setEdit((e) => ({ ...e, err: v.msg })); return; }
    const m = edit.pm;
    try {
      const r = await App.sb.patch('app_users?id=eq.' + encodeURIComponent(me.id), { payment_method: m, payment_number: v.phone });
      const nu = r[0] || { ...me, payment_method: m, payment_number: v.phone };
      meRef.current = nu; setMe(nu); dlg.current.close(); toast('সংরক্ষিত হয়েছে');
      App.log('payment_number_changed', (PM[m] || m) + ' ' + v.phone);
    } catch (e) { setEdit((x) => ({ ...x, err: e.message })); }
  };

  /* ---------- নোটিশ ডায়ালগ ---------- */
  const openNotices = (list, mark) => { setNList(list); setNIdx(0); nMark.current = mark; if (!nDlg.current.open) nDlg.current.showModal(); };
  const onNoticesBtn = async () => {
    const list = await loadNotices();
    if (!list.length) { toast('এখনো কোনো নোটিশ নেই'); return; }
    if (!nDlg.current.open) openNotices(list.slice(), false);
  };
  const onNoticeClose = () => { const s = seenSet(); nListRef.current.forEach((n) => s.add(String(n.id))); saveSeen(s); setBadge(unseenCount(allNotices)); };
  const cur = nList[nIdx];
  const last = nIdx >= nList.length - 1;

  const cntText = myCount == null ? '–' : bn(myCount);
  const ids = sum ? Object.keys(sum.byBook) : [];

  return (
    <PageShell title="প্রোফাইল - কিতাব প্রুফিং" themeColor="#0b5f4c"
      viewport="width=device-width, initial-scale=1, minimum-scale=1, viewport-fit=cover" css={css}>
      <header className="top">
        <Logo className="logo-sm" as="span" />
        <h2 id="ttl">প্রোফাইল</h2>
        <span id="myCnt" className="cnt" hidden={myCount == null} title="আপনার সম্পন্ন টাস্ক"><span><Icon name="check" /></span><b id="cntN">{cntText}</b><small>টি সম্পন্ন</small></span>
        {' '}<ThemeToggle id="bTheme" mode={theme} onChange={setTheme} />
        {' '}<button id="bAdmin" className="sm" hidden={!isAdmin} onClick={() => go('admin')}><span><Icon name="shield" /></span>অ্যাডমিন</button>
        {' '}<button id="bOut" className="sm" hidden={!isAdmin} title="লগআউট" onClick={logout}><span><Icon name="logout" /></span><span className="lbl">লগআউট</span></button>
      </header>

      <main className="wrap wide" style={{ paddingBottom: '90px' }}>
        {/* PROFILE */}
        <section id="pProf" style={{ maxWidth: '440px', margin: '0 auto' }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="av" id="av">{me ? (me.full_name || '?').trim().charAt(0).toUpperCase() : ''}</div>
            <h3 id="pName" style={{ margin: '0 0 4px' }}>{me ? me.full_name : ''}</h3>
            <span className="badge" id="pRole">{isAdmin ? 'অ্যাডমিন' : 'ইউজার'}</span>
            <div className="stat">
              <span className="stI"><Icon name="check" /></span>
              <div className="stT"><span className="stN" id="stN">{myCount == null && !me ? '০' : cntText}</span><span className="stL"> টি টাস্ক সম্পন্ন</span></div>
            </div>
            <div className="stat" style={{ marginTop: '10px' }} id="incCard">
              <span className="stI"><Icon name="wallet" /></span>
              <div className="stT"><span className="stN" id="incN">{sum ? money(sum.earned) : '০.০০ ৳'}</span><span className="stL"> মোট আয়</span>
                <div className="sub" id="incSub" style={{ marginTop: '2px' }}>{sum ? 'উত্তোলনযোগ্য ' + money(sum.available) + (sum.pendingAmt > 0 ? ' • রিভিউ বাকি ' + money(sum.pendingAmt) : '') : ''}</div></div>
            </div>
            <div style={{ textAlign: 'left', marginTop: '16px' }}>
              <div className="kv"><span>মোবাইল নাম্বার</span><b id="pPhone">{me ? me.phone : ''}</b></div>
              <div className="kv"><span id="pPmL">{me ? (PM[me.payment_method] || 'পেমেন্ট') + ' নাম্বার' : 'বিকাশ নাম্বার'}</span><b id="pPm">{me ? me.payment_number || '-' : ''}</b></div>
              <div className="kv"><span>যোগ দিয়েছেন</span><b id="pDate">{me ? (me.created_at ? new Date(me.created_at).toLocaleDateString('bn-BD') : '-') : ''}</b></div>
            </div>
            <div style={{ textAlign: 'left', marginTop: '16px' }} id="profProg">
              {ids.length > 0 && (<>
                <b style={{ display: 'block', marginBottom: '8px' }}>আমার কাজ — কিতাব অনুযায়ী</b>
                {ids.map((id) => {
                  const b = booksById[id], x = sum.byBook[id];
                  return (
                    <div key={id} style={{ marginBottom: '12px' }}>
                      <div className="row" style={{ justifyContent: 'space-between' }}><span><b>{b ? b.name : 'কিতাব'}</b></span><span className="sub">আমার {bn(x.n)} পেইজ</span></div>
                      <ProgLine book={b} done={bookCounts[id] != null ? bookCounts[id] : x.n} />
                    </div>
                  );
                })}
              </>)}
            </div>
            <label className="f" style={{ textAlign: 'left' }}>থিম (দিন/রাত)</label>
            <div className="seg" id="themeSeg">
              {['auto', 'light', 'dark'].map((v, i) => (
                <label key={v}><input type="radio" name="th" value={v} checked={theme === v} onChange={() => pickTheme(v)} /><span>{['সিস্টেম', 'লাইট', 'ডার্ক'][i]}</span></label>
              ))}
            </div>
            <button id="bEdit" className="block" style={{ marginTop: '16px' }} onClick={openEdit}><span><Icon name="edit" /></span>পেমেন্ট নাম্বার পরিবর্তন</button>
            <button id="bOut2" className="danger block" style={{ marginTop: '10px' }} onClick={logout}><span><Icon name="logout" /></span>লগআউট</button>
            <button id="bNotices" className="help block" style={{ marginTop: '10px' }} onClick={onNoticesBtn}><Icon name="bell" />নোটিশ ও ঘোষণা{badge ? <> <span className="tbadge">{bn(badge)}</span></> : null}</button>
            <button id="bGuide" className="help block" style={{ marginTop: '10px' }} onClick={() => go('task#guide')}><span><Icon name="info" /></span>ব্যবহারের গাইড</button>
            <button id="bInstall" className="help block" style={{ marginTop: '10px' }} hidden={installState === 'hidden'} onClick={onInstall}><span><Icon name="download" /></span>হোম স্ক্রিনে ইনস্টল করুন</button>
            <p className="hint" id="installHint" style={{ margin: '6px 0 0', textAlign: 'left' }} hidden={!installHint}>{installHint}</p>
            <button id="bTicket" className="help block" style={{ marginTop: '10px' }} onClick={() => go('support')}><span><Icon name="ticket" /></span>টিকেট খুলুন</button>
            <button id="bWa" className="help wa block" style={{ marginTop: '10px' }} onClick={whatsapp}><span><Icon name="whatsapp" /></span>হোয়াটসঅ্যাপে যোগাযোগ করুন</button>
          </div>
        </section>
      </main>

      {/* নিচের নেভিগেশন: টাস্ক / পেমেন্ট / র‍্যাংক (প্রোফাইল এখন উপরের টুলবারে) */}
      <nav className="bottom" id="nav" ref={nav}>
        <button id="nTask" onClick={() => go('task#task')}><span><Icon name="tasks" cls="lg" /></span>টাস্ক</button>
        <button id="nPay" onClick={() => go('task#pay')}><span><Icon name="wallet" cls="lg" /></span>পেমেন্ট</button>
        <button id="nRank" onClick={() => go('task#rank')}><span><Icon name="trophy" cls="lg" /></span>র‍্যাংক</button>
      </nav>

      <dialog id="dlg" ref={dlg}>
        <h3>পেমেন্ট নাম্বার</h3>
        <label className="f">মাধ্যম</label>
        <div className="seg">
          <label><input type="radio" name="pm" value="bkash" checked={edit.pm === 'bkash'} onChange={() => setEdit((e) => ({ ...e, pm: 'bkash' }))} /><span>বিকাশ</span></label>
          <label><input type="radio" name="pm" value="nagad" checked={edit.pm === 'nagad'} onChange={() => setEdit((e) => ({ ...e, pm: 'nagad' }))} /><span>নগদ</span></label>
        </div>
        <label className="f" htmlFor="pn">নাম্বার</label>
        <input id="pn" type="tel" inputMode="tel" maxLength={18} value={edit.num} onChange={(e) => setEdit((x) => ({ ...x, num: e.target.value }))} />
        <div className="err" id="dErr">{edit.err}</div>
        <div className="acts"><button id="dCancel" onClick={() => dlg.current.close()}>বন্ধ</button><button id="dSave" className="primary" onClick={saveEdit}>সংরক্ষণ</button></div>
      </dialog>

      {/* নোটিশ / ঘোষণা (কাস্টম ডায়ালগ) */}
      <dialog id="nDlg" className="big" ref={nDlg} onClose={onNoticeClose}>
        <div className="row"><span className="badge gold" id="nKind">{cur ? KIND[cur.kind] || 'নোটিশ' : 'নোটিশ'}</span><span className="sub" id="nDate" style={{ marginLeft: 'auto' }}>{cur ? fmtDT(cur.created_at) : ''}</span></div>
        <h3 id="nTitle" style={{ marginTop: '8px' }}>{cur ? cur.title || '' : ''}</h3>
        <div className="nbody" id="nBody">{cur ? cur.body || '' : ''}</div>
        <div className="dots" id="nDots">{nList.length > 1 ? nList.map((_, i) => <i key={i} className={i === nIdx ? 'on' : ''}></i>) : null}</div>
        <div className="acts">
          <button id="nPrev" hidden={nIdx === 0} onClick={() => setNIdx((i) => Math.max(0, i - 1))}>আগের</button>
          <button id="nNext" hidden={last} onClick={() => setNIdx((i) => Math.min(nList.length - 1, i + 1))}>পরের</button>
          <button id="nOk" className="primary" onClick={() => nDlg.current.close()}>{last ? 'ঠিক আছে' : 'বন্ধ করুন'}</button>
        </div>
      </dialog>
    </PageShell>
  );
}
