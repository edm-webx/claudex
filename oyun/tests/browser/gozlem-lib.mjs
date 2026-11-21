// Gezgin gözlemci ortak parçaları (DNY-14). Saf JS: tarayıcıda da (ornekleyici sayfaya enjekte edilir) Node'da da (gozlem-sinama.mjs) çalışır.
// Yalnız bulguları listeler; oyunu düzeltmez. Rapor: calisma/gozlem-rapor.json, baseline: calisma/gozlem-baseline.json.

export const SCHEMA = 1;
export const ESIK = { ziplama: 3, hareketsizSn: 8, hareketsizMesafe: 0.05, solidArdisik: 4, hizli: 0.3, sizintiArtis: 40 };

// Sayfa içi örnekleyici: SoA ajanlarını (window.__marti.rules.agents) her örnekte tarar. Kendi içinde bağımsız olmalı (toString ile enjekte).
export function ornekleyici(M, esik) {
  const ACT_NONE = 0, F = { visible: 1, customer: 2, seated: 4, queued: 8, leaving: 16, hero: 32, ambient: 64, group: 128, persistent: 256, scenery: 512 };
  const olay = [], onceki = new Map(), solidSay = new Map(), sayac = { ornek: 0, ajanOrnek: 0 };
  const gor = new Set();   // aynı (tür,ajan) bir kez raporlanır
  const ekle = (tur, slot, ayrinti, t) => { const k = tur + ':' + slot; if (gor.has(k)) return; gor.add(k); olay.push({ tur, slot, t: +t.toFixed(2), ...ayrinti }); };
  const sizinti = [];
  let t = 0;
  const bekle = f => (f & (F.seated | F.queued | F.scenery | F.hero)) !== 0;   // beyaz liste: bilerek hareketsiz/oturan/sahne karakteri
  return {
    olay, sayac, sizinti,
    ornekle(dt, yer) {
      t += dt; sayac.ornek++;
      const A = M.rules.agents, nav = M.rules.nav, x = A.f32('x'), z = A.f32('z'), act = A.u8('act'), sp = A.f32('speed'), fl = A.u16('flags'), ty = A.u8('typeId');
      let canli = 0;
      for (let i = 0; i < A.hi; i++) {
        if (!A.alive(i)) { onceki.delete(i); solidSay.delete(i); continue; }
        canli++; sayac.ajanOrnek++;
        const f = fl[i], p = { x: x[i], z: z[i] }, w = { slot: i, tip: ty[i], bayrak: f, ...yer };
        if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) { ekle('nan', i, { ...w }, t); continue; }
        const o = onceki.get(i);
        if (o && o.tip === ty[i]) {
          const d = Math.hypot(p.x - o.x, p.z - o.z);
          if (d > esik.ziplama) ekle('isinlanma', i, { ...w, mesafe: +d.toFixed(2), dt: +dt.toFixed(2), from: { x: +o.x.toFixed(1), z: +o.z.toFixed(1) }, to: { x: +p.x.toFixed(1), z: +p.z.toFixed(1) } }, t);
          if (d < esik.hareketsizMesafe && sp[i] > esik.hizli && !bekle(f)) {
            o.dur += dt; if (o.dur >= esik.hareketsizSn) ekle('takili', i, { ...w, sn: +o.dur.toFixed(1), hiz: +sp[i].toFixed(2), konum: { x: +p.x.toFixed(1), z: +p.z.toFixed(1) } }, t);
          } else o.dur = 0;
          o.x = p.x; o.z = p.z;
        } else onceki.set(i, { x: p.x, z: p.z, tip: ty[i], dur: 0 });
        if (!bekle(f) && (f & F.visible)) {
          if (!nav.walkable(p)) { const n = (solidSay.get(i) || 0) + 1; solidSay.set(i, n); if (n >= esik.solidArdisik) ekle('solidIcinde', i, { ...w, konum: { x: +p.x.toFixed(1), z: +p.z.toFixed(1) } }, t); } else solidSay.set(i, 0);
          if (act[i] === ACT_NONE && sp[i] > esik.hizli) ekle('tpose', i, { ...w, hiz: +sp[i].toFixed(2) }, t);
        }
      }
      return canli;
    },
    sifirla() { onceki.clear(); solidSay.clear(); },   // bölge/ışınlanma sonrası: slotlar yeniden kullanılır, eski konumlarla kıyaslama yanlış alarm verir
    sizintiOrnek(n) { sizinti.push(n); },
    bosAjan() { return olay.length === 0; },
  };
}

export function sizintiVar(seri, esik = ESIK.sizintiArtis) {
  if (seri.length < 4) return false;
  let artan = 0; for (let i = 1; i < seri.length; i++) if (seri[i] >= seri[i - 1]) artan++;
  return seri[seri.length - 1] - seri[0] >= esik && artan >= (seri.length - 1) * 0.9;
}

export function raporKur() { return { schema: SCHEMA, zaman: new Date().toISOString(), mod: '', ozet: {}, bolgeler: [], bulgular: [], baseline: { karsilastirma: [] }, olcum: [] }; }

const SEV = ['bug', 'warn', 'perf', 'info'];
export function raporuDogrula(r) {
  const h = [];
  if (r.schema !== SCHEMA) h.push('schema');
  for (const k of ['bolgeler', 'bulgular', 'olcum']) if (!Array.isArray(r[k])) h.push(k + ' dizi değil');
  for (const b of r.bulgular || []) {
    if (!SEV.includes(b.sev)) h.push('sev: ' + b.sev);
    if (typeof b.tur !== 'string' || typeof b.yer !== 'string' || typeof b.ne !== 'string') h.push('bulgu alanları: ' + JSON.stringify(b));
  }
  for (const o of r.olcum || []) if (!o.yer || !Number.isFinite(o.calls) || !Number.isFinite(o.tris)) h.push('olcum alanları: ' + JSON.stringify(o));
  return h;
}

// Baseline karşılaştırması: çizim çağrısı/üçgen deterministik (aynı tohum+saat+yer), süre ms yalnızca göreli (SwiftShader).
export function baselineKarsilastir(olcum, base, tol = { calls: 0.25, tris: 0.25, ms: 1.0 }) {
  const out = [];
  for (const o of olcum) {
    const b = base?.olcum?.find(q => q.yer === o.yer && q.saat === o.saat);
    if (!b) continue;
    const oran = (a, c) => (c > 0 ? a / c - 1 : 0);
    const d = { yer: o.yer, saat: o.saat, calls: +oran(o.calls, b.calls).toFixed(3), tris: +oran(o.tris, b.tris).toFixed(3), ms: o.ms != null && b.ms ? +oran(o.ms, b.ms).toFixed(3) : null };
    d.kotu = d.calls > tol.calls || d.tris > tol.tris || (d.ms != null && d.ms > tol.ms);
    out.push(d);
  }
  return out;
}
