// EKO-01 ölçüm tezgahı (test dosyası değil): kafasız simde üç oyuncu stratejisi koşar, 5 dakikalık adımlarla satır üretir.
// Strateji: 'normal' = bot-ai.mjs + holding katmanı (işletme alır), 'yari' = botun yarısı kadar etkin (müşterinin ~%50'sine yetişir), 'bos' = hiç dokunmaz (yalnız ekip ve pasif gelir).
// İstismar botları (okul, mevduat, kredi, bahis) ayrı: istismar().
// Varsayımlar (raporda yazılı): oyuncu işletme kasasına günde bir kez uğrar (gün sonunda tahakkuk eden kasa paraya geçer);
// işletme yükseltmesi (raf_kiti eşyası ister) alınmaz; zaman ölçüsü oyun dakikası (S.playT), gün 480 sn (GAME_DAY_S sabit).
import { createSim } from '../../src/game/headless';
import { kareyeGit } from './m1-helpers';
import { emptyContent } from '../../src/content/index';
// @ts-expect-error plain ESM JS shared with the browser bot
import { makeBot } from '../../src/game/ui/bot-ai.mjs';
import { panelModel } from '../../src/game/sim/panels';
import { ARSALAR, BANKA, isciFiyat, kafeIsciMax } from '../../src/content/esya';
import { IC_BY_ID } from '../../src/content/ic-mekan';
import { acilisEksik } from '../../src/content/acilis';
import { GAME_DAY_S } from '../../src/engine/api';

const log = { info() {}, warn() {}, error() {} };
export type Strateji = 'normal' | 'yari' | 'bos';
export type IstismarKaynak = 'okul' | 'mevduat' | 'kredi' | 'bahis';
export const ADIM_S = 300;

export function adapter(sim: any) {
  const rules = () => sim.rules;
  return {
    state: () => rules().v2State(), input: (x: number, z: number) => sim.input({ x, z }),
    path: (a: any, b: any) => { const p = sim.nav.path(a, b); return p && p.length ? p.map((q: any) => ({ x: q.x, z: q.z })) : [{ x: b.x, z: b.z }]; },
    claimOrder: (id: string) => sim.command({ kind: 'claimOrder', id }), panelModel: (id: string) => panelModel(id as any, rules()),
    upgradeTier: (id: string) => sim.command({ kind: 'upgradeTier', id }), decorBuy: (id: string) => sim.command({ kind: 'decorBuy', id }),
    saveSign: (text: string, font: string) => sim.command({ kind: 'saveSign', text, font }), signSet: () => !!rules().state.sign,
    skipCeremony: () => sim.command({ kind: 'skipCeremony' }), tapSlow: () => sim.command({ kind: 'tapSlow' }),
    solution: () => (rules().rt.uiLast.solution as any) || null, acceptSolution: () => sim.command({ kind: 'acceptSolution' }),
    jobBoardModel: () => panelModel('jobBoard', rules()) as any, hireCandidate: (id: string) => sim.command({ kind: 'hireCandidate', id }),
  };
}

export interface Satir {
  dk: number; gun: number; asama: number; seviye: number; para: number; toplam: number;
  /** son adımdaki gelir kaynakları (₺): tezgah, salon, isletme, diger (ödül, bahşiş, görev, faiz...) */
  tezgah: number; salon: number; isletme: number; diger: number;
  /** gün sonu giderleri (kira + fatura) ve brüt satış, son adımdaki toplam */
  gider: number; satis: number;
  isletmeSayisi: number; holdingDeger: number; netSaat: number;
}
export interface Kosu {
  strateji: string; tohum: number; saniye: number; satirlar: Satir[];
  asamaDk: Record<number, number>; seviyeDk: Record<number, number>; ilkIsletmeDk: number | null; ilkIsletmeGun: number | null;
  gunler: { gun: number; kazanc: number; musteri: number }[];
  toplam: number; kaynak: { tezgah: number; salon: number; isletme: number; diger: number };
  /** EKO-02 gelir defteri: kaynak kimliği -> koşu boyunca toplam ₺ (S.stats.kaynak_*), her kaynak ayrı satır */
  defter: Record<string, number>;
}

const plots = (S: any): Record<string, any> => ((S.zones.arsa as any)?.plots) || {};
const isletmeAdet = (S: any) => Object.values(plots(S)).filter((p: any) => p && p.tur === 'dukkan').length;

/** Holding katmanı: para + seviye karşılanınca en ucuz işletmeyi alır, kasada 2 günlük tampon bırakır (büfe tadilatı aç kalmasın). */
function holdingHamle(sim: any, S: any, rt: any): void {
  if (!(S.stage >= 2)) return;   // önce büfe 2. aşama: bir oyuncu büfesini toparlamadan karşıya geçmez (taslak varsayım)
  const sahip = plots(S);
  // sahip olunan işletmeye işçi tut: oda sim'inde müşteriyi yalnız işçi (veya oyuncu) karşılar, işçisiz işletme gelir getirmez (oyuncu içeride durmuyor varsayımı)
  for (const id of Object.keys(sahip)) { const p = sahip[id], n = Number(p.isci) || 0; if (p.tur === 'dukkan' && n < Math.min(2, kafeIsciMax(p.lv)) && S.money >= isciFiyat(n) * 2) { sim.command({ kind: 'mulk', op: 'isciAl', id }); return; } }
  const dur = { stage: S.stage, stars: S.stars, level: S.level, stats: S.stats, sahip: (id: string) => !!sahip[id] };   // sıralı açılma (content/acilis.ts)
  const aday = ARSALAR.filter(a => a.sabit && !sahip[a.id] && !acilisEksik(a, dur).length).sort((a, b) => a.fiyat - b.fiyat)[0];
  if (!aday) return;
  const tampon = 3000;
  if (S.money < aday.fiyat + tampon) return;
  // AVM dükkânı yalnız kapısındaki sarı karede alınır: oyuncu kareye gidip alır, sonra kaldığı yere döner (yürüme süresi taslakta yok sayılır)
  const pp = sim.rules.playerPos, eski = { x: pp.x, z: pp.z, kat: pp.kat || 0 };
  kareyeGit(sim, aday.id); sim.command({ kind: 'mulk', op: 'arsaAl', id: aday.id });
  if (pp.x !== eski.x || pp.z !== eski.z) sim.command({ kind: 'teleport', ...eski });
}

/** S.stats.kaynak_* -> { kaynak: ₺ } (EKO-02 gelir defteri). */
const defterOku = (S: any): Record<string, number> => Object.fromEntries(Object.entries(S.stats as Record<string, number>).filter(([k]) => k.startsWith('kaynak_')).map(([k, v]) => [k.slice(7), Math.round(v)]));

export function kosu(o: { tohum?: number; saniye: number; strateji?: Strateji; holding?: boolean; adimS?: number }): Kosu {
  const tohum = o.tohum ?? 3, strateji = o.strateji ?? 'normal', holding = o.holding !== false, adimS = o.adimS ?? ADIM_S;
  const sim: any = createSim({ seed: tohum, content: emptyContent() }, { log });
  sim.command({ kind: 'play', hero: 'sabri' });
  const S = sim.rules.state, rt = sim.rules.rt;
  const bot = makeBot(adapter(sim));
  const satirlar: Satir[] = [], asamaDk: Record<number, number> = {}, seviyeDk: Record<number, number> = {}, gunler: Kosu['gunler'] = [];
  let ilkIsletmeDk: number | null = null, ilkIsletmeGun: number | null = null;
  let tezgahK = 0, isletmeK = 0, giderK = 0, satisK = 0;
  const bos = { tezgah: 0, salon: 0, isletme: 0, diger: 0 };
  const top = { ...bos };
  let prev = { toplam: 0, tezgah: 0, salon: 0, isletme: 0, gider: 0, satis: 0 };
  sim.bus.onAny((r: any) => { if (r.name === 'sale') tezgahK += Number((r.data as any)?.value) || 0; });
  sim.bus.on('dayEnd', (d: any) => {
    const g = (rt.uiLast as any).giderSon; if (g && g.day === d.day) { giderK += (g.kira || 0) + (g.fatura || 0); satisK += g.satis || 0; }
    gunler.push({ gun: d.day, kazanc: Number(d.earned) || 0, musteri: Number(d.customers) || 0 });
    // varsayım: oyuncu günde bir kez işletme kasasına uğrar
    for (const p of Object.values(plots(S)) as any[]) { if (p && p.till >= 1) { const v = Math.floor(p.till); p.till -= v; S.money += v; S.totalEarned += v; isletmeK += v; } }
  });
  const holdingDeger = () => Object.keys(plots(S)).reduce((t, id) => t + (ARSALAR.find(a => a.id === id)?.fiyat || 0), 0);
  for (let sec = 0; sec < o.saniye; sec++) {
    const yari = strateji === 'bos' || (strateji === 'yari' && (Math.floor(sec / 20) * 2654435761 >>> 0) % 2 === 0);   // 20 sn'lik pencerelerin yarısında oyuncu yok
    for (let i = 0; i < 10; i++) { if (yari) sim.input({ x: 0, z: 0 }); else bot.tick(); sim.step(0.1); }
    if (rt.paused) { rt.paused = false; rt.pauseWhy = ''; }
    if (holding && sec % 5 === 0) holdingHamle(sim, S, rt);
    const dk = S.playT / 60;
    if (!asamaDk[S.stage] && S.stage > 1) asamaDk[S.stage] = Math.round(dk * 10) / 10;
    if (!seviyeDk[S.level] && S.level > 1) seviyeDk[S.level] = Math.round(dk * 10) / 10;
    if (ilkIsletmeDk === null && isletmeAdet(S) > 0) { ilkIsletmeDk = Math.round(dk * 10) / 10; ilkIsletmeGun = S.day; }
    if ((sec + 1) % adimS === 0) {
      const salonT = Number((S.zones.salon as any)?.toplam) || 0;
      const toplam = S.totalEarned;
      const d = { tezgah: tezgahK - prev.tezgah, salon: salonT - prev.salon, isletme: isletmeK - prev.isletme };
      const dig2 = Math.max(0, toplam - prev.toplam - d.tezgah - d.salon - d.isletme);   // işletme kasası totalEarned'a da yazıldı
      top.tezgah += d.tezgah; top.salon += d.salon; top.isletme += d.isletme; top.diger += dig2;
      satirlar.push({
        dk: Math.round(dk), gun: S.day, asama: S.stage, seviye: S.level, para: Math.round(S.money), toplam: Math.round(toplam),
        tezgah: Math.round(d.tezgah), salon: Math.round(d.salon), isletme: Math.round(d.isletme), diger: Math.round(dig2),
        gider: Math.round(giderK - prev.gider), satis: Math.round(satisK - prev.satis),
        isletmeSayisi: isletmeAdet(S), holdingDeger: holdingDeger(), netSaat: Math.round((toplam - prev.toplam) * 3600 / adimS),
      });
      prev = { toplam, tezgah: tezgahK, salon: salonT, isletme: isletmeK, gider: giderK, satis: satisK };
    }
  }
  return { strateji, tohum, saniye: o.saniye, satirlar, asamaDk, seviyeDk, ilkIsletmeDk, ilkIsletmeGun, gunler, toplam: S.totalEarned, kaynak: top, defter: defterOku(S) };
}

/** Birden çok tohumun ortalaması: aynı dakikadaki satırlar toplanıp bölünür, aşama dakikaları ortalanır (varılmayanlar atlanır). */
export function ortalama(kosular: Kosu[]): Kosu {
  const n = kosular.length, ilk = kosular[0];
  const satirlar = ilk.satirlar.map((_, i) => {
    const hepsi = kosular.map(k => k.satirlar[i]).filter(Boolean), m = (f: (s: Satir) => number) => Math.round(hepsi.reduce((t, s) => t + f(s), 0) / hepsi.length);
    return { dk: hepsi[0].dk, gun: m(s => s.gun), asama: m(s => s.asama), seviye: m(s => s.seviye), para: m(s => s.para), toplam: m(s => s.toplam), tezgah: m(s => s.tezgah), salon: m(s => s.salon), isletme: m(s => s.isletme), diger: m(s => s.diger), gider: m(s => s.gider), satis: m(s => s.satis), isletmeSayisi: m(s => s.isletmeSayisi), holdingDeger: m(s => s.holdingDeger), netSaat: m(s => s.netSaat) } as Satir;
  });
  const ortMap = (key: 'asamaDk' | 'seviyeDk') => { const out: Record<number, number> = {}; for (const k of kosular.flatMap(x => Object.keys(x[key]))) { if (out[+k]) continue; const v = kosular.map(x => x[key][+k]).filter(x => x !== undefined); if (v.length) out[+k] = Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10; } return out; };
  const il = kosular.map(k => k.ilkIsletmeDk).filter((x): x is number => x !== null), ig = kosular.map(k => k.ilkIsletmeGun).filter((x): x is number => x !== null);
  const kaynak = { tezgah: 0, salon: 0, isletme: 0, diger: 0 }; for (const k of kosular) for (const key of Object.keys(kaynak) as (keyof typeof kaynak)[]) kaynak[key] += k.kaynak[key] / n;
  return { strateji: ilk.strateji, tohum: -1, saniye: ilk.saniye, satirlar, asamaDk: ortMap('asamaDk'), seviyeDk: ortMap('seviyeDk'),
    ilkIsletmeDk: il.length ? Math.round(il.reduce((a, b) => a + b, 0) / il.length * 10) / 10 : null, ilkIsletmeGun: ig.length ? Math.round(ig.reduce((a, b) => a + b, 0) / ig.length) : null,
    gunler: ilk.gunler, toplam: kosular.reduce((t, k) => t + k.toplam, 0) / n, kaynak,
    defter: Object.fromEntries([...new Set(kosular.flatMap(k => Object.keys(k.defter)))].map(key => [key, Math.round(kosular.reduce((t, k) => t + (k.defter[key] || 0), 0) / n)])) };
}

/** Kaynak payları (0..1) toplam kazancın içinde. */
export function paylar(k: Kosu): Record<'tezgah' | 'salon' | 'isletme' | 'diger', number> {
  const t = k.kaynak.tezgah + k.kaynak.salon + k.kaynak.isletme + k.kaynak.diger || 1;
  return { tezgah: k.kaynak.tezgah / t, salon: k.kaynak.salon / t, isletme: k.kaynak.isletme / t, diger: k.kaynak.diger / t };
}

/** Bir dakikadaki (en yakın satır) toplam kazanç. */
export function toplamDk(k: Kosu, dk: number): number { const s = k.satirlar.filter(x => x.dk <= dk).pop(); return s ? s.toplam : 0; }

// ── istismar botları: tek kaynak, insan hızında ──
export interface IstismarSonuc { kaynak: IstismarKaynak; saniye: number; kazanc: number; saatlik: number; ayrinti: string }
function tp(sim: any, x: number, z: number) { sim.command({ kind: 'teleport', x, z }); sim.step(0.2); }

export function istismar(kaynak: IstismarKaynak, o: { tohum?: number; saniye?: number; seviye?: number; mevduat?: number; maclar?: number } = {}): IstismarSonuc {
  const sim: any = createSim({ seed: o.tohum ?? 3, content: emptyContent() }, { log });
  sim.command({ kind: 'play', hero: 'sabri' });
  const S = sim.rules.state, rt = sim.rules.rt, saniye = o.saniye ?? 3600;
  if (o.seviye) sim.command({ kind: 'force', what: 'level', value: o.seviye });
  const unp = () => { if (rt.paused) { rt.paused = false; rt.pauseWhy = ''; } };
  const adimS = 2;
  if (kaynak === 'okul') {
    const m = IC_BY_ID.okul; tp(sim, m.x, m.z + 1.2);
    sim.command({ kind: 'mulk', op: 'dersBasla' });
    const para0 = S.totalEarned; let sinav = 0;
    for (let t = 0; t < saniye; t += adimS) {
      const z = S.zones.okul as any; if (!z || z.soru < 0) { sim.command({ kind: 'mulk', op: 'dersBasla' }); }
      const ok = (S.zones.okul as any); const i = ok.secenek.indexOf(ok.soru);
      sim.command({ kind: 'mulk', op: 'dersCevap', n: Math.max(0, i) });
      sim.step(adimS); unp();
    }
    sinav = Number(S.stats.sinav) || 0;
    return { kaynak, saniye, kazanc: S.totalEarned - para0, saatlik: (S.totalEarned - para0) * 3600 / saniye, ayrinti: sinav + ' sınav' };
  }
  if (kaynak === 'mevduat') {
    const yatir = o.mevduat ?? 1_000_000;
    sim.command({ kind: 'force', what: 'money', value: yatir }); tp(sim, BANKA.kapi.x, BANKA.kapi.z);
    sim.command({ kind: 'mulk', op: 'tlYatir', n: yatir });
    const b = () => (rt.banka?.tl as number) || 0, tl0 = b();
    for (let t = 0; t < saniye; t += 10) { sim.step(10); unp(); }
    return { kaynak, saniye, kazanc: b() - tl0, saatlik: (b() - tl0) * 3600 / saniye, ayrinti: 'ana para ' + tl0 + ', son ' + b() };
  }
  if (kaynak === 'kredi') {
    tp(sim, BANKA.kapi.x, BANKA.kapi.z);
    const para0 = S.money, borc = () => ((S.zones.arsa as any)?.kredi?.borc as number) || 0;
    for (let i = 0; i < 20; i++) { sim.command({ kind: 'mulk', op: 'krediAl', n: 1_000_000 }); sim.step(adimS); }
    for (let t = 0; t < saniye; t += 10) { sim.step(10); unp(); }
    return { kaynak, saniye, kazanc: S.money - para0, saatlik: (S.money - para0) * 3600 / saniye, ayrinti: 'borç ' + Math.round(borc()) + ', çekilen nakit hiç ödenmedi' };
  }
  // bahis: her maçta en olası sonuca azami bahis; bir maç izlemek ~(halfS*2) sn sürer, saatte en çok 30
  const maclar = o.maclar ?? 30; let net = 0; let kazanilan = 0;
  sim.command({ kind: 'force', what: 'money', value: 200_000 });
  for (let i = 0; i < maclar; i++) {
    const once = S.money;
    sim.command({ kind: 'halisaha', op: 'izle', bahis: '1', n: 5000 });
    sim.command({ kind: 'halisaha', op: 'izleSonuc' }); unp();
    net += S.money - once; if (S.money > once) kazanilan++;
    sim.step(1);
  }
  return { kaynak, saniye: maclar * 120, kazanc: net, saatlik: net * 3600 / (maclar * 120), ayrinti: maclar + ' maç, ' + kazanilan + ' tuttu' };
}

// ── çıktılar: CSV ve tek sayfalık HTML eğri (scratch'e yazılır, repoya değil) ──
export function csv(k: Kosu): string {
  const bas = 'dk,gun,asama,seviye,para,toplam,tezgah,salon,isletme,diger,gider,satis,isletmeSayisi,holdingDeger,netSaat';
  return bas + '\n' + k.satirlar.map(s => [s.dk, s.gun, s.asama, s.seviye, s.para, s.toplam, s.tezgah, s.salon, s.isletme, s.diger, s.gider, s.satis, s.isletmeSayisi, s.holdingDeger, s.netSaat].join(',')).join('\n') + '\n';
}
export function tablo(k: Kosu): string {
  const L: string[] = [`[${k.strateji}] tohum ${k.tohum} süre ${Math.round(k.saniye / 60)} dk, gün ${GAME_DAY_S} sn`];
  L.push('dk | gün | aşama | sev | cep | toplam | net/saat | tezgah/salon/işletme/diğer | işletme');
  for (const s of k.satirlar) if (s.dk % 15 === 0) L.push([s.dk, s.gun, s.asama, s.seviye, s.para, s.toplam, s.netSaat, [s.tezgah, s.salon, s.isletme, s.diger].join('/'), s.isletmeSayisi].join(' | '));
  L.push('aşama dk: ' + JSON.stringify(k.asamaDk) + ' | seviye dk: ' + JSON.stringify(k.seviyeDk) + ' | ilk işletme: ' + (k.ilkIsletmeDk === null ? 'yok' : k.ilkIsletmeDk + ' dk, ' + k.ilkIsletmeGun + '. gün'));
  L.push('gelir defteri (kaynak: ₺): ' + Object.entries(k.defter).sort((a, b) => b[1] - a[1]).map(([a, v]) => a + ' ' + v.toLocaleString('tr')).join(' | '));
  return L.join('\n');
}
export function egriHtml(kosular: Kosu[], baslik = 'Ekonomi eğrisi'): string {
  const renk = ['#d9534f', '#2f6f9a', '#3fa35a', '#b07a48'], W = 760, H = 360, P = 52;
  const maxDk = Math.max(...kosular.flatMap(k => k.satirlar.map(s => s.dk)), 1), maxT = Math.max(...kosular.flatMap(k => k.satirlar.map(s => s.toplam)), 1);
  const x = (dk: number) => P + dk / maxDk * (W - P - 12), y = (v: number) => H - P - Math.sqrt(v / maxT) * (H - P - 12);   // karekök ölçek: erken ve geç aşama birlikte okunur
  const yol = kosular.map((k, i) => `<polyline fill="none" stroke="${renk[i % 4]}" stroke-width="2.4" points="${k.satirlar.map(s => x(s.dk).toFixed(1) + ',' + y(s.toplam).toFixed(1)).join(' ')}"/>`).join('');
  const isaret = kosular.flatMap((k, i) => Object.entries(k.asamaDk).map(([a, dk]) => `<circle cx="${x(+dk).toFixed(1)}" cy="${y(toplamDk(k, +dk)).toFixed(1)}" r="4" fill="${renk[i % 4]}"/><text x="${x(+dk) + 6}" y="${y(toplamDk(k, +dk)) - 6}" font-size="11" fill="currentColor">A${a}</text>`)).join('');
  const lej = kosular.map((k, i) => `<span style="color:${renk[i % 4]}">&#9632;</span> ${k.strateji} (${k.tohum < 0 ? 'ortalama' : 'tohum ' + k.tohum})`).join(' &nbsp; ');
  const satir = kosular.map(k => `<tr><td>${k.strateji}</td><td>${Object.entries(k.asamaDk).map(([a, d]) => 'A' + a + ': ' + d + ' dk').join(', ') || '-'}</td><td>${k.ilkIsletmeDk === null ? '-' : k.ilkIsletmeDk + ' dk (' + k.ilkIsletmeGun + '. gün)'}</td><td>${Math.round(k.toplam).toLocaleString('tr')} ₺</td></tr>`).join('');
  return `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${baslik}</title>
<style>:root{color-scheme:light dark;--bg:#fbf7ef;--fg:#2a2118}@media(prefers-color-scheme:dark){:root{--bg:#1d1812;--fg:#f1e8d8}}body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}svg{max-width:100%;height:auto}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #8884;padding:6px 8px;text-align:left}</style>
<h1>${baslik}</h1><p>${lej}</p>
<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Toplam kazanç eğrisi"><line x1="${P}" y1="${H - P}" x2="${W - 8}" y2="${H - P}" stroke="currentColor" opacity=".4"/><line x1="${P}" y1="8" x2="${P}" y2="${H - P}" stroke="currentColor" opacity=".4"/>${yol}${isaret}
<text x="${P}" y="${H - 14}" font-size="12" fill="currentColor">0 dk</text><text x="${W - 70}" y="${H - 14}" font-size="12" fill="currentColor">${maxDk} dk</text><text x="4" y="14" font-size="12" fill="currentColor">${Math.round(maxT).toLocaleString('tr')} ₺ (karekök ölçek)</text></svg>
<table><tr><th>Strateji</th><th>Aşamaya varış</th><th>İlk işletme</th><th>Toplam</th></tr>${satir}</table></html>`;
}
