/* GitHub REST API: রিপোর ছবি/টেক্সট পড়া-লেখা। getCfg() সবসময় সর্বশেষ কনফিগ দেয়। */
import { repoPaths } from './config.js';
import { epath, extOf } from './utils.js';

export function createGithub(getCfg) {
  const refQ = () => { const c = getCfg(); return c.branch ? '?ref=' + encodeURIComponent(c.branch) : ''; };

  async function api(path, opts = {}) {
    const cfg = getCfg();
    const headers = {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(cfg.token ? { 'Authorization': 'Bearer ' + cfg.token } : {}),
      ...(opts.headers || {})
    };
    // no-store: সেভের পর পুরনো (ক্যাশ করা) টেক্সট/sha ফেরত আসা ঠেকায়
    return fetch('https://api.github.com/repos/' + cfg.repo + path, { cache: 'no-store', ...opts, headers });
  }

  async function errMsg(r) {
    let m = ''; try { m = (await r.json()).message || ''; } catch (e) { /* ignore */ }
    let hint = '';
    if (r.status === 401) hint = ' (টোকেন ভুল বা মেয়াদ শেষ)';
    else if (r.status === 403) hint = ' (অনুমতি নেই বা রেট-লিমিট; টোকেন দিন)';
    else if (r.status === 404) hint = ' (রিপো/ফোল্ডার/ফাইল পাওয়া যায়নি — নাম বা টোকেনের অ্যাক্সেস দেখুন)';
    return r.status + ': ' + m + hint;
  }

  const rawPath = (name) => '/contents/' + epath(repoPaths(getCfg()).pagesDir + '/' + name) + refQ();

  /* ছবির raw লিংক (AI প্রম্পটের জন্য) */
  function rawImageUrl(im, defaultBranch) {
    const cfg = getCfg();
    const br = (cfg.branch || defaultBranch || 'main').split('/').map(encodeURIComponent).join('/');
    return 'https://raw.githubusercontent.com/' + cfg.repo + '/refs/heads/' + br + '/' + epath(repoPaths(cfg).pagesDir + '/' + im.name);
  }

  /* ছবি ক্যাশ (সর্বোচ্চ ৬টি objectURL) + ডাউনলোড-শতাংশ।
     onProgress(name, pct): pct = 0–100, অথবা null (মোট মাপ অজানা) */
  function createImageCache(onProgress) {
    const cache = new Map();   // name -> Promise<objectURL>
    const pct = new Map();     // name -> শতাংশ
    const prog = (name, p) => { pct.set(name, p); onProgress(name, p); };

    function get(name) {
      if (cache.has(name)) return cache.get(name);
      const p = (async () => {
        const r = await api('/contents/' + epath(repoPaths(getCfg()).pagesDir + '/' + name) + refQ(),
          { cache: 'default', headers: { 'Accept': 'application/vnd.github.raw+json' } });
        if (!r.ok) throw new Error(await errMsg(r));
        const type = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[extOf(name)] || 'image/jpeg';
        const total = parseInt(r.headers.get('Content-Length') || '0', 10) || 0;
        if (!r.body || !r.body.getReader) { prog(name, null); const b = await r.blob(); prog(name, 100); return URL.createObjectURL(b); }
        prog(name, total ? 0 : null);
        const rd = r.body.getReader(), parts = []; let got = 0;
        for (;;) {
          const { done, value } = await rd.read();
          if (done) break;
          parts.push(value); got += value.length;
          if (total) prog(name, Math.min(99, got / total * 100));
        }
        prog(name, 100);
        return URL.createObjectURL(new Blob(parts, { type }));
      })();
      cache.set(name, p);
      p.catch(() => { cache.delete(name); pct.delete(name); });
      if (cache.size > 6) {
        const k = cache.keys().next().value;
        cache.get(k).then((u) => URL.revokeObjectURL(u)).catch(() => {});
        cache.delete(k);
      }
      return p;
    }
    return { get, clear: () => cache.clear(), has: (n) => pct.has(n), pct: (n) => pct.get(n) };
  }

  return { api, errMsg, refQ, rawPath, rawImageUrl, createImageCache };
}
