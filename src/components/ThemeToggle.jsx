import Icon from './Icon.jsx';
import App from '../lib/common.js';

/* হেডারের থিম বোতাম (আগের data-theme-toggle): সিস্টেম → লাইট → ডার্ক। `mode` বদলালে আইকন/টাইটেল নিজে বদলায়। */
export default function ThemeToggle({ mode, onChange, id }) {
  const title = 'থিম: ' + App.theme.label(mode) + ' (বদলাতে চাপুন)';
  const icon = mode === 'dark' ? 'moon' : mode === 'light' ? 'sun' : 'auto';
  return (
    <button id={id} className="sm" title={title} aria-label={title}
      onClick={() => { const n = App.theme.next(); App.theme.set(n); onChange(n); App.toast('থিম: ' + App.theme.label()); }}>
      <Icon name={icon} />
    </button>
  );
}
