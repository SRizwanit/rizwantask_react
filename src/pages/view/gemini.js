/* Gemini streaming (SSE) কল — ছোট ছোট খণ্ডে আসে, তাই বড় পেইজেও সংযোগ ঝুলে যায় না */
import { sleep } from './utils.js';

export function geminiHint(status, msg) {
  const low = (msg || '').toLowerCase();
  if (status === 400 && (low.includes('api key') || low.includes('api_key'))) return ' (API Key ভুল)';
  if (status === 401 || status === 403) return ' (Key-তে অনুমতি নেই / ব্লক / মেয়াদ শেষ)';
  if (status === 404) return ' (মডেলের নাম ভুল হতে পারে)';
  if (status === 429) return ' (কোটা/রেট-লিমিট — একটু পরে আবার চেষ্টা করুন)';
  return '';
}

/* o = {key, model, parts, temp, signal, onProgress(chars)} → {text, finish} */
export async function callGemini(o) {
  const model = o.model.replace(/^models\//, '');
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model)
    + ':streamGenerateContent?alt=sse&key=' + encodeURIComponent(o.key);
  const body = JSON.stringify({ contents: [{ role: 'user', parts: o.parts }], generationConfig: { temperature: o.temp } });
  let lastErr = null;
  for (let att = 1; att <= 3; att++) {
    let r;
    try {
      r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: o.signal });
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      lastErr = new Error('নেটওয়ার্ক সমস্যা: ' + e.message);
      if (att < 3) { await sleep(3000 * att, o.signal); continue; }
      throw lastErr;
    }
    if (!r.ok) {
      const t = await r.text(); let m = '';
      try { m = JSON.parse(t).error.message || ''; } catch (e) { m = t.slice(0, 200); }
      lastErr = new Error(r.status + ': ' + m.slice(0, 300) + geminiHint(r.status, m));
      if ([500, 502, 503, 504].includes(r.status) && att < 3) { await sleep(4000 * att, o.signal); continue; }
      throw lastErr;
    }
    const chunks = []; let finish = null, chars = 0;
    const handle = (line) => {
      if (!line.startsWith('data:')) return;
      const d = line.slice(5).trim();
      if (!d || d === '[DONE]') return;
      let j; try { j = JSON.parse(d); } catch (e) { return; }
      if (j.error) throw new Error((j.error.message || 'API ত্রুটি').slice(0, 300));
      if (j.promptFeedback && j.promptFeedback.blockReason) throw new Error('Gemini ব্লক করেছে: ' + j.promptFeedback.blockReason);
      (j.candidates || []).forEach((c) => {
        ((c.content && c.content.parts) || []).forEach((p) => { if (typeof p.text === 'string' && !p.thought) { chunks.push(p.text); chars += p.text.length; } });
        if (c.finishReason) finish = c.finishReason;
      });
      if (o.onProgress) o.onProgress(chars);
    };
    const reader = r.body.getReader(), dec = new TextDecoder('utf-8');
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      lines.forEach((l) => handle(l.replace(/\r$/, '')));
    }
    buf += dec.decode();
    if (buf) handle(buf.replace(/\r$/, ''));
    let text = chunks.join('').trim();
    const fence = text.match(/^```[A-Za-z]*\r?\n([\s\S]*?)\r?\n```$/);      // ভুলে পুরো আউটপুট কোড-ফেন্সে মুড়ে দিলে খুলে নেওয়া
    if (fence) text = fence[1].trim();
    if (!text) {
      lastErr = new Error('খালি রেসপন্স (finishReason=' + finish + ')');
      if (att < 3) { await sleep(3000 * att, o.signal); continue; }
      throw lastErr;
    }
    return { text, finish };
  }
  throw lastErr || new Error('অজানা ত্রুটি');
}
