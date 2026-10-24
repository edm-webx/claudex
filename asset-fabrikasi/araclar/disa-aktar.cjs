// Kullanım: node araclar/disa-aktar.cjs <fabrika klasörü> [id ...]
// Çıktı: glb/<id>.glb, onizleme/<id>.png, katalog.json. three yerelden okunur (node_modules/three).
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => {
  const root = path.resolve(process.argv[2] || '.'); const sadece = process.argv.slice(3);
  const three = path.join(root, 'node_modules', 'three');
  fs.mkdirSync(path.join(root, 'glb'), { recursive: true }); fs.mkdirSync(path.join(root, 'onizleme'), { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage(); p.on('pageerror', e => console.log('HATA', e.message));
  await p.route('**/*', r => { const u = new URL(r.request().url());
    if (u.hostname === 'cdn.jsdelivr.net') return r.fulfill({ body: fs.readFileSync(path.join(three, u.pathname.replace(/^\/npm\/three@[\d.]+\//, ''))), contentType: 'application/javascript' });
    if (u.hostname === 'x.local') { const f = path.join(root, u.pathname); return r.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.js') ? 'application/javascript' : 'text/html' }); }
    return r.abort(); });
  await p.goto('http://x.local/araclar/disa-aktar.html'); await p.waitForFunction(() => window.hazir, null, { timeout: 60000 });
  const liste = await p.evaluate(() => window.liste); const kat = [];
  for (const a of liste) { if (sadece.length && !sadece.includes(a.id)) continue;
    const o = await p.evaluate(id => window.tek(id), a.id);
    fs.writeFileSync(path.join(root, 'glb', a.id + '.glb'), Buffer.from(o.glb, 'base64'));
    fs.writeFileSync(path.join(root, 'onizleme', a.id + '.png'), Buffer.from(o.png.split(',')[1], 'base64'));
    kat.push({ ...a, boyut_m: o.boyut, glb: 'glb/' + a.id + '.glb', onizleme: 'onizleme/' + a.id + '.png' }); process.stdout.write(a.id + ' ');
  }
  if (!sadece.length) fs.writeFileSync(path.join(root, 'katalog.json'), JSON.stringify(kat, null, 1));
  await b.close(); console.log('\nbitti:', kat.length);
})();
