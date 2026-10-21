import { ICONS, ic } from '../lib/common.js';

/* common.js-এর ic()-এর রিয়্যাক্ট রূপ: একই SVG আইকন (viewBox 24, currentColor)। name="mark" হলে লোগো। */
export default function Icon({ name, cls = '' }) {
  if (name === 'mark') return <span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: ic('mark') }} />;
  return <svg className={'i ' + cls} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[name] || '' }} />;
}

/* .logo কন্টেইনারের ভেতরে সরাসরি লোগো SVG (আগের data-ic="mark"-এর মতো) */
export function Logo({ className = 'logo', icon = 'mark', as: Tag = 'div' }) {
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: ic(icon) }} />;
}
