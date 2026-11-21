/**
 * BUF-07 Mutfak canlılığı (görünüm). ic-mekan-look.ts'in mutfak odası için küçük, bağımsız parçalar: buhar/duman/kıvılcım
 * parçacık havuzu (tek Points, sabit bütçe, orman duman tekniğiyle aynı radyal sprite), davlumbaz fanı, asılı tavalar,
 * KDS fiş rayı (gerçek bilet verisi), duvar menü panosu + şef notu (menuPano(stage)), kirli tabak yığını, ıslak zemin tabelası.
 * Saf görünüm: sim'e yazmaz, çarpıcı/collider yok, çalışan figürü yok. Oda gizliyken (oyuncu dışarıda) güncelleme çağrılmaz.
 */
import * as T from 'three';
import { menuPano } from '../../../content/yemek-menu';

type Lm = (c: string) => T.Material;
export interface BiletVeri { no: number; masa: number; kalem: string[]; frac: number }

/* ---------- parçacık havuzu ---------- */
export const FX_MAX = 110;
/** istasyon başına saniyede çıkan parçacık: buhar (tencere/fritöz/çay), duman (ızgara/fırın/döner), kıvılcım (ızgara/fritöz) */
const EM: Record<string, { steam?: number; smoke?: number; spark?: number }> = {
  ocak: { steam: 5 }, ocak2: { steam: 5 }, izgara: { smoke: 4, spark: 5 }, izgara2: { smoke: 4, spark: 5 }, fritoz: { steam: 3.5, spark: 2.5 },
  tas_firin: { smoke: 3, spark: 1.5 }, doner: { smoke: 2.5, spark: 1 }, cay_bar: { steam: 3 }, sef_masa: { steam: 2 },
};
export interface FxEmit { id: string; u: number; v: number }
export interface MutfakFx { points: T.Points; update(dt: number, em: FxEmit[]): void }
export function createFx(seed: number): MutfakFx {
  const n = FX_MAX, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), siz = new Float32Array(n), alp = new Float32Array(n);
  const vel = new Float32Array(n * 3), life = new Float32Array(n), max = new Float32Array(n), kind = new Uint8Array(n);
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new T.BufferAttribute(siz, 1)); geo.setAttribute('aA', new T.BufferAttribute(alp, 1));
  const cv = document.createElement('canvas'); cv.width = cv.height = 48; const g = cv.getContext('2d')!;
  const gr = g.createRadialGradient(24, 24, 1, 24, 24, 23); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 48, 48);
  const tex = new T.CanvasTexture(cv);
  const mat = new T.PointsMaterial({ size: 1, map: tex, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true });
  mat.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float aSize;\nattribute float aA;\nvarying float vA;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvA = aA;').replace('gl_PointSize = size;', 'gl_PointSize = size * aSize;')
      .replace('size *= ( scale / - mvPosition.z );', 'size *= ( scale / - mvPosition.z );');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vA;').replace('#include <opaque_fragment>', 'gl_FragColor = vec4( outgoingLight, diffuseColor.a * vA );');
  };
  const points = new T.Points(geo, mat); points.frustumCulled = false; points.renderOrder = 3;
  let rs = (seed * 2654435761) >>> 0 || 1, cur = 0; const rnd = () => { rs ^= rs << 13; rs >>>= 0; rs ^= rs >>> 17; rs ^= rs << 5; rs >>>= 0; return rs / 4294967296; };
  const acc = new Map<string, number>();
  const spawn = (k: number, x: number, y: number, z: number) => {
    let i = -1; for (let s = 0; s < n; s++) { const j = (cur + s) % n; if (life[j] <= 0) { i = j; cur = j + 1; break; } }
    if (i < 0) return;   // havuz dolu: bütçe aşılmaz
    kind[i] = k; life[i] = max[i] = k === 2 ? 0.4 + rnd() * 0.35 : k === 1 ? 1.5 + rnd() * 0.8 : 1.2 + rnd() * 0.8;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    if (k === 2) { vel[i * 3] = (rnd() - 0.5) * 0.9; vel[i * 3 + 1] = 0.9 + rnd() * 1.1; vel[i * 3 + 2] = (rnd() - 0.2) * 0.8; const c = rnd() < 0.5 ? [1, 0.7, 0.25] : [1, 0.5, 0.15]; col.set(c, i * 3); }
    else { vel[i * 3] = (rnd() - 0.5) * 0.14; vel[i * 3 + 1] = 0.4 + rnd() * 0.25; vel[i * 3 + 2] = (rnd() - 0.3) * 0.1; if (k === 1) col.set([0.56, 0.57, 0.6], i * 3); else col.set([0.96, 0.97, 0.98], i * 3); }
  };
  return {
    points,
    update(dt, em) {
      const d = Math.min(dt, 0.1);
      for (const e of em) {
        const r = EM[e.id]; if (!r) continue;
        for (const [name, k, y] of [['steam', 0, 1.3], ['smoke', 1, 1.15], ['spark', 2, 1.05]] as const) {
          const rate = r[name]; if (!rate) continue; const key = e.id + name; let a = (acc.get(key) || 0) + rate * d;
          while (a >= 1) { a -= 1; spawn(k, e.u + (rnd() - 0.5) * 0.7, y, e.v + (rnd() - 0.3) * 0.25); }
          acc.set(key, a);
        }
      }
      for (let i = 0; i < n; i++) {
        if (life[i] <= 0) { alp[i] = 0; continue; }
        life[i] -= d; const k = 1 - life[i] / max[i], x = pos[i * 3];
        if (kind[i] === 2) { vel[i * 3 + 1] -= 4.2 * d; if (pos[i * 3 + 1] < 0.9) life[i] = 0; alp[i] = life[i] > 0 ? 1 - k : 0; siz[i] = 0.16; }
        else {
          vel[i * 3 + 1] += (kind[i] === 1 ? 0.05 : 0.12) * d; vel[i * 3] += Math.sin(i * 12.9 + k * 4) * 0.05 * d;
          const top = x > -8.6 && x < 0.6 ? 2.2 : 3.0;   // davlumbazın altında çekilir
          if (pos[i * 3 + 1] > top) life[i] = 0;
          alp[i] = (kind[i] === 1 ? 0.5 : 0.62) * Math.min(1, k * 6) * (1 - k * 0.85); siz[i] = (kind[i] === 1 ? 0.5 : 0.42) + k * (kind[i] === 1 ? 0.9 : 0.8);
        }
        pos[i * 3] += vel[i * 3] * d; pos[i * 3 + 1] += vel[i * 3 + 1] * d; pos[i * 3 + 2] += vel[i * 3 + 2] * d;
      }
      geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = geo.attributes.aSize.needsUpdate = geo.attributes.aA.needsUpdate = true;
    },
  };
}

/* ---------- davlumbaz fanı ve asılı tavalar ---------- */
const CYL4 = new T.CylinderGeometry(1, 1, 1, 4), PAN = new T.CylinderGeometry(1, 0.86, 1, 10), BLADE = new T.BoxGeometry(0.17, 0.06, 0.008), RING = new T.TorusGeometry(0.2, 0.018, 6, 18), DISC = new T.CircleGeometry(0.205, 18);
/** bunlar odalar arasında paylaşılır: kill() yok etmemeli */
export const FX_GEOS: T.BufferGeometry[] = [CYL4, PAN, BLADE, RING, DISC];

/** davlumbazın ön yüzünde dönen egzoz fanları (item çerçevesi: yüz +z); dönen grupları döndürür */
export function fanlar(host: T.Object3D, lm: Lm, w: number, y: number, z: number): T.Object3D[] {
  const out: T.Object3D[] = [], n = 3;
  for (let i = 0; i < n; i++) {
    const g = new T.Group(); g.position.set(-w / 2 + 2.0 + i * (w - 4.0) / (n - 1), y, z); host.add(g);
    const disc = new T.Mesh(DISC, lm('#23262b')); g.add(disc); const ring = new T.Mesh(RING, lm('#8a9098')); g.add(ring);
    const sp = new T.Group(); sp.position.z = 0.012; g.add(sp);
    for (let k = 0; k < 4; k++) { const b = new T.Mesh(BLADE, lm('#c9ced6')); b.position.set(Math.cos(k * Math.PI / 2) * 0.09, Math.sin(k * Math.PI / 2) * 0.09, 0); b.rotation.z = k * Math.PI / 2; sp.add(b); }
    out.push(sp);
  }
  return out;
}
/** rayda asılı tavalar: her biri kendi mafsalından salınır; döner: { o: mafsal, ph } */
export function asiliTavalar(host: T.Object3D, lm: Lm, w: number, y: number): { o: T.Object3D; ph: number }[] {
  const out: { o: T.Object3D; ph: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const x = -w / 2 + 0.6 + i * (w - 1.2) / 13, h = 0.2 + (i % 3) * 0.04, r = 0.07 + (i % 2) * 0.03;
    const piv = new T.Group(); piv.position.set(x, y, 0.05); host.add(piv);
    const hook = new T.Mesh(CYL4, lm('#9aa5b0')); hook.scale.set(0.006, 0.2, 0.006); hook.position.y = -0.1; piv.add(hook);
    const pan = new T.Mesh(PAN, lm(i % 3 ? '#8a9098' : '#b87333')); pan.scale.set(r, h, r); pan.position.y = -0.2 - h / 2 + 0.08; piv.add(pan);
    out.push({ o: piv, ph: i * 1.7 });
  }
  return out;
}

/* ---------- KDS fiş rayı ---------- */
export const BILET_SLOT = 7;
export interface BiletRayi { group: T.Group; set(b: BiletVeri[]): void }
/** rail: item çerçevesinde x ekseninde uzanan ray, altında BILET_SLOT asılı fiş. set(): gerçek biletler, geliş sırası (en eski solda) */
export function biletRayi(w: number, y: number): BiletRayi {
  const group = new T.Group(), pitch = w / BILET_SLOT, tw = pitch * 0.9, th = tw * 1.7;
  const rail = new T.Mesh(CYL4, new T.MeshLambertMaterial({ color: '#c9ced6' })); rail.scale.set(0.012, w, 0.012); rail.rotation.z = Math.PI / 2; rail.position.set(0, y, 0.13); group.add(rail);
  const slots: { m: T.Mesh; g: CanvasRenderingContext2D; tex: T.CanvasTexture; key: string }[] = [];
  const geo = new T.PlaneGeometry(tw, th);
  for (let i = 0; i < BILET_SLOT; i++) {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 218; const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
    const m = new T.Mesh(geo, new T.MeshBasicMaterial({ map: tex })); m.position.set(-w / 2 + pitch * (i + 0.5), y - 0.04 - th / 2, 0.15); m.rotation.z = (((i * 7) % 5) - 2) * 0.012; m.visible = false; group.add(m);
    slots.push({ m, g: cv.getContext('2d')!, tex, key: '' });
  }
  return {
    group,
    set(list) {
      const extra = Math.max(0, list.length - BILET_SLOT);
      for (let i = 0; i < BILET_SLOT; i++) {
        const s = slots[i], b = list[i]; s.m.visible = !!b; if (!b) { s.key = ''; continue; }
        const more = i === BILET_SLOT - 1 ? extra : 0, key = b.no + '|' + b.masa + '|' + b.kalem.join(',') + '|' + Math.round(b.frac * 5) + '|' + more; if (key === s.key) continue; s.key = key;
        const g = s.g; g.fillStyle = '#fbf7ea'; g.fillRect(0, 0, 128, 218);
        g.fillStyle = b.frac < 0.5 ? '#3f9a52' : b.frac < 0.8 ? '#e0a21a' : '#d03a2f'; g.fillRect(0, 0, 128, 40);
        g.fillStyle = '#fff'; g.font = '900 28px system-ui,sans-serif'; g.textBaseline = 'middle'; g.fillText('#' + b.no, 8, 21);
        g.fillStyle = '#23303b'; g.font = '800 23px system-ui,sans-serif'; g.fillText('Masa ' + b.masa, 8, 60, 112);
        g.fillRect(8, 76, 112, 2); g.font = '700 19px system-ui,sans-serif';
        b.kalem.slice(0, 5).forEach((t, k) => g.fillText(t, 8, 96 + k * 24, 112));
        if (b.kalem.length > 5) g.fillText('+' + (b.kalem.length - 5) + ' kalem', 8, 96 + 5 * 24, 112);
        if (more) { g.fillStyle = '#23303b'; g.fillRect(0, 196, 128, 22); g.fillStyle = '#ffd23f'; g.font = '800 15px system-ui,sans-serif'; g.fillText('+' + more + ' fiş daha', 8, 207, 112); }
        s.tex.needsUpdate = true;
      }
    },
  };
}

/* ---------- duvar menü panosu ve şef notu ---------- */
const SEF_NOTU = ['', 'Tezgâh temiz, çay taze.', 'Büfe açık: simit sıcak, ayran buz gibi.', 'Ocak yandı. Fiş gelince pass\'a bak.', 'Izgara köşesi hazır: et dinlenir, acele edilmez.',
  'Geniş mutfak: herkes kendi hattında kalsın.', 'Kahvaltı salonu: peynir ve zeytin en önde.', 'Lokanta ciddi iş: sıra fişte, fiş raydadır.', 'Akşam meze: soğuk soğuk, sıcak sıcak.', 'Ocakbaşı gecesi: ocak sönmeyecek.', 'Fine dining: tabak temiz, fiş sırası kutsal.'];
function sarar(g: CanvasRenderingContext2D, text: string, x: number, y: number, mw: number, lh: number) {
  let line = '', yy = y; for (const wd of text.split(' ')) { const t = line ? line + ' ' + wd : wd; if (g.measureText(t).width > mw && line) { g.fillText(line, x, yy); yy += lh; line = wd; } else line = t; } if (line) g.fillText(line, x, yy);
}
/** menü panosu (sol) + şef notu (sağ): aşamada açılan yemekler, sonraki aşamanın kilitli ipucu, 10 noktalı aşama takvimi */
export function menuPanosu(stage: number, w: number, y: number): T.Group {
  const grp = new T.Group(), bw = w * 0.76, bh = 0.86, nw = 0.62;
  const pano = menuPano(stage), cur = pano[Math.max(0, Math.min(9, stage - 1))], next = pano[stage] || null;
  const cv = document.createElement('canvas'); cv.width = 1100; cv.height = Math.round(1100 * bh / bw); const g = cv.getContext('2d')!;
  g.fillStyle = '#22302b'; g.fillRect(0, 0, cv.width, cv.height); g.strokeStyle = '#8a6a4a'; g.lineWidth = 8; g.strokeRect(4, 4, cv.width - 8, cv.height - 8);
  g.textBaseline = 'middle'; g.fillStyle = '#e8c860'; g.font = '900 46px system-ui,sans-serif'; g.fillText('GÜNÜN MENÜSÜ', 30, 44);
  g.fillStyle = '#cfe6d8'; g.font = '700 30px system-ui,sans-serif'; g.textAlign = 'right'; g.fillText('Aşama ' + cur.asama + ' · ' + cur.ad, cv.width - 30, 46); g.textAlign = 'left';
  g.fillStyle = '#7fa08c'; g.fillRect(30, 80, cv.width - 60, 3);
  const aciklar = pano.filter(a => a.acik).flatMap(a => a.yemekler.filter(d => d.acik)).reverse().slice(0, 8);   // en yeni açılanlar önde
  if (!aciklar.length) { g.fillStyle = '#cfe6d8'; g.font = '600 32px system-ui,sans-serif'; g.fillText('Tezgâh ürünleri: simit, çay, ayran, tost, gazoz, döner', 30, 150); }
  aciklar.forEach((d, i) => { const col = i % 2, row = Math.floor(i / 2), x = 30 + col * 540, yy = 122 + row * 52;
    g.fillStyle = '#f4ead2'; g.font = '700 30px system-ui,sans-serif'; g.fillText(d.ad, x, yy, 360); g.fillStyle = '#e8c860'; g.textAlign = 'right'; g.fillText(d.fiyat + ' ₺', x + 500, yy); g.textAlign = 'left'; });
  g.fillStyle = '#9fb5a8'; g.font = '600 26px system-ui,sans-serif';
  g.fillText(next ? 'Sonraki: Aşama ' + next.asama + ' · ' + next.ad + ' (+' + next.yemekler.length + ' yemek)' : 'Tüm menü açık', 30, cv.height - 62);
  for (let i = 1; i <= 10; i++) { g.fillStyle = i <= stage ? '#e8c860' : '#4a5d54'; g.beginPath(); g.arc(cv.width - 40 - (10 - i) * 34, cv.height - 62, 11, 0, 7); g.fill(); }
  const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
  const bx = -w / 2 + bw / 2 + 0.05;
  const frame = new T.Mesh(new T.BoxGeometry(bw + 0.1, bh + 0.1, 0.04), new T.MeshLambertMaterial({ color: '#5a3b2a' })); frame.position.set(bx, y, 0); grp.add(frame);
  const face = new T.Mesh(new T.PlaneGeometry(bw, bh), new T.MeshBasicMaterial({ map: tex })); face.position.set(bx, y, 0.025); grp.add(face);
  const nc = document.createElement('canvas'); nc.width = 250; nc.height = 280; const n = nc.getContext('2d')!;
  n.fillStyle = '#f6edc8'; n.fillRect(0, 0, 250, 280); n.fillStyle = '#d9c88a'; n.fillRect(0, 0, 250, 8); n.fillStyle = '#b0281e'; n.beginPath(); n.arc(125, 14, 9, 0, 7); n.fill();
  n.textBaseline = 'middle'; n.fillStyle = '#7a2a1d'; n.font = '900 28px system-ui,sans-serif'; n.fillText('ŞEF NOTU', 18, 48); n.fillStyle = '#3a2d1c'; n.font = 'italic 600 27px Georgia,serif'; sarar(n, SEF_NOTU[Math.max(1, Math.min(10, stage))], 18, 96, 214, 33);
  n.font = 'italic 700 24px Georgia,serif'; n.fillStyle = '#7a2a1d'; n.fillText('- Şef', 150, 256);
  const ntex = new T.CanvasTexture(nc); ntex.colorSpace = T.SRGBColorSpace;
  const note = new T.Mesh(new T.PlaneGeometry(nw, nw * 280 / 250), new T.MeshBasicMaterial({ map: ntex })); note.position.set(w / 2 - nw / 2 - 0.05, y, 0.03); note.rotation.z = -0.04; grp.add(note);
  return grp;
}

/* ---------- kirli tabak yığını ve ıslak zemin tabelası ---------- */
export const YIGIN_MAX = 14;
export interface TabakYigini { group: T.Group; set(n: number): void }
export function tabakYigini(lm: Lm, geo: T.BufferGeometry, yemekGeo: T.BufferGeometry): TabakYigini {
  const group = new T.Group(), ps: T.Object3D[] = [];
  for (let i = 0; i < YIGIN_MAX; i++) {
    const p = new T.Group(), d = new T.Mesh(geo, lm(i % 3 === 2 ? '#e4dccb' : '#efe8d8')); d.scale.setScalar(1.18); p.add(d);
    const f = new T.Mesh(yemekGeo, lm(['#8a5a3a', '#b8452a', '#c9a24a'][i % 3])); f.scale.set(0.09, 0.012, 0.07); f.position.set(((i * 5) % 7 - 3) * 0.012, 0.016, ((i * 3) % 5 - 2) * 0.012); p.add(f);
    p.position.set(((i * 7) % 5 - 2) * 0.006, i * 0.027, ((i * 3) % 5 - 2) * 0.006); p.rotation.y = i * 0.9; p.visible = false; group.add(p); ps.push(p);
  }
  return { group, set(n) { const k = Math.max(0, Math.min(YIGIN_MAX, Math.round(n))); ps.forEach((p, i) => { p.visible = i < k; }); } };
}
/** sarı A çerçeve "Kaygan zemin" tabelası + zemindeki ıslak leke; görünürlük dışarıdan (kir eşiği) */
export function islakTabela(): T.Group {
  const g = new T.Group(), cv = document.createElement('canvas'); cv.width = 128; cv.height = 256; const c = cv.getContext('2d')!;
  c.fillStyle = '#ffd400'; c.fillRect(0, 0, 128, 256); c.strokeStyle = '#1b1b1b'; c.lineWidth = 6; c.strokeRect(4, 4, 120, 248);
  c.fillStyle = '#1b1b1b'; c.beginPath(); c.moveTo(64, 28); c.lineTo(114, 118); c.lineTo(14, 118); c.closePath(); c.fill(); c.fillStyle = '#ffd400'; c.beginPath(); c.moveTo(64, 48); c.lineTo(100, 110); c.lineTo(28, 110); c.closePath(); c.fill();
  c.fillStyle = '#1b1b1b'; c.font = '900 56px system-ui,sans-serif'; c.textAlign = 'center'; c.fillText('!', 64, 100); c.font = '900 25px system-ui,sans-serif'; c.fillText('DİKKAT', 64, 156); c.font = '800 19px system-ui,sans-serif'; c.fillText('KAYGAN', 64, 190); c.fillText('ZEMİN', 64, 214);
  const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
  const body = new T.MeshLambertMaterial({ color: '#ffd400' }), face = new T.MeshBasicMaterial({ map: tex });
  for (const s of [1, -1]) {
    const piv = new T.Group(); piv.position.set(0, 0.6, 0); piv.rotation.x = -s * 0.2; g.add(piv);
    const panel = new T.Mesh(new T.BoxGeometry(0.3, 0.6, 0.014), body); panel.position.set(0, -0.3, s * 0.0); piv.add(panel);
    const pl = new T.Mesh(new T.PlaneGeometry(0.28, 0.58), face); pl.position.set(0, -0.3, s * 0.0085); if (s < 0) pl.rotation.y = Math.PI; piv.add(pl);
  }
  const puddle = new T.Mesh(new T.CircleGeometry(0.55, 20), new T.MeshBasicMaterial({ color: '#a9d6ea', transparent: true, opacity: 0.42, depthWrite: false }));
  puddle.rotation.x = -Math.PI / 2; puddle.scale.set(1.15, 0.8, 1); puddle.position.set(0.05, 0.012, 0.05); g.add(puddle);
  g.visible = false; return g;
}
