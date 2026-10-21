/* API ডায়ালগ: (১) এপি আই - ১ / ২ বাছাই, (২) কনফিগ (Key, Model, Prompt, Temperature)।
   কনফিগের যেকোনো ঘর বদলালেই সাথে সাথে স্বয়ংক্রিয় সংরক্ষণ — একবার দিলে পরেও একই থাকবে। রিপোতে কখনো যায় না। */
import { useLayoutEffect, useRef, useState } from 'react';
import Dialog from './Dialog.jsx';
import { API_DEF, API_NAME } from './config.js';

const keyState = (cfg, n) => ((cfg['api' + n].key || (n === 2 && cfg.api1.key)) ? 'Key সেট আছে' : 'Key নেই');

/* ফর্মের মান → সংরক্ষণযোগ্য কনফিগ */
function toApiCfg(n, f) {
  const t = parseFloat(f.temp);
  const c = {
    key: f.key.trim(),
    model: f.model.trim().replace(/^models\//, '') || 'gemini-3.5-flash-lite',
    prompt: f.prompt.trim(),
    temp: Number.isFinite(t) ? Math.min(2, Math.max(0, t)) : 0
  };
  if (n === 2) c.sendImg = f.img;
  if (n === 1) c.auto = f.auto;
  return c;
}

export default function ApiDialogs({ pickOpen, onPickClose, onPick, cfgN, onCfgClose, cfg, setCfg, apiEnabled, stem, onRun, onFormSaved, toast }) {
  const n = cfgN || 1;
  const [f, setF] = useState({ key: '', model: '', prompt: '', temp: '0', img: true, auto: true });
  const [keyHint, setKeyHint] = useState(''), [promptHint, setPromptHint] = useState('');
  const keyEl = useRef(null), promptEl = useRef(null);

  useLayoutEffect(() => {   // কনফিগ ডায়ালগ খোলার সময় সংরক্ষিত মান বসানো
    if (!cfgN) return;
    const c = cfg['api' + cfgN];
    setF({ key: c.key, model: c.model, prompt: c.prompt, temp: String(c.temp), img: !!c.sendImg, auto: !!c.auto });
    setKeyHint(''); setPromptHint('');
  }, [cfgN]); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = (nf) => {
    const patch = toApiCfg(n, nf);
    setCfg((c) => ({ ...c, ['api' + n]: { ...c['api' + n], ...patch } }));
    onFormSaved();                       // নতুন করে সংরক্ষণ করলে অটো আবার চালু
    return patch;
  };
  const edit = (k, isCheck) => (e) => { const nf = { ...f, [k]: isCheck ? e.target.checked : e.target.value }; setF(nf); persist(nf); };

  return (
    <>
      <Dialog id="dlgApi" open={pickOpen} onClose={onPickClose}>
        <h3>API</h3>
        {!apiEnabled ? <small id="apiOffNote" style={{ color: 'var(--err)', fontWeight: 600 }}>এপি আই এখন বন্ধ (অ্যাডমিন সেটিংস থেকে চালু করুন) — চালানো যাবে না, শুধু কনফিগ দেখা/বদলানো যাবে।</small> : null}
        {[1, 2].map((k) => (
          <button key={k} id={'apiPick' + k} className="apiPick" type="button" onClick={() => onPick(k)}>
            <b>{API_NAME[k]}</b>
            <span className="s" id={'apiSub' + k}>
              {API_DEF[k].sub + ' • ' + (cfg['api' + k].model || '—') + ' • ' + keyState(cfg, k) + (k === 1 && cfg.api1.auto && cfg.api1.key ? ' • অটো চালু' : '')}
            </span>
          </button>
        ))}
        <div className="row"><button id="apiPickClose" type="button" onClick={onPickClose}>বন্ধ</button></div>
      </Dialog>

      <Dialog id="dlgCfg" open={!!cfgN} onClose={onCfgClose}>
        <h3 id="aTitle">{API_NAME[n]}</h3>
        <small id="aSub">{API_DEF[n].sub + ' • বর্তমান পেইজ: ' + (stem || '—')}</small>
        <label htmlFor="aKey">API Key</label>
        <input id="aKey" ref={keyEl} type="password" placeholder={n === 2 ? 'খালি রাখলে ' + API_NAME[1] + '-এর Key ব্যবহার হবে' : 'AIza...'}
          autoCapitalize="off" autoComplete="off" spellCheck="false" value={f.key} onChange={edit('key')} />
        <small id="aKeyHint">{keyHint}</small>
        <label htmlFor="aModel">Model</label>
        <input id="aModel" type="text" placeholder="gemini-3.5-flash-lite" autoCapitalize="off" autoComplete="off" spellCheck="false" value={f.model} onChange={edit('model')} />
        <label htmlFor="aPrompt">Prompt</label>
        <textarea id="aPrompt" ref={promptEl} rows="8" spellCheck="false" value={f.prompt} onChange={edit('prompt')} />
        <small id="aPromptHint">
          {promptHint || (n === 1
            ? 'বর্তমান পেইজের ছবি এই প্রম্পটের সাথে পাঠানো হবে; ফল টেক্সট বক্সে বসবে।'
            : 'টেক্সট বক্সের লেখা প্রুফ হবে। প্রম্পটে {{TEXT}} লিখলে টেক্সট ঠিক ঐ জায়গায় বসবে; না লিখলে প্রম্পটের নিচে যুক্ত হবে।')}
        </small>
        <label htmlFor="aTemp">Temperature (0–2; OCR/প্রুফিংয়ে 0 ভালো)</label>
        <input id="aTemp" type="number" min="0" max="2" step="0.1" inputMode="decimal" value={f.temp} onChange={edit('temp')} />
        {n === 2 ? (
          <label className="chk" id="aImgRow">
            <input id="aImg" type="checkbox" checked={f.img} onChange={edit('img', true)} />
            <span>পেইজের ছবিও সাথে পাঠান (ছবির সাথে মিলিয়ে প্রুফ করার জন্য)</span>
          </label>
        ) : null}
        {n === 1 ? (
          <>
            <label className="chk" id="aAutoRow">
              <input id="aAuto" type="checkbox" checked={f.auto} onChange={edit('auto', true)} />
              <span>টেক্সট ফাঁকা পেইজ খুললে নিজে থেকেই চালান (অটো OCR)</span>
            </label>
            <small id="aAutoHint">শর্ত: Key দেওয়া আছে, পেইজের টেক্সট ফাঁকা (txt নেই/খালি, খসড়াও নেই), পেইজটি প্রুফড নয়। প্রতি পেইজে সেশনে একবারই অটো চলে।</small>
          </>
        ) : null}
        <small>কী, মডেল, প্রম্পট ইত্যাদি শুধু এই ব্রাউজারে (localStorage; এক্সটেনশনে extension storage-এও) থাকে। কিছু বদলালেই সাথে সাথে স্বয়ংক্রিয়ভাবে সংরক্ষিত হয় — একবার দিলে পরেও একই থাকবে। রিপোতে কখনো যায় না।</small>
        <div className="row">
          <button id="aDefault" type="button" title="প্রম্পট ডিফল্টে ফিরিয়ে আনুন"
            onClick={() => { const nf = { ...f, prompt: API_DEF[n].prompt }; setF(nf); persist(nf); toast('ডিফল্ট প্রম্পট বসানো ও সংরক্ষিত হয়েছে'); }}>ডিফল্ট প্রম্পট</button>
          <button id="aCancel" type="button" onClick={onCfgClose}>বন্ধ</button>
          <button id="aSave" type="button" onClick={() => { persist(f); onCfgClose(); toast(API_NAME[n] + ' সংরক্ষিত'); }}>সংরক্ষণ</button>
          <button id="aRun" type="button" className="primary" onClick={() => {
            const c = persist(f);
            if (!(c.key || (n === 2 && cfg.api1.key))) { setKeyHint('API Key দিন'); keyEl.current && keyEl.current.focus(); return; }
            if (!c.prompt) { setPromptHint('Prompt খালি রাখা যাবে না'); promptEl.current && promptEl.current.focus(); return; }
            onCfgClose(); onRun(n);
          }}>সংরক্ষণ ও চালান</button>
        </div>
      </Dialog>
    </>
  );
}
