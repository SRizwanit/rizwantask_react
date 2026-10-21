/* র‍্যাংক ট্যাব: লিডারবোর্ড (আজ / এই সপ্তাহ / সব সময়), নিজের অবস্থান। */
import Icon from '../../components/Icon.jsx';
import App from '../../lib/common.js';

const { bn } = App;
const LABEL = { day: 'আজ', week: 'এই সপ্তাহে', all: 'সব মিলিয়ে' };
const CHIPS = [['day', 'আজ'], ['week', 'এই সপ্তাহ'], ['all', 'সব সময়']];

function Row({ r, i, meId, names }) {
  const mine = r.id === meId;
  return (
    <div className={'lbr ' + (mine ? 'me ' : '') + (i < 3 ? 'r' + (i + 1) : '')}>
      <span className="rk">{bn(i + 1)}</span>
      <span className="nm">{(names[r.id] || 'ইউজার') + (mine ? ' (আপনি)' : '')}</span>
      <span className="ct">{bn(r.n) + ' পেইজ'}</span>
    </div>
  );
}

/* data: { period, rows:[{id,n}], names:{id:name} } | null;  error: বার্তা | ''
   (নতুন অনুরোধ ব্যর্থ হলে তালিকার জায়গায় ত্রুটি; "আপনার অবস্থান" আগের সফল ফলাফলেরই থাকে) */
export default function RankPane({ hidden, period, onPeriod, loading, data, error, meId }) {
  let list = null, myRank = '';
  if (data) {
    const { rows, names } = data, idx = rows.findIndex((r) => r.id === meId), lab = LABEL[data.period];
    list = rows.length ? (<>
      {rows.slice(0, 20).map((r, i) => <Row key={r.id} r={r} i={i} meId={meId} names={names} />)}
      {idx >= 20 && (<>
        <div className="sub" style={{ textAlign: 'center', margin: '6px 0' }}>⋮</div>
        <Row r={rows[idx]} i={idx} meId={meId} names={names} />
      </>)}
    </>) : <div className="empty">এই সময়ে এখনো কেউ কোনো পেইজ প্রুফড করেননি — প্রথম হওয়ার সুযোগ আপনার!</div>;
    myRank = idx < 0 ? lab + ' আপনার কোনো পেইজ নেই — একটি পেইজ প্রুফ করলেই তালিকায় আসবেন!'
      : idx === 0 ? lab + ' আপনি ১ নম্বরে! মাশাআল্লাহ, এগিয়ে থাকুন।'
        : lab + ' আপনার অবস্থান ' + bn(idx + 1) + ' নম্বর • পরের জনের থেকে ' + bn(rows[idx - 1].n - rows[idx].n) + ' পেইজ পিছনে';
  }
  if (error) list = <div className="empty">{'লিডারবোর্ড আনা যায়নি: ' + error}</div>;
  return (
    <section id="pRank" hidden={hidden} style={{ maxWidth: '520px', margin: '0 auto' }}>
      <div className="card" style={{ marginBottom: '14px', textAlign: 'center' }}>
        <div className="av" style={{ background: 'linear-gradient(145deg,#a8761f,#f2d27a)', color: '#4a3200' }}><span><Icon name="trophy" cls="lg" /></span></div>
        <h3 style={{ margin: '0 0 4px' }}>লিডারবোর্ড</h3>
        <p className="hint" id="myRank" style={{ margin: 0 }}>{myRank}</p>
      </div>
      <div className="chips" id="rankChips" style={{ justifyContent: 'center' }}>
        {CHIPS.map(([k, t]) => <button key={k} data-p={k} className={period === k ? 'on' : ''} onClick={() => onPeriod(k)}>{t}</button>)}
      </div>
      <div className={'spin' + (loading ? ' on' : '')} id="rankSpin"></div>
      <div id="rankList">{list}</div>
    </section>
  );
}
