/* Task পেইজের ছোট ডায়ালগ: দৈনিক লক্ষ্য, পেমেন্ট রিকোয়েস্ট, নোটিশ/ঘোষণা। খোলা/বন্ধ করে প্যারেন্ট (dlgRef দিয়ে showModal/close)। */
import App from '../../lib/common.js';
import { KIND } from './helpers.js';

const { bn, fmtDT } = App;

export function GoalDialog({ dlgRef, value, onValue, err, onCancel, onSave }) {
  return (
    <dialog id="glDlg" ref={dlgRef}>
      <h3>দৈনিক লক্ষ্য</h3>
      <p className="hint" style={{ margin: '0 0 10px' }}>প্রতিদিন কত পেইজ প্রুফড করতে চান? (এই ডিভাইসে সংরক্ষিত থাকবে)</p>
      <div className="chips" id="glChips">
        {[10, 20, 30, 50].map((g) => <button type="button" key={g} data-g={g} onClick={() => onValue(String(g))}>{bn(g)}</button>)}
      </div>
      <label className="f" htmlFor="glIn">অথবা নিজের সংখ্যা</label>
      {' '}<input id="glIn" type="number" inputMode="numeric" min="1" max="1000" step="1" value={value} onChange={(e) => onValue(e.target.value)} />
      <div className="err" id="glErr">{err}</div>
      <div className="acts">
        <button id="glCancel" onClick={onCancel}>বন্ধ</button>
        <button id="glSave" className="primary" onClick={onSave}>সংরক্ষণ</button>
      </div>
    </dialog>
  );
}

/* info: { avail, min, pmLabel, number, max } */
export function RequestDialog({ dlgRef, info, amt, onAmt, err, busy, onCancel, onSend }) {
  return (
    <dialog id="rqDlg" ref={dlgRef}>
      <h3>পেমেন্ট রিকোয়েস্ট</h3>
      <div className="kv"><span>উত্তোলনযোগ্য</span><b id="rqAvail">{info.avail}</b></div>
      <div className="kv"><span>ন্যূনতম রিকোয়েস্ট</span><b id="rqMin">{info.min}</b></div>
      <div className="kv"><span id="rqPmL">{info.pmLabel}</span><b id="rqPm">{info.number}</b></div>
      <label className="f" htmlFor="rqAmt">কত টাকা চাইবেন (৳)</label>
      {' '}<input id="rqAmt" type="number" inputMode="decimal" min="0" max={info.max} step="0.01" value={amt} onChange={(e) => onAmt(e.target.value)} />
      <p className="hint" style={{ margin: '8px 0 0' }}>অ্যাডমিন অনুমোদন দিয়ে এই নাম্বারে টাকা পাঠাবেন। নাম্বার ভুল হলে আগে প্রোফাইল থেকে ঠিক করুন।</p>
      <div className="err" id="rqErr">{err}</div>
      <div className="acts">
        <button id="rqCancel" onClick={onCancel}>বন্ধ</button>
        <button id="rqSend" className="primary" disabled={busy} onClick={onSend}>রিকোয়েস্ট পাঠান</button>
      </div>
    </dialog>
  );
}

export function NoticeDialog({ dlgRef, list, idx, onIdx, onClose, onClosed }) {
  const cur = list[idx], last = idx >= list.length - 1;
  return (
    <dialog id="nDlg" className="big" ref={dlgRef} onClose={onClosed}>
      <div className="row">
        <span className="badge gold" id="nKind">{cur ? KIND[cur.kind] || 'নোটিশ' : 'নোটিশ'}</span>
        <span className="sub" id="nDate" style={{ marginLeft: 'auto' }}>{cur ? fmtDT(cur.created_at) : ''}</span>
      </div>
      <h3 id="nTitle" style={{ marginTop: '8px' }}>{cur ? cur.title || '' : ''}</h3>
      <div className="nbody" id="nBody">{cur ? cur.body || '' : ''}</div>
      <div className="dots" id="nDots">{list.length > 1 ? list.map((_, i) => <i key={i} className={i === idx ? 'on' : ''}></i>) : null}</div>
      <div className="acts">
        <button id="nPrev" hidden={idx === 0} onClick={() => onIdx(Math.max(0, idx - 1))}>আগের</button>
        <button id="nNext" hidden={last} onClick={() => onIdx(Math.min(list.length - 1, idx + 1))}>পরের</button>
        <button id="nOk" className="primary" onClick={onClose}>{last ? 'ঠিক আছে' : 'বন্ধ করুন'}</button>
      </div>
    </dialog>
  );
}
