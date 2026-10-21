/* সেটিংস: আয় ও রিভিউ, এপি আই চালু/বন্ধ (টগল করলেই সংরক্ষণ), GitHub ও Gemini সেটিংস */
import { useEffect, useState } from 'react';
import App from '../../lib/common.js';
import { DEF, SQLHINT, saveWfFile, sl, wfFile } from './helpers.js';

const { toast } = App;
const EMPTY = { rate: '', min: '', wpct: '', wmin: '', gu: '', repo: '', br: '', pages: '', texts: '', proofF: '', proofD: '', wf: '', tok: '', key: '', mod: '', tmp: '', p1: '', p2: '' };
const nz = (v) => (v == null ? '' : v);

export default function SettingsTab({ d, openKey }) {
  const [f, setF] = useState(EMPTY);
  const [apiOn, setApiOn] = useState(true), [apiBusy, setApiBusy] = useState(false);
  const [saving, setSaving] = useState(false), [paySaving, setPaySaving] = useState(false);
  const set = (k) => (e) => { const v = e.target.value; setF((o) => ({ ...o, [k]: v })); };

  useEffect(() => {
    if (!openKey) return;
    d.fetchS().then((r) => {
      setF({
        gu: r.github_username || DEF.github_username, repo: r.repo_name || DEF.repo_name, br: r.branch || '',
        pages: r.pages_dir || DEF.pages_dir, texts: r.texts_dir || DEF.texts_dir, proofF: r.proof_file || DEF.proof_file, proofD: r.proof_dir || DEF.proof_dir,
        wf: wfFile(), tok: r.github_token || '', key: r.gemini_api_key || '', mod: r.gemini_model || '', tmp: nz(r.gemini_temp), p1: r.prompt_ocr || '', p2: r.prompt_proof || '',
        rate: nz(r.page_rate), min: nz(r.min_payout), wpct: nz(r.warn_pct), wmin: nz(r.warn_min)
      });
      setApiOn(r.api_enabled !== false);
    });
  }, [openKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /* সংরক্ষণ: GitHub + Gemini (+ এপি আই অবস্থা) */
  const save = async () => {
    const t = parseFloat(f.tmp);
    const row = {
      id: 1, github_username: sl(f.gu) || DEF.github_username, repo_name: sl(f.repo) || DEF.repo_name, branch: f.br.trim(),
      pages_dir: sl(f.pages) || DEF.pages_dir, texts_dir: sl(f.texts) || DEF.texts_dir,
      proof_file: f.proofF.trim().replace(/^\/+/, '') || DEF.proof_file, proof_dir: sl(f.proofD) || DEF.proof_dir,
      github_token: f.tok.trim(), gemini_api_key: f.key.trim(), gemini_model: f.mod.trim().replace(/^models\//, ''),
      gemini_temp: Number.isFinite(t) ? Math.min(2, Math.max(0, t)) : null, prompt_ocr: f.p1.trim(), prompt_proof: f.p2.trim(),
      api_enabled: apiOn
    };
    setSaving(true);
    try {
      try { await App.sb.upsert('app_settings?on_conflict=id', row); d.setS({ ...d.refs.S.current, ...row }); toast('সেটিংস সংরক্ষিত হয়েছে'); }
      catch (e) {
        if (/api_enabled/i.test(e.message)) { // নতুন কলাম এখনো যোগ হয়নি: বাকি সেটিংস অন্তত সংরক্ষণ হোক
          const { api_enabled, ...rest } = row; // eslint-disable-line no-unused-vars
          try { await App.sb.upsert('app_settings?on_conflict=id', rest); d.setS({ ...d.refs.S.current, ...rest }); toast('সেটিংস সংরক্ষিত, কিন্তু এপি আই চালু/বন্ধ সংরক্ষণ হয়নি — Supabase SQL Editor-এ supabase_api_toggle.sql চালান', true); }
          catch (e2) { toast(e2.message, true); }
        } else toast(e.message, true);
      }
    } finally { setSaving(false); }
  };

  /* আয় ও রিভিউ সেটিংস */
  const savePay = async () => {
    const n = (v, dflt) => { const s = String(v).trim(); return s === '' ? dflt : Number(s); };
    const row = { page_rate: n(f.rate, App.DEF_RATE), min_payout: n(f.min, App.DEF_MIN), warn_pct: Math.round(n(f.wpct, 20)), warn_min: Math.round(n(f.wmin, 5)) };
    if (!(row.page_rate >= 0) || !(row.min_payout >= 0) || !(row.warn_pct >= 1 && row.warn_pct <= 100) || !(row.warn_min >= 1)) { toast('সংখ্যাগুলো সঠিক দিন', true); return; }
    setPaySaving(true);
    try {
      const r = await App.sb.patch('app_settings?id=eq.1', row); if (!r.length) await App.sb.upsert('app_settings?on_conflict=id', { id: 1, ...row });
      const old = d.refs.S.current.page_rate; d.setS({ ...d.refs.S.current, ...row }); toast('আয় সেটিংস সংরক্ষিত হয়েছে');
      App.log('admin_settings', 'রেট ' + row.page_rate + ' ৳, ন্যূনতম ' + row.min_payout + ' ৳' + (String(old) !== String(row.page_rate) ? ' (আগে ' + old + ')' : ''));
    } catch (e) { toast(/page_rate|min_payout|warn_/i.test(e.message) ? 'নতুন কলাম নেই — ' + SQLHINT : e.message, true); }
    finally { setPaySaving(false); }
  };

  /* এপি আই চালু/বন্ধ: টগল করলেই সাথে সাথে সংরক্ষণ */
  const toggleApi = async (e) => {
    const on = e.target.checked; setApiBusy(true); setApiOn(on);
    try {
      let r = await App.sb.patch('app_settings?id=eq.1', { api_enabled: on });
      if (!r.length) r = await App.sb.upsert('app_settings?on_conflict=id', { id: 1, api_enabled: on });
      d.setS({ ...d.refs.S.current, api_enabled: on }); toast(on ? 'এপি আই চালু করা হয়েছে' : 'এপি আই বন্ধ করা হয়েছে');
    } catch (x) {
      setApiOn(!on);
      toast(/api_enabled/i.test(x.message) ? 'api_enabled কলাম নেই — Supabase SQL Editor-এ supabase_api_toggle.sql চালান' : x.message, true);
    } finally { setApiBusy(false); }
  };

  return (
    <section id="pSet" style={{ maxWidth: '640px' }}>
      <div className="card" style={{ marginBottom: '16px' }}>
        <b>আয় ও রিভিউ সেটিংস</b>
        <p className="hint">কিতাবে আলাদা রেট না দিলে এই ডিফল্ট রেট প্রযোজ্য। আয় গোনা হয় শুধু অনুমোদিত পেইজে; অনুমোদনের সময়ের রেট পেইজে সংরক্ষিত হয়, তাই পরে রেট বদলালে পুরনো অনুমোদিত পেইজের আয় বদলায় না।</p>
        <label className="f" htmlFor="sRate">ডিফল্ট রেট — প্রতি পেইজ (৳)</label>
        <input id="sRate" type="number" step="0.01" min="0" inputMode="decimal" placeholder="0.20" value={f.rate} onChange={set('rate')} />
        {' '}<label className="f" htmlFor="sMin">ন্যূনতম পেমেন্ট রিকোয়েস্ট (৳)</label>
        <input id="sMin" type="number" step="1" min="0" inputMode="decimal" placeholder="50" value={f.min} onChange={set('min')} />
        {' '}<label className="f" htmlFor="sWpct">ভুলের সতর্কবার্তা: সংশোধনের হার (%) এর বেশি হলে</label>
        <input id="sWpct" type="number" step="1" min="1" max="100" placeholder="20" value={f.wpct} onChange={set('wpct')} />
        {' '}<label className="f" htmlFor="sWmin">…কমপক্ষে এতগুলো পেইজ রিভিউ হওয়ার পর</label>
        <input id="sWmin" type="number" step="1" min="1" placeholder="5" value={f.wmin} onChange={set('wmin')} />
        {' '}<button id="sPaySave" className="primary block" style={{ marginTop: '16px' }} disabled={paySaving} onClick={savePay}>আয় সেটিংস সংরক্ষণ</button>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="row">
          <b style={{ flex: '1' }}>এপি আই নিয়ন্ত্রণ (চালু / বন্ধ)</b>
          <span className={'apistate ' + (apiOn ? 'on' : 'off')} id="sApiState">{apiOn ? 'চালু' : 'বন্ধ'}</span>
        </div>
        <p className="hint">
          {'বন্ধ করলে view.html-এ এপি আই - ১ (ছবি থেকে টেক্সট, অটো OCR সহ) ও এপি আই - ২ (প্রুফিং) কেউই চালাতে পারবে না — টেক্সট আর নিজে থেকে আসবে না, পেইজের স্ট্যাটাস লাইনে '}
          <b>{'"টেক্সট নেই (পেস্ট করে সেভ করুন) • এপি আই বন্ধ"'}</b>
          {' দেখাবে। টগল করলেই সাথে সাথে সংরক্ষিত হয় (ইউজাররা সর্বোচ্চ ~৩০ সেকেন্ডের মধ্যে বা পেইজে ফিরলেই নতুন অবস্থা পায়)।'}
        </p>
        <label className="sw" htmlFor="sApiOn">
          <input id="sApiOn" type="checkbox" checked={apiOn} disabled={apiBusy} onChange={toggleApi} />
          <span className="sw-t"></span>
          <b id="sApiLbl">{apiOn ? 'এপি আই চালু' : 'এপি আই বন্ধ'}</b>
        </label>
      </div>

      <div className="card">
        <b>GitHub সেটিংস (সব কিতাবের ডিফল্ট)</b>
        <p className="hint">কোনো কিতাবে নিজস্ব GitHub Username / Repo না দিলে এই ডিফল্ট ব্যবহার হবে। মানগুলো Supabase-এ থাকে এবং সব কিতাবের view.html-এ প্রযোজ্য হয়।</p>
        <label className="f" htmlFor="sGu">GitHub Username</label>
        <input id="sGu" type="text" autoCapitalize="off" placeholder="SunniPedia" value={f.gu} onChange={set('gu')} />
        {' '}<label className="f" htmlFor="sRepo">Repo Name</label>
        <input id="sRepo" type="text" autoCapitalize="off" placeholder="pdftojpg" value={f.repo} onChange={set('repo')} />
        {' '}<label className="f" htmlFor="sBr">Branch (ফাঁকা = ডিফল্ট ব্রাঞ্চ)</label>
        <input id="sBr" type="text" autoCapitalize="off" placeholder="main" value={f.br} onChange={set('br')} />
        {' '}<label className="f" htmlFor="sPages">পেইজ ফোল্ডার (প্রিফিক্স_ এর পরে)</label>
        <input id="sPages" type="text" autoCapitalize="off" placeholder="pages" value={f.pages} onChange={set('pages')} />
        {' '}<label className="f" htmlFor="sTexts">টেক্সট ফোল্ডার</label>
        <input id="sTexts" type="text" autoCapitalize="off" placeholder="texts" value={f.texts} onChange={set('texts')} />
        {' '}<label className="f" htmlFor="sProofF">প্রুফড ফাইলের নাম</label>
        <input id="sProofF" type="text" autoCapitalize="off" placeholder="proofed.json" value={f.proofF} onChange={set('proofF')} />
        {' '}<label className="f" htmlFor="sProofD">প্রুফড ফোল্ডার</label>
        <input id="sProofD" type="text" autoCapitalize="off" placeholder="proofed" value={f.proofD} onChange={set('proofD')} />
        {' '}<label className="f" htmlFor="sTok">GitHub Token</label>
        <input id="sTok" type="password" autoComplete="off" placeholder="github_pat_..." value={f.tok} onChange={set('tok')} />
        <p className="hint">{'কিতাব থেকে ছবি তৈরির workflow চালাতে টোকেনে '}<b>Actions: Read and write</b>{' (classic হলে '}<b>workflow</b>{') অনুমতিও লাগবে।'}</p>
        <label className="f" htmlFor="sWf">ছবি তৈরির Workflow ফাইল (<code>.github/workflows/</code>{' এর ভেতরের নাম)'}</label>
        <input id="sWf" type="text" autoCapitalize="off" spellCheck="false" placeholder="ultimatepdftojpg(2).yml" value={f.wf}
          onChange={(e) => { set('wf')(e); saveWfFile(e.target.value); }} />
        <p className="hint">{'এই ব্রাউজারে সংরক্ষিত হয় (বদলালেই সাথে সাথে)। ফাঁকা রাখলে '}<b>ultimatepdftojpg(2).yml</b>{' ব্যবহার হবে।'}</p>
        <b style={{ display: 'block', marginTop: '22px' }}>Gemini সেটিংস</b>
        {' '}<label className="f" htmlFor="sKey">Gemini API Key</label>
        <input id="sKey" type="password" autoComplete="off" placeholder="AIza..." value={f.key} onChange={set('key')} />
        {' '}<label className="f" htmlFor="sMod">Model</label>
        <input id="sMod" type="text" placeholder="gemini-3.5-flash-lite" value={f.mod} onChange={set('mod')} />
        {' '}<label className="f" htmlFor="sTmp">Temperature (০ – ২)</label>
        <input id="sTmp" type="number" min="0" max="2" step="0.1" value={f.tmp} onChange={set('tmp')} />
        {' '}<label className="f" htmlFor="sP1">Prompt - এপি আই ১ (ছবি থেকে টেক্সট / OCR)</label>
        <textarea id="sP1" rows="6" value={f.p1} onChange={set('p1')}></textarea>
        <label className="f" htmlFor="sP2">Prompt - এপি আই ২ (টেক্সট প্রুফিং)</label>
        <textarea id="sP2" rows="6" value={f.p2} onChange={set('p2')}></textarea>
        <button id="sSave" className="primary block" style={{ marginTop: '18px' }} disabled={saving} onClick={save}>সংরক্ষণ</button>
      </div>
    </section>
  );
}
