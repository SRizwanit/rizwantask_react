/* ড্যাশবোর্ড: সারাংশ টাইল, লিডারবোর্ড, ইউজারভিত্তিক সংশোধনের হার (+ এক ক্লিকে অনুমোদন), সক্রিয়তার রিপোর্ট */
import { useEffect, useMemo, useState } from 'react';
import App from '../../lib/common.js';
import { Chips, Empty, Ic, SegBar, Tile } from './ui.jsx';
import { bodyFor, D7, rvKey, status, T0, tm, warnLimits } from './helpers.js';

const { bn, money, fmtDT, toast, enc } = App;

export default function DashTab({ d, openKey, onReviewUser }) {
  const { users, S, proofs, pays, pst, booksMap, lastActive, uname } = d;
  const [loading, setLoading] = useState(true), [at, setAt] = useState(null);
  const [dP, setDP] = useState('day'), [rF, setRF] = useState('all'), [crF, setCrF] = useState('all');
  const [busyUid, setBusyUid] = useState('');

  const load = async () => {
    setLoading(true);
    await d.loadUsers();
    await Promise.all([d.loadProofs(true), d.loadPaysQuiet()]);
    setLoading(false); setAt(Date.now());
  };
  useEffect(() => { load(); }, [openKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const non = useMemo(() => users.filter((u) => !App.isAdminPhone(u.phone)), [users]);

  /* সারাংশ টাইল */
  const tiles = useMemo(() => {
    const ids = new Set(non.map((u) => String(u.id))), t0 = T0(), w0 = D7(), a1 = new Set(), a7 = new Set();
    non.forEach((u) => { const t = tm(u.last_active_at); if (t >= t0) a1.add(String(u.id)); if (t >= w0) a7.add(String(u.id)); });
    let today = 0;
    proofs.forEach((p) => { const t = tm(p.created_at), k = String(p.user_id); if (t >= t0) { today++; if (ids.has(k)) a1.add(k); } if (t >= w0 && ids.has(k)) a7.add(k); });
    const pend = proofs.filter((p) => status(p) === 'pending').length;
    const rq = pays.filter((x) => x.status === 'requested'), rqAmt = rq.reduce((s, x) => s + Number(x.amount || 0), 0);
    return [
      [bn(non.length), 'মোট ইউজার', 1], [bn(today), 'আজকের প্রুফড পেইজ', 1], [bn(a1.size), 'আজ সক্রিয় ইউজার', 1], [bn(a7.size), '৭ দিনে সক্রিয়'],
      [bn(proofs.length), 'মোট প্রুফড পেইজ'], [bn(pend), 'রিভিউ বাকি'], [bn(rq.length) + ' (' + money(rqAmt) + ')', 'পেমেন্ট রিকোয়েস্ট'], [bn(users.filter((u) => u.is_blocked).length), 'ব্লকড ইউজার']
    ];
  }, [non, users, proofs, pays]);

  /* লিডারবোর্ড (সংশোধন-দরকার পেইজ বাদে) */
  const lb = useMemo(() => {
    const since = dP === 'day' ? T0() : dP === 'week' ? D7() : 0, m = {};
    proofs.forEach((p) => { if (p.review_status === 'correction') return; if (since && tm(p.created_at) < since) return; m[p.user_id] = (m[p.user_id] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 15);
  }, [proofs, dP]);

  /* সক্রিয়তার রিপোর্ট */
  const activity = useMemo(() => {
    const w0 = D7();
    let list = non.map((u) => {
      const x = pst[String(u.id)] || { n: 0, today: 0, w7: 0, list: [] }, sm = App.summarize(x.list, booksMap, S, []), la = lastActive(u);
      return { u, n: x.n, today: x.today, w7: x.w7, la, ap: sm.approved, co: sm.correction, act: x.w7 > 0 || tm(u.last_active_at) >= w0 };
    });
    if (rF === 'act') list = list.filter((r) => r.act); else if (rF === 'idle') list = list.filter((r) => !r.act);
    return list.sort((a, b) => b.w7 - a.w7 || b.n - a.n || b.la - a.la);
  }, [non, pst, booksMap, S, rF, lastActive]);

  /* ইউজারভিত্তিক সংশোধনের হার */
  const { wp, wm } = warnLimits(S);
  const high = (r) => r.pc != null && r.rv >= wm && r.pc >= wp;
  const corr = useMemo(() => {
    let rows = non.map((u) => {
      const list = (pst[String(u.id)] || {}).list || [];
      let ap = 0, co = 0, pe = 0; list.forEach((p) => { const s = status(p); if (s === 'approved') ap++; else if (s === 'correction') co++; else pe++; });
      const rv = ap + co; return { u, ap, co, pe, rv, pc: rv ? Math.round(co / rv * 100) : null, tot: ap + co + pe };
    }).filter((r) => r.tot > 0);
    if (crF === 'high') rows = rows.filter(high); else if (crF === 'pend') rows = rows.filter((r) => r.pe > 0);
    return rows.sort((x, y) => (y.pc == null ? -1 : y.pc) - (x.pc == null ? -1 : x.pc) || y.co - x.co || y.tot - x.tot);
  }, [non, pst, crF, wp, wm]); // eslint-disable-line react-hooks/exhaustive-deps

  /* এক ক্লিকে ইউজারের সব রিভিউ-বাকি পেইজ অনুমোদন */
  async function approveUserAll(uid) {
    const fresh = await d.loadProofs(true);
    const m = fresh.filter((p) => String(p.user_id) === String(uid) && status(p) === 'pending');
    if (!m.length) { toast('এই ইউজারের রিভিউ-বাকি পেইজ নেই'); return; }
    if (!window.confirm(uname(uid) + '-এর রিভিউ বাকি সব ' + bn(m.length) + 'টি পেইজ একসাথে অনুমোদন করবেন?')) return;
    const S0 = d.refs.S.current;
    for (const bid of [...new Set(m.map((p) => String(p.book_id)))]) {
      await App.sb.patchMin('page_proofs?book_id=eq.' + enc(bid) + '&user_id=eq.' + enc(uid) + '&review_status=eq.pending', bodyFor(S0, 'approved', '', booksMap[bid]));
    }
    d.applyStatus(new Set(m.map(rvKey)), 'approved');
    App.log('admin_approve', bn(m.length) + ' পেইজ (এক ক্লিকে) • ' + uname(uid));
    toast(bn(m.length) + 'টি পেইজ অনুমোদিত হয়েছে'); setAt(Date.now());
  }
  const onApprove = async (uid) => {
    setBusyUid(uid);
    try { await approveUserAll(uid); } catch (x) { toast(x.message, true); } finally { setBusyUid(''); }
  };

  return (
    <section id="pDash">
      <div className="row" style={{ marginBottom: '12px' }}>
        <b style={{ flex: '1' }}>ড্যাশবোর্ড</b>
        <span className="sub" id="dAt">{at ? 'হালনাগাদ: ' + fmtDT(at) : ''}</span>
        {' '}<button id="dReload" className="sm" title="রিফ্রেশ" onClick={load}><Ic n="refresh" /></button>
      </div>
      <div className="tiles" id="dTiles">
        {loading ? <div className="spin on" style={{ gridColumn: '1/-1' }}></div> : tiles.map(([n, l, hl]) => <Tile key={l} n={n} l={l} hl={hl} />)}
      </div>

      <div className="card" style={{ marginBottom: '14px' }}>
        <b>লিডারবোর্ড</b>
        <div style={{ marginTop: '10px' }}><Chips id="dChips" items={[['day', 'আজ'], ['week', 'এই সপ্তাহ'], ['all', 'সব সময়']]} value={dP} onPick={setDP} /></div>
        <div id="dLb">
          {lb.length ? lb.map(([id, n], i) => (
            <div key={id} className={'lbr ' + (i < 3 ? 'r' + (i + 1) : '')}><span className="rk">{bn(i + 1)}</span><span className="nm">{uname(id)}</span><span className="ct">{bn(n)} পেইজ</span></div>
          )) : <Empty pad>এই সময়ে কোনো প্রুফড পেইজ নেই</Empty>}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '14px' }}>
        <div className="row">
          <b style={{ flex: '1' }}>ইউজারভিত্তিক সংশোধনের হার</b>
          <span className="sub" id="crNote">{'সীমা: ' + bn(wp) + '% (কমপক্ষে ' + bn(wm) + 'টি রিভিউ)'}</span>
        </div>
        <p className="hint" style={{ margin: '4px 0 10px' }}>{'রিভিউ হওয়া পেইজের মধ্যে কতটি "সংশোধন দরকার" — বেশি ভুলের ইউজার উপরে। সবুজ = অনুমোদিত, লাল = সংশোধন, সোনালি = রিভিউ বাকি।'}</p>
        <Chips id="crChips" items={[['all', 'সবাই'], ['high', 'সীমার বেশি ভুল'], ['pend', 'রিভিউ বাকি আছে']]} value={crF} onPick={setCrF} />
        <div id="crList">
          {corr.length ? corr.slice(0, 40).map((r) => {
            const cls = r.pc == null ? '' : high(r) ? 'hi' : r.pc >= wp / 2 ? 'mid' : 'lo';
            return (
              <div className="crr" key={r.u.id}>
                <div className="crh"><span className="nm">{r.u.full_name}</span>{high(r) ? <span className="badge bad">সীমার বেশি</span> : null}<span className={'crp ' + cls}>{r.pc == null ? '–' : bn(r.pc) + '%'}</span></div>
                <SegBar a={r.ap} p={r.pe} c={r.co} tot={Math.max(r.tot, 1)} mt="6px" />
                <div className="crf"><span>অনুমোদিত {bn(r.ap)} • রিভিউ বাকি {bn(r.pe)} • সংশোধন {bn(r.co)}</span><span>মোট {bn(r.tot)} পেইজ</span></div>
                <div className="crb">
                  {r.pe ? <button className="sm ok" disabled={busyUid === String(r.u.id)} onClick={() => onApprove(String(r.u.id))}>এক ক্লিকে সব {bn(r.pe)}টি অনুমোদন</button> : null}
                  <button className="sm" onClick={() => onReviewUser(String(r.u.id))}>রিভিউ খুলুন</button>
                </div>
              </div>
            );
          }) : <Empty pad>এই ফিল্টারে কোনো ইউজার নেই</Empty>}
        </div>
      </div>

      <div className="card">
        <b>সক্রিয়তার রিপোর্ট</b>
        <div style={{ marginTop: '10px' }}><Chips id="rChips" items={[['all', 'সবাই'], ['act', 'সক্রিয় (৭ দিনে কাজ করেছে)'], ['idle', 'নিষ্ক্রিয়']]} value={rF} onPick={setRF} /></div>
        <div className="tbw">
          <table className="tb" id="rTbl">
            <thead><tr><th>ইউজার</th><th>আজ</th><th>৭ দিন</th><th>মোট</th><th>ভুলের হার</th><th>সর্বশেষ সক্রিয়</th><th></th></tr></thead>
            <tbody>
              {activity.length ? activity.map((r) => {
                const rv = r.ap + r.co, pc = rv ? Math.round(r.co / rv * 100) : null;
                return (
                  <tr key={r.u.id}>
                    <td><b>{r.u.full_name}</b><div className="sub">{r.u.phone}{r.u.is_blocked ? ' • ব্লকড' : ''}</div></td>
                    <td>{bn(r.today)}</td><td>{bn(r.w7)}</td><td>{bn(r.n)}</td><td>{pc == null ? '-' : bn(pc) + '%'}</td><td>{r.la ? fmtDT(r.la) : '-'}</td>
                    <td><span className={'badge ' + (r.act ? 'ok' : 'warn')}>{r.act ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</span></td>
                  </tr>
                );
              }) : <tr><td colSpan="7" className="sub" style={{ textAlign: 'center', padding: '18px' }}>কোনো ইউজার নেই</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
