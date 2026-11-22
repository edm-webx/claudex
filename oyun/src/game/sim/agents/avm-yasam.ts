/**
 * Martı AVM'nin yaşamı (2026-11-21 21:07 sahip: "AVM'nin içi gezilebilen başka bir âlem: dükkânlar, insanlar, konserler, sinema
 * salonları hepsi ayarlansın"). Oyuncu AVM diyarındayken:
 *  - ziyaretçiler: girişten gelir, katlar arası yürüyen merdivenle dolaşır; vitrin bakar, bankta oturur, seansa yetişirse sinemada
 *    koltuğa oturup filmi izler, konser varsa sahnenin önünde alkışlar / dans eder; birkaç duraktan sonra çıkıp gider.
 *  - müzisyenler: konserden biraz önce kulisten gelip sahneye çıkar, saz / mikrofon / davul çalar, bitince yürüyüp gider.
 * Hepsi gerçek, yürüyen aktör (registry); dekor yok. Oyuncu AVM'den çıkınca kaldırılır, girince içerisi dolu başlar.
 * Takvim ve yerleşim: content/avm-eglence.ts. Deterministik (kendi rng akışı). Saf sim.
 */
import type { System, SimCtx, Vec2 } from '../../../engine/api';
import type { AgentEnv } from './env';
import type { Actor } from './types';
import { AVM, HOL, ODA_X, ODA_Z, AVM_GIRIS, LOBI_DEKOR, katY, yolculuk, avmYol, avmGidis, avmGelis } from '../../../content/avm-kat';
import { EGLENCE_KAT, SALONLAR, SEYIRCI, KULIS, BASAMAK, MUZISYEN, SAHNE, BANKLAR, seans, konser, type Salon } from '../../../content/avm-eglence';
import { realmAt } from '../../../content/realm';

type Pt = Vec2 & { y?: number };
type Dur = 'yol' | 'vitrin' | 'otur' | 'sinema' | 'film' | 'konser' | 'cik';
interface Z { a: Actor; kat: number; st: Dur; t: number; dur: number; path: Pt[]; face: number; durak: number; salon?: Salon; koltuk?: number; hedef?: Dur }
interface Muz { a: Actor; i: number; st: 'gel' | 'cal' | 'git'; path: Pt[] }

const LOOKS = ['universiteli', 'teyze', 'emekli', 'plaza', 'turgrubu', 'gezgin', 'balayi', 'taraftar'];
const SOZ_FILM = ['Çok iyiydi!', 'Sonu ne öyle ya!', 'Devamı çıkar mı?', 'Mısır bitti ama film bitmedi.'];
const SOZ_KONSER = ['Bravo!', 'Bir daha!', 'Oley!', 'Çal Kemal çal!'];
const SOZ_VITRIN = ['Şuna bak!', 'Bu fiyata mı?', 'Akşam gelip alırım.', 'Burası yeni açılmış.'];
export const ZIYARETCI_HEDEF = 16, SP = 1.15;

export interface AvmYasamSystem extends System {
  /** test / araç: aktif ziyaretçi ve müzisyen satırları */
  rows(): { key: string; st: string; kat: number; x: number; z: number; y: number; act: string }[];
  muzisyen(): { key: string; st: string; x: number; z: number; y: number; act: string; fx: string }[];
}

export function createAvmYasam(env: AgentEnv): AvmYasamSystem {
  const rng = env.rng('avm-yasam');
  const zs: Z[] = [], muz: Muz[] = [];
  let n = 0, spawnT = 0, icerde = false, muzikT = 0, etkT = 0;
  const say = (a: Actor, t: string, s = 2.4) => { a.say = t; a.sayT = s; };
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rng.next() * xs.length)];
  const holNokta = (): Vec2 => ({ x: HOL.x0 + 0.6 + rng.next() * (HOL.x1 - HOL.x0 - 1.2) * (rng.next() < 0.5 ? 0.25 : 1), z: 47.2 + rng.next() * 9 });
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
    const k = konser(h), acik = SALONLAR.filter(s => seans(s, h).durum === 'giris' && bosKoltuk(s) >= 0);
    const r = rng.next();
    if (acik.length && r < 0.4) { const s = pick(acik); git(z, EGLENCE_KAT, s.kapi, 'sinema'); z.salon = s; return; }
    if (k.durum !== 'yok' && r < 0.75) { git(z, EGLENCE_KAT, { x: SEYIRCI.x0 + rng.next() * (SEYIRCI.x1 - SEYIRCI.x0), z: SEYIRCI.z0 + rng.next() * (SEYIRCI.z1 - SEYIRCI.z0) }, 'konser'); return; }
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
  function git(z: Z, kat: number, to: Vec2, hedef: Dur) { z.path = avmYol(z.kat, z.a, kat, to); z.kat = kat; z.st = 'yol'; z.hedef = hedef; z.t = 0; }
  const doluKoltuk = (s: Salon) => new Set(zs.filter(z => z.salon === s && z.koltuk !== undefined).map(z => z.koltuk));
  function bosKoltuk(s: Salon): number { const d = doluKoltuk(s); const bos = s.koltuk.map((_, i) => i).filter(i => !d.has(i)); return bos.length ? bos[Math.floor(rng.next() * bos.length)] : -1; }
  const koltukYolu = (s: Salon, i: number): Pt[] => { const k = s.koltuk[i], y = katY(EGLENCE_KAT); return [{ ...s.ici, y }, { x: AVM.x0 + 4.45, z: k.z, y }, { x: k.x + 0.42, z: k.z, y }, { x: k.x, z: k.z, y }]; };

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
        if (z.hedef === 'konser') { z.st = 'konser'; z.dur = 25 + rng.next() * 30; a.rot = Math.PI / 2; return; }
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
          const cik: Pt[] = [{ x: k.x + 0.42, z: k.z, y }, { x: AVM.x0 + 4.45, z: k.z, y }, { ...s.ici, y }, { ...s.kapi, y }];
          z.salon = undefined; z.koltuk = undefined;
          if (rng.next() < 0.5) { z.st = 'cik'; z.path = [...cik, ...avmGidis(EGLENCE_KAT, s.kapi)]; }   // film çıkışı: yarısı eve gider
          else { const kat = Math.floor(rng.next() * EGLENCE_KAT), p = yolNokta(); z.path = [...cik, ...avmYol(EGLENCE_KAT, s.kapi, kat, p)]; z.kat = kat; z.st = 'yol'; z.hedef = 'vitrin'; z.face = 0; }
        }
        return;
      }
      case 'konser': {
        const k = konser(h); a.speed = 0; a.rot = Math.PI / 2;
        a.act = k.durum === 'sahnede' ? (Math.floor(z.t / 3 + a.id) % 3 === 0 ? 'cheer' : 'dance') : 'idle';
        if (k.durum === 'sahnede' && rng.next() < dt * 0.04) say(a, pick(SOZ_KONSER), 1.8);
        if (k.durum === 'yok' || z.t > z.dur) sonraki(z);
        return;
      }
      case 'cik':
        if (walk(a, z.path, dt)) { env.reg.remove(a); zs.splice(zs.indexOf(z), 1); }
        return;
    }
  }

  function muzisyenler(dt: number) {
    const k = konser(env.host.hour()), y0 = katY(EGLENCE_KAT), ys = y0 + SAHNE.h;
    if (k.durum !== 'yok' && !muz.length) {
      MUZISYEN.forEach((m, i) => {
        const seed = 61000 + i, at = k.durum === 'sahnede' ? { x: m.x, z: m.z } : KULIS;
        const a = env.reg.add('worker', 'avm-muz-' + i, { kind: 'worker', role: 'muzisyen', seed, look: { lookSeed: seed } }, at, { name: m.ad, role: 'muzisyen' });
        a.y = a.py = k.durum === 'sahnede' ? ys : y0;
        muz.push({ a, i, st: k.durum === 'sahnede' ? 'cal' : 'gel', path: k.durum === 'sahnede' ? [] : [{ ...BASAMAK, y: y0 }, { x: BASAMAK.x, z: SAHNE.z1 - 0.3, y: ys }, { x: m.x, z: m.z, y: ys }] });
      });
    }
    for (let i = muz.length - 1; i >= 0; i--) {
      const u = muz[i], a = u.a, m = MUZISYEN[u.i];
      if (u.st === 'gel') { a.fx = m.fx; if (walk(a, u.path, dt, 0.9)) u.st = 'cal'; }
      else if (u.st === 'cal') {
        a.speed = 0; a.rot = -Math.PI / 2; a.fx = m.fx; a.act = k.durum === 'sahnede' ? 'perform' : 'idle';
        if (u.i === 0 && k.durum === 'sahnede' && (muzikT -= dt) <= 0) { muzikT = 12; if (((env.player() as { kat?: number }).kat || 0) === EGLENCE_KAT) env.emit('canliMuzik', { x: a.x, z: a.z }); }   // canlı müzik sesi (SNT-14): yalnız sahne katında duyulur
        if (k.durum === 'yok') { u.st = 'git'; say(a, 'Teşekkürler Martı AVM!', 2.6); u.path = [{ x: BASAMAK.x, z: SAHNE.z1 - 0.3, y: ys }, { ...BASAMAK, y: y0 }, { ...KULIS, y: y0 }]; }
      } else if (walk(a, u.path, dt, 1.0)) { env.reg.remove(a); muz.splice(i, 1); }
    }
  }

  function doldur() {   // oyuncu içeri girince AVM boş görünmesin: ziyaretçilerin çoğu zaten katlarda
    for (let i = 0; i < ZIYARETCI_HEDEF - 3; i++) {
      const kat = Math.floor(rng.next() * AVM.KAT), p = kat === EGLENCE_KAT && rng.next() < 0.5 ? { x: SEYIRCI.x0 + rng.next() * 2, z: 48.5 + rng.next() * 6 } : yolNokta();
      const z = yeni({ ...p, y: katY(kat) }, kat); sonraki(z);
    }
    const h = env.host.hour(), y3 = katY(EGLENCE_KAT);
    for (const s of SALONLAR) if (seans(s, h).durum === 'film') for (let i = 0, nn = 5 + Math.floor(rng.next() * 5); i < nn; i++) {   // oynayan filmin seyircisi zaten koltukta
      const ki = bosKoltuk(s); if (ki < 0) break; const k = s.koltuk[ki], z = yeni({ ...k, y: y3 }, EGLENCE_KAT);
      z.salon = s; z.koltuk = ki; z.st = 'film'; z.durak = 1;
    }
    if (konser(h).durum === 'sahnede') for (let i = 0, nn = 6 + Math.floor(rng.next() * 4); i < nn; i++) {
      const z = yeni({ x: SEYIRCI.x0 + rng.next() * (SEYIRCI.x1 - SEYIRCI.x0), z: SEYIRCI.z0 + rng.next() * (SEYIRCI.z1 - SEYIRCI.z0), y: y3 }, EGLENCE_KAT);
      z.st = 'konser'; z.dur = 20 + rng.next() * 30; z.durak = 1;
    }
  }
  /** seans ya da konser başlarken eğlence katına gelenler: 2. kattan yürüyen merdivenle çıkar (alt katın döşemesi altında belirir) */
  const MERDIVEN_ALTI = (): Pt => { const y = yolculuk('U', EGLENCE_KAT - 1).noktalar[0]; return { x: y.x, z: y.z - 0.7, y: katY(EGLENCE_KAT - 1) }; };
  function etkinlikGelen(dt: number) {
    if (zs.length >= ZIYARETCI_HEDEF + 14 || (etkT -= dt) > 0) return;
    const h = env.host.hour();
    for (const s of SALONLAR) {
      const x = seans(s, h); if (!(x.durum === 'giris' || (x.durum === 'film' && x.t < 0.9))) continue;
      if (zs.filter(z => z.salon === s).length >= 9 || bosKoltuk(s) < 0) continue;
      const z = yeni(MERDIVEN_ALTI(), EGLENCE_KAT - 1); z.salon = s; git(z, EGLENCE_KAT, s.kapi, 'sinema');
      z.durak = 1; etkT = 1.3; return;
    }
    if (konser(h).durum === 'sahnede' && zs.filter(z => z.st === 'konser' || z.hedef === 'konser').length < 11) {
      const z = yeni(MERDIVEN_ALTI(), EGLENCE_KAT - 1); git(z, EGLENCE_KAT, { x: SEYIRCI.x0 + rng.next() * (SEYIRCI.x1 - SEYIRCI.x0), z: SEYIRCI.z0 + rng.next() * (SEYIRCI.z1 - SEYIRCI.z0) }, 'konser');
      z.durak = 1; etkT = 1.6;
    }
  }
  function temizle() { for (const z of zs) env.reg.remove(z.a); for (const m of muz) env.reg.remove(m.a); zs.length = 0; muz.length = 0; }

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
      muzisyenler(dt);
    },
    rows: () => zs.map(z => ({ key: z.a.key, st: z.st, kat: z.kat, x: z.a.x, z: z.a.z, y: z.a.y, act: z.a.act })),
    muzisyen: () => muz.map(m => ({ key: m.a.key, st: m.st, x: m.a.x, z: m.a.z, y: m.a.y, act: m.a.act, fx: m.a.fx })),
  };
}
