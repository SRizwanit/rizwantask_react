/* কার্যকলাপের লগ: ইউজার ও কাজ অনুযায়ী ফিল্টার, ১০০টি করে "আরও দেখান" */
import { useEffect, useRef, useState } from 'react';
import App from '../../lib/common.js';
import { Ic } from './ui.jsx';
import { ACT, SQLHINT, noTbl } from './helpers.js';

const { bn, fmtDT, enc } = App;
const PAGE = 100;

export default function LogTab({ d, openKey, filter, setFilter }) {
  const { users, uname } = d;
  const [rows, setRows] = useState([]), [more, setMore] = useState(false), [err, setErr] = useState('');
  const busy = useRef(false), off = useRef(0), rowsRef = useRef([]), f = useRef(filter); f.current = filter;

  async function load(reset) {
    if (busy.current) return; busy.current = true;
    if (reset) { rowsRef.current = []; off.current = 0; }
    try {
      const { user: u, act: a } = f.current;
      const r = await App.sb.get('activity_log?select=*' + (u ? '&user_id=eq.' + enc(u) : '') + (a ? '&action=eq.' + enc(a) : '') + '&order=created_at.desc,id.desc&limit=' + PAGE + '&offset=' + off.current);
      rowsRef.current = [...rowsRef.current, ...r]; off.current += r.length; setMore(r.length === PAGE); setErr('');
    } catch (e) { setErr(noTbl(e) ? 'activity_log টেবিল নেই — ' + SQLHINT : e.message); setMore(false); }
    finally { busy.current = false; }
    setRows(rowsRef.current);
  }
  useEffect(() => { if (openKey) load(true); }, [openKey, filter.user, filter.act]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section id="pLog">
      <div className="row" style={{ marginBottom: '12px' }}>
        <select id="lgUser" className="sm" style={{ maxWidth: '190px' }} value={filter.user} onChange={(e) => setFilter({ ...filter, user: e.target.value })}>
          <option value="">সব ইউজার</option>{users.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.phone})</option>)}
        </select>
        <select id="lgAct" className="sm" value={filter.act} onChange={(e) => setFilter({ ...filter, act: e.target.value })}>
          <option value="">সব কাজ</option>{Object.entries(ACT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span className="badge" id="lgCount">{bn(rows.length) + (more ? '+' : '') + ' টি'}</span>
        {' '}<button id="lgReload" className="sm" title="রিফ্রেশ" onClick={() => load(true)}><Ic n="refresh" /></button>
      </div>
      <div className="tbw">
        <table className="tb" id="lgTbl">
          {err ? <tbody><tr><td><div className="noticebox bad">{err}</div></td></tr></tbody> : (
            <>
              <thead><tr><th>সময়</th><th>ইউজার</th><th>কাজ</th><th>বিবরণ</th></tr></thead>
              <tbody>
                {rows.length ? rows.map((x, i) => (
                  <tr key={x.id != null ? x.id : i}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDT(x.created_at)}</td>
                    <td>{x.user_name || uname(x.user_id)}</td>
                    <td><span className={'badge ' + (/^admin_/.test(x.action) ? 'gold' : '')}>{ACT[x.action] || x.action}</span></td>
                    <td className="sub" style={{ overflowWrap: 'anywhere' }}>{x.detail || ''}</td>
                  </tr>
                )) : <tr><td colSpan="4" className="sub" style={{ textAlign: 'center', padding: '18px' }}>কোনো লগ নেই</td></tr>}
              </tbody>
            </>
          )}
        </table>
      </div>
      <button id="lgMore" className="block" style={{ marginTop: '10px' }} hidden={!more} onClick={() => load(false)}>আরও দেখান</button>
    </section>
  );
}
