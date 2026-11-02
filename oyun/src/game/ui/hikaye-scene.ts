// Hikaye overlay (survey hikaye-4/5, kontrol-7, zincir-4/5). DOM only, view side: reads the sim's hikaye API
// (rules.rt.hikaye) and sends { kind: 'hikaye', ... } commands; never writes sim state.
// - Scenes (finale 30-45 s, tutorials ~10 s, absurd breaks): portrait bubble at the bottom, one line at a time,
//   murmur (short pitched pops) while the text types, the *key word* shown bold and spoken (speechSynthesis, tr-TR,
//   when available and sound is on). Tap to go on, "Atla" skips the whole scene.
// - In-between moments: a small portrait card at the top that hides by itself.
// - Rival actions: a card with the rival's portrait and one-tap answers; then a result card (Tat Yarışı jury lines).
// - A small chip shows a running joint order (ortak iş) or the rival dip.
import { hikayeApi, type HikayeApi } from '../sim/hikaye';
import { SPEAKERS, type SpeakerId } from '../../content/hikaye';
import { portrait } from './hikaye-portrait';

type Cmd = { kind: string; [k: string]: unknown };
export interface HikayeSceneDeps { root: HTMLElement; rules: () => { rt: unknown; state?: any }; command(c: Cmd): void; sfx?(id: string, opts?: { vol?: number; pitch?: number }): void; }
export interface HikayeSceneView { update(dt: number): void; dispose(): void; }

const CSS = `
.hk-ov{position:absolute;inset:0;z-index:58;pointer-events:none;font-family:var(--body)}
.hk-scene{position:absolute;inset:0;pointer-events:auto;background:linear-gradient(rgba(59,42,32,.05),rgba(59,42,32,.45));display:flex;flex-direction:column;justify-content:flex-end;padding:16px 12px calc(18px + env(safe-area-inset-bottom,0px))}
.hk-scene.light{background:none;pointer-events:none}.hk-scene.light .hk-bub,.hk-scene.light .hk-title{pointer-events:auto}
.hk-title{align-self:center;margin-bottom:auto;margin-top:calc(70px + env(safe-area-inset-top,0px));background:var(--paper,#fff6e6);border:3px solid var(--ink,#3b2a20);border-radius:16px;padding:6px 14px;font:900 20px/1.15 var(--disp);color:var(--ink,#3b2a20);box-shadow:0 4px 0 var(--ink,#3b2a20);text-align:center;max-width:92%}
.hk-title small{display:block;font:800 13px/1.2 var(--body);opacity:.7}
.hk-demo{align-self:center;margin-bottom:12px;animation:hkbob 1.4s ease-in-out infinite}
.hk-bub{position:relative;display:grid;grid-template-columns:76px 1fr;gap:10px;align-items:start;background:var(--paper,#fff6e6);border:3px solid var(--ink,#3b2a20);border-radius:22px;box-shadow:0 6px 0 var(--ink,#3b2a20);padding:12px;max-width:520px;width:100%;margin:0 auto;animation:hkpop .25s ease-out}
.hk-bub .who{font:900 17px/1.1 var(--disp);color:var(--ink,#3b2a20);margin-bottom:4px}
.hk-bub .tx{font:800 19px/1.35 var(--body);color:var(--ink,#3b2a20);min-height:52px}
.hk-bub .tx b{background:var(--yellow,#ffd23f);padding:0 4px;border-radius:6px}
.hk-bub .ft{grid-column:1/-1;display:flex;align-items:center;gap:8px;margin-top:4px}
.hk-dots{flex:1;display:flex;gap:4px;flex-wrap:wrap}.hk-dots i{width:9px;height:9px;border-radius:50%;background:#d8c9b0;border:1.5px solid var(--ink,#3b2a20)}.hk-dots i.on{background:var(--tea,#c2551f)}
.hk-ov .sb-btn{min-height:52px;font-size:17px}
.hk-skip{background:var(--cream,#f6ecd8)!important}
.hk-ara{position:absolute;left:10px;right:10px;top:calc(118px + env(safe-area-inset-top,0px));pointer-events:auto;display:grid;grid-template-columns:52px 1fr;gap:8px;align-items:center;background:var(--paper,#fff6e6);border:2.5px solid var(--ink,#3b2a20);border-radius:16px;box-shadow:0 4px 0 var(--ink,#3b2a20);padding:8px 10px;max-width:460px;margin:0 auto;animation:hkdrop .3s ease-out}
.hk-ara h4{margin:0;font:900 15px/1.15 var(--disp);color:var(--tea,#c2551f)}.hk-ara p{margin:2px 0 0;font:800 15px/1.3 var(--body);color:var(--ink,#3b2a20)}
.hk-card{position:absolute;left:12px;right:12px;bottom:calc(150px + env(safe-area-inset-bottom,0px));pointer-events:auto;background:var(--paper,#fff6e6);border:3px solid var(--ink,#3b2a20);border-radius:20px;box-shadow:0 6px 0 var(--ink,#3b2a20);padding:12px;max-width:480px;margin:0 auto;animation:hkpop .3s ease-out}
.hk-card .hd{display:grid;grid-template-columns:60px 1fr;gap:10px;align-items:center}
.hk-card h3{margin:0;font:900 20px/1.1 var(--disp);color:var(--ink,#3b2a20)}.hk-card .rn{font:900 13px/1.2 var(--disp);opacity:.75}
.hk-card p{margin:8px 0;font:800 17px/1.35 var(--body);color:var(--ink,#3b2a20)}
.hk-card .ch{display:flex;flex-direction:column;gap:8px}.hk-card .ch .sb-btn{width:100%}
.hk-card .jr{display:grid;grid-template-columns:40px 1fr;gap:6px;align-items:center;font:800 15px/1.3 var(--body);margin:4px 0}
.hk-chip{position:absolute;left:10px;top:calc(196px + env(safe-area-inset-top,0px));z-index:1;pointer-events:none;background:var(--cream,#f6ecd8);border:2.5px solid var(--ink,#3b2a20);border-radius:999px;padding:4px 10px;font:900 14px/1.1 var(--disp);color:var(--ink,#3b2a20);box-shadow:0 3px 0 var(--ink,#3b2a20)}
@keyframes hkpop{0%{transform:scale(.85);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes hkdrop{0%{transform:translateY(-20px);opacity:0}100%{transform:none;opacity:1}}
@keyframes hkbob{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-8px) rotate(3deg)}}
`;

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const btn = (label: string, act: string, id: string, cls: string) => `<button class="sb-btn ${cls}" data-h="${act}" data-id="${esc(id)}"><span class="sb-bl">${esc(label)}</span></button>`;
const LINE_SECS = 3.6;

const DEMO: Record<string, string> = {
  cay: '<path d="M30 30h36l-6 46H36z" fill="#fff" stroke="#3b2a20" stroke-width="4"/><path d="M34 44h28l-3 28H37z" fill="#c2551f"/><path d="M40 22q4-8 0-14M50 22q4-8 0-14" stroke="#9aa3ab" stroke-width="3" fill="none"/>',
  isci: '<rect x="18" y="20" width="60" height="56" rx="6" fill="#f2d39b" stroke="#3b2a20" stroke-width="4"/><circle cx="48" cy="40" r="10" fill="#f1c39a" stroke="#3b2a20" stroke-width="3"/><path d="M30 66q18-16 36 0" fill="#2f7fb3" stroke="#3b2a20" stroke-width="3"/>',
  vapur: '<path d="M10 54h76l-10 18H20z" fill="#fff" stroke="#3b2a20" stroke-width="4"/><rect x="26" y="38" width="44" height="16" rx="3" fill="#fff6e6" stroke="#3b2a20" stroke-width="4"/><rect x="44" y="24" width="10" height="14" fill="#e0533c" stroke="#3b2a20" stroke-width="3"/>',
  kalp: '<path d="M48 78L18 48q-10-14 4-24 12-7 26 8 14-15 26-8 14 10 4 24z" fill="#e2557a" stroke="#3b2a20" stroke-width="4"/>',
  oyun: '<rect x="14" y="30" width="68" height="40" rx="18" fill="#ffd23f" stroke="#3b2a20" stroke-width="4"/><path d="M30 42v16M22 50h16" stroke="#3b2a20" stroke-width="4"/><circle cx="62" cy="46" r="4" fill="#e0533c"/><circle cx="70" cy="54" r="4" fill="#2f7fb3"/>',
  kurye: '<circle cx="26" cy="64" r="12" fill="none" stroke="#3b2a20" stroke-width="4"/><circle cx="70" cy="64" r="12" fill="none" stroke="#3b2a20" stroke-width="4"/><path d="M26 64l16-24h20l8 24M42 40l-6-8" stroke="#3b2a20" stroke-width="4" fill="none"/><rect x="50" y="24" width="20" height="16" fill="#ffd23f" stroke="#3b2a20" stroke-width="3"/>',
  dekor: '<path d="M48 14l9 20 22 2-17 14 5 22-19-12-19 12 5-22-17-14 22-2z" fill="#ffd23f" stroke="#3b2a20" stroke-width="4"/>',
  tadilat: '<path d="M20 76l34-34" stroke="#7d5638" stroke-width="8" stroke-linecap="round"/><rect x="48" y="16" width="30" height="18" rx="3" transform="rotate(45 63 25)" fill="#9aa3ab" stroke="#3b2a20" stroke-width="4"/>',
  firin: '<path d="M14 76V44q34-34 68 0v32z" fill="#e8a92a" stroke="#3b2a20" stroke-width="4"/><path d="M34 76V58q14-12 28 0v18z" fill="#3b2a20"/><circle cx="48" cy="66" r="6" fill="#ffd23f"/>',
  rakip: '<rect x="14" y="24" width="68" height="44" rx="4" fill="#d23b3b" stroke="#3b2a20" stroke-width="4"/><path d="M30 46h36" stroke="#fff" stroke-width="6"/><path d="M40 68v12M56 68v12" stroke="#3b2a20" stroke-width="4"/>',
};
const demo = (id?: string) => id && DEMO[id] ? `<svg class="hk-demo" width="110" height="110" viewBox="0 0 96 96" aria-hidden="true"><circle cx="48" cy="48" r="46" fill="#fff6e6" stroke="#3b2a20" stroke-width="3"/>${DEMO[id]}</svg>` : '';

export function createHikayeScene(deps: HikayeSceneDeps): HikayeSceneView {
  const doc = deps.root.ownerDocument;
  const style = doc.createElement('style'); style.textContent = CSS; doc.head.appendChild(style);
  const ov = doc.createElement('div'); ov.className = 'hk-ov'; deps.root.appendChild(ov);
  const sceneEl = doc.createElement('div'); const araEl = doc.createElement('div'); const cardEl = doc.createElement('div'); const chipEl = doc.createElement('div');
  ov.append(sceneEl, araEl, cardEl, chipEl);
  const api = (): HikayeApi | null => { try { return hikayeApi(deps.rules()); } catch { return null; } };
  const muted = () => { try { return !!deps.rules().state?.settings?.muted; } catch { return false; } };

  let sceneN = -1, line = 0, lineT = 0, typed = 0, araN = -1, rvN = -1, resN = -1, resT = 0, chipKey = '';
  let murmurT = 0;

  function speak(word: string): void {
    if (muted()) return;
    try {
      const ss = (globalThis as any).speechSynthesis; const U = (globalThis as any).SpeechSynthesisUtterance;
      if (!ss || !U) return;
      ss.cancel(); const u = new U(word); u.lang = 'tr-TR'; u.rate = 0.95; u.pitch = 1.1; u.volume = 0.8; ss.speak(u);
    } catch { /* optional */ }
  }
  function fmtLine(text: string, n: number): string {
    // type-on: first n characters; *key* bold
    const vis = text.slice(0, n);
    return esc(vis).replace(/\*([^*]+)\*/g, '<b>$1</b>').replace(/\*([^*]*)$/, '<b>$1</b>');
  }
  function showLine(): void {
    const run = api()?.scene(); if (!run) return;
    const s = run.scene, ln = s.lines[line]; if (!ln) return;
    const who = ln[0] as SpeakerId, sp = SPEAKERS[who];
    const kind = s.kind === 'finale' ? 'Bölüm finali' : s.kind === 'ogretici' ? 'Öğretici' : s.kind === 'absurt' ? 'Tuhaf an' : 'Hikaye';
    sceneEl.className = 'hk-scene' + (s.kind === 'absurt' ? ' light' : '');
    sceneEl.innerHTML = `<div class="hk-title"><small>${kind}${run.replay ? ' (tekrar)' : ''}</small>${esc(s.title)}</div>${s.kind === 'ogretici' ? demo(s.icon) : ''}
      <div class="hk-bub">${portrait(who, 76)}<div><div class="who" style="color:${esc(sp?.accent || '')}">${esc(sp?.name || '')}</div><div class="tx"></div></div>
      <div class="ft"><div class="hk-dots">${s.lines.map((_, i) => `<i class="${i <= line ? 'on' : ''}"></i>`).join('')}</div>${btn('Atla', 'skip', '', 'hk-skip sm')}${btn(line >= s.lines.length - 1 ? 'Tamam' : 'Devam', 'next', '', 'green sm')}</div></div>`;
    typed = 0; lineT = 0; murmurT = 0;
    const key = /\*([^*]+)\*/.exec(ln[1]); if (key) setTimeout(() => speak(key[1]), 350);
  }
  function next(): void {
    const run = api()?.scene(); if (!run) return;
    const ln = run.scene.lines[line];
    if (ln && typed < ln[1].length) { typed = ln[1].length; const tx = sceneEl.querySelector('.tx'); if (tx) tx.innerHTML = fmtLine(ln[1], typed); return; }
    line++;
    if (line >= run.scene.lines.length) { deps.command({ kind: 'hikaye', op: 'sceneDone' }); sceneEl.innerHTML = ''; sceneEl.className = ''; return; }
    showLine();
  }

  ov.addEventListener('click', e => {
    const t = e.target as HTMLElement;
    const b = t.closest('[data-h]') as HTMLElement | null;
    if (!b) { if (t.closest('.hk-scene')) next(); else if (t.closest('.hk-ara')) deps.command({ kind: 'hikaye', op: 'araDone' }); return; }
    e.stopPropagation();
    const a = b.dataset.h, id = b.dataset.id || '';
    try { deps.sfx?.('pop'); } catch { /* */ }
    if (a === 'next') next();
    else if (a === 'skip') { deps.command({ kind: 'hikaye', op: 'sceneDone' }); sceneEl.innerHTML = ''; sceneEl.className = ''; }
    else if (a === 'rival') { deps.command({ kind: 'hikaye', op: 'rival', id }); cardEl.innerHTML = ''; }
    else if (a === 'res') { deps.command({ kind: 'hikaye', op: 'resultDone' }); cardEl.innerHTML = ''; }
  });

  return {
    update(dt) {
      const h = api(); if (!h) return;
      // scenes
      const run = h.scene();
      if (!run) { if (sceneN !== -1) { sceneN = -1; sceneEl.innerHTML = ''; sceneEl.className = ''; } }
      else {
        if (run.n !== sceneN) { sceneN = run.n; line = 0; showLine(); }
        const ln = run.scene.lines[line];
        if (ln) {
          lineT += dt;
          if (typed < ln[1].length) {
            typed = Math.min(ln[1].length, typed + dt * 38);
            const tx = sceneEl.querySelector('.tx'); if (tx) tx.innerHTML = fmtLine(ln[1], Math.floor(typed));
            murmurT -= dt;
            if (murmurT <= 0) { murmurT = 0.11; const ch = ln[0]; const base = ch === 'pamuk' ? 1.8 : ch === 'kaptan' ? 1.5 : ch === 'burgatron' || ch === 'dron' ? 0.6 : 1; try { deps.sfx?.('pop', { vol: 0.18, pitch: base * (0.85 + Math.random() * 0.3) }); } catch { /* */ } }
          } else if (lineT > LINE_SECS + ln[1].length / 60) next();
        }
      }
      // in-between moment
      const a = h.ara();
      if (!a) { if (araN !== -1) { araN = -1; araEl.innerHTML = ''; araEl.className = ''; } }
      else if (a.n !== araN) {
        araN = a.n; araEl.className = 'hk-ara';
        araEl.innerHTML = `${portrait(a.who, 52)}<div><h4>${esc(a.title)}</h4><p><b>${esc(a.name)}:</b> ${esc(a.text)}</p></div>`;
        try { deps.sfx?.('pop', { vol: 0.25, pitch: 1.2 }); } catch { /* */ }
      }
      // rival action / result card (not while a scene shows)
      const rv = h.rival(), res = h.result();
      if (run) { if (cardEl.innerHTML) { cardEl.innerHTML = ''; rvN = -2; resN = -2; } }
      else if (rv) {
        if (rv.n !== rvN) {
          rvN = rv.n;
          cardEl.innerHTML = `<div class="hk-card" style="border-color:${esc(rv.color)}"><div class="hd">${portrait(rv.who, 60)}<div><h3>${esc(rv.title)}</h3><div class="rn">${esc(rv.rivalName)}</div></div></div><p>${esc(rv.text)}</p><div class="ch">${rv.choices.map(([l, id], i) => btn(l, 'rival', id, i === 0 ? 'green' : 'cream')).join('')}</div></div>`;
          try { deps.sfx?.('horn'); } catch { /* */ }
        }
      } else if (res) {
        if (res.n !== resN) {
          resN = res.n; resT = 9;
          const jr = (res.lines || []).map(([w, t]) => `<div class="jr">${portrait(w, 40)}<span><b>${esc(SPEAKERS[w]?.name || '')}:</b> ${esc(t)}</span></div>`).join('');
          cardEl.innerHTML = `<div class="hk-card"><div class="hd">${portrait(res.who, 60)}<div><h3>${res.lines ? 'Jüri kararı' : 'Rakip hamlesi bitti'}</h3></div></div>${jr}<p>${esc(res.text)}</p>${btn('Tamam', 'res', '', 'green')}</div>`;
          try { deps.sfx?.('coin'); } catch { /* */ }
        }
        resT -= dt; if (resT <= 0) { deps.command({ kind: 'hikaye', op: 'resultDone' }); cardEl.innerHTML = ''; }
      } else if (cardEl.innerHTML) { cardEl.innerHTML = ''; rvN = -1; resN = -1; }
      // chip
      const o = h.ortak(), dip = h.dipX();
      const key = o ? 'o' + o.left + ':' + Math.ceil(o.secs / 5) : dip < 1 ? 'd' + dip : '';
      if (key !== chipKey) {
        chipKey = key;
        chipEl.className = key ? 'hk-chip' : '';
        chipEl.textContent = o ? `Ortak iş: ${o.left} satış kaldı · ${Math.floor(o.secs / 60)}:${String(o.secs % 60).padStart(2, '0')}` : dip < 1 ? `Rakip etkisi: satış -%${Math.round((1 - dip) * 100)}` : '';
      }
    },
    dispose() { ov.remove(); style.remove(); },
  };
}
