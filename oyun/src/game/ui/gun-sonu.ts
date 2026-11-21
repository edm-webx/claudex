// Gün sonu (survey 2026-10-24, user reversed "no end-of-day card"): at 03:00 the screen fades to night black, the
// day's ciro shows, and "Yeni güne başla" starts the next morning. Reads rt.uiLast.gunSonu; writes only the
// 'yeniGun' command. Code-made DOM, Turkish text, no images.
import { PRODUCTS } from '../../content/products';
import { DISH_BY_ID } from '../../content/yemek-menu';
import { ISLETME } from '../../content/esya';
import { KAYNAK_AD } from '../../content/ekonomi2';
import type { Rules } from '../sim/state';
import { fmtMoney } from '../sim/util';

export interface GunSonuView { update(): void; dispose(): void }
export interface GunSonuModel {
  day: number; earned: number; customers: number; angry: number; money: number; record: boolean; maas?: number; ekip?: number; sold?: Record<string, number>; borc?: number; bahsis?: { toplam: number; kisi: number };
  /** EKO-02 gelir defteri: kaynak -> tutar (S.today.src) */
  src?: Record<string, number>;
  // BUF-26 kalemler (karne.ts endDay): hepsi opsiyonel, eski kayıt/test modeliyle de açılır
  brut?: number; birimMaliyet?: number; kisiler?: { ad: string; maas: number; bahsis: number }[]; salon?: { gelir: number; misafir: number }; yan?: number;
  gider?: { kira: number; fatura: number; odenen: number; ertelendi: number }; netKar?: number; masa?: { servis: number; bekleS: number };
  isletme?: { toplam: number; odenen: number; satirlar: { ad: string; tutar: number; odenen: number }[] };
  hijyen?: { not?: string | number; mufettis?: string; marti?: number };
}

const CSS = `
.gs-wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:auto;background:rgba(6,8,22,0);transition:background 1.6s ease;z-index:60}
.gs-wrap.on{background:rgba(6,8,22,.92)}
.gs-card{opacity:0;transform:translateY(18px) scale(.97);transition:opacity .8s ease 1.1s,transform .8s ease 1.1s;background:#fdf3e1;color:#3b2a20;border-radius:22px;border:4px solid #3b2a20;box-shadow:0 10px 0 #3b2a20;padding:22px 24px 20px;width:min(400px,calc(100vw - 32px));max-height:calc(100dvh - 24px);overflow-y:auto;text-align:center;font-family:var(--body)}
.gs-wrap.on .gs-card{opacity:1;transform:none}
.gs-moon{font-size:40px;line-height:1;margin-bottom:4px}
.gs-h{font:900 26px/1.1 var(--disp);margin:2px 0 2px}
.gs-sub{font:700 15px/1.3 var(--body);color:#5a4636;margin-bottom:12px}
.gs-ciro{font:900 40px/1.05 var(--disp);color:#1e8449;margin:6px 0 2px}
.gs-rec{display:inline-block;background:#ffd23f;border:3px solid #3b2a20;border-radius:999px;padding:2px 12px;font:900 13px/1.4 var(--disp);margin:4px 0 6px}
.gs-row{display:flex;justify-content:space-between;align-items:baseline;gap:12px;text-align:left;font:800 16px/1.25 var(--body);padding:7px 2px;border-top:2px dashed rgba(59,42,32,.3)}
.gs-row>span{flex:1 1 auto;min-width:0;overflow-wrap:anywhere}.gs-row>b{flex:0 0 auto;text-align:right;white-space:nowrap}
.gs-row.sub{font-size:15px;font-weight:700;padding:4px 2px 4px 14px;border-top:0;color:#4a382c}
.gs-row.tot{border-top:3px solid #3b2a20;font-size:18px}
.gs-eksi{color:#a93226}.gs-arti{color:#1e6b3f}
.gs-h2{font:900 15px/1.2 var(--disp);text-align:left;margin:12px 0 2px;color:#5a4636;text-transform:uppercase;letter-spacing:.04em}
.gs-not{font:700 14px/1.3 var(--body);color:#5a4636;text-align:left;padding:2px 2px 6px}
.gs-btn{margin-top:14px;width:100%;min-height:58px;border-radius:16px;border:4px solid #3b2a20;background:#ffd23f;box-shadow:0 5px 0 #3b2a20;font:900 21px/1 var(--disp);color:#3b2a20;cursor:pointer}
.gs-btn:active{transform:translateY(4px);box-shadow:0 1px 0 #3b2a20}
`;

export function createGunSonu(deps: { root: HTMLElement; rules: () => Rules | null; command: (c: { kind: string }) => unknown; sfx?: (id: string) => void }): GunSonuView {
  const st = document.createElement('style'); st.textContent = CSS; deps.root.appendChild(st);
  let wrap: HTMLDivElement | null = null, shownDay = -1;
  const close = () => { if (wrap) { wrap.remove(); wrap = null; } shownDay = -1; };
  const ISL_AD: Record<string, string> = {};
  for (const i of Object.values(ISLETME)) for (const y of i.menu) ISL_AD[y.id] = y.ad;
  /** satış anahtarı -> okunur ad: ürün, yemek ya da işletme menüsü ('k:<menü id>') */
  const satisAd = (k: string): string => (PRODUCTS as Record<string, { name?: string }>)[k]?.name || DISH_BY_ID[k]?.ad || (k.startsWith('k:') ? ISL_AD[k.slice(2)] : undefined) || k;
  const eksi = (n: number) => `<b class="gs-eksi">−${fmtMoney(Math.abs(n))}</b>`;
  const row = (ad: string, deger: string, cls = '') => `<div class="gs-row ${cls}"><span>${ad}</span>${deger}</div>`;
  const esc = (t: string) => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
  function show(m: GunSonuModel) {
    const g = m.gider;
    close(); shownDay = m.day;
    const top = Object.entries(m.sold || {}).sort((a, b) => b[1] - a[1]).map(([k, n]) => [satisAd(k), n] as [string, number])[0];
    const brut = m.brut ?? Math.round(m.earned + (m.maas || 0));
    const kisiler = m.kisiler || [];
    const bahsisKisi = (k: { bahsis: number }) => (k.bahsis > 0 ? ` + bahşiş ${fmtMoney(k.bahsis)}` : '');
    const parts: string[] = [];
    parts.push('<div class="gs-h2">Satış</div>');
    parts.push(row('Brüt satış', `<b>${fmtMoney(brut)}</b>`));
    if (m.birimMaliyet) parts.push(row('Birim maliyet', eksi(m.birimMaliyet)));
    if (m.maas) parts.push(row(`Personel maaşı (${m.ekip || kisiler.length} kişi)`, eksi(m.maas)));
    for (const k of kisiler) if (k.maas > 0 || k.bahsis > 0) parts.push(row(esc(k.ad), `<b>${fmtMoney(k.maas)}${bahsisKisi(k)}</b>`, 'sub'));
    if (m.bahsis && m.bahsis.toplam > 0) parts.push(`<div class="gs-not">Bahşiş kumbarası ${fmtMoney(m.bahsis.toplam)}: ${m.bahsis.kisi} kişiye eşit paylaşıldı, kasandan çıkmaz.</div>`);
    if (m.salon && m.salon.gelir > 0) parts.push(row(`Salon ve teras masaları (${m.salon.misafir} misafir, brüte dahil)`, `<b>${fmtMoney(m.salon.gelir)}</b>`));
    if (m.yan && Math.abs(m.yan) >= 1) parts.push(row('Diğer gelir', `<b class="${m.yan < 0 ? 'gs-eksi' : 'gs-arti'}">${m.yan < 0 ? '−' : '+'}${fmtMoney(Math.abs(m.yan))}</b>`));
    parts.push(row('Günün cirosu (net)', `<b>${fmtMoney(m.earned)}</b>`, 'tot'));
    if (m.record) parts.push('<div class="gs-rec">Yeni rekor!</div>');
    // EKO-02: paranın nereden geldiği, kaynak kaynak (gelir defteri)
    const kaynaklar = Object.entries(m.src || {}).filter(([, v]) => v >= 1).sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (kaynaklar.length) {
      parts.push('<div class="gs-h2">Para nereden geldi</div>');
      for (const [k, v] of kaynaklar) parts.push(row(esc((KAYNAK_AD as Record<string, string>)[k] || k), `<b>${fmtMoney(v)}</b>`, 'sub'));
    }
    if (g) {
      // Kasada para yetmediyse kesinti eksik: önce kira, kalanı fatura (gider.ts ile aynı sıra); kalan ertelenir.
      const kiraOd = Math.min(g.kira, g.odenen), faturaOd = g.odenen - kiraOd;
      parts.push('<div class="gs-h2">Kira ve fatura</div>');
      parts.push(row('Kira', eksi(kiraOd)), row('Faturalar (elektrik, su, tüp)', eksi(faturaOd)));
      if (g.ertelendi > 0) parts.push(`<div class="gs-not">Kasa yetmedi: ${fmtMoney(g.ertelendi)} ertelendi (kira ${fmtMoney(g.kira)}, fatura ${fmtMoney(g.fatura)}).</div>`);
    }
    if (m.isletme) {
      parts.push('<div class="gs-h2">İşletmeler</div>');
      for (const s of m.isletme.satirlar) parts.push(row(esc(s.ad) + (s.odenen >= s.tutar ? '' : s.odenen > 0 ? ' (kısmen ödendi, kalanı silindi)' : ' (ödenemedi, silindi)'), eksi(s.odenen), 'sub'));
      parts.push(row('İşletme maaşı toplamı', eksi(m.isletme.odenen)));
    }
    if (m.netKar !== undefined) parts.push(row('Net kâr', `<b class="${m.netKar < 0 ? 'gs-eksi' : 'gs-arti'}">${m.netKar < 0 ? '−' : ''}${fmtMoney(Math.abs(m.netKar))}</b>`, 'tot'));
    parts.push(row('Kasada', `<b>${fmtMoney(m.money)}</b>`));
    if (m.borc) parts.push(row('Banka borcu (faiz işliyor)', `<b>${fmtMoney(m.borc)}</b>`));
    parts.push('<div class="gs-h2">Gün</div>');
    parts.push(row('Müşteri', `<b>${m.customers}</b>`), row('Kızgın giden', `<b>${m.angry}</b>`));
    if (m.masa && m.masa.servis > 0) parts.push(row('Masa servisi', `<b>${m.masa.servis} servis, ort. ${m.masa.bekleS} sn bekleme</b>`));
    if (top) parts.push(row('En çok satan', `<b>${esc(top[0])} (${top[1]} adet)</b>`));
    const h = m.hijyen;   // veri sonra gelir: hiçbiri yoksa bölüm hiç çizilmez
    if (h && (h.not !== undefined || h.mufettis || h.marti !== undefined)) {
      parts.push('<div class="gs-h2">Denetim</div>');
      if (h.not !== undefined) parts.push(row('Hijyen notu', `<b>${esc(String(h.not))}</b>`));
      if (h.mufettis) parts.push(row('Müfettiş', `<b>${esc(h.mufettis)}</b>`));
      if (h.marti !== undefined) parts.push(row('Martı yıldızı', `<b>${'★'.repeat(Math.max(0, Math.min(5, Math.round(h.marti))))}${'☆'.repeat(5 - Math.max(0, Math.min(5, Math.round(h.marti))))}</b>`));
    }
    wrap = document.createElement('div'); wrap.className = 'gs-wrap';
    wrap.innerHTML = `<div class="gs-card"><div class="gs-moon">🌙</div><div class="gs-h">Kepenkler indi</div><div class="gs-sub">${m.day}. gün bitti. Saat 03:00, iskele sessiz.</div>
      ${parts.join('\n')}
      <button class="gs-btn" type="button">Yeni güne başla ☀️</button></div>`;
    deps.root.appendChild(wrap);
    requestAnimationFrame(() => requestAnimationFrame(() => wrap?.classList.add('on')));
    wrap.querySelector('.gs-btn')!.addEventListener('click', () => { deps.sfx?.('pop'); deps.command({ kind: 'yeniGun' }); close(); });
  }
  return {
    update() {
      const r = deps.rules(); const m = r?.rt.uiLast.gunSonu as GunSonuModel | undefined;
      if (m && m.day !== shownDay) show(m);
      else if (!m && wrap) close();
    },
    dispose() { close(); st.remove(); },
  };
}
