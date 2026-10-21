/* কিতাব: তালিকা, রেট/অগ্রগতি, পেইজ গণনা, নতুন/এডিট ডায়ালগ এবং পিডিএফ থেকে ছবি তৈরির GitHub Actions workflow (স্ট্যাটাস পোলিং সহ) */
import { useEffect, useRef, useState } from 'react';
import App from '../../lib/common.js';
import Icon from '../../components/Icon.jsx';
import { Dlg, Empty, Ic, SegBar } from './ui.jsx';
import {
  DEF, countPages, dispatchBook, eff, fetchRunState, getSplitPref, ghTok, isActiveRun, outDirOf, pdfLinks, rateTxt, readRunsLS, setSplitPref, sl, wfFile, writeRunsLS
} from './helpers.js';

const { bn, toast, enc } = App;

/* ---- ছবি তৈরির স্ট্যাটাস বক্স (কিতাবের কার্ডে) ---- */
function RunBox({ s }) {
  const link = s && s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">বিস্তারিত</a> : null;
  if (!s) return <div className="runbox"><div className="rh"><span className="badge">ছবি তৈরি</span><span className="rs">স্ট্যাটাস আনা হচ্ছে…</span></div></div>;
  if (s.status === 'error') return <div className="runbox"><div className="rh"><span className="badge warn">ছবি তৈরি</span><span className="rs">স্ট্যাটাস আনা যায়নি: {s.err || ''}</span></div></div>;
  if (s.status === 'completed') {
    const ok = s.conclusion === 'success', cn = s.conclusion === 'cancelled';
    return <div className="runbox"><div className="rh"><span className={'badge ' + (ok ? 'ok' : cn ? 'warn' : 'bad')}>{ok ? 'ছবি তৈরি সম্পন্ন ✔' : cn ? 'ছবি তৈরি বাতিল' : 'ছবি তৈরি ব্যর্থ ✖'}</span>{link}</div></div>;
  }
  const q = s.status !== 'in_progress', pct = s.total ? Math.max(4, Math.round(s.done / s.total * 100)) : (q ? 0 : 4);
  return (
    <div className="runbox">
      <div className="rh">
        <span className="badge warn">{q ? 'ছবি তৈরি: সারিতে আছে' : 'ছবি তৈরি চলছে…'}</span>
        {s.total ? <span className="rs">ধাপ {Math.min(s.done + 1, s.total)}/{s.total}{s.step ? ' • ' + s.step : ''}</span> : null}
        {link}
      </div>
      <div className="pbar run"><i style={{ width: pct + '%' }}></i></div>
    </div>
  );
}

const blank = () => ({ name: '', author: '', cover: '', pdf: '', rate: '', tot: '', gu: '', repo: '', br: '', fold: '', run: true, split: true });
const fromBook = (b) => ({
  name: b.name || '', author: b.author || '', cover: b.cover_url || '', pdf: b.pdf_url || '', rate: b.page_rate == null ? '' : b.page_rate, tot: b.total_pages == null ? '' : b.total_pages,
  gu: b.github_username || '', repo: b.repo_name || '', br: b.branch || '', fold: b.folder || '', run: false, split: getSplitPref()
});

export default function BooksTab({ d, openKey, active }) {
  const { books, S, bst, proofsLoaded } = d;
  const [runs, setRuns] = useState({}), [, bump] = useState(0);
  const [dlgOpen, setDlgOpen] = useState(false), [editId, setEditId] = useState(null), [fm, setFm] = useState(blank), [err, setErr] = useState('');
  const [counting, setCounting] = useState(''), [fCounting, setFCounting] = useState(false), [saving, setSaving] = useState(false);
  const runsRef = useRef({}), runsLS = useRef(readRunsLS()), pollT = useRef(0), activeRef = useRef(active); activeRef.current = active;
  const set = (k) => (e) => { const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value; setFm((o) => ({ ...o, [k]: v })); };

  /* ---- সর্বশেষ রান: Supabase-এর gh_run_* কলাম + এই ব্রাউজারের সংরক্ষণ — যেটি নতুন ---- */
  const getRun = (b) => {
    const c = [];
    if (b.gh_run_at) c.push({ id: b.gh_run_id ? String(b.gh_run_id) : null, at: b.gh_run_at });
    if (runsLS.current[b.id]) c.push(runsLS.current[b.id]);
    if (!c.length) return null;
    c.sort((x, y) => String(y.at).localeCompare(String(x.at)));
    return c[0];
  };
  const setRun = (id, s) => { runsRef.current = { ...runsRef.current, [id]: s }; setRuns(runsRef.current); };
  const saveRun = (b, info) => {
    runsLS.current[b.id] = info; writeRunsLS(runsLS.current); bump((n) => n + 1);
    App.sb.patch('books?id=eq.' + enc(b.id), { gh_run_id: info.id, gh_run_at: info.at }).then(() => { if ('gh_run_id' in b) d.patchBook(b.id, { gh_run_id: info.id, gh_run_at: info.at }); }).catch(() => {});
  };

  /* ---- স্ট্যাটাস পোলিং: ট্যাব খোলা ও পেইজ দৃশ্যমান থাকলেই GitHub-এ জিজ্ঞেস করে ---- */
  const schedulePoll = (ms) => { clearTimeout(pollT.current); pollT.current = setTimeout(pollRuns, ms || 8000); };
  async function pollRuns() {
    clearTimeout(pollT.current);
    const S0 = d.refs.S.current;
    if (document.visibilityState !== 'visible' || !activeRef.current || !ghTok(S0)) { schedulePoll(8000); return; }
    let any = false;
    await Promise.all(d.refs.books.current.map(async (b) => {
      const info = getRun(b); if (!info) return;
      const old = runsRef.current[b.id]; if (old && old.status === 'completed') return;   // শেষ হওয়া রান আর আনা হয় না
      let st;
      try { st = await fetchRunState(S0, b, info, (id) => saveRun(b, { id, at: info.at })); } catch (e) { st = { status: 'error', err: e.message }; }
      setRun(b.id, st); if (isActiveRun(st)) any = true;
    }));
    schedulePoll(any ? 8000 : 15000);
  }
  useEffect(() => {
    schedulePoll(8000);
    const onVis = () => { if (document.visibilityState === 'visible' && activeRef.current) pollRuns(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearTimeout(pollT.current); document.removeEventListener('visibilitychange', onVis); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (openKey) { d.loadProofs(); pollRuns(); } }, [openKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const reload = async () => { const l = await d.loadBooks(); pollRuns(); return l; };
  async function startRun(b, split) {
    try {
      toast('workflow চালু করা হচ্ছে…');
      const info = await dispatchBook(d.refs.S.current, b, split);
      saveRun(b, info); setRun(b.id, { status: 'queued' });
      toast('ছবি তৈরির workflow চালু হয়েছে — স্ট্যাটাস কিতাবের কার্ডে দেখা যাবে');
      schedulePoll(3000);
      return true;
    } catch (e) { toast('workflow চালু হয়নি: ' + e.message, true); return false; }
  }

  /* ---- ডায়ালগ ---- */
  const openBook = (b) => { setEditId(b ? b.id : null); setFm(b ? fromBook(b) : { ...blank(), split: getSplitPref() }); setErr(''); setDlgOpen(true); };
  const nm = sl(fm.fold) || sl(fm.name);
  const runHint = nm ? 'আউটপুট ফোল্ডার: ' + nm + '_' + (S.pages_dir || DEF.pages_dir) + ' • workflow: ' + wfFile() : 'workflow: ' + wfFile();

  const formCount = async () => {
    setFCounting(true); setErr('');
    try {
      const b = { name: fm.name.trim(), folder: fm.fold.trim(), github_username: fm.gu.trim(), repo_name: fm.repo.trim(), branch: fm.br.trim() };
      if (!b.name) throw new Error('আগে কিতাবের নাম দিন');
      const c = await countPages(S, b); setFm((o) => ({ ...o, tot: String(c.n) }));
      toast(c.dir + ' — ' + bn(c.n) + 'টি ছবি' + (c.truncated ? ' (তালিকা অসম্পূর্ণ হতে পারে)' : ''));
    } catch (e) { setErr('গণনা ব্যর্থ: ' + e.message); } finally { setFCounting(false); }
  };

  const save = async () => {
    const row = { name: fm.name.trim(), author: fm.author.trim(), cover_url: fm.cover.trim(), pdf_url: fm.pdf.trim(), github_username: fm.gu.trim(), repo_name: fm.repo.trim(), branch: fm.br.trim(), folder: fm.fold.trim().replace(/^\/+|\/+$/g, '') };
    if (!row.name) { setErr('কিতাবের নাম আবশ্যক'); return; }
    const rv = String(fm.rate).trim(), tv = String(fm.tot).trim();
    if (rv !== '' && !(Number(rv) >= 0)) { setErr('সঠিক রেট দিন'); return; }
    row.page_rate = rv === '' ? null : Number(rv); row.total_pages = tv === '' ? null : Math.max(0, Math.round(Number(tv)) || 0);
    const wantRun = fm.run, split = fm.split;
    if (wantRun) {                                   // সংরক্ষণের আগেই যাচাই, যাতে অর্ধেক কাজ না হয়
      if (!row.pdf_url) { setErr('ছবি তৈরির জন্য পিডিএফ লিংক দিন'); return; }
      if (pdfLinks(row.pdf_url).length > 1) { setErr('একটি কিতাবে একটাই পিডিএফ লিংক দিন'); return; }
      if (!ghTok(S)) { setErr('workflow চালাতে সেটিংস ট্যাবে GitHub Token দিন'); return; }
    }
    setSplitPref(split);
    let saved = null; setSaving(true);
    try {
      let r;
      const persist = (x) => (editId ? App.sb.patch('books?id=eq.' + enc(editId), x) : App.sb.post('books', x));
      try { r = await persist(row); }
      catch (e) {
        if (/page_rate|total_pages/i.test(e.message)) { const { page_rate, total_pages, ...rest } = row; r = await persist(rest); toast('কিতাব সংরক্ষিত, কিন্তু রেট/মোট পেইজ সংরক্ষণ হয়নি — Supabase SQL Editor-এ supabase_v2.sql চালান', true); } // eslint-disable-line no-unused-vars
        else throw e;
      }
      if (editId && String(row.page_rate) !== String((d.refs.books.current.find((x) => String(x.id) === String(editId)) || {}).page_rate)) App.log('admin_rate', row.name + ' → ' + (row.page_rate == null ? 'ডিফল্ট' : row.page_rate + ' ৳'));
      saved = (r && r[0]) || { ...row, id: editId };
      setDlgOpen(false); toast('কিতাব সংরক্ষিত হয়েছে');
    } catch (x) { setErr(x.message); return; } finally { setSaving(false); }
    const list = await reload();
    if (wantRun) { const bk = list.find((x) => String(x.id) === String(saved.id)) || saved; await startRun(bk, split); }
  };

  /* ---- কার্ডের বোতাম ---- */
  const act = async (a, bk) => {
    if (a === 'edit') openBook(bk);
    else if (a === 'count') {
      setCounting(String(bk.id));
      try {
        const c = await countPages(S, bk);
        await App.sb.patch('books?id=eq.' + enc(bk.id), { total_pages: c.n }); d.patchBook(bk.id, { total_pages: c.n });
        toast('মোট পেইজ: ' + bn(c.n) + (c.truncated ? ' (তালিকা অসম্পূর্ণ হতে পারে)' : ''));
      } catch (x) { toast('গণনা ব্যর্থ: ' + x.message, true); } finally { setCounting(''); }
    } else if (a === 'run') {
      const sp = getSplitPref();
      if (!window.confirm('"' + bk.name + '" — পিডিএফ থেকে আবার ছবি তৈরি করবেন?\n\nআউটপুট ফোল্ডার: ' + outDirOf(S, bk) + '\nবাম-ডান ভাগ: ' + (sp ? 'হ্যাঁ' : 'না') + '\n(একই নামের ছবি নতুন করে লেখা হবে; পুরনো ছবি মুছবে না)')) return;
      await startRun(bk, sp);
    } else if (window.confirm('"' + bk.name + '" কিতাবটি ডিলিট করবেন?')) {
      try {
        await App.sb.del('books?id=eq.' + enc(bk.id));
        delete runsLS.current[bk.id]; writeRunsLS(runsLS.current);
        const { [bk.id]: gone, ...rest } = runsRef.current; runsRef.current = rest; setRuns(rest); // eslint-disable-line no-unused-vars
        toast('কিতাব ডিলিট হয়েছে'); reload();
      } catch (x) { toast(x.message, true); }
    }
  };

  return (
    <section id="pBooks">
      <div className="row" style={{ marginBottom: '12px' }}>
        <b style={{ flex: '1' }}>সব কিতাব</b>
        {' '}<button id="bRel" className="sm" title="কিতাব ও ছবি-তৈরির স্ট্যাটাস রিফ্রেশ" onClick={async () => { await reload(); toast('রিফ্রেশ হয়েছে'); }}><Ic n="refresh" /></button>
        {' '}<button id="bAdd" className="primary sm" onClick={() => openBook(null)}><Ic n="plus" />নতুন কিতাব</button>
      </div>
      <div id="bList">
        {books.length ? books.map((b) => {
          const x = bst[String(b.id)] || { n: 0, a: 0, p: 0, c: 0 }, tot = Number(b.total_pages) || 0, info = getRun(b);
          return (
            <div className="li" key={b.id}>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <div style={{ width: '44px', height: '58px', borderRadius: '6px', overflow: 'hidden', background: 'var(--panel2)', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
                  {b.cover_url ? <img src={b.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="book" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{b.name}</b>
                  <div className="meta">
                    {b.author || ''}<br />{eff(S, b, 'github_username')}/{eff(S, b, 'repo_name')}{(!b.github_username && !b.repo_name) ? ' (ডিফল্ট)' : ''} &middot; {b.folder || b.name}_{S.pages_dir || DEF.pages_dir}
                    {b.pdf_url ? <><br /><a href={b.pdf_url} target="_blank" rel="noopener noreferrer">PDF লিংক</a></> : null}
                  </div>
                </div>
              </div>
              <div className="meta">রেট: <b>{rateTxt(App.rateOf(b, S))}</b>/পেইজ{b.page_rate == null || b.page_rate === '' ? ' (ডিফল্ট)' : ''} • {tot ? 'মোট ' + bn(tot) + ' পেইজ' : 'মোট পেইজ দেওয়া নেই (এডিট বা "পেইজ গণনা")'}</div>
              {proofsLoaded ? (
                <>
                  <SegBar a={x.a} p={x.p} c={x.c} tot={tot || x.n} />
                  <div className="pgt"><span>প্রুফড {bn(x.n)}{tot ? ' / ' + bn(tot) + ' • বাকি ' + bn(Math.max(0, tot - x.n)) : ''}</span><span>অনুমোদিত {bn(x.a)} • রিভিউ বাকি {bn(x.p)} • সংশোধন {bn(x.c)}</span></div>
                </>
              ) : null}
              <div className="run">{info ? <RunBox s={runs[b.id]} /> : null}</div>
              <div className="row">
                <button className="sm" title="GitHub ফোল্ডার থেকে মোট পেইজ গুনুন" disabled={counting === String(b.id)} onClick={() => act('count', b)}><Ic n="refresh" />পেইজ গণনা</button>
                <button className="sm" onClick={() => act('edit', b)}><Ic n="edit" />এডিট</button>
                {b.pdf_url ? <button className="sm" title="পিডিএফ থেকে ছবি তৈরির workflow আবার চালান" onClick={() => act('run', b)}><Icon name="play" />ছবি তৈরি</button> : null}
                <button className="sm danger" onClick={() => act('del', b)}><Ic n="trash" />ডিলিট</button>
              </div>
            </div>
          );
        }) : <Empty>কোনো কিতাব যোগ করা হয়নি</Empty>}
      </div>

      {/* কিতাব ডায়ালগ */}
      <Dlg id="bDlg" open={dlgOpen} onClose={() => setDlgOpen(false)}>
        <h3 id="bdT">{editId ? 'কিতাব এডিট' : 'নতুন কিতাব'}</h3>
        <label className="f" htmlFor="fName">কিতাবের নাম *</label>
        <input id="fName" type="text" value={fm.name} onChange={set('name')} />
        {' '}<label className="f" htmlFor="fAuth">কিতাবের লেখকের নাম</label>
        <input id="fAuth" type="text" value={fm.author} onChange={set('author')} />
        {' '}<label className="f" htmlFor="fCover">কিতাবের ছবির লিংক</label>
        <input id="fCover" type="url" placeholder="https://..." value={fm.cover} onChange={set('cover')} />
        {' '}<label className="f" htmlFor="fPdf">কিতাবের পিডিএফ লিংক</label>
        <input id="fPdf" type="url" placeholder="https://..." value={fm.pdf} onChange={set('pdf')} />
        {' '}<label className="f" htmlFor="fRate">পেইজ প্রতি রেট (৳) — ফাঁকা = ডিফল্ট রেট</label>
        <input id="fRate" type="number" step="0.01" min="0" inputMode="decimal" placeholder={'ডিফল্ট ' + App.rateOf(null, S)} value={fm.rate} onChange={set('rate')} />
        {' '}<label className="f" htmlFor="fTot">মোট পেইজ সংখ্যা (অগ্রগতির বারের জন্য)</label>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input id="fTot" type="number" min="0" step="1" inputMode="numeric" value={fm.tot} onChange={set('tot')} />
          <button id="fCount" type="button" className="sm" title="GitHub ফোল্ডার থেকে ছবির সংখ্যা গুনুন" disabled={fCounting} onClick={formCount}>গুনুন</button>
        </div>
        <label className="f" htmlFor="fGu">GitHub Username (ফাঁকা = ডিফল্ট)</label>
        <input id="fGu" type="text" autoCapitalize="off" placeholder={eff(S, {}, 'github_username')} value={fm.gu} onChange={set('gu')} />
        {' '}<label className="f" htmlFor="fRepo">Repo Name (ফাঁকা = ডিফল্ট)</label>
        <input id="fRepo" type="text" autoCapitalize="off" placeholder={eff(S, {}, 'repo_name')} value={fm.repo} onChange={set('repo')} />
        {' '}<label className="f" htmlFor="fBr">Branch (ফাঁকা = ডিফল্ট)</label>
        <input id="fBr" type="text" autoCapitalize="off" placeholder="main" value={fm.br} onChange={set('br')} />
        <p className="hint" id="fDef">{'ডিফল্ট: ' + eff(S, {}, 'github_username') + ' / ' + eff(S, {}, 'repo_name') + ' (সেটিংস ট্যাব থেকে বদলানো যায়)'}</p>
        <label className="f" htmlFor="fFold">রিপোর ফোল্ডার প্রিফিক্স</label>
        <input id="fFold" type="text" autoCapitalize="off" placeholder="যেমন: bukhari (ফাঁকা থাকলে কিতাবের নাম)" value={fm.fold} onChange={set('fold')} />
        <p className="hint">{'ফোল্ডার হবে '}<b>প্রিফিক্স_pages</b>{', '}<b>প্রিফিক্স_texts</b>{', '}<b>প্রিফিক্স_proofed.json</b></p>
        <label className="chk" htmlFor="fRun"><input id="fRun" type="checkbox" checked={fm.run} onChange={set('run')} /><span>সংরক্ষণের পর পিডিএফ থেকে ছবি তৈরির workflow চালান</span></label>
        {' '}<label className="chk" htmlFor="fSplit"><input id="fSplit" type="checkbox" checked={fm.split} onChange={set('split')} /><span>প্রতিটি পেইজ বাম-ডান দুই ভাগ (split) করুন</span></label>
        <p className="hint" id="fRunHint">{runHint}</p>
        <div className="err" id="bdErr">{err}</div>
        <div className="acts">
          <button id="bdCancel" onClick={() => setDlgOpen(false)}>বন্ধ</button>
          <button id="bdSave" className="primary" disabled={saving} onClick={save}>সংরক্ষণ</button>
        </div>
      </Dlg>
    </section>
  );
}
