// Çalışanlar sections of the Ekip (isciler) panel: selected-worker box (Kurs Merkezi course pick), and a tabbed
// section (Kadro, Kurs) under the worker list. Pure HTML string renderers in the v2ui style (sb-card / sb-btn); data-a
// names map to panelActions('isciler') in sim/panels.ts. Owner: calisan feature (survey calisan-1, calisan-3).
// BUF-02: moral (Keyif), Dinlenme Bankı, Etkinlik and Mekan tabs removed. Big text, one tap per action. Portraits come
// from v2ui's porTag (passed in) so they share its canvas cache.
import { ICONS } from '../../engine/ui/v2-style';

type Por = (look: unknown, px: number, opts?: Record<string, unknown>, cls?: string) => string;
const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const I = (k: string) => ICONS[k] || '';
const tl = (n: number) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' ₺';
const btn = (label: string, act: string, id: string | number | null, cls: string, sub?: string, off?: boolean, why?: string) =>
  `<button class="sb-btn ${cls}${off ? ' off' : ''}" data-a="${act}"${id != null ? ` data-id="${esc(id)}"` : ''}${why ? ` data-why="${esc(why)}"` : ''}><span class="sb-bl">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>`;
const mmss = (s: number) => { const m = Math.floor(s / 60), x = Math.floor(s % 60); return m + ':' + String(x).padStart(2, '0'); };
const por = (P: Por, w: any, px: number) => P(w.look || ('w' + w.id + w.name), px, { bg: '#bfe6e9', eyes: 'open' });

const WAIT_IC = '<svg width="44" height="44" viewBox="0 0 48 48"><rect x="6" y="18" width="36" height="6" rx="2" fill="#c98a4b" stroke="#3b2a20" stroke-width="2.5"/><rect x="6" y="27" width="36" height="5" rx="2" fill="#c98a4b" stroke="#3b2a20" stroke-width="2.5"/><path d="M10 32v9M38 32v9" stroke="#3b2a20" stroke-width="3"/></svg>';
const SCHOOL_IC = '<svg width="44" height="44" viewBox="0 0 48 48"><path d="M8 20L24 10l16 10z" fill="#e0533c" stroke="#3b2a20" stroke-width="2.5"/><rect x="11" y="20" width="26" height="20" fill="#fff6e6" stroke="#3b2a20" stroke-width="2.5"/><rect x="21" y="29" width="6" height="11" fill="#5c8fd6" stroke="#3b2a20" stroke-width="1.5"/></svg>';

const CSS = `<style>
.cl-tabs{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin:8px 0}
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
.cl-chip{display:inline-block;font:800 13px/1 var(--body);padding:4px 8px;border:2px solid var(--ink);border-radius:999px;background:#fff;margin-left:4px}
</style>`;

/** Box at the top of the Ekip panel when a worker's Kurs button was tapped. */
export function renderCalisanSel(m: any, P: Por): string {
  const s = m && m.sel; if (!s) return '';
  let h = CSS + `<div class="sb-card cl-sel"><div class="cl-row">${por(P, s, 56)}<div><h3>${esc(s.name)}</h3><p>${esc(s.roleLabel)} · ${esc(s.rankLabel)}</p></div>${btn('Kapat', 'cClose', null, 'cream sm')}</div>`;
  h += `<p class="cl-note">${esc(m.merkez)}: işçi gider, süre bitince güçlenmiş döner. Gittiği sürece yeri boş kalır.</p>`;
  for (const k of s.kurslar || []) {
    h += `<div class="cl-k"><div><h4>${esc(k.name)}</h4><p>${esc(k.desc)}</p><p><b>${k.min} dk</b> · +${k.xp} tecrübe</p></div>${btn('Gönder', 'cKurs', s.id + '|' + k.id, 'green', tl(k.cost), !k.can, k.why)}</div>`;
  }
  return h + '</div>';
}

function tabKadro(m: any, P: Por): string {
  let h = `<div class="sb-card cl-row">${WAIT_IC}<div><h3>Bekleyenler <span class="cl-chip">${m.benchN}</span></h3><p>Kurstan dönen ama kadrosu dolu olan işçi burada bekler. Kadroda yer açılınca geri çağırırsın.</p></div><span></span></div>`;
  if (!m.bench.length) h += `<div class="sb-card cl-note">Bekleyen kimse yok. Kadro dolu değil ya da herkes görevde.</div>`;
  for (const w of m.bench) h += `<div class="sb-card cl-row">${por(P, w, 52)}<div><h3>${esc(w.name)}</h3><p>${esc(w.roleLabel)} · ${esc(w.rankLabel)}</p></div><div style="display:flex;flex-direction:column;gap:6px">${btn('Göreve çağır', 'cCall', w.id, 'green sm', undefined, !w.canCall, w.why)}${btn('Kurs', 'cSel', w.id + '|kurs', 'cream sm')}</div></div>`;
  return h;
}
function tabKurs(m: any, P: Por): string {
  let h = `<div class="sb-card cl-row">${SCHOOL_IC}<div><h3>${esc(m.merkez)} <span class="cl-chip">${m.kursN} / ${m.kursCap}</span></h3><p>İşçi kartındaki <b>Kurs</b> düğmesine bas, kursu seç. İşçi gider, süre bitince güçlenip döner.</p></div><span></span></div>`;
  if (!m.kurs.length) h += `<div class="sb-card cl-note">Şu an kursta kimse yok. Fevzi Hoca çayını demlemiş bekliyor.</div>`;
  for (const r of m.kurs) h += `<div class="sb-card cl-row">${por(P, r, 52)}<div><h3>${esc(r.name)}</h3><p>${esc(r.kursName)} · ${mmss(r.left)} kaldı</p><div class="cl-bar"><i style="width:${Math.round(Math.max(0, Math.min(1, r.frac)) * 100)}%"></i></div></div><span></span></div>`;
  return h;
}

/** Tabbed section under the worker list. */
export function renderCalisanSection(m: any, P: Por): string {
  if (!m) return '';
  const T = [['kadro', 'Kadro'], ['kurs', 'Kurs']];
  let h = CSS + `<div class="sb-sec">${I('people')}Ekip düzeni<span>Kadro ${m.n} / ${m.cap}${m.benchN ? ' · Bekleyen ' + m.benchN : ''}${m.kursN ? ' · Kursta ' + m.kursN : ''}</span></div>`;
  h += `<div class="cl-tabs">${T.map(([id, l]) => `<button class="${m.tab === id ? 'on' : ''}" data-a="cTab" data-id="${id}">${l}</button>`).join('')}</div>`;
  if (m.tab === 'kurs') h += tabKurs(m, P);
  else h += tabKadro(m, P);
  return h;
}
