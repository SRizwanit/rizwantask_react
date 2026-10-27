/* privacypolicy → React: RizwanTask Privacy Policy (for Google Play). Link: /privacypolicy
   Account deletion section: /privacypolicy#delete (use as the "account deletion web link" in Play Console).
   No login needed; does not touch Supabase/Firebase — static text + account deletion request by WhatsApp / email. */
import { useEffect, useState } from 'react';
import './PrivacyPolicy.css';

const APP_NAME = 'RizwanTask';
const SITE = 'https://rizwantask.vercel.app';
const UPDATED = 'October 27, 2026';
const WA_NUMBER = '8801714656343';          // opens in WhatsApp (wa.me/<number>)
const EMAIL = 'rizwanit0102@gmail.com';

const waLink = (text) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;

const TOC = [
  ['collect', 'Information we collect'], ['use', 'How we use it'], ['share', 'Third-party services'], ['device', 'On-device storage & permissions'],
  ['retention', 'Retention'], ['delete', 'Delete your account'], ['rights', 'Your rights'], ['security', 'Security'],
  ['children', 'Children'], ['contact', 'Contact']
];

export default function PrivacyPolicy() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    const old = document.title;
    document.title = 'Privacy Policy — ' + APP_NAME;
    // opened directly with #delete (or any #id): scroll to that section
    const h = window.location.hash.slice(1);
    if (h) setTimeout(() => document.getElementById(h)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    return () => { document.title = old; };
  }, []);

  /* ready-made deletion request message (empty name / phone shows "-") */
  const delMsg = () =>
    'Hello, I would like to request deletion of my ' + APP_NAME + ' account and the personal data linked to it.\n' +
    'Name: ' + (name.trim() || '-') + '\nMobile number: ' + (phone.trim() || '-');
  const waDelete = waLink(delMsg());
  const mailDelete = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent(APP_NAME + ' — Account deletion request') + '&body=' + encodeURIComponent(delMsg());

  return (
    <div className="pp" lang="en">
      <div className="pp-wrap">
        <header className="pp-head">
          <div className="pp-logo" aria-hidden="true">
            <svg className="i" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
          </div>
          <h1>Privacy Policy</h1>
          <p>{APP_NAME} (Android app and website) • Last updated: {UPDATED}</p>
        </header>

        <nav className="pp-toc" aria-label="Table of contents">
          {TOC.map(([id, label]) => <a key={id} href={'#' + id}>{label}</a>)}
        </nav>

        <section className="pp-card">
          <h2>Introduction</h2>
          <p>
            {APP_NAME} is a book proofing app (checking book pages and correcting their text). Users read the image of a book page and proofread its text,
            an admin reviews the work, and earnings for approved work are calculated at a fixed rate and paid out through bKash or Nagad.
            This policy explains what information we collect, why we collect it, how we protect it, and how you can delete it.
            By using the app you agree to this policy.
          </p>
        </section>

        <section className="pp-card" id="collect">
          <h2>1. Information we collect</h2>
          <h3>Information you give us</h3>
          <ul>
            <li><b>Full name</b> and <b>mobile number</b> — to create your account and sign you in.</li>
            <li><b>4-digit PIN</b> — your PIN is never stored as plain text; only a salted, encrypted hash (SHA-256) is kept.</li>
            <li><b>Payment method and number</b> (bKash / Nagad) — to send your earnings.</li>
            <li><b>Proofread text</b> and work status (which page of which book is done / in review / approved), the earnings calculated from it, and your withdrawal requests and payout records.</li>
            <li><b>Ticket / support messages</b> — whatever you write when you ask for help, or send us on WhatsApp.</li>
          </ul>
          <h3>Information collected automatically</h3>
          <ul>
            <li><b>Device ID</b> — a random ID created when the app first runs (not an advertising ID, IMEI or serial number). It is used for the "one account per device" rule and to prevent misuse.</li>
            <li><b>Activity log</b> — the name and time of actions such as sign-up, login, logout, payment number change, withdrawal request, opening a ticket and account deletion.</li>
            <li><b>Last active time</b> — to understand whether an account is active.</li>
            <li>Basic network and error status (to show whether the app is working properly).</li>
          </ul>
          <div className="pp-note">
            We do <b>not</b> collect your <b>location</b>, <b>contacts</b>, <b>SMS</b>, <b>microphone recordings</b> or advertising-tracking data, and we do not show any ads.
          </div>
        </section>

        <section className="pp-card" id="use">
          <h2>2. How we use your information</h2>
          <ul>
            <li>To create your account, sign you in and keep the one-account-per-device rule.</li>
            <li>To accept proofing work, review it and keep a record of your earnings.</li>
            <li>To pay approved earnings to the bKash / Nagad number you provided.</li>
            <li>To show notices and announcements, give support, prevent misuse and fraud, and improve the app.</li>
            <li>To meet legal obligations.</li>
          </ul>
          <p>We <b>do not sell</b> your personal information and we do not share it with anyone for advertising.</p>
        </section>

        <section className="pp-card" id="share">
          <h2>3. Third-party services</h2>
          <p>The following services are used to run the app and website. Each has its own privacy policy.</p>
          <div className="pp-tablewrap">
            <table>
              <thead><tr><th>Service</th><th>Purpose</th><th>Data involved</th></tr></thead>
              <tbody>
                <tr><td>Supabase</td><td>Database (accounts, proofs, earnings, logs)</td><td>The account and work information listed in section 1</td></tr>
                <tr><td>Firebase (Google)</td><td>Web support chat and tickets</td><td>The messages you write to support</td></tr>
                <tr><td>Google Gemini API (optional)</td><td>Image-to-text (OCR) and automatic proofing</td><td>If you turn this feature on, the current page's image / text is sent to Google using your own API key</td></tr>
                <tr><td>Google Lens (in your browser)</td><td>Copying text from an image</td><td>When you tap the button, the image link opens in Google Lens in your browser</td></tr>
                <tr><td>Vercel</td><td>Hosting of this website</td><td>Standard web request data (IP address etc.)</td></tr>
                <tr><td>WhatsApp / browser / AI chat sites</td><td>Asking for help; opening an AI site to paste a prompt</td><td>Only what you send or paste yourself; the app does not send anything on its own</td></tr>
                <tr><td>bKash / Nagad</td><td>Paying out earnings</td><td>Your payment number and the payout amount (when the admin sends the money)</td></tr>
              </tbody>
            </table>
          </div>
          <p>
            We do not disclose your information to anyone else, except when required by law or to prevent fraud.
            The admin (the app's operator) can see your name, mobile number and payment number for work review, payouts and support.
          </p>
        </section>

        <section className="pp-card" id="device">
          <h2>4. On-device storage and permissions</h2>
          <ul>
            <li><b>Kept only on your phone:</b> your login session, device ID, theme, draft text, and the Gemini API key, model and prompt settings you enter. These are not sent to our servers. They are removed when you uninstall the app or clear its data.</li>
            <li><b>Internet:</b> required to communicate with the server.</li>
            <li><b>Camera and photos / media (optional):</b> for taking or choosing pictures. The app's main functions work even if you do not grant these. We do not scan or upload your gallery with this permission.</li>
            <li><b>Clipboard:</b> used only when you tap the "copy" or "paste" buttons; the clipboard is never read in the background.</li>
            <li><b>Text-to-speech:</b> your phone's own TTS engine is used to read text aloud.</li>
          </ul>
        </section>

        <section className="pp-card" id="retention">
          <h2>5. How long we keep your data</h2>
          <ul>
            <li>Your account and work information are kept while your account is active.</li>
            <li>When you delete your account, your account information — name, mobile number, PIN hash and payment number — is removed (see section 6).</li>
            <li>Accounting and payout records, and proofread book text (which is part of the book publishing work), may be kept for a limited time for legal and bookkeeping needs.</li>
          </ul>
        </section>

        <section className="pp-card" id="delete">
          <h2>6. Delete your account and data</h2>
          <h3>From the app (easiest)</h3>
          <ol>
            <li>Sign in to the app and open the <b>Profile</b> page.</li>
            <li>Tap the <b>"Delete account"</b> button (<b>"অ্যাকাউন্ট মুছুন"</b> in the app).</li>
            <li>Enter your <b>4-digit PIN</b> and confirm in the final dialog.</li>
          </ol>
          <p>As soon as you confirm, your account (name, mobile number, PIN hash, payment number) is deleted from our server and you are signed out.</p>
          <div className="pp-warn">
            Warning: a deleted account cannot be restored. If you have earnings you have not withdrawn, contact the admin before deleting so you can settle them.
          </div>

          <h3>Without the app (if you cannot sign in, or you removed the app)</h3>
          <p>Enter your name and registered mobile number below and tap the button — WhatsApp (<b>{WA_NUMBER}</b>) opens with a ready message and you only need to press "Send".</p>
          <div className="pp-form">
            <label htmlFor="ppName">Your name</label>
            <input id="ppName" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name on the account" autoComplete="name" />
            <label htmlFor="ppPhone">Registered mobile number</label>
            <input id="ppPhone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" autoComplete="tel" />
          </div>
          <div className="pp-btns">
            <a className="pp-btn wa" href={waDelete} target="_blank" rel="noreferrer">Send deletion request on WhatsApp</a>
            <a className="pp-btn mail" href={mailDelete}>Send deletion request by email</a>
          </div>
          <p>
            After verifying your identity we will delete your account and the personal data linked to it within a reasonable time (normally within 7 days) and let you know.
            Email: <a href={'mailto:' + EMAIL}>{EMAIL}</a>
          </p>
          <p>To remove data stored only on your phone (settings, API key, drafts), use "Clear data" for the app in your phone's settings, or uninstall the app.</p>
        </section>

        <section className="pp-card" id="rights">
          <h2>7. Your rights</h2>
          <ul>
            <li>Ask what information we hold about you and have it corrected (you can change your payment number yourself from the app's Profile).</li>
            <li>Ask for your account and data to be deleted.</li>
            <li>Stop using the app at any time, and withdraw the optional permissions (camera, photos) from your phone's settings.</li>
          </ul>
          <p>For any of these requests, use the methods in the "Contact" section below.</p>
        </section>

        <section className="pp-card" id="security">
          <h2>8. Security</h2>
          <ul>
            <li>Communication with our server uses HTTPS.</li>
            <li>Your PIN is never kept as plain text — only a hash is stored.</li>
            <li>Your own API key and settings stay only on your phone.</li>
            <li>Admin access is limited. However, no online system is 100% secure, so please keep your PIN private and do not share it with anyone.</li>
          </ul>
        </section>

        <section className="pp-card" id="children">
          <h2>9. Children's privacy</h2>
          <p>
            This app involves paid work and payouts, so it is <b>not intended for anyone under 18</b>. We do not knowingly collect information from children.
            If you believe a child's information was collected by mistake, tell us and we will delete it.
          </p>
        </section>

        <section className="pp-card">
          <h2>Changes to this policy</h2>
          <p>We may update this policy from time to time. If there is an important change, we will announce it in the app's notices or on this page. Please check the "Last updated" date above.</p>
        </section>

        <section className="pp-card" id="contact">
          <h2>10. Contact</h2>
          <p>For privacy questions, data deletion or anything else:</p>
          <ul>
            <li>WhatsApp: <a href={waLink('Hello, I have a question about privacy / my account on ' + APP_NAME + '.')} target="_blank" rel="noreferrer">{WA_NUMBER}</a></li>
            <li>Email: <a href={'mailto:' + EMAIL}>{EMAIL}</a></li>
            <li>In the app: Profile → "Open a ticket"</li>
            <li>Website: <a href={SITE}>{SITE}</a></li>
          </ul>
        </section>

        <p className="pp-foot">© {new Date().getFullYear()} {APP_NAME}</p>
      </div>
    </div>
  );
}
