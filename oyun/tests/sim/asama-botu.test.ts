// BUF-28: 10 aşamalı sim botu, uçtan uca "gerçekten bağlı" kanıtı. Başsız (headless), deterministik: sabit tohum, duvar saati yok.
// Gerçek oyun kuralları üstünde bir bot: aşama 1 -> 10 gerçek tadilat komutlarıyla (startTadilat + skipTadilat), her aşamada iş ilanı
// panosundan (openJobBoard / refreshBoard / hireCandidate) açılan bütün kadrolar işe alınır (14 rol), her aşama 3 oyun günü (toplam 30 gün).
// Her çalışan için yürüdüğü mesafe ve tamamladığı iş sayılır (prop olmadığının kanıtı); ölü kilit denetçisi 30 sn işlenmeyen işi, takılı
// tabağı ve hareketsiz çalışanı hata sayar. Sonuç calisma/asama-botu-rapor.json'a yazılır (aynı tohum -> aynı dosya).
// Doğrulama: kasıtlı kırılmış senaryoda (garson alınmaz / bulaşıkçı alınmaz) denetçinin hatayı yakaladığı ek testlerde gösterilir.
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { played } from './m1-helpers';
import { restoranApi } from '../../src/game/sim/restoran';
import { teslimatApi } from '../../src/game/sim/kurye';
import { MUTFAK_ROL, mutfakSlot, mutfakEsya, mutfakAcik, pisirIstasyonu, passKap } from '../../src/content/mutfak';
import { masaCati, kanatAcik } from '../../src/content/kanat';
import { acikYemekler, yeniYemekler, isProduct } from '../../src/content/yemek-menu';
import { GAME_DAY_S } from '../../src/engine/api';

const TOHUM = 20261121;
const GUN_ASAMA = 3;                 // 10 aşama x 3 oyun günü = 30 oyun günü
const DT = 0.25;                     // örnekleme adımı (sim sn)
const ESIK = 30;                     // sn: işlenmeyen iş / hareketsiz çalışan eşiği
const ASIRI_ESIK = 180;              // sn: herkes meşgul görünse bile bu kadar işlenmeyen iş açlıktır (starvation)
const TABAK_ESIK = 45;               // sn: bir çalışanın elinde aynı tabak (kanat içinde yürüyüş payı)
// günlük gelir aralıkları (₺ / oyun günü, aşama 1..10): bot koşusunun ölçümünden, kaotik sim için geniş pay (0.4x .. 2.5x); tohum sabit
const GELIR_ARALIK: [number, number][] = [[8e3, 6e4], [8e3, 6e4], [1.5e4, 1e5], [3e4, 2e5], [5e4, 3.5e5], [1.2e5, 8e5], [3e5, 2e6], [4.5e5, 3e6], [1.1e6, 7e6], [1.9e6, 1.2e7]];
const RAPOR = resolve(__dirname, '../../calisma/asama-botu-rapor.json');
// işe alma sırası: önce tezgâh ve salon, sonra mutfak ve ön yüz rolleri (14 rol + 3 tezgâh rolü)
const TEZGAH = ['doner', 'cay', 'tost'];
const ROLLER = [...TEZGAH, 'garson', 'temizlik', ...MUTFAK_ROL.map(r => r.id)];
const GEREKLI_14 = ['asci', 'komi', 'bulasikci', 'kasiyer', 'sef', 'garson', 'barista', 'guvenlik', 'muzisyen', 'hostes', 'mudur', 'vale', 'kurye', 'temizlik'];
const MASA_BEKLEYEN = new Set(['menu', 'siparis', 'hesap', 'kirli']);   // yalnız garson / temizlikçi gerektiren durumlar (mutfağa bağlı değil)
// iş sayacı: xp artışı gerçek iş bitince gelir; xp'siz ön yüz işleri (ronda, karşılama, anahtar...) sim istatistiğinden sayılır
const STAT_ROL: Record<string, string[]> = { guvenlik: ['guvenlikRonda'], hostes: ['hostesKarsilama', 'hostesMasaGosterdi'], vale: ['valeAnahtar', 'valePark'], mudur: ['mudurIs', 'mudurKasa', 'mudurVekil'] };

interface Ihlal { tur: string; t: number; asama: number; gun: number; ayrinti: string }
interface Opts { sabote?: string[]; asamalar?: number[]; gunler?: (asama: number) => number; uzakGun?: boolean }
type W = { id: number; role: string; xp?: number; name: string };
interface WS { id: number; ad: string; rol: string; ilkAsama: number; mesafe: number; is: number; xp: number; isinlanma: number; maxHareketsiz: number; durumlar: Set<string>; son: { x: number; z: number } | null; xp0: number; imza: string; imzaT: number; elde: string; eldeT: number; kapi: boolean; sayT?: number }
interface AS { asama: number; gun: number; gelir: number; sureSn: number; gelirGun: number; calisan: number; aktor: number; maxAktor: number; maxMusteri: number; menuAcik: number; ustaMax: number; catiKirliEnYas: number; siparisYemek: Set<string>; roller: Record<string, number>; bekle: Record<string, number[]> }

const r1 = (v: number) => Math.round(v * 10) / 10;
const r0 = Math.round;

function kos(o: Opts = {}) {
  const sim: any = played(TOHUM), S = sim.state, rt = sim.rules.rt, api = restoranApi(sim.rules)!;
  const atla = new Set(o.sabote || []);
  const asamalar = o.asamalar || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const gunler = o.gunler || (() => GUN_ASAMA);
  const reg = rt.agents.registry, wsys = rt.agents.workers;
  let t = 0, asama = 1;
  sim.step(2);
  sim.command({ kind: 'force', what: 'money', value: 5e7 });
  for (const k of ['doner', 'cay', 'ayran', 'simit', 'tabure1', 'tabure2', 'masa1', 'gazoz', 'masa2', 'tost']) sim.command({ kind: 'force', what: 'unlock', value: k });

  const ws = new Map<number, WS>();
  const ihlal: Ihlal[] = [], sayim: Record<string, number> = {}, yuk: Record<string, number> = {};
  const raporla = (tur: string, ayrinti: string) => { sayim[tur] = (sayim[tur] || 0) + 1; if (ihlal.filter(i => i.tur === tur).length < 12) ihlal.push({ tur, t: r1(t), asama, gun: S.day, ayrinti }); };
  // ── iş yaşı izleyicisi ──
  // Bir iş ESIK sn işlenmezse: (a) o işi yapabilecek kimse kadroda değilse, ya da (b) yapabilecek biri toplam 10 sn boşta durduysa hata.
  // Herkes meşgulken 30 sn+ bekleyen iş "aşırı yük" sayılır (rapora yazılır, hata değil); ama ASIRI_ESIK sn'yi geçerse açlık (starvation) hatasıdır.
  const isler = new Map<string, { yas: number; bos: number; rapor: boolean; yuk: boolean; asiri?: boolean }>();
  const gorulen = new Set<string>(), catiYas = new Map<number, number>();
  const enYas: Record<string, number> = {};
  const izle = (key: string, tur: string, kadroda: boolean, bosta: boolean, ayrinti: () => string, yas?: number) => {
    gorulen.add(key);
    let i = isler.get(key); if (!i) isler.set(key, i = { yas: 0, bos: 0, rapor: false, yuk: false });
    i.yas = yas ?? i.yas + DT; if (bosta) i.bos += DT;
    enYas[tur] = Math.max(enYas[tur] || 0, i.yas);
    if (i.yas > ESIK && !i.rapor && (!kadroda || i.bos >= 10)) { i.rapor = true; raporla(tur, ayrinti() + (kadroda ? ' (boşta çalışan varken)' : ' (kadroda yapacak kimse yok)')); }
    else if (i.yas > ESIK && !i.yuk && !i.rapor) { i.yuk = true; yuk[tur] = (yuk[tur] || 0) + 1; }
    if (i.yas > ASIRI_ESIK && !i.asiri) { i.asiri = true; raporla(tur + '-acliktan', ayrinti() + ` ${r0(i.yas)} sn (herkes meşgul ama iş hiç sıraya girmedi)`); }
  };
  let passN = 0, yikandi0 = 0, asim0 = 0;
  const gate = new Map<number, number>();   // çalışan -> boştayken yapabileceği iş beklediği süre
  const ast: AS[] = [];
  let cur: AS = null as unknown as AS;
  const musik: { x: number; z: number }[] = [];
  sim.rules.bus.on('canliMuzik', (d: { x: number; z: number }) => { musik.push(d); });
  const stat0: Record<string, number> = {};
  const statD = (k: string) => { const v = S.stats[k] || 0, d = v - (stat0[k] || 0); stat0[k] = v; return d; };
  const yeniAS = (a: number): AS => ({ asama: a, gun: 0, gelir: 0, sureSn: 0, gelirGun: 0, calisan: 0, aktor: 0, maxAktor: 0, maxMusteri: 0, menuAcik: 0, ustaMax: 0, catiKirliEnYas: 0, siparisYemek: new Set(), roller: {}, bekle: {} });

  function hire(role: string): W | null {
    sim.command({ kind: 'openJobBoard' });
    for (let i = 0; i < 80; i++) {
      const c = (S.jobCards || []).find((x: any) => x.role === role);
      if (c) { const n = S.workers.length; S.money += c.price; sim.command({ kind: 'hireCandidate', id: c.id }); if (S.workers.length > n) { sim.command({ kind: 'closeJobBoard' }); return S.workers[S.workers.length - 1]; } }
      S.money += 1000; sim.command({ kind: 'refreshBoard' });
    }
    sim.command({ kind: 'closeJobBoard' });
    return null;
  }
  function kadro() { for (const r of ROLLER) { if (atla.has(r)) continue; for (let g = 0; g < 12; g++) if (!hire(r)) break; } }
  function yeniCalisanlar() {
    for (const w of S.workers as W[]) if (!ws.has(w.id)) ws.set(w.id, { id: w.id, ad: w.name, rol: w.role, ilkAsama: asama, mesafe: 0, is: 0, xp: 0, isinlanma: 0, maxHareketsiz: 0, durumlar: new Set(), son: null, xp0: w.xp || 0, imza: '', imzaT: t, elde: '', eldeT: t, kapi: false });
  }

  function ornek() {
    t += DT;
    const rows = new Map<number, { state: string }>(); for (const r of wsys.rows()) rows.set(r.id, r);
    const aktor = new Map<number, any>(); for (const a of reg.list) if (a.kind === 'worker') aktor.set(+a.key, a);
    const v = api.view(), hd = api.hat!.durum(), bol = api.bolgeler?.() || [];
    const rol = (r: string) => (S.workers as W[]).filter(w => w.role === r);
    const garsonlar = rol('garson'), temizlikler = rol('temizlik'), ascilar = rol('asci'), komiler = rol('komi'), bulasikcilar = rol('bulasikci'), kuryeler = rol('kurye');
    const durumu = (w: W) => rows.get(w.id)?.state || '?';
    const bostaMi = (ws_: W[], d: string) => ws_.filter(w => durumu(w) === d && aktor.get(w.id)?.act !== 'walk');   // boşta: iş aramıyor ve yürümüyor (iş aramaya yürüyen boşta sayılmaz)
    const bostaGarson = bostaMi(garsonlar, 'idle'), bostaTemiz = bostaMi(temizlikler, 'idle');
    const bolgeOf = (tbl: number) => bol.find((b: any) => b.masalar.includes(tbl));
    // garson `w` bu masaya bakabilir mi (kendi bölgesi, komşu bölge ya da sahipsiz bölge: restoran.ts bolgeKurali)
    const garsonYetkili = (w: W, tbl: number) => { const b = bolgeOf(tbl), own = api.bolgeOf?.(w.id); return !b || !own || b.id === own || b.garsonlar.length === 0 || b.komsu.includes(own); };
    const tes = teslimatApi(sim.rules);
    // ── 30 sn işlenmeyen iş: masalar ──
    const bekleyenMasa: { table: number; durum: string }[] = [];
    for (const k of [...catiYas.keys()]) if (!v.masalar.some((m: any) => m.table === k && m.durum === 'kirli')) catiYas.delete(k);
    for (const m of v.masalar) {
      if (!MASA_BEKLEYEN.has(m.durum)) continue;
      if (m.durum !== 'kirli' && rt.customers.some((c: any) => c.kind === 'masa' && c.seat?.table === m.table && c.state === 'toSeat')) continue;   // müşteri daha masaya yürüyor: henüz servis işi yok
      bekleyenMasa.push(m);
      const cati = !!masaCati(m.table);
      if (m.durum === 'kirli' && cati) { cur.catiKirliEnYas = Math.max(cur.catiKirliEnYas, (catiYas.get(m.table) || 0) + DT); catiYas.set(m.table, (catiYas.get(m.table) || 0) + DT); continue; }   // çatı masası: bilinen sorun, aşağıda ayrı raporlanır
      if (m.durum === 'kirli') izle('m' + m.table + 'k', 'masa-kirli', garsonlar.length > 0 || (temizlikler.length > 0 && !cati), ((cati || temizlikler.length === 0) && bostaGarson.some(g => garsonYetkili(g, m.table))) || (!cati && bostaTemiz.length > 0), () => `masa ${m.table} kirli`);
      else izle('m' + m.table + m.durum[0], 'masa-' + m.durum, garsonlar.length > 0, bostaGarson.some(g => garsonYetkili(g, m.table)), () => `masa ${m.table} '${m.durum}'`);
    }
    // ── mutfak: pass rafı, istasyon tepsisi, bulaşık, paket ──
    // yalnız bir biletin hâlâ istediği tabak sayılır: kimsenin istemediği (müşterisi gitmiş) tabak mutfak-hat'ta 30 sn sonra kendiliğinden silinir
    const istek = new Map<string, number>(); for (const k of v.tickets as any[]) for (const it of k.items) istek.set(it.p, (istek.get(it.p) || 0) + (it.left || 0));
    const pn = hd.pass.filter((f: string) => { const n = istek.get(f) || 0; if (n > 0) istek.set(f, n - 1); return n > 0; }).length;
    if (pn < passN || pn === 0) isler.delete('pass'); passN = pn;
    if (pn > 0) izle('pass', 'pass-bekleyen', garsonlar.length > 0, bostaGarson.length > 0, () => `pass rafında ${pn} tabak alınmadı`);
    const sahipsiz = hd.tepsi.filter((p: any) => !p.wid);
    if (sahipsiz.length) izle('tepsi', 'tepsi-sahipsiz', komiler.length + ascilar.length > 0, [...bostaMi(komiler, 'kIdle'), ...bostaMi(ascilar, 'kIdle')].length > 0, () => 'istasyon tepsisinde alınmayan tabak', sahipsiz.reduce((m: number, p: any) => Math.max(m, p.t), 0));
    const yik = S.stats.tabakYikandi || 0;
    if (yik !== yikandi0) isler.delete('bulasik'); yikandi0 = yik;
    if (rt.dirtyDishes > 0) izle('bulasik', 'bulasik-yigini', bulasikcilar.length > 0, bostaMi(bulasikcilar, 'kIdle').length > 0, () => `${rt.dirtyDishes} kirli tabak yıkanmadı`);
    if (tes && tes.hazirVar()) izle('paket', 'paket-bekleyen', kuryeler.length > 0, bostaMi(kuryeler, 'idle').length > 0, () => 'hazır paket kuryeye gitmedi');
    for (const k of [...isler.keys()]) if (!gorulen.has(k)) { const i = isler.get(k)!; if (k[0] === 'm') { const tur = 'masa-' + ({ m: 'menu', s: 'siparis', h: 'hesap', k: 'kirli' } as Record<string, string>)[k[k.length - 1]]; (cur.bekle[tur] ||= []).push(i.yas); } isler.delete(k); }
    gorulen.clear();
    // ── takılı tabak: taşıyıcının elinde uzun süre ──
    const eldeMax = hd.elde.reduce((m: number, e: any) => Math.max(m, e.t), 0);
    enYas['elde-mutfak'] = Math.max(enYas['elde-mutfak'] || 0, eldeMax);
    if (eldeMax > TABAK_ESIK && eldeMax - DT <= TABAK_ESIK) raporla('takili-tabak', `mutfakta taşıyıcının elinde ${r0(eldeMax)} sn tabak`);
    if (hd.asim > asim0) { raporla('hat-emniyet-asimi', `mutfak hattı emniyet zaman aşımı +${hd.asim - asim0}`); asim0 = hd.asim; }
    // menü genişleme kontrolü için verilen siparişler
    for (const tk of v.tickets) for (const it of tk.items) cur.siparisYemek.add(it.p);

    // ── hareketsiz çalışan: boş durumda, yapabileceği iş 30 sn beklediği halde yerinde ──
    const serbest = mutfakEsya(S.stage || 1).filter(i => pisirIstasyonu(i) && !v.ist[i]);
    const claimable = hd.cooking.length + hd.tepsi.length + hd.elde.length + hd.pass.length < passKap(S.stage || 1) && serbest.some(i => api.hat!.aday(i));
    const isVar = (w: W): boolean => {
      switch (w.role) {
        case 'garson': return bekleyenMasa.some(m => (m.durum !== 'kirli' || !temizlikler.length || !!masaCati(m.table)) && garsonYetkili(w, m.table));
        case 'temizlik': return bekleyenMasa.some(m => m.durum === 'kirli' && !masaCati(m.table));
        case 'asci': return claimable;
        case 'komi': return sahipsiz.length > 0 && hd.pass.length < passKap(S.stage || 1);
        case 'bulasikci': return rt.dirtyDishes > 0;
        case 'kurye': return !!tes && tes.hazirVar();
        default: return false;
      }
    };
    const BOS: Record<string, string> = { garson: 'idle', temizlik: 'idle', asci: 'kIdle', komi: 'kIdle', bulasikci: 'kIdle', kurye: 'idle' };
    for (const w of S.workers as W[]) {
      const s = ws.get(w.id), a = aktor.get(w.id); if (!s || !a) continue;
      if (s.son) { const d = Math.hypot(a.x - s.son.x, a.z - s.son.z); if (d > 1.5) s.isinlanma++; else s.mesafe += d; }
      s.son = { x: a.x, z: a.z };
      const durum = durumu(w); s.durumlar.add(durum);
      const xp = (w.xp || 0) - s.xp0; if (xp > s.xp) { s.is++; s.xp = xp; }
      // hareketsizlik bilgisi: konum, hareket, durum, el ve xp aynı kaldığı en uzun süre (rapora yazılır)
      const imza = [r0(a.x * 10), r0(a.z * 10), a.act, durum, a.carry.map((c: any) => c.type).join(','), xp].join('|');
      if (imza !== s.imza) { s.imza = imza; s.imzaT = t; }
      s.maxHareketsiz = Math.max(s.maxHareketsiz, t - s.imzaT);
      const g = BOS[w.role] === durum && a.act !== 'walk' && isVar(w) ? (gate.get(w.id) || 0) + DT : 0; gate.set(w.id, g);
      if (g > ESIK && !s.kapi) { s.kapi = true; raporla('hareketsiz-calisan', `${w.role} ${w.name}: boşta, yapabileceği iş ${r0(g)} sn bekliyor (${durum}/${a.act})`); }
      if (g === 0) s.kapi = false;
      // takılı tabak: aynı tabak seti uzun süre aynı çalışanın elinde
      const elde = a.carry.length ? a.carry.map((c: any) => c.type).sort().join(',') : '';
      if (elde !== s.elde) { s.elde = elde; s.eldeT = t; }
      if (elde && t - s.eldeT > TABAK_ESIK && t - s.eldeT - DT <= TABAK_ESIK) raporla('takili-tabak', `${w.role} ${w.name} elinde ${r0(t - s.eldeT)} sn aynı tabak (${elde}, ${durum})`);
    }
    // şefin işi pasoda "servis" diye seslenmek (xp'si yok): her yeni söz bir iş
    for (const w of S.workers as W[]) if (w.role === 'sef') { const s = ws.get(w.id), a = aktor.get(w.id); if (s && a) { if (a.say && a.sayT > (s.sayT || 0) + 1e-6) s.is++; s.sayT = a.say ? a.sayT : 0; } }
    // xp'siz ön yüz işleri: istatistik farkı, işin anında konuşan çalışana yazılır (say / sayT)
    for (const [rolu, keys] of Object.entries(STAT_ROL)) {
      let d = 0; for (const k of keys) d += statD(k);
      if (d <= 0) continue;
      const adaylar = (S.workers as W[]).filter(w => w.role === rolu).map(w => ({ w, a: aktor.get(w.id) })).filter(x => x.a);
      adaylar.sort((p, q) => (q.a.sayT || 0) - (p.a.sayT || 0));
      const s = adaylar[0] && ws.get(adaylar[0].w.id); if (s) s.is += d;
    }
    while (musik.length) {   // canlı müzik: en yakın müzisyene
      const m = musik.shift()!; let best: WS | null = null, bd = 1e9;
      for (const w of S.workers as W[]) if (w.role === 'muzisyen') { const a = aktor.get(w.id), s = ws.get(w.id); if (a && s) { const d = Math.hypot(a.x - m.x, a.z - m.z); if (d < bd) { bd = d; best = s; } } }
      if (best) best.is++;
    }
    cur.maxAktor = Math.max(cur.maxAktor, reg.list.length); cur.maxMusteri = Math.max(cur.maxMusteri, rt.customers.length);
  }

  function ilerle(sn: number) {
    for (let k = 0; k < sn / DT - 1e-9; k++) {
      sim.step(DT);
      if (rt.paused) { sim.command({ kind: 'yeniGun' }); sim.command({ kind: 'skipCeremony' }); if (rt.paused) { raporla('duraklama', 'tören sonrası duraklama: ' + rt.pauseWhy); rt.paused = false; rt.pauseWhy = ''; } }
      ornek();
    }
  }

  for (const a of asamalar) {
    cur = yeniAS(a); asama = a;
    if (a > 1) {
      // gerçek tadilat: ustalar iş sahasında yürür (BUF-21), sonra Altın Simit ile bitirilir
      S.money += 1e9; S.stars = 5; S.gold = 9999;
      sim.command({ kind: 'startTadilat' });
      for (let i = 0; i < 100; i++) { ilerle(DT); cur.ustaMax = Math.max(cur.ustaMax, rt.agents.ustalar.rows().length); }
      sim.command({ kind: 'skipTadilat' }); ilerle(1);
      if (S.stage !== a) throw new Error(`tadilat ${a - 1} -> ${a} tamamlanmadı (aşama ${S.stage})`);
    }
    ast.push(cur);
    kadro(); yeniCalisanlar();
    // 2026-11-22: mutfak istasyonları sarı kareyle alınır (sim/isletme-kareler.ts 'mutfak.<id>'): bot aşamanın açtığı her istasyonu alır
    for (const id of mutfakAcik(S.stage)) { S.money += 1e8; sim.command({ kind: 'mulk', op: 'mutfakAl', e: id } as never); }
    // ... ve kanat / salon / çatı masaları da sarı kareyle (sim/isletme-kareler.ts 'masa.<i>'): bot açılan her masayı alır
    for (const i of kanatAcik(S.stage)) { S.money += 1e9; sim.command({ kind: 'mulk', op: 'masaAl', e: i } as never); }
    const gelir0 = S.totalEarned, t0 = S.playT, d0 = S.day, hedef = d0 + gunler(a);
    for (let n = 0; S.day < hedef && n < 400 * gunler(a); n++) {
      ilerle(5); yeniCalisanlar();
      // oyuncu iskeleden uzaklaşır: müdür vekil olur (gün ortasında bir süre)
      if (o.uzakGun !== false && a >= 6 && S.day === d0 + 1) {
        const faz = S.dayT / GAME_DAY_S, x = Math.abs(sim.rules.playerPos.x);
        if (faz > 0.2 && faz < 0.3 && x < 60) sim.command({ kind: 'teleport', x: 90, z: -2.5 });
        else if (faz >= 0.3 && x > 60) sim.command({ kind: 'teleport', x: 4.5, z: -2.5 });
      }
    }
    if (Math.abs(sim.rules.playerPos.x) > 60) sim.command({ kind: 'teleport', x: 4.5, z: -2.5 });
    cur.gun = S.day - d0; cur.sureSn = r0(S.playT - t0); cur.gelir = r0(S.totalEarned - gelir0);
    cur.gelirGun = cur.sureSn > 0 ? r0(cur.gelir / (cur.sureSn / GAME_DAY_S)) : 0;
    cur.calisan = S.workers.length; cur.aktor = reg.list.length; cur.menuAcik = api.openDishes().length;
    for (const w of S.workers as W[]) cur.roller[w.role] = (cur.roller[w.role] || 0) + 1;
  }

  const calisanlar = [...ws.values()].map(s => ({ id: s.id, ad: s.ad, rol: s.rol, ilkAsama: s.ilkAsama, mesafeM: r0(s.mesafe), is: s.is, xp: s.xp, isinlanma: s.isinlanma, maxHareketsizSn: r0(s.maxHareketsiz), durumSayisi: s.durumlar.size, durumlar: [...s.durumlar].sort() }));
  const rolOzet: Record<string, { kisi: number; mesafeM: number; is: number; enAzMesafeM: number; enAzIs: number }> = {};
  for (const c of calisanlar) { const r = (rolOzet[c.rol] ||= { kisi: 0, mesafeM: 0, is: 0, enAzMesafeM: 1e9, enAzIs: 1e9 }); r.kisi++; r.mesafeM += c.mesafeM; r.is += c.is; r.enAzMesafeM = Math.min(r.enAzMesafeM, c.mesafeM); r.enAzIs = Math.min(r.enAzIs, c.is); }
  return { S, api, ast, calisanlar, rolOzet, ihlal, sayim, yuk, enYas, t };
}

/** aşama başına masa bekleme dağılımı (sn): adet, ortalama, p95, en uzun, 30 sn üstü oranı (2026-11-23 restoran 7-10 yoğunluk ölçümü) */
export function beklemeOzet(b: Record<string, number[]>) {
  return Object.fromEntries(Object.entries(b).sort().map(([tur, v]) => { const s = [...v].sort((x, y) => x - y), n = s.length; return [tur, { n, ort: r1(s.reduce((a, c) => a + c, 0) / n), p95: r1(s[Math.min(n - 1, Math.floor(n * 0.95))]), max: r1(s[n - 1]), ust30: r1(100 * s.filter(x => x > 30).length / n) }]; }));
}
const rapor = (k: ReturnType<typeof kos>) => ({
  surum: 1, aciklama: 'BUF-28 aşama botu: aşama 1-10, 14 rol, her aşama 3 oyun günü; deterministik (tohum sabit, duvar saati yok)', tohum: TOHUM, gunAsama: GUN_ASAMA, sonAsama: k.S.stage, toplamGun: k.S.day - 1, simSn: r0(k.t),
  esikSn: ESIK, ihlalSayisi: Object.values(k.sayim).reduce((a, b) => a + b, 0), ihlalTur: k.sayim, ihlaller: k.ihlal, asiriYukOlayi: k.yuk,
  enUzunBeklemeSn: Object.fromEntries(Object.entries(k.enYas).map(([a, b]) => [a, r0(b)])),
  bilinenSinir: { catiMasaKirliEnUzunSn: r0(Math.max(...k.ast.map(a => a.catiKirliEnYas))), not: 'çatı masasını garson ve temizlikçi siler (temizlikçi de merdivenden çıkar, 2026-11-21; önce yalnız garson: 1000-2400 sn kirli kalıyordu)' },
  istatistik: Object.fromEntries(['isinlanma', 'garsonZamanAsimi', 'tabakDustu', 'paketTeslim', 'paketSiparis', 'tabakYikandi', 'guvenlikRonda', 'hostesKarsilama', 'hostesMasaGosterdi', 'valeAnahtar', 'valePark', 'mudurVekil', 'mudurIs', 'mudurKasa'].map(a => [a, k.S.stats[a] || 0])),
  asamalar: k.ast.map(a => ({ ...a, bekle: beklemeOzet(a.bekle), siparisYemek: [...a.siparisYemek].sort(), siparisYemekSayisi: a.siparisYemek.size })),
  roller: k.rolOzet, calisanlar: k.calisanlar,
});

describe('BUF-28 aşama botu: 1 -> 10, 14 rol, 30 oyun günü', () => {
  it('her çalışan gerçekten iş yapar (mesafe + iş), hiçbir iş takılmaz, gelir ve menü aşamayla büyür', () => {
    const k = kos();
    const R = rapor(k);
    mkdirSync(dirname(RAPOR), { recursive: true });
    writeFileSync(RAPOR, JSON.stringify(R, null, 1) + '\n');
    const { S, ast, calisanlar, rolOzet } = k;

    // koşu bütünlüğü
    expect(S.stage).toBe(10); expect(R.toplamGun).toBeGreaterThanOrEqual(30); expect(ast.length).toBe(10);
    for (const a of ast) expect(a.gun, 'aşama ' + a.asama).toBeGreaterThanOrEqual(GUN_ASAMA);
    for (const a of ast.slice(1)) expect(a.ustaMax, 'tadilat ustaları aşama ' + a.asama).toBeGreaterThan(0);
    // 14 rolün hepsi işe alındı; kadro mutfak.ts slot tablosuyla birebir
    for (const r of GEREKLI_14) expect(rolOzet[r]?.kisi ?? 0, 'rol ' + r).toBeGreaterThanOrEqual(1);
    for (const r of MUTFAK_ROL) expect(S.workers.filter((w: W) => w.role === r.id).length, r.id + ' kadrosu aşama 10').toBe(mutfakSlot(r.id, 10));

    // prop değil: her çalışan yürüdü ve iş bitirdi (tezgâh rolleri yerinde durur: yalnız iş şartı)
    const prop: string[] = [];
    for (const c of calisanlar) {
      if (!(c.is > 0)) prop.push(`${c.rol} ${c.ad} (#${c.id}, aşama ${c.ilkAsama}) hiç iş bitirmedi`);
      if (!TEZGAH.includes(c.rol) && !(c.mesafeM > 5)) prop.push(`${c.rol} ${c.ad} (#${c.id}, aşama ${c.ilkAsama}) yürümedi: ${c.mesafeM} m`);
      if (c.isinlanma) prop.push(`${c.rol} ${c.ad} ışınlandı`);
    }
    expect(prop).toEqual([]);
    // ölü kilit denetçisi: sıfır ihlal
    expect(R.ihlalSayisi, JSON.stringify(R.ihlaller.slice(0, 5))).toBe(0);
    expect(S.stats.isinlanma || 0).toBe(0); expect(S.stats.garsonZamanAsimi || 0).toBe(0);

    // gelir: her aşamada ölçülmüş aralıkta ve aşamayla büyür
    for (const a of ast) { const [lo, hi] = GELIR_ARALIK[a.asama - 1]; expect(a.gelirGun, `aşama ${a.asama} günlük gelir ${lo}..${hi}`).toBeGreaterThanOrEqual(lo); expect(a.gelirGun, `aşama ${a.asama} günlük gelir ${lo}..${hi}`).toBeLessThanOrEqual(hi); }
    for (let i = 2; i < ast.length; i++) expect(ast[i].gelirGun, `aşama ${ast[i].asama} geliri aşama ${ast[i - 2].asama}'i geçmeli`).toBeGreaterThan(ast[i - 2].gelirGun);
    expect(ast[9].gelirGun).toBeGreaterThan(ast[2].gelirGun * 20);
    // menü genişlemesi: açık yemek sayısı aşamayla artar; verilen siparişler yalnız açık menüden gelir; yeni açılan yemeklerden en az biri gerçekten sipariş edilir
    expect(ast[0].menuAcik).toBe(0); expect(ast[1].menuAcik).toBe(0);
    for (let i = 2; i < ast.length; i++) {
      const a = ast[i], acik = new Set(acikYemekler(a.asama).map(d => d.id));
      expect(a.menuAcik, 'menü aşama ' + a.asama).toBe(acik.size);
      if (i > 2) expect(a.menuAcik, 'menü aşama ' + a.asama).toBeGreaterThan(ast[i - 1].menuAcik);
      for (const f of a.siparisYemek) expect(isProduct(f as never) || acik.has(f as never), `aşama ${a.asama}: kapalı menüden sipariş ${f}`).toBe(true);
      const yeni = yeniYemekler(a.asama).map(d => d.id), tum = new Set(ast.slice(i).flatMap(x => [...x.siparisYemek]));
      expect(yeni.some(f => a.siparisYemek.has(f)) || yeni.some(f => tum.has(f)), `aşama ${a.asama} yeni yemekleri hiç sipariş edilmedi: ${yeni}`).toBe(true);
    }
    expect(ast[9].menuAcik).toBeGreaterThanOrEqual(20);
    expect(ast[9].siparisYemek.size).toBeGreaterThan(ast[3].siparisYemek.size);
    // 2026-11-23 restoran 7-10 yoğunluk kilidi (önce: menü ort ~21 sn / en uzun 66 sn, sipariş en uzun 61 sn, hesabın %30'u 40 sn sınırında)
    for (const a of ast.filter(x => x.asama >= 7)) {
      const b = beklemeOzet(a.bekle), m = `aşama ${a.asama} ` + JSON.stringify(b);
      expect(b['masa-menu'].ort, m).toBeLessThan(18); expect(b['masa-menu'].max, m).toBeLessThan(a.asama >= 9 ? 55 : 50);   // 2026-11-26: 9-10'da Şef salonu (ikinci kat, ön merdiven) ve deniz köşkü uzak; arka merdiven gelince 50'ye dön
      expect(b['masa-siparis'].max, m).toBeLessThan(30);   // 2026-11-25: deniz köşkü ve ikinci kat uzak, 25 -> 30
      expect(b['masa-hesap'].ort, m).toBeLessThan(20); expect(b['masa-hesap'].ust30, m).toBeLessThan(15);
    }
    // çatı masası: garson ve (2026-11-21) temizlikçi siler; eskiden yoğunlukta 1000-2400 sn kirli kalıyordu
    expect(S.stats.garsonSildi || 0).toBeGreaterThan(0);
    expect(Math.max(...ast.map(a => a.catiKirliEnYas)), 'çatı masası kirli kalma süresi (temizlikçi de çıkar)').toBeLessThan(300);
  }, 180_000);

  it('denetçi kırık senaryoyu yakalar: garson alınmazsa masa işleri 30 sn işlenmeyen iş olarak raporlanır', () => {
    const k = kos({ sabote: ['garson'], asamalar: [1, 2, 3, 4], gunler: a => (a === 4 ? 1 : 0), uzakGun: false });
    expect(Object.keys(k.sayim).filter(a => a.startsWith('masa-') || a === 'pass-bekleyen').length, JSON.stringify(k.sayim)).toBeGreaterThan(0);
    expect(k.rolOzet.garson).toBeUndefined();
  }, 120_000);

  it('denetçi kırık senaryoyu yakalar: bulaşıkçı alınmazsa kirli tabak yığını raporlanır', () => {
    const k = kos({ sabote: ['bulasikci'], asamalar: [1, 2, 3, 4, 5], gunler: a => (a === 5 ? 1 : 0), uzakGun: false });
    expect(k.sayim['bulasik-yigini'] || 0, JSON.stringify(k.sayim)).toBeGreaterThan(0);
  }, 120_000);
});
