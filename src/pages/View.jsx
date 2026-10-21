/* view.html থেকে রূপান্তরিত — মার্কআপ এখন JSX; লজিক View.logic.js-এ (অপরিবর্তিত)। */
import { memo } from 'react';
import PageShell from '../lib/PageShell.jsx';
import css from './View.css?inline';
import logic from './View.logic.js';

const Markup = memo(function Markup() {
  return (
    <>
      {/* আইকন স্প্রাইট (ছোট ভেক্টর, currentColor) */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
        <defs>
          <symbol id="i-settings" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </symbol>
          <symbol id="i-refresh" viewBox="0 0 24 24">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </symbol>
          <symbol id="i-left" viewBox="0 0 24 24">
            <polyline points="15 18 9 12 15 6" />
          </symbol>
          <symbol id="i-right" viewBox="0 0 24 24">
            <polyline points="9 18 15 12 9 6" />
          </symbol>
          <symbol id="i-down" viewBox="0 0 24 24">
            <polyline points="6 9 12 15 18 9" />
          </symbol>
          <symbol id="i-check" viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12" />
          </symbol>
          <symbol id="i-skip" viewBox="0 0 24 24">
            <polygon points="5 4 15 12 5 20 5 4" />
            <line x1="19" y1="5" x2="19" y2="19" />
          </symbol>
          <symbol id="i-swap" viewBox="0 0 24 24">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </symbol>
          <symbol id="i-tag" viewBox="0 0 24 24">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
          </symbol>
          <symbol id="i-download" viewBox="0 0 24 24">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </symbol>
          <symbol id="i-copy" viewBox="0 0 24 24">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </symbol>
          <symbol id="i-paste" viewBox="0 0 24 24">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" />
          </symbol>
          <symbol id="i-save" viewBox="0 0 24 24">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </symbol>
          <symbol id="i-checkc" viewBox="0 0 24 24">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </symbol>
          <symbol id="i-square" viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="2" />
          </symbol>
          <symbol id="i-checksq" viewBox="0 0 24 24">
            <polyline points="9 11 12 14 22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </symbol>
          <symbol id="i-trash" viewBox="0 0 24 24">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </symbol>
          <symbol id="i-play" viewBox="0 0 24 24">
            <polygon points="6 3 20 12 6 21 6 3" />
          </symbol>
          <symbol id="i-pause" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </symbol>
          <symbol id="i-stop" viewBox="0 0 24 24">
            <rect x="5" y="5" width="14" height="14" rx="2" />
          </symbol>
          <symbol id="i-api" viewBox="0 0 24 24">
            <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1" />
            <path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1" />
          </symbol>
          <symbol id="i-bolt" viewBox="0 0 24 24">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </symbol>
          <symbol id="i-lens" viewBox="0 0 24 24">
            <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" />
            <circle cx="12" cy="12" r="3.5" />
          </symbol>
          <symbol id="i-sparkle" viewBox="0 0 24 24">
            <path d="M10 3l1.9 5.6L17.5 10.5l-5.6 1.9L10 18l-1.9-5.6L2.5 10.5l5.6-1.9z" />
            <path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9z" />
          </symbol>
        </defs>
      </svg>
      <header id="hdr">
        <button id="btnBack" className="ico" title="কাজের তালিকায় ফিরুন" aria-label="ফিরুন" onClick={() => { App.go("task") }}>
          <svg className="i">
            <use href="#i-left" />
          </svg>
        </button>
        {" "}
        <button id="btnSettings" className="ico" title="সেটিংস / টোকেন" aria-label="সেটিংস">
          <svg className="i">
            <use href="#i-settings" />
          </svg>
        </button>
        {" "}
        <button id="btnReload" className="ico" title="রিপো থেকে তালিকা ও বর্তমান পেইজ নতুন করে লোড করুন" aria-label="রিলোড">
          <svg className="i">
            <use href="#i-refresh" />
          </svg>
        </button>
        {" "}
        <button id="btnPrev" className="ico" title="আগের পেইজ (Alt+←)" aria-label="আগের পেইজ">
          <svg className="i">
            <use href="#i-left" />
          </svg>
        </button>
        <select id="sel"></select>
        <button id="btnNext" className="ico" title="পরের পেইজ (Alt+→)" aria-label="পরের পেইজ">
          <svg className="i">
            <use href="#i-right" />
          </svg>
        </button>
        {" "}
        <input id="jump" type="number" min="1" inputMode="numeric" placeholder="পেইজ" />
        {" "}
        <button id="btnGo">
          যাও
        </button>
        {" "}
        <button id="btnNextUn" title="পরের অপ্রুফড পেইজে যান">
          <svg className="i">
            <use href="#i-skip" />
          </svg>
          <span></span>
        </button>
        {" "}
        <button id="btnSwap" className="ico" title="ছবি ও টেক্সটের পাশ বদলান" aria-label="পাশ বদলান">
          <svg className="i">
            <use href="#i-swap" />
          </svg>
        </button>
        {" "}
        <button id="btnAuto" title="চালু থাকলে পেস্ট করা টেক্সটের প্রতিটি হেডিংয়ের আগে (স্পেস ছাড়া) 1 বসবে" aria-pressed="false"></button>
        {" "}
        <span id="ttsBox">
          <button id="btnPlay" title="টেক্সট শুনুন — নির্বাচিত অংশ, না থাকলে কার্সর থেকে শেষ পর্যন্ত (শুরুর সময় সার্ভিস বাছার ডায়ালগ আসবে)"></button>
          {" "}
          <button id="btnStop" className="ico" title="শোনা বন্ধ করুন" aria-label="থামান" disabled>
            <svg className="i">
              <use href="#i-stop" />
            </svg>
          </button>
          <select id="ttsRate" title="পড়ার গতি" aria-label="পড়ার গতি">
            <option value="0.6">
              0.6×
            </option>
            <option value="0.8">
              0.8×
            </option>
            <option value="1">
              1×
            </option>
            <option value="1.2">
              1.2×
            </option>
            <option value="1.5">
              1.5×
            </option>
            <option value="1.8">
              1.8×
            </option>
            <option value="2">
              2×
            </option>
          </select>
        </span>
        {" "}
        <span id="apiBox">
          <button id="btnAutoApi" className="ico on" title="অটো OCR" aria-label="অটো OCR" aria-pressed="true">
            <svg className="i">
              <use href="#i-bolt" />
            </svg>
          </button>
          <button id="btnApi" className="ico" title="API — ছবি থেকে টেক্সট (এপি আই - ১) / টেক্সট প্রুফিং (এপি আই - ২)" aria-label="API">
            <svg className="i">
              <use href="#i-api" />
            </svg>
          </button>
        </span>
      </header>
      <div id="status">
        <span id="imgTools">
          <button id="btnDl" className="ico" title="এই পেইজের মূল ছবি ডাউনলোড করুন" aria-label="ডাউনলোড">
            <svg className="i">
              <use href="#i-download" />
            </svg>
          </button>
          {" "}
          <button id="btnLens" className="ico" title="এই পেইজের ছবি Google Lens-এ খুলুন (টেক্সট কপি করার জন্য)" aria-label="Google Lens">
            <svg className="i">
              <use href="#i-lens" />
            </svg>
          </button>
          {" "}
          <button id="btnAiCopy" className="ico" title="AI প্রম্পট কপি — GitHub ডাউনলোড অংশ + এই পেইজের ছবির raw লিংক + OCR প্রম্পট (Supabase), একসাথে ক্লিপবোর্ডে" aria-label="AI প্রম্পট কপি">
            <svg className="i">
              <use href="#i-sparkle" />
            </svg>
          </button>
        </span>
        {" "}
        <span id="doneCnt" hidden title="আপনার সম্পন্ন (প্রুফড) টাস্ক" aria-label="আপনার সম্পন্ন টাস্ক"></span>
        {" "}
        <span id="stText"></span>
      </div>
      <main id="main">
        <section className="pane pane-img">
          <div className="bar">
            <span>
              ছবি
            </span>
            {" "}
            <button id="zOut">
              −
            </button>
            <span id="zVal">
              100%
            </span>
            <button id="zIn">
              +
            </button>
            <button id="zFit">
              ফিট
            </button>
          </div>
          <div className="body" id="imgBox">
            <img id="img" alt="" title="বড় করে দেখতে ক্লিক করুন" />
            <div className="msg" id="imgMsg"></div>
          </div>
        </section>
        <section className="pane pane-txt">
          <div className="bar">
            <span>
              টেক্সট
            </span>
            {" "}
            <button id="fOut" title="ফন্ট ছোট">
              A−
            </button>
            <button id="fIn" title="ফন্ট বড়">
              A+
            </button>
            {" "}
            <button id="btnCopy" className="ico" title="কপি (নির্বাচিত অংশ, না থাকলে পুরো টেক্সট)" aria-label="কপি">
              <svg className="i">
                <use href="#i-copy" />
              </svg>
            </button>
            {" "}
            <button id="btnPaste" className="ico" title="পেস্ট (আগের সব টেক্সট মুছে নতুন টেক্সট বসবে, কার্সর শুরুতে থাকবে)" aria-label="পেস্ট">
              <svg className="i">
                <use href="#i-paste" />
              </svg>
            </button>
            {" "}
            <span id="txtInfo" title="খসড়া = এই ব্রাউজারে সংরক্ষিত অসংরক্ষিত খসড়ার সংখ্যা"></span>
          </div>
          <div className="body">
            <div id="hl" dir="ltr" aria-hidden="true"></div>
            <textarea id="ta" spellCheck="false" dir="ltr" disabled></textarea>
          </div>
        </section>
      </main>
      <footer id="ftr">
        <button id="btnSave" title="এই পেইজের টেক্সট সেভ">
          <svg className="i">
            <use href="#i-save" />
          </svg>
          <span>
            সেভ
          </span>
        </button>
        {" "}
        <button id="btnProof" className="primary" title="সেভ করে প্রুফড চিহ্নিত করুন এবং পরের পেইজে যান">
          <svg className="i">
            <use href="#i-checkc" />
          </svg>
          <span>
            সেভ ও পরের
          </span>
        </button>
        {" "}
        <button id="btnToggleProof" title="প্রুফড হিসেবে চিহ্নিত করুন">
          <svg className="i">
            <use href="#i-square" />
          </svg>
          <span>
            প্রুফড
          </span>
        </button>
        {" "}
        <button id="btnDiscard" title="এই পেইজের অসংরক্ষিত পরিবর্তন/খসড়া বাতিল করে রিপোর টেক্সট ফিরিয়ে আনুন">
          <svg className="i">
            <use href="#i-trash" />
          </svg>
          <span>
            বাতিল
          </span>
        </button>
      </footer>
      {/* লাইটবক্স */}
      <div id="lb" aria-hidden="true">
        <div id="lbTitle"></div>
        <button id="lbDl" title="মূল ছবি ডাউনলোড" aria-label="ডাউনলোড">
          <svg className="i">
            <use href="#i-download" />
          </svg>
        </button>
        {" "}
        <img id="lbImg" alt="" />
      </div>
      <dialog id="dlg">
        <h3>
          সেটিংস
        </h3>
        <label htmlFor="cRepo">
          রিপো (owner/repo)
        </label>
        {" "}
        <input id="cRepo" type="text" placeholder="SunniPedia/pdftojpg" autocapitalize="off" autoComplete="off" />
        {" "}
        <label htmlFor="cBranch">
          ব্রাঞ্চ (খালি = ডিফল্ট ব্রাঞ্চ)
        </label>
        {" "}
        <input id="cBranch" type="text" placeholder="main" autocapitalize="off" autoComplete="off" />
        {" "}
        <label htmlFor="cToken">
          GitHub Access Token (এখানে বসান)
        </label>
        {" "}
        <input id="cToken" type="password" placeholder="github_pat_..." autocapitalize="off" autoComplete="off" />
        {" "}
        <small>
          {"টোকেন শুধু এই ব্রাউজারে সংরক্ষিত থাকে (localStorage; এক্সটেনশনে অতিরিক্ত extension storage-এও)। এখানে যা-ই লিখুন/বদলান, সাথে সাথে স্বয়ংক্রিয়ভাবে সংরক্ষিত হয় — প্রতিবার দিতে হবে না। HTML ফাইলে বা রিপোতে কখনো লিখবেন না। সেভ/পুশ করতে টোকেনে এই রিপোর জন্য "}
          <b>
            Contents: Read and write
          </b>
          {" অনুমতি লাগবে।"}
        </small>
        {" "}
        <label htmlFor="cBook">
          কিতাবের নাম (prefix) — খালি রাখলে আগের মতো pages / texts / proofed.json
        </label>
        {" "}
        <input id="cBook" type="text" placeholder="যেমন: bukhari" autocapitalize="off" autoComplete="off" />
        {" "}
        <label htmlFor="cPages">
          ছবির ফোল্ডার (মূল নাম)
        </label>
        {" "}
        <input id="cPages" type="text" autocapitalize="off" />
        {" "}
        <label htmlFor="cTexts">
          টেক্সট ফোল্ডার (মূল নাম; না থাকলে প্রথম সেভে নিজে থেকে তৈরি হবে)
        </label>
        {" "}
        <input id="cTexts" type="text" autocapitalize="off" />
        {" "}
        <label htmlFor="cProofDir">
          প্রুফড ফোল্ডার (প্রুফড তালিকা এর ভেতরে থাকবে; খালি = রিপোর রুটে)
        </label>
        {" "}
        <input id="cProofDir" type="text" placeholder="proofed" autocapitalize="off" />
        {" "}
        <label htmlFor="cProof">
          প্রুফড তালিকার ফাইল (মূল নাম; না থাকলে তৈরি হবে)
        </label>
        {" "}
        <input id="cProof" type="text" autocapitalize="off" />
        {" "}
        <small id="cPreview"></small>
        <hr />
        <label htmlFor="cEngine">
          শোনার ইঞ্জিন
        </label>
        <select id="cEngine">
          <option value="auto">
            স্বয়ংক্রিয় (ফোনের TTS; না চললে Google অনলাইন)
          </option>
          <option value="device">
            শুধু ফোনের TTS
          </option>
          <option value="google">
            শুধু Google অনলাইন (ইন্টারনেট লাগবে)
          </option>
          <option value="edge">
            শুধু Edge TTS (Microsoft)
          </option>
          <option value="poll">
            শুধু Pollinations
          </option>
          <option value="server">
            শুধু Piper / নিজস্ব সার্ভার
          </option>
          <option value="watson">
            শুধু IBM Watson
          </option>
          <option value="fish">
            শুধু Fish Audio
          </option>
        </select>
        <small>
          Google অনলাইন অডিও একটি অনানুষ্ঠানিক সার্ভিস (Google Translate-এর অডিও), তাই যেকোনো সময় বন্ধ বা সীমিত হতে পারে। এতে ভয়েস বাছা যায় না; ভাষা (বাংলা/আরবি/ইংরেজি) নিজে থেকে চেনা হয়।
        </small>
        {" "}
        <small>
          {"এখানে শেষ বাছাই দেখায়। \"শুনুন\" বোতাম চাপলে প্রতিবার সার্ভিস বাছার ডায়ালগ আসে (সেখানে সব সার্ভিসের কনফিগও আছে)।"}
        </small>
        {" "}
        <label htmlFor="cVoiceBn">
          ফোনের ভয়েস — বাংলা
        </label>
        <select id="cVoiceBn"></select>
        <label htmlFor="cVoiceAr">
          ফোনের ভয়েস — আরবি
        </label>
        <select id="cVoiceAr"></select>
        <label htmlFor="cVoiceEn">
          ফোনের ভয়েস — ইংরেজি
        </label>
        <select id="cVoiceEn"></select>
        <small>
          {"ফোনের ভয়েস ডিভাইসের টেক্সট-টু-স্পিচ ইঞ্জিন থেকে আসে (শুধু ফোনের TTS ব্যবহার হলে প্রযোজ্য)। \"স্বয়ংক্রিয়\" রাখলে ডিভাইসের সেরা মিল ব্যবহার হবে।"}
        </small>
        <div className="row">
          <button id="cClearTok">
            টোকেন মুছুন
          </button>
          {" "}
          <button id="cCancel">
            বন্ধ
          </button>
          {" "}
          <button id="cSave" className="primary">
            সংরক্ষণ ও সংযোগ
          </button>
        </div>
      </dialog>
      {/* API বাছাই */}
      <dialog id="dlgApi">
        <h3>
          API
        </h3>
        <small id="apiOffNote" hidden style={{ color: "var(--err)", fontWeight: "600" }}>
          এপি আই এখন বন্ধ (অ্যাডমিন সেটিংস থেকে চালু করুন) — চালানো যাবে না, শুধু কনফিগ দেখা/বদলানো যাবে।
        </small>
        {" "}
        <button id="apiPick1" className="apiPick" type="button">
          <b>
            এপি আই - ১
          </b>
          <span className="s" id="apiSub1"></span>
        </button>
        {" "}
        <button id="apiPick2" className="apiPick" type="button">
          <b>
            এপি আই - ২
          </b>
          <span className="s" id="apiSub2"></span>
        </button>
        <div className="row">
          <button id="apiPickClose" type="button">
            বন্ধ
          </button>
        </div>
      </dialog>
      {/* API কনফিগ (এপি আই - ১ ও ২ একই ডায়ালগ; মান ব্রাউজারে থেকে যায়) */}
      <dialog id="dlgCfg">
        <h3 id="aTitle"></h3>
        <small id="aSub"></small>
        {" "}
        <label htmlFor="aKey">
          API Key
        </label>
        {" "}
        <input id="aKey" type="password" placeholder="AIza..." autocapitalize="off" autoComplete="off" spellCheck="false" />
        {" "}
        <small id="aKeyHint"></small>
        {" "}
        <label htmlFor="aModel">
          Model
        </label>
        {" "}
        <input id="aModel" type="text" placeholder="gemini-3.5-flash-lite" autocapitalize="off" autoComplete="off" spellCheck="false" />
        {" "}
        <label htmlFor="aPrompt">
          Prompt
        </label>
        <textarea id="aPrompt" rows="8" spellCheck="false"></textarea>
        <small id="aPromptHint"></small>
        {" "}
        <label htmlFor="aTemp">
          Temperature (0–2; OCR/প্রুফিংয়ে 0 ভালো)
        </label>
        {" "}
        <input id="aTemp" type="number" min="0" max="2" step="0.1" inputMode="decimal" />
        {" "}
        <label className="chk" id="aImgRow">
          <input id="aImg" type="checkbox" />
          <span>
            পেইজের ছবিও সাথে পাঠান (ছবির সাথে মিলিয়ে প্রুফ করার জন্য)
          </span>
        </label>
        {" "}
        <label className="chk" id="aAutoRow">
          <input id="aAuto" type="checkbox" />
          <span>
            টেক্সট ফাঁকা পেইজ খুললে নিজে থেকেই চালান (অটো OCR)
          </span>
        </label>
        {" "}
        <small id="aAutoHint">
          শর্ত: Key দেওয়া আছে, পেইজের টেক্সট ফাঁকা (txt নেই/খালি, খসড়াও নেই), পেইজটি প্রুফড নয়। প্রতি পেইজে সেশনে একবারই অটো চলে।
        </small>
        {" "}
        <small>
          কী, মডেল, প্রম্পট ইত্যাদি শুধু এই ব্রাউজারে (localStorage; এক্সটেনশনে extension storage-এও) থাকে। কিছু বদলালেই সাথে সাথে স্বয়ংক্রিয়ভাবে সংরক্ষিত হয় — একবার দিলে পরেও একই থাকবে। রিপোতে কখনো যায় না।
        </small>
        <div className="row">
          <button id="aDefault" type="button" title="প্রম্পট ডিফল্টে ফিরিয়ে আনুন">
            ডিফল্ট প্রম্পট
          </button>
          {" "}
          <button id="aCancel" type="button">
            বন্ধ
          </button>
          {" "}
          <button id="aSave" type="button">
            সংরক্ষণ
          </button>
          {" "}
          <button id="aRun" type="button" className="primary">
            সংরক্ষণ ও চালান
          </button>
        </div>
      </dialog>
      {/* শোনার সার্ভিস বাছাই: "শুনুন" চাপলে (নতুন করে শুরুর সময়) প্রতিবার এই ডায়ালগ আসে; সবার জন্য দৃশ্যমান (শুধু অ্যাডমিনের নয়) */}
      <dialog id="dlgTts">
        <h3>
          কোন সার্ভিসে শুনবেন?
        </h3>
        <small>
          {"একটি সার্ভিস বেছে নিন, দরকার হলে তার কনফিগ (কী / ভয়েস / URL) দিন, তারপর \"শুনুন\" চাপুন। কনফিগ এই ব্রাউজারে থেকে যায় (আবার লিখতে হবে না); শোনা শুরুর সময় প্রতিবার এই তালিকা আসবে, যাতে সার্ভিস বদলে নিতে পারেন।"}
        </small>
        <div id="tsList"></div>
        <small id="tsErr" hidden style={{ color: "var(--err)", fontWeight: "600" }}></small>
        <div className="row">
          <button id="tsCancel" type="button">
            বন্ধ
          </button>
          {" "}
          <button id="tsGo" type="button" className="primary">
            <svg className="i">
              <use href="#i-play" />
            </svg>
            <span>
              শুনুন
            </span>
          </button>
        </div>
      </dialog>
      <div id="toast"></div>
      <div id="ltoast" role="status" aria-live="polite" aria-hidden="true">
        <span className="lt-spin" aria-hidden="true"></span>
        <span className="lt-txt">
          <b id="ltTitle">
            লোড হচ্ছে…
          </b>
          <small id="ltStep"></small>
        </span>
        <b className="lt-pct" id="ltPct">
          0%
        </b>
        <span className="lt-bar"></span>
      </div>
      {" "}
      {" "}
    </>
  );
});

export default function View() {
  return (
    <PageShell
      title="কিতাব প্রুফিং"
      themeColor="#0b5f4c"
      viewport="width=device-width, initial-scale=1"
      sheets={['theme']}
      css={css}
      cssFirst
      logic={logic}
    >
      <Markup />
    </PageShell>
  );
}
