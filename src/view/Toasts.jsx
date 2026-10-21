import { useSyncExternalStore } from 'react';

export default function Toasts({ toaster }) {
  const s = useSyncExternalStore(toaster.subscribe, toaster.getSnapshot);
  return (
    <>
      <div id="toast" className={s.toast.cls}>{s.toast.msg}</div>
      <div id="ltoast" className={s.lt.show ? 'show' : ''} role="status" aria-live="polite" aria-hidden={s.lt.show ? 'false' : 'true'}>
        <span className="lt-spin" aria-hidden="true" />
        <span className="lt-txt">
          <b id="ltTitle">{s.lt.title}</b>
          <small id="ltStep">{s.lt.step}</small>
        </span>
        <b className="lt-pct" id="ltPct">{Math.round(s.lt.pct)}%</b>
        <span className="lt-bar" style={{ width: s.lt.pct + '%' }} />
      </div>
    </>
  );
}
