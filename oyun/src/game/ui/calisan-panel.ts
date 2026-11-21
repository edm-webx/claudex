// Çalışanlar 2.0 sections of the Ekip (isciler) panel: selected-worker box (Kurs Merkezi course pick / Taşı), and a
// tabbed section (Kadro ve Bank, Kurs Merkezi, Etkinlikler, Mekanlar) under the worker list. Pure HTML string renderers
// in the v2ui style (sb-card / sb-btn); data-a names map to panelActions('isciler') in sim/panels.ts.
// Owner: calisan feature (survey calisan-1, calisan-3..6). Big text, one tap per action. Portraits come from v2ui's
// porTag (passed in) so they share its canvas cache.
import { ICONS } from '../../engine/ui/v2-style';

type Por = (look: unknown, px: number, opts?: Record<string, unknown>, cls?: string) => string;
const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const I = (k: string) => ICONS[k] || '';
const tl = (n: number) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' ₺';
const btn = (label: string, act: string, id: string | number | null, cls: string, sub?: string, off?: boolean, why?: string) =>
  `<button class="sb-btn ${cls}${off ? ' off' : ''}" data-a="${act}"${id != null ? ` data-id="${esc(id)}"` : ''}${why ? ` data-why="${esc(why)}"` : ''}><span class="sb-bl">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>`;
const mmss = (s: number) => { const m = Math.floor(s / 60), x = Math.floor(s % 60); return m + ':' + String(x).padStart(2, '0'); };
const por = (P: Por, w: any, px: number) => P(w.look || ('w' + w.id + w.name), px, { bg: '#bfe6e9', eyes: 'open' });

const EV_IC: Record<string, string> = {
  cake: '<svg width="44" height="44" viewBox="0 0 48 48"><rect x="8" y="24" width="32" height="16" rx="3" fill="#f7c6d0" stroke="#3b2a20" stroke-width="2.5"/><path d="M8 30q4 4 8 0t8 0 8 0 8 0" fill="none" stroke="#fff" stroke-width="3"/><rect x="22" y="12" width="4" height="12" fill="#ffd23f" stroke="#3b2a20" stroke-width="1.5"/><path d="M24 5q4 4 0 7-4-3 0-7z" fill="#ff8c2b"/></svg>',
  ball: '<svg width="44" height="44" viewBox="0 0 48 48"><circle cx="24" cy="24" r="16" fill="#fff" stroke="#3b2a20" stroke-width="2.5"/><path d="M24 15l7 5-3 8h-8l-3-8z" fill="#3b2a20"/><path d="M24 8v7M31 20l8-3M28 28l5 7M20 28l-5 7M17 20l-8-3" stroke="#3b2a20" stroke-width="2"/></svg>',
  cay: '<svg width="44" height="44" viewBox="0 0 48 48"><path d="M16 14h16l-3 26H19z" fill="#c0392b" fill-opacity=".8" stroke="#3b2a20" stroke-width="2.5"/><path d="M14 40h20" stroke="#3b2a20" stroke-width="3"/><path d="M20 10q2-4 0-7M27 10q2-4 0-7" stroke="#9aa" stroke-width="2" fill="none"/></svg>',
  sun: '<svg width="44" height="44" viewBox="0 0 48 48"><circle cx="24" cy="20" r="9" fill="#ffd23f" stroke="#3b2a20" stroke-width="2.5"/><path d="M4 40q20-12 40 0z" fill="#7cc36b" stroke="#3b2a20" stroke-width="2.5"/><rect x="14" y="34" width="14" height="6" fill="#e0533c" stroke="#3b2a20" stroke-width="1.5"/></svg>',
};
const BENCH_IC = '<svg width="44" height="44" viewBox="0 0 48 48"><rect x="6" y="18" width="36" height="6" rx="2" fill="#c98a4b" stroke="#3b2a20" stroke-width="2.5"/><rect x="6" y="27" width="36" height="5" rx="2" fill="#c98a4b" stroke="#3b2a20" stroke-width="2.5"/><path d="M10 32v9M38 32v9" stroke="#3b2a20" stroke-width="3"/></svg>';
const SCHOOL_IC = '<svg width="44" height="44" viewBox="0 0 48 48"><path d="M8 20L24 10l16 10z" fill="#e0533c" stroke="#3b2a20" stroke-width="2.5"/><rect x="11" y="20" width="26" height="20" fill="#fff6e6" stroke="#3b2a20" stroke-width="2.5"/><rect x="21" y="29" width="6" height="11" fill="#5c8fd6" stroke="#3b2a20" stroke-width="1.5"/><path d="M4 16l20-11 20 11-20 10z" fill="#3b2a20" opacity=".0"/></svg>';

const CSS = `<style>
.cl-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:8px 0}
.cl-tabs button{min-height:50px;border:2.5px solid var(--ink);border-radius:12px;background:#fff;font:900 14px/1.1 var(--disp);color:var(--ink)}
.cl-tabs button.on{background:var(--yellow)}
.cl-row{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center}
.cl-row h3{font:900 18px/1.15 var(--disp);margin:0}.cl-row p{font:700 14px/1.3 var(--body);margin:2px 0}
.cl-row .sb-btn{min-height:52px;font-size:16px}
.cl-sel{border:3px solid var(--ink);background:#fff6d6}
.cl-sel h3{font:900 19px/1.15 var(--disp);margin:0}
.cl-k{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:8px 0;border-top:2px dashed #e2d3b5}
.cl-k h4{font:900 17px/1.15 var(--disp);margin:0}.cl-k p{font:700 14px/1.3 var(--body);margin:2px 0}
.cl-k .sb-btn{min-height:54px;font-size:16px}
.cl-bar{height:12px;border:2px solid var(--ink);border-radius:8px;background:#fff;overflow:hidden;margin-top:4px}.cl-bar i{display:block;height:100%;background:var(--tile,#49b96a)}
.cl-note{font:700 15px/1.35 var(--body)}
.cl-ayin{display:flex;gap:12px;align-items:center;background:#fff3c4}
.cl-ayin .fr{border:5px solid #b5733a;border-radius:6px;box-shadow:0 0 0 2px var(--ink);background:#fff;line-height:0}
.cl-ayin h3{font:900 20px/1.1 var(--disp);margin:0}.cl-ayin p{font:700 14px/1.3 var(--body);margin:3px 0}
.cl-chip{display:inline-block;font:800 13px/1 var(--body);padding:4px 8px;border:2px solid var(--ink);border-radius:999px;background:#fff;margin-left:4px}
</style>`;

/** Box at the top of the Ekip panel when a worker's Kurs / Taşı button was tapped. */
export function renderCalisanSel(m: any, P: Por): string {
  const s = m && m.sel; if (!s) return '';
  let h = CSS + `<div class="sb-card cl-sel"><div class="cl-row">${por(P, s, 56)}<div><h3>${esc(s.name)}</h3><p>${esc(s.roleLabel)} · ${esc(s.rankLabel)} · Keyif ${esc(s.morale)}</p></div>${btn('Kapat', 'cClose', null, 'cream sm')}</div>`;
  if (s.mode === 'kurs') {
    h += `<p class="cl-note">${esc(m.merkez)}: işçi gider, süre bitince güçlenmiş döner. Gittiği sürece yeri boş kalır.</p>`;
    for (const k of s.kurslar || []) {
      h += `<div class="cl-k"><div><h4>${esc(k.name)}</h4><p>${esc(k.desc)}</p><p><b>${k.min} dk</b> · +${k.xp} tecrübe${k.morale ? ' · keyif +' + k.morale : ''}</p></div>${btn('Gönder', 'cKurs', s.id + '|' + k.id, 'green', tl(k.cost), !k.can, k.why)}</div>`;
    }
  } else {
    h += `<p class="cl-note">Nereye geçsin? Banktaki işçi maaş almaz, kadroda yer açılınca geri çağırırsın.</p>`;
    for (const d of s.dest || []) {
      const act = d.id === 'bank' ? 'cBank' : 'cCall';
      h += `<div class="cl-k"><div><h4>${esc(d.name)}${d.here ? '<span class="cl-chip">şu an burada</span>' : ''}</h4></div>${d.here ? '' : btn('Taşı', act, s.id, 'blue', undefined, !d.can, d.why)}</div>`;
    }
  }
  return h + '</div>';
}

function tabKadro(m: any, P: Por): string {
  let h = `<div class="sb-card cl-row">${BENCH_IC}<div><h3>${esc(m.bankName)} <span class="cl-chip">${m.bankN} / ${m.bankCap}</span></h3><p>Yedekler burada çay içip martı izler. Kadro dolunca kurstan dönen de buraya oturur.</p></div><span></span></div>`;
  if (!m.bench.length) h += `<div class="sb-card cl-note">Bank boş. İşçi kartındaki <b>Taşı</b> düğmesiyle birini dinlendirebilirsin.</div>`;
  for (const w of m.bench) h += `<div class="sb-card cl-row">${por(P, w, 52)}<div><h3>${esc(w.name)}</h3><p>${esc(w.roleLabel)} · ${esc(w.rankLabel)} · Keyif ${esc(w.morale)}</p></div><div style="display:flex;flex-direction:column;gap:6px">${btn('Göreve çağır', 'cCall', w.id, 'green sm', undefined, !w.canCall, w.why)}${btn('Kurs', 'cSel', w.id + '|kurs', 'cream sm')}</div></div>`;
  return h;
}
function tabKurs(m: any, P: Por): string {
  let h = `<div class="sb-card cl-row">${SCHOOL_IC}<div><h3>${esc(m.merkez)} <span class="cl-chip">${m.kursN} / ${m.kursCap}</span></h3><p>İşçi kartındaki <b>Kurs</b> düğmesine bas, kursu seç. İşçi gider, süre bitince güçlenip döner.</p></div><span></span></div>`;
  if (!m.kurs.length) h += `<div class="sb-card cl-note">Şu an kursta kimse yok. Fevzi Hoca çayını demlemiş bekliyor.</div>`;
  for (const r of m.kurs) h += `<div class="sb-card cl-row">${por(P, r, 52)}<div><h3>${esc(r.name)}</h3><p>${esc(r.kursName)} · ${mmss(r.left)} kaldı</p><div class="cl-bar"><i style="width:${Math.round(Math.max(0, Math.min(1, r.frac)) * 100)}%"></i></div></div><span></span></div>`;
  return h;
}
function tabEtkinlik(m: any, P: Por): string {
  let h = '';
  if (m.ayin) h += `<div class="sb-card cl-ayin"><div class="fr">${P(m.ayin.look || ('ayin' + m.ayin.name), 72, { bg: '#ffe9a8', eyes: 'open' })}</div><div><h3>Ayın Elemanı: ${esc(m.ayin.name)}</h3><p>${esc(m.ayin.roleLabel)} · fotoğrafı büfenin duvarında!</p><p>Yeni seçim ${m.ayinNext} gün sonra. ${esc(m.ayinNote)}</p></div></div>`;
  else h += `<div class="sb-card cl-ayin"><div class="fr">${I('star')}</div><div><h3>Ayın Elemanı</h3><p>En çok çalışan seçilir, fotoğrafı duvara asılır. ${esc(m.ayinNote)}</p></div></div>`;
  for (const e of m.events) {
    const b = e.done ? `<span class="sb-chip ok">Yapıldı</span>` : e.btn ? btn(e.btn, 'cEv', e.id, 'green', e.cost ? tl(e.cost) : 'Bedava', !e.can, 'Şimdilik olmuyor, biraz para ya da ekip lazım.') : '';
    h += `<div class="sb-card cl-row">${EV_IC[e.icon] || ''}<div><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p></div><div>${b}</div></div>`;
  }
  if (m.log && m.log.length) h += `<div class="sb-card"><b style="font:900 16px/1.2 var(--disp)">Ekip defteri</b>${m.log.map((t: string) => `<p class="cl-note" style="margin:4px 0">${esc(t)}</p>`).join('')}</div>`;
  return h;
}
function tabMekan(m: any): string {
  let h = `<div class="sb-card cl-note">Her mekanda 6 ile 10 arası işçi çalışır, büfe büyüdükçe kadro genişler. Yeni mekanlar açılınca işçileri istediğin yere taşırsın. Her mekanın kendine has bir ustası da olacak!</div>`;
  for (const x of m.mekanlar) {
    h += `<div class="sb-card cl-row" style="${x.open ? '' : 'opacity:.75'}">${x.open ? I('people') : I('lock')}<div><h3>${esc(x.name)}${x.open ? `<span class="cl-chip">${x.n} / ${x.cap}</span>` : '<span class="cl-chip">yakında</span>'}</h3>${x.open ? `<p>Kadro en fazla ${x.maxCap} kişi. Tadilatla yer açılır.</p>` : `<p>${esc(x.when)}.</p>`}${x.role ? `<p><b>Özel rol: ${esc(x.role.name)}</b>. ${esc(x.role.desc)}</p><p><i>"${esc(x.role.line)}"</i></p>` : ''}</div><span></span></div>`;
  }
  return h;
}

/** Tabbed section under the worker list. */
export function renderCalisanSection(m: any, P: Por): string {
  if (!m) return '';
  const T = [['kadro', 'Bank'], ['kurs', 'Kurs'], ['etkinlik', 'Etkinlik'], ['mekan', 'Mekanlar']];
  let h = CSS + `<div class="sb-sec">${I('people')}Ekip düzeni<span>Kadro ${m.n} / ${m.cap} · Bank ${m.bankN}${m.kursN ? ' · Kursta ' + m.kursN : ''}</span></div>`;
  h += `<div class="cl-tabs">${T.map(([id, l]) => `<button class="${m.tab === id ? 'on' : ''}" data-a="cTab" data-id="${id}">${l}</button>`).join('')}</div>`;
  if (m.tab === 'kurs') h += tabKurs(m, P);
  else if (m.tab === 'etkinlik') h += tabEtkinlik(m, P);
  else if (m.tab === 'mekan') h += tabMekan(m);
  else h += tabKadro(m, P);
  return h;
}
