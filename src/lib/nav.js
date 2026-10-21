/* নেভিগেশন ব্রিজ: পুরনো কোডের `location.href='task.html'` / App.go('task') — রিয়্যাক্ট রাউটারে পৌঁছে দেয়। */
export const BASE = import.meta.env.BASE_URL || '/';

let navigator_ = null;
export const setNavigator = (fn) => { navigator_ = fn; };

/* 'task', 'task#guide', 'view?book=1&page=2', 'login.html' (আগের নাম), '/profile' — সবই চলে */
export function parseTarget(to) {
  const m = String(to).trim().match(/^\/?([A-Za-z0-9_-]+)(?:\.html)?([?#].*)?$/);
  if (!m) return null;
  const name = m[1] === 'index' ? '' : m[1];
  return { path: '/' + name, rest: m[2] || '' };
}

export function go(to, replace = false) {
  const t = parseTarget(to);
  if (!t) { // বাইরের ঠিকানা
    if (replace) window.location.replace(to); else window.location.assign(to);
    return;
  }
  if (navigator_) navigator_(t.path + t.rest, { replace });
  else {
    const url = BASE + t.path.replace(/^\//, '') + t.rest;
    if (replace) window.location.replace(url); else window.location.assign(url);
  }
}
