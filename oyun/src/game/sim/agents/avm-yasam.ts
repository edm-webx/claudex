/**
 * Martı AVM'nin yaşamı (2026-11-21: "dükkânlar, insanlar, sinema salonları"; 2026-11-22 22:55: konser sahnesi kalktı, yerine
 * bekleme salonu ve iki gişe, sinema büfesi açık stand: "etraf mısır kokacak ki milletin canı çeksin"). Oyuncu AVM diyarındayken:
 *  - ziyaretçiler: girişten gelir, katlar arası yürüyen merdivenle dolaşır; vitrin bakar, bankta / bekleme salonunda oturur;
 *    seansa gidecekse önce gişeden bilet alır, sonra salonda koltuğuna oturup bölümü izler; sinema katında mısır kokusunu alan
 *    büfenin önüne gelip bakar ("Mmm, mısır kokusu!"); birkaç duraktan sonra çıkıp gider.
 *  - gişeciler: iki gişede birer gerçek çalışan; bilet kesince hareket eder.
 *  - oyuncu: gişede durunca bilet alır (BILET_FIYAT), salon kapısındaki görevli bileti kontrol eder.
 * Hepsi gerçek, yürüyen aktör (registry); dekor yok. Oyuncu AVM'den çıkınca kaldırılır, girince içerisi dolu başlar.
 * Takvim ve yerleşim: content/avm-eglence.ts. Deterministik (kendi rng akışı). Saf sim.
 */
import type { System, SimCtx, Vec2 } from '../../../engine/api';
import type { AgentEnv } from './env';
import type { Actor } from './types';
import { AVM, HOL, ODA_X, ODA_Z, AVM_GIRIS, LOBI_DEKOR, LOBI_Z1, YOL, katY, yolculuk, avmYol, avmGidis, avmGelis } from '../../../content/avm-kat';
import { EGLENCE_KAT, KORIDOR_X, SALONLAR, BANKLAR, GISELER, BILET_FIYAT, seans, type Salon } from '../../../content/avm-eglence';
import { diziOf, bolumOf } from '../../../content/sinema-dizi';
import { SINEMA_BUFE } from '../../../content/avm-kat';
import { realmAt } from '../../../content/realm';

type Pt = Vec2 & { y?: number };
type Dur = 'yol' | 'vitrin' | 'otur' | 'gise' | 'sinema' | 'film' | 'koku' | 'cik';
interface Z { a: Actor; kat: number; st: Dur; t: number; dur: number; path: Pt[]; face: number; durak: number; salon?: Salon; koltuk?: number; gi?: number; hedef?: Dur }
interface Giseci { a: Actor; i: number; is: number }

const LOOKS = ['universiteli', 'teyze', 'emekli', 'plaza', 'turgrubu', 'gezgin', 'balayi', 'taraftar'];
const SOZ_FILM = ['Çok iyiydi!', 'Sonu ne öyle ya!', 'Devamı çıkar mı?', 'Mısır bitti ama film bitmedi.'];
const SOZ_GISE = ['Bir bilet lütfen.', 'İki bilet, yan yana olsun.', 'Kaçıncı bölüm bugün?', 'Öğrenci indirimi var mı?'];
const SOZ_KOKU = ['Mmm, mısır kokusu!', 'Bu koku beni çağırıyor.', 'Filme mısırsız girilmez.', 'Karamelli mi o?'];
const SOZ_VITRIN = ['Şuna bak!', 'Bu fiyata mı?', 'Akşam gelip alırım.', 'Burası yeni açılmış.'];
export const ZIYARETCI_HEDEF = 16, SP = 1.15;

export interface AvmYasamSystem extends System {
  /** test / araç: aktif ziyaretçi ve gişeci satırları; oyuncunun bileti */
  rows(): { key: string; st: string; kat: number; x: number; z: number; y: number; act: string }[];
  giseci(): { key: string; x: number; z: number; y: number; act: string }[];
  bilet(): { salon: number; bolum: number } | null;
}

export function createAvmYasam(env: AgentEnv): AvmYasamSystem {
  const rng = env.rng('avm-yasam');
  const zs: Z[] = [], gis: Giseci[] = [];
  let n = 0, spawnT = 0, icerde = false, etkT = 0, bilet: { salon: number; bolum: number } | null = null;
  const kat3 = () => ((env.player() as { kat?: number }).kat || 0) === EGLENCE_KAT && realmAt(env.player().x)?.id === 'avm';
  /** büfe standının hol tarafı (koku: burada durup bakarlar) */
  const BUFE_ON = { x: SINEMA_BUFE.x - SINEMA_BUFE.D / 2 - 0.9, z: SINEMA_BUFE.z };
  const say = (a: Actor, t: string, s = 2.4) => { a.say = t; a.sayT = s; };
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rng.next() * xs.length)];
  // 2026-11-22: hol büyüdü, ortada merdiven adası var: gezenler yalnız iki yürüyüş yolunda durur (adanın / çeşmenin içinde değil)
  const holNokta = (): Vec2 => { const y = rng.next() < 0.5 ? YOL.W : YOL.E; return { x: y.x0 + rng.next() * (y.x1 - y.x0), z: LOBI_Z1 + 0.3 + rng.next() * (AVM.z1 - LOBI_Z1 - 1.6) }; };
  const yolNokta = (): Vec2 => { const p = holNokta(); return { x: rng.next() < 0.5 ? HOL.x0 + 0.5 + rng.next() * 1.0 : HOL.x1 - 1.5 + rng.next() * 1.0, z: p.z }; };

  function yeni(at: Pt, kat: number): Z {
    const seed = 50000 + n, look = pick(LOOKS);
    const a = env.reg.add('regular', 'avm-z-' + n++, { kind: 'regular', look: { lookType: look, lookSeed: seed }, seed }, at, { name: '', avm: true });
    a.y = a.py = at.y ?? katY(kat);
    const z: Z = { a, kat, st: 'yol', t: 0, dur: 0, path: [], face: 0, durak: 2 + Math.floor(rng.next() * 3) };
    zs.push(z); return z;
  }
  /** sıradaki durak: konser / sinema varsa onlara meyilli, yoksa vitrin, bank; duraklar bitince çıkış */
  function sonraki(z: Z) {
    const h = env.host.hour(), a = z.a;
    if (z.durak-- <= 0) { z.st = 'cik'; z.path = avmGidis(z.kat, a); return; }
    const acik = SALONLAR.filter(s => seans(s, h).durum === 'giris' && bosKoltuk(s) >= 0);
    const r = rng.next();
    if (acik.length && r < 0.45) { const s = pick(acik); giseyeGit(z, s); return; }
    if (r < 0.6) { git(z, EGLENCE_KAT, { x: BUFE_ON.x - rng.next() * 0.8, z: BUFE_ON.z + (rng.next() - 0.5) * 3.5 }, 'koku'); z.face = Math.PI / 2; return; }
    if (r < 0.82) {   // bank: zemin lobi ya da eğlence katı lobisi
      if (rng.next() < 0.5) { const b = LOBI_DEKOR.find(d => d.k === 'bank')!; git(z, 0, { x: b.x - 0.6 + rng.next() * 1.2, z: b.z + 0.55 }, 'otur'); z.face = 0; }
      else { const b = pick(BANKLAR); git(z, EGLENCE_KAT, { x: b.x - 0.5 + rng.next(), z: b.z + 0.55 }, 'otur'); z.face = 0; }
      return;
    }
    // vitrin: dükkân katlarından birinde bir dükkânın kapısının önü
    const kat = Math.floor(rng.next() * EGLENCE_KAT), bati = rng.next() < 0.5, oz = rng.next() < 0.5 ? ODA_Z.F : ODA_Z.B;
    const p = { x: bati ? HOL.x0 + 0.75 : HOL.x1 - 0.75, z: oz + (rng.next() - 0.5) * 2.2 };
    git(z, kat, p, 'vitrin'); z.face = Math.atan2((bati ? ODA_X.W : ODA_X.E) - p.x, oz - p.z);
  }
  /** seansa gidecek: önce boş olan gişenin önüne (sıradakiler arkaya dizilir), bilet, sonra salon */
  function giseyeGit(z: Z, s: Salon) {
    const g = GISELER.map((k, i) => ({ k, i, n: zs.filter(q => (q.hedef === 'gise' || q.st === 'gise') && q.gi === i).length })).sort((a, b) => a.n - b.n)[0];
    git(z, EGLENCE_KAT, { x: g.k.musteri.x - g.n * 0.85, z: g.k.musteri.z + (rng.next() - 0.5) * 0.3 }, 'gise'); z.salon = s; z.gi = g.i;
  }
  function git(z: Z, kat: number, to: Vec2, hedef: Dur) { z.path = avmYol(z.kat, z.a, kat, to); z.kat = kat; z.st = 'yol'; z.hedef = hedef; z.t = 0; }
  const doluKoltuk = (s: Salon) => new Set(zs.filter(z => z.salon === s && z.koltuk !== undefined).map(z => z.koltuk));
  function bosKoltuk(s: Salon): number { const d = doluKoltuk(s); const bos = s.koltuk.map((_, i) => i).filter(i => !d.has(i)); return bos.length ? bos[Math.floor(rng.next() * bos.length)] : -1; }
  const koltukYolu = (s: Salon, i: number): Pt[] => { const k = s.koltuk[i], y = katY(EGLENCE_KAT); return [{ ...s.ici, y }, { x: KORIDOR_X, z: k.z, y }, { x: k.x + 0.42, z: k.z, y }, { x: k.x, z: k.z, y }]; };

  const walk = (a: Actor, path: Pt[], dt: number, sp = SP): boolean => {
    let left = sp * dt;
    while (path.length && left > 0) {
      const to = path[0], dx = to.x - a.x, dz = to.z - a.z, d = Math.hypot(dx, dz);
      if (d < 1e-3) { if (to.y !== undefined) a.y = to.y; path.shift(); continue; }
      const k = Math.min(1, left / d); a.x += dx * k; a.z += dz * k; if (to.y !== undefined) a.y += (to.y - a.y) * k; a.rot = Math.atan2(dx, dz); left -= d * k;
      if (k < 1) break;
      if (to.y !== undefined) a.y = to.y; path.shift();
    }
    a.speed = path.length ? sp : 0; a.act = path.length ? 'walk' : 'idle';
    return !path.length;
  };

  function adim(z: Z, dt: number) {
    const a = z.a, h = env.host.hour(); z.t += dt; if (a.sayT > 0 && (a.sayT -= dt) <= 0) a.say = '';
    switch (z.st) {
      case 'yol':
        if (!walk(a, z.path, dt)) return;
        z.t = 0;
        if (z.hedef === 'sinema' && z.salon) {
          const s = z.salon, x = seans(s, h), i = x.durum === 'giris' || (x.durum === 'film' && x.t < 1.1) ? bosKoltuk(s) : -1;   // geç kalan da girer (ilk yarım saat)
          if (i < 0) { z.salon = undefined; sonraki(z); return; }
          z.koltuk = i; z.path = koltukYolu(s, i); z.st = 'sinema'; return;
        }
        if (z.hedef === 'gise') { z.st = 'gise'; z.dur = 2.2 + rng.next() * 1.6; a.rot = Math.PI / 2; if (rng.next() < 0.45) say(a, pick(SOZ_GISE), 2.0); const gc = gis[z.gi ?? 0]; if (gc) gc.is = 2.2; return; }
        if (z.hedef === 'koku') { z.st = 'vitrin'; z.dur = 3 + rng.next() * 3; a.rot = z.face; if (rng.next() < 0.6) say(a, pick(SOZ_KOKU), 2.2); return; }
        if (z.hedef === 'otur') { z.st = 'otur'; z.dur = 8 + rng.next() * 10; a.rot = z.face; return; }
        z.st = 'vitrin'; z.dur = 4 + rng.next() * 5; a.rot = z.face; if (rng.next() < 0.18) say(a, pick(SOZ_VITRIN)); return;
      case 'vitrin': a.act = 'idle'; a.speed = 0; a.rot = z.face; if (z.t > z.dur) sonraki(z); return;
      case 'otur': a.act = 'sit'; a.speed = 0; a.rot = z.face; if (z.t > z.dur) sonraki(z); return;
      case 'sinema':   // koltuğa yürü, otur
        if (walk(a, z.path, dt, 0.9)) { z.st = 'film'; z.t = 0; }
        return;
      case 'film': {
        a.act = 'sit'; a.speed = 0; a.rot = -Math.PI / 2;   // perde batı duvarında
        const d = z.salon ? seans(z.salon, h).durum : 'kapali';
        if (d === 'cikis' || d === 'kapali') {
          const s = z.salon!, k = s.koltuk[z.koltuk!], y = katY(EGLENCE_KAT);
          if (rng.next() < 0.35) say(a, pick(SOZ_FILM));
          const cik: Pt[] = [{ x: k.x + 0.42, z: k.z, y }, { x: KORIDOR_X, z: k.z, y }, { ...s.ici, y }, { ...s.kapi, y }];
          z.salon = undefined; z.koltuk = undefined;
          if (rng.next() < 0.5) { z.st = 'cik'; z.path = [...cik, ...avmGidis(EGLENCE_KAT, s.kapi)]; }   // film çıkışı: yarısı eve gider
          else { const kat = Math.floor(rng.next() * EGLENCE_KAT), p = yolNokta(); z.path = [...cik, ...avmYol(EGLENCE_KAT, s.kapi, kat, p)]; z.kat = kat; z.st = 'yol'; z.hedef = 'vitrin'; z.face = 0; }
        }
        return;
      }
      case 'gise': {   // bileti al, salona yürü (seans kaçtıysa başka bir şey yapar)
        a.act = 'idle'; a.speed = 0; a.rot = Math.PI / 2;
        if (z.t < z.dur) return;
        const s = z.salon; z.gi = undefined;
        if (s && (seans(s, h).durum === 'giris' || (seans(s, h).durum === 'film' && seans(s, h).t < 1.1))) git(z, EGLENCE_KAT, s.kapi, 'sinema');
        else { z.salon = undefined; sonraki(z); }
        return;
      }
      case 'koku': sonraki(z); return;
      case 'cik':
        if (walk(a, z.path, dt)) { env.reg.remove(a); zs.splice(zs.indexOf(z), 1); }
        return;
    }
  }

  function giseciler(dt: number) {
    if (!gis.length) GISELER.forEach((k, i) => {
      const seed = 61500 + i, a = env.reg.add('worker', 'avm-gise-' + i, { kind: 'worker', role: 'kasiyer', seed, look: { lookSeed: seed } }, k.giseci, { name: 'Gişeci', role: 'kasiyer' });
      a.y = a.py = katY(EGLENCE_KAT); gis.push({ a, i, is: 0 });
    });
    for (const g of gis) { const a = g.a; a.rot = -Math.PI / 2; a.speed = 0; g.is -= dt; a.act = g.is > 0 ? 'pour' : 'idle'; }
  }
  function doldur() {   // oyuncu içeri girince AVM boş görünmesin: ziyaretçilerin çoğu zaten katlarda
    for (let i = 0; i < ZIYARETCI_HEDEF - 3; i++) {
      const kat = Math.floor(rng.next() * AVM.KAT), b = pick(BANKLAR), p = kat === EGLENCE_KAT && rng.next() < 0.4 ? { x: b.x + 0.1, z: b.z - 0.6 + rng.next() * 1.2 } : yolNokta();
      const z = yeni({ ...p, y: katY(kat) }, kat); sonraki(z);
    }
    const h = env.host.hour(), y3 = katY(EGLENCE_KAT);
    for (const s of SALONLAR) if (seans(s, h).durum === 'film') for (let i = 0, nn = 5 + Math.floor(rng.next() * 5); i < nn; i++) {   // oynayan filmin seyircisi zaten koltukta
      const ki = bosKoltuk(s); if (ki < 0) break; const k = s.koltuk[ki], z = yeni({ ...k, y: y3 }, EGLENCE_KAT);
      z.salon = s; z.koltuk = ki; z.st = 'film'; z.durak = 1;
    }
  }
  /** seans başlarken sinema katına gelenler: 2. kattan yürüyen merdivenle çıkar (alt katın döşemesi altında belirir), önce gişeye */
  const MERDIVEN_ALTI = (): Pt => { const y = yolculuk('U', EGLENCE_KAT - 1).noktalar[0]; return { x: y.x, z: y.z - 0.7, y: katY(EGLENCE_KAT - 1) }; };
  function etkinlikGelen(dt: number) {
    if (zs.length >= ZIYARETCI_HEDEF + 14 || (etkT -= dt) > 0) return;
    const h = env.host.hour();
    for (const s of SALONLAR) {
      const x = seans(s, h); if (!(x.durum === 'giris' || (x.durum === 'film' && x.t < 0.9))) continue;
      if (zs.filter(z => z.salon === s).length >= 9 || bosKoltuk(s) < 0) continue;
      const z = yeni(MERDIVEN_ALTI(), EGLENCE_KAT - 1); giseyeGit(z, s);
      z.durak = 1; etkT = 1.3; return;
    }
  }
  function temizle() { for (const z of zs) env.reg.remove(z.a); for (const g of gis) env.reg.remove(g.a); zs.length = 0; gis.length = 0; }

  // oyuncu: gişede bilet alır, salon kapısındaki görevli bileti kontrol eder
  const siradaki = (): Salon => { const h = env.host.hour(); return SALONLAR.map(s => ({ s, x: seans(s, h) })).sort((a, b) => (a.x.durum === 'giris' ? -2 : a.x.durum === 'film' ? -1 : (a.x.sonraki - h + 24) % 24) - (b.x.durum === 'giris' ? -2 : b.x.durum === 'film' ? -1 : (b.x.sonraki - h + 24) % 24))[0].s; };
  for (const k of GISELER) env.interactions.register({
    id: 'sinemaGise.' + k.id, pos: k.musteri, radius: 0.9, kind: 'station', dwell: 0.5, interval: 0.2,
    canAct: () => kat3() && !bilet,
    act: () => {
      const S = env.rules.state as { money: number }, s = siradaki(), x = seans(s, env.host.hour()), d = diziOf(s.id), bo = bolumOf(d, x.durum === 'kapali' || x.durum === 'cikis' ? x.bolum + 1 : x.bolum);
      if (S.money < BILET_FIYAT) { env.host.heroSay('Gişeci: Bilet ' + BILET_FIYAT + ' ₺, paran yetmiyor.', 2.2); return 'done'; }
      S.money -= BILET_FIYAT; bilet = { salon: s.id, bolum: bo.no };
      const gc = gis[k.id - 1]; if (gc) gc.is = 2.2;
      env.host.heroSay('Gişeci: ' + s.ad + ', ' + d.ad + ' ' + bo.no + '. Bölüm. İyi seyirler! (-' + BILET_FIYAT + ' ₺)', 2.8);
      return 'done';
    },
  });
  for (const s of SALONLAR) env.interactions.register({
    id: 'sinemaKapi.' + s.id, pos: s.kapi, radius: 0.8, kind: 'door', dwell: 0.3, interval: 0.2,
    canAct: () => kat3(),
    act: () => {
      if (bilet && bilet.salon === s.id) { env.host.heroSay('Görevli: Biletiniz tamam, ' + bilet.bolum + '. bölüm. Koltuklar ileride, iyi seyirler!', 2.6); bilet = null; }
      else if (bilet) env.host.heroSay('Görevli: Biletiniz Salon ' + bilet.salon + ' için, yan kapı.', 2.2);
      else env.host.heroSay('Görevli: Önce gişeden bilet almalısınız (' + BILET_FIYAT + ' ₺).', 2.2);
      return 'done';
    },
  });

  return {
    id: 'avm-yasam', order: 49, phase: 'sim',
    step(ctx: SimCtx) {
      const dt = Math.min(ctx.dt, 0.25), p = env.player(), ic = realmAt(p.x)?.id === 'avm';
      if (ic !== icerde) { icerde = ic; if (ic) doldur(); else temizle(); }
      if (!ic) return;
      if (zs.length < ZIYARETCI_HEDEF && (spawnT -= dt) <= 0) {   // girişten yeni gelenler
        spawnT = 2.5 + rng.next() * 2.5;
        const z = yeni({ ...AVM_GIRIS, y: 0 }, 0); z.hedef = 'vitrin'; z.path = avmGelis(0, yolNokta());
      }
      etkinlikGelen(dt);
      for (let i = zs.length - 1; i >= 0; i--) adim(zs[i], dt);
      giseciler(dt);
    },
    rows: () => zs.map(z => ({ key: z.a.key, st: z.st, kat: z.kat, x: z.a.x, z: z.a.z, y: z.a.y, act: z.a.act })),
    giseci: () => gis.map(g => ({ key: g.a.key, x: g.a.x, z: g.a.z, y: g.a.y, act: g.a.act })),
    bilet: () => bilet,
  };
}
