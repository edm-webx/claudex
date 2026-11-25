// Tripo ile yapay zekâ 3D model üretimi (2026-11-25). Oyuna DOĞRUDAN GİRMEZ: önce önizleme, kullanıcı onayı, sonra entegrasyon.
// Kullanım: TRIPO_API_KEY=... node tripo.mjs <ad> "<açıklama>" [referans.png]   -> cikti/<ad>.glb + cikti/<ad>.json
// Gereken: ortamda api.tripo3d.ai izinli ve TRIPO_API_KEY tanımlı.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
const KEY = process.env.TRIPO_API_KEY; if (!KEY) { console.error('TRIPO_API_KEY yok'); process.exit(1); }
const [ad, prompt, ref] = process.argv.slice(2); if (!ad || !prompt) { console.error('kullanım: node tripo.mjs <ad> "<açıklama>" [ref.png]'); process.exit(1); }
const API = 'https://api.tripo3d.ai/v2/openapi', H = { Authorization: `Bearer ${KEY}` };
const j = async (r) => { const t = await r.text(); let o; try { o = JSON.parse(t); } catch { throw new Error(`${r.status} ${t.slice(0, 300)}`); } if (o.code !== 0) throw new Error(JSON.stringify(o).slice(0, 400)); return o.data; };
let task;
if (ref) {
  const fd = new FormData(); fd.append('file', new Blob([readFileSync(ref)], { type: 'image/png' }), 'ref.png');
  const up = await j(await fetch(`${API}/upload`, { method: 'POST', headers: H, body: fd }));
  task = { type: 'image_to_model', file: { type: 'png', file_token: up.image_token } };
} else task = { type: 'text_to_model', prompt };
task.texture = true; task.pbr = true;
const { task_id } = await j(await fetch(`${API}/task`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify(task) }));
console.log('görev', task_id);
let d; for (;;) { await new Promise(r => setTimeout(r, 5000)); d = await j(await fetch(`${API}/task/${task_id}`, { headers: H })); process.stdout.write(`\r${d.status} ${d.progress ?? ''}%   `); if (['success', 'failed', 'cancelled', 'banned', 'expired'].includes(d.status)) break; }
console.log(); if (d.status !== 'success') { console.error('başarısız', d.status); process.exit(1); }
const url = d.output?.pbr_model || d.output?.model || d.result?.pbr_model?.url || d.result?.model?.url;
mkdirSync('cikti', { recursive: true });
writeFileSync(`cikti/${ad}.glb`, Buffer.from(await (await fetch(url)).arrayBuffer()));
writeFileSync(`cikti/${ad}.json`, JSON.stringify({ ad, prompt, ref: ref || null, task_id, tarih: new Date().toISOString() }, null, 2));
console.log('yazıldı', `cikti/${ad}.glb`);
