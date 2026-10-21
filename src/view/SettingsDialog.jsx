/* সেটিংস ডায়ালগ (শুধু অ্যাডমিনের জন্য দৃশ্যমান): ফর্মে যা বদলাবে সাথে সাথে সংরক্ষিত হয় (স্বয়ংক্রিয় সংরক্ষণ)। */
import { useLayoutEffect, useState } from 'react';
import Dialog from './Dialog.jsx';
import Dropdown from './Dropdown.jsx';
import { repoPaths } from './config.js';
import { TTS_NAME, voiceOptions, voiceValue } from './ttsEngines.js';
import { normRepo, trimSl } from './utils.js';

const ENGINES = [
  ['auto', 'স্বয়ংক্রিয় (ফোনের TTS; না চললে Google অনলাইন)'], ['device', 'শুধু ফোনের TTS'],
  ['google', 'শুধু Google অনলাইন (ইন্টারনেট লাগবে)'], ['edge', 'শুধু Edge TTS (Microsoft)'],
  ['poll', 'শুধু Pollinations'], ['server', 'শুধু Piper / নিজস্ব সার্ভার'],
  ['watson', 'শুধু IBM Watson'], ['fish', 'শুধু Fish Audio']
].map(([value, label]) => ({ value, label }));

/* ফর্মের ঘর → কনফিগের পরিবর্তন (অবৈধ হলে null) */
const FIELD_PATCH = {
  repo: (v) => { const r = normRepo(v); return /^[^/\s]+\/[^/\s]+$/.test(r) ? { repo: r } : null; },
  branch: (v) => ({ branch: v.trim() }),
  token: (v) => ({ token: v.trim() }),
  book: (v) => ({ book: trimSl(v) }),
  proofDir: (v) => ({ proofDir: trimSl(v) }),
  pages: (v) => ({ pagesDir: v.trim().replace(/^\/+|\/+$/g, '') || 'pages' }),
  texts: (v) => ({ textsDir: v.trim().replace(/^\/+|\/+$/g, '') || 'texts' }),
  proof: (v) => ({ proofFile: v.trim().replace(/^\/+/, '') || 'proofed.json' })
};
export const normalizedPatch = (f) => Object.keys(FIELD_PATCH).reduce((o, k) => ({ ...o, ...(FIELD_PATCH[k](f[k]) || {}) }), {});

export default function SettingsDialog({ open, onClose, cfg, setCfg, voices, onEngine, onClearToken, onSave }) {
  const [f, setF] = useState({ repo: '', branch: '', token: '', book: '', proofDir: '', pages: '', texts: '', proof: '' });

  useLayoutEffect(() => {   // খোলার সময় সংরক্ষিত মান ফর্মে বসানো
    if (!open) return;
    setF({ repo: cfg.repo, branch: cfg.branch, token: cfg.token, book: cfg.book || '', proofDir: repoPaths(cfg).proofDirName,
      pages: cfg.pagesDir, texts: cfg.textsDir, proof: cfg.proofFile });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const edit = (k) => (e) => {
    const v = e.target.value;
    setF((o) => ({ ...o, [k]: v }));
    const p = FIELD_PATCH[k](v); if (p) setCfg(p);
  };
  const P = repoPaths(cfg);
  const vopts = (l) => voiceOptions(voices, l);
  const setVoice = (l) => (v) => setCfg((c) => ({ ...c, tts: { ...c.tts, [l]: v } }));

  return (
    <Dialog id="dlg" open={open} onClose={onClose}>
      <h3>সেটিংস</h3>
      <label htmlFor="cRepo">রিপো (owner/repo)</label>
      <input id="cRepo" type="text" placeholder="SunniPedia/pdftojpg" autoCapitalize="off" autoComplete="off" value={f.repo} onChange={edit('repo')} />
      <label htmlFor="cBranch">ব্রাঞ্চ (খালি = ডিফল্ট ব্রাঞ্চ)</label>
      <input id="cBranch" type="text" placeholder="main" autoCapitalize="off" autoComplete="off" value={f.branch} onChange={edit('branch')} />
      <label htmlFor="cToken">GitHub Access Token (এখানে বসান)</label>
      <input id="cToken" type="password" placeholder="github_pat_..." autoCapitalize="off" autoComplete="off" value={f.token} onChange={edit('token')} />
      <small>
        টোকেন শুধু এই ব্রাউজারে সংরক্ষিত থাকে (localStorage; এক্সটেনশনে অতিরিক্ত extension storage-এও)। এখানে যা-ই লিখুন/বদলান, সাথে সাথে স্বয়ংক্রিয়ভাবে সংরক্ষিত হয় — প্রতিবার দিতে হবে না। HTML ফাইলে বা রিপোতে কখনো লিখবেন না। সেভ/পুশ করতে টোকেনে এই রিপোর জন্য <b>Contents: Read and write</b> অনুমতি লাগবে।
      </small>
      <label htmlFor="cBook">কিতাবের নাম (prefix) — খালি রাখলে আগের মতো pages / texts / proofed.json</label>
      <input id="cBook" type="text" placeholder="যেমন: bukhari" autoCapitalize="off" autoComplete="off" value={f.book} onChange={edit('book')} />
      <label htmlFor="cPages">ছবির ফোল্ডার (মূল নাম)</label>
      <input id="cPages" type="text" autoCapitalize="off" value={f.pages} onChange={edit('pages')} />
      <label htmlFor="cTexts">টেক্সট ফোল্ডার (মূল নাম; না থাকলে প্রথম সেভে নিজে থেকে তৈরি হবে)</label>
      <input id="cTexts" type="text" autoCapitalize="off" value={f.texts} onChange={edit('texts')} />
      <label htmlFor="cProofDir">প্রুফড ফোল্ডার (প্রুফড তালিকা এর ভেতরে থাকবে; খালি = রিপোর রুটে)</label>
      <input id="cProofDir" type="text" placeholder="proofed" autoCapitalize="off" value={f.proofDir} onChange={edit('proofDir')} />
      <label htmlFor="cProof">প্রুফড তালিকার ফাইল (মূল নাম; না থাকলে তৈরি হবে)</label>
      <input id="cProof" type="text" autoCapitalize="off" value={f.proof} onChange={edit('proof')} />
      <small id="cPreview">এখন ব্যবহার হবে → ছবি: {P.pagesDir}/ • টেক্সট: {P.textsDir}/ • প্রুফড: {P.proofPath}</small>
      <hr />
      <label htmlFor="cEngine">শোনার ইঞ্জিন</label>
      <Dropdown id="cEngine" value={cfg.ttsEngine} options={ENGINES} onChange={onEngine} />
      <small>Google অনলাইন অডিও একটি অনানুষ্ঠানিক সার্ভিস (Google Translate-এর অডিও), তাই যেকোনো সময় বন্ধ বা সীমিত হতে পারে। এতে ভয়েস বাছা যায় না; ভাষা (বাংলা/আরবি/ইংরেজি) নিজে থেকে চেনা হয়।</small>
      <small>এখানে শেষ বাছাই দেখায়। "শুনুন" বোতাম চাপলে প্রতিবার সার্ভিস বাছার ডায়ালগ আসে (সেখানে সব সার্ভিসের কনফিগও আছে)।</small>
      {[['bn', 'cVoiceBn'], ['ar', 'cVoiceAr'], ['en', 'cVoiceEn']].map(([l, id]) => (
        <div key={l}>
          <label htmlFor={id}>ফোনের ভয়েস — {TTS_NAME[l]}</label>
          <Dropdown id={id} value={voiceValue(vopts(l), (cfg.tts || {})[l] || '')} options={vopts(l)} onChange={setVoice(l)} />
        </div>
      ))}
      <small>ফোনের ভয়েস ডিভাইসের টেক্সট-টু-স্পিচ ইঞ্জিন থেকে আসে (শুধু ফোনের TTS ব্যবহার হলে প্রযোজ্য)। "স্বয়ংক্রিয়" রাখলে ডিভাইসের সেরা মিল ব্যবহার হবে।</small>
      <div className="row">
        <button id="cClearTok" onClick={() => { setF((o) => ({ ...o, token: '' })); onClearToken(); }}>টোকেন মুছুন</button>
        <button id="cCancel" onClick={onClose}>বন্ধ</button>
        <button id="cSave" className="primary" onClick={() => onSave(f)}>সংরক্ষণ ও সংযোগ</button>
      </div>
    </Dialog>
  );
}
