/* সাপোর্ট টিকেট: Firebase Realtime Database (একই ডেটা Support পেইজ লেখে)।
   Firebase শুধু দরকারে (ব্যাজের জন্য ২.৫ সেকেন্ড পরে, বা সাপোর্ট ট্যাব খুললে) আলাদা চাঙ্কে লোড হয়। */
import { useCallback, useEffect, useRef, useState } from 'react';

const FBCFG = {
  apiKey: 'AIzaSyDqjbhRTpFgwRtZrqCG-ckO-UM_uZqh2Rc', authDomain: 'srizwanchat.firebaseapp.com', projectId: 'srizwanchat',
  storageBucket: 'srizwanchat.firebasestorage.app', messagingSenderId: '101112162367', appId: '1:101112162367:web:5d33f592297f4f9967b08a', measurementId: 'G-8XHB9HQTMR'
};

export default function useTickets() {
  const [tickets, setTickets] = useState([]), [note, setNote] = useState('');
  const fb = useRef(null), started = useRef(false), unsub = useRef(null);

  const init = useCallback(async () => {
    if (started.current) return; started.current = true; setNote('টিকেট আনা হচ্ছে…');
    try {
      const [A, D] = await Promise.all([import('firebase/app'), import('firebase/database')]);
      const app = A.getApps().find((a) => a.name === 'admin-panel') || A.initializeApp(FBCFG, 'admin-panel');
      fb.current = { D, db: D.getDatabase(app) };
      unsub.current = D.onValue(D.ref(fb.current.db, 'tickets'), (snap) => {
        const v = snap.val() || {};
        const l = Object.entries(v).map(([id, t]) => ({ id, ...t }));
        l.sort((a, b) => (b.lastMsg || b.createdAt || 0) - (a.lastMsg || a.createdAt || 0));
        setTickets(l); setNote('');
      }, (err) => setNote('টিকেট আনা যায়নি: ' + err.message));
    } catch (e) { started.current = false; setNote('Firebase লোড হয়নি (ইন্টারনেট?): ' + e.message); }
  }, []);
  useEffect(() => () => { if (unsub.current) unsub.current(); }, []);
  return { tickets, note, init, fb };
}
