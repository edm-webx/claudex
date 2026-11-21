// Halı saha girdisi (FUT-07, 2026-11-21): klavye, dokunmatik ve gamepad AYNI soyut eylem arayüzüne yazar.
// Saf modül: DOM yok, performance.now yok (zaman dışarıdan verilir), bu yüzden birim testle sınanır.
// Şema (B-050): WASD/oklar yürü, Shift koş, Space pas (basılı = ara pas), E uzun pas, F şut (basılı = şarj),
// C müdahale, Q oyuncu değiştir, X çalım. Gamepad: sol çubuk, A pas, B şut, X çalım, Y değiştir, RT koş (LB müdahale, RB uzun pas).
// Topsuzken ŞUT = müdahale, PAS = oyuncu değiştir (motor act() böyle okur), dokunmatik düğmeler de buna göre yazılır.

export type Eylem = 'sut' | 'pas' | 'uzun' | 'calim' | 'mudahale' | 'degis';
export type Kaynak = 'klavye' | 'dokunmatik' | 'gamepad';
export type MotorEylem = 'sut' | 'pas' | 'calim' | 'uzun';

export const SARJ_SUT_SN = 0.8;      // şut gücü bu sürede 1'e çıkar
export const SARJ_SUT_OTO_SN = 1.0;  // bu kadar basılı kalırsa tam güçle kendiliğinden çıkar
export const ARA_PAS_SN = 0.3;       // PAS bundan uzun basılı kalırsa ara pas
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export const TUSLAR: Record<string, Eylem | 'kos'> = { ' ': 'pas', e: 'uzun', f: 'sut', c: 'mudahale', q: 'degis', x: 'calim', shift: 'kos' };
export const YON_TUSLARI: Record<string, [number, number]> = { a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0], w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1] };
/** Gamepad düğme indeksi -> eylem (standart eşleme): A=0 B=1 X=2 Y=3 LB=4 RB=5 LT=6 RT=7, D-pad 12..15. */
export const PAD_DUGME: Record<number, Eylem> = { 0: 'pas', 1: 'sut', 2: 'calim', 3: 'degis', 4: 'mudahale', 5: 'uzun' };
export const PAD_KOS = 7;

/** Şut: basılı kalma süresi (sn) -> güç 0.15..1. */
export const sarjGuc = (sn: number) => clamp(sn / SARJ_SUT_SN, 0.15, 1);
/** Şarj halkası doluluğu 0..1 (şut 0.8 sn'de, pas 0.3 sn'de dolar). */
export const sarjOrani = (a: 'sut' | 'pas', sn: number) => clamp(sn / (a === 'sut' ? SARJ_SUT_SN : ARA_PAS_SN), 0, 1);

/** Ekran vektörü -> saha vektörü. Dikey ekranda saha dönük: ekran yukarısı = +x (hücum), sağ = +y. */
export function ekranVektoru(sx: number, sy: number, portrait: boolean): [number, number] {
  const m = Math.hypot(sx, sy); if (m > 1) { sx /= m; sy /= m; }
  return portrait ? [-sy, sx] : [sx, sy];
}

/** Gamepad çubuğu: dairesel ölü bölge, sonra 0..1'e yeniden ölçek. */
export function olubolge(x: number, y: number, db = 0.22): [number, number] {
  const d = Math.hypot(x, y); if (d <= db) return [0, 0];
  const k = (Math.min(1, d) - db) / (1 - db) / d; return [x * k, y * k];
}

/** Sabit adım biriktirici (FUT-06): kare süresi ne olursa olsun simülasyon 1/60 adımlarla ilerler. */
export const ADIM = 1 / 60;
export function sabitAdim(maxAdim = 400) {
  let acc = 0;
  return {
    /** dt (sn, zaten ölçeklenmiş) ekle; bu karede koşulacak adım sayısını döndürür. */
    ekle(dt: number): number { acc += dt; let n = 0; while (acc >= ADIM - 1e-9 && n < maxAdim) { acc -= ADIM; n++; } if (n >= maxAdim) acc = 0; return n; },
    /** Çizim için ara değer 0..1. */
    get alfa() { return clamp(acc / ADIM, 0, 1); },
    sifirla() { acc = 0; },
  };
}

export interface Dugme { x: number; y: number; r: number }
export interface DugmeYer { sut: Dugme; pas: Dugme; calim: Dugme; son: Dugme; yardim: Dugme }
/** Dokunmatik düğme yerleşimi (yatay ve dikey aynı: sağ başparmak küme, düğmeler arası ~0.4r boşluk). */
export function dugmeYerlesimi(cw: number, ch: number): DugmeYer {
  const r = clamp(Math.min(cw, ch) * 0.085, 38, 64);
  return {
    sut: { x: cw - r * 1.7, y: ch - r * 1.8, r: r * 1.2 },
    pas: { x: cw - r * 4.2, y: ch - r * 1.3, r: r * 0.95 },
    calim: { x: cw - r * 3.1, y: ch - r * 3.9, r: r * 0.85 },
    son: { x: cw - 34, y: 34, r: 22 },
    yardim: { x: 30, y: 82, r: 24 },
  };
}
/** Dokunuşa en yakın düğme (yanlış basmayı önlemek için en yakın merkez kazanır, dış çarpan 1.1). */
export function dugmeBul(B: DugmeYer, x: number, y: number, hangi: (keyof DugmeYer)[] = ['sut', 'pas', 'calim']): keyof DugmeYer | null {
  let best: keyof DugmeYer | null = null, bd = 1.1;
  for (const k of hangi) { const b = B[k], d = Math.hypot(x - b.x, y - b.y) / b.r; if (d <= bd) { bd = d; best = k; } }
  return best;
}

export interface PadBenzeri { axes: readonly number[]; buttons: readonly { pressed: boolean; value?: number }[] }
export interface GirdiOpts {
  /** Motor eylemi (M.act). guc 0..1, uzun = ara/uzun pas. */
  act(a: MotorEylem, guc?: number, uzun?: boolean): void;
  /** Kontrol edilen oyuncunun topu var mı. */
  sahip(): boolean;
  /** ms cinsinden zaman. */
  simdi(): number;
  /** M.input güncelle (act'ten hemen önce çağrılır: gecikme düşük kalsın). */
  esitle?(): void;
}
export interface Sarj { a: 'sut' | 'pas'; sn: number; oran: number; ara: boolean }

export function createGirdi(o: GirdiOpts) {
  const tuslar = new Set<string>();
  let sarjDurum: { a: 'sut' | 'pas'; t0: number; src: string } | null = null;
  let joy: { id: number; ox: number; oy: number; x: number; y: number } | null = null;
  const pad = { x: 0, y: 0, kos: false, onceki: new Set<number>(), var: false };
  let kaynak: Kaynak = 'klavye';
  let kosTus = false;
  const sn = () => (sarjDurum ? (o.simdi() - sarjDurum.t0) / 1000 : 0);

  function ates(guc: number, ara: boolean) {
    const a = sarjDurum!.a; sarjDurum = null; o.esitle?.();
    if (!o.sahip()) return;
    if (a === 'sut') o.act('sut', guc); else o.act('pas', 0.5, ara);
  }
  function eylemBas(e: Eylem, src: string) {
    o.esitle?.();
    if (e === 'sut' || e === 'pas') {
      if (!o.sahip()) { o.act(e); return; }   // topsuz: müdahale / oyuncu değiştir, anında
      if (!sarjDurum) sarjDurum = { a: e, t0: o.simdi(), src };
    } else if (e === 'uzun') { if (o.sahip()) o.act('uzun'); }   // havadan uzun top (ara pas Boşluk basılı tutunca)
    else if (e === 'calim') o.act('calim');
    else if (e === 'mudahale') { if (!o.sahip()) o.act('sut'); }
    else if (e === 'degis') { if (!o.sahip()) o.act('pas'); }
  }
  function eylemBirak(e: Eylem, src: string) {
    if (!sarjDurum || sarjDurum.a !== e || sarjDurum.src !== src) return;
    const h = sn(); ates(e === 'sut' ? sarjGuc(h) : 0.5, h > ARA_PAS_SN);
  }

  return {
    get kaynak() { return kaynak; },
    get kos() { return kosTus || pad.kos; },
    get padVar() { return pad.var; },
    /** Klavye olayı. true = bu tuş bizim (preventDefault). */
    tus(key: string, on: boolean, tekrar = false): boolean {
      const k = key.toLowerCase(); kaynak = 'klavye';
      if (YON_TUSLARI[k]) { if (on) tuslar.add(k); else tuslar.delete(k); return true; }
      const e = TUSLAR[k]; if (!e) return false;
      if (e === 'kos') { kosTus = on; return true; }
      if (tekrar) return true;
      if (on) eylemBas(e, 'k:' + k); else eylemBirak(e, 'k:' + k);
      return true;
    },
    /** Dokunmatik düğme basıldı / bırakıldı (id = pointerId). */
    dugme(e: 'sut' | 'pas' | 'calim', on: boolean, id: number) { kaynak = 'dokunmatik'; if (on) eylemBas(e, 'p:' + id); else eylemBirak(e, 'p:' + id); },
    /** Şarj bu işaretçiye ait mi (pointerup'ta hangi düğmeyi bırakacağımızı bulmak için). */
    sarjKaynak(id: number) { return sarjDurum && sarjDurum.src === 'p:' + id ? sarjDurum.a : null; },
    joyBas(id: number, x: number, y: number) { if (joy) return false; kaynak = 'dokunmatik'; joy = { id, ox: x, oy: y, x, y }; return true; },
    joyHareket(id: number, x: number, y: number) { if (joy && joy.id === id) { joy.x = x; joy.y = y; } },
    joyBirak(id: number) { if (joy && joy.id === id) { joy = null; return true; } return false; },
    get joy() { return joy; },
    /** Gamepad'i her karede oku (null = bağlı değil). Düğme kenarları burada eylem olur. */
    gamepad(p: PadBenzeri | null) {
      pad.var = !!p;
      if (!p) { pad.x = pad.y = 0; pad.kos = false; for (const b of [...pad.onceki]) { const e = PAD_DUGME[b]; if (e) eylemBirak(e, 'g:' + b); } pad.onceki.clear(); return; }
      let [x, y] = olubolge(p.axes[0] || 0, p.axes[1] || 0);
      const bas = (i: number) => !!p.buttons[i]?.pressed;
      if (bas(14)) x -= 1; if (bas(15)) x += 1; if (bas(12)) y -= 1; if (bas(13)) y += 1;
      pad.x = clamp(x, -1, 1); pad.y = clamp(y, -1, 1);
      pad.kos = (p.buttons[PAD_KOS]?.value ?? (bas(PAD_KOS) ? 1 : 0)) > 0.5;
      for (const sKey of Object.keys(PAD_DUGME)) {
        const i = +sKey, e = PAD_DUGME[i], simdi = bas(i), once = pad.onceki.has(i);
        if (simdi && !once) { pad.onceki.add(i); kaynak = 'gamepad'; eylemBas(e, 'g:' + i); }
        else if (!simdi && once) { pad.onceki.delete(i); eylemBirak(e, 'g:' + i); }
      }
      if (Math.abs(pad.x) + Math.abs(pad.y) > 0.3) kaynak = 'gamepad';
    },
    /** Yürüme vektörü (saha koordinatı). Öncelik: dokunmatik çubuk > gamepad > klavye. */
    vektor(portrait: boolean, cw: number, ch: number): [number, number] {
      let sx = 0, sy = 0;
      if (joy) {
        const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy), m = Math.max(14, Math.min(cw, ch) * 0.09);
        if (d > 6) { sx = dx / Math.max(d, m); sy = dy / Math.max(d, m); }
      } else if (Math.hypot(pad.x, pad.y) > 0) { sx = pad.x; sy = pad.y; }
      else for (const k of tuslar) { const v = YON_TUSLARI[k]; sx += v[0]; sy += v[1]; }
      return ekranVektoru(sx, sy, portrait);
    },
    /** Şarj bitmeden tam güç: her adımda çağır. */
    guncelle() { if (sarjDurum && sarjDurum.a === 'sut' && sn() > SARJ_SUT_OTO_SN) ates(1, false); },
    sarj(): Sarj | null { if (!sarjDurum) return null; const t = sn(); return { a: sarjDurum.a, sn: t, oran: sarjOrani(sarjDurum.a, t), ara: sarjDurum.a === 'pas' && t > ARA_PAS_SN }; },
    /** Odak kaybı / kapanış: hiçbir şey takılı kalmasın. */
    birakHepsi() { tuslar.clear(); kosTus = false; sarjDurum = null; joy = null; pad.x = pad.y = 0; pad.kos = false; pad.onceki.clear(); },
  };
}
export type Girdi = ReturnType<typeof createGirdi>;

/** Pas hedefi önizlemesi: dümen yönüne (yoksa bakışa) en uygun takım arkadaşı; eski hedef bonus alır, halka titremez. */
export function pasHedefi(pls: readonly { x: number; y: number; team: number; gk: boolean; fx: number; fy: number }[], ctrl: number, ix: number, iy: number, onceki = -1): number {
  const p = pls[ctrl]; if (!p) return -1;
  const mv = Math.hypot(ix, iy) > 0.25, dx0 = mv ? ix : p.fx, dy0 = mv ? iy : p.fy, dl = Math.hypot(dx0, dy0) || 1;
  let best = -1, bs = -1e9;
  for (let i = 0; i < pls.length; i++) {
    const q = pls[i]; if (i === ctrl || q.team !== p.team || q.gk) continue;
    const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy); if (d < 1.5) continue;
    const s = (dx * dx0 + dy * dy0) / (d * dl) * 3 - d * 0.04 + (i === onceki ? 0.6 : 0);
    if (s > bs) { bs = s; best = i; }
  }
  return best;
}

/** Şut nişanı yazısı: çubuk yukarı/aşağı (saha y) hangi köşeyi seçer; çubuk boşta = kaleciden uzak köşe (motor). */
export function nisanYazi(iy: number, portrait: boolean): string {
  if (Math.abs(iy) <= 0.25) return 'Nişan: otomatik';
  return 'Nişan: ' + (portrait ? (iy > 0 ? 'sağ' : 'sol') : (iy > 0 ? 'alt' : 'üst')) + ' köşe';
}

/** Yardım kartı satırları (kaynağa göre). */
export function yardimSatirlari(k: Kaynak | 'hepsi' = 'hepsi'): string[] {
  const kl = ['WASD / oklar: koş', 'Shift: hızlı koş', 'Boşluk: pas (basılı tut: ara pas)', 'E: havadan uzun top', 'F: şut (basılı tut: güç, bırak: vur)', 'X: çalım', 'C: müdahale · Q: oyuncu değiştir'];
  const dk = ['Sol yarı: sürükle, koş', 'ŞUT: basılı tut, bırak (topsuzken müdahale)', 'PAS: dokun (basılı: ara pas, topsuzken değiştir)', 'ÇALIM: top sürerken hızlan'];
  const gp = ['Sol çubuk: koş · RT: hızlı koş', 'A: pas · B: şut (basılı: güç)', 'X: çalım · Y: oyuncu değiştir', 'LB: müdahale · RB: havadan uzun top'];
  return k === 'klavye' ? kl : k === 'dokunmatik' ? dk : k === 'gamepad' ? gp : [...kl, ...dk, ...gp];
}
