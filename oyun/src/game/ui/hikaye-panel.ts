// Hikaye Defteri sheet ('hikaye' panel) and the "Hikaye" section of the Görevler panel (survey hikaye-1..7,
// kontrol-7, zincir-1..8). Pure HTML string renderers in the v2ui style; data-a names map to panelActions('hikaye')
// / ('gorevler') in sim/panels.ts. Tabs: Bölümler, Rakipler, Günlük, Tekrar izle (tutorials + finales).
import { ICONS } from '../../engine/ui/v2-style';
import { portrait } from './hikaye-portrait';

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const I = (k: string) => ICONS[k] || '';
const btn = (label: string, act: string, id: string | null, cls: string, sub?: string) =>
  `<button class="sb-btn ${cls}" data-a="${act}"${id != null ? ` data-id="${esc(id)}"` : ''}><span class="sb-bl">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>`;
const meter = (p: number, c: string) => `<div class="sb-meter"><i style="width:${(Math.max(0, Math.min(1, p)) * 100).toFixed(1)}%;background:${c}"></i></div>`;
const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const CSS = `<style>
.hk-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px}
.hk-tabs button{min-height:52px;border:2.5px solid var(--ink);border-radius:14px;background:var(--cream);font:900 15px/1.1 var(--disp);color:var(--ink)}
.hk-tabs button.on{background:var(--yellow);transform:translateY(-2px);box-shadow:0 3px 0 var(--ink)}
.hk-ch{display:grid;grid-template-columns:48px 1fr;gap:10px;align-items:center}
.hk-ch .no{width:48px;height:48px;border:2.5px solid var(--ink);border-radius:50%;display:flex;align-items:center;justify-content:center;font:900 22px/1 var(--disp);background:var(--cream)}
.hk-ch.done .no{background:var(--money,#6bb36b);color:#fff}.hk-ch.now .no{background:var(--yellow)}.hk-ch.lock{opacity:.55}
.hk-ch h3{margin:0;font:900 19px/1.15 var(--disp)}.hk-ch p{margin:3px 0;font:700 15px/1.3 var(--body)}
.hk-q{display:grid;grid-template-columns:44px 1fr;gap:8px;align-items:center;margin-top:8px}
.hk-q h4{margin:0;font:900 17px/1.15 var(--disp)}.hk-q p{margin:2px 0;font:700 15px/1.3 var(--body)}
.hk-q.ok{opacity:.7}.hk-q .sb-meter{margin-top:4px}
.hk-rv{display:grid;grid-template-columns:56px 1fr;gap:10px;align-items:start}.hk-rv h3{margin:0;font:900 18px/1.15 var(--disp)}
.hk-rv p{margin:3px 0;font:700 15px/1.3 var(--body)}.hk-rv q{display:block;font:italic 700 15px/1.3 var(--body);margin-top:4px}
.hk-rv.yok{opacity:.5;filter:grayscale(.7)}.hk-tag{display:inline-block;border:2px solid var(--ink);border-radius:999px;padding:1px 8px;font:900 12px/1.4 var(--disp);margin-left:4px}
.hk-log{font:700 15px/1.35 var(--body);padding:8px 10px;border-bottom:1.5px dashed rgba(59,42,32,.3)}.hk-log b{font:900 13px/1 var(--disp);margin-right:6px;opacity:.7}
.hk-rp{display:grid;grid-template-columns:48px 1fr auto;gap:8px;align-items:center}.hk-rp h4{margin:0;font:900 17px/1.15 var(--disp)}
.hk-sec{display:flex;gap:10px;align-items:center}.hk-sec h3{margin:0;font:900 18px/1.1 var(--disp)}.hk-sec p{margin:2px 0;font:700 15px/1.3 var(--body)}
</style>`;

function tabs(t: string): string {
  const T: [string, string][] = [['bolum', 'Bölümler'], ['rakip', 'Rakipler'], ['gunluk', 'Günlük'], ['tekrar', 'Tekrar izle']];
  return `<div class="hk-tabs">${T.map(([id, l]) => `<button class="${t === id ? 'on' : ''}" data-a="hkTab" data-id="${id}">${l}</button>`).join('')}</div>`;
}

function renderBolum(m: any): string {
  let s = '';
  if (m.season) s += `<div class="sb-card sb-muted" style="font:800 16px/1.35 var(--body)">${I('sparkle')} Ay'a gidip döndün! Martıköy'de yeni sezon: arada yeni tuhaflıklar olacak.</div>`;
  for (const c of m.chapters || []) {
    s += `<div class="sb-card hk-ch ${c.state}"><div class="no">${c.state === 'done' ? '✓' : c.n}</div><div><h3>${esc(c.place)}: ${esc(c.title)}</h3><p>${c.state === 'lock' ? I('lock') + ' Önceki bölüm bitince açılır.' : esc(c.blurb)}</p>${c.state === 'now' ? `<p>Bölüm ödülü: ${esc(c.reward)}</p>` : ''}</div>`;
    if (c.state === 'now') {
      for (const q of c.quests) s += `<div class="hk-q${q.done ? ' ok' : ''}" style="grid-column:1/-1">${portrait(q.who, 44)}<div><h4>${q.done ? '✓ ' : ''}${esc(q.title)}</h4><p>${esc(q.text)} <span class="sb-muted">(${esc(q.giver)})</span></p>${meter(q.p / Math.max(1, q.need), q.done ? 'var(--money,#6bb36b)' : 'var(--tea)')}<p>${fmt(q.p)} / ${fmt(q.need)}</p></div></div>`;
    }
    if (c.state === 'done') s += `<div style="grid-column:1/-1;margin-top:6px">${btn('Finali tekrar izle', 'hkReplay', c.finale, 'cream sm', c.finaleTitle)}</div>`;
    s += '</div>';
  }
  return s;
}
function renderRakip(m: any): string {
  let s = `<div class="sb-card sb-muted" style="font:700 15px/1.35 var(--body)">Rakipler ara sıra kampanya, casus müşteri, billboard ya da dron gönderir. Gelir düşüşü küçük ve kısa sürer. Tat Yarışı: ${m.wins || 0} galibiyet, ${m.losses || 0} yenilgi.${m.dip ? ` <b>Şu an rakip etkisi: -%${m.dip}</b>` : ''}${m.boost ? ` <b>Mahalle seninle: +%${m.boost}</b>` : ''}</div>`;
  if (m.event) s += `<div class="sb-card" style="font:800 16px/1.3 var(--body)">${I('bolt')} Şu an: ${esc(m.event.title)} (${esc(m.event.rival)}). Ekrandaki düğmeyle cevap ver.</div>`;
  if (m.ortak) s += `<div class="sb-card" style="font:800 16px/1.3 var(--body)">${I('gorev')} Ortak iş, ${esc(m.ortak.name)}: ${m.ortak.got} / ${m.ortak.need} satış</div>`;
  for (const r of m.rivals || []) {
    const tag = r.state === 'yok' ? 'Henüz ortada yok' : r.state === 'donustu' ? 'Dönüştü, artık dost' : 'Rakip';
    s += `<div class="sb-card hk-rv ${r.state}">${portrait(r.who, 56)}<div><h3>${esc(r.name)}<span class="hk-tag" style="background:${esc(r.color)}33">${esc(r.kind)}</span></h3><p><b>"${esc(r.slogan)}"</b></p><p>${esc(r.blurb)}</p><p><span class="hk-tag">${tag}</span></p>${r.state === 'aktif' ? `<q>${esc(r.quip)}</q>` : ''}${r.state === 'donustu' ? `<p>${esc(r.turned)}</p>` : ''}</div></div>`;
  }
  return s;
}
function renderGunluk(m: any): string {
  const L = m.log || [];
  if (!L.length) return `<div class="sb-card sb-muted">Hikaye günlüğü boş. Biraz servis yap, Pamuk yazmaya başlar.</div>`;
  return `<div class="sb-card" style="padding:4px 2px">${L.map((x: any) => `<div class="hk-log"><b>${x.d}. gün</b>${esc(x.t)}</div>`).join('')}</div>`;
}
function renderTekrar(m: any): string {
  let s = `<div class="sb-sec">${I('play')}Öğreticiler<span>Tanıdık yüzler 10 saniyede anlatır</span></div>`;
  for (const t of m.tutors || []) s += `<div class="sb-card hk-rp">${portrait(t.who, 48)}<div><h4>${esc(t.name)}</h4></div>${t.seen ? btn('İzle', 'hkReplay', t.id, 'green sm') : `<span class="sb-chip">${I('lock')} Açılınca</span>`}</div>`;
  const sc = m.scenes || [];
  s += `<div class="sb-sec">${I('sparkle')}Sahneler<span>${sc.length}</span></div>`;
  if (!sc.length) s += `<div class="sb-card sb-muted">Bölüm finalleri ve tuhaf anlar burada birikir.</div>`;
  for (const x of sc) s += `<div class="sb-card hk-rp">${portrait('pamuk', 48)}<div><h4>${esc(x.title)}</h4></div>${btn('İzle', 'hkReplay', x.id, 'cream sm')}</div>`;
  return s;
}

export function renderHikaye(m: any): string {
  const t = m.tab || 'bolum';
  let s = CSS + tabs(t);
  try { s += t === 'rakip' ? renderRakip(m) : t === 'gunluk' ? renderGunluk(m) : t === 'tekrar' ? renderTekrar(m) : renderBolum(m); }
  catch (e) { console.error('[hikaye] panel', e); }
  return s;
}

/** Small card for the Görevler panel that opens the Hikaye Defteri. */
export function renderHikayeSection(k: any): string {
  if (!k) return '';
  const head = k.season ? 'Yeni sezon, Martıköy' : `Bölüm ${k.n}: ${esc(k.place)}`;
  const sub = k.season ? 'Tuhaflıklar sürüyor...' : `${esc(k.title)} · Görev ${k.done} / ${k.total}`;
  return CSS + `<div class="sb-sec">${I('newspaper')}Hikaye<span>${k.season ? '' : k.done + ' / ' + k.total}</span></div><div class="sb-card hk-sec">${portrait('sabri', 52)}<div class="sb-grow"><h3>${head}${k.isNew ? ' <span class="sb-chip gold">Yeni!</span>' : ''}</h3><p>${sub}</p>${k.next && !k.season ? `<p>Sırada: ${esc(k.next)}</p>` : ''}${k.event ? `<p>${I('bolt')} ${esc(k.event)}</p>` : ''}</div>${btn('Aç', 'hikayeOpen', null, 'green sm')}</div>`;
}
