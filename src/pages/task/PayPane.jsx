/* পেমেন্ট ট্যাব: মোট আয়ের টাইল, আয়ের পূর্বাভাস, পেমেন্ট রিকোয়েস্ট, ইতিহাস, কিতাব অনুযায়ী আয়, সংশোধন দরকার, ভুলের হারের সতর্কতা। */
import Icon from '../../components/Icon.jsx';
import App from '../../lib/common.js';
import { PM, minPayout, rateTxt } from './helpers.js';

const { bn, money, fmtDT, enc, r2 } = App;

const Skeleton = () => Array.from({ length: 4 }, (_, i) => (
  <div className="tile sk" key={i}><span className="skl w60"></span><span className="skl w80"></span></div>
));

function SegBar({ a, p, c, tot }) {
  const t = Math.max(tot, a + p + c, 1);
  return <div className="pg seg3"><i className="a" style={{ width: (a / t * 100) + '%' }}></i><i className="p" style={{ width: (p / t * 100) + '%' }}></i><i className="c" style={{ width: (c / t * 100) + '%' }}></i></div>;
}

/* আয়ের পূর্বাভাস: রিভিউ বাকি পেইজ অনুমোদিত হলে কত যোগ হবে */
function Forecast({ s, min, rateOf }) {
  const reviewedN = s.approved + s.correction, apr = reviewedN >= 3 ? s.approved / reviewedN : null, dr = rateOf(null);
  const allEarn = r2(s.earned + s.pendingAmt), allAvail = r2(s.available + s.pendingAmt);
  if (s.pending > 0) {
    const tip = s.available >= min ? 'এখনই রিকোয়েস্ট করার মতো টাকা আছে।'
      : allAvail >= min ? 'রিভিউ হয়ে গেলে ন্যূনতম পেমেন্ট (' + money(min) + ') ছুঁয়ে রিকোয়েস্ট করতে পারবেন।'
        : 'ন্যূনতম পেমেন্ট (' + money(min) + ') ছুঁতে আরও ≈ ' + bn(Math.ceil((min - allAvail) / dr)) + ' পেইজ প্রুফ করতে হবে।';
    return (
      <div className="card fc"><b>আয়ের পূর্বাভাস</b>
        <div className="fr"><span>{'রিভিউ বাকি ' + bn(s.pending) + ' পেইজ সব অনুমোদিত হলে যোগ হবে'}</span><b className="up">{'≈ +' + money(s.pendingAmt)}</b></div>
        <div className="fr"><span>তখন মোট আয় হবে</span><b>{'≈ ' + money(allEarn)}</b></div>
        <div className="fr"><span>তখন উত্তোলনযোগ্য হবে</span><b>{'≈ ' + money(allAvail)}</b></div>
        {apr != null && apr < 1 && <div className="fr"><span>{'আপনার অনুমোদনের হার ' + bn(Math.round(apr * 100)) + '% — সেই হিসাবে যোগ হবে'}</span><b>{'≈ +' + money(s.pendingAmt * apr)}</b></div>}
        <p className="hint fh">{tip + ' অ্যাডমিন অনুমোদন না দেওয়া পর্যন্ত এটি শুধু আনুমানিক হিসাব।'}</p>
      </div>
    );
  }
  return (
    <div className="card fc"><b>আয়ের পূর্বাভাস</b>
      <p className="hint" style={{ margin: '8px 0 0' }}>{'এখন রিভিউ বাকি কোনো পেইজ নেই। আরও পেইজ প্রুফড করলে অনুমোদিত হওয়ার পর প্রতি পেইজে ≈ ' + rateTxt(dr) + ' যোগ হবে'
        + (s.available < min ? '; ন্যূনতম পেমেন্ট (' + money(min) + ') ছুঁতে আরও ≈ ' + bn(Math.ceil((min - s.available) / dr)) + ' পেইজ দরকার' : '') + '।'}</p>
    </div>
  );
}

export default function PayPane({ hidden, me, S, sum, booksById, proofs, pays, rateOf, reqBusy, onRequest }) {
  const s = sum, min = minPayout(S);
  const ids = s ? Object.keys(s.byBook) : [];
  const corr = s ? proofs.filter((p) => p.review_status === 'correction') : [];
  const hasReq = pays.some((x) => x.status === 'requested');
  const ok = !!s && s.available >= min && s.available > 0;
  let hint = '';
  if (s) {
    hint = !me.payment_number ? 'আগে প্রোফাইল থেকে পেমেন্ট নাম্বার দিন।'
      : ok ? 'উত্তোলনযোগ্য ' + money(s.available) + ' — রিকোয়েস্ট পাঠালে অ্যাডমিন অনুমোদন দিয়ে ' + (PM[me.payment_method] || '') + ' নাম্বার ' + me.payment_number + '-এ পাঠাবেন।'
        : 'ন্যূনতম ' + money(min) + ' হলে রিকোয়েস্ট করা যাবে। আরও ' + money(Math.max(0, min - s.available)) + ' আয় দরকার।' + (hasReq ? ' (একটি রিকোয়েস্ট অপেক্ষমাণ আছে)' : '');
  }
  // ভুলের হার সতর্কতা
  let warn = null;
  if (s) {
    const reviewed = s.approved + s.correction, wp = Number(S.warn_pct != null ? S.warn_pct : 20), wm = Number(S.warn_min != null ? S.warn_min : 5);
    const pct = reviewed ? Math.round(s.correction / reviewed * 100) : 0;
    if (reviewed >= wm && pct >= wp) warn = { reviewed, pct };
  }

  return (
    <section id="pPay" hidden={hidden} style={{ maxWidth: '560px', margin: '0 auto' }}>
      <div id="warnBox">
        {warn && <div className="noticebox bad"><b>সতর্কতা:</b> {'রিভিউ হওয়া ' + bn(warn.reviewed) + 'টি পেইজের মধ্যে ' + bn(s.correction) + 'টিতে ভুল ধরা পড়েছে (' + bn(warn.pct) + '%)। দয়া করে মনোযোগ দিয়ে প্রুফ করুন — ভুল পেইজে আয় গোনা হয় না।'}</div>}
      </div>
      <div className="tiles" id="payTiles">
        {!s ? <Skeleton /> : (<>
          <div className="tile hl"><span className="tn">{money(s.earned)}</span><span className="tl">{'মোট আয় (অনুমোদিত ' + bn(s.approved) + ' পেইজ)'}</span></div>
          <div className="tile"><span className="tn">{money(s.available)}</span><span className="tl">উত্তোলনযোগ্য (বাকি)</span></div>
          <div className="tile"><span className="tn">{money(s.paid)}</span><span className="tl">এ পর্যন্ত পেয়েছেন</span></div>
          <div className="tile"><span className="tn">{money(s.requested)}</span><span className="tl">রিকোয়েস্টে আছে (অপেক্ষমাণ)</span></div>
          <div className="tile"><span className="tn">{bn(s.pending)}</span><span className="tl">{'রিভিউ বাকি পেইজ (' + money(s.pendingAmt) + ')'}</span></div>
          <div className="tile"><span className="tn">{bn(s.correction)}</span><span className="tl">সংশোধন দরকার</span></div>
        </>)}
      </div>
      <div id="fcBox">{s && <Forecast s={s} min={min} rateOf={rateOf} />}</div>

      <div className="card" style={{ marginBottom: '14px' }}>
        <div className="row">
          <b style={{ flex: 1 }}>পেমেন্ট রিকোয়েস্ট</b>
          <span className="badge gold" id="rateInfo">{s ? 'ডিফল্ট রেট ' + rateTxt(rateOf(null)) + ' / পেইজ' : ''}</span>
        </div>
        <p className="hint" id="reqHint" style={{ margin: '8px 0 12px' }}>{hint}</p>
        <button id="bReq" className="primary block" disabled={reqBusy || (!!s && (!ok || !me.payment_number))} onClick={onRequest}>
          <span><Icon name="wallet" /></span>পেমেন্ট রিকোয়েস্ট করুন
        </button>
      </div>

      <div className="card" style={{ marginBottom: '14px' }}>
        <b>পেমেন্ট ইতিহাস</b>
        <div id="payList" style={{ marginTop: '10px' }}>
          {s && (pays.length ? pays.map((x, i) => {
            const st = x.status === 'paid' ? ['পরিশোধিত', 'ok'] : x.status === 'rejected' ? ['বাতিল', 'bad'] : ['অপেক্ষমাণ (বাকি)', 'warn'];
            return (
              <div className="li" key={x.id != null ? x.id : i}>
                <div className="row"><b style={{ flex: 1 }}>{money(x.amount)}</b><span className={'badge ' + st[1]}>{st[0]}</span></div>
                <div className="meta">{'রিকোয়েস্ট: ' + fmtDT(x.created_at)}
                  {x.processed_at ? <><br />{(x.status === 'paid' ? 'পরিশোধ' : 'প্রক্রিয়া') + ': ' + fmtDT(x.processed_at)}</> : null}
                  <br />{(PM[x.method] || x.method || '') + ' ' + (x.number || '')}{x.pages ? ' • ' + bn(x.pages) + ' পেইজ' : ''}
                  {x.note ? <><br />{'নোট: ' + x.note}</> : null}</div>
              </div>
            );
          }) : <div className="empty" style={{ padding: '18px 6px' }}>এখনো কোনো পেমেন্ট ইতিহাস নেই</div>)}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '14px' }}>
        <b>কিতাব অনুযায়ী আয়</b>
        <p className="hint" style={{ margin: '4px 0 10px' }}>আয় গোনা হয় শুধু অ্যাডমিন যে পেইজ <b>অনুমোদিত</b> করেছেন সেগুলোর।</p>
        <div id="bookEarn">
          {s && (ids.length ? ids.map((id) => {
            const b = booksById[id], x = s.byBook[id];
            return (
              <div className="kv" style={{ display: 'block' }} key={id}>
                <div className="row" style={{ justifyContent: 'space-between' }}><b>{b ? b.name : 'কিতাব'}</b><b>{money(x.earned)}</b></div>
                <SegBar a={x.approved} p={x.pending} c={x.correction} tot={x.n} />
                <div className="pgt"><span>{'অনুমোদিত ' + bn(x.approved) + ' • বাকি ' + bn(x.pending) + ' • সংশোধন ' + bn(x.correction)}</span><span>{'রেট ' + rateTxt(rateOf(b))}</span></div>
              </div>
            );
          }) : <div className="empty" style={{ padding: '18px 6px' }}>এখনো কোনো পেইজ প্রুফড করেননি</div>)}
        </div>
      </div>

      <div className="card" id="corrCard" hidden={!corr.length}>
        <b>সংশোধন দরকার</b>
        <p className="hint" style={{ margin: '4px 0 10px' }}>অ্যাডমিন এই পেইজগুলো সংশোধন করতে বলেছেন। ঠিক করে আবার <b>প্রুফড</b> চাপলে পুনরায় রিভিউতে যাবে।</p>
        <div id="corrList">
          {corr.slice(0, 50).map((p, i) => {
            const b = booksById[String(p.book_id)];
            return (
              <div className="li" key={p.book_id + '/' + p.stem + '/' + i}>
                <div className="row"><b style={{ flex: 1 }}>{(b ? b.name : 'কিতাব') + ' — ' + p.stem}</b><a className="badge bad" href={App.base + 'view?book=' + enc(p.book_id) + '&page=' + enc(p.stem)}>খুলুন</a></div>
                {p.review_note ? <div className="meta">{'অ্যাডমিন: ' + p.review_note}</div> : null}
              </div>
            );
          })}
          {corr.length > 50 && <div className="hint">{'আরও ' + bn(corr.length - 50) + 'টি আছে…'}</div>}
        </div>
      </div>
    </section>
  );
}
