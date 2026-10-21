/* টাস্ক ট্যাবের উপরের কার্ড: দৈনিক লক্ষ্য, টানা দিন, ব্যাজ, "চালিয়ে যান"। */
import Icon from '../../components/Icon.jsx';
import App from '../../lib/common.js';
import { BADGES, resumeTarget, streakInfo } from './helpers.js';

const { bn } = App;

export default function Dashboard({ ready, proofs, booksById, goal, resume, onGoal, onResume }) {
  const rt = resumeTarget(resume, booksById, proofs);
  const hasStat = ready && (!proofs.length || proofs[0].created_at !== undefined);
  if (!hasStat && !rt) return <div id="dash"></div>;

  let stat = null;
  if (hasStat) {
    const s = streakInfo(proofs), left = Math.max(0, goal - s.today), hit = s.today >= goal, pct = Math.min(100, s.today / goal * 100);
    const next = BADGES.find((b) => b[0] > s.best);
    stat = (<>
      <div className="drow">
        <div className={'dgoal' + (hit ? ' hit' : '')} id="dGoal" role="button" tabIndex={0} title="লক্ষ্য বদলাতে চাপুন"
          onClick={onGoal}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onGoal(); } }}>
          <span className="dl"><Icon name="target" />আজকের লক্ষ্য</span>
          <span className="dv"><b>{bn(s.today)}</b> / {bn(goal)} পেইজ</span>
          <span className="pg"><i style={{ width: pct + '%' }}></i></span>
          <span className="dh">{(hit ? 'লক্ষ্য পূরণ হয়েছে ✓' : 'আর ' + bn(left) + ' পেইজ বাকি') + ' • বদলাতে চাপুন'}</span>
        </div>
        <div className="dstreak">
          <span className="dl"><Icon name="zap" />টানা কাজ</span>
          <span className="dv"><b>{bn(s.cur)}</b> দিন</span>
          <span className="dh">{(s.doneToday ? 'আজকের দিন গোনা হয়েছে' : (s.cur ? 'আজ কাজ করলে ' + bn(s.cur + 1) + ' দিন হবে' : 'আজ একটি পেইজ করলেই শুরু')) + ' • সেরা ' + bn(s.best) + ' দিন'}</span>
        </div>
      </div>
      <div className="dbg">
        {BADGES.map((b) => <span key={b[0]} className={s.best >= b[0] ? 'on' : ''} title={bn(b[0]) + ' দিন টানা'}><Icon name="trophy" />{b[1]}</span>)}
      </div>
      {next && <p className="hint" style={{ margin: '8px 0 0' }}>{`পরের ব্যাজ "${next[1]}": টানা ${bn(next[0])} দিন (সেরা রেকর্ড থেকে আরও ${bn(next[0] - s.best)} দিন)।`}</p>}
    </>);
  }

  return (
    <div id="dash">
      <div className="card dash">
        {stat}
        {rt && (
          <button type="button" className="primary block" id="dResume" onClick={onResume}>
            <Icon name="play" /><span>{'চালিয়ে যান — ' + rt.book.name + (rt.stem ? ' • পেইজ ' + rt.stem : '')}</span>
          </button>
        )}
      </div>
    </div>
  );
}
