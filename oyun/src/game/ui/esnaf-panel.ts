// Komşu Defteri (esnaf panel) and the "Komşular" section of the Görevler panel. Pure HTML string renderers in the
// v2ui style (sb-card / sb-btn classes); v2ui.ts calls them from its RENDER table, button data-a names map to the
// panelActions('esnaf') / ('gorevler') factories in sim/panels.ts. Owner: esnaf feature (survey esnaf-1..10).
// Decisions: portraits are tiny code-made SVG faces (no image files); text is big (17px+) and every action is one tap.
import { ICONS } from '../../engine/ui/v2-style';

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const I = (k: string) => ICONS[k] || '';

const FACE: Record<string, { skin: string; top: string; hat: string; extra: string }> = {
  huesnu: { skin: '#f1c9a0', top: '#f6efe1', hat: '<path d="M14 15q10-12 20 0z" fill="#fff" stroke="#3a2a1e" stroke-width="2"/>', extra: '<path d="M18 31q6 3 12 0" stroke="#5a3a28" stroke-width="2.5" fill="none"/>' },
  hayriye: { skin: '#e9b993', top: '#5a9a4b', hat: '<path d="M12 22q12-18 24 0q-2-6-12-7q-10 1-12 7z" fill="#c94f6d" stroke="#3a2a1e" stroke-width="2"/>', extra: '' },
  sevket: { skin: '#e6b48c', top: '#e9e4da', hat: '<path d="M15 17q9-8 18 0" stroke="#6b6b6b" stroke-width="5" fill="none"/>', extra: '<path d="M17 30q7-4 14 0" stroke="#4a4a4a" stroke-width="3.5" fill="none"/>' },
  zeki: { skin: '#d9a77c', top: '#7a4e2d', hat: '<rect x="15" y="10" width="18" height="6" rx="2" fill="#2e4a6b" stroke="#3a2a1e" stroke-width="2"/>', extra: '' },
  kemal: { skin: '#c99068', top: '#2f6f9a', hat: '<path d="M13 17h22l-3-6H16z" fill="#e8b23a" stroke="#3a2a1e" stroke-width="2"/>', extra: '<path d="M16 30q8 6 16 0" stroke="#3a3a3a" stroke-width="2" fill="none"/>' },
  ayten: { skin: '#eebd96', top: '#3a8a6e', hat: '<path d="M13 21q11-16 22 0" stroke="#7a3a2a" stroke-width="5" fill="none"/><circle cx="35" cy="22" r="3.5" fill="#7a3a2a"/>', extra: '' },
};
function face(id: string, size: number): string {
  const f = FACE[id] || FACE.huesnu;
  return `<svg class="esn-face" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="#bfe6e9"/><rect x="11" y="36" width="26" height="12" rx="6" fill="${f.top}" stroke="#3a2a1e" stroke-width="2"/><circle cx="24" cy="24" r="12" fill="${f.skin}" stroke="#3a2a1e" stroke-width="2"/><circle cx="20" cy="23" r="1.8" fill="#2a1e14"/><circle cx="28" cy="23" r="1.8" fill="#2a1e14"/><circle cx="17.5" cy="27" r="2" fill="#f2a0a0" opacity=".7"/><circle cx="30.5" cy="27" r="2" fill="#f2a0a0" opacity=".7"/>${f.extra || '<path d="M20 29q4 3 8 0" stroke="#5a3a28" stroke-width="2" fill="none"/>'}${f.hat}</svg>`;
}
const hearts = (n: number) => { let s = '<span class="esn-hearts">'; for (let i = 0; i < 5; i++) s += `<i class="${i < n ? 'on' : ''}">${I('heart')}</i>`; return s + '</span>'; };
const btn = (label: string, act: string, id: string | number | null, cls: string, sub?: string, off?: boolean, why?: string) =>
  `<button class="sb-btn ${cls}${off ? ' off' : ''}" data-a="${act}"${id != null ? ` data-id="${esc(id)}"` : ''}${why ? ` data-why="${esc(why)}"` : ''}><span class="sb-bl">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>`;
const meter = (p: number) => `<div class="sb-meter"><i style="width:${(Math.max(0, Math.min(1, p)) * 100).toFixed(1)}%;background:#e2557a"></i></div>`;

const CSS = `<style>
.esn-tabs{display:flex;gap:6px;overflow-x:auto;padding:2px 2px 8px;scrollbar-width:none}
.esn-tab{flex:none;display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 8px;border:2.5px solid var(--ink);border-radius:14px;background:var(--cream);font:900 13px/1.1 var(--disp);color:var(--ink);position:relative;cursor:pointer;pointer-events:auto}
.esn-tab.on{background:var(--yellow);transform:translateY(-2px)}
.esn-tab .dot{position:absolute;top:-6px;right:-6px;background:var(--red);color:#fff;border:2px solid var(--ink);border-radius:10px;font:900 12px/1 var(--disp);padding:2px 6px}
.esn-head{display:flex;gap:12px;align-items:center}
.esn-head h3{font:900 21px/1.1 var(--disp);margin:0}
.esn-head .lv{font:900 17px/1.2 var(--disp);color:#c23d63}
.esn-hearts{display:inline-flex;gap:2px;vertical-align:middle}.esn-hearts i svg{width:20px;height:20px;opacity:.25;filter:grayscale(1)}.esn-hearts i.on svg{opacity:1;filter:none}
.esn-say{margin:10px 0 2px;padding:10px 12px;border:2.5px solid var(--ink);border-radius:16px;background:#fff;font:800 17px/1.3 var(--body);position:relative}
.esn-say:before{content:'';position:absolute;left:26px;top:-9px;width:14px;height:14px;background:#fff;border-left:2.5px solid var(--ink);border-top:2.5px solid var(--ink);transform:rotate(45deg)}
.esn-p{font:700 16px/1.35 var(--body);margin:6px 0}
.esn-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px}.esn-row .sb-btn{min-height:64px;padding:6px 6px 8px;font-size:15px}
.esn-story{border-left:5px solid #e2557a;padding:6px 10px;margin:8px 0;background:rgba(255,255,255,.55);border-radius:0 12px 12px 0}
.esn-story b{font:900 17px/1.2 var(--disp);display:block}.esn-story span{font:700 16px/1.35 var(--body)}
.esn-story.no{border-left-color:#bbb;opacity:.7}
.esn-fav h3{font:900 19px/1.2 var(--disp);margin:0 0 4px}
.esn-opts{display:flex;flex-direction:column;gap:8px;margin-top:8px}.esn-opts .sb-btn{justify-content:flex-start;text-align:left;font-size:16px;min-height:52px}
.esn-letter{font:italic 700 16px/1.4 Georgia,serif;background:#fff8e6;border:2px dashed #c9a46a;border-radius:12px;padding:8px 10px;margin-top:6px}
.esn-vs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.esn-vs .sb-btn{min-height:60px}
.esn-list{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.esn-mini{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 4px;font:900 14px/1.1 var(--disp)}
.esn-mini small{font:800 13px/1.1 var(--body);color:#c23d63}
</style>`;

function favCard(f: any, inGorevler: boolean): string {
  if (!f) return '';
  let s = `<div class="sb-card esn-fav"><h3>${I('heart')} ${esc(f.title)}</h3><div class="esn-p"><b>${esc(f.fromName)}:</b> "${esc(f.ask)}"</div>`;
  s += `<div class="esn-p">${esc(f.progress)}</div>`;
  if (f.state === 'active' && f.pct > 0) s += meter(f.pct);
  if (f.letterSoFar && f.letterSoFar.length) s += `<div class="esn-letter">${f.letterSoFar.map((x: string) => esc(x)).join('<br>')}</div>`;
  if (f.letter && !inGorevler) {
    s += `<div class="esn-p"><b>${esc(f.letter.prompt)}</b></div><div class="esn-opts">${f.letter.options.map((o: string, i: number) => btn(o, 'esnafPick', i, 'cream')).join('')}</div>`;
  }
  s += `<div class="esn-p" style="opacity:.8">Ödül: ${esc(f.reward)}</div>`;
  if (inGorevler) {
    if (f.state === 'ask') s += btn('Tamam, yardım ederim!', 'esnafAccept', null, 'green wide');
    else if (f.state === 'done') s += btn('Teşekkürünü al', 'esnafClaim', null, 'green wide');
    else if (f.kind === 'mektup') s += btn('Mektuba devam et', 'esnafOpen', f.from, 'blue wide');
  } else {
    if (f.state === 'ask') s += `<div class="sb-mrow">${btn('Yardım ederim!', 'esnafAccept', null, 'green')}${btn('Şimdi olmaz', 'esnafDrop', null, 'cream')}</div>`;
    else if (f.state === 'done') s += btn('Teşekkürünü al', 'esnafClaim', null, 'green wide');
    else s += `<div class="sb-mrow">${btn('Vazgeç', 'esnafDrop', null, 'cream sm')}</div>`;
  }
  return s + '</div>';
}

/** Komşu Defteri: tabs of the six esnaf, the selected one's level, words, buttons, favour, rivalry, story. */
export function renderEsnaf(m: any, A: any): string {
  const c = m && m.cur;
  if (!c) return `<div class="sb-empty">${I('people')}<span>Çarşı Sokağı\'na yürü, bir esnafa dokun ve tanış!</span></div>`;
  let s = CSS + '<div class="esn-tabs">';
  for (const e of m.list || []) s += `<button class="esn-tab${e.id === m.sel ? ' on' : ''}" data-a="esnafSel" data-id="${esc(e.id)}">${face(e.id, 40)}${esc(e.short)}${e.fav ? '<span class="dot">!</span>' : ''}</button>`;
  s += '</div>';
  s += `<div class="sb-card"><div class="esn-head">${face(c.id, 72)}<div class="sb-grow"><h3>${esc(c.name)}</h3><div class="lv">${hearts(c.level)} ${esc(c.levelName)}</div><div class="esn-p" style="margin:2px 0">${esc(c.role)}</div></div></div>`;
  s += meter(c.pct) + `<div class="esn-p" style="opacity:.85">${esc(c.xpText)}</div>`;
  if (c.line) s += `<div class="esn-say">${esc(c.line)}</div>`;
  s += `<div class="esn-row">${btn(c.talkDone ? 'Sohbet' : 'Hal hatır sor', 'esnafTalk', c.id, 'blue', c.talkDone ? 'bugün sohbet ettiniz' : 'dostluk +2')}`
    + btn('Hediye ver', 'esnafGift', c.id, 'cream', c.giftDone ? 'yarın yine' : c.gift + ' · ' + c.giftCost + ' ₺', c.giftDone || (m.money < c.giftCost), c.giftDone ? 'Bugün zaten hediye verdin.' : 'Kasada ' + c.giftCost + ' ₺ olmalı.')
    + btn('Alışveriş', 'esnafBuy', c.id, 'green', c.buyDone ? 'malzeme taze' : c.buy + ' · ' + c.buyCost + ' ₺', c.buyDone || (m.money < c.buyCost), c.buyDone ? 'Bugünlük alışveriş tamam.' : 'Kasada ' + c.buyCost + ' ₺ olmalı.') + '</div></div>';
  // tedarik + visit
  s += `<div class="sb-card"><div class="sb-sec" style="margin:0 0 4px">${I('sparkle')}Dostluk faydası</div><div class="esn-p">${esc(c.perk)}</div><div class="esn-p"><b>Şimdi:</b> ${esc(c.bonus)}</div>`;
  s += `<div class="esn-p">${I('clock').replace('<svg', '<svg style="width:18px;height:18px;vertical-align:-3px"')} ${esc(c.visit.on ? c.visit.text : c.visit.need)}</div></div>`;
  // favour of this esnaf
  if (m.fav && m.fav.from === c.id) s += favCard(m.fav, false);
  else if (m.fav && m.fav.state === 'active' && m.fav.kind === 'mektup') s += favCard(m.fav, false);
  // rivalry
  const r = m.rival;
  if (r && r.here) {
    s += `<div class="sb-card"><div class="sb-sec" style="margin:0 0 4px">${I('trophy')}Tatlı atışma: ${esc(r.topic)}</div><div class="esn-p"><b>${esc(r.aName)}:</b> "${esc(r.lineA)}"</div><div class="esn-p"><b>${esc(r.bName)}:</b> "${esc(r.lineB)}"</div>`;
    s += r.done ? `<div class="esn-p">Bugünün hakemi sendin. Yarın rövanş var!</div>` : `<div class="esn-vs">${btn(r.aName + ' haklı', 'esnafHakem', r.a, 'blue')}${btn(r.bName + ' haklı', 'esnafHakem', r.b, 'blue')}</div><div class="esn-p" style="opacity:.8">Hakem sensin. Kimse küsmez, ikisi de güler.</div>`;
    s += '</div>';
  }
  // story
  s += `<div class="sb-sec">${I('note')}${esc(c.name)}\'in hikayesi<span>${c.story.filter((x: any) => x.open).length} / 5</span></div>`;
  c.story.forEach((x: any, i: number) => {
    s += x.open ? `<div class="esn-story"><b>${i + 1}. ${esc(x.title)}</b><span>${esc(x.text)}</span></div>` : `<div class="esn-story no"><b>${i + 1}. ${I('lock').replace('<svg', '<svg style="width:16px;height:16px;vertical-align:-2px"')} ???</b><span>${esc(x.need)} olunca açılır.</span></div>`;
  });
  void A;
  return s;
}

/** "Komşular" section appended to the Görevler panel: open favour + the six esnaf as one-tap shortcuts. */
export function renderKomsuSection(k: any): string {
  if (!k) return '';
  let s = CSS + `<div class="sb-sec">${I('people')}Komşular<span>Çarşı Sokağı</span></div>`;
  s += favCard(k.fav, true);
  s += '<div class="esn-list">';
  for (const e of k.list || []) s += `<button class="sb-card esn-mini esn-tab" data-a="esnafOpen" data-id="${esc(e.id)}">${face(e.id, 44)}${esc(e.short)}<small>${esc(e.met ? e.levelName : 'Tanışmadınız')}</small></button>`;
  return s + '</div>';
}
