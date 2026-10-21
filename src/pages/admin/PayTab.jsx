/* পেমেন্ট রিকোয়েস্ট: অপেক্ষমাণ / পরিশোধিত / বাতিল — পরিশোধ চিহ্নিত করলে বা বাতিল করলে ইউজারকে নোটিশ যায় */
import { useEffect, useState } from 'react';
import App from '../../lib/common.js';
import { Chips, Empty, Ic, Tile } from './ui.jsx';
import { PM, SQLHINT, sendNotice } from './helpers.js';

const { bn, money, fmtDT, toast, enc } = App;
const sum = (a) => a.reduce((s, x) => s + Number(x.amount || 0), 0);

export default function PayTab({ d, openKey, ask }) {
  const { pays, payTbl, uname, userSum } = d;
  const [pyF, setPyF] = useState('requested'), [loading, setLoading] = useState(false), [busyId, setBusyId] = useState('');

  useEffect(() => {
    if (!openKey) return;
    setLoading(true);
    Promise.all([d.loadPaysQuiet(), d.loadProofs(true)]).finally(() => setLoading(false));
  }, [openKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (a, x) => {
    if (a === 'copy') { try { await navigator.clipboard.writeText(x.number || ''); toast('নাম্বার কপি হয়েছে'); } catch (err) { toast(x.number || '', false); } return; }
    setBusyId(String(x.id));
    try {
      const now = new Date().toISOString();
      if (a === 'paid') {
        const note = await ask({ title: 'পেমেন্ট নিশ্চিত করুন', label: money(x.amount) + ' → ' + (PM[x.method] || '') + ' ' + x.number + ' (টাকা পাঠানোর পরেই চিহ্নিত করুন)। ট্রানজেকশন আইডি / নোট (ঐচ্ছিক):', ok: 'পরিশোধিত চিহ্নিত করুন' });
        if (note == null) return;
        const sm = userSum(x.user_id);
        if (sm.earned < sm.paid + Number(x.amount) && !window.confirm('সতর্কতা: ইউজারের অনুমোদিত আয় (' + money(sm.earned) + ') পরিশোধিত + এই রিকোয়েস্টের (' + money(sm.paid + Number(x.amount)) + ') চেয়ে কম। তবুও পরিশোধিত চিহ্নিত করবেন?')) return;
        await App.sb.patch('payments?id=eq.' + enc(x.id), { status: 'paid', processed_at: now, note: note || null });
        d.patchPay(x.id, { status: 'paid', processed_at: now, note: note || null });
        try { await sendNotice({ user_id: x.user_id, kind: 'payment', title: 'পেমেন্ট পাঠানো হয়েছে', body: money(x.amount) + ' আপনার ' + (PM[x.method] || '') + ' নাম্বার ' + x.number + '-এ পাঠানো হয়েছে।' + (note ? '\nনোট: ' + note : '') }); } catch (err) { /* ignore */ }
        App.log('admin_pay', uname(x.user_id) + ' • ' + money(x.amount)); toast('পরিশোধিত চিহ্নিত হয়েছে');
      } else if (a === 'rej') {
        const why = await ask({ title: 'রিকোয়েস্ট বাতিল', label: 'বাতিলের কারণ (ইউজার দেখতে পাবে)', ok: 'বাতিল করুন' }); if (why == null) return;
        await App.sb.patch('payments?id=eq.' + enc(x.id), { status: 'rejected', processed_at: now, note: why || null });
        d.patchPay(x.id, { status: 'rejected', processed_at: now, note: why || null });
        try { await sendNotice({ user_id: x.user_id, kind: 'payment', title: 'পেমেন্ট রিকোয়েস্ট বাতিল হয়েছে', body: money(x.amount) + ' এর রিকোয়েস্টটি বাতিল হয়েছে।' + (why ? '\nকারণ: ' + why : '') + '\nটাকা আপনার উত্তোলনযোগ্য ব্যালেন্সে ফিরে গেছে।' }); } catch (err) { /* ignore */ }
        App.log('admin_reject', uname(x.user_id) + ' • ' + money(x.amount) + (why ? ' • ' + why : '')); toast('বাতিল করা হয়েছে');
      }
    } catch (err) { toast(err.message, true); } finally { setBusyId(''); }
  };

  if (!payTbl) {
    return <section id="pPay"><div className="tiles" id="pyTiles"></div><div id="pyList"><div className="noticebox bad">payments টেবিল নেই — {SQLHINT}।</div></div></section>;
  }
  const rq = pays.filter((x) => x.status === 'requested'), pd = pays.filter((x) => x.status === 'paid');
  const list = pays.filter((x) => !pyF || x.status === pyF);
  return (
    <section id="pPay">
      <div className="tiles" id="pyTiles">
        <Tile hl n={bn(rq.length)} l={'অপেক্ষমাণ রিকোয়েস্ট (' + money(sum(rq)) + ')'} />
        <Tile n={money(sum(pd))} l={'মোট পরিশোধিত (' + bn(pd.length) + 'টি)'} />
        <Tile n={bn(pays.filter((x) => x.status === 'rejected').length)} l="বাতিল" />
      </div>
      <Chips id="pyChips" items={[['requested', 'অপেক্ষমাণ'], ['paid', 'পরিশোধিত'], ['rejected', 'বাতিল'], ['', 'সব']]} value={pyF} onPick={setPyF} />
      <div id="pyList">
        {loading ? <div className="spin on"></div> : list.length ? list.map((x) => {
          const st = x.status === 'paid' ? ['পরিশোধিত', 'ok'] : x.status === 'rejected' ? ['বাতিল', 'bad'] : ['অপেক্ষমাণ', 'warn'], sm = userSum(x.user_id), busy = busyId === String(x.id);
          return (
            <div className="li" key={x.id}>
              <div className="row"><b style={{ flex: 1 }}>{uname(x.user_id) || x.user_name}</b><span className={'badge ' + st[1]}>{st[0]}</span></div>
              <div className="meta">
                <b style={{ fontSize: '17px', color: 'var(--fg)' }}>{money(x.amount)}</b><br />
                {PM[x.method] || x.method || ''}: <b>{x.number || '-'}</b> <button className="sm" style={{ padding: '2px 8px' }} onClick={() => act('copy', x)}>কপি</button><br />
                রিকোয়েস্ট: {fmtDT(x.created_at)}{x.pages ? ' • অনুমোদিত ' + bn(x.pages) + ' পেইজ' : ''}
                {x.processed_at ? <><br />প্রক্রিয়া: {fmtDT(x.processed_at)}</> : null}
                {x.note ? <><br />নোট: {x.note}</> : null}
                <br />ইউজারের হিসাব: মোট আয় {money(sm.earned)} • পরিশোধিত {money(sm.paid)} • রিকোয়েস্টে {money(sm.requested)}
              </div>
              {x.status === 'requested' ? (
                <div className="row">
                  <button className="sm ok" disabled={busy} onClick={() => act('paid', x)}><Ic n="check" />পরিশোধ করেছি (অনুমোদন)</button>
                  <button className="sm danger" disabled={busy} onClick={() => act('rej', x)}><Ic n="x" />বাতিল</button>
                </div>
              ) : null}
            </div>
          );
        }) : <Empty>কোনো পেমেন্ট নেই</Empty>}
      </div>
    </section>
  );
}
