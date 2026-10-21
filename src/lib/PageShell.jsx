import { useEffect, useLayoutEffect } from 'react';
import runLegacy from './runLegacy.js';
import commonCss from '../styles/common.css?inline';
import themeCss from '../styles/theme.css?inline';

const SHEETS = { common: commonCss, theme: themeCss };
const BASE = import.meta.env.BASE_URL;
const DEFAULT_VIEWPORT = 'width=device-width, initial-scale=1, viewport-fit=cover';

/* <head> মেটা: শিরোনাম, theme-color (থিম অনুযায়ী বদলায় — theme-init), viewport */
export function usePageMeta({ title, themeColor, viewport }) {
  useLayoutEffect(() => {
    if (title) document.title = title;
    const m = document.querySelector('meta[name="theme-color"]');
    if (m && themeColor) { m.setAttribute('data-kp', themeColor); m.setAttribute('content', themeColor); if (window.__kpTC) window.__kpTC(); }
    const v = document.querySelector('meta[name="viewport"]');
    if (v) v.setAttribute('content', viewport || DEFAULT_VIEWPORT);
    return () => { if (v) v.setAttribute('content', DEFAULT_VIEWPORT); };
  }, [title, themeColor, viewport]);
}

/* পেইজ-ভিত্তিক স্টাইল (<style> পেইজ আনমাউন্ট হলে চলে যায়) + মেটা + (থাকলে) পুরনো পেইজ-লজিক */
export default function PageShell({ title, themeColor, viewport, sheets = ['common', 'theme'], css = '', cssFirst = false, logic, children }) {
  usePageMeta({ title, themeColor, viewport });
  useEffect(() => (logic ? runLegacy(logic) : undefined), []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {/* cssFirst: পেইজের নিজস্ব স্টাইল আগে, তারপর theme.css (view.html-এ এই ক্রমই ছিল) */}
      {cssFirst && css ? <style data-page>{css.replaceAll('__BASE__', BASE)}</style> : null}
      {sheets.map((s) => <style key={s} data-sheet={s}>{SHEETS[s]}</style>)}
      {!cssFirst && css ? <style data-page>{css.replaceAll('__BASE__', BASE)}</style> : null}
      {children}
    </>
  );
}
