// KAL-12: tek komutla kalite kontrolü. `npm run qa` (tam) / `npm run qa:hizli` (derleme + tarayıcı yok).
// Her adım gerçek çıkış koduyla yargılanır; rapor calisma/qa-rapor.json dosyasına yazılır.
// `node tools/qa.mjs --kendini-sina`: bekçinin bekçisi. Bilerek başarısız bir adımın KIRMIZI sayıldığını doğrular.
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const hizli = args.includes('--hizli');
const sinama = args.includes('--kendini-sina');
const sh = (ad, cmd) => ({ ad, cmd });

export function calistir(adimlar) {
  const sonuc = [];
  for (const a of adimlar) {
    const t0 = Date.now();
    process.stdout.write(`▶ ${a.ad} … `);
    const r = spawnSync(a.cmd, { shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const ok = r.status === 0;
    const sn = +((Date.now() - t0) / 1000).toFixed(1);
    console.log(ok ? `tamam (${sn} sn)` : `KIRMIZI (${sn} sn)`);
    const out = ((r.stdout || '') + (r.stderr || '')).trim();
    if (!ok) console.log(out.split('\n').slice(-25).join('\n'));
    sonuc.push({ ad: a.ad, ok, sn, son: ok ? '' : out.split('\n').slice(-25).join('\n') });
  }
  return sonuc;
}

if (sinama) {
  const s = calistir([sh('bilerek-kirmizi', 'node -e "process.exit(3)"'), sh('bilerek-yesil', 'node -e "process.exit(0)"')]);
  const dogru = s[0].ok === false && s[1].ok === true;
  console.log(dogru ? 'Bekçi çalışıyor: kırmızı adım kırmızı, yeşil adım yeşil sayıldı.' : 'BEKÇİ BOZUK: çıkış koduna bakmıyor!');
  process.exit(dogru ? 0 : 1);
}

const adimlar = [
  sh('tip kontrolü', 'npx tsc --noEmit'),
  sh('sim kuralları', 'node tools/lint-sim.mjs'),
  sh('birim ve sim testleri', 'npx vitest run'),
];
if (!hizli) {
  adimlar.push(sh('derleme', 'npx vite build'), sh('paket sayfası', 'node tools/build-artifact.mjs'), sh('dist denetimi', 'node tools/check-dist.mjs'));
}
const sonuc = calistir(adimlar);
const gec = sonuc.every(s => s.ok);
mkdirSync('calisma', { recursive: true });
writeFileSync('calisma/qa-rapor.json', JSON.stringify({ schema: 1, mod: hizli ? 'hizli' : 'tam', gecti: gec, adimlar: sonuc }, null, 1));
console.log(gec ? '\nQA: HEPSİ YEŞİL' : '\nQA: KIRMIZI var → ' + sonuc.filter(s => !s.ok).map(s => s.ad).join(', '));
process.exit(gec ? 0 : 1);
