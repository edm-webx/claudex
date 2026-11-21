// Owner: Builder A. Runs after `vite build`: writes dist/index.html in page-contract form (MOTOR §1):
// no doctype/html/head/body, <title> first, base <style>, #app > canvas#c, hidden #fail, classic <script src="game.js">.
// Copies dist/img/** untouched if present (art atlases). Never deletes dist files other builders' tools wrote.
import { writeFileSync, existsSync, cpSync } from 'node:fs';
import { join } from 'node:path';

const dist = process.env.MARTI_DIST || 'dist';
if (!existsSync(join(dist, 'game.js'))) { console.error('build-artifact: dist/game.js missing (run vite build first)'); process.exit(1); }

const html = `<title>Sabri'nin Büfesi</title>
<meta charset="utf-8">
<link rel="icon" href="data:,">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<style>
html,body{margin:0;height:100%;overflow:hidden;overscroll-behavior:none;background:#c6e3f2;touch-action:none;-webkit-user-select:none;user-select:none;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
#app{position:fixed;inset:0}
#c{display:block;width:100%;height:100%}
#fail{display:none;position:fixed;inset:0;z-index:1001;align-items:center;justify-content:center;padding:24px;text-align:center;background:#fdf3e1;color:#4a3524;font-size:18px;line-height:1.4}
#yukle{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:#173a44;color:#fff1d6;transition:opacity .4s}
#yukle.yk-bitti{opacity:0;pointer-events:none}
.yk-kart{display:flex;flex-direction:column;align-items:center;gap:14px;padding:16px}
.yk-ad{font-size:30px;font-weight:800;letter-spacing:.5px}
.yk-cubuk{width:min(300px,72vw);height:12px;border-radius:7px;background:rgba(255,255,255,.16);overflow:hidden}
.yk-cubuk i{display:block;height:100%;width:calc(var(--y,0) * 100%);min-width:12%;border-radius:7px;background:#f0a23a;transition:width .35s;animation:yk 1.6s ease-in-out infinite alternate}
#yukle.yk-gercek .yk-cubuk i{animation:none}
@keyframes yk{from{width:12%}to{width:34%}}
.yk-yazi{font-size:16px;opacity:.85}
</style>
<div id="app"><canvas id="c"></canvas></div>
<div id="yukle"><div class="yk-kart"><div class="yk-ad">Sabri'nin Büfesi</div><div class="yk-cubuk"><i></i></div><div class="yk-yazi">Yükleniyor…</div></div></div>
<div id="fail">Bu cihazda 3B görüntü açılamadı. Tarayıcını güncelleyip tekrar dene.</div>
<script src="game.js"></script>
`;
writeFileSync(join(dist, 'index.html'), html);
// Kenney CC0 models (cars, buildings, trees): public/modeller -> dist/modeller
if (existsSync('public/modeller')) cpSync('public/modeller', join(dist, 'modeller'), { recursive: true });
// Poly Haven CC0 ground textures: public/doku -> dist/doku
if (existsSync('public/doku')) cpSync('public/doku', join(dist, 'doku'), { recursive: true });
console.log('build-artifact: dist/index.html written');
