import './lib/themeInit.js';   // থিম/PWA — রেন্ডারের আগে
import './lib/common.js';      // window.App (পুরনো পেইজ-লজিকের জন্য) + অফলাইন/ধীর-নেট বার
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);
