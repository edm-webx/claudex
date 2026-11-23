// Tam oyun botu (2026-11-23, test dosyası değil): yeni oyunda yalnız NORMAL oyuncu akışıyla (admin / force / skip / para hilesi YOK)
// 1. aşamadan 10. aşamaya kadar oynar: büfede satış (bot-ai.mjs), sarı kareler (büfe, restoran masası / mutfak, dükkân satın alma /
// alet / tadilat, salon aletleri), işçi alımı (pano, dükkân ilanı), dükkân kasası (kapıya yürüyüp toplar), görevler (okul sınavı, halı saha
// maçı, mini oyun), günlük görev ödülü, sandık açma, gün sonu kartı. Yürüme: hedefe ışınlanır ama yürüme süresi kadar bekler (4.6 m/s).
// Her saniye değişmezler denetlenir; ilerleme durursa (sarı kare / aşama / dükkân yok) "tıkanma" teşhisiyle durur; her aşama atlayışında
// oyun gerçek kayıt deposundan (createGameSave) kaydedilip YENİ bir sim'e yüklenir ve koşu o sim'de devam eder (kayıt/yükleme sonrası durum).
import { mkdirSync, writeFileSync } from 'node:fs';
import { createSim } from '../../src/game/headless';
import { emptyContent } from '../../src/content/index';
// @ts-expect-error plain ESM JS shared with the browser bot
import { makeBot } from '../../src/game/ui/bot-ai.mjs';
import { adapter } from './ekonomi-harness';
import { fakePlatform } from './m1-helpers';
import { createGameSave } from '../../src/game/sim/save';
import { PAD_KEYS } from '../../src/content/pads';
import { ARSALAR } from '../../src/content/esya';
import { icOfArsa, IC_BY_ID, icWorld } from '../../src/content/ic-mekan';
import { ACILIS, acilisEksik, acilisGorunur, durumOf, siradaki } from '../../src/content/acilis';
import { KIOSK_STAGES } from '../../src/content/stages';
import { DECOR, siklik } from '../../src/content/economy';

/** oyuncunun kuracağı en şık dekor: yuva boyutlarına sığan, tek renk ailesinden en çok puanlı eşyalar (aile seçimi şıklığa göre) */
export function dekorHedef(yuvalar: string[], asama: number): string[] {
  const N: Record<string, number> = { s: 1, m: 2, l: 3 }; let best: string[] = [], bv = -1;
  for (const f of [...new Set(DECOR.map(d => d.color))]) {
    const bos = yuvalar.map(z => N[z] || 2).sort((a, b) => a - b), pick: string[] = [];
    for (const d of DECOR.filter(x => x.color === f).sort((a, b) => b.points - a.points)) { const i = bos.findIndex(z => z >= N[d.size]); if (i >= 0) { bos.splice(i, 1); pick.push(d.id); } }
    const v = siklik(pick, asama); if (v > bv) { bv = v; best = pick; }
  }
  return best;
}

const log = { info() {}, warn() {}, error() {} };
const HIZ = 4.6;                       // m/s: oyuncunun yürüme hızı
const DT = 0.1;

export interface Bulgu { tur: string; t: number; asama: number; ayrinti: string }
export interface TamSonuc {
  asamaDk: Record<number, number>; dukkanDk: Record<string, number>; son: { asama: number; dk: number; para: number; dukkan: number; seviye: number; yildiz: number };
  bulgular: Bulgu[]; tikanma: string | null; kayitTuru: number; kareSayisi: number; gorevler: Record<string, number>;
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const plots = (S: any): Record<string, any> => (S.zones.arsa?.plots) || {};

export function tamOyun(o: { tohum?: number; maxDk: number; hedefAsama?: number; tikanmaDk?: number; kayit?: boolean; kayitKlasor?: string; baslangic?: unknown; izle?: (s: string) => void }): Promise<TamSonuc> {
  return kos(o);
}

async function kos(o: { tohum?: number; maxDk: number; hedefAsama?: number; tikanmaDk?: number; kayit?: boolean; kayitKlasor?: string; baslangic?: unknown; izle?: (s: string) => void }): Promise<TamSonuc> {
  const tohum = o.tohum ?? 11, hedef = o.hedefAsama ?? 10, tikanmaS = (o.tikanmaDk ?? 120) * 60;
  // baslangic: botun önceki koşusunda gerçek akışla gelinmiş bir aşama kaydı (koşuyu oradan sürdürmek için)
  let sim: any = createSim({ seed: tohum, content: emptyContent(), save: o.baslangic as never }, { log });
  sim.command({ kind: 'play', hero: 'sabri' });
  let S = sim.rules.state, rt = sim.rules.rt, bot = makeBot(filtreli(sim));
  const bulgular: Bulgu[] = [], sayim: Record<string, number> = {};
  const bul = (tur: string, ayrinti: string) => { sayim[tur] = (sayim[tur] || 0) + 1; if (sayim[tur] <= 6) { bulgular.push({ tur, t: r1(S.playT / 60), asama: S.stage, ayrinti }); o.izle?.('BULGU ' + tur + ': ' + ayrinti); } };
  const asamaDk: Record<number, number> = { 1: 0 }, dukkanDk: Record<string, number> = {}, gorevler: Record<string, number> = {};
  let sonIlerleme = S.playT, kareSayisi = 0, kayitTuru = 0, tikanma: string | null = null;
  const ilerle = () => { sonIlerleme = S.playT; };
  const bagla = () => {
    sim.bus.onAny((r: any) => {
      const n = r.name;
      if (n === 'unlock' || n === 'tadilatDone' || n === 'masaAl' || n === 'dukkanGorev' || n === 'tadilatStart') ilerle();
    });
  };
  bagla();
  let sonKareler = new Set<string>();

  // ── gezi: hedefe yürü (yürüme süresi beklenir), işini yap, büfeye dön ──
  type Gezi = { ad: string; x: number; z: number; kat?: number; yap: () => boolean; sure: number; t: number; bekle: number; donus?: boolean; vardi?: boolean };
  let gezi: Gezi | null = null;
  const buf = () => { const a = sim.rules.v2State().anchors; return a.counter as { x: number; z: number }; };
  const yuru = (x: number, z: number, kat = 0) => { const p = sim.rules.playerPos; const d = Math.hypot(p.x - x, p.z - z) + ((p.kat || 0) !== kat ? 25 : 0); return d / HIZ; };
  const basla = (g: Omit<Gezi, 't' | 'bekle'>) => { gezi = { ...g, t: 0, bekle: yuru(g.x, g.z, g.kat || 0) }; };

  const para = () => S.money as number;
  const sonrakiTadilat = () => { const n = KIOSK_STAGES[S.stage]; return n && n.cost ? n.cost : 0; };
  // büfe tadilatı yıldızla açıksa ona para biriktir (oyuncu gibi): dükkân aletleri / dükkânlar beklesin, restoran masası / mutfağı beklemesin
  const tampon = () => (S.stars >= ((KIOSK_STAGES[S.stage]?.req?.stars) || 0) && sonrakiTadilat() > 0 ? sonrakiTadilat() : 0);

  function yanIs(): void {
    const sahip = plots(S);
    // 1) sandık aç, günlük görev ödülü al (envanter / görev tahtası düğmeleri)
    const env = S.zones.envanter as any;
    if (env?.sandik) for (const id of Object.keys(env.sandik)) if (env.sandik[id] > 0) { sim.command({ kind: 'mulk', op: 'sandikAc', id }); gorevler.sandik = (gorevler.sandik || 0) + 1; }
    if (env?.gunluk?.liste) for (const h of env.gunluk.liste) if (!h.alindi && h.sayi >= h.hedef) sim.command({ kind: 'mulk', op: 'gunlukAl', id: h.id });
    // 2) halı saha maç teklifi geldiyse oyna (görüntü maçı oynatır, sonucu yollar)
    if (rt.uiLast.haliSahaTeklif && !rt.paused) { sim.command({ kind: 'halisaha', op: 'kabul' }); if (rt.uiLast.haliSahaMac) { sim.command({ kind: 'halisaha', op: 'sonuc', biz: 3, onlar: 1 }); gorevler.mac = (gorevler.mac || 0) + 1; } }
    if (gezi) return;
    // 3) sarı kareler (büfe dışı): kilitsiz, parası yeten, en ucuz; büfenin kendi kareleri bot-ai'de
    // büfe tadilat karesi de burada: restoran aşamalarında bot-ai'nin eli hep dolu, karenin yanına hiç uğramıyor (insan gider)
    const kareler = (rt.pads as any[]).filter(p => !PAD_KEYS.includes(p.key) || (p.key === 'tadilat' && S.stars >= 1));
    const mut = (k: string) => k.startsWith('masa.') || k.startsWith('mutfak.');
    let aday: any = null;
    for (const p of kareler) {
      const it = sim.interactions.get('pad.' + p.key); if (!it) continue;
      const kilit = /🔒/.test(p.sub || '');
      if (kilit) continue;
      const kalan = p.price - (S.padPaid[p.key] || 0), tam = mut(p.key) || p.key === 'tadilat' || p.price <= tampon() * 0.6 ? 0 : tampon();
      if (para() < kalan + tam) continue;
      if (!aday || kalan < aday.kalan) aday = { p, kalan };
    }
    if (aday) {
      const p = aday.p, key = p.key;
      basla({ ad: 'kare ' + key, x: p.pos.x, z: p.pos.z, kat: p.kat || 0, sure: 30, yap: () => !(rt.pads as any[]).some(q => q.key === key) });
      return;
    }
    // 4) dükkân işçisi: kadrosu eksik dükkâna ilandan işçi (panel düğmesi), en az 2 kat para varsa
    for (const a of ARSALAR) {
      const p = sahip[a.id]; if (!a.sabit || !p || p.tur !== 'dukkan') continue;
      const kad = (p.kadro || []).length, mx = isciMax(sim, a.id);
      if (kad < mx && para() > 2 * ilanFiyat(sim, a.id) + tampon() * 0.02) { sim.command({ kind: 'mulk', op: 'isciAl', id: a.id }); if ((plots(S)[a.id].kadro || []).length > kad) { gorevler.dukkanIsci = (gorevler.dukkanIsci || 0) + 1; return; } }
    }
    // 4b) büfe kadrosu: panoda açık rol varsa iş köşesine yürü, eksik rolü al (oyuncu gibi; mutfak, kurye, kasiyer... aşama açtıkça)
    if (S.owned.isbul && S.playT - sonPano > 60 && para() > 20000 && !rt.paused) {
      sonPano = S.playT; const j = sim.rules.v2State().anchors.job;
      basla({ ad: 'pano', x: j.x, z: j.z, sure: 6, yap: () => {
        sim.command({ kind: 'openJobBoard' });
        const kart = ((S.jobCards || []) as any[]).map(c => ({ c, n: (S.workers as any[]).filter(w => w.role === c.role).length }))
          .filter(x => x.c.price * 3 < para()).sort((a, b) => a.n - b.n)[0];
        if (kart) { const n0 = S.workers.length; sim.command({ kind: 'hireCandidate', id: kart.c.id }); if (S.workers.length > n0) gorevler.bufeIsci = (gorevler.bufeIsci || 0) + 1; }
        else if (S.playT >= (S.jobRefreshAt || 0)) sim.command({ kind: 'refreshBoard' });
        sim.command({ kind: 'closeJobBoard' }); return true;
      } });
      return;
    }
    // 5) dükkân kasası: kasada birikmiş para > 5000 ise kapıya yürü, topla
    for (const a of ARSALAR) {
      const p = sahip[a.id]; if (!p || p.tur !== 'dukkan' || (p.till || 0) < 5000) continue;
      const m = icOfArsa(a.id); if (!m) continue;
      const c = icWorld(m, 0, 0);
      basla({ ad: 'kasa ' + a.id, x: c.x, z: c.z, kat: m.kat || 0, sure: 3, yap: () => (plots(S)[a.id]?.till || 0) < 1 });
      return;
    }
    // 6) karnede şıklık 4'ün altındaysa dekor: tek renk ailesinden en çok puanlıları al, yerleşimi ona çevir (dekor paneli)
    if ((S.grades.siklik || 1) < 4 && S.stage >= 2 && dekor()) return;
    // 7) sıradaki dükkânın görevleri: eksik ne ise onu yap
    const d = durumOf(S), sira = siradaki(d);
    if (sira) {
      const eksik = acilisEksik(sira, d).join(' | ');
      const gv = ACILIS[sira.id]?.gorev || [];
      for (const g of gv) {
        if ((S.stats[g.stat] || 0) >= g.n) continue;
        if (g.stat === 'sinav') { okul(); return; }
        if (g.stat === 'miniPlay') { mini(); return; }
      }
      void eksik;
    }
  }
  function dekor(): boolean {
    const yuva: string[] = rt.layout.slots.map((x: any) => x.size), N: Record<string, number> = { s: 1, m: 2, l: 3 };
    const hedef = dekorHedef(yuva, S.stage), yerde = S.decorSlots as { slot: string; item: string }[];
    for (const id of hedef) {
      if (yerde.some(d => d.item === id)) continue;
      const d = DECOR.find(x => x.id === id)!, n = N[d.size];
      const bosVar = yuva.some((z, i) => N[z] >= n && !yerde.some(y => y.slot === String(i)));
      if (!bosVar) {   // sığacağı yuva dolu: hedefte olmayan bir dekoru kaldır (panelde "kaldır")
        const f = yerde.find(y => !hedef.includes(y.item) && N[yuva[+y.slot]] >= n); if (!f) continue;
        sim.command({ kind: 'decorRemove', slot: Number(f.slot) }); return true;
      }
      if ((S.decorOwned as string[]).includes(id)) { sim.command({ kind: 'decorPlace', id }); return true; }
      if (para() < d.price * 2 + 2000) return false;
      sim.command({ kind: 'decorBuy', id }); gorevler.dekor = (gorevler.dekor || 0) + 1; return true;
    }
    return false;
  }
  function okul() {
    const m = IC_BY_ID.okul; if (!m) return;
    // sınıf okulun arka yarısı (z > m.z - 0.5): sıraların arasına git
    basla({ ad: 'okul', x: m.x, z: m.z + 1.2, sure: 120, yap: () => {
      const z = S.zones.okul as any;
      if (!z || z.soru < 0) { sim.command({ kind: 'mulk', op: 'dersBasla' }); return false; }
      const once = Number(S.stats.sinav) || 0, gunN = z.gunSinav === S.day ? z.gunN || 0 : 0;
      if (gunN >= 3) return true;   // bugünlük ödüllü sınav bitti
      sim.command({ kind: 'mulk', op: 'dersCevap', n: Math.max(0, z.secenek.indexOf(z.soru)) });
      if ((Number(S.stats.sinav) || 0) > once) gorevler.sinav = (gorevler.sinav || 0) + 1;
      return false;
    } });
  }
  function mini() {
    const m = S.zones.mini as any;
    sim.command({ kind: 'mini', op: 'play', id: 'durum' });
    sim.command({ kind: 'mini', op: 'result', id: 'durum', arg: 80 });
    gorevler.mini = (gorevler.mini || 0) + 1; void m;
  }

  // ── değişmezler (her saniye) ──
  let enYuksekAsama = 1, sonPano = -999;
  const tutarsiz: Record<string, number> = {};
  function denetle(): void {
    if (!Number.isFinite(S.money) || S.money < -0.01) bul('para-bozuk', 'para = ' + S.money);
    if (S.stage < enYuksekAsama) bul('asama-geri', S.stage + ' < ' + enYuksekAsama);
    enYuksekAsama = Math.max(enYuksekAsama, S.stage);
    const d = durumOf(S);
    const simdi = new Set<string>();
    for (const p of rt.pads as any[]) {
      simdi.add(p.key);
      if (!Number.isFinite(p.pos?.x) || !Number.isFinite(p.pos?.z)) bul('kare-konum', p.key + ' konumu NaN');
      if (!Number.isFinite(p.price) || p.price < 0) bul('kare-fiyat', p.key + ' fiyatı ' + p.price);
      const m = /^(isl|avm)\.(k\d+)$/.exec(p.key);
      if (m) {
        const a = ARSALAR.find(x => x.id === m[2])!;
        if (!acilisGorunur(a, d)) bul('sira-ihlal', p.key + ' görünmemeliydi (aşama ' + S.stage + ')');
        const ek = acilisEksik(a, d), kilitli = /🔒/.test(p.sub || '');
        const tk = (tutarsiz[p.key] = kilitli !== ek.length > 0 ? (tutarsiz[p.key] || 0) + 1 : 0);   // kare yazısı 0.25 sn'de bir tazelenir: 2 sn üst üste tutarsızsa hata
        if (tk === 3) bul('kilit-tutarsiz', p.key + ' kilit yazısı "' + p.sub + '" ama eksik: ' + (ek.join(', ') || 'yok'));
      }
      if (!sim.interactions.get('pad.' + p.key)) bul('kare-etkilesimsiz', p.key + ' görünüyor ama üstüne basınca bir şey olmaz');
    }
    for (const k of simdi) if (!sonKareler.has(k)) { kareSayisi++; }
    sonKareler = simdi;
    for (const a of ARSALAR) if (plots(S)[a.id] && !(a.id in dukkanDk)) { dukkanDk[a.id] = r1(S.playT / 60); ilerle(); const k = ACILIS[a.id]; if (k?.once && !plots(S)[k.once]) bul('sira-ihlal', a.id + ' alındı ama önce ' + k.once + ' alınmamıştı'); }
    if (rt.paused && !['gunSonu', 'kasa', 'halisaha', 'mini', ''].includes(rt.pauseWhy)) bul('duraklama', 'bilinmeyen duraklama: ' + rt.pauseWhy);
  }

  async function kaydetYukle(): Promise<void> {
    if (gezi) { gezi = null; const b = buf(); sim.command({ kind: 'teleport', x: b.x, z: b.z, kat: 0 }); }   // kayıt büfede alınır (ışınlanan bot bir odanın ortasında, eşyanın içinde kalmasın)
    sim.step(1);   // kareler 0.25-0.5 sn'de bir tazelenir: kaydetmeden önce otursun (yüklenen sim de 1 sn adım atıyor)
    const fp = fakePlatform();
    const ok = await createGameSave(sim, fp.platform, { log }).save('manual');
    if (!ok) { bul('kayit', 'kayıt yazılamadı'); return; }
    const back = await createGameSave(createSim({ seed: tohum, content: emptyContent() }, { log }), fp.platform, { log }).load();
    if (o.kayitKlasor) { mkdirSync(o.kayitKlasor, { recursive: true }); writeFileSync(o.kayitKlasor + '/asama-' + S.stage + '.json', JSON.stringify(back.data)); }
    const yeni: any = createSim({ seed: tohum, content: emptyContent(), save: back.data }, { log });
    yeni.command({ kind: 'play', hero: 'sabri' });
    yeni.step(1);
    const S2 = yeni.rules.state, rt2 = yeni.rules.rt;
    const k1 = (rt.pads as any[]).map(p => p.key).sort().join(','), k2 = (rt2.pads as any[]).map(p => p.key).sort().join(',');
    if (S2.stage !== S.stage) bul('kayit-asama', S.stage + ' -> ' + S2.stage);
    if (Math.abs(S2.money - S.money) > Math.max(50, S.money * 0.01)) bul('kayit-para', Math.round(S.money) + ' -> ' + Math.round(S2.money));
    if (Object.keys(plots(S2)).sort().join() !== Object.keys(plots(S)).sort().join()) bul('kayit-dukkan', 'dükkânlar değişti');
    if (S2.workers.length !== S.workers.length) bul('kayit-isci', S.workers.length + ' -> ' + S2.workers.length);
    if (JSON.stringify(S2.owned) !== JSON.stringify(S.owned)) bul('kayit-owned', 'açılan büfe kareleri değişti');
    if (k1 !== k2) bul('kayit-kareler', 'önce [' + k1 + '] sonra [' + k2 + ']');
    const tb = (r: any) => r.tables.filter((t: any) => t.built).length;
    if (tb(rt2) !== tb(rt)) bul('kayit-masa', 'kurulu masa ' + tb(rt) + ' -> ' + tb(rt2));
    kayitTuru++;
    sim = yeni; S = S2; rt = rt2; bot = makeBot(filtreli(sim)); gezi = null; bagla();
  }

  // ── ana döngü ──
  let sn = 0, asamaSon = S.stage, paraTepe = S.money;
  const maxS = o.maxDk * 60;
  while (S.playT < maxS) {
    // gün sonu kartı / kasa töreni: oyuncu "devam" der
    if (rt.paused) {
      if (rt.pauseWhy === 'gunSonu') sim.command({ kind: 'yeniGun' });
      if (rt.paused) sim.command({ kind: 'skipCeremony' });
      if (rt.paused && rt.pauseWhy === 'halisaha') { if (rt.uiLast.haliSahaMac) sim.command({ kind: 'halisaha', op: 'sonuc', biz: 3, onlar: 1 }); }
      if (rt.paused && rt.pauseWhy === 'mini') sim.command({ kind: 'mini', op: 'quit' });
      if (rt.paused) { bul('takili-duraklama', 'duraklama çözülemedi: ' + rt.pauseWhy); rt.paused = false; rt.pauseWhy = ''; }
    }
    const g = gezi as Gezi | null;
    if (g) {
      sim.input({ x: 0, z: 0 });
      // yürüme: önce varış noktasına ışınlan, yürüme süresi kadar orada bekle (yolda rastgele bir sarı karenin üstünde durup cebi boşaltmasın)
      if (!g.vardi) { g.vardi = true; sim.command({ kind: 'teleport', x: g.donus ? buf().x : g.x, z: g.donus ? buf().z : g.z, kat: g.donus ? 0 : g.kat || 0 }); }
      if (g.bekle > 0) g.bekle -= DT;
      else if (g.donus) gezi = null;
      else { g.t += DT; let bitti = false; try { bitti = g.yap(); } catch (e) { bul('gezi-hata', g.ad + ': ' + (e as Error).message); bitti = true; }
        /* para gün sonu giderine gittiyse (cep 0) kare yarım kalır: oyun kuralı, hata değil */ if (bitti || g.t > g.sure) { if (!bitti && S.money >= 1) bul('gezi-zaman-asimi', g.ad + ' ' + g.sure + ' sn içinde olmadı (para ' + Math.round(S.money) + ')'); const b = buf(); gezi = { ...g, donus: true, vardi: false, bekle: yuru(b.x, b.z, 0) }; } }
    } else bot.tick();
    sim.step(DT);
    if (Math.floor(S.playT) !== sn) {
      sn = Math.floor(S.playT);
      denetle();
      if (sn % 2 === 0) yanIs();
      if (S.stage !== asamaSon) {
        asamaSon = S.stage; asamaDk[S.stage] = r1(S.playT / 60);
        o.izle?.(`aşama ${S.stage} @ ${asamaDk[S.stage]} dk, para ${Math.round(S.money)}, dükkân ${Object.keys(plots(S)).length}`);
        if (o.kayit !== false) await kaydetYukle();
        if (S.stage >= hedef) break;
      }
      if (sn % 600 === 0) o.izle?.(`${r1(S.playT / 60)} dk aşama ${S.stage} sev ${S.level} ★${S.stars} para ${Math.round(S.money)} dükkân ${Object.keys(plots(S)).join(',')} kareler ${(rt.pads as any[]).map(p => p.key + (/🔒/.test(p.sub || '') ? '🔒' : '')).join(' ')}`);
      if (S.money > paraTepe * 1.15) { paraTepe = S.money; ilerle(); }   // hedefe para biriktirmek de ilerlemedir (gelir büyümüyorsa tıkanma)
      if (S.playT - sonIlerleme > tikanmaS) { tikanma = teshis(); o.izle?.('TIKANMA ' + tikanma); break; }
    }
  }
  function teshis(): string {
    const d = durumOf(S), sira = siradaki(d), n = KIOSK_STAGES[S.stage];
    const yil = `[★ rapor: kare ${Object.keys(S.owned).filter(k => S.owned[k]).length}, plaket ${S.plaque || 0}, gurme ${!!S.gurmePass}, notlar ${JSON.stringify(S.grades)}, kademe ${JSON.stringify(S.tiers)}] `;
    return yil + `${r1(S.playT / 60)} dk: aşama ${S.stage}, ★${S.stars}, sev ${S.level}, para ${Math.round(S.money)}; sonraki büfe aşaması ${n ? (n.cost + ' ₺, ' + (n.req?.stars || 0) + '★') : 'yok'}${S.tadilat ? ' (tadilat sürüyor)' : ''}; sıradaki dükkân ${sira ? sira.id + ' ' + sira.fiyat + ' ₺ eksik: ' + acilisEksik(sira, d).join(', ') : 'yok'}; kareler: ${(rt.pads as any[]).map(p => p.key + ' ' + Math.round(p.price) + (p.sub && /🔒/.test(p.sub) ? ' ' + p.sub : '')).join(' | ')}`;
  }
  return {
    asamaDk, dukkanDk, bulgular, tikanma, kayitTuru, kareSayisi, gorevler,
    son: { asama: S.stage, dk: r1(S.playT / 60), para: Math.round(S.money), dukkan: Object.keys(plots(S)).length, seviye: S.level, yildiz: S.stars },
  };
}

/** bot-ai.mjs yalnız büfenin kendi sarı karelerini görür (dükkân / restoran kareleri bu dosyanın gezi katmanında) */
function filtreli(sim: any) {
  const B = adapter(sim);
  return { ...B, decorBuy: () => {}, state: () => { const s = B.state() as any; s.pads = s.pads.filter((p: any) => PAD_KEYS.includes(p.key)); return s; } };
}
const arsaModel = (sim: any): any[] => sim.rules.rt.mulk?.model()?.arsa || [];
const mulkArsa = (sim: any, id: string): any => arsaModel(sim).find((x: any) => x.id === id);
function isciMax(sim: any, id: string): number { return mulkArsa(sim, id)?.isciMax ?? 0; }
function ilanFiyat(sim: any, id: string): number { return mulkArsa(sim, id)?.ilan?.[0]?.fiyat ?? 1e12; }
