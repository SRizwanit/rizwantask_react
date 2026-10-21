/* admin.html → রিয়্যাক্ট (state/hooks)। আগের Admin.logic.js আর লাগে না (runLegacy ছাড়াই চলে)।
   ডেটা/হিসাব: ./admin/useAdminData.js, টিকেট (Firebase): ./admin/useTickets.js, সহায়ক: ./admin/helpers.js।
   প্রতিটি ট্যাব আলাদা কম্পোনেন্ট: DashTab, UsersTab, ReviewTab, PayTab, BooksTab, NoticeTab, SupportTab, LogTab, SettingsTab।
   ট্যাব খুললে (openKey বাড়লে) সেই ট্যাব নিজের ডেটা নতুন করে আনে — আগের openTab()-এর মতো। */
import { Fragment, useEffect, useState } from 'react';
import PageShell from '../lib/PageShell.jsx';
import Icon from '../components/Icon.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import App from '../lib/common.js';
import { go } from '../lib/nav.js';
import css from './Admin.css?inline';
import useAdminData from './admin/useAdminData.js';
import useTickets from './admin/useTickets.js';
import { useAsk } from './admin/ui.jsx';
import { status } from './admin/helpers.js';
import DashTab from './admin/DashTab.jsx';
import UsersTab from './admin/UsersTab.jsx';
import ReviewTab from './admin/ReviewTab.jsx';
import PayTab from './admin/PayTab.jsx';
import BooksTab from './admin/BooksTab.jsx';
import NoticeTab from './admin/NoticeTab.jsx';
import SupportTab from './admin/SupportTab.jsx';
import LogTab from './admin/LogTab.jsx';
import SettingsTab from './admin/SettingsTab.jsx';

const { bn } = App;
const TABS = [['Dash', 'chart', 'ড্যাশবোর্ড'], ['Users', 'users', 'ব্যবহারকারী'], ['Review', 'check', 'রিভিউ', 'bgReview'], ['Pay', 'wallet', 'পেমেন্ট', 'bgPay'],
  ['Books', 'book', 'কিতাব'], ['Notice', 'bell', 'নোটিশ'], ['Supp', 'headset', 'সাপোর্ট', 'bgSupp'], ['Log', 'list', 'লগ'], ['Set', 'settings', 'সেটিংস']];

/* ব্যাজ: ০ হলে লুকানো; ৯৯-এর বেশি হলে "৯৯+" */
const Badge = ({ id, n }) => (n > 0 ? <span className="tbadge" id={id}>{n > 99 ? '৯৯+' : bn(n)}</span> : null);

export default function Admin() {
  const [me, setMe] = useState(null);
  const [theme, setTheme] = useState(App.theme.get());
  const [tab, setTab] = useState('Dash');
  const [keys, setKeys] = useState({});                              // ট্যাব → কতবার খোলা হয়েছে (বাড়লে ট্যাব ডেটা নতুন করে আনে)
  const [rvF, setRvF] = useState({ st: 'pending', user: '', book: '' });
  const [ntTo, setNtTo] = useState(''), [ntFocus, setNtFocus] = useState(0);
  const [lgF, setLgF] = useState({ user: '', act: '' });
  const d = useAdminData();
  const tk = useTickets();
  const [ask, askDialog] = useAsk();

  const openTab = (k) => { setTab(k); setKeys((o) => ({ ...o, [k]: (o[k] || 0) + 1 })); };

  /* অ্যাডমিন যাচাই → শুরুর ডেটা */
  useEffect(() => {
    let live = true;
    App.requireAuth({ admin: true }).then((u) => { if (live) setMe(u); });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!me) return undefined;
    d.loadUsers(); d.fetchS().then(() => d.loadBooks());
    const t = setTimeout(tk.init, 2500);                             // সাপোর্ট ব্যাজের জন্য আগে থেকেই টিকেট শোনা
    return () => clearTimeout(t);
  }, [me]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ব্যবহারকারী/ড্যাশবোর্ড থেকে অন্য ট্যাবে লাফ */
  const reviewUser = (uid, resetBook) => { setRvF((f) => ({ st: '', user: String(uid), book: resetBook ? '' : f.book })); openTab('Review'); };
  const messageUser = (uid) => { setNtTo(String(uid)); setNtFocus((n) => n + 1); openTab('Notice'); };
  const logUser = (uid) => { setLgF((f) => ({ ...f, user: String(uid) })); openTab('Log'); };

  const badges = {
    bgReview: d.proofs.filter((p) => status(p) === 'pending').length,
    bgPay: d.pays.filter((x) => x.status === 'requested').length,
    bgSupp: tk.tickets.filter((t) => (t.status || 'open') !== 'closed').length
  };
  const show = (k) => ({ display: tab === k ? 'contents' : 'none' });
  const K = (k) => keys[k] || 0;

  return (
    <PageShell title="অ্যাডমিন প্যানেল - কিতাব প্রুফিং" themeColor="#0b5f4c"
      viewport="width=device-width, initial-scale=1, viewport-fit=cover" sheets={['common', 'theme']} css={css}>
      <header className="top">
        <button id="bBack" className="sm" onClick={() => go('task')}><span><Icon name="left" /></span>টাস্ক</button>
        <h2>অ্যাডমিন প্যানেল</h2>
        <ThemeToggle id="bTheme" mode={theme} onChange={setTheme} />
        {' '}<button id="bOut" className="sm" onClick={() => App.logout()}><span><Icon name="logout" /></span>লগআউট</button>
      </header>
      <main className="wrap wide">
        <div className="tabs">
          {TABS.map(([k, icon, label, bg]) => (
            <Fragment key={k}>
              <button id={'t' + k} className={tab === k ? 'on' : ''} onClick={() => openTab(k)}>
                <span><Icon name={icon} /></span>{label}{bg ? <Badge id={bg} n={badges[bg]} /> : null}
              </button>{' '}
            </Fragment>
          ))}
        </div>
        {me ? (
          <>
            <div style={show('Dash')}><DashTab d={d} openKey={K('Dash')} onReviewUser={(uid) => reviewUser(uid, true)} /></div>
            <div style={show('Users')}><UsersTab d={d} me={me} openKey={K('Users')} ask={ask} onReview={(uid) => reviewUser(uid, false)} onMessage={messageUser} onLog={logUser} /></div>
            <div style={show('Review')}><ReviewTab d={d} openKey={K('Review')} filter={rvF} setFilter={setRvF} ask={ask} /></div>
            <div style={show('Pay')}><PayTab d={d} openKey={K('Pay')} ask={ask} /></div>
            <div style={show('Books')}><BooksTab d={d} openKey={K('Books')} active={tab === 'Books'} /></div>
            <div style={show('Notice')}><NoticeTab d={d} openKey={K('Notice')} to={ntTo} setTo={setNtTo} focusKey={ntFocus} /></div>
            <div style={show('Supp')}><SupportTab d={d} tk={tk} openKey={K('Supp')} /></div>
            <div style={show('Log')}><LogTab d={d} openKey={K('Log')} filter={lgF} setFilter={setLgF} /></div>
            <div style={show('Set')}><SettingsTab d={d} openKey={K('Set')} /></div>
          </>
        ) : null}
      </main>
      {askDialog}
    </PageShell>
  );
}
