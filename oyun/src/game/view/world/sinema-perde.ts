/**
 * Sinema perdesine animasyon dizisi çizimi (2026-11-22 sahip: "sinemalar gerçek uzun animasyon, hikâyesi olsun, dizi gibi").
 * Veri content/sinema-dizi.ts; bu dosya yalnız 2B canvas'a çizer (three yok). Arka planlar (iskele, rıhtım, gece köprü,
 * çarşı, açık deniz, fırtına, ev içi, Kız Kulesi, gün batımı), karakterler (martılar, kedi, insanlar, konuşan midye), hareketler
 * (yürü, koş, uç, zıpla, konuş, üzgün, gül, dans), altyazı (daktilo), sahne geçişleri ve açılış / son kartları.
 * f: bölüm ilerlemesi (0..1, oyun saatinden), t: gerçek saniye (kanat çırpma, dalga, yağmur gibi canlılık).
 */
import { KARAKTER, anOf, type Arka, type Dizi, type Bolum, type Rol, type Sahne } from '../../../content/sinema-dizi';

type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const ease = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));

function sigdir(g: G, s: string, x: number, y: number, max: number) {
  const m = g.measureText(s).width; if (m <= max) { g.fillText(s, x, y); return; }
  g.save(); g.translate(x, y); g.scale(max / m, 1); g.fillText(s, 0, 0); g.restore();
}
function gok(g: G, W: number, H: number, ust: string, alt: string, yer = 1) { const gr = g.createLinearGradient(0, 0, 0, H * yer); gr.addColorStop(0, ust); gr.addColorStop(1, alt); g.fillStyle = gr; g.fillRect(0, 0, W, H * yer); }
function deniz(g: G, W: number, H: number, y0: number, renk: string, t: number, dalga = 1) {
  g.fillStyle = renk; g.fillRect(0, y0, W, H - y0);
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2;
  for (let j = 0; j < 4; j++) { const y = y0 + 8 + j * (H - y0) / 4.5; g.beginPath(); for (let x = 0; x <= W; x += 16) { const yy = y + Math.sin(x * 0.04 + t * 1.6 * dalga + j) * 3 * dalga; if (x) g.lineTo(x, yy); else g.moveTo(x, yy); } g.stroke(); }
}
function silu(g: G, W: number, y: number, renk: string, kay = 0) {   // tepeler, kubbeler ve minareler (uzak kıyı)
  g.fillStyle = renk; g.beginPath(); g.moveTo(0, y);
  for (let x = 0; x <= W; x += 40) g.lineTo(x, y - 14 - Math.sin((x + kay) * 0.013) * 10 - Math.sin((x + kay) * 0.031) * 5);
  g.lineTo(W, y + 2); g.lineTo(0, y + 2); g.fill();
  for (let i = 0; i < 4; i++) { const x = ((i * 170 + 60 - kay * 0.5) % (W + 80) + W + 80) % (W + 80) - 40; g.beginPath(); g.arc(x, y - 22, 14, Math.PI, 0); g.fill(); g.fillRect(x - 14, y - 22, 28, 10); g.fillRect(x + 20, y - 52, 4, 40); g.beginPath(); g.moveTo(x + 18, y - 52); g.lineTo(x + 22, y - 62); g.lineTo(x + 26, y - 52); g.fill(); }
}
function kule(g: G, x: number, y: number, s: number, renk: string) {   // Kız Kulesi benzeri: kaya, kule, külah
  g.fillStyle = '#4a4a52'; g.beginPath(); g.ellipse(x, y, 46 * s, 10 * s, 0, 0, TAU); g.fill();
  g.fillStyle = renk; g.fillRect(x - 22 * s, y - 34 * s, 44 * s, 34 * s); g.fillRect(x - 9 * s, y - 70 * s, 18 * s, 38 * s);
  g.beginPath(); g.moveTo(x - 12 * s, y - 70 * s); g.lineTo(x, y - 92 * s); g.lineTo(x + 12 * s, y - 70 * s); g.fill();
  g.fillStyle = '#ffe9a8'; for (let i = 0; i < 3; i++) g.fillRect(x - 15 * s + i * 11 * s, y - 24 * s, 5 * s, 8 * s);
}

function arka(g: G, a: Arka, W: number, H: number, t: number, kay: number) {
  const ufuk = H * 0.6;
  switch (a) {
    case 'iskele': {
      gok(g, W, H, '#7cc4f2', '#d8f0ff', 0.6); g.fillStyle = '#fff6c8'; g.beginPath(); g.arc(W * 0.82, H * 0.18, 18, 0, TAU); g.fill();
      silu(g, W, ufuk - 2, '#7d93a8'); deniz(g, W, H, ufuk, '#2f7fb3', t);
      g.fillStyle = '#8a5a3a'; g.fillRect(0, H * 0.78, W, H * 0.22); g.fillStyle = '#6f4529'; for (let x = 0; x < W; x += 36) g.fillRect(x, H * 0.78, 2, H * 0.22);
      g.fillStyle = '#3a2a20'; for (const x of [W * 0.08, W * 0.92]) { g.fillRect(x - 6, H * 0.72, 12, 22); g.fillRect(x - 9, H * 0.72, 18, 5); }
      break;
    }
    case 'rihtim': {
      gok(g, W, H, '#86c8f0', '#e2f4ff', 0.55); silu(g, W, H * 0.5, '#8aa0b4', kay * 30); deniz(g, W, H, H * 0.5, '#2c76a8', t);
      g.fillStyle = '#e9e4da'; g.fillRect(0, H * 0.74, W, H * 0.26); g.fillStyle = '#c7c0b2'; g.fillRect(0, H * 0.74, W, 4);
      g.fillStyle = '#ffffff'; for (let x = 10; x < W; x += 34) g.fillRect(x, H * 0.62, 4, H * 0.12); g.fillRect(0, H * 0.62, W, 4); g.fillRect(0, H * 0.68, W, 3);
      g.fillStyle = '#c0392b'; g.fillRect(W * 0.88, H * 0.42, 14, H * 0.2); g.fillStyle = '#1d1d22'; g.fillRect(W * 0.88, H * 0.42, 14, 6);   // fener direği
      break;
    }
    case 'gece': case 'gunbatimi': {
      const gece = a === 'gece';
      gok(g, W, H, gece ? '#0b1030' : '#f0884a', gece ? '#2a2a5a' : '#ffd38a', 0.62);
      if (gece) { g.fillStyle = '#fff'; for (let i = 0; i < 40; i++) { const x = (i * 97) % W, y = (i * 53) % (H * 0.5); g.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.3 + i)); g.fillRect(x, y, 2, 2); } g.globalAlpha = 1; g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(W * 0.8, H * 0.2, 16, 0, TAU); g.fill(); }
      else { g.fillStyle = '#ffef9a'; g.beginPath(); g.arc(W * 0.5, H * 0.56, 34, Math.PI, 0); g.fill(); }
      // asma köprü
      g.strokeStyle = gece ? '#1a1a30' : '#5a2a2a'; g.lineWidth = 6; g.beginPath(); g.moveTo(0, H * 0.48); g.lineTo(W, H * 0.48); g.stroke();
      g.lineWidth = 2; for (const px of [W * 0.25, W * 0.75]) { g.fillStyle = g.strokeStyle as string; g.fillRect(px - 5, H * 0.18, 10, H * 0.32); }
      g.beginPath(); g.moveTo(0, H * 0.3); g.quadraticCurveTo(W * 0.5, H * 0.52, W, H * 0.3); g.stroke();
      if (gece) { for (let x = 6; x < W; x += 22) { g.fillStyle = `hsl(${(x * 2 + t * 60) % 360},90%,65%)`; g.fillRect(x, H * 0.47, 4, 3); } }
      deniz(g, W, H, ufuk, gece ? '#121a40' : '#c8603a', t);
      if (!gece) { g.fillStyle = 'rgba(255,230,140,.45)'; for (let i = 0; i < 6; i++) g.fillRect(W * 0.5 - 30 + Math.sin(t + i) * 6, ufuk + 8 + i * 12, 60 - i * 6, 3); }
      g.fillStyle = gece ? '#2a2030' : '#6a3a2a'; g.fillRect(0, H * 0.8, W, H * 0.2);
      break;
    }
    case 'carsi': {
      g.fillStyle = '#e8d8b8'; g.fillRect(0, 0, W, H); g.fillStyle = '#c9a77a'; g.fillRect(0, H * 0.78, W, H * 0.22);
      for (let i = 0; i < 4; i++) {
        const x = i * W / 4 + 8, w = W / 4 - 16, c1 = ['#d63c3c', '#2f7fb3', '#49a35a', '#e8892b'][i];
        for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? '#ffffff' : c1; g.fillRect(x + k * w / 6, H * 0.18, w / 6, 26); }
        g.fillStyle = '#8a5a3a'; g.fillRect(x, H * 0.55, w, H * 0.23); g.fillStyle = '#5a3a24'; g.fillRect(x, H * 0.55, w, 5);
        for (let k = 0; k < 6; k++) { g.fillStyle = i % 2 ? '#c8d3da' : ['#f2c230', '#d63c3c', '#8fd06b'][k % 3]; g.beginPath(); g.ellipse(x + 10 + k * (w - 20) / 5, H * 0.53, i % 2 ? 12 : 7, i % 2 ? 4 : 7, 0, 0, TAU); g.fill(); }
      }
      break;
    }
    case 'deniz': case 'kule': {
      gok(g, W, H, a === 'kule' ? '#f6a86a' : '#78c0ee', a === 'kule' ? '#ffe2b0' : '#d8f0ff', 0.6);
      silu(g, W, ufuk - 2, a === 'kule' ? '#a0786a' : '#90a8bc', kay * 20); deniz(g, W, H, ufuk, a === 'kule' ? '#3a6e98' : '#2a78b0', t);
      kule(g, a === 'kule' ? W * 0.5 : W * 0.8, ufuk + (a === 'kule' ? 26 : 6), a === 'kule' ? 1.4 : 0.6, '#f2ead8');
      if (a === 'kule') { g.fillStyle = '#6a5a4a'; g.fillRect(0, H * 0.82, W, H * 0.18); }
      break;
    }
    case 'firtina': {
      gok(g, W, H, '#2a2f3a', '#56606e', 0.55); deniz(g, W, H, H * 0.55, '#1f3a4f', t, 3);
      // 2026-11-27 ışığa duyarlılık: fırtına filmindeki beyaz ekran flaşı (%55, ani) KALDIRILDI; yerine ağır, yavaş bir bulut kararması (en çok %12, 0.1 Hz)
      g.fillStyle = `rgba(20,24,34,${(0.06 + 0.06 * Math.sin(t * 0.63)).toFixed(3)})`; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(200,220,255,.5)'; g.lineWidth = 1.5; g.beginPath(); for (let i = 0; i < 70; i++) { const x = (i * 41 + t * 260) % W, y = (i * 67 + t * 420) % H; g.moveTo(x, y); g.lineTo(x - 6, y + 16); } g.stroke();
      g.fillStyle = '#e9e4da'; g.fillRect(0, H * 0.76, W, H * 0.24); g.fillStyle = '#ffffff'; g.fillRect(0, H * 0.64, W, 4); for (let x = 10; x < W; x += 34) g.fillRect(x, H * 0.64, 4, H * 0.12);
      break;
    }
    case 'ev': {
      g.fillStyle = '#f1dfc4'; g.fillRect(0, 0, W, H); g.fillStyle = '#c98a5a'; g.fillRect(0, H * 0.78, W, H * 0.22);
      g.fillStyle = '#7cc4f2'; g.fillRect(W * 0.6, H * 0.15, W * 0.25, H * 0.35); g.strokeStyle = '#8a5a3a'; g.lineWidth = 6; g.strokeRect(W * 0.6, H * 0.15, W * 0.25, H * 0.35); g.beginPath(); g.moveTo(W * 0.725, H * 0.15); g.lineTo(W * 0.725, H * 0.5); g.stroke();
      kule(g, W * 0.76, H * 0.46, 0.35, '#f2ead8');
      g.fillStyle = '#8a5a3a'; g.fillRect(W * 0.35, H * 0.62, W * 0.22, 8); g.fillRect(W * 0.37, H * 0.62, 6, H * 0.16); g.fillRect(W * 0.54, H * 0.62, 6, H * 0.16);
      g.fillStyle = '#c0392b'; g.fillRect(W * 0.42, H * 0.56, 10, 12); g.fillRect(W * 0.47, H * 0.56, 10, 12);   // çay bardakları
      break;
    }
  }
}

/** karakter: (x, y) ayak noktası, s ölçek, yon 1 / -1, a hareket, k: sahne içi ilerleme, t: saniye */
function karakter(g: G, rol: Rol, x: number, y: number, s: number, t: number, konusuyor: boolean) {
  const yon = rol.yon || 1, a = rol.a, faz = t * (a === 'kos' ? 12 : 7);
  let dy = 0;
  if (a === 'zipla') dy = -Math.abs(Math.sin(t * 5)) * 18 * s; else if (a === 'yuru' || a === 'kos') dy = -Math.abs(Math.sin(faz)) * 3 * s; else if (a === 'dans') dy = -Math.abs(Math.sin(t * 4)) * 8 * s; else dy = Math.sin(t * 2) * 1.2 * s;
  const sway = a === 'dans' ? Math.sin(t * 4) * 0.18 : a === 'gul' ? Math.sin(t * 18) * 0.05 : 0;
  g.save(); g.translate(x, y + dy); g.scale(yon * s, s); g.rotate(sway);
  const k = rol.k;
  if (k === 'kaptan' || k === 'yavru') {
    const uc = a === 'uc', c = k === 'yavru' ? 0.7 : 1; g.scale(c, c);
    if (uc) g.translate(0, -40 + Math.sin(t * 3) * 5);
    g.fillStyle = '#f4f4f0'; g.beginPath(); g.ellipse(0, -18, 20, 12, -0.1, 0, TAU); g.fill();   // gövde
    g.beginPath(); g.arc(16, -30, 9, 0, TAU); g.fill();   // baş
    g.fillStyle = '#f2a23a'; g.beginPath(); g.moveTo(24, -31); g.lineTo(34, -28); g.lineTo(24, -26); g.fill();   // gaga
    g.fillStyle = '#1d1d22'; g.beginPath(); g.arc(19, -32, 1.8, 0, TAU); g.fill();
    if (a === 'uzgun') { g.fillStyle = '#7cc4f2'; g.beginPath(); g.arc(20, -26 + (t * 20 % 10), 1.6, 0, TAU); g.fill(); }
    const kanat = uc ? Math.sin(t * 14) * 0.9 : -0.15;
    g.fillStyle = '#9aa5b0'; g.save(); g.translate(-2, -22); g.rotate(-kanat); g.beginPath(); g.ellipse(-10, -2, 16, 6, 0.2, 0, TAU); g.fill(); g.fillStyle = '#2a2d33'; g.beginPath(); g.ellipse(-22, 0, 6, 3, 0.2, 0, TAU); g.fill(); g.restore();
    g.fillStyle = '#9aa5b0'; g.beginPath(); g.moveTo(-18, -18); g.lineTo(-30, -14); g.lineTo(-18, -12); g.fill();   // kuyruk
    if (!uc) { g.strokeStyle = '#f2a23a'; g.lineWidth = 2.5; const ad = a === 'yuru' || a === 'kos' ? Math.sin(faz) * 5 : 0; g.beginPath(); g.moveTo(-2, -8); g.lineTo(-2 + ad, 0); g.moveTo(5, -8); g.lineTo(5 - ad, 0); g.stroke(); }
    if (k === 'kaptan') { g.fillStyle = '#1d2b55'; g.fillRect(8, -44, 18, 6); g.beginPath(); g.ellipse(17, -44, 10, 4, 0, Math.PI, 0); g.fill(); g.fillStyle = '#e9c46a'; g.fillRect(8, -42, 18, 2); g.fillRect(22, -40, 8, 2); }
    if (konusuyor) { g.fillStyle = '#f2a23a'; g.beginPath(); g.moveTo(24, -27); g.lineTo(32, -24 + Math.abs(Math.sin(t * 16)) * 3); g.lineTo(24, -25); g.fill(); }
  } else if (k === 'kedi') {
    g.fillStyle = '#e8892b'; g.beginPath(); g.ellipse(0, -16, 22, 12, 0, 0, TAU); g.fill();
    g.beginPath(); g.arc(20, -30, 11, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(12, -38); g.lineTo(14, -48); g.lineTo(19, -40); g.moveTo(22, -40); g.lineTo(28, -48); g.lineTo(29, -37); g.fill();
    g.strokeStyle = '#e8892b'; g.lineWidth = 5; g.beginPath(); g.moveTo(-20, -18); g.quadraticCurveTo(-34, -30 + Math.sin(t * 3) * 8, -26, -44 + Math.sin(t * 3) * 6); g.stroke();
    g.strokeStyle = '#b8601b'; g.lineWidth = 2; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-8 + i * 7, -27); g.lineTo(-5 + i * 7, -18); g.stroke(); }
    g.fillStyle = '#1d1d22'; g.beginPath(); g.arc(25, -32, 4.5, 0, TAU); g.fill(); g.fillRect(14, -36, 16, 1.5);   // göz bandı
    g.fillStyle = '#c9f27a'; g.beginPath(); g.arc(17, -31, 2, 0, TAU); g.fill();
    g.fillStyle = '#e8892b'; const ad = a === 'yuru' || a === 'kos' || a === 'dans' ? Math.sin(faz) * 5 : 0;
    for (const [lx, d2] of [[-12, ad], [-4, -ad], [8, -ad], [15, ad]]) g.fillRect(lx + d2 * 0.5, -8, 5, 8);
    if (konusuyor || a === 'gul') { g.fillStyle = '#5a1a1a'; g.beginPath(); g.ellipse(28, -25, 4, 1 + Math.abs(Math.sin(t * 14)) * 2.5, 0, 0, TAU); g.fill(); }
  } else if (k === 'mido') {
    g.fillStyle = '#1f2226'; g.beginPath(); g.ellipse(0, -16, 15, 18, 0.15, 0, TAU); g.fill();
    g.strokeStyle = '#3a4048'; g.lineWidth = 2; for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(0, -16, 15 - i * 4, 18 - i * 5, 0.15, 0.4, 2.6); g.stroke(); }
    g.fillStyle = '#e9a46a'; g.beginPath(); g.ellipse(3, -14, 7, 8, 0, 0, TAU); g.fill();
    g.fillStyle = '#fff'; for (const ex of [-3, 8]) { g.beginPath(); g.arc(ex, -26, 4.5, 0, TAU); g.fill(); } g.fillStyle = '#1d1d22'; for (const ex of [-2, 9]) { g.beginPath(); g.arc(ex, -26, 2, 0, TAU); g.fill(); }
    g.strokeStyle = '#5a1a1a'; g.lineWidth = 2; g.beginPath(); g.arc(3, -14, 4, 0.2, Math.PI - 0.2 + (konusuyor ? Math.sin(t * 16) * 0.4 : 0)); g.stroke();
  } else {   // insanlar
    const P: Record<string, { govde: string; sac: string; ten: string; uzun?: boolean; sapka?: string; tepsi?: boolean; ortu?: string }> = {
      simitci: { govde: '#f4f2ec', sac: '#3a2a20', ten: '#e8b98a', tepsi: true }, balikci: { govde: '#2f6f8f', sac: '#5a4030', ten: '#d9a070', sapka: '#c9a24a' },
      ayten: { govde: '#e0533c', sac: '#4a2a1a', ten: '#f0c8a0', uzun: true }, kerem: { govde: '#1d2b55', sac: '#2a1a10', ten: '#e0b088', sapka: '#f4f4f0' },
      nine: { govde: '#7d6bb0', sac: '#cfcfcf', ten: '#ecc8a8', ortu: '#e9c46a' }, kumpirci: { govde: '#e8892b', sac: '#1d1d22', ten: '#d9a070', sapka: '#f4f4f0' },
    };
    const p = P[k] || P.simitci, ad = a === 'yuru' || a === 'kos' ? Math.sin(faz) * 7 : a === 'dans' ? Math.sin(t * 4) * 5 : 0;
    g.strokeStyle = '#2a2d33'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(-4, -26); g.lineTo(-4 + ad, 0); g.moveTo(4, -26); g.lineTo(4 - ad, 0); g.stroke();
    g.fillStyle = p.govde; g.beginPath(); g.moveTo(-12, -26); g.lineTo(12, -26); g.lineTo(9, -60); g.lineTo(-9, -60); g.fill();
    if (p.uzun) { g.fillStyle = p.govde; g.beginPath(); g.moveTo(-14, -14); g.lineTo(14, -14); g.lineTo(11, -34); g.lineTo(-11, -34); g.fill(); }
    const kol = a === 'konus' || konusuyor ? Math.sin(t * 6) * 0.6 - 0.6 : a === 'gul' || a === 'dans' ? -2.2 + Math.sin(t * 8) * 0.3 : a === 'uzgun' ? 0.2 : Math.sin(faz) * 0.5;
    g.strokeStyle = p.govde; g.lineWidth = 5; g.beginPath(); g.moveTo(8, -56); g.lineTo(8 + Math.sin(kol + 0.3) * 18, -56 + Math.cos(kol + 0.3) * 18); g.moveTo(-8, -56); g.lineTo(-8 - Math.sin(-kol * 0.6 + 0.3) * 16, -56 + Math.cos(kol * 0.6 + 0.3) * 16); g.stroke();
    const bas = a === 'uzgun' ? 3 : 0;
    g.fillStyle = p.ten; g.beginPath(); g.arc(1, -70 + bas, 11, 0, TAU); g.fill();
    g.fillStyle = p.sac; if (p.ortu) { g.fillStyle = p.ortu; g.beginPath(); g.arc(1, -72 + bas, 13, Math.PI * 0.95, Math.PI * 2.05); g.fill(); g.fillRect(-12, -72 + bas, 6, 14); }
    else { g.beginPath(); g.arc(1, -73 + bas, 11, Math.PI, 0); g.fill(); if (p.uzun) g.fillRect(-11, -74 + bas, 7, 24); }
    if (p.sapka) { g.fillStyle = p.sapka; g.fillRect(-11, -84 + bas, 24, 6); g.fillRect(-6, -90 + bas, 14, 7); if (k === 'kerem') { g.fillStyle = '#1d2b55'; g.fillRect(-11, -82 + bas, 24, 2); } }
    g.fillStyle = '#1d1d22'; g.beginPath(); g.arc(6, -72 + bas, 1.6, 0, TAU); g.fill();
    if (a === 'uzgun') { g.fillStyle = '#7cc4f2'; g.beginPath(); g.arc(7, -67 + bas + (t * 18 % 9), 1.5, 0, TAU); g.fill(); }
    g.strokeStyle = '#5a1a1a'; g.lineWidth = 1.6; g.beginPath();
    if (konusuyor) g.ellipse(7, -64 + bas, 2.5, 1 + Math.abs(Math.sin(t * 15)) * 2, 0, 0, TAU); else if (a === 'gul' || a === 'dans') g.arc(6, -66 + bas, 3, 0.2, Math.PI - 0.2); else if (a === 'uzgun') g.arc(6, -61 + bas, 3, Math.PI + 0.3, -0.3); else { g.moveTo(4, -64); g.lineTo(9, -64); }
    g.stroke();
    if (p.tepsi) { g.fillStyle = '#8a5a3a'; g.fillRect(-16, -86, 34, 4); g.strokeStyle = '#c8833c'; g.lineWidth = 4; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(-10 + i * 8, -91, 4, 0, TAU); g.stroke(); } if (k === 'simitci') { g.strokeStyle = '#ffd23f'; g.beginPath(); g.arc(-10 + 12, -99, 5, 0, TAU); g.stroke(); } }
  }
  g.restore();
}

function altyazi(g: G, W: number, H: number, sahne: Sahne, ls: number) {
  const metin = sahne.soz, n = Math.min(metin.length, Math.floor(ls * 2.2 * metin.length) + 1), kim = sahne.kim ? KARAKTER[sahne.kim] : null;
  g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, H * 0.84, W, H * 0.16);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 ' + Math.round(H * 0.058) + 'px system-ui,"Segoe UI",sans-serif';
  const yazi = (kim ? kim.ad + ': ' : '') + metin.slice(0, n);
  g.fillStyle = kim ? kim.renk : '#f0f0f0'; sigdir(g, yazi, W / 2, H * 0.92, W - 30);
}

/** bir bölüm anını perdeye çizer */
export function perdeCiz(g: G, W: number, H: number, d: Dizi, no: number, b: Bolum, f: number, t: number): void {
  const an = anOf(f);
  g.save();
  if (an.tur === 'acilis') {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, d.renk); gr.addColorStop(1, '#0d0c16'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffcf5a'; g.font = '900 ' + Math.round(H * 0.17) + 'px system-ui,sans-serif'; sigdir(g, d.ad.toLocaleUpperCase('tr'), W / 2, H * 0.3, W - 40);
    g.fillStyle = '#fff'; g.font = '700 ' + Math.round(H * 0.08) + 'px system-ui,sans-serif'; sigdir(g, no + '. Bölüm · ' + b.ad, W / 2, H * 0.52, W - 40);
    g.fillStyle = '#d8d0f0'; g.font = 'italic 600 ' + Math.round(H * 0.055) + 'px system-ui,sans-serif'; sigdir(g, (no > 1 ? 'Önceki bölümde: ' : '') + b.ozet, W / 2, H * 0.72, W - 50);
    g.globalAlpha = 1 - ease(an.ls * 4); g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  } else {
    const sahne = b.sahneler[an.i], kay = an.ls;
    arka(g, sahne.arka, W, H, t, kay);
    const yer = sahne.arka === 'iskele' ? H * 0.84 : sahne.arka === 'rihtim' || sahne.arka === 'firtina' ? H * 0.82 : sahne.arka === 'carsi' || sahne.arka === 'ev' ? H * 0.84 : H * 0.86;
    const s = H / 260;
    for (const rol of sahne.roller) {
      const x = (rol.x + ((rol.x2 ?? rol.x) - rol.x) * ease(an.ls * 1.15)) * W, uc = rol.a === 'uc' && sahne.arka !== 'iskele' && sahne.arka !== 'carsi';
      karakter(g, rol, x, uc ? yer - H * 0.25 : yer, s * (rol.k === 'yavru' ? 1 : 1), t + rol.x * 7, sahne.kim === rol.k && an.tur === 'sahne');
    }
    altyazi(g, W, H, sahne, an.tur === 'son' ? 1 : an.ls);
    // sahne geçişi: kısa kararma
    const kenar = an.tur === 'sahne' ? Math.min(an.ls, 1 - an.ls) : 1; if (kenar < 0.05) { g.globalAlpha = 1 - kenar / 0.05; g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    if (an.tur === 'son') {
      g.globalAlpha = ease(an.ls * 2.5) * 0.85; g.fillStyle = '#0d0c16'; g.fillRect(0, 0, W, H); g.globalAlpha = ease(an.ls * 2.5);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffcf5a'; g.font = '800 ' + Math.round(H * 0.1) + 'px system-ui,sans-serif'; sigdir(g, 'Devamı bir sonraki seansta!', W / 2, H * 0.45, W - 40);
      g.fillStyle = '#fff'; g.font = '600 ' + Math.round(H * 0.06) + 'px system-ui,sans-serif'; sigdir(g, d.ad + ' · ' + (no % d.bolumler.length + 1) + '. Bölüm', W / 2, H * 0.6, W - 40);
    }
  }
  g.restore();
}
