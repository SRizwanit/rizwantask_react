/* রিভিউ: প্রুফড পেইজ অনুমোদন / "সংশোধন দরকার" চিহ্নিত করা (একটি, নির্বাচিত বা ফিল্টারের সব) + ভুল বেশি হলে ইউজারকে সতর্কবার্তা */
import { useEffect, useRef, useState } from 'react';
import App from '../../lib/common.js';
import { Empty, Ic } from './ui.jsx';
import { SQLHINT, STB, bodyFor, rvKey, sendNotice, status, tm, warnLimits } from './helpers.js';

const { bn, fmtDT, toast, enc } = App;
const PAGE = 100;

export default function ReviewTab({ d, openKey, filter, setFilter, ask }) {
  const { users, books, bname, uname } = d;
  const [rows, setRows] = useState([]), [more, setMore] = useState(false), [warn, setWarn] = useState('');
  const [sel, setSel] = useState(() => new Set());
  const [busyKey, setBusyKey] = useState(''), [okAllBusy, setOkAllBusy] = useState(false);
  const busy = useRef(false), off = useRef(0);
  const rowsRef = useRef([]), selRef = useRef(new Set());
  const put = (r) => { rowsRef.current = r; setRows(r); };
  const putSel = (s) => { selRef.current = s; setSel(s); };
  const f = useRef(filter); f.current = filter;

  async function load(reset) {
    if (busy.current) return; busy.current = true;
    if (reset) { put([]); off.current = 0; putSel(new Set()); }
    const { st, user, book } = f.current;
    let q = ''; if (st) q += '&review_status=eq.' + st; if (user) q += '&user_id=eq.' + enc(user); if (book) q += '&book_id=eq.' + enc(book);
    try {
      const r = await App.sb.get('page_proofs?select=book_id,stem,user_id,review_status,review_note,created_at,reviewed_at,rate' + q + '&order=created_at.desc,book_id.asc,stem.asc&limit=' + PAGE + '&offset=' + off.current);
      put([...rowsRef.current, ...r]); off.current += r.length; setMore(r.length === PAGE); setWarn('');
    } catch (e) { setWarn(/review_status|created_at|42703|PGRST/i.test(e.message) ? 'রিভিউ কলাম নেই — ' + SQLHINT + '।' : e.message); }
    finally { busy.current = false; }
  }
  // ট্যাব খুললে বা ফিল্টার বদলালে নতুন করে আনা (আগের onchange → loadReview(true))
  useEffect(() => { if (openKey) load(true); }, [openKey, filter.st, filter.user, filter.book]); // eslint-disable-line react-hooks/exhaustive-deps

  /* কোনো ইউজারের ভুলের হার সীমা ছাড়ালে সতর্কবার্তা (১২ ঘণ্টায় একবার) */
  async function maybeWarn(uids) {
    const { wp, wm } = warnLimits(d.refs.S.current);
    for (const uid of uids) {
      const list = d.refs.proofs.current.filter((p) => String(p.user_id) === uid);
      const ap = list.filter((p) => p.review_status === 'approved').length, co = list.filter((p) => p.review_status === 'correction').length, tot = ap + co;
      if (tot < wm) continue; const pc = Math.round(co / tot * 100); if (pc < wp) continue;
      try {
        const last = (await App.sb.get('notices?user_id=eq.' + enc(uid) + '&kind=eq.review&order=created_at.desc&limit=1'))[0];
        if (last && Date.now() - tm(last.created_at) < 12 * 3600e3) continue;
        await sendNotice({ user_id: uid, kind: 'review', title: 'প্রুফে ভুল বেশি ধরা পড়েছে', body: 'আপনার রিভিউ হওয়া ' + bn(tot) + 'টি পেইজের মধ্যে ' + bn(co) + 'টিতে (' + bn(pc) + '%) সংশোধন দরকার হয়েছে।\nদয়া করে আরও মনোযোগ দিয়ে প্রুফ করুন — "সংশোধন দরকার" পেইজে আয় গোনা হয় না। "পেমেন্ট" ট্যাবের তালিকা থেকে পেইজ খুলে ঠিক করে আবার "প্রুফড" চাপুন।' });
        toast(uname(uid) + ' কে ভুলের সতর্কবার্তা পাঠানো হয়েছে');
      } catch (e) { /* ignore */ }
    }
  }

  /* পেইজগুলোর রিভিউ-অবস্থা সার্ভারে লিখে স্থানীয় তালিকা হালনাগাদ */
  async function setReview(items, st, note) {
    const S0 = d.refs.S.current, bm = d.booksMap, by = {};
    items.forEach((i) => (by[String(i.book_id)] = by[String(i.book_id)] || []).push(i.stem));
    for (const [bid, stems] of Object.entries(by)) {
      const body = bodyFor(S0, st, note, bm[bid]);
      for (let i = 0; i < stems.length; i += 40) {
        const part = stems.slice(i, i + 40).map((x) => '"' + x.replace(/(["\\])/g, '\\$1') + '"').join(',');
        await App.sb.patchMin('page_proofs?book_id=eq.' + enc(bid) + '&stem=in.' + enc('(' + part + ')'), body);
      }
    }
    const ks = new Set(items.map(rvKey));
    d.applyStatus(ks, st, note);
    let next = rowsRef.current.map((p) => (ks.has(rvKey(p)) ? { ...p, ...bodyFor(S0, st, note, bm[String(p.book_id)]) } : p));
    if (f.current.st) next = next.filter((r) => status(r) === f.current.st);
    put(next);
    putSel(new Set([...selRef.current].filter((k) => next.some((r) => rvKey(r) === k))));
    const uids = [...new Set(items.map((i) => String(i.user_id)))];
    App.log(st === 'approved' ? 'admin_approve' : 'admin_correction', items.length + ' পেইজ • ' + uids.slice(0, 3).map(uname).join(', ') + (note ? ' • ' + note : ''));
    if (st === 'correction') await maybeWarn(uids);
  }

  const one = async (r, a) => {
    const k = rvKey(r); setBusyKey(k);
    try {
      if (a === 'ok') { await setReview([r], 'approved'); toast('অনুমোদিত'); }
      else {
        const note = await ask({ title: 'সংশোধন দরকার', label: 'ইউজারের জন্য নোট — কী ঠিক করতে হবে (ঐচ্ছিক)', ok: 'চিহ্নিত করুন' });
        if (note == null) return;
        await setReview([r], 'correction', note); toast('সংশোধন দরকার চিহ্নিত হয়েছে');
      }
    } catch (x) { toast(x.message, true); } finally { setBusyKey(''); }
  };
  const toggle = (r, on) => { const s = new Set(selRef.current), k = rvKey(r); if (on) s.add(k); else s.delete(k); putSel(s); };
  const selectAll = () => {
    const all = rows.length && rows.every((r) => sel.has(rvKey(r))), s = new Set(sel);
    rows.forEach((r) => (all ? s.delete(rvKey(r)) : s.add(rvKey(r)))); putSel(s);
  };
  const okSel = async () => {
    const items = rows.filter((r) => sel.has(rvKey(r))); if (!items.length) { toast('কিছু নির্বাচন করুন', true); return; }
    if (!window.confirm(bn(items.length) + 'টি পেইজ অনুমোদন করবেন?')) return;
    try { await setReview(items, 'approved'); toast(bn(items.length) + 'টি পেইজ অনুমোদিত'); } catch (x) { toast(x.message, true); }
  };
  const okAll = async () => {
    const { st, user: u, book: bk } = filter;
    if (st === 'approved') { toast('এগুলো আগেই অনুমোদিত', true); return; }
    const fresh = await d.loadProofs(true);
    const m = fresh.filter((p) => (!u || String(p.user_id) === u) && (!bk || String(p.book_id) === bk) && (st ? status(p) === st : status(p) !== 'approved'));
    if (!m.length) { toast('এই ফিল্টারে অনুমোদনের মতো পেইজ নেই'); return; }
    if (!window.confirm('ফিল্টারের সব ' + bn(m.length) + 'টি পেইজ অনুমোদন করবেন? (ইউজার: ' + (u ? uname(u) : 'সবাই') + ', কিতাব: ' + (bk ? bname(bk) : 'সব') + ')')) return;
    setOkAllBusy(true);
    try {
      const S0 = d.refs.S.current;
      for (const bid of [...new Set(m.map((p) => String(p.book_id)))]) {
        await App.sb.patchMin('page_proofs?book_id=eq.' + enc(bid) + (u ? '&user_id=eq.' + enc(u) : '') + (st ? '&review_status=eq.' + st : '&review_status=neq.approved'), bodyFor(S0, 'approved', '', d.booksMap[bid]));
      }
      d.applyStatus(new Set(m.map(rvKey)), 'approved');
      App.log('admin_approve', bn(m.length) + ' পেইজ (একসাথে) • ' + (u ? uname(u) : 'সব ইউজার')); toast(bn(m.length) + 'টি পেইজ অনুমোদিত হয়েছে'); load(true);
    } catch (x) { toast(x.message, true); } finally { setOkAllBusy(false); }
  };

  return (
    <section id="pReview">
      <div id="rvWarn">{warn ? <div className="noticebox bad">{warn}</div> : null}</div>
      <div className="row" style={{ marginBottom: '10px' }}>
        <select id="rvSt" className="sm" value={filter.st} onChange={(e) => setFilter({ ...filter, st: e.target.value })}>
          <option value="pending">রিভিউ বাকি</option><option value="correction">সংশোধন দরকার</option><option value="approved">অনুমোদিত</option><option value="">সব</option>
        </select>
        <select id="rvUser" className="sm" style={{ maxWidth: '170px' }} value={filter.user} onChange={(e) => setFilter({ ...filter, user: e.target.value })}>
          <option value="">সব ইউজার</option>{users.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.phone})</option>)}
        </select>
        <select id="rvBook" className="sm" style={{ maxWidth: '170px' }} value={filter.book} onChange={(e) => setFilter({ ...filter, book: e.target.value })}>
          <option value="">সব কিতাব</option>{books.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <span className="badge" id="rvCount">{bn(rows.length) + (more ? '+' : '') + ' টি'}</span>
        {' '}<button id="rvReload" className="sm" title="রিফ্রেশ" onClick={() => load(true)}><Ic n="refresh" /></button>
      </div>
      <div className="row" style={{ marginBottom: '12px' }}>
        <button id="rvAll" className="sm" onClick={selectAll}>সব নির্বাচন</button>
        {' '}<button id="rvOkSel" className="sm ok" onClick={okSel}><Ic n="check" />নির্বাচিত অনুমোদন</button>
        {' '}<button id="rvOkAll" className="sm ok" title="বর্তমান ফিল্টারের সব পেইজ" disabled={okAllBusy} onClick={okAll}>ফিল্টারের সব অনুমোদন</button>
      </div>
      <div id="rvList">
        {rows.length ? rows.map((r) => {
          const st = STB[status(r)] || STB.pending, k = rvKey(r);
          return (
            <div className="li" key={k}>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input type="checkbox" className="rvc" style={{ width: '18px', height: '18px', flex: 'none', padding: 0 }} checked={sel.has(k)} onChange={(e) => toggle(r, e.target.checked)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{bname(r.book_id)} — {r.stem}</b>
                  <div className="meta">{uname(r.user_id)} • {fmtDT(r.created_at)}{r.reviewed_at && r.review_status !== 'pending' ? ' • রিভিউ: ' + fmtDT(r.reviewed_at) : ''}</div>
                </div>
                <span className={'badge ' + st[1]}>{st[0]}</span>
              </div>
              {r.review_note ? <div className="meta">নোট: {r.review_note}</div> : null}
              <div className="row">
                <button className="sm ok" disabled={busyKey === k} onClick={() => one(r, 'ok')}><Ic n="check" />অনুমোদন</button>
                <button className="sm warnb" disabled={busyKey === k} onClick={() => one(r, 'bad')}><Ic n="x" />সংশোধন দরকার</button>
                <a className="badge gold" style={{ padding: '6px 10px' }} target="_blank" rel="noopener noreferrer" href={App.base + 'view?book=' + enc(r.book_id) + '&page=' + enc(r.stem)}>পেইজ দেখুন</a>
              </div>
            </div>
          );
        }) : <Empty>এই ফিল্টারে কোনো পেইজ নেই</Empty>}
      </div>
      <button id="rvMore" className="block" hidden={!more} onClick={() => load(false)}>আরও দেখান</button>
    </section>
  );
}
