/* কিতাবের কার্ডের তালিকা: কভার, সম্পন্ন/বাকি পেইজ ও অগ্রগতির বার, রেট, "শেষ কাজ" ট্যাগ; লোডিং স্কেলিটন। */
import { memo, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import App from '../../lib/common.js';
import { rateTxt } from './helpers.js';

const { bn } = App;

function Cover({ url }) {
  const [bad, setBad] = useState(false);
  if (!url || bad) return <Icon name="book" />;
  return <img src={url} alt="" loading="lazy" onError={() => setBad(true)} />;
}

function Progress({ done, total }) {
  if (total > 0) {
    const rem = Math.max(0, total - done), pct = Math.min(100, done / total * 100);
    return (<>
      <div className="pg"><i style={{ width: pct + '%' }}></i></div>
      <small className="pn"><span className="dn">{bn(done)} সম্পন্ন</span><span className="sl">/</span><span className="rm">{bn(rem)} বাকি</span></small>
    </>);
  }
  // মোট পেইজ জানা না থাকলে "বাকি অজানা"
  return done ? <small className="pn"><span className="dn">{bn(done)} সম্পন্ন</span><span className="sl">/</span><span className="rm u">বাকি অজানা</span></small> : null;
}

const Skeleton = () => Array.from({ length: 4 }, (_, i) => (
  <div className="book sk" key={i}><div className="cv"></div><div className="bt"><span className="skl w80"></span><span className="skl w50"></span><span className="skl bar"></span><span className="skl w60"></span></div></div>
));

const BookGrid = memo(function BookGrid({ status, spinning, books, query, bookCounts, byBook, resume, rateOf, onOpen }) {
  const q = query.trim().toLowerCase();
  const list = books.filter((b) => !q || (b.name || '').toLowerCase().includes(q) || (b.author || '').toLowerCase().includes(q));
  const skeleton = !books.length && status === 'loading';
  const failed = !books.length && status === 'error';
  const showEmpty = !skeleton && (failed || list.length === 0);
  return (<>
    <div className={'spin' + (spinning ? ' on' : '')} id="spin"></div>
    <div className="grid" id="grid">
      {skeleton ? <Skeleton /> : failed ? null : list.map((b) => {
        const id = String(b.id), done = bookCounts[id] || 0, total = Number(b.total_pages) || 0, mine = byBook[id] ? byBook[id].n : 0;
        const last = resume && String(resume.b) === id;
        return (
          <button className="book" data-id={b.id} key={id} onClick={() => onOpen(b.id)}>
            <div className="cv">{last && <span className="lastb">শেষ কাজ</span>}<Cover url={b.cover_url} /></div>
            <div className="bt"><b>{b.name}</b><small>{b.author || ''}</small>
              <div className="bp"><Progress done={done} total={total} /></div>
              <span className="rt">{'রেট ' + rateTxt(rateOf(b)) + '/পেইজ' + (mine ? ' • আমার ' + bn(mine) : '')}</span></div>
          </button>
        );
      })}
    </div>
    <div className="empty" id="empty" hidden={!showEmpty}>{failed ? 'কিতাব লোড হয়নি — নেট দেখে রিফ্রেশ চাপুন' : 'কোনো কিতাব পাওয়া যায়নি'}</div>
  </>);
});

export default BookGrid;
