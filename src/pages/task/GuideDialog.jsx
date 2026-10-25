/* প্রথমবারের গাইড: ধাপে ধাপে অ্যানিমেটেড ডায়ালগ। ছবি/অ্যানিমেশন guideScenes.js-এ; এখানে শুধু ধাপের নেভিগেশন ও ডায়ালগ।
   বাইরে থেকে ref.open() / ref.isOpen() ডাকা যায়। বন্ধ হলে onClosed() ডাকে (গাইড দেখা হয়েছে মনে রাখা + নোটিশ লোড — প্যারেন্টে)। */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import App from '../../lib/common.js';
import { GUIDE, playScene, stopAnim } from './guideScenes.js';

const { bn } = App;

const GuideDialog = forwardRef(function GuideDialog({ onClosed }, ref) {
  const dlg = useRef(null), stage = useRef(null);
  const [gI, setGI] = useState(0);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState(-1);   // সক্রিয় উপ-ধাপ ('all' = কমানো-মোশনে সব)

  useImperativeHandle(ref, () => ({
    open() { setGI(0); setPhase(-1); setOpen(true); if (!dlg.current.open) dlg.current.showModal(); },
    isOpen() { return !!(dlg.current && dlg.current.open); }
  }), []);

  // ধাপ বদলালে বা ডায়ালগ খুললে নতুন দৃশ্য চালু; বন্ধ হলে/আনমাউন্টে থামে
  useEffect(() => {
    if (!open || !stage.current) return undefined;
    setPhase(-1);
    playScene(GUIDE[gI].sc(), stage.current, setPhase);
    return () => stopAnim();
  }, [gI, open]);

  const g = GUIDE[gI], lastStep = gI === GUIDE.length - 1;
  const close = () => dlg.current.close();
  return (
    <dialog id="gDlg" ref={dlg} onClose={() => { stopAnim(); setOpen(false); onClosed(); }}>
      <div className="gstep" id="gStep">
        <span className="gtag">{g.tag}</span>
        <div className="gstage" id="gStage" ref={stage}></div>
        <h3>{g.t}</h3>
        <p>{g.d}</p>
        {g.subs.length > 0 && (
          <ol className="gsubs">
            {g.subs.map((s, i) => <li key={gI + '-' + i} className={phase === 'all' || phase === i ? 'on' : ''}><i>{bn(i + 1)}</i><span>{s}</span></li>)}
          </ol>
        )}
      </div>
      <div className="dots" id="gDots">{GUIDE.map((_, i) => <i key={i} className={i === gI ? 'on' : ''}></i>)}</div>
      <div className="acts">
        <button id="gSkip" hidden={lastStep} onClick={close}>পরে দেখব</button>
        <button id="gPrev" hidden={gI === 0} onClick={() => setGI((i) => Math.max(0, i - 1))}>আগের</button>
        <button id="gNext" className="primary" onClick={() => { if (lastStep) close(); else setGI((i) => i + 1); }}>{lastStep ? 'শুরু করি' : 'পরের'}</button>
      </div>
    </dialog>
  );
});

export default GuideDialog;
