/* "কোন সার্ভিসে শুনবেন?" ডায়ালগ: "শুনুন" চাপলে (নতুন করে শুরুর সময়) প্রতিবার আসে; সবার জন্য দৃশ্যমান (শুধু অ্যাডমিনের নয়)।
   প্রতিটি সার্ভিসের কনফিগ (কী, ভয়েস, URL) ব্রাউজারে থেকে যায় (cfg.ttsx) — আবার টাইপ করতে হয় না। */
import { useEffect, useLayoutEffect, useState } from 'react';
import Dialog from './Dialog.jsx';
import Dropdown from './Dropdown.jsx';
import { Ic } from './Sprite.jsx';
import { TS_ORDER, TTS_NAME, XENG, hasTTS, tsMeta, tsValidate, voiceOptions, voiceValue } from './ttsEngines.js';

export default function TtsDialog({ open, onClose, cfg, setCfg, voices, onGo }) {
  const [sel, setSel] = useState('auto');
  const [err, setErr] = useState('');
  const [vals, setVals] = useState({});   // 'সার্ভিস.ঘর' → ফর্মে দেখানো (না-ট্রিম) মান

  useLayoutEffect(() => {
    if (!open) return;
    setSel(TS_ORDER.includes(cfg.ttsEngine) ? cfg.ttsEngine : 'auto');   // শেষ বাছাই আগে থেকে চিহ্নিত
    setErr('');
    const v = {};
    Object.keys(XENG).forEach((id) => XENG[id].fields.forEach((f) => { const x = cfg.ttsx[id]; v[id + '.' + f.k] = x && x[f.k] != null ? x[f.k] : ''; }));
    setVals(v);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {   // বাছাই করা কার্ড দৃশ্যে আনা
    if (!open) return undefined;
    const t = setTimeout(() => { const el = document.getElementById('tsItem_' + sel); if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 30);
    return () => clearTimeout(t);
  }, [open, sel]);

  const setX = (id, k, v) => {
    setVals((o) => ({ ...o, [id + '.' + k]: v }));
    setCfg((c) => ({ ...c, ttsx: { ...c.ttsx, [id]: { ...c.ttsx[id], [k]: v.trim() } } }));
  };
  const setVoice = (l) => (v) => setCfg((c) => ({ ...c, tts: { ...c.tts, [l]: v } }));

  const panel = (id) => {
    if (id === 'device') {
      return (
        <>
          {!hasTTS ? <small>এই ব্রাউজারে ফোনের টেক্সট-টু-স্পিচ নেই।</small> : null}
          {[['bn', 'tdVoiceBn'], ['ar', 'tdVoiceAr'], ['en', 'tdVoiceEn']].map(([l, sid]) => {
            const o = voiceOptions(voices, l);
            return (
              <div key={l}>
                <label htmlFor={sid}>ফোনের ভয়েস — {TTS_NAME[l]}</label>
                <Dropdown id={sid} value={voiceValue(o, (cfg.tts || {})[l] || '')} options={o} onChange={setVoice(l)} />
              </div>
            );
          })}
          <small>ভয়েস ডিভাইসের টেক্সট-টু-স্পিচ ইঞ্জিন থেকে আসে। "স্বয়ংক্রিয়" রাখলে ডিভাইসের সেরা মিল ব্যবহার হবে। বাংলা ভয়েস না দেখালে ফোনের সেটিংসে ভয়েস ডেটা ডাউনলোড করুন, বা ডিভাইসের TTS ইঞ্জিন বদলান।</small>
        </>
      );
    }
    const M = XENG[id];
    if (!M) return null;
    return (
      <>
        {M.fields.map((f) => {
          const fid = 'tx_' + id + '_' + f.k, v = vals[id + '.' + f.k] != null ? vals[id + '.' + f.k] : '';
          return (
            <div key={f.k}>
              <label htmlFor={fid}>{f.label}</label>
              {f.t === 'sel'
                ? <Dropdown id={fid} value={v} options={f.opts.map(([value, label]) => ({ value, label }))} onChange={(nv) => setX(id, f.k, nv)} />
                : <input id={fid} type={f.t === 'pw' ? 'password' : 'text'} autoCapitalize="off" autoComplete="off" spellCheck={false}
                    placeholder={f.ph || undefined} value={v} onChange={(e) => setX(id, f.k, e.target.value)} />}
            </div>
          );
        })}
        {M.hint ? <small>{M.hint}</small> : null}
      </>
    );
  };

  return (
    <Dialog id="dlgTts" open={open} onClose={onClose}>
      <h3>কোন সার্ভিসে শুনবেন?</h3>
      <small>একটি সার্ভিস বেছে নিন, দরকার হলে তার কনফিগ (কী / ভয়েস / URL) দিন, তারপর "শুনুন" চাপুন। কনফিগ এই ব্রাউজারে থেকে যায় (আবার লিখতে হবে না); শোনা শুরুর সময় প্রতিবার এই তালিকা আসবে, যাতে সার্ভিস বদলে নিতে পারেন।</small>
      <div id="tsList">
        {TS_ORDER.map((id) => {
          const m = tsMeta(id);
          return (
            <div key={id} id={'tsItem_' + id} className={'tsItem' + (id === sel ? ' sel' : '')} data-id={id}>
              <button type="button" className="tsPick" onClick={() => { setSel(id); setErr(''); }}>
                <b><span className="tsDot" />{m.name}</b>
                <span className="s">{m.desc}</span>
                <span className="tsTags">{(m.tags || []).map(([t, k]) => <span key={t} className={'tsTag ' + k}>{t}</span>)}</span>
              </button>
              <div className="tsPanel">{panel(id)}</div>
            </div>
          );
        })}
      </div>
      <small id="tsErr" hidden={!err} style={{ color: 'var(--err)', fontWeight: 600 }}>{err}</small>
      <div className="row">
        <button id="tsCancel" type="button" onClick={onClose}>বন্ধ</button>
        <button id="tsGo" type="button" className="primary" onClick={() => { const e = tsValidate(sel, cfg); setErr(e); if (!e) onGo(sel); }}>
          <Ic n="play" />
          <span>শুনুন</span>
        </button>
      </div>
    </Dialog>
  );
}
