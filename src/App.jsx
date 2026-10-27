import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { setNavigator, BASE } from './lib/nav.js';
import Splash from './pages/Splash.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Task from './pages/Task.jsx';
import Profile from './pages/Profile.jsx';
const Support = lazy(() => import('./pages/Support.jsx')); // Firebase আলাদা চাঙ্কে — অন্য পেইজ হালকা থাকে
import Admin from './pages/Admin.jsx';
import View from './pages/View.jsx';
import PrivacyPolicy from './pages/PrivacyPolicy.jsx';

const ROUTES = ['login', 'signup', 'task', 'profile', 'support', 'admin', 'view', 'privacypolicy'];

/* রাউটার ↔ পুরনো কোডের সেতু:
   ১) App.go()/location.href='…' রিয়্যাক্ট রাউটারের navigate ব্যবহার করে,
   ২) পেইজের ভেতরের অভ্যন্তরীণ <a href> ক্লিকও পেইজ রিলোড ছাড়া রাউটারে যায়। */
function NavBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    setNavigator((to, opts) => navigate(to, opts));
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      let u; try { u = new URL(a.href, window.location.href); } catch (x) { return; }
      if (u.origin !== window.location.origin || !u.pathname.startsWith(BASE)) return;
      const name = u.pathname.slice(BASE.length).replace(/\/$/, '');
      if (!ROUTES.includes(name)) return;
      e.preventDefault();
      navigate('/' + name + u.search + u.hash);
    };
    document.addEventListener('click', onClick);
    return () => { document.removeEventListener('click', onClick); setNavigator(null); };
  }, [navigate]);
  return null;
}

/* পেইজ বদলালে (পাথ/কুয়েরি) কম্পোনেন্ট নতুন করে মাউন্ট হয় — আগের মাল্টি-পেইজ আচরণের মতো; শুধু #hash বদলালে নয় */
function Page({ children }) {
  const { pathname, search } = useLocation();
  return <div key={pathname + search} style={{ display: 'contents' }}>{children}</div>;
}

export default function App() {
  return (
    <BrowserRouter basename={BASE}>
      <NavBridge />
      <Routes>
        <Route path="/" element={<Page><Splash /></Page>} />
        <Route path="/login" element={<Page><Login /></Page>} />
        <Route path="/signup" element={<Page><Signup /></Page>} />
        <Route path="/task" element={<Page><Task /></Page>} />
        <Route path="/profile" element={<Page><Profile /></Page>} />
        <Route path="/support" element={<Page><Suspense fallback={null}><Support /></Suspense></Page>} />
        <Route path="/admin" element={<Page><Admin /></Page>} />
        <Route path="/view" element={<Page><View /></Page>} />
        <Route path="/privacypolicy" element={<Page><PrivacyPolicy /></Page>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
