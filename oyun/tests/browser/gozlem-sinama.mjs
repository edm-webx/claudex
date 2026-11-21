// Gözlemcinin bekçisi (tarayıcısız): ornekleyici sahte bir sahnede kasıtlı bozuklukları yakalıyor mu, temiz sahnede rapor boş mu, şema doğrulanıyor mu.
// Kullanım: node tests/browser/gozlem-sinama.mjs   (tarayıcılı kasıtlı-bozuk fixture: node tests/browser/bot-gezgin.mjs --sina)
import { ornekleyici, ESIK, raporKur, raporuDogrula, sizintiVar, baselineKarsilastir } from './gozlem-lib.mjs';
const sahne = (n) => {
  const f = { x: new Float32Array(n), z: new Float32Array(n), speed: new Float32Array(n) }, u8 = { act: new Uint8Array(n), typeId: new Uint8Array(n) }, u16 = { flags: new Uint16Array(n) };
  const live = new Array(n).fill(true), solids = [];
  return { f, u8, u16, live, solids, M: { rules: { agents: { hi: n, f32: k => f[k], u8: k => u8[k], u16: k => u16[k], alive: i => live[i] },
    nav: { walkable: p => !solids.some(r => p.x >= r.x0 && p.x <= r.x1 && p.z >= r.z0 && p.z <= r.z1) } } } };
};
let hata = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'HATA ') + m); if (!c) hata++; };
const kos = (s, sn, ek) => { const g = ornekleyici(s.M, ESIK); for (let t = 0; t < sn * 4; t++) { ek?.(t); g.ornekle(0.25, { yer: 'sina' }); } return g; };
{ // temiz: yürüyen ajanlar
  const s = sahne(4); for (let i = 0; i < 4; i++) { s.u16.flags[i] = 1; s.u8.act[i] = 2; s.f.speed[i] = 1.2; }
  const g = kos(s, 30, () => { for (let i = 0; i < 4; i++) { s.f.x[i] += 0.3; s.f.z[i] = i * 3; } });
  ok(g.olay.length === 0, 'temiz sahne: bulgu yok (' + g.olay.length + ')');
}
{ // kasıtlı bozuk: ışınlanma, takılı, solid içi, T-pose, NaN
  const s = sahne(5); for (let i = 0; i < 5; i++) { s.u16.flags[i] = 1; s.u8.act[i] = 2; s.f.speed[i] = 1; s.f.x[i] = i * 5; }
  s.solids.push({ x0: 40, x1: 50, z0: -5, z1: 5 });
  const g = kos(s, 30, t => {
    s.f.x[0] += 0.3;                                  // sağlam
    if (t === 20) s.f.x[1] += 30;                      // ışınlanma
    /* 2: hiç kıpırdamıyor ama hız var -> takılı */
    s.f.x[3] = 45; s.f.z[3] = 0;                       // solid içinde
    s.u8.act[4] = 0; s.f.x[4] += 0.3;                  // T-pose
    if (t === 60) s.f.z[0] = NaN;
  });
  const t = new Set(g.olay.map(o => o.tur + ':' + o.slot));
  for (const k of ['isinlanma:1', 'takili:2', 'solidIcinde:3', 'tpose:4', 'nan:0']) ok(t.has(k), 'bozuk sahne yakalandı: ' + k);
}
{ // beyaz liste: oturan hareketsiz ajan alarm vermez
  const s = sahne(1); s.u16.flags[0] = 1 | 4; s.u8.act[0] = 7; s.f.speed[0] = 0.5; kos(s, 20); 
  ok(kos(s, 20).olay.length === 0, 'oturan ajan beyaz listede');
}
ok(sizintiVar([10, 20, 35, 50, 70, 90]) && !sizintiVar([40, 42, 38, 41, 40, 43]), 'sızıntı (sürekli artış) ayrımı');
const r = raporKur(); r.bulgular.push({ sev: 'bug', tur: 'x', yer: 'y', ne: 'z' }); r.olcum.push({ yer: 'a', saat: 13, calls: 100, tris: 1000, ms: 5 });
ok(raporuDogrula(r).length === 0, 'geçerli rapor şeması');
ok(raporuDogrula({ ...r, bulgular: [{ sev: 'x' }] }).length > 0, 'bozuk rapor reddedildi');
ok(baselineKarsilastir([{ yer: 'a', saat: 13, calls: 200, tris: 1000, ms: 5 }], { olcum: [{ yer: 'a', saat: 13, calls: 100, tris: 1000, ms: 5 }] })[0].kotu === true, 'baseline: çizim çağrısı 2x kötü sayıldı');
console.log(hata ? `\n${hata} HATA` : '\ngozlem-sinama: tamam'); process.exit(hata ? 1 : 0);
