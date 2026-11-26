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
html,body{margin:0;height:100%;overflow:hidden;overscroll-behavior:none;background:#120806;touch-action:none;-webkit-user-select:none;user-select:none;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
#app{position:fixed;inset:0}
#c{display:block;width:100%;height:100%}
#fail{display:none;position:fixed;inset:0;z-index:1001;align-items:center;justify-content:center;padding:24px;text-align:center;background:#fdf3e1;color:#4a3524;font-size:18px;line-height:1.4}
#yukle{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:radial-gradient(120% 90% at 70% 0%,#5a2a12 0%,#2a1209 45%,#120806 100%);color:#fff1d6;transition:opacity .6s ease}
#yukle.yk-bitti{opacity:0;pointer-events:none}
.yk-kart{display:flex;flex-direction:column;align-items:center;gap:16px;padding:16px;text-align:center}
.yk-k{font:700 13px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;letter-spacing:.5em;color:#f6dcb0;margin-left:.5em}
.yk-ad{font:900 64px/1 "Arial Rounded MT Bold","Segoe UI",system-ui,sans-serif;letter-spacing:-.01em;background:linear-gradient(180deg,#fff4d6,#ffd27a 45%,#e8952f);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 3px 0 #6b2f12) drop-shadow(0 10px 26px rgba(255,140,40,.4))}
.yk-cubuk{width:min(280px,70vw);height:4px;margin-top:10px;border-radius:4px;background:rgba(255,214,160,.16);overflow:hidden}
.yk-cubuk i{display:block;height:100%;width:calc(var(--y,0) * 100%);min-width:12%;border-radius:4px;background:linear-gradient(90deg,#ffd27a,#ff8a3d);box-shadow:0 0 12px #ffb04a;transition:width .35s;animation:yk 1.6s ease-in-out infinite alternate}
#yukle.yk-gercek .yk-cubuk i{animation:none}
@keyframes yk{from{width:12%}to{width:34%}}
.yk-yazi{font:500 13px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;letter-spacing:.2em;color:rgba(255,226,190,.6);text-transform:uppercase}
.yk-st{position:absolute;bottom:28px;left:0;right:0;font:600 11px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;letter-spacing:.4em;color:rgba(255,226,190,.4)}
</style>
<div id="app"><canvas id="c"></canvas></div>
<div id="yukle"><div class="yk-kart"><div class="yk-k">SABRİ'NİN</div><div class="yk-ad">Büfesi</div><div class="yk-cubuk"><i></i></div><div class="yk-yazi">Yükleniyor</div></div><div class="yk-st">EDMX STUDIOS</div></div>
<div id="fail">Bu cihazda 3B görüntü açılamadı. Tarayıcını güncelleyip tekrar dene.</div>
<script src="game.js"></script>
`;
writeFileSync(join(dist, 'index.html'), html);
// Kenney CC0 models (cars, buildings, trees): public/modeller -> dist/modeller
if (existsSync('public/modeller')) cpSync('public/modeller', join(dist, 'modeller'), { recursive: true });
// Poly Haven CC0 ground textures: public/doku -> dist/doku
if (existsSync('public/doku')) cpSync('public/doku', join(dist, 'doku'), { recursive: true });
// Ses: gerçek kayıtlar (CC0, Opus): public/ses -> dist/ses (ses-db loops/tracks `file` alanı; yoksa sentez yedek)
if (existsSync('public/ses')) cpSync('public/ses', join(dist, 'ses'), { recursive: true });
console.log('build-artifact: dist/index.html written');
