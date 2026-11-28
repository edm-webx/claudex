// @ts-nocheck
/* eslint-disable */
// Morgdan Kaçış: Sabri'nin Büfesi'nin içindeki korku oyunu. ÜRETİLMİŞ DOSYA, elle düzenleme.
// Kaynak: /mnt/project-files/sosisci-oyun/morg-kacis-2026-11-27/v3/ (assemble.py). Kendi canvas'ı ve shadow DOM'u var; çıkışta her şeyi temizler.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const CSS = "\n/* Layout: full-screen WebGL game; a single dark world (deliberately single-theme). */\n#morg-root { --ink: #dfe8e4; --dim: #8aa39b; --amber: #ffbf73; --deep: #05080b; --panel: rgba(6,10,12,.78); --line: rgba(190,220,210,.18);\n  --serif: Georgia, 'Times New Roman', serif; --sans: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color-scheme: dark; }\n#morg-root { height: 100%; margin: 0; background: var(--deep); color: var(--ink); overflow: hidden; touch-action: none; -webkit-user-select: none; user-select: none; }\ncanvas { display: block; position: fixed; inset: 0; width: 100%; height: 100%; }\n[hidden] { display: none !important; }\n#fade { position: fixed; inset: 0; background: #000; opacity: 1; pointer-events: none; transition: opacity 1.2s ease; z-index: 5; }\n#hud { position: fixed; inset: 0; pointer-events: none; z-index: 4; font-family: var(--sans); }\n#prompt { position: absolute; left: 50%; top: 63%; transform: translateX(-50%); font: 600 15px var(--sans); letter-spacing: .5px; color: var(--ink); background: var(--panel); border: 1px solid var(--line); padding: 8px 14px; border-radius: 6px; white-space: nowrap; max-width: 90vw; overflow: hidden; text-overflow: ellipsis; }\n#sub { position: absolute; left: 50%; bottom: calc(6% + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); width: min(720px, 86vw); text-align: center; font: italic 400 18px/1.45 var(--serif); color: #e9efe9; text-shadow: 0 2px 6px #000; transition: opacity .8s; }\n#tl { position: absolute; top: calc(14px + env(safe-area-inset-top, 0px)); right: max(16px, env(safe-area-inset-right, 0px)); display: flex; gap: 14px; align-items: center; font: 600 12px var(--sans); letter-spacing: 2px; color: var(--dim); text-transform: uppercase; }\n#bat { width: 54px; height: 6px; border: 1px solid var(--line); border-radius: 3px; overflow: hidden; }\n#bat i { display: block; height: 100%; width: 100%; background: var(--amber); opacity: .8; }\n#chap { position: absolute; top: calc(14px + env(safe-area-inset-top, 0px)); left: max(16px, env(safe-area-inset-left, 0px)); font: 600 12px var(--sans); letter-spacing: 2px; color: var(--dim); text-transform: uppercase; }\n#saved { display: block; margin-top: 6px; color: var(--amber); opacity: 0; transition: opacity .8s; }\n#card { position: absolute; left: 50%; top: 20%; transform: translateX(-50%); width: min(440px, 84vw); background: #d9d3bf; color: #24221c; border-radius: 4px; padding: 18px 22px; font: 400 16px/1.5 var(--serif); box-shadow: 0 20px 60px rgba(0,0,0,.6); opacity: 0; transition: opacity .6s; }\n#card b { display: block; font: 700 12px var(--sans); letter-spacing: 3px; text-transform: uppercase; color: #6a6252; margin-bottom: 6px; }\n#breath { position: absolute; left: 50%; top: 58%; transform: translateX(-50%); width: 160px; height: 4px; background: rgba(255,255,255,.12); border-radius: 2px; overflow: hidden; opacity: 0; transition: opacity .4s; }\n#breath i { display: block; height: 100%; width: 100%; background: #9fd0e0; }\n#dot { position: absolute; left: 50%; top: 50%; width: 4px; height: 4px; margin: -2px; border-radius: 50%; background: rgba(230,240,235,.55); }\n.scr { position: fixed; inset: 0; z-index: 8; display: flex; align-items: center; justify-content: center; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); background: radial-gradient(ellipse at 50% 40%, rgba(20,34,36,.55), rgba(2,4,6,.94) 70%); font-family: var(--sans); overflow-y: auto; }\n.box { width: min(560px, 100%); padding-block: 24px; margin: auto; }\n.box h1 { font: 400 clamp(32px, 7vw, 54px)/1 var(--serif); letter-spacing: 8px; text-transform: uppercase; margin: 0 0 6px; color: #eef3f1; }\n.box h2 { font: 400 clamp(26px, 5vw, 38px)/1.1 var(--serif); letter-spacing: 4px; margin: 0 0 6px; color: #eef3f1; }\n.box .k { font: 600 12px var(--sans); letter-spacing: 3px; color: var(--dim); text-transform: uppercase; margin-bottom: 18px; }\n.box p { font: 400 15px/1.6 var(--serif); color: #c7d3cf; margin: 0 0 18px; max-width: 60ch; }\n.row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 10px; }\n.row span { font: 600 11px var(--sans); letter-spacing: 2px; color: var(--dim); text-transform: uppercase; width: 120px; }\n.opt { background: transparent; border: 1px solid var(--line); color: var(--ink); font: 600 13px var(--sans); padding: 7px 12px; border-radius: 4px; cursor: pointer; }\n.opt[aria-pressed=\"true\"] { border-color: var(--amber); color: var(--amber); }\n.opt:disabled { opacity: .35; cursor: default; }\n.chaps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 4px 0 12px; }\n.chaps .opt { padding: 8px 4px; font-size: 11px; letter-spacing: .5px; text-align: center; line-height: 1.3; }\n.chaps .opt small { display: block; color: var(--dim); font-weight: 500; }\n.btns { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }\n.go { background: var(--amber); color: #1c1306; border: 0; font: 700 14px var(--sans); letter-spacing: 3px; text-transform: uppercase; padding: 13px 26px; border-radius: 4px; cursor: pointer; }\n.go.ghost { background: transparent; color: var(--ink); border: 1px solid var(--line); }\n.go:focus-visible, .opt:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }\n.keys { font: 400 13px/1.7 var(--sans); color: var(--dim); margin-top: 14px; }\n.keys kbd { font: 600 11px var(--sans); border: 1px solid var(--line); border-radius: 3px; padding: 1px 5px; color: var(--ink); }\n#story { position: fixed; inset: 0; z-index: 9; background: #000; display: flex; align-items: center; justify-content: center; padding: 0 max(24px, env(safe-area-inset-left, 0px)); }\n#storyT { width: min(640px, 100%); text-align: center; font: italic 400 clamp(18px, 2.6vw, 24px)/1.6 var(--serif); color: #dfe6e2; opacity: 0; transition: opacity 1s ease; }\n#storyT.names { font: 400 clamp(14px, 1.8vw, 17px)/1.9 var(--serif); font-style: normal; color: #cfd8d3; columns: 2; column-gap: 28px; text-align: left; }\n#skip { position: absolute; right: max(16px, env(safe-area-inset-right, 0px)); bottom: calc(16px + env(safe-area-inset-bottom, 0px)); }\n/* touch controls */\n#touch { position: fixed; inset: 0; z-index: 6; pointer-events: none; }\n#touch .b { position: absolute; pointer-events: auto; width: 64px; height: 64px; border-radius: 50%; border: 1.5px solid rgba(220,235,230,.35); background: rgba(10,16,18,.35); color: rgba(235,242,240,.85); font: 700 11px var(--sans); letter-spacing: 1px; display: flex; align-items: center; justify-content: center; text-transform: uppercase; }\n#touch .b.on { border-color: var(--amber); color: var(--amber); }\n#stick { position: absolute; width: 110px; height: 110px; margin: -55px; border-radius: 50%; border: 1.5px solid rgba(220,235,230,.25); display: none; }\n#stick i { position: absolute; left: 50%; top: 50%; width: 46px; height: 46px; margin: -23px; border-radius: 50%; background: rgba(220,235,230,.28); }\n@media (max-width: 760px) { #tl { top: calc(34px + env(safe-area-inset-top, 0px)); left: max(16px, env(safe-area-inset-left, 0px)); right: auto; gap: 10px; letter-spacing: 1px; } }\n@media (prefers-reduced-motion: reduce) { #fade, #card, #saved, #storyT, #sub { transition-duration: .01s; } }\n";
const HTML = "\n\n<div id=\"fade\"></div>\n<div id=\"hud\" hidden>\n  <div id=\"dot\"></div>\n  <div id=\"chap\"><span id=\"chapT\"></span><span id=\"saved\">Kaydedildi</span></div>\n  <div id=\"tl\"><span id=\"obj\"></span><span id=\"bt\" hidden></span><span id=\"kc\">Künye 0/5</span><span>Fener</span><div id=\"bat\"><i></i></div></div>\n  <div id=\"prompt\" hidden></div>\n  <div id=\"breath\"><i></i></div>\n  <div id=\"card\"></div>\n  <div id=\"sub\"></div>\n</div>\n<div id=\"touch\" hidden>\n  <div id=\"stick\"><i></i></div>\n  <div class=\"b\" id=\"tE\" style=\"right:calc(28px + env(safe-area-inset-right,0px));bottom:calc(120px + env(safe-area-inset-bottom,0px))\">Etkileş</div>\n  <div class=\"b\" id=\"tF\" style=\"right:calc(104px + env(safe-area-inset-right,0px));bottom:calc(40px + env(safe-area-inset-bottom,0px))\">Fener</div>\n  <div class=\"b\" id=\"tC\" style=\"right:calc(28px + env(safe-area-inset-right,0px));bottom:calc(40px + env(safe-area-inset-bottom,0px))\">Eğil</div>\n  <div class=\"b\" id=\"tB\" style=\"right:calc(104px + env(safe-area-inset-right,0px));bottom:calc(120px + env(safe-area-inset-bottom,0px));display:none\">Nefes</div>\n  <div class=\"b\" id=\"tQ\" style=\"right:calc(180px + env(safe-area-inset-right,0px));bottom:calc(40px + env(safe-area-inset-bottom,0px));display:none\">Şişe</div>\n  <div class=\"b\" id=\"tR\" style=\"left:calc(28px + env(safe-area-inset-left,0px));top:calc(56px + env(safe-area-inset-top,0px));width:56px;height:56px\">Koş</div>\n  <div class=\"b\" id=\"tM\" style=\"right:calc(88px + env(safe-area-inset-right,0px));top:calc(56px + env(safe-area-inset-top,0px));width:48px;height:48px;font-size:11px\">TEL</div>\n  <div class=\"b\" id=\"tP\" style=\"right:calc(28px + env(safe-area-inset-right,0px));top:calc(56px + env(safe-area-inset-top,0px));width:48px;height:48px\">II</div>\n</div>\n\n<div class=\"scr\" id=\"start\">\n  <div class=\"box\">\n    <h1>Morgdan Kaçış</h1>\n    <div class=\"k\" id=\"startK\">Sabri'nin Büfesi · Gece hikâyesi</div>\n    <p>Gece 02:58. Sabri her gece olduğu gibi morg bekçisi Nuri Abi'ye tost götürüyor. Bu gece kulübe boş, çay hâlâ sıcak.</p>\n    <div class=\"btns\" style=\"margin:0 0 16px\"><button class=\"go\" id=\"cont\" hidden>Devam et</button><button class=\"go\" id=\"go\">Yeni oyun</button><button class=\"go ghost\" id=\"quit\" hidden>Büfeye dön</button></div>\n    <div class=\"row\"><span>Bölüm seç</span></div>\n    <div class=\"chaps\" id=\"chaps\"></div>\n    <div class=\"row\"><span>Kalite</span><button class=\"opt\" id=\"qA\">Akıcı</button><button class=\"opt\" id=\"qS\">Şahane</button></div>\n    <div class=\"row\"><span>Korku</span><button class=\"opt\" id=\"dH\">Hafif</button><button class=\"opt\" id=\"dN\">Normal</button><button class=\"opt\" id=\"dX\" hidden>Gece Vardiyası</button></div>\n    <div class=\"row\"><span>Ani korkutma</span><button class=\"opt\" id=\"j0\">Kapalı</button><button class=\"opt\" id=\"j1\">Hafif</button><button class=\"opt\" id=\"j2\">Tam</button></div>\n    <div class=\"row\"><span>Flaşı azalt</span><button class=\"opt\" id=\"fl\" aria-pressed=\"true\">Açık</button></div>\n    <div class=\"keys\" id=\"keys\"><kbd>W A S D</kbd> yürü · <kbd>Fare</kbd> bak · <kbd>Shift</kbd> koş · <kbd>C</kbd> eğil · <kbd>E</kbd> etkileş · <kbd>F</kbd> fener (tuttuğun durur) · <kbd>Tab</kbd> telefona bak · <kbd>Q</kbd> şişe at · <kbd>Space</kbd> saklanırken nefes tut · <kbd>Esc</kbd> duraklat<br>Kulaklık önerilir. Ani korkutmalar sesle ve hareketle yapılır; flaş, titreyen ışık ve beyaz ekran yoktur.</div>\n  </div>\n</div>\n<div class=\"scr\" id=\"pause\" hidden><div class=\"box\"><h2>Duraklatıldı</h2><div class=\"k\" id=\"pauseK\"></div><div class=\"btns\"><button class=\"go\" id=\"resume\">Devam</button><button class=\"go ghost\" id=\"toMenu\">Ana menü</button><button class=\"go ghost\" id=\"quit2\" hidden>Büfeye dön</button></div></div></div>\n<div class=\"scr\" id=\"end\" hidden><div class=\"box\"><h2 id=\"endH\"></h2><div class=\"k\" id=\"endk\"></div><p id=\"endp\"></p><div class=\"btns\"><button class=\"go\" id=\"next\">Sonraki bölüm</button><button class=\"go ghost\" id=\"rest\">Sabaha kadar dinlen</button></div></div></div>\n<div id=\"story\" hidden><div id=\"storyT\"></div><button class=\"go ghost\" id=\"skip\">Geç</button></div>\n";
let aktif = false;
export function morgAcikMi() { return aktif; }
export function morgBaslat(opts = {}) {
  if (aktif) return; aktif = true;
  const hostEl = document.createElement('div'); hostEl.className = 'morg-host'; hostEl.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#05080b';
  document.body.appendChild(hostEl); const __doc = hostEl.attachShadow({ mode: 'open' });
  __doc.innerHTML = '<style>' + CSS + '</style><div id="morg-root" style="position:fixed;inset:0">' + HTML + '</div>'; const __root = __doc.getElementById('morg-root');
  const __embedded = true; let __dead = false; const __offs = [];
  const addEventListener = (t, f, o) => { window.addEventListener(t, f, o); __offs.push(() => window.removeEventListener(t, f, o)); };
  const __docOn = (t, f, o) => { document.addEventListener(t, f, o); __offs.push(() => document.removeEventListener(t, f, o)); };
  const __exit = () => { if (__dead) return; __dead = true; aktif = false; try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {} __offs.forEach(f => { try { f(); } catch (e) {} });
    try { if (AC) AC.close(); } catch (e) {} try { comp.dispose && comp.dispose(); R.dispose(); R.forceContextLoss(); } catch (e) {} hostEl.remove(); try { opts.onExit && opts.onExit(); } catch (e) {} };
// ================= CHAPTER DATA =================
const MAPS = {"0": ["####################################", "#######.....########################", "#######..L..######.N.L..C###########", "#######.....######.....r.###########", "#########.###########.##############", "#S..L.......P..L...........L...oR.X#", "####################################", "####################################", "####################################"], "1": ["################################", "##DDDDDDD#######################", "#D.......D######################", "#D...L...D##C.....####..B#######", "#D.......D##...LN.####K..#######", "#D...S.K.D##.....K####...#######", "#D.......D##....r.#####.########", "#####.########.#####.......#####", "####..P...L........P...l....PR.X", "############.#######.K.....#####", "##########......################", "##########..L..K################", "##########......################", "##########HHHHHH################", "################################"], "2": ["############################################", "############################################", "##########......##########DDDDDD##HHHHH#####", "###.....##....C.##########......D#.....#####", "###.KL..##..L...##########...LK.D#..L.P#####", "###.....##N.....##########....E.D#...E.#####", "###.....##...K..##########......D#.....#####", "#####.######.#####...P.HH###.#######.#######", "#.S...L..P...L......l......L......L....P.R.X", "########.#######.#.....#####.####HHH########", "######....###.......######.....#############", "######.B..###.......######..L..#############", "######....###...o.E.######...K.#############", "#############..K....######.N...#############", "#############.......########################", "############################################", "############################################"], "3": ["########################################", "########################################", "##.....#####MMMMMMMMMMMMMMMM############", "##P.L..####..................###########", "##..S..####P..L......E.....K.#......####", "##.....####..................#..L...####", "####.######..s.s.s.s.s.s.s.s.....E.P####", "####....L....................#....K.####", "###########.....E............#.B....####", "###########..s.s.s.sos.s.s.s.###########", "####H.....#..................###########", "####H.K...#.............E....###########", "####H..L.....s.s.s.s.s.s.s.s.###########", "####H.....#..................###########", "####H...B.#.K.............L......L.P.R.X", "###########..................###########", "###############.####HHHH################", "###############.########################", "#############......#####################", "#############P.L..K#####################", "#############....C.#####################", "########################################", "########################################"], "4": ["################################################", "###############HHH##############################", "##.S......................................F.####", "##....L..................T.........L........####", "##..QQQQQQQQ.QQQQQQQQQQQQQ.QQQQQQQQQQQ.QQQ..####", "##P...T..K....................B.............####", "##.........................................P####", "##..QQQ.QQQQQQQQQQQQ.QQQQQQQQQQQQ.QQQQQQQQ..####", "#Q..................A............K..........####", "#Q.......................L..............T...####", "##..QQQQQQQQ.QQQQQQQQQQQQQ.QQQQQQQQQQQQQ.Q..####", "##................L.........................R.X#", "##.............T......................K.....####", "##..QQ.QQQQQQQQQQQQ.QQQQQQQQQQQQQ.QQQQQQQQ..####", "##................K...........A.............####", "##P.....................................L...####", "##..QQQQQQQQ.QQQQQQQQQQQQQQ.QQQQQQQQQQQ.QQ..####", "##..........A..............................P####", "##..........L......................T........####", "##..QQQ.QQQQQQQQQQQQQ.QQQQQQQQQQQQ.QQQQQQQ..####", "##.........................K................####", "##F...................P...................F.####", "##############################HHH###############", "################################################"], "5": ["################################################", "#####################################DDDDDDD####", "###########.........####P.........##D.......####", "##P......##....t...K####........K.##D.....K.####", "##....L..##..l......####..t.L.t...##D.......####", "##..S....##....t....####..........##D...L...####", "##.......##......l..####.TB.......##D.E.....####", "##.......##W........####..........##D.......####", "#####.#########.############.###########.#######", "#####.###.#####P########.###.###########.#######", "##..........Y........L...........Y........P.R.X#", "#######.############.#####.####.###.############", "###W.........#################W..........#######", "###..........#################........q..#######", "###..........#################..q........#######", "###....q.....#################...........#######", "###..........#################...........#######", "###..........#################......q....#######", "###.K........#################...........#######", "###.........P#################....KP....C#######", "####HHHHHH######################################", "################################################"], "6": ["##############################################", "##############################################", "##############################################", "##########P.............V.........##P.......##", "##########.L......L......E......K.##.......V##", "##########........................##....L...##", "####X#####...OO.....OO.....OO.....##.K...E..##", "####.#####...OO.....OO.....OO.....##........##", "####R#####........................######.#####", "##P.....##.......U.....L......U.......U.....##", "##.S........B..E......A.....................##", "##...L..##.........T....U....T....############", "##......##........................############", "##########...OO.....OO.....OO.....############", "##########...OO.....OO.....OO.....############", "##########....................A...############", "##########......U.................############", "##########.K....................L.############", "##########.......................P############", "#####################.########################", "############.K............U...P....A....K.V###", "##############################################"], "7": ["##############################", "##########........P###########", "##########.N..r....###########", "##########....L..N.###########", "##########.KN...C..###########", "##P....###.........###########", "##.S...#######.######P....####", "##..L...K..............L..R.X#", "##.K...######.#######....K####", "##########P........###########", "##########....L....###########", "##########.K.....N.###########", "##########.....r...###########", "##############################"], "8": ["##################################################", "##################################################", "##################################################", "############P.....############P.....K######P.....#", "############......############.....T.######.E..F.#", "############..L...############...AL..######...L..#", "############......############.T.....######......#", "####P....###.....K############.......######.....K#", "####..L..#####.###HHH############.###########.####", "#X.R............T...l......A............l.......##", "####..S.....L............######.......Y.........##", "####.....#HHH#########.#################.#########", "####.....###########P......###########P......#####", "####################.B...L.###########.......H####", "####################...E...###########...E...H####", "####################.......###########....L..H####", "####################......K###########......K#####", "####################HHHHH#########################", "##################################################", "##################################################"]};
const ROOMS = {"0": [[7, 1, 11, 3, "lift", "BEKLEME SALONU"], [18, 2, 24, 3, "booth", "GÜVENLİK"]], "1": [[2, 2, 8, 6, "cold", "SOĞUK ODA 2"], [12, 3, 17, 6, "office", "KAYIT ODASI"], [10, 10, 15, 12, "locker", "SOYUNMA"], [20, 7, 26, 9, "corr", "SOĞUK ODALAR"], [22, 3, 24, 5, "store", "DEPO"]], "2": [[18, 7, 22, 9, "corr", "ASANSÖR HOLÜ"], [3, 3, 7, 6, "store", "DEPO"], [10, 2, 15, 6, "office", "MORG KABUL"], [26, 3, 31, 6, "cold", "SOĞUK ODA 3"], [34, 3, 38, 6, "locker", "PERSONEL"], [6, 10, 9, 12, "store", "TEMİZLİK"], [13, 10, 19, 14, "autopsy", "OTOPSİ HAZIRLIK"], [26, 10, 30, 13, "chapel", "MESCİT"]], "3": [[2, 2, 6, 5, "store", "MERDİVEN"], [11, 3, 28, 15, "laundry", "ÇAMAŞIRHANE"], [29, 4, 35, 8, "laundry", "KURUTMA"], [13, 16, 18, 20, "laundry", "ÜTÜ ODASI"], [5, 10, 10, 14, "locker", "PERSONEL DOLAPLARI"]]};
const ENV_COLD = { fog: '#050b0d', fogD: 0.038, lamp: '#d6f5e2', lampI: 173, hemiS: '#3a5662', hemiG: '#06080a', hemiI: 1.25, tile: '#ffffff', tone: [0.86, 1.0, 0.98] };
const LV = [
 { name: 'Gece Teslimatı', prologue: true, noBox: true, time: '02:58', map: MAPS['0'], rooms: ROOMS['0'], doorSign: 'MORG · SOĞUK ODALAR', scares: [],
   env: { fog: '#0a0b0a', fogD: 0.03, lamp: '#f2e6c8', lampI: 166, hemiS: '#4a5048', hemiG: '#080806', hemiI: 1.35, tile: '#ffffff', tone: [0.98, 0.97, 0.9] },
   need: { ch: 'C', n: 1, pick: 'Tostu masaya bırak', got: 'Tost masada. Nuri Abi yok. Çayı hâlâ sıcak, radyo açık.', lock: 'Önce tostu Nuri Abi\'ye bırak. Kulübe koridorun ortasında.', use: 'Morg kapısını it', open: 'Kapı ağır ağır açılıyor. İçerisi buz gibi.' },
   obj: ['Tostu güvenlik kulübesine götür', 'Nuri Abi\'yi bul: morg kapısı koridorun sonunda'],
   sms: [['start', 'Bir tost bir çay, her zamanki 🙂'], ['start', 'Sabri gelme'], ['key', 'Neredesin abi? Tostun masada.']],
   intro: ['02:58. Martıköy Devlet Hastanesi, eksi ikinci kat.', '@W A S D ile yürü, fareyle bak. E ile etkileş.'],
   nuri: ['Güvenlik telefonu. Ahizede sadece cızırtı. Sonra çok uzaktan biri: "...gelme..."'],
   notes: ['Nöbet defteri. Bu gecenin satırı yarım kalmış: "02:40 Sabri tost getirecek. Adları oku. 03:00 kapıları ki"'],
   kunye: [], end: '' },
 { name: 'Soğuk Oda 2', time: '03:12', map: MAPS['1'], rooms: ROOMS['1'], scares: [['slam', 17, 8]], doorSign: 'ÇIKIŞ · KORİDOR B',
   env: ENV_COLD,
   need: { ch: 'C', n: 1, pick: 'Anahtarı al', got: 'Nuri Abi\'nin anahtarlığı. Üstünde plastik bir martı.', lock: 'Kilitli. Kayıt odasında anahtar olmalı.', use: 'Anahtarla aç', open: 'Kilit döndü. Koridor B\'ye çıkış açık.' },
   obj: ['Kapının anahtarını bul. Kayıt odasındaki dolaplara bak', 'Çıkış kapısına git. Işıktakini uyandırma'],
   sms: [['start', 'Sabri? Sen misin evlat'], ['start', 'Dinle beni. Burada ışığın altındakiler kımıldamaz. Işık tuttuğuna da.'], ['room:KAYIT ODASI', 'Anahtarı dolaba koydum. Hep oraya koyarım.'], ['key', 'Koridorda biri bekliyor. Lambanın altında kaldığı sürece bekler. Yanından geç, durma.'], ['room:SOYUNMA', 'Biri gelirse dolaba gir. Space ile nefesini tut.']],
   intro: ['03:12. Soğuk Oda 2. Ayak parmağındaki künyede adın yazıyor: SABRİ · 03:17.', '@F ile feneri yak. Tab ile telefona bak. Dolapları E ile ara.'],
   nuri: ['Telefonu açtın. İyi. Bu telefonlar benim, her biri bir durak. Yakalanırsan son açtığın telefonun yanında uyanırsın.',
     'Fenerin pili az. Gerekmedikçe yakma. Karanlıkta seni görmezler, fener yanınca uzaktan görürler.',
     'Çıkış kapısı koridorun sonunda. Anahtar sende mi? O zaman git. Arkana bakma.'],
   notes: ['Kayıt defteri, 19 Kasım: "Kimsesiz, 71 yaşında, erkek. Teslim alan: yok." Altında Nuri Abi\'nin el yazısı: "Ben okurum."'],
   kunye: [['Hayriye, 81', 'Her sabah martılara simit atardı. Kimse gelmedi.'], ['İsimsiz, 40 yaşlarında', 'Cebinde bir vapur bileti vardı. Yalnız gidiş.'], ['Remzi Usta, 67', 'Elleri hep makine yağı kokardı, diyor kayıt.'], ['Saadet, 23', 'Ayakkabısının bağcıkları iki ayrı renkti.'], ['Kâzım, 74', 'Nuri Abi\'nin defterinde adının yanına bir çiçek çizilmiş.']],
   end: 'Koridor B. Uzun, loş ve fazla sessiz.' },
 { name: 'Koridor B', time: '03:13', map: MAPS['2'], rooms: ROOMS['2'], scares: [['behind', 24, 8], ['cross', 31, 8]], doorSign: 'MERDİVEN · ÇAMAŞIRHANE',
   env: Object.assign({}, ENV_COLD, { hemiI: 1.2 }),
   need: { ch: 'C', n: 1, pick: 'Anahtar kartı al', got: 'Kart elinde. Koridorun ışıkları birer birer sönüyor.', lock: 'Kilitli. Okuyucuda kart yuvası var. Kart morg kabulde olmalı.', use: 'Kartı okut', open: 'Okuyucu yeşil yandı. Kapı açılıyor.' },
   onKey: G => { G.lampsOffWhere(L => L.cz >= 7 && L.cz <= 9 && L.cx > 15); },
   obj: ['Morg kabulden anahtar kartı al', 'Karanlıkta merdiven kapısına git. Saklan, gerekirse fenerle durdur'],
   sms: [['start', 'Asansör holündeki lambanın altında biri var. Işık yandıkça durur.'], ['room:MORG KABUL', 'Kart masada değil, dolapta. Kartı alınca ışıklar gider. Biliyorum.'], ['key', 'Şimdi dinle: fenerini birine tutarsan durur. Ama pil çabuk biter. Hepsine yetmez.'], ['key', 'Koridorun duvarında dolaplar var. Gerekirse gir.'], ['room:MESCİT', 'Burada her gece adları okurdum. Sonra bıraktım.']],
   intro: ['03:13. Koridor B. Uzakta tek bir lamba yanıyor. Altında biri duruyor.', '@Biri seni fark edince önce durup bakar. O an saklan ya da uzaklaş.'],
   nuri: ['Feneri gören gelir, oğlum. Ama fener tuttuğun da durur. İkisi birden doğru.',
     'Koşma. Koşarsan duyarlar, nefesin de biter.',
     'Kartı aldın mı? Işıklar gidince her şey yürür. Dolapları aklında tut.',
     'Merdiven aşağı, çamaşırhaneye iner. Orada çok çarşaf asılı. Hangisi çamaşır, hangisi değil... bak.'],
   notes: ['Mescidin rahlesinde bir kâğıt: "Okunmayan ad, kapanmayan kapıdır." Altında bir liste, yarısı silinmiş.'],
   kunye: [['Bekir, 58', 'Hamaldı. Taşıdığı yükleri bir deftere yazmış: bir milyon iki yüz bin kilo.'], ['Nermin, 66', 'Mahallenin terzisi. Cebinde bir makara beyaz iplik.'], ['Sami, 49', 'Gece bekçisiydi. Düdüğü hâlâ boynunda.'], ['Fikriye, 90', 'Kırk yıl aynı balkondan Boğaz\'a baktı.'], ['Hüsnü, 71', 'Kahvenin tavla şampiyonu. Zarlarını kimse istemedi.']],
   end: 'Birinci kart sende. Merdivenler aşağı iniyor, hava gittikçe nemleniyor.' },
 { name: 'Çamaşırhane', time: '03:14', map: MAPS['3'], rooms: ROOMS['3'], scares: [['behind', 20, 13], ['cross', 22, 8]], doorSign: 'ARŞİV',
   env: { fog: '#070d0c', fogD: 0.045, lamp: '#dff3e6', lampI: 166, hemiS: '#3c5658', hemiG: '#070909', hemiI: 1.15, tile: '#e9f0e8', tone: [0.9, 1.0, 0.96] },
   need: { ch: 'C', n: 1, pick: 'Çamaşırhane anahtarını al', got: 'Anahtar. Plastik etiketinde "Ütü · Gülizar" yazıyor.', lock: 'Kilitli. Çamaşırhane anahtarı lazım. Ütü odasına bak.', use: 'Anahtarla aç', open: 'Kapı açıldı. Aşağıda arşiv var.' },
   obj: ['Ütü odasından çamaşırhane anahtarını al', 'Çamaşırhanenin doğu çıkışına git'],
   sms: [['start', 'Bunlar kötü değil Sabri. Kimse gelmedi onlara. Kimse.'], ['room:ÜTÜ ODASI', 'Gülizar Hanım anahtarı hep ütü dolabına bırakırdı.'], ['room:KURUTMA', 'Kurutmada pil olur. Telefonu orada şarj ederdim.'], ['key', 'Çıkış doğuda, kurutmanın altında. Çarşafların arasından eğilerek geç.']],
   intro: ['03:14. Çamaşırhane. Hava ağır ve nemli. Asılı çarşaflar hafifçe kımıldıyor.', '@Eğilirsen (C) daha zor görülürsün. Dolaplar senin.'],
   nuri: ['Asılı çarşafların arasında yürürken eğil. Seni görmesinler.',
     'Ütü odası güneyde. Anahtar orada.',
     'Kurutma odasında powerbank var.',
     'Kapı doğuda. Az kaldı.',
     'Aşağısı arşiv. Orada biri var, görmez ama duyar.'],
   notes: [],
   kunye: [['Gülizar, 62', 'Bu çamaşırhanede otuz yıl çalıştı. Sonra buraya geri geldi.'], ['Arif, 55', 'Ayakkabı boyacısıydı. Fırçası cebinde.'], ['Meryem, 77', 'Torunlarının adlarını avucuna yazmıştı. Mürekkep silinmiş.'], ['İsimsiz, 30 yaşlarında', 'Kolundaki saat 03:17\'de durmuş.'], ['Cemal, 68', 'Balıkçıydı. Kayığının adı "Kısmet".']],
   end: 'Arka merdiven daha da aşağı iniyor. Kâğıt ve toz kokusu.' },
 { name: 'Arşiv', scares: [['behind', 3, 10], ['cross', 26, 11]], time: '03:15', map: MAPS['4'], th0: 'archive', doorSign: 'OTOPSİ KATI',
   env: { fog: '#090807', fogD: 0.05, lamp: '#ffd2b8', lampI: 108, hemiS: '#3d4a4c', hemiG: '#070706', hemiI: 1.05, tile: '#d8d2c4', tone: [0.95, 0.97, 0.92] },
   need: { ch: 'F', n: 3, pick: 'Sigortayı al', got: 'Sigorta.', lock: 'Sigorta kutusu boş', use: 'Sigortaları tak', open: 'Sigortalar takıldı. Kapının ışığı yeşile döndü.' },
   intro: ['03:15. Arşiv. Elektrik kesik, sadece acil durum lambaları yanıyor.', '@Burada biri var: görmez ama duyar. Eğilerek yürü. Q ile şişe atıp dikkatini dağıt.'],
   nuri: ['Arşivde biri var, görmez ama duyar. Başını yana eğer. Eğilip yürü, sessiz.',
     'Şişeleri fırlat. Sesin gittiği yere koşar. Sen öbür tarafa geç.',
     'Üç sigorta var, köşelerde. Onları ben çıkardım, kimse kapıyı açmasın diye.',
     'Neden mi? Okumayı bıraktım. Adları... Bir gece okumadım, sonra hiç okumadım.',
     'Sigortaları takınca kapı yeşile döner. İkinci kart oradan sonra.'],
   kunye: [['Şükrü, 84', 'Bu arşivde kırk yıl dosya taşıdı. Kendi dosyası eksik.'], ['Leman, 59', 'Radyoya her hafta istek şarkısı yazardı.'], ['Zeki, 45', 'Taksiciydi. Son yolcusunun adresi cebinde.'], ['Hatice, 88', 'Elinde kurumuş bir karanfil.'], ['İsimsiz, 50 yaşlarında', 'Cebinde iki çay fişi. Biri onun. Öbürü kimin?']],
   end: 'İkinci kart sende. Merdivenin dibinde beyaz, çok temiz bir koridor.' },
 { name: 'Otopsi Katı', scares: [['cross', 8, 10], ['behind', 31, 11]], time: '03:15', map: MAPS['5'], th0: 'autopsy', doorSign: 'KAZAN DAİRESİ',
   env: { fog: '#060a0c', fogD: 0.038, lamp: '#e6f5ff', lampI: 187, hemiS: '#3c5866', hemiG: '#06080a', hemiI: 1.15, tile: '#f2f6f6', tone: [0.88, 0.98, 1.0] },
   need: { ch: 'C', n: 1, pick: 'Anahtar kartı al', got: 'Kart. Arkasında kurşun kalemle bir not: "Defter bende değil - N."', lock: 'Kilitli. Kart gerekli.', use: 'Kartı okut', open: 'Kapı açılıyor. Aşağısı sıcak.' },
   sw: { '11,7': ['13,4', '17,6'], '3,12': ['7,15'], '30,12': ['32,14', '36,17', '38,13'] },
   intro: ['03:15. Otopsi Katı. Duvarlarda lamba anahtarları var. Koridorda bir şey gidip geliyor.', '@Anahtarla lambayı yakarsan altındakiler donar. Söndürürsen yürürler.'],
   nuri: ['Defterimi bu katta kaybettim. Okumayı bıraktığım gece... başladı.',
     'Duvardaki anahtarlar lambaları açar. Işık onları durdurur. Kullan bunu.',
     'Sedyeleri ben itmiyorum Sabri. Kendileri gidip geliyor. Yan girintilere gir.',
     'Karanlık salonda kart var. Önce lambaları yak, sonra yürü. Hepsi duracak.',
     'Nevin Hemşire bu katta çalışırdı. Bana çay getirirdi. Onun adını da yazmıştım.',
     'Az kaldı. Aşağısı sıcak. Kazan dairesi.'],
   kunye: [['Rıza, 73', 'Saatçiydi. Bütün saatleri bir dakika ileri kurardı.'], ['Nevin, 41', 'Hemşireydi. Bu katta çalıştı.'], ['Halil, 80', 'Kör bir kemancı. Kemanı hâlâ emanette.'], ['Sevim, 64', 'Her akşam sokak kedilerine ciğer alırdı.'], ['Orhan, 52', 'Amatör lig hakemi. Cebinde bir sarı kart.']],
   end: 'Merdiven boşluğunda hava ısınıyor. Turuncu bir uğultu.' },
 { name: 'Kazan Dairesi', scares: [['behind', 34, 9], ['cross', 12, 15]], time: '03:16', map: MAPS['6'], th0: 'boiler', doorSign: 'SERVİS', steam: true,
   env: { fog: '#120905', fogD: 0.042, lamp: '#ffae6a', lampI: 166, hemiS: '#5a3e2c', hemiG: '#0a0604', hemiI: 1.1, tile: '#c9a586', tone: [1.0, 0.9, 0.78] },
   need: { ch: 'V', n: 3, pick: 'Vanayı çevir', got: 'Vana döndü. Borulardan uzun bir iç çekiş.', lock: 'Basınç yüksek, kapı açılmıyor', use: 'Kapıyı aç', open: 'Basınç düştü. Kapı açıldı.' },
   intro: ['03:16. Kazan Dairesi. Sıcak. Borular nefes alıyor.', '@Buhar sesi gelince seni duymazlar. O an koş. Üç vanayı çevir.'],
   nuri: ['Burası sıcak. Buhar sesi gelince koşabilirsin, duymazlar.',
     'Üç vana var. Biri burada, biri pompa odasında, biri aşağıda, ızgarada.',
     'Ferit Usta burada ateşçiydi. Onun da kimsesi yoktu. Ben vardım.',
     'Buharı say: gelir, gider. Gelince git.',
     'Vanaları çevirince kapı açılır. Sonra benim odam. Orada sana bir şey bıraktım.'],
   kunye: [['Ferit, 69', 'Bu kazan dairesinin eski ateşçisi.'], ['Mualla, 76', 'Ekmeği hep ikiye böler, yarısını kapının önüne koyardı.'], ['Yusuf, 38', 'İnşaat işçisi. Baretinin içinde bir fotoğraf.'], ['Dürdane, 92', 'Doksan iki yaşındaydı ve kimseye borcu yoktu.'], ['İsimsiz, 60 yaşlarında', 'Yakasında Martıköy Vapur Hattı rozeti.']],
   end: 'Üçüncü kart sende. Koridorun sonunda bir kapı aralık. İçeriden kısık bir radyo sesi.' },
 { name: 'Nuri\'nin Odası', scares: [['slam', 20, 7]], time: '03:16', map: MAPS['7'], th0: 'booth', doorSign: 'SERVİS ASANSÖRÜ', calm: true,
   env: { fog: '#0a0907', fogD: 0.03, lamp: '#ffd6a0', lampI: 144, hemiS: '#4a4a44', hemiG: '#080706', hemiI: 1.15, tile: '#e6dccb', tone: [1.0, 0.95, 0.86] },
   need: { ch: 'C', n: 1, pick: 'Nuri\'nin defterini al', got: '', lock: 'Kapı kilitli. Masada bir şey unuttun.', use: 'Kapıyı aç', open: 'Kapı açıldı. Servis asansörünün koridoru.' },
   onKey: G => { G.defter(); },
   notes: ['Nöbet defterinden yırtılmış sayfa: "Her gece 03:00. Adları oku. Kapıları kapat. Çay."',
     'Sabri\'nin Büfesi menüsü, köşesi çay lekeli. Kalemle yazılmış: "Kaşarlı, bol çay. Sabri\'ye borcum: 3 tost."',
     'Masada bir kâğıt: "Sabri\'ye: Tostun parası çekmecede. Beni bekleme."',
     'Radyonun yanında bir not: "03:17. Elektrik gitti. Defter nerede?"'],
   intro: ['03:16. Nuri Abi\'nin odası. Radyo kısık sesle cızırdıyor. Burası sessiz.', '@Burada kimse yok. Etrafa bak, notları oku.'],
   nuri: ['Geldin mi? Otur biraz. Çay soğudu ama olsun.',
     'Defter masada. Adları ben yazdım, sen oku. Sesli oku Sabri.',
     'Sana söylemedim. Ben de burada kaldım. Bir gece, tostunu beklerken.',
     'Adlarını oku Sabri. Hepsini. Ben yapamadım.'],
   kunye: [['Emine', 'Nuri Abi\'nin annesi. Defterin ilk sayfasında.'], ['İhsan, 70', 'Nuri Abi\'nin tavla arkadaşı.'], ['Bahriye, 57', 'Hastane kantininde çay demlerdi.'], ['Turgut, 63', 'Nuri\'nin askerlik arkadaşı. Fotoğrafı duvarda.'], ['Kadir, 47', 'Her gece Sabri\'nin büfesinden simit alırdı.']],
   end: 'Defter elinde. Koridorun sonunda servis asansörü. Üç kart, bir sigorta.' },
 { name: 'Servis Asansörü', scares: [['cross', 15, 9], ['behind', 45, 8]], time: '03:17', map: MAPS['8'], th0: 'corr', doorSign: 'ASANSÖR', final: true,
   env: { fog: '#050a0c', fogD: 0.045, lamp: '#d6f5e2', lampI: 173, hemiS: '#3a5662', hemiG: '#06080a', hemiI: 1.15, tile: '#ffffff', tone: [0.86, 1.0, 0.98] },
   need: { ch: 'F', n: 1, pick: 'Ana sigortayı kaldır', got: 'Bütün ışıklar sönüyor. Sadece asansörün sarı ışığı kaldı. Koş.', lock: 'Asansör: elektrik yok', use: 'Asansörü çağır', open: 'Asansör kapısı açılıyor.' },
   onKey: G => { G.lampsOffWhere(() => true); G.alarm(); },
   intro: ['03:17. Servis Asansörü. Kartlar cebinde. Elektrik koridorun en ucunda.', '@Bütün kuralları hatırla: ışık, ses, dolap, şişe.'],
   nuri: ['Asansör üç kartla çalışır. Kartlar sende. Elektrik ana sigortada, koridorun ucunda.',
     'Sedye koridorda gidip geliyor. Odalara gir, bekle.',
     'Dinleyenler burada da var. Şişen varsa sakla, sonra lazım olacak.',
     'Korkma. Seni yakalarlarsa sadece yatırırlar. Sonra yine kalkarsın. Ben hep kalktım.',
     'Sigortayı kaldırınca bütün ışıklar gider. Asansörün ışığı kalır. Ona koş.',
     'Hoşça kal evlat. Sabah tostunu... bir başkasına götür.'],
   kunye: [['Necla, 35', 'Asansör görevlisiydi. Düğmeleri gözü kapalı bilirdi.'], ['Ahmet, 79', 'Emekli öğretmen. Cebinde bir tebeşir.'], ['Şaban, 66', 'Hurdacı. El arabasının zili hâlâ çalıyormuş, diyorlar.'], ['Melek, 82', 'Kimsesiz değildi, diyor not. Sadece herkes uzaktaydı.'], ['Nuri, 71', 'Morg bekçisi. Defteri senin elinde.']],
   end: '' },
];
const INTRO = ['Gece 02:51. Sabri\'nin Büfesi kapanmak üzere.', 'Nuri Abi her gece bu saatte bir tost bir çay ister. Morgun gece bekçisidir.', 'Sabri tostu sarar, karşı yakadaki hastaneye yürür.'];
const LIGHTS_OUT = ['Kapı arkanızdan ağır ağır kapanıyor.', 'Floresanlar birer birer sönüyor.', 'Bir şey çarşafını sürüyerek yanından geçiyor.', 'Soğuk. Çok soğuk.', '03:12.']
const END_ESCAPE = ['Asansör kapısı yavaşça kapanıyor.', 'Aşağıda, koridorun karanlığında üç gölge kıpırdamadan bakıyor.', 'Kabin yukarı çıkıyor. Sonra uzun süre hiçbir şey olmuyor.', '06:40. Sabri iskelede, büfesinin önünde uyanıyor. Elinde soğumuş bir tost.', 'Morg bir daha hiç sessiz olmadı.'];
const END_REMEMBER = ['Asansörde Nuri Abi\'nin defterini açıyorsun.', 'Adları yüksek sesle okuyorsun. Hepsini.', '#NAMES', 'Çarşaflılar duruyor. Birer birer başlarını eğip çekmecelerine dönüyorlar.', 'Asansör kapısı açık kalıyor. Merdivenleri sakince çıkıyorsun.', 'Kapının kulpunda Nuri Abi\'nin kasketi asılı. Dışarıda sabah.', 'Bu gece adlarını biri okudu.'];

// ================= SETTINGS / SAVE =================
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const cfg = { q: isTouch ? 'A' : 'S', d: 'N', flash: true, js: 2 };
let store = null; try { store = window.localStorage; const s = JSON.parse(store.getItem('morg-cfg') || 'null'); if (s) Object.assign(cfg, s); } catch (e) { store = null; }
const saveCfg = () => { try { store && store.setItem('morg-cfg', JSON.stringify(cfg)); } catch (e) {} };
const SAVE0 = { unlocked: 0, kunye: {}, cur: null, best: {}, done: false };
let SAVE = Object.assign({}, SAVE0); try { const s = store && JSON.parse(store.getItem('morg-save-v3') || 'null'); if (s) SAVE = Object.assign({}, SAVE0, s); } catch (e) {}
const writeSave = () => { try { store && store.setItem('morg-save-v3', JSON.stringify(SAVE)); } catch (e) {} };
const totalKunye = () => Object.keys(SAVE.kunye).length;

// ================= RENDERER =================
const R = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
R.setPixelRatio(Math.min(devicePixelRatio || 1, isTouch ? 1.5 : 2));
R.setSize(innerWidth, innerHeight);
R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.55;
R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
__root.prepend(R.domElement);
const S = new THREE.Scene(); S.background = new THREE.Color('#020406'); S.fog = new THREE.FogExp2('#050b0d', 0.04);
const cam = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.03, 80); cam.rotation.order = 'YXZ'; S.add(cam);
const hemi = new THREE.HemisphereLight('#3a5662', '#06080a', 1.25); S.add(hemi);

let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function n2(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }

// ================= TEXTURES / MATERIALS =================
function canvasTex(w, h, draw, srgb = true) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }
function grime(k, w, h, n, a0, a1, col) { for (let i = 0; i < n; i++) { const x = rnd() * w, y = rnd() * h, r = 20 + rnd() * 140; const g = k.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col.replace('A', (a0 + rnd() * (a1 - a0)).toFixed(3))); g.addColorStop(1, col.replace('A', '0')); k.fillStyle = g; k.fillRect(x - r, y - r, r * 2, r * 2); } }
function drips(k, w, h, n, col) { for (let i = 0; i < n; i++) { const x = rnd() * w, y0 = rnd() * h * 0.5, len = 60 + rnd() * 260; const g = k.createLinearGradient(0, y0, 0, y0 + len); g.addColorStop(0, col.replace('A', '0.0')); g.addColorStop(0.2, col.replace('A', (0.08 + rnd() * 0.1).toFixed(3))); g.addColorStop(1, col.replace('A', '0')); k.fillStyle = g; k.fillRect(x, y0, 2 + rnd() * 5, len); } }
const tileMap = canvasTex(1024, 1024, (k, w, h) => { k.fillStyle = '#2e3a3a'; k.fillRect(0, 0, w, h); const n = 16, s = w / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = 0.86 + rnd() * 0.14; k.fillStyle = `rgb(${150 * v | 0},${176 * v | 0},${170 * v | 0})`; k.fillRect(i * s + 3, j * s + 3, s - 6, s - 6);
    const gr = k.createLinearGradient(i * s, j * s, i * s + s, j * s + s); gr.addColorStop(0, 'rgba(255,255,255,.10)'); gr.addColorStop(1, 'rgba(0,0,0,.10)'); k.fillStyle = gr; k.fillRect(i * s + 3, j * s + 3, s - 6, s - 6);
    if (rnd() < 0.04) { k.strokeStyle = 'rgba(30,36,34,.5)'; k.lineWidth = 1.5; k.beginPath(); k.moveTo(i * s + rnd() * s, j * s); k.lineTo(i * s + rnd() * s, j * s + s); k.stroke(); } }
  grime(k, w, h, 40, 0.05, 0.22, 'rgba(40,46,30,A)'); drips(k, w, h, 46, 'rgba(48,52,36,A)');
  const g = k.createLinearGradient(0, h * 0.55, 0, h); g.addColorStop(0, 'rgba(20,24,20,0)'); g.addColorStop(1, 'rgba(20,24,20,.5)'); k.fillStyle = g; k.fillRect(0, 0, w, h); });
const tileRough = canvasTex(512, 512, (k, w, h) => { k.fillStyle = '#9a9a9a'; k.fillRect(0, 0, w, h); const s = w / 16; k.fillStyle = '#eee'; for (let i = 0; i <= 16; i++) { k.fillRect(i * s - 2, 0, 4, h); k.fillRect(0, i * s - 2, w, 4); } grime(k, w, h, 30, 0.2, 0.5, 'rgba(230,230,230,A)'); }, false);
const floorMap = canvasTex(1024, 1024, (k, w, h) => { k.fillStyle = '#3d4644'; k.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { const v = 40 + rnd() * 60; k.fillStyle = `rgba(${v},${v + 6},${v + 4},${0.3 + rnd() * 0.5})`; k.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 3); }
  k.strokeStyle = 'rgba(18,22,22,.8)'; k.lineWidth = 3; for (let i = 0; i <= 4; i++) { k.beginPath(); k.moveTo(i * w / 4, 0); k.lineTo(i * w / 4, h); k.stroke(); k.beginPath(); k.moveTo(0, i * h / 4); k.lineTo(w, i * h / 4); k.stroke(); } grime(k, w, h, 30, 0.1, 0.3, 'rgba(12,16,16,A)'); });
const floorRough = canvasTex(512, 512, (k, w, h) => { k.fillStyle = '#9a9a9a'; k.fillRect(0, 0, w, h); grime(k, w, h, 22, 0.5, 0.9, 'rgba(12,12,12,A)'); }, false);
const steelMap = canvasTex(512, 512, (k, w, h) => { k.fillStyle = '#8f9a9c'; k.fillRect(0, 0, w, h); for (let i = 0; i < 400; i++) { k.fillStyle = `rgba(255,255,255,${rnd() * 0.05})`; k.fillRect(0, rnd() * h, w, 1); } grime(k, w, h, 14, 0.05, 0.2, 'rgba(40,40,30,A)'); drips(k, w, h, 10, 'rgba(60,50,30,A)'); });
const sheetMap = canvasTex(512, 512, (k, w, h) => { k.fillStyle = '#d9ddd6'; k.fillRect(0, 0, w, h); for (let i = 0; i < 3000; i++) { k.fillStyle = `rgba(120,130,120,${rnd() * 0.05})`; k.fillRect(rnd() * w, rnd() * h, 2, 2); } grime(k, w, h, 8, 0.04, 0.12, 'rgba(120,120,90,A)'); });
const boxMap = canvasTex(256, 256, (k, w, h) => { k.fillStyle = '#8a7356'; k.fillRect(0, 0, w, h); for (let i = 0; i < 1500; i++) { k.fillStyle = `rgba(60,44,28,${rnd() * 0.12})`; k.fillRect(rnd() * w, rnd() * h, 2, 1 + rnd() * 3); } k.fillStyle = '#d8cdb4'; k.fillRect(w * 0.3, h * 0.35, w * 0.4, h * 0.22); k.fillStyle = 'rgba(40,36,30,.6)'; for (let i = 0; i < 3; i++) k.fillRect(w * 0.34, h * (0.4 + i * 0.05), w * (0.18 + rnd() * 0.14), 2); grime(k, w, h, 6, 0.05, 0.2, 'rgba(30,20,10,A)'); });
const rustMap = canvasTex(512, 512, (k, w, h) => { k.fillStyle = '#5a4234'; k.fillRect(0, 0, w, h); for (let i = 0; i < 5000; i++) { const v = rnd(); k.fillStyle = v < 0.5 ? `rgba(120,70,40,${rnd() * 0.2})` : `rgba(30,24,20,${rnd() * 0.25})`; k.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 4, 2 + rnd() * 4); } for (let i = 0; i < 6; i++) { k.fillStyle = 'rgba(20,16,12,.5)'; k.fillRect(0, i * h / 6, w, 5); } drips(k, w, h, 30, 'rgba(110,60,30,A)'); });
const steamTex = canvasTex(128, 128, (k, w, h) => { const g = k.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(0.5, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(255,255,255,0)'); k.fillStyle = g; k.fillRect(0, 0, w, h); });

const MAT = {
  tile: new THREE.MeshStandardMaterial({ map: tileMap, roughnessMap: tileRough, roughness: 1.0 }),
  floor: new THREE.MeshStandardMaterial({ map: floorMap, roughnessMap: floorRough, roughness: 0.42, metalness: 0.1 }),
  ceil: new THREE.MeshStandardMaterial({ color: '#232a2b', roughness: 0.95 }),
  steel: new THREE.MeshStandardMaterial({ map: steelMap, roughness: 0.38, metalness: 0.85 }),
  steelDark: new THREE.MeshStandardMaterial({ color: '#4a5355', roughness: 0.5, metalness: 0.8 }),
  sheet: new THREE.MeshStandardMaterial({ map: sheetMap, color: '#6f746c', roughness: 0.97, side: THREE.DoubleSide }),
  sheetGrey: new THREE.MeshStandardMaterial({ map: sheetMap, color: '#5c6159', roughness: 0.97, side: THREE.DoubleSide }),
  hang: new THREE.MeshStandardMaterial({ map: sheetMap, color: '#c4c8c0', roughness: 0.95, side: THREE.DoubleSide, transparent: true, opacity: 0.93 }),
  black: new THREE.MeshStandardMaterial({ color: '#08090a', roughness: 0.6 }),
  shirt: new THREE.MeshStandardMaterial({ color: '#2e4a63', roughness: 0.85, side: THREE.DoubleSide }),
  toe: new THREE.MeshStandardMaterial({ color: '#a8988c', roughness: 0.8 }),
  tag: new THREE.MeshStandardMaterial({ color: '#c9b98a', roughness: 0.85 }),
  rubber: new THREE.MeshStandardMaterial({ color: '#0d0f10', roughness: 0.7 }),
  locker: new THREE.MeshStandardMaterial({ color: '#56626a', roughness: 0.45, metalness: 0.7 }),
  washer: new THREE.MeshStandardMaterial({ color: '#c9cdc8', roughness: 0.4, metalness: 0.3 }),
  glass: new THREE.MeshStandardMaterial({ color: '#0e1a1c', roughness: 0.08, metalness: 0.4 }),
  wood: new THREE.MeshStandardMaterial({ color: '#4a3424', roughness: 0.7 }),
  box: new THREE.MeshStandardMaterial({ map: boxMap, roughness: 0.9 }),
  rack: new THREE.MeshStandardMaterial({ color: '#3d4446', roughness: 0.55, metalness: 0.7 }),
  rust: new THREE.MeshStandardMaterial({ map: rustMap, roughness: 0.7, metalness: 0.5 }),
  red: new THREE.MeshStandardMaterial({ color: '#7a2f26', roughness: 0.6 }),
  paper: new THREE.MeshStandardMaterial({ color: '#ddd5bf', roughness: 0.9, emissive: '#3a3420', emissiveIntensity: 0.35 }),
  bottle: new THREE.MeshStandardMaterial({ color: '#5f8a6e', roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.8, emissive: '#1c2a20', emissiveIntensity: 0.6 }),
  tagGlow: new THREE.MeshStandardMaterial({ color: '#d8c78f', roughness: 0.6, emissive: '#7a6230', emissiveIntensity: 0.6 }),
  card: new THREE.MeshStandardMaterial({ color: '#e8e2cc', roughness: 0.5, emissive: '#4a4228', emissiveIntensity: 0.6 }),
  gold: new THREE.MeshStandardMaterial({ color: '#b08a2a', metalness: 0.8, roughness: 0.3 }),
};
let world = new THREE.Group(); S.add(world);
const add = (m, x = 0, y = 0, z = 0, p = world) => { m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; p.add(m); return m; };
const rbox = (w, h, d, mat, x, y, z, r = 0.03, p = world) => add(new THREE.Mesh(r ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d), mat), x, y, z, p);
const own = m => { m.userData.own = true; return m; };

// ================= LEVEL STATE =================
const CS = 2, H = 3.0;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const WALLS = '#DHMQOX';
let LVI = 0, lv = LV[0], MAP = lv.map, ROWS = 0, COLS = 0, items = [];
const at = (cx, cz) => (cz < 0 || cz >= ROWS || cx < 0 || cx >= COLS) ? '#' : MAP[cz][cx];
const isWallCh = ch => WALLS.includes(ch);
const W2C = v => Math.floor(v / CS), C2W = c => c * CS + CS / 2;
let containers = [], lamps = [], phones = [], kunyeler = [], pickups = [], valves = [], switches = [], bottlesW = [], sedyes = [], vents = [], notes = [], enemies = [], solids = [], door = null, exitIt = null, steamFx = [];
const lampsOff = new Set();
const passable = (cx, cz) => { const ch = at(cx, cz); if (isWallCh(ch) || ch === 't') return false; if (ch === 'R' && !(door && door.unlocked)) return false; return true; };
const wallDir = (cx, cz) => { for (const [dx, dz] of DIRS) if (isWallCh(at(cx + dx, cz + dz))) return [dx, dz]; return [0, 1]; };

// shaft shader (soft additive volumetric cone)
const shaftMat = (col, a) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { c: { value: new THREE.Color(col) }, a: { value: a } },
  vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vec4 wp=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-wp.xyz); gl_Position=projectionMatrix*wp; }`,
  fragmentShader: `uniform vec3 c; uniform float a; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float edge=pow(abs(dot(vN,vV)),1.6); float len=pow(vUv.y,1.4); gl_FragColor=vec4(c*a*edge*len,1.); }` });

function sheetBodyGeo(len, wid) { const g = new THREE.CapsuleGeometry(wid * 0.38, len - wid * 0.76, 6, 16); g.rotateX(Math.PI / 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const yy = p.getY(i); p.setY(i, yy < 0 ? yy * 0.2 : yy * 0.6 + Math.sin(p.getZ(i) * 7 + p.getX(i) * 4) * 0.015); } g.computeVertexNormals(); return g; }
function gurney(x, z, rot, body, parent = world) { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; parent.add(g);
  rbox(2.0, 0.06, 0.7, MAT.steel, 0, 0.84, 0, 0.02, g); for (const [a, b] of [[-0.9, -0.3], [0.9, -0.3], [-0.9, 0.3], [0.9, 0.3]]) { rbox(0.04, 0.78, 0.04, MAT.steelDark, a, 0.43, b, 0, g); const wh = add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 14), MAT.rubber), a, 0.06, b, g); wh.rotation.x = Math.PI / 2; }
  if (body) { const b = add(new THREE.Mesh(sheetBodyGeo(1.7, 0.6), MAT.sheet), 0, 0.9, 0, g); b.rotation.y = Math.PI / 2; rbox(0.09, 0.12, 0.07, MAT.toe, 0.9, 0.95, 0.07, 0.03, g); rbox(0.006, 0.06, 0.1, MAT.tag, 0.96, 0.9, 0.08, 0.002, g); }
  return g; }
function tableAt(x, z, parent = world) { const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g); rbox(0.9, 0.75, 0.6, MAT.steelDark, 0, 0.375, 0, 0.02, g); return g; }

// ================= ÇARŞAFLI / DİNLEYEN =================
// The sheet is draped over a real body: head, shoulders, hanging arms, hips. Built ring by ring from the top;
// below each support the cloth can only fall inward slowly, so it hangs like fabric instead of hugging the body.
const _figGeo = {};
function rayEllipse(ca, sa, cx, cz, rx, rz) { // farthest hit of the ray (0,0)+t(ca,sa) with an ellipse, or 0
  const A = (ca / rx) ** 2 + (sa / rz) ** 2, B = -2 * (ca * cx / rx ** 2 + sa * cz / rz ** 2), C = (cx / rx) ** 2 + (cz / rz) ** 2 - 1; const D = B * B - 4 * A * C; if (D < 0) return 0; return Math.max(0, (-B + Math.sqrt(D)) / (2 * A)); }
function sheetGeo(listener) { const key = listener ? 'A' : 'E'; if (_figGeo[key]) return _figGeo[key];
  const S = listener ? 1.07 : 1.0, TH = listener ? 0.86 : 1.0, NY = 64, NA = 60, top = 1.83 * S;
  const hx = listener ? 0.0 : 0.025, hz = listener ? 0.13 : 0, hy = (listener ? 1.6 : 1.705) * S;
  const parts = y => { const p = []; const dh = y - hy; if (Math.abs(dh) < 0.108 * S) { const r = Math.sqrt((0.108 * S) ** 2 - dh * dh); p.push([hx, hz, r * 0.95, r]); if (!listener && dh > -0.03 && dh < 0.04) p.push([hx + 0.085, hz, 0.03, 0.022]); } // head + nose bump
    if (y > 1.5 * S && y < 1.62 * S) p.push([0, listener ? 0.05 : 0, 0.055, 0.06]);
    if (y > 0.98 * S && y < 1.53 * S) { const t = (y - 0.98 * S) / (0.55 * S); const sh = y > 1.44 * S ? Math.sqrt(Math.max(0, 1 - ((y - 1.44 * S) / (0.09 * S)) ** 2)) : 1; p.push([0, 0, (0.1 + 0.03 * t) * TH, (0.15 + 0.06 * t) * sh * TH]); }
    if (y > 0.8 * S && y < 1.47 * S) for (const s of [-1, 1]) { const sh = y > 1.4 * S ? Math.sqrt(Math.max(0, 1 - ((y - 1.4 * S) / (0.07 * S)) ** 2)) : 1; p.push([0.01, s * 0.235 * TH, 0.05 * sh, 0.05 * sh]); }
    if (y > 0.74 * S && y < 0.86 * S) for (const s of [-1, 1]) p.push([0.03, s * 0.24 * TH, 0.06, 0.05]); // hands under the sheet
    if (y > 0.78 * S && y < 1.0 * S) p.push([0, 0, 0.13 * TH, 0.18 * TH]);
    if (y < 0.8 * S) for (const s of [-1, 1]) p.push([0.01, s * 0.09, 0.075, 0.075]);
    return p; };
  const R = []; let prev = null;
  for (let i = 0; i <= NY; i++) { const y = top * (1 - i / NY), ring = []; const P = parts(y);
    for (let j = 0; j < NA; j++) { const a = j / NA * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a); let r = 0; for (const q of P) r = Math.max(r, rayEllipse(ca, sa, q[0], q[1], q[2], q[3]));
      r += 0.012; if (prev) r = Math.max(r, prev[j] - (top / NY) * (y < 0.75 * S ? 0.08 : 0.42)); ring.push(r); }
    R.push(ring); prev = ring; }
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= NY; i++) { const y0 = top * (1 - i / NY); for (let j = 0; j <= NA; j++) { const jj = j % NA, a = jj / NA * Math.PI * 2; let r = R[i][jj]; const low = Math.max(0, Math.min(1, (1.45 * S - y0) / 1.1));
      const fold = Math.sin(a * 6 + 1.3 * Math.sin(a * 2 + 0.7)) * 0.02 * low + Math.sin(a * 11 + y0 * 1.5) * 0.006 * low; r += fold;
      if (y0 < 0.55 * S) r += (0.55 * S - y0) * 0.12; // flare at the hem
      let y = y0; if (i === NY) { const front = Math.max(0, Math.cos(a)); y = 0.015 + n2(a * 3, 7) * 0.05 + front ** 6 * 0.13; } else if (i === NY - 1) { const front = Math.max(0, Math.cos(a)); y = Math.max(y, 0.04 + front ** 6 * 0.14); }
      const hunch = (y0 / top) ** 2.2 * (listener ? 0.05 : 0.13); const tilt = listener ? 0 : Math.max(0, y0 - 1.0 * S) * 0.06;
      pos.push(Math.cos(a) * r + hunch, y - Math.max(0, Math.sin(a)) * tilt, Math.sin(a) * r); uv.push(j / NA * 3, y0 / top * 3); } }
  for (let i = 0; i < NY; i++) for (let j = 0; j < NA; j++) { const A = i * (NA + 1) + j, B = A + NA + 1; idx.push(A, B, A + 1, B, B + 1, A + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  _figGeo[key] = g; return g; }
const MAT_DEAD = new THREE.MeshStandardMaterial({ color: '#8d968c', roughness: 0.75 }), MAT_BAND = new THREE.MeshStandardMaterial({ color: '#cfc8b4', roughness: 0.95 });
function carsafliMesh(listener) {
  const g = new THREE.Group(); const body = new THREE.Mesh(sheetGeo(listener), listener ? MAT.sheetGrey : MAT.sheet); body.castShadow = true; body.receiveShadow = true; g.add(body);
  // bare feet under the front of the hem, one with a toe tag
  for (const s of [-1, 1]) { const f = rbox(0.21, 0.07, 0.09, MAT_DEAD, 0.2, 0.035, s * 0.085, 0.035, g); f.rotation.y = s * -0.12; }
  const tg = rbox(0.006, 0.065, 0.1, MAT.tag, 0.31, 0.03, 0.14, 0.002, g); tg.rotation.y = 0.5;
  if (listener) { // long bare arms reaching out of the sheet, and a bandaged, tilted head poking through
    for (const s of [-1, 1]) { const arm = new THREE.Group(); arm.position.set(0.06, 1.33, s * 0.2); arm.rotation.set(s * 0.2, 0, 1.2 - (s > 0 ? 0.15 : 0)); g.add(arm);
      add(new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.36, 4, 8), MAT_DEAD), 0, -0.2, 0, arm); add(new THREE.Mesh(new THREE.CapsuleGeometry(0.027, 0.32, 4, 8), MAT_DEAD), 0, -0.55, 0, arm);
      for (let f = 0; f < 4; f++) { const fg = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.1, 3, 6), MAT_DEAD), (f - 1.5) * 0.017, -0.79, 0.005 * f, arm); fg.rotation.x = 0.25; } }
    const hd = new THREE.Group(); hd.position.set(0.02, 1.72, 0.14); hd.rotation.set(0.55, 0, 0.1); g.add(hd); add(new THREE.Mesh(new THREE.SphereGeometry(0.105, 18, 14), MAT_BAND), 0, 0, 0, hd).scale.set(0.95, 1.12, 0.92);
    for (let b = 0; b < 6; b++) { const t = add(new THREE.Mesh(new THREE.TorusGeometry(0.103 - Math.abs(b - 2.5) * 0.012, 0.009, 5, 22), b % 2 ? MAT_BAND : MAT.sheetGrey), 0, -0.07 + b * 0.028, 0, hd); t.rotation.x = Math.PI / 2 + (b - 2.5) * 0.08; } }
  return g; }   // faces +x
// ================= WORLD BUILD =================
function disposeWorld() { world.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.userData && o.material.userData.own) o.material.dispose(); }); S.remove(world); world = new THREE.Group(); S.add(world); }
function buildLevel(i) {
  disposeWorld(); LVI = i; lv = LV[i]; MAP = lv.map; ROWS = MAP.length; COLS = MAP[0].length; seed = 11 + i * 97;
  items = []; for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) { const ch = MAP[z][x]; if ('SLlPKCFBTNWVoqEAYUGstrRX'.includes(ch)) items.push({ type: ch, cx: x, cz: z }); }
  containers = []; lamps = []; phones = []; kunyeler = []; pickups = []; valves = []; switches = []; bottlesW = []; sedyes = []; vents = []; notes = []; enemies = []; solids = []; steamFx = []; lampsOff.clear();
  const E = lv.env; S.fog.color.set(E.fog); S.fog.density = E.fogD; hemi.color.set(E.hemiS); hemi.groundColor.set(E.hemiG); hemi.intensity = E.hemiI; MAT.tile.color.set(E.tile); grade.uniforms.uTone.value.set(...E.tone);
  const NI = g => g.index ? g.toNonIndexed() : g; buildShell(null, NI);
  // walls
  const G = { wall: [], drawer: [], handle: [], tag: [], locker: [], slot: [], rail: [], washer: [], glass: [], rack: [], box: [], rust: [], pipe: [] };
  for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) { const ch = MAP[z][x]; if (!isWallCh(ch)) continue;
    if (ch === 'Q') { // free-standing archive rack fills the cell
      const cx = C2W(x), cz = C2W(z), hh = 2.55;
      for (const [a, b] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) { const g = new THREE.BoxGeometry(0.06, hh, 0.06); g.translate(cx + a, hh / 2, cz + b); G.rack.push(g); }
      for (let s = 0; s < 5; s++) { const y = 0.12 + s * 0.6; const g = new THREE.BoxGeometry(1.86, 0.03, 1.86); g.translate(cx, y, cz); G.rack.push(g);
        if (s < 4) { let px = -0.85; while (px < 0.8) { const w = 0.28 + rnd() * 0.22, h2 = 0.26 + rnd() * 0.2; if (rnd() > 0.12) for (const side of [-1, 1]) { const b = new THREE.BoxGeometry(w - 0.02, h2, 0.8); b.rotateY((rnd() - 0.5) * 0.06); b.translate(cx + px + w / 2, y + 0.015 + h2 / 2, cz + side * 0.45); G.box.push(b); } px += w; } } }
      continue; }
    if (ch === 'O') { const cx = C2W(x), cz = C2W(z); const g = new THREE.CylinderGeometry(0.95, 0.95, 2.7, 28); g.translate(cx, 1.35, cz); G.rust.push(g);
      for (let b = 0; b < 3; b++) { const t = new THREE.TorusGeometry(0.97, 0.035, 6, 32); t.rotateX(Math.PI / 2); t.translate(cx, 0.4 + b * 0.95, cz); G.pipe.push(t); }
      const p = new THREE.CylinderGeometry(0.12, 0.12, 0.6, 12); p.translate(cx, 2.95, cz); G.pipe.push(p); continue; }
    for (const [dx, dz] of DIRS) { const nb = at(x + dx, z + dz); if (isWallCh(nb)) continue;
      const fx = C2W(x) + dx * CS / 2, fz = C2W(z) + dz * CS / 2, ry = Math.atan2(dx, dz);
      const place = (g, ox, oy, oz) => { g.rotateY(ry); g.translate(fx + Math.sin(ry) * oz + Math.cos(ry) * ox, oy, fz + Math.cos(ry) * oz - Math.sin(ry) * ox); return g; };
      if (ch === 'X') continue;
      G.rail.push(place(new THREE.BoxGeometry(CS, 0.06, 0.05), 0, 1.12, 0.03));
      if (ch === 'D') { const w = 0.62, hh = 0.6; G.drawer.push(place(new THREE.BoxGeometry(CS - 0.08, 4 * hh + 0.1, 0.12), 0, 0.12 + 2 * hh, 0.06));
        for (let c = 0; c < 3; c++) for (let r = 0; r < 4; r++) { const ox = -w + c * w, oy = 0.12 + hh / 2 + r * hh + 0.05;
          G.drawer.push(place(new RoundedBoxGeometry(w - 0.05, hh - 0.05, 0.05, 2, 0.015), ox, oy, 0.14));
          G.handle.push(place(new RoundedBoxGeometry(0.26, 0.03, 0.045, 2, 0.012), ox, oy + 0.16, 0.18));
          G.tag.push(place(new THREE.BoxGeometry(0.11, 0.07, 0.006), ox - 0.18, oy - 0.17, 0.17)); } }
      if (ch === 'H') { for (let c = 0; c < 2; c++) { const ox = -0.48 + c * 0.96; G.locker.push(place(new RoundedBoxGeometry(0.92, 2.1, 0.05, 2, 0.01), ox, 1.08, 0.04)); for (let v = 0; v < 5; v++) G.slot.push(place(new THREE.BoxGeometry(0.42, 0.018, 0.02), ox, 1.78 + v * 0.055, 0.07)); } }
      if (ch === 'M') { for (let c = 0; c < 2; c++) { const ox = -0.48 + c * 0.96; G.washer.push(place(new RoundedBoxGeometry(0.9, 1.0, 0.6, 2, 0.04), ox, 0.5, 0.3)); G.washer.push(place(new RoundedBoxGeometry(0.9, 0.9, 0.6, 2, 0.04), ox, 1.48, 0.3));
          for (const oy of [0.48, 1.46]) { const ring = new THREE.TorusGeometry(0.25, 0.04, 8, 28); G.handle.push(place(ring, ox, oy, 0.61)); const gl = new THREE.CircleGeometry(0.23, 28); G.glass.push(place(gl, ox, oy, 0.605)); } } }
    } }
  const mk = (arr, mat, cast = false) => { if (!arr.length) return; const m = new THREE.Mesh(mergeGeometries(arr.map(NI)), mat); m.receiveShadow = true; m.castShadow = cast; world.add(m); };
  mk(G.rail, MAT.steelDark); mk(G.drawer, MAT.steel, true); mk(G.handle, MAT.steel); mk(G.tag, MAT.tag); mk(G.locker, MAT.locker); mk(G.slot, MAT.black);
  mk(G.washer, MAT.washer, true); mk(G.glass, MAT.glass); mk(G.rack, MAT.rack, true); mk(G.box, MAT.box, true); mk(G.rust, MAT.rust, true); mk(G.pipe, MAT.steelDark);
  // ceiling pipes along long runs
  const pipeG = [];
  for (let z = 0; z < ROWS; z++) { let run = 0; for (let x = 0; x <= COLS; x++) { const fl = x < COLS && !isWallCh(MAP[z][x]); if (fl) run++; else { if (run >= 5) { const x0 = (x - run) * CS, x1 = x * CS; const p = new THREE.CylinderGeometry(0.07, 0.07, x1 - x0, 12); p.rotateZ(Math.PI / 2); p.translate((x0 + x1) / 2, H - 0.22, z * CS + 0.35); pipeG.push(p); const p2 = new THREE.CylinderGeometry(0.045, 0.045, x1 - x0, 10); p2.rotateZ(Math.PI / 2); p2.translate((x0 + x1) / 2, H - 0.15, z * CS + 0.6); pipeG.push(p2); } run = 0; } } }
  mk(pipeG, LVI === 5 ? MAT.rust : MAT.steelDark);
  // lamps
  for (const it of items.filter(t => t.type === 'L' || t.type === 'l' || t.type === 'o' || t.type === 'q')) {
    const x = C2W(it.cx), z = C2W(it.cz), horiz = !isWallCh(at(it.cx - 1, it.cz)) || !isWallCh(at(it.cx + 1, it.cz));
    rbox(horiz ? 1.4 : 0.3, 0.07, horiz ? 0.3 : 1.4, MAT.steelDark, x, H - 0.06, z, 0.015);
    const tubeMat = own(new THREE.MeshBasicMaterial({ color: new THREE.Color(E.lamp).multiplyScalar(3.2) }));
    const tube = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 1.2, 4, 10), tubeMat); if (horiz) tube.rotation.z = Math.PI / 2; else tube.rotation.x = Math.PI / 2; tube.position.set(x, H - 0.12, z); world.add(tube);
    const nW = DIRS.filter(([dx, dz]) => isWallCh(at(it.cx + dx, it.cz + dz))).length, lI = E.lampI * (nW >= 2 ? 0.32 : nW === 1 ? 0.7 : 1); // narrow corridors: walls are close, keep them from blowing out
    const light = new THREE.SpotLight(E.lamp, lI, 13, 1.05, 0.75, 1.3); light.position.set(x, H - 0.15, z); light.target.position.set(x, 0, z); world.add(light, light.target);
    const g = new THREE.CylinderGeometry(0.08, 1.4, H - 0.2, 32, 1, true); g.translate(0, -(H - 0.2) / 2, 0); const sh = new THREE.Mesh(g, own(shaftMat(E.lamp, 0.07))); sh.position.set(x, H - 0.14, z); sh.renderOrder = 5; world.add(sh);
    const L = { x, z, cx: it.cx, cz: it.cz, level: 1, want: it.type !== 'o' && it.type !== 'q', light, tubeMat, shaft: sh, col: new THREE.Color(E.lamp), I: lI, script: it.type === 'l' };
    lamps.push(L); setLamp(L, L.want ? 1 : 0);
  }
  // switches
  for (const it of items.filter(t => t.type === 'W')) { const [dx, dz] = wallDir(it.cx, it.cz); const x = C2W(it.cx) + dx * (CS / 2 - 0.06), z = C2W(it.cz) + dz * (CS / 2 - 0.06);
    const g = new THREE.Group(); g.position.set(x, 1.3, z); g.rotation.y = Math.atan2(-dx, -dz); world.add(g); rbox(0.16, 0.24, 0.06, MAT.steelDark, 0, 0, 0, 0.01, g); const lever = rbox(0.04, 0.1, 0.04, MAT.black, 0, 0.04, 0.05, 0.01, g);
    const led = new THREE.Mesh(new THREE.CircleGeometry(0.012, 10), own(new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb36a').multiplyScalar(2) }))); led.position.set(0, -0.08, 0.032); g.add(led);
    const key = it.cx + ',' + it.cz; const grp = ((lv.sw || {})[key] || []).map(s => lamps.find(L => L.cx + ',' + L.cz === s)).filter(Boolean);
    switches.push({ x, z, lever, led, grp }); }
  // gurneys (decor)
  for (const it of items.filter(t => t.type === 'G')) { let best = null; for (const [dx, dz] of DIRS) if (isWallCh(at(it.cx + dx, it.cz + dz))) { best = [dx, dz]; break; }
    const x = C2W(it.cx) + (best ? best[0] * 0.55 : 0), z = C2W(it.cz) + (best ? best[1] * 0.55 : 0); gurney(x, z, best && best[0] !== 0 ? Math.PI / 2 : 0, rnd() > 0.3); solids.push({ x, z, r: 0.75 }); }
  // autopsy tables (impassable cell)
  for (const it of items.filter(t => t.type === 't')) { const x = C2W(it.cx), z = C2W(it.cz); const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
    rbox(0.5, 0.82, 0.5, MAT.steelDark, 0, 0.41, 0, 0.02, g); rbox(2.0, 0.08, 0.8, MAT.steel, 0, 0.86, 0, 0.03, g); if (rnd() > 0.35) { const b = add(new THREE.Mesh(sheetBodyGeo(1.7, 0.6), MAT.sheet), 0, 0.92, 0, g); b.rotation.y = Math.PI / 2; rbox(0.09, 0.12, 0.07, MAT.toe, 0.9, 0.97, 0.07, 0.03, g); } }
  // desks
  for (const it of items.filter(t => t.type === 'r')) { const x = C2W(it.cx), z = C2W(it.cz); const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
    rbox(1.5, 0.05, 0.75, MAT.wood, 0, 0.76, 0, 0.01, g); for (const [a, b] of [[-0.68, -0.32], [0.68, -0.32], [-0.68, 0.32], [0.68, 0.32]]) rbox(0.05, 0.74, 0.05, MAT.wood, a, 0.37, b, 0, g);
    const cup = add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.028, 0.09, 14), own(new THREE.MeshStandardMaterial({ color: '#8a3a1c', roughness: 0.15, transparent: true, opacity: 0.85 }))), 0.4, 0.83, 0.1, g);
    rbox(0.3, 0.18, 0.18, MAT.black, -0.45, 0.88, -0.15, 0.02, g); solids.push({ x, z, r: 0.8 }); }
  // hanging sheets (laundry)
  for (const it of items.filter(t => t.type === 's')) { const x = C2W(it.cx), z = C2W(it.cz); const hz = !isWallCh(at(it.cx - 1, it.cz));
    const g = new THREE.PlaneGeometry(1.7, 1.9, 10, 8); const p = g.attributes.position; for (let k = 0; k < p.count; k++) { const yy = p.getY(k); p.setZ(k, Math.sin(p.getX(k) * 4 + it.cx) * 0.06 * (1 - (yy + 0.95) / 1.9)); } g.computeVertexNormals();
    const m = new THREE.Mesh(g, MAT.hang); m.position.set(x, H - 1.2, z); if (!hz) m.rotation.y = Math.PI / 2; m.castShadow = true; world.add(m);
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, CS, 6), MAT.black); w.rotation.z = Math.PI / 2; if (!hz) w.rotation.set(Math.PI / 2, 0, 0); w.position.set(x, H - 0.24, z); world.add(w); }
  // wall phones (checkpoints)
  for (const it of items.filter(t => t.type === 'P')) { const dir = wallDir(it.cx, it.cz);
    const x = C2W(it.cx) + dir[0] * (CS / 2 - 0.08), z = C2W(it.cz) + dir[1] * (CS / 2 - 0.08), ry = Math.atan2(-dir[0], -dir[1]);
    const g = new THREE.Group(); g.position.set(x, 1.35, z); g.rotation.y = ry; world.add(g);
    rbox(0.24, 0.34, 0.1, MAT.red, 0, 0, 0, 0.02, g); rbox(0.07, 0.26, 0.07, MAT.black, -0.06, 0.0, 0.07, 0.03, g); rbox(0.08, 0.12, 0.01, MAT.paper, 0.05, 0.03, 0.055, 0.005, g);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), own(new THREE.MeshBasicMaterial({ color: new THREE.Color('#5cff9a').multiplyScalar(2.2) }))); led.position.set(0.07, 0.13, 0.055); g.add(led);
    phones.push({ cx: it.cx, cz: it.cz, x: C2W(it.cx), z: C2W(it.cz), wx: x, wz: z, idx: phones.length, used: false, led, yaw: ry + Math.PI }); }
  // künyeler: the first three lie on the floor, the last two are hidden inside containers
  const hiddenK = [];
  for (const it of items.filter(t => t.type === 'K')) { const idx = kunyeler.length; const x = C2W(it.cx) + (rnd() - 0.5) * 0.6, z = C2W(it.cz) + (rnd() - 0.5) * 0.6;
    const g = new THREE.Group(); g.position.set(x, 0.02, z); g.rotation.y = rnd() * 6; world.add(g); rbox(0.12, 0.012, 0.075, MAT.tagGlow, 0, 0, 0, 0.004, g); const str = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.003, 4, 16), MAT.black); str.rotation.x = Math.PI / 2; str.position.x = -0.1; g.add(str);
    const id = LVI + '-' + idx, had = !!SAVE.kunye[id]; const k = { x, z, g, got: had, id, data: lv.kunye[idx % lv.kunye.length], inBox: idx >= 3 };
    if (k.inBox) { g.visible = false; hiddenK.push(k); } else g.visible = !had; kunyeler.push(k); }
  // notes lie on small tables
  for (const it of items.filter(t => t.type === 'N')) { const x = C2W(it.cx), z = C2W(it.cz); const g = tableAt(x, z); const vis = [rbox(0.2, 0.004, 0.28, MAT.paper, 0.03, 0.754, 0.02, 0.002, g)]; vis[0].rotation.y = rnd() - 0.5;
    const o = { type: 'N', x, z, g, vis, got: false, idx: pickups.length, ni: notes.length }; notes.push(o); pickups.push(o); solids.push({ x, z, r: 0.55 }); }
  buildDoors(); buildContainers(hiddenK);
  // valves
  for (const it of items.filter(t => t.type === 'V')) { const [dx, dz] = wallDir(it.cx, it.cz); const x = C2W(it.cx) + dx * (CS / 2 - 0.18), z = C2W(it.cz) + dz * (CS / 2 - 0.18);
    const g = new THREE.Group(); g.position.set(x, 1.25, z); g.rotation.y = Math.atan2(-dx, -dz); world.add(g);
    const pipe = add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 12), MAT.rust), 0, 0, -0.08, g);
    const wheel = new THREE.Group(); wheel.position.z = 0.06; g.add(wheel); const wm = own(new THREE.MeshStandardMaterial({ color: '#9a2e22', roughness: 0.45, metalness: 0.5, emissive: '#3a0e08', emissiveIntensity: 0.6 }));
    add(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 28), wm), 0, 0, 0, wheel); for (let s = 0; s < 3; s++) { const sp = rbox(0.4, 0.025, 0.02, wm, 0, 0, 0, 0, wheel); sp.rotation.z = s * Math.PI / 3; }
    valves.push({ x, z, wheel, turned: false, spin: 0, idx: valves.length }); }
  // bottles
  for (const it of items.filter(t => t.type === 'T')) { const x = C2W(it.cx) + (rnd() - 0.5) * 0.5, z = C2W(it.cz) + (rnd() - 0.5) * 0.5; const m = bottleMesh(); m.position.set(x, 0, z); m.rotation.z = Math.PI / 2; m.rotation.y = rnd() * 6; m.position.y = 0.035; world.add(m); bottlesW.push({ x, z, m, got: false }); }
  // steam vents
  for (const it of items.filter(t => t.type === 'U')) { const x = C2W(it.cx), z = C2W(it.cz); rbox(0.7, 0.03, 0.7, MAT.rack, x, 0.015, z, 0.01); const sp = [];
    for (let k = 0; k < 14; k++) { const s = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: steamTex, color: '#ffd8b8', transparent: true, opacity: 0, depthWrite: false }))); s.userData = { ph: rnd(), ox: (rnd() - 0.5) * 0.5, oz: (rnd() - 0.5) * 0.5 }; world.add(s); sp.push(s); }
    vents.push({ x, z, sp }); }
  // sedyes
  for (const it of items.filter(t => t.type === 'Y')) { const horiz = passable(it.cx - 1, it.cz) || passable(it.cx + 1, it.cz); const [ax, az] = horiz ? [1, 0] : [0, 1];
    let a = 0, b = 0; while (a < 8 && passable(it.cx - ax * (a + 1), it.cz - az * (a + 1)) && at(it.cx - ax * (a + 1), it.cz - az * (a + 1)) !== 'R') a++; while (b < 8 && passable(it.cx + ax * (b + 1), it.cz + az * (b + 1)) && at(it.cx + ax * (b + 1), it.cz + az * (b + 1)) !== 'R') b++;
    const g = gurney(C2W(it.cx), C2W(it.cz), horiz ? 0 : Math.PI / 2, true);
    sedyes.push({ g, ax, az, x0: C2W(it.cx - ax * a), z0: C2W(it.cz - az * a), x1: C2W(it.cx + ax * b), z1: C2W(it.cz + az * b), t: rnd(), dir: 1, wait: 0, x: C2W(it.cx), z: C2W(it.cz) }); }
  // door (R) + exit (X)
  { const it = items.find(t => t.type === 'R'); const alongX = !isWallCh(at(it.cx - 1, it.cz)) && !isWallCh(at(it.cx + 1, it.cz));
    door = { cx: it.cx, cz: it.cz, x: C2W(it.cx), z: C2W(it.cz), open: 0, unlocked: false, g: new THREE.Group() };
    door.g.position.set(door.x, 0, door.z); if (!alongX) door.g.rotation.y = Math.PI / 2; world.add(door.g); rbox(0.12, H, CS, MAT.steelDark, 0, H / 2, 0, 0, door.g);
    door.l = rbox(0.06, 2.3, 0.78, MAT.steel, 0, 1.15, -0.4, 0.01, door.g); door.r = rbox(0.06, 2.3, 0.78, MAT.steel, 0, 1.15, 0.4, 0.01, door.g);
    door.pm = own(new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff6b4a').multiplyScalar(1.6) }));
    if (lv.doorSign) for (const s of [-1, 1]) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.3), signMat(lv.doorSign, { bg: '#1d4a2c', fg: '#eef3e6' })); pl.position.set(s * 0.08, 2.62, 0); pl.rotation.y = s * Math.PI / 2; door.g.add(pl); }
    for (const s of [-1, 1]) { const pn = new THREE.Mesh(new THREE.CircleGeometry(0.03, 12), door.pm); pn.position.set(s * 0.09, 1.3, 1.1); pn.rotation.y = s * Math.PI / 2; door.g.add(pn); rbox(0.04, 0.16, 0.1, MAT.black, s * 0.075, 1.3, 1.1, 0.01, door.g); } }
  { exitIt = items.find(t => t.type === 'X'); const x = C2W(exitIt.cx), z = C2W(exitIt.cz); const [dx, dz] = (() => { for (const [ddx, ddz] of DIRS) if (!isWallCh(at(exitIt.cx + ddx, exitIt.cz + ddz))) return [ddx, ddz]; return [1, 0]; })();
    const pl = new THREE.PointLight('#ffb667', 14, 7, 1.5); pl.position.set(x + dx * 1.4, 2.2, z + dz * 1.4); world.add(pl);
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(CS, H), own(new THREE.MeshStandardMaterial({ color: '#8a7a62', roughness: 0.4, metalness: 0.6, emissive: '#3a2a14', emissiveIntensity: 0.4 }))); ew.rotation.y = Math.atan2(dx, dz); ew.position.set(x + dx * 0.95, H / 2, z + dz * 0.95); world.add(ew);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.1), own(new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd49a').multiplyScalar(3) }))); strip.rotation.x = Math.PI / 2; strip.rotation.z = Math.atan2(dx, dz); strip.position.set(x + dx * 1.8, H - 0.02, z + dz * 1.8); world.add(strip); }
  // enemies
  for (const it of items.filter(t => t.type === 'E' || t.type === 'A' || t.type === 'l' || t.type === 'q')) { const A = it.type === 'A'; const m = carsafliMesh(A); world.add(m); enemies.push({ kind: A ? 'A' : 'E', home: [it.cx, it.cz], m, x: 0, z: 0, yaw: 0, state: 'patrol', path: [], target: null, wait: 0, sway: rnd() * 6, patrol: [], pi: 0, sawHide: false, small: it.type === 'q', sus: 0, hs: 2.5 }); }
  // dust motes in lit areas
  if (lamps.length) { const n = isTouch ? 400 : 1100, pos = new Float32Array(n * 3); for (let k = 0; k < n; k++) { const L = lamps[k % lamps.length]; pos[k * 3] = L.x + (rnd() - 0.5) * 2.4; pos[k * 3 + 1] = rnd() * H; pos[k * 3 + 2] = L.z + (rnd() - 0.5) * 2.4; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); world.add(new THREE.Points(g, own(new THREE.PointsMaterial({ color: lv.env.lamp, size: 0.012, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending })))); }
  dressLevel();
  assignAudio();
}
function bottleMesh() { const g = new THREE.Group(); const b = add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.13, 12), MAT.bottle), 0, 0, 0, g); add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.05, 10), MAT.bottle), 0, 0.085, 0, g); return g; }
function setLamp(L, lev) { L.level = lev; L.light.intensity = L.I * lev; L.tubeMat.color.setRGB(L.col.r * 3.2 * lev + 0.16 * (1 - lev), L.col.g * 3.2 * lev + 0.18 * (1 - lev), L.col.b * 3.2 * lev + 0.18 * (1 - lev)); L.shaft.material.uniforms.a.value = 0.07 * lev; }
function resetEnemies() { for (const e of enemies) { e.x = C2W(e.home[0]); e.z = C2W(e.home[1]); e.state = 'patrol'; e.path = []; e.wait = 1 + rnd() * 2; e.sawHide = false; e.yaw = Math.PI; e.pi = 0; e.m.position.set(e.x, 0, e.z);
  e.patrol = []; const reach = bfsCells(e.home[0], e.home[1], e.small ? 1 : e.kind === 'A' ? 5 : 7); for (let k = 0; k < 4; k++) e.patrol.push(reach[(rnd() * reach.length) | 0]); } }


// ================= CONTAINERS (search to find things) =================
const FLAVOR = ['Boş.', 'Boş. İçi buz gibi.', 'Bir lastik eldiven. Tek.', 'Paslı bir makas.', 'Eski bir gazete. Tarih: 14 Şubat 1987.', 'Bir çift naylon terlik.', 'Toz. Bir de saç tokası.', 'Plastik bir martı oyuncağı.', 'Kırık bir termometre.', 'Bir paket kesme şeker, yarısı yenmiş.', 'Boş bir çay bardağı.', 'Katlanmış bir nöbet çizelgesi. Her gece aynı isim: Nuri.', 'Bir rulo sargı bezi.', 'Boş. Arkada çizik izleri var.', 'Bir tespih. İpi kopmuş.', 'Bir avuç bozuk para.'];
const MAT_CAB = [new THREE.MeshStandardMaterial({ color: '#7d8a80', roughness: 0.5, metalness: 0.6 }), new THREE.MeshStandardMaterial({ color: '#a39d88', roughness: 0.55, metalness: 0.5 }), new THREE.MeshStandardMaterial({ color: '#5d6d72', roughness: 0.5, metalness: 0.6 })];
const MAT_CAB_IN = new THREE.MeshStandardMaterial({ color: '#1c2124', roughness: 0.8 });
function contentMesh(c, parent, y, zz) { const t = c.content.t; let m = null;
  if (t === 'key') { const n = lv.need.ch; m = n === 'F' ? add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.08, 12), MAT.card), 0, y + 0.02, zz, parent) : rbox(0.085, 0.004, 0.054, MAT.card, 0, y + 0.004, zz, 0.003, parent); if (n === 'F') m.rotation.z = Math.PI / 2; }
  else if (t === 'bat') m = rbox(0.07, 0.02, 0.13, MAT.black, 0, y + 0.01, zz, 0.008, parent);
  else if (t === 'bottle') { m = bottleMesh(); m.position.set(0, y + 0.07, zz); parent.add(m); }
  else if (t === 'kunye') m = rbox(0.12, 0.012, 0.075, MAT.tagGlow, 0, y + 0.006, zz, 0.004, parent);
  c.cm = m; }
function cabinetAt(cx, cz, wd) { const [dx, dz] = wd; const x = C2W(cx) + dx * (CS / 2 - 0.26), z = C2W(cz) + dz * (CS / 2 - 0.26);
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = Math.atan2(-dx, -dz); world.add(g); const mat = MAT_CAB[(cx * 3 + cz) % 3];
  rbox(0.9, 1.86, 0.02, mat, 0, 0.93, -0.215, 0, g); rbox(0.02, 1.86, 0.45, mat, -0.44, 0.93, 0, 0, g); rbox(0.02, 1.86, 0.45, mat, 0.44, 0.93, 0, 0, g); rbox(0.9, 0.03, 0.45, mat, 0, 1.845, 0, 0, g); rbox(0.9, 0.08, 0.45, mat, 0, 0.04, 0, 0, g);
  rbox(0.86, 0.02, 0.42, MAT_CAB_IN, 0, 1.0, 0, 0, g); rbox(0.86, 1.78, 0.01, MAT_CAB_IN, 0, 0.93, -0.2, 0, g);
  const doors = []; for (const s of [-1, 1]) { const pv = new THREE.Group(); pv.position.set(s * 0.44, 0, 0.225); g.add(pv); rbox(0.43, 1.76, 0.025, mat, -s * 0.215, 0.95, 0, 0.004, pv); rbox(0.02, 0.14, 0.03, MAT.steelDark, -s * 0.39, 1.0, 0.02, 0.006, pv); for (let v = 0; v < 4; v++) rbox(0.25, 0.012, 0.02, MAT.black, -s * 0.215, 1.62 + v * 0.04, 0.012, 0, pv); doors.push({ pv, s }); }
  const c = { kind: 'cab', g, doors, x: x - dx * 0.5, z: z - dz * 0.5, cxw: x, czw: z, rx: -dx, rz: -dz, opened: false, anim: 0, y: 1.0 };
  solids.push({ x, z, r: 0.42 }); return c; }
function deskAt(cx, cz) { const x = C2W(cx), z = C2W(cz); const g = tableAt(x, z); const dr = new THREE.Group(); dr.position.set(0, 0.62, 0.0); g.add(dr);
  rbox(0.6, 0.12, 0.5, MAT.steel, 0, 0, 0.02, 0.01, dr); rbox(0.14, 0.02, 0.02, MAT.black, 0, 0, 0.29, 0.006, dr);
  const c = { kind: 'desk', g, dr, x, z, cxw: x, czw: z, rx: 0, rz: 1, opened: false, anim: 0, y: 0.06 }; solids.push({ x, z, r: 0.55 }); return c; }
function morgDrawerAt(x, z, dx, dz) { // a pull-out drawer in a drawer wall; (x,z) = wall face, (dx,dz) points from wall into the room... inverted below
  const g = new THREE.Group(); g.position.set(x, 1.07, z); g.rotation.y = Math.atan2(dx, dz); world.add(g); const box = new THREE.Group(); g.add(box);
  rbox(0.57, 0.55, 0.06, MAT.steel, 0, 0, 0.175, 0.015, box); rbox(0.3, 0.035, 0.05, MAT.steel, 0, 0.16, 0.22, 0.012, box); rbox(0.12, 0.075, 0.008, MAT.tag, -0.18, -0.17, 0.21, 0.002, box);
  rbox(0.55, 0.04, 1.9, MAT.steelDark, 0, -0.25, -0.8, 0.01, box); rbox(0.02, 0.2, 1.9, MAT.steelDark, -0.27, -0.15, -0.8, 0, box); rbox(0.02, 0.2, 1.9, MAT.steelDark, 0.27, -0.15, -0.8, 0, box);
  const c = { kind: 'drawer', g, box, x: x + dx * 0.55, z: z + dz * 0.55, cxw: x, czw: z, rx: dx, rz: dz, opened: false, anim: 0, y: -0.23 }; return c; }
function buildContainers(hiddenK) {
  const used = new Set(); const near = (cx, cz, chs, r = 1) => { for (let z = -r; z <= r; z++) for (let x = -r; x <= r; x++) if (chs.includes(at(cx + x, cz + z))) return true; return false; };
  const wd1 = (cx, cz) => { let w = null, n = 0; for (const [dx, dz] of DIRS) if (isWallCh(at(cx + dx, cz + dz)) && at(cx + dx, cz + dz) !== 'X') { n++; if (!w) w = [dx, dz]; } return [w, n]; };
  const make = (cx, cz, content, allowDesk) => { if (doorCells.has(cx + ',' + cz) && content.t === 'empty') return null; const [w, n] = wd1(cx, cz); const okWall = w && n <= 2 && !'HDQOMX'.includes(at(cx + w[0], cz + w[1]));
    const c = okWall ? cabinetAt(cx, cz, w) : allowDesk ? deskAt(cx, cz) : null; if (!c) return null; c.content = content; c.idx = containers.length; containers.push(c); used.add(cx + ',' + cz); return c; };
  for (const it of items.filter(t => 'CFB'.includes(t.type))) { if (lv.noBox) { const x = C2W(it.cx), z = C2W(it.cz); const g = tableAt(x, z); rbox(0.36, 0.015, 0.26, MAT.steel, 0, 0.758, 0, 0.004, g);
      const tost = new THREE.Group(); tost.position.set(0, 0.77, 0); g.add(tost); rbox(0.2, 0.05, 0.12, MAT.box, 0, 0.025, 0, 0.02, tost); rbox(0.18, 0.012, 0.11, MAT.paper, 0, 0.056, 0, 0.004, tost); tost.visible = false;
      const glass = add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.024, 0.09, 14), own(new THREE.MeshStandardMaterial({ color: '#8a3a1c', roughness: 0.1, transparent: true, opacity: 0.85 }))), 0.12, 0.81, 0.06, g);
      const o = { type: it.type, x, z, g, vis: [], show: tost, got: false, idx: pickups.length }; pickups.push(o); solids.push({ x, z, r: 0.55 }); continue; }
    make(it.cx, it.cz, it.type === 'B' ? { t: 'bat', big: true } : { t: 'key' }, true); }
  if (lv.noBox) return;
  // extra cabinets along room edges (never in 1-wide corridors, never next to doors, phones, lockers)
  const cand = []; for (let z = 1; z < ROWS - 1; z++) for (let x = 1; x < COLS - 1; x++) { if (at(x, z) !== '.') continue; const [w, n] = wd1(x, z); if (!w || n > 2) continue; let pn = 0; for (const [dx, dz] of DIRS) if (passable(x + dx, z + dz)) pn++; if (pn < 2) continue; const corridor = isWallCh(at(x - w[0], z - w[1])); if (n === 2 && !corridor) continue; if (corridor && (pn < 2 || items.some(t => t.type === 'Y' && (t.cz === z || t.cx === x)))) continue; if (near(x, z, 'PWVRXHStGYrNKTU', 1) || doorCells.has(x + ',' + z)) continue; if ('DQO'.includes(at(x + w[0], z + w[1]))) continue; cand.push([x, z, rnd()]); }
  cand.sort((a, b) => a[2] - b[2]); const target = lv.calm ? 9 : 14;
  for (const [x, z] of cand) { if (containers.length >= target + 3) break; if (containers.some(c => Math.abs(W2C(c.cxw) - x) < 3 && Math.abs(W2C(c.czw) - z) < 3)) continue; make(x, z, { t: 'empty' }, false); }
  // morgue drawers: one searchable drawer on every drawer wall face (capped)
  const faces = []; for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) if (at(x, z) === 'D') for (const [dx, dz] of DIRS) { if (isWallCh(at(x + dx, z + dz)) || at(x + dx, z + dz) === 't') continue; faces.push([x, z, dx, dz, rnd()]); }
  faces.sort((a, b) => a[4] - b[4]); for (const [x, z, dx, dz] of faces.slice(0, 14)) { const c = morgDrawerAt(C2W(x) + dx * CS / 2, C2W(z) + dz * CS / 2, dx, dz); c.content = { t: 'empty' }; c.idx = containers.length; containers.push(c); }
  // contents
  const pool = containers.filter(c => c.content.t === 'empty').map(c => [c, rnd()]).sort((a, b) => a[1] - b[1]).map(a => a[0]);
  const take = pref => { let i = pool.findIndex(c => c.kind === pref); if (i < 0) i = 0; return pool.length ? pool.splice(i, 1)[0] : null; };
  for (const k of hiddenK) { const c = take('cab'); if (c) c.content = { t: 'kunye', k }; else { k.inBox = false; k.g.visible = !k.got; } }
  const nScare = lv.calm ? 0 : LVI === 0 ? 1 : 2; for (let s = 0; s < nScare; s++) { const c = take(s === 0 ? 'drawer' : 'cab'); if (c) c.content = { t: 'scare' }; }
  for (let s = 0; s < 2; s++) { const c = take('cab'); if (c) c.content = { t: 'bat' }; }
  if (LVI >= 2) for (let s = 0; s < 2; s++) { const c = take('cab'); if (c) c.content = { t: 'bottle' }; }
  for (const c of pool) { c.content = rnd() < 0.3 && c.kind === 'drawer' ? { t: 'body' } : { t: 'empty', f: (rnd() * FLAVOR.length) | 0 }; }
  for (const c of containers) { if (c.kind === 'cab') contentMesh(c, c.g, 1.01, 0); else if (c.kind === 'desk') contentMesh(c, c.dr, 0.06, 0.02); else { if (c.content.t === 'body' || c.content.t === 'scare') { const piv = new THREE.Group(); piv.position.set(0, -0.2, -1.5); c.box.add(piv); add(new THREE.Mesh(sheetBodyGeo(1.7, 0.55), MAT.sheet), 0, 0.02, 0.86, piv); c.piv = piv; } else contentMesh(c, c.box, -0.23, -0.25); } }
}

// ================= NAV =================
function bfsCells(sx, sz, maxD) { const seen = new Set([sx + ',' + sz]), q = [[sx, sz, 0]], out = []; while (q.length) { const [x, z, d] = q.shift(); out.push([x, z]); if (d >= maxD) continue; for (const [dx, dz] of DIRS) { const k = (x + dx) + ',' + (z + dz); if (!seen.has(k) && passable(x + dx, z + dz) && at(x + dx, z + dz) !== 'R') { seen.add(k); q.push([x + dx, z + dz, d + 1]); } } } return out; }
function path(sx, sz, tx, tz) { const key = (x, z) => z * COLS + x; const prev = new Map([[key(sx, sz), -1]]); const q = [[sx, sz]]; let qi = 0; while (qi < q.length) { const [x, z] = q[qi++]; if (x === tx && z === tz) break; for (const [dx, dz] of DIRS) { const nx = x + dx, nz = z + dz, k = key(nx, nz); if (!prev.has(k) && passable(nx, nz)) { prev.set(k, key(x, z)); q.push([nx, nz]); } } }
  if (!prev.has(key(tx, tz))) return []; const out = []; let k = key(tx, tz); while (k !== -1 && k !== key(sx, sz)) { out.push([k % COLS, (k / COLS) | 0]); k = prev.get(k); } return out.reverse(); }
function los(ax, az, bx, bz) { const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.25); for (let i = 1; i < n; i++) { const t = i / n; if (!passable(W2C(ax + (bx - ax) * t), W2C(az + (bz - az) * t))) return false; } return true; }
function litAt(x, z) { let v = 0; for (const L of lamps) { const d = Math.hypot(L.x - x, L.z - z); if (d < 3.2) v = Math.max(v, L.level * (1 - Math.max(0, d - 2.0) / 1.2)); } return v; }

// ================= PLAYER =================
const P = { x: 0, z: 0, yaw: 0, pitch: 0, crouch: 0, run: false, hidden: null, torch: false, bat: 100, keys: 0, cp: null, steps: 0, breath: 1, detectT: 0, time: 0, bottles: 0 };
function respawn() { const st = items.find(t => t.type === 'S'); const c = P.cp || { x: C2W(st.cx), z: C2W(st.cz), yaw: startYaw() }; P.x = c.x; P.z = c.z; P.yaw = c.yaw ?? 0; P.pitch = 0; P.hidden = null; P.crouch = 0; P.breath = 1; P.detectT = 0; slats.visible = false; handsRoot.visible = true; resetEnemies(); for (const s of sedyes) { s.t = 0; s.dir = 1; s.wait = 2; } }
function startYaw() { const st = items.find(t => t.type === 'S'); let best = 0, bl = -1; for (const [dx, dz] of DIRS) { let l = 0; while (l < 8 && passable(st.cx + dx * (l + 1), st.cz + dz * (l + 1))) l++; if (l > bl) { bl = l; best = Math.atan2(-dx, -dz); } } return best; }

// ================= DRESSING: old Turkish hospital look, rooms, doors, signs, props =================
// Rooms come from chapter data: [x0, z0, x1, z1, theme, signName]. Cells outside every room use lv.th0 (default 'corr').
const TEX = {};
function texPaint(base, chip, stripe) { return canvasTex(512, 512, (k, w, h) => { k.fillStyle = base; k.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) { k.fillStyle = `rgba(0,0,0,${rnd() * 0.035})`; k.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1); }
  for (let i = 0; i < 70; i++) { const x = rnd() * w, y = h * 0.35 + rnd() * h * 0.65, l = 8 + rnd() * 40; k.strokeStyle = `rgba(20,20,16,${0.12 + rnd() * 0.18})`; k.lineWidth = 1 + rnd() * 1.5; k.beginPath(); k.moveTo(x, y); k.lineTo(x + l, y + (rnd() - 0.5) * 4); k.stroke(); } // scuffs from gurneys
  for (let i = 0; i < 14; i++) { const x = rnd() * w, y = rnd() * h, r = 3 + rnd() * 10; k.fillStyle = chip; k.beginPath(); k.ellipse(x, y, r, r * (0.4 + rnd() * 0.5), rnd() * 3, 0, 7); k.fill(); }
  grime(k, w, h, 18, 0.04, 0.16, 'rgba(30,30,18,A)'); drips(k, w, h, 14, 'rgba(40,36,20,A)');
  if (stripe) { k.fillStyle = stripe; k.fillRect(0, 0, w, 10); } }); }
TEX.paintG = texPaint('#5f7f6c', 'rgba(205,200,180,.55)', '#3b4f43');
TEX.paintB = texPaint('#5b7685', 'rgba(205,200,180,.5)', '#394a54');
TEX.paintC = canvasTex(512, 512, (k, w, h) => { k.fillStyle = '#b8b09a'; k.fillRect(0, 0, w, h); for (let i = 0; i < 4000; i++) { k.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,240' : '60,50,30'},${rnd() * 0.05})`; k.fillRect(rnd() * w, rnd() * h, 2, 2); }
  grime(k, w, h, 26, 0.05, 0.2, 'rgba(90,70,30,A)'); drips(k, w, h, 28, 'rgba(80,64,30,A)');
  k.strokeStyle = 'rgba(60,50,36,.35)'; k.lineWidth = 1.2; for (let i = 0; i < 5; i++) { let x = rnd() * w, y = rnd() * h * 0.6; k.beginPath(); k.moveTo(x, y); for (let s = 0; s < 8; s++) { x += (rnd() - 0.5) * 30; y += 8 + rnd() * 16; k.lineTo(x, y); } k.stroke(); } });
TEX.wood = canvasTex(512, 512, (k, w, h) => { const n = 8; for (let i = 0; i < n; i++) { const v = 0.85 + rnd() * 0.2; k.fillStyle = `rgb(${92 * v | 0},${62 * v | 0},${40 * v | 0})`; k.fillRect(i * w / n, 0, w / n, h);
    for (let j = 0; j < 40; j++) { k.strokeStyle = `rgba(40,24,12,${rnd() * 0.25})`; k.lineWidth = 1; k.beginPath(); const x = i * w / n + rnd() * w / n; k.moveTo(x, 0); k.bezierCurveTo(x + (rnd() - 0.5) * 10, h * 0.3, x + (rnd() - 0.5) * 10, h * 0.6, x + (rnd() - 0.5) * 8, h); k.stroke(); }
    k.fillStyle = 'rgba(20,12,6,.6)'; k.fillRect(i * w / n, 0, 3, h); } grime(k, w, h, 10, 0.05, 0.15, 'rgba(10,6,2,A)'); });
TEX.conc = canvasTex(512, 512, (k, w, h) => { k.fillStyle = '#5d605c'; k.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { const v = 60 + rnd() * 60; k.fillStyle = `rgba(${v},${v},${v - 4},${rnd() * 0.25})`; k.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
  grime(k, w, h, 30, 0.05, 0.25, 'rgba(20,22,20,A)'); drips(k, w, h, 20, 'rgba(30,30,24,A)'); k.fillStyle = 'rgba(0,0,0,.25)'; k.fillRect(0, h / 2 - 1, w, 2); });
TEX.brick = canvasTex(512, 512, (k, w, h) => { k.fillStyle = '#2a1f1a'; k.fillRect(0, 0, w, h); const bw = 64, bh = 26; for (let r = 0; r < h / bh; r++) for (let c = -1; c < w / bw + 1; c++) { const v = 0.75 + rnd() * 0.35; k.fillStyle = `rgb(${120 * v | 0},${58 * v | 0},${40 * v | 0})`; k.fillRect(c * bw + (r % 2) * bw / 2 + 2, r * bh + 2, bw - 4, bh - 4); }
  grime(k, w, h, 30, 0.1, 0.35, 'rgba(10,6,4,A)'); });
TEX.terrazzo = canvasTex(1024, 1024, (k, w, h) => { k.fillStyle = '#7d7a70'; k.fillRect(0, 0, w, h); for (let i = 0; i < 26000; i++) { const t = rnd(); k.fillStyle = t < 0.4 ? `rgba(40,38,34,${0.4 + rnd() * 0.5})` : t < 0.7 ? `rgba(200,195,180,${0.4 + rnd() * 0.5})` : t < 0.85 ? `rgba(120,60,40,${0.3 + rnd() * 0.4})` : `rgba(60,90,80,${0.3 + rnd() * 0.4})`; const s = 1 + rnd() * 4; k.fillRect(rnd() * w, rnd() * h, s, s * (0.6 + rnd() * 0.6)); }
  k.strokeStyle = 'rgba(160,150,120,.6)'; k.lineWidth = 3; for (let i = 0; i <= 2; i++) { k.beginPath(); k.moveTo(i * w / 2, 0); k.lineTo(i * w / 2, h); k.stroke(); k.beginPath(); k.moveTo(0, i * h / 2); k.lineTo(w, i * h / 2); k.stroke(); }
  grime(k, w, h, 40, 0.06, 0.25, 'rgba(20,18,14,A)'); });
TEX.lino = canvasTex(512, 512, (k, w, h) => { const n = 8, s = w / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { k.fillStyle = (i + j) % 2 ? '#8f8770' : '#4f6458'; k.fillRect(i * s, j * s, s, s); }
  for (let i = 0; i < 5000; i++) { k.fillStyle = `rgba(0,0,0,${rnd() * 0.06})`; k.fillRect(rnd() * w, rnd() * h, 2, 2); } grime(k, w, h, 30, 0.08, 0.3, 'rgba(20,18,12,A)'); });
TEX.tileF = canvasTex(512, 512, (k, w, h) => { k.fillStyle = '#3c4441'; k.fillRect(0, 0, w, h); const n = 8, s = w / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = 0.8 + rnd() * 0.2; k.fillStyle = `rgb(${128 * v | 0},${140 * v | 0},${134 * v | 0})`; k.fillRect(i * s + 2, j * s + 2, s - 4, s - 4); }
  grime(k, w, h, 30, 0.08, 0.3, 'rgba(20,24,20,A)'); k.fillStyle = 'rgba(10,12,12,.7)'; k.beginPath(); k.arc(w / 2, h / 2, 9, 0, 7); k.fill(); }); // floor drain
TEX.panel = canvasTex(512, 512, (k, w, h) => { k.fillStyle = '#6f6c62'; k.fillRect(0, 0, w, h); const s = w / 2; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { k.fillStyle = `rgb(${150 + rnd() * 14 | 0},${146 + rnd() * 12 | 0},${132 + rnd() * 10 | 0})`; k.fillRect(i * s + 4, j * s + 4, s - 8, s - 8); for (let q = 0; q < 900; q++) { k.fillStyle = 'rgba(60,56,46,.25)'; k.fillRect(i * s + 4 + rnd() * (s - 8), j * s + 4 + rnd() * (s - 8), 1.5, 1.5); } }
  grime(k, w, h, 6, 0.1, 0.3, 'rgba(110,80,30,A)'); }); // water stains
TEX.carpet = canvasTex(256, 256, (k, w, h) => { k.fillStyle = '#5a2a26'; k.fillRect(0, 0, w, h); for (let i = 0; i < 6000; i++) { k.fillStyle = `rgba(${rnd() < 0.5 ? '30,10,8' : '140,80,50'},${rnd() * 0.2})`; k.fillRect(rnd() * w, rnd() * h, 1, 1); } k.strokeStyle = 'rgba(200,160,80,.35)'; k.lineWidth = 6; k.strokeRect(14, 14, w - 28, h - 28); });
TEX.grate = canvasTex(256, 256, (k, w, h) => { k.fillStyle = '#141414'; k.fillRect(0, 0, w, h); k.fillStyle = '#5c544c'; for (let i = 0; i < 16; i++) { k.fillRect(i * 16, 0, 5, h); k.fillRect(0, i * 16, w, 3); } grime(k, w, h, 10, 0.1, 0.4, 'rgba(90,50,20,A)'); });
const MATW = {}; for (const [k2, t] of Object.entries(TEX)) MATW[k2] = new THREE.MeshStandardMaterial({ map: t, roughness: k2 === 'terrazzo' || k2 === 'tileF' ? 0.5 : k2 === 'lino' ? 0.6 : 0.9, metalness: k2 === 'grate' ? 0.6 : 0 });
MATW.tile = MAT.tile;
const THEMES = { // lower wall, upper wall, floor, ceiling
  corr: ['paintG', 'paintC', 'terrazzo', 'panel'], cold: ['tile', 'tile', 'tileF', 'conc'], autopsy: ['tile', 'tile', 'tileF', 'panel'], office: ['wood', 'paintC', 'lino', 'panel'],
  store: ['paintB', 'conc', 'conc', 'conc'], laundry: ['tile', 'paintC', 'tileF', 'conc'], archive: ['conc', 'conc', 'conc', 'conc'], boiler: ['brick', 'conc', 'grate', 'conc'],
  booth: ['wood', 'paintC', 'lino', 'panel'], chapel: ['wood', 'paintC', 'carpet', 'panel'], lift: ['paintB', 'paintC', 'terrazzo', 'panel'], locker: ['paintB', 'paintC', 'lino', 'panel'] };
let roomIdx = null;
function buildRoomIndex() { roomIdx = new Int16Array(ROWS * COLS).fill(-1); (lv.rooms || []).forEach((r, i) => { for (let z = r[1]; z <= r[3]; z++) for (let x = r[0]; x <= r[2]; x++) if (x >= 0 && z >= 0 && x < COLS && z < ROWS) roomIdx[z * COLS + x] = i; }); }
const roomOf = (cx, cz) => (cx < 0 || cz < 0 || cx >= COLS || cz >= ROWS) ? -1 : roomIdx[cz * COLS + cx];
const themeOf = (cx, cz) => { const r = roomOf(cx, cz); return r >= 0 ? lv.rooms[r][4] : (lv.th0 || 'corr'); };

// --- text textures (signs, posters, clocks)
function signTex(text, o = {}) { const W = o.w || 512, Hh = o.h || 128; return canvasTex(W, Hh, (k, w, h) => {
  k.fillStyle = o.bg || '#e9e4d2'; k.fillRect(0, 0, w, h); k.strokeStyle = o.fg || '#1c3a52'; k.lineWidth = 8; k.strokeRect(8, 8, w - 16, h - 16);
  k.fillStyle = o.fg || '#1c3a52'; k.textAlign = 'center'; k.textBaseline = 'middle'; const lines = String(text).split('\n'); const fs = o.fs || Math.min(64, (h - 30) / lines.length);
  k.font = `700 ${fs}px "Arial Narrow", Arial, sans-serif`; lines.forEach((L, i) => k.fillText(L, w / 2, h / 2 + (i - (lines.length - 1) / 2) * fs * 1.1, w - 40));
  grime(k, w, h, 6, 0.05, 0.18, 'rgba(60,50,30,A)'); }); }
const _signCache = {};
function signMat(text, o) { const key = text + JSON.stringify(o || {}); if (!_signCache[key]) _signCache[key] = new THREE.MeshStandardMaterial({ map: signTex(text, o), roughness: 0.7, emissive: '#ffffff', emissiveIntensity: 0.04, emissiveMap: null }); return _signCache[key]; }
const POSTERS = [['SESSİZ\nOLUNUZ', { bg: '#efe9d6', fg: '#7a1f17', w: 256, h: 340 }], ['EL HİJYENİ\nHAYAT\nKURTARIR', { bg: '#d9e7e0', fg: '#1f4f3a', w: 256, h: 340 }], ['ZİYARET\nSAATLERİ\n13:00\n15:00', { bg: '#e8e2cf', fg: '#2a3a52', w: 256, h: 340 }],
  ['SİGARA\nİÇİLMEZ', { bg: '#f0ebe0', fg: '#8a1c12', w: 256, h: 340 }], ['KAN\nBAĞIŞI\nHAYATTIR', { bg: '#eadbd2', fg: '#6a1a14', w: 256, h: 340 }], ['ASANSÖRÜ\nYANGINDA\nKULLANMAYINIZ', { bg: '#f1e9cf', fg: '#5a3a10', w: 256, h: 340 }]];
function clockTex(hh, mm) { return canvasTex(256, 256, (k, w, h) => { k.fillStyle = '#1b1b1b'; k.beginPath(); k.arc(128, 128, 126, 0, 7); k.fill(); k.fillStyle = '#e9e3cf'; k.beginPath(); k.arc(128, 128, 112, 0, 7); k.fill();
  k.fillStyle = '#222'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; k.save(); k.translate(128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96); k.rotate(a); k.fillRect(-3, -9, 6, 18); k.restore(); }
  const hand = (a, l, wd) => { k.save(); k.translate(128, 128); k.rotate(a); k.fillRect(-wd / 2, -l, wd, l + 12); k.restore(); }; hand((hh % 12 + mm / 60) / 12 * Math.PI * 2, 58, 9); hand(mm / 60 * Math.PI * 2, 88, 6);
  k.fillStyle = '#8a1c12'; k.beginPath(); k.arc(128, 128, 6, 0, 7); k.fill(); grime(k, w, h, 5, 0.05, 0.15, 'rgba(80,60,20,A)'); }); }

// --- shell: floors, ceilings and walls by theme (called from buildLevel)
function buildShell(G, NI) {
  buildRoomIndex();
  const F = {}, Cg = {}, WL = {}, WU = {};
  const push = (o, k, g) => { (o[k] = o[k] || []).push(g); };
  for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) { if (isWallCh(MAP[z][x])) continue; const th = THEMES[themeOf(x, z)] || THEMES.corr;
    const f = new THREE.PlaneGeometry(CS, CS); f.rotateX(-Math.PI / 2); f.translate(C2W(x), 0, C2W(z)); const uv = f.attributes.uv; const sc = th[2] === 'terrazzo' ? 0.5 : th[2] === 'carpet' ? 1 : 1; for (let k = 0; k < uv.count; k++) uv.setXY(k, (uv.getX(k) + x) * sc, (uv.getY(k) + z) * sc); push(F, th[2], f);
    const c = new THREE.PlaneGeometry(CS, CS); c.rotateX(Math.PI / 2); c.translate(C2W(x), H, C2W(z)); push(Cg, th[3], c); }
  for (const k in F) { const m = new THREE.Mesh(mergeGeometries(F[k]), MATW[k]); m.receiveShadow = true; world.add(m); }
  for (const k in Cg) { const m = new THREE.Mesh(mergeGeometries(Cg[k]), k === 'panel' ? MATW.panel : MAT.ceil); world.add(m); }
  const LO = 1.2;
  for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) { const ch = MAP[z][x]; if (!isWallCh(ch) || ch === 'Q' || ch === 'O' || ch === 'X') continue;
    for (const [dx, dz] of DIRS) { const nb = at(x + dx, z + dz); if (isWallCh(nb)) continue; const th = THEMES[themeOf(x + dx, z + dz)] || THEMES.corr;
      const fx = C2W(x) + dx * CS / 2, fz = C2W(z) + dz * CS / 2, ry = Math.atan2(dx, dz); const off = (x * 7 + z * 3) % 4;
      const mkP = (y0, y1, vs) => { const p = new THREE.PlaneGeometry(CS, y1 - y0); const uv = p.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, (uv.getX(k) + off) * 0.5, (y0 + uv.getY(k) * (y1 - y0)) * vs); p.rotateY(ry); p.translate(fx + Math.sin(ry) * 0.001, (y0 + y1) / 2, fz + Math.cos(ry) * 0.001); return p; };
      if (th[0] === th[1]) push(WL, th[0], mkP(0, H, 0.25)); else { push(WL, th[0], mkP(0, LO, 0.42)); push(WU, th[1], mkP(LO, H, 0.42)); }
    } }
  for (const k in WL) { const m = new THREE.Mesh(mergeGeometries(WL[k].map(NI)), MATW[k]); m.receiveShadow = true; world.add(m); }
  for (const k in WU) { const m = new THREE.Mesh(mergeGeometries(WU[k].map(NI)), MATW[k]); m.receiveShadow = true; world.add(m); }
}

// --- doorways between rooms: frame, ajar leaf, sign; returns set of reserved cells
const doorCells = new Set();
function buildDoors() { doorCells.clear(); const G = [], LEAF = [], done = new Set();
  const frameM = MAT.steelDark, leafM = own(new THREE.MeshStandardMaterial({ color: '#7f8c80', roughness: 0.55, metalness: 0.25 }));
  for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) { if (!passable(x, z) && at(x, z) !== 'R') continue;
    for (const [dx, dz] of [[1, 0], [0, 1]]) { const x2 = x + dx, z2 = z + dz; if (!(passable(x2, z2) || at(x2, z2) === 'R')) continue; if (roomOf(x, z) === roomOf(x2, z2)) continue; if (at(x, z) === 'R' || at(x2, z2) === 'R' || at(x, z) === 'X' || at(x2, z2) === 'X') continue;
      // 1-wide opening only: both perpendicular neighbours of both cells are walls
      const px = dz, pz = dx; const w1 = isWallCh(at(x + px, z + pz)) && isWallCh(at(x - px, z - pz)), w2 = isWallCh(at(x2 + px, z2 + pz)) && isWallCh(at(x2 - px, z2 - pz)); if (!w1 && !w2) continue;
      const key = x + ',' + z + ',' + dx; if (done.has(key)) continue; done.add(key); doorCells.add(x + ',' + z); doorCells.add(x2 + ',' + z2);
      const ex = C2W(x) + dx * CS / 2, ez = C2W(z) + dz * CS / 2; const g = new THREE.Group(); g.position.set(ex, 0, ez); g.rotation.y = dx ? Math.PI / 2 : 0; world.add(g);
      // wall pieces to narrow the 2 m opening to a 1.1 m door, plus a lintel
      for (const s of [-1, 1]) solids.push({ x: ex + (dx ? 0 : s * 0.8), z: ez + (dx ? -s * 0.8 : 0), r: 0.26 });
      for (const s of [-1, 1]) rbox(0.45, H, 0.24, MATW[THEMES[themeOf(x, z)][1]] || MATW.paintC, s * 0.775, H / 2, 0, 0, g);
      rbox(1.1, H - 2.15, 0.24, MATW[THEMES[themeOf(x, z)][1]] || MATW.paintC, 0, 2.15 + (H - 2.15) / 2, 0, 0, g);
      for (const s of [-1, 1]) rbox(0.07, 2.15, 0.3, frameM, s * 0.55, 1.075, 0, 0.01, g); rbox(1.18, 0.07, 0.3, frameM, 0, 2.15, 0, 0.01, g);
      // leaf swung open ~100 deg toward the room with more space
      const side = roomOf(x2, z2) >= 0 ? 1 : -1; const pv = new THREE.Group(); pv.position.set(-0.52, 0, side * 0.13); g.add(pv); pv.rotation.y = side * -1.75;
      rbox(1.02, 2.08, 0.045, leafM, 0.51, 1.05, 0, 0.01, pv); const win = rbox(0.28, 0.4, 0.05, MAT.glass, 0.51, 1.55, 0, 0.005, pv); rbox(0.03, 0.14, 0.06, MAT.steel, 0.92, 1.0, 0.03, 0.01, pv); rbox(0.9, 0.25, 0.05, MAT.steel, 0.51, 0.13, 0, 0.005, pv); // kick plate
      // sign: on the side of the cell that is NOT the room, naming the room
      const rA = roomOf(x, z), rB = roomOf(x2, z2); const named = rB >= 0 && lv.rooms[rB][5] ? [rB, 1] : rA >= 0 && lv.rooms[rA][5] ? [rA, -1] : null;
      if (named) { const sm = signMat(lv.rooms[named[0]][5]); const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.25), sm); pl.position.set(0, 2.45, -named[1] * 0.125); if (named[1] > 0) pl.rotation.y = Math.PI; g.add(pl); }
    } } }

// --- props
function propRadiator(g) { for (let i = 0; i < 9; i++) rbox(0.07, 0.6, 0.09, MAT.washer, -0.32 + i * 0.08, 0.5, 0, 0.02, g); rbox(0.7, 0.03, 0.03, MAT.steelDark, 0, 0.16, 0.02, 0, g); }
function propFireBox(g) { rbox(0.5, 0.75, 0.16, MAT.red, 0, 1.2, 0, 0.02, g); rbox(0.38, 0.5, 0.01, MAT.glass, 0, 1.25, 0.085, 0, g); add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.42, 14), MAT.red), 0, 1.22, 0.02, g); }
function propBench(g) { rbox(1.5, 0.05, 0.42, MAT.wood, 0, 0.45, 0.05, 0.01, g); rbox(1.5, 0.3, 0.04, MAT.wood, 0, 0.75, -0.14, 0.01, g); for (const s of [-0.65, 0.65]) rbox(0.05, 0.45, 0.4, MAT.steelDark, s, 0.22, 0.05, 0, g); }
function propPoster(g, i) { const [t, o] = POSTERS[i % POSTERS.length]; const p = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.6), signMat(t, o)); p.position.set(0, 1.6, 0.012); g.add(p); }
function propClock(g) { const t = (lv.time || '03:12').split(':').map(Number); const m = new THREE.Mesh(new THREE.CircleGeometry(0.17, 28), own(new THREE.MeshStandardMaterial({ map: clockTex(t[0], t[1]), roughness: 0.4 }))); m.position.set(0, 2.25, 0.03); g.add(m); add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 28), MAT.black), 0, 2.25, 0.005, g).rotation.x = Math.PI / 2; }
function propSink(g) { rbox(0.6, 0.18, 0.45, MAT.washer, 0, 0.85, 0.1, 0.05, g); rbox(0.04, 0.2, 0.04, MAT.steel, 0, 1.02, -0.08, 0.01, g); rbox(0.04, 0.03, 0.15, MAT.steel, 0, 1.12, 0, 0.01, g); rbox(0.45, 0.6, 0.01, MAT.glass, 0, 1.55, -0.1, 0, g); }
function propIV(g) { const s = add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.9, 8), MAT.steel), 0, 0.95, 0, g); for (let a = 0; a < 5; a++) { const l = rbox(0.3, 0.015, 0.015, MAT.steel, Math.cos(a * 1.25) * 0.15, 0.02, Math.sin(a * 1.25) * 0.15, 0, g); l.rotation.y = -a * 1.25; }
  rbox(0.1, 0.16, 0.04, own(new THREE.MeshStandardMaterial({ color: '#cfe0d8', roughness: 0.2, transparent: true, opacity: 0.7 })), 0.05, 1.75, 0, 0.02, g); }
function propWheelchair(g) { for (const s of [-0.28, 0.28]) { const w = add(new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.02, 6, 24), MAT.rubber), s, 0.3, 0, g); w.rotation.y = Math.PI / 2; }
  rbox(0.5, 0.05, 0.45, MAT.shirt, 0, 0.5, 0, 0.01, g); rbox(0.5, 0.45, 0.04, MAT.shirt, 0, 0.75, -0.22, 0.01, g); for (const s of [-0.27, 0.27]) rbox(0.03, 0.03, 0.4, MAT.steel, s, 0.72, 0, 0, g); }
function propTrolley(g) { rbox(0.7, 0.03, 0.45, MAT.steel, 0, 0.9, 0, 0.01, g); rbox(0.7, 0.03, 0.45, MAT.steel, 0, 0.45, 0, 0.01, g); for (const [a, b] of [[-0.33, -0.2], [0.33, -0.2], [-0.33, 0.2], [0.33, 0.2]]) rbox(0.025, 0.9, 0.025, MAT.steel, a, 0.45, b, 0, g);
  for (let i = 0; i < 5; i++) rbox(0.16, 0.01, 0.02, MAT.steel, -0.2 + i * 0.1, 0.92, (rnd() - 0.5) * 0.2, 0, g); }
function propCart(g) { rbox(0.9, 0.7, 0.6, own(new THREE.MeshStandardMaterial({ color: '#4c5a60', roughness: 0.7 })), 0, 0.5, 0, 0.03, g); const b = add(new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), MAT.sheet), 0, 0.82, 0, g); b.scale.set(1.0, 0.45, 0.7); }
function propShelf(g) { for (const [a, b] of [[-0.6, -0.2], [0.6, -0.2], [-0.6, 0.2], [0.6, 0.2]]) rbox(0.04, 2.0, 0.04, MAT.rack, a, 1.0, b, 0, g); for (let s = 0; s < 4; s++) { const y = 0.15 + s * 0.6; rbox(1.25, 0.03, 0.45, MAT.rack, 0, y, 0, 0, g); let px = -0.55; while (px < 0.5) { const w = 0.2 + rnd() * 0.18; if (rnd() > 0.25) rbox(w - 0.02, 0.18 + rnd() * 0.2, 0.36, MAT.box, px + w / 2, y + 0.12, 0, 0.01, g); px += w; } } }
function propFiling(g) { rbox(0.5, 1.3, 0.55, MAT.locker, 0, 0.65, 0, 0.01, g); for (let i = 0; i < 4; i++) { rbox(0.44, 0.27, 0.02, MAT.locker, 0, 0.18 + i * 0.31, 0.28, 0.01, g); rbox(0.12, 0.02, 0.03, MAT.steel, 0, 0.26 + i * 0.31, 0.3, 0.005, g); } }
function propOfficeDesk(g) { rbox(1.4, 0.05, 0.7, MAT.wood, 0, 0.76, 0, 0.01, g); rbox(0.45, 0.72, 0.65, MAT.wood, 0.45, 0.37, 0, 0.01, g); rbox(0.04, 0.72, 0.65, MAT.wood, -0.66, 0.37, 0, 0, g);
  rbox(0.42, 0.34, 0.38, own(new THREE.MeshStandardMaterial({ color: '#c8c2ae', roughness: 0.6 })), -0.2, 0.96, -0.1, 0.04, g); rbox(0.32, 0.24, 0.01, MAT.glass, -0.2, 0.98, 0.095, 0.01, g); rbox(0.45, 0.02, 0.16, MAT.black, -0.2, 0.79, 0.2, 0.005, g);
  for (let i = 0; i < 3; i++) rbox(0.22, 0.004, 0.3, MAT.paper, 0.35 + i * 0.02, 0.786 + i * 0.004, 0.05, 0.001, g).rotation.y = rnd() - 0.5; }
function propChair(g) { rbox(0.45, 0.05, 0.45, MAT.shirt, 0, 0.47, 0, 0.02, g); rbox(0.45, 0.5, 0.05, MAT.shirt, 0, 0.75, -0.2, 0.02, g); add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 8), MAT.steelDark), 0, 0.22, 0, g); for (let a = 0; a < 5; a++) rbox(0.3, 0.025, 0.03, MAT.steelDark, Math.cos(a * 1.26) * 0.14, 0.03, Math.sin(a * 1.26) * 0.14, 0, g).rotation.y = -a * 1.26; }
function propBin(g) { add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.45, 16, 1, true), MAT.steelDark), 0, 0.225, 0, g); }
function propBucket(g) { add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.3, 14), own(new THREE.MeshStandardMaterial({ color: '#c9a227', roughness: 0.5 }))), 0, 0.15, 0, g); const m = add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.3, 6), MAT.wood), 0.05, 0.75, 0, g); m.rotation.z = 0.25; }
function propTable(g) { rbox(1.6, 0.05, 0.8, MAT.wood, 0, 0.76, 0, 0.01, g); for (const [a, b] of [[-0.74, -0.34], [0.74, -0.34], [-0.74, 0.34], [0.74, 0.34]]) rbox(0.05, 0.74, 0.05, MAT.steelDark, a, 0.37, b, 0, g); }
function propBoxes(g) { for (let i = 0; i < 4; i++) { const s = 0.35 + rnd() * 0.2; const b = rbox(s, s * 0.8, s, MAT.box, (rnd() - 0.5) * 0.5, s * 0.4 + (i > 2 ? 0.4 : 0), (rnd() - 0.5) * 0.5, 0.01, g); b.rotation.y = rnd(); } }
function propBasket(g) { add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.5, 16, 1, true), own(new THREE.MeshStandardMaterial({ color: '#8a7d5c', roughness: 0.9, side: THREE.DoubleSide }))), 0, 0.25, 0, g); const s = add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 6), MAT.sheet), 0, 0.45, 0, g); s.scale.y = 0.4; }
// wall props hug a wall face; floor props stand in a room near a wall
const WALLPROPS = { corr: [propRadiator, propFireBox, propBench, propPoster, propBin], cold: [propSink, propPoster], autopsy: [propSink, propPoster, propTrolley], office: [propFiling, propPoster, propRadiator], store: [propShelf, propBucket, propBoxes],
  laundry: [propBasket, propCart, propPoster], archive: [propBoxes], boiler: [propBoxes], booth: [propRadiator, propPoster], chapel: [propBench], lift: [propPoster, propBench, propBin], locker: [propBench, propPoster] };
const FLOORPROPS = { corr: [propWheelchair, propIV, propBin], cold: [propTrolley, propIV], autopsy: [propTrolley, propIV], office: [propOfficeDesk, propChair, propTable], store: [propBoxes, propShelf], laundry: [propCart, propBasket, propTable], archive: [propBoxes], boiler: [propBoxes], booth: [propChair], chapel: [propBench], lift: [propIV, propWheelchair], locker: [propBench] };
const PROPR = new Map([[propShelf, 0.55], [propOfficeDesk, 0.65], [propTable, 0.65], [propCart, 0.5], [propWheelchair, 0.4], [propBench, 0.4], [propBoxes, 0.45], [propTrolley, 0.42], [propFiling, 0.36], [propBasket, 0.32], [propChair, 0.3], [propIV, 0.22], [propBin, 0.2], [propBucket, 0.22], [propSink, 0.3]]);

let critical = new Set();
function computeCritical() { critical = new Set(); const S0 = items.find(t => t.type === 'S'); if (!S0) return;
  const prev = new Map(), q = [[S0.cx, S0.cz]]; prev.set(S0.cx + ',' + S0.cz, null);
  while (q.length) { const [x, z] = q.shift(); for (const [dx, dz] of DIRS) { const nx = x + dx, nz = z + dz, k = nx + ',' + nz; if (prev.has(k)) continue; const ch = at(nx, nz); if (isWallCh(ch) && ch !== 'X' || ch === 't') continue; prev.set(k, x + ',' + z); q.push([nx, nz]); } }
  const trace = k => { while (k) { critical.add(k); k = prev.get(k); } };
  for (const it of items) if ('PKCFBNVWRXT'.includes(it.type)) trace(it.cx + ',' + it.cz); }

function dressLevel() {
  computeCritical();
  const occupied = new Set([...doorCells]); for (const it of items) occupied.add(it.cx + ',' + it.cz); for (const c of containers) occupied.add(W2C(c.cxw) + ',' + W2C(c.czw));
  const perRoomClock = new Set(); let posterI = (LVI * 3) | 0;
  // wall faces
  const faces = []; for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) { if (!passable(x, z) || MAP[z][x] !== '.') continue; for (const [dx, dz] of DIRS) { const ch = at(x + dx, z + dz); if (ch === '#') faces.push([x, z, dx, dz, rnd()]); } }
  faces.sort((a, b) => a[4] - b[4]);
  const usedFace = new Set(); const nearUsed = (x, z) => { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (usedFace.has((x + a) + ',' + (z + b))) return true; return false; };
  for (const [x, z, dx, dz] of faces) { const key = x + ',' + z; if (occupied.has(key) || nearUsed(x, z)) continue; const th = themeOf(x, z); const r = roomOf(x, z);
    const corridor = isWallCh(at(x - dx, z - dz)); let fn = null;
    if (!perRoomClock.has(r) && (r >= 0 || rnd() < 0.15)) { fn = propClock; perRoomClock.add(r); }
    else { const list = (WALLPROPS[th] || WALLPROPS.corr).filter(f => !corridor || f === propPoster || f === propRadiator || f === propFireBox || f === propClock || f === propSink); if (!list.length || rnd() < 0.35) continue; fn = list[(rnd() * list.length) | 0]; }
    const g = new THREE.Group(); const ry = Math.atan2(-dx, -dz); const depth = fn === propShelf ? 0.25 : fn === propBench ? 0.25 : fn === propCart || fn === propBasket || fn === propBoxes || fn === propBucket ? 0.4 : fn === propTrolley || fn === propSink ? 0.25 : 0.05;
    g.position.set(C2W(x) + dx * (CS / 2 - depth), 0, C2W(z) + dz * (CS / 2 - depth)); g.rotation.y = ry; world.add(g); fn(g, posterI++);
    const rr = PROPR.get(fn); if (rr && depth > 0.1) solids.push({ x: g.position.x, z: g.position.z, r: Math.min(rr, 0.4) });
    usedFace.add(key); }
  // floor props: room corners off the critical path
  for (let i = 0; i < (lv.rooms || []).length; i++) { const r = lv.rooms[i]; const th = r[4]; const list = FLOORPROPS[th]; if (!list) continue; let n = 0; const want = Math.max(1, Math.round((r[2] - r[0] + 1) * (r[3] - r[1] + 1) / 9));
    for (let z = r[1]; z <= r[3] && n < want; z++) for (let x = r[0]; x <= r[2] && n < want; x++) { const key = x + ',' + z; if (at(x, z) !== '.' || critical.has(key) || occupied.has(key) || usedFace.has(key)) continue;
      let wx = 0, wz = 0, nw = 0; for (const [dx, dz] of DIRS) if (isWallCh(at(x + dx, z + dz))) { wx += dx; wz += dz; nw++; } if (nw === 0 || nw > 2) continue;
      let pn = 0; for (const [dx, dz] of DIRS) if (passable(x + dx, z + dz)) pn++; if (pn < 2) continue; if (rnd() < 0.4) continue;
      const fn = list[(rnd() * list.length) | 0]; const g = new THREE.Group(); g.position.set(C2W(x) + Math.sign(wx) * 0.45, 0, C2W(z) + Math.sign(wz) * 0.45); g.rotation.y = Math.atan2(-wx, -wz) + (rnd() - 0.5) * 0.4; world.add(g); fn(g, posterI++);
      solids.push({ x: g.position.x, z: g.position.z, r: PROPR.get(fn) || 0.35 }); occupied.add(key); n++; } }
}

// ================= PHONE SCREEN (diegetic: time, battery, Nuri's messages, objective) =================
const phoneCan = document.createElement('canvas'); phoneCan.width = 288; phoneCan.height = 620; const phoneCtx = phoneCan.getContext('2d');
const phoneTex = new THREE.CanvasTexture(phoneCan); phoneTex.colorSpace = THREE.SRGBColorSpace; phoneTex.anisotropy = 4;
const phoneMsgs = []; let phoneDirty = true, phoneT = 0;
function wrapText(k, text, maxW) { const words = String(text).split(' '); const lines = []; let cur = ''; for (const w of words) { const t = cur ? cur + ' ' + w : w; if (k.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); return lines; }
function drawPhone() { const k = phoneCtx, W = 288, Hh = 620; const g = k.createLinearGradient(0, 0, 0, Hh); g.addColorStop(0, '#0e1a20'); g.addColorStop(1, '#070b0e'); k.fillStyle = g; k.fillRect(0, 0, W, Hh);
  k.fillStyle = '#cfd8d4'; k.font = '600 20px Arial, sans-serif'; k.textBaseline = 'top'; k.fillText(lv.time || '03:12', 18, 14); k.textAlign = 'right'; k.fillText('%' + Math.round(P.bat), W - 18, 14); k.textAlign = 'left';
  k.fillStyle = '#16252c'; k.fillRect(0, 48, W, 64); k.fillStyle = '#c9a26a'; k.beginPath(); k.arc(40, 80, 20, 0, 7); k.fill(); k.fillStyle = '#16252c'; k.font = '700 20px Arial'; k.textAlign = 'center'; k.fillText('N', 40, 70); k.textAlign = 'left';
  k.fillStyle = '#e8eee9'; k.font = '700 22px Arial'; k.fillText('Nuri Abi', 72, 60); k.fillStyle = '#7f948c'; k.font = '15px Arial'; k.fillText(phoneMsgs.length ? 'çevrimiçi' : 'son görülme 9 gün önce', 72, 86);
  let y = 500; k.font = '18px Arial'; const shown = phoneMsgs.slice(-5);
  for (let i = shown.length - 1; i >= 0; i--) { const lines = wrapText(k, shown[i], 200); const bh = lines.length * 23 + 18; y -= bh + 10; if (y < 120) break; k.fillStyle = '#1f3a33'; k.beginPath(); k.roundRect ? k.roundRect(16, y, 230, bh, 14) : k.rect(16, y, 230, bh); k.fill(); k.fillStyle = '#e9f1ec'; lines.forEach((L, j) => k.fillText(L, 28, y + 10 + j * 23)); }
  const ob = lv.obj ? lv.obj[P.keys >= lv.need.n ? 1 : 0] : ''; k.fillStyle = '#20180c'; k.fillRect(12, 516, W - 24, 92); k.strokeStyle = '#c9a26a'; k.lineWidth = 2; k.strokeRect(12, 516, W - 24, 92);
  k.fillStyle = '#c9a26a'; k.font = '700 14px Arial'; k.fillText('GÖREV', 24, 524); k.fillStyle = '#efe6d6'; k.font = '17px Arial'; wrapText(k, ob, W - 52).slice(0, 3).forEach((L, j) => k.fillText(L, 24, 544 + j * 20));
  phoneTex.needsUpdate = true; phoneDirty = false; }
// ================= HANDS (first person) =================
const handsRoot = new THREE.Group(); cam.add(handsRoot); const handMats = [];
let ledMesh, torchLight;
{ const skin = new THREE.MeshStandardMaterial({ color: '#c08a6a', roughness: 0.62 }), nail = new THREE.MeshStandardMaterial({ color: '#d9b3a0', roughness: 0.4 }), slv = MAT.shirt.clone(), phB = new THREE.MeshStandardMaterial({ color: '#15181b', roughness: 0.35, metalness: 0.5 });
  handMats.push(...[skin, nail, slv, phB].map(m => [m, m.color.clone()]));
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const seg = (p, a, b, r) => { const d = new THREE.Vector3().subVectors(b, a); const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, d.length()), 4, 10), skin); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.clone().normalize()); p.add(m); };
  const finger = (p, pts, r) => { for (let i = 0; i < pts.length - 1; i++) seg(p, pts[i], pts[i + 1], r * (1 - i * 0.08)); const n = new THREE.Mesh(new THREE.SphereGeometry(r * 0.75, 8, 6), nail); n.position.copy(pts[pts.length - 1]); n.scale.set(1, 0.5, 1); p.add(n); };
  const sleeve = (p, from, to, r) => { const d = new THREE.Vector3().subVectors(to, from); const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r, d.length(), 18, 1, true), slv); m.position.copy(from).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.clone().normalize()); p.add(m); const c = new THREE.Mesh(new THREE.TorusGeometry(r * 0.92, r * 0.12, 8, 20), slv); c.position.copy(to); c.quaternion.setFromUnitVectors(V(0, 0, 1), d.clone().normalize()); p.add(c); };
  const Ph = new THREE.Group(); Ph.position.set(0.12, -0.115, -0.46); Ph.rotation.set(-0.32, -0.12, 0.12); handsRoot.add(Ph);
  Ph.add(new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.145, 0.0095, 4, 0.0045), phB));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.064, 0.138), new THREE.MeshBasicMaterial({ map: phoneTex, color: new THREE.Color(0.62, 0.62, 0.62) })); scr.position.z = 0.0049; Ph.add(scr);
  const ico = new THREE.Mesh(new THREE.CircleGeometry(0.009, 20), new THREE.MeshBasicMaterial({ color: '#9fb6c0', transparent: true, opacity: 0 })); ico.visible = false; Ph.add(ico); Ph.userData.ico = ico;
  const bump = new THREE.Mesh(new RoundedBoxGeometry(0.026, 0.026, 0.003, 2, 0.004), new THREE.MeshStandardMaterial({ color: '#0d0f11', roughness: 0.3, metalness: 0.6 })); bump.position.set(-0.018, 0.052, -0.0062); Ph.add(bump);
  ledMesh = new THREE.Mesh(new THREE.CircleGeometry(0.0035, 16), new THREE.MeshBasicMaterial({ color: '#333' })); ledMesh.position.set(-0.012, 0.058, -0.0079); ledMesh.rotation.y = Math.PI; Ph.add(ledMesh);
  const palm = new THREE.Mesh(new RoundedBoxGeometry(0.078, 0.07, 0.03, 3, 0.012), skin); palm.position.set(0.004, -0.055, -0.021); palm.rotation.z = -0.08; Ph.add(palm);
  const heel = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), skin); heel.scale.set(1.25, 0.9, 0.8); heel.position.set(-0.008, -0.09, -0.018); Ph.add(heel);
  finger(Ph, [V(-0.034, -0.085, -0.012), V(-0.046, -0.06, -0.002), V(-0.042, -0.035, 0.007), V(-0.032, -0.018, 0.009)], 0.0105);
  [[-0.005, 0.0098], [-0.027, 0.0102], [-0.05, 0.0098], [-0.07, 0.0088]].forEach(([y, r], i) => finger(Ph, [V(0.02, y - 0.004, -0.02), V(0.04, y, -0.014), V(0.047, y + 0.002, -0.001), V(0.041 - i * 0.001, y + 0.003, 0.008)], r));
  seg(Ph, V(-0.004, -0.095, -0.022), V(0, -0.11, -0.03), 0.026); sleeve(Ph, V(0.08, -0.42, 0.12), V(0.005, -0.14, -0.035), 0.05);
  handsRoot.userData.phone = Ph; Ph.userData.p0 = Ph.position.clone(); Ph.userData.r0 = Ph.rotation.clone();
  const Lh = new THREE.Group(); Lh.position.set(-0.24, -0.27, -0.48); Lh.rotation.set(0.5, 0.45, 0.35); handsRoot.add(Lh);
  Lh.add(new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.026, 0.085, 3, 0.011), skin));
  [[-0.028, 0.0095], [-0.009, 0.01], [0.01, 0.0098], [0.028, 0.0088]].forEach(([x, r], i) => finger(Lh, [V(x, 0, -0.04), V(x * 1.05, -0.006, -0.068 + i * 0.003), V(x * 1.08, -0.02, -0.088 + i * 0.004), V(x * 1.1, -0.034, -0.096 + i * 0.004)], r));
  finger(Lh, [V(0.04, -0.004, 0), V(0.058, -0.012, -0.024), V(0.062, -0.022, -0.044)], 0.0105); sleeve(Lh, V(-0.02, -0.06, 0.34), V(0, 0, 0.05), 0.05);
  const tostBag = new THREE.Group(); tostBag.position.set(0.0, -0.06, -0.07); tostBag.rotation.set(-0.3, 0.2, 0); Lh.add(tostBag); rbox(0.12, 0.17, 0.07, own(new THREE.MeshStandardMaterial({ color: '#c9b48a', roughness: 0.95 })), 0, -0.07, 0, 0.01, tostBag); rbox(0.122, 0.03, 0.072, MAT.red, 0, -0.03, 0, 0.004, tostBag); tostBag.visible = false; handsRoot.userData.tost = tostBag;
  const held = bottleMesh(); held.position.set(0.0, -0.035, -0.085); held.rotation.x = -1.2; held.visible = false; Lh.add(held); handsRoot.userData.held = held;
  torchLight = new THREE.SpotLight('#ffd6a0', 0, 22, 0.5, 1.0, 1.25); torchLight.position.set(0.1, -0.06, -0.5); torchLight.target.position.set(0.12, -0.6, -10); cam.add(torchLight, torchLight.target);
  torchLight.castShadow = cfg.q === 'S'; torchLight.shadow.mapSize.set(1024, 1024); torchLight.shadow.bias = -0.0004; torchLight.shadow.camera.near = 0.05;
  const bounce = new THREE.PointLight('#ffb37a', 0, 0.9, 2); bounce.position.set(0.05, -0.02, -0.75); cam.add(bounce); handsRoot.userData.bounce = bounce;
}
const slats = new THREE.Group(); slats.visible = false; cam.add(slats);
{ const m = new THREE.MeshStandardMaterial({ color: '#2b3133', roughness: 0.6, metalness: 0.6 }); const d = new THREE.Group(); d.position.z = -0.2; slats.add(d);
  rbox(2.0, 0.2, 0.01, m, 0, 0.19, 0, 0, d); rbox(2.0, 0.2, 0.01, m, 0, -0.195, 0, 0, d); rbox(0.2, 0.4, 0.012, m, -0.31, 0, 0.002, 0, d); rbox(0.2, 0.4, 0.012, m, 0.29, 0, 0.002, 0, d);
  for (let i = 0; i < 5; i++) { const s = rbox(0.6, 0.006, 0.02, m, -0.02, 0.08 - i * 0.04, 0.004, 0.002, d); s.rotation.x = 0.35; } }

// ================= POST =================
const comp = new EffectComposer(R); comp.addPass(new RenderPass(S, cam));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.6, 0.82); comp.addPass(bloom);
comp.addPass(new OutputPass());
const grade = new ShaderPass({ uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uV: { value: 1.1 }, uDark: { value: 0 }, uTone: { value: new THREE.Vector3(0.86, 1, 0.98) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uT; uniform float uV; uniform float uDark; uniform vec3 uTone; varying vec2 vUv; float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
  void main(){ vec2 d=vUv-.5; float r=dot(d,d); vec3 c; c.r=texture2D(tDiffuse,vUv-d*.003).r; c.g=texture2D(tDiffuse,vUv).g; c.b=texture2D(tDiffuse,vUv+d*.003).b;
    float l=dot(c,vec3(.299,.587,.114)); c=mix(c,l*uTone,.28); c+=vec3(.02,.05,.07)*(1.-smoothstep(0.,.35,l)); c*=mix(vec3(1.),vec3(1.,.98,.93),smoothstep(.5,1.,l));
    c*=1.-smoothstep(.12,.62,r)*(uV+uDark)*.85; c+=(h(floor(vUv*vec2(960.,540.))+uT)-.5)*.035; gl_FragColor=vec4(max(c,0.),1.); }` });
comp.addPass(grade);
function applyQuality() { const sh = cfg.q === 'S'; bloom.enabled = sh; bloom.strength = cfg.flash ? 0.28 : 0.5; torchLight.castShadow = sh; R.setPixelRatio(Math.min(devicePixelRatio || 1, sh ? 2 : (isTouch ? 1.25 : 1.5))); onResize(); }
function onResize() { R.setSize(innerWidth, innerHeight); comp.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
addEventListener('resize', onResize);

// ================= AUDIO (soft, no stingers) =================
let AC = null, master, noiseBuf, ambG, humG, steamG, heartT = 0; const chans = [];
function audioInit() { if (AC) { if (AC.state === 'suspended') AC.resume(); return; } try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  master = AC.createGain(); master.gain.value = 0.0; master.connect(AC.destination); master.gain.linearRampToValueAtTime(0.7, AC.currentTime + 2);
  noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate); const d = noiseBuf.getChannelData(0); let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
  const amb = AC.createBufferSource(); amb.buffer = noiseBuf; amb.loop = true; const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; ambG = AC.createGain(); ambG.gain.value = 0.22; amb.connect(lp).connect(ambG).connect(master); amb.start();
  const hum = AC.createOscillator(); hum.frequency.value = 100; humG = AC.createGain(); humG.gain.value = 0; const hf = AC.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = 100; hum.connect(hf).connect(humG).connect(master); hum.start();
  const st = AC.createBufferSource(); st.buffer = noiseBuf; st.loop = true; st.playbackRate.value = 4; const sf = AC.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 2600; sf.Q.value = 0.5; steamG = AC.createGain(); steamG.gain.value = 0; st.connect(sf).connect(steamG).connect(master); st.start();
  for (let i = 0; i < 12; i++) { const s = AC.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = 3; const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.8; const g = AC.createGain(); g.gain.value = 0; const pan = AC.createStereoPanner ? AC.createStereoPanner() : null; s.connect(bp).connect(g); if (pan) g.connect(pan).connect(master); else g.connect(master); s.start(); chans.push({ g, pan, bp, src: s, who: null }); }
  assignAudio(); }
function assignAudio() { if (!AC) return; chans.forEach(c => { c.who = null; c.g.gain.value = 0; }); let i = 0; for (const e of enemies) if (i < chans.length) { chans[i].who = e; chans[i].bp.frequency.value = e.kind === 'A' ? 900 : 1400; i++; } for (const s of sedyes) if (i < chans.length) { chans[i].who = s; chans[i].bp.frequency.value = 3200; i++; } }
function blip(freq, dur, vol, type = 'sine', attack = 0.15) { if (!AC) return; const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = freq; g.gain.value = 0; const t = AC.currentTime; g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur); o.connect(g).connect(master); o.start(); o.stop(t + attack + dur + 0.05); }
function step(vol) { if (!AC) return; const s = AC.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 1.6; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; const g = AC.createGain(); const t = AC.currentTime; g.gain.value = 0; g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); s.connect(f).connect(g).connect(master); s.start(t, Math.random()); s.stop(t + 0.2); }

// ================= INPUT =================
const keys = {}; const look = { dx: 0, dy: 0 }; const touchMove = { x: 0, y: 0, id: null, ox: 0, oy: 0 }; let lookId = null, lx = 0, ly = 0;
let running = false, paused = false, locked = false, ended = false;
addEventListener('keydown', e => { keys[e.code] = true; if (!running || paused) return; if (e.code === 'KeyE') interact(); if (e.code === 'KeyF') toggleTorch(); if (e.code === 'KeyQ') throwBottle(); if (e.code === 'Space') e.preventDefault(); if (e.code === 'KeyC' || e.code === 'ControlLeft') P.crouchToggle = !P.crouchToggle; if (e.code === 'Tab') { e.preventDefault(); P.phoneHold = !P.phoneHold; P.phoneAuto = 0; } });
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('mousemove', e => { if (locked) { look.dx += e.movementX; look.dy += e.movementY; } });
__docOn('pointerlockchange', () => { locked = __doc.pointerLockElement === R.domElement; if (!locked && running && !isTouch && !ended && !paused) setPause(true); });
const lockPointer = () => { if (isTouch) return; try { const p = R.domElement.requestPointerLock(); p && p.catch && p.catch(() => {}); } catch (e) {} };
R.domElement.addEventListener('click', () => { if (running && !paused && !locked) lockPointer(); });
const stickEl = __doc.getElementById('stick');
function tBtn(id, down, up) { const el = __doc.getElementById(id); el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); down(el); }); if (up) { el.addEventListener('pointerup', e => { e.preventDefault(); up(el); }); el.addEventListener('pointercancel', () => up(el)); el.addEventListener('pointerleave', () => up(el)); } }
tBtn('tE', () => interact()); tBtn('tF', () => toggleTorch()); tBtn('tC', el => { P.crouchToggle = !P.crouchToggle; el.classList.toggle('on', P.crouchToggle); });
tBtn('tB', el => { P.touchHold = true; el.classList.add('on'); }, el => { P.touchHold = false; el.classList.remove('on'); });
tBtn('tR', el => { P.touchRun = !P.touchRun; el.classList.toggle('on', P.touchRun); }); tBtn('tQ', () => throwBottle()); tBtn('tP', () => { if (running) setPause(true); }); tBtn('tM', el => { P.phoneHold = !P.phoneHold; P.phoneAuto = 0; el.classList.toggle('on', P.phoneHold); });
R.domElement.addEventListener('pointerdown', e => { if (!isTouch || !running) return; if (e.clientX < innerWidth * 0.45 && touchMove.id === null) { touchMove.id = e.pointerId; touchMove.ox = e.clientX; touchMove.oy = e.clientY; touchMove.x = touchMove.y = 0; stickEl.style.display = 'block'; stickEl.style.left = e.clientX + 'px'; stickEl.style.top = e.clientY + 'px'; stickEl.firstElementChild.style.transform = ''; }
  else if (lookId === null) { lookId = e.pointerId; lx = e.clientX; ly = e.clientY; } });
R.domElement.addEventListener('pointermove', e => { if (e.pointerId === touchMove.id) { let dx = e.clientX - touchMove.ox, dy = e.clientY - touchMove.oy; const m = Math.hypot(dx, dy), max = 50; if (m > max) { dx *= max / m; dy *= max / m; } touchMove.x = dx / max; touchMove.y = dy / max; stickEl.firstElementChild.style.transform = `translate(${dx}px,${dy}px)`; }
  else if (e.pointerId === lookId) { look.dx += (e.clientX - lx) * 1.6; look.dy += (e.clientY - ly) * 1.6; lx = e.clientX; ly = e.clientY; } });
const endTouch = e => { if (e.pointerId === touchMove.id) { touchMove.id = null; touchMove.x = touchMove.y = 0; stickEl.style.display = 'none'; } if (e.pointerId === lookId) lookId = null; };
R.domElement.addEventListener('pointerup', endTouch); R.domElement.addEventListener('pointercancel', endTouch);

// ================= UI HELPERS =================
const $ = id => __doc.getElementById(id);
const fadeEl = $('fade'), promptEl = $('prompt'), subEl = $('sub'), cardEl = $('card'), savedEl = $('saved');
function fadeTo(v, sec) { fadeEl.style.transitionDuration = Math.max(0.6, sec ?? (cfg.flash ? 1.6 : 1.2)) + 's'; fadeEl.style.opacity = v; }
let subT = 0, cardT = 0, savedT = 0; const subQ = [];
function say(t, sec = 7) { subEl.textContent = t; subT = sec; subEl.style.opacity = 1; }
function showCard(title, text, sec = 5.5) { cardEl.innerHTML = ''; const b = document.createElement('b'); b.textContent = title; cardEl.append(b, document.createTextNode(text)); cardEl.style.opacity = 1; cardT = sec; }
function updHud() { $('kc').textContent = `Künye ${kunyeler.filter(k => k.got).length}/${kunyeler.length}`; $('chapT').textContent = `${LVI ? LVI + '. ' : ''}${lv.name}`; $('kc').hidden = !kunyeler.length; phoneDirty = true;
  const n = lv.need; $('obj').textContent = n.n > 1 ? `${n.ch === 'F' ? 'Sigorta' : 'Vana'} ${Math.min(P.keys, n.n)}/${n.n}` : ''; $('bt').hidden = P.bottles <= 0; $('bt').textContent = `Şişe ${P.bottles}`; $('tQ').style.display = P.bottles > 0 && isTouch ? 'flex' : 'none'; handsRoot.userData.held.visible = P.bottles > 0; }
function toggleTorch() { if (P.hidden) return; if (!P.torch && P.bat <= 0) { say('Pil bitti.', 2); return; } P.torch = !P.torch; blip(P.torch ? 1800 : 1400, 0.05, 0.05, 'square', 0.005); $('tF').classList.toggle('on', P.torch); }

// ================= BOTTLES =================
const flying = [];
function throwBottle() { if (P.bottles <= 0 || P.hidden || caughtT > 0) return; P.bottles--; updHud(); const m = bottleMesh(); world.add(m);
  const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(P.pitch + 0.25, P.yaw, 0, 'YXZ')); const sp = 9;
  flying.push({ m, x: P.x + dir.x * 0.4, y: 1.4, z: P.z + dir.z * 0.4, vx: dir.x * sp, vy: dir.y * sp, vz: dir.z * sp, spin: 0 }); blip(300, 0.15, 0.03, 'triangle', 0.02); }
function updFlying(dt) { for (let i = flying.length - 1; i >= 0; i--) { const f = flying[i]; f.vy -= 9.8 * dt; let nx = f.x + f.vx * dt, nz = f.z + f.vz * dt; f.y += f.vy * dt;
    if (!passable(W2C(nx), W2C(f.z))) { f.vx *= -0.3; nx = f.x; } if (!passable(W2C(nx), W2C(nz))) { f.vz *= -0.3; nz = f.z; } f.x = nx; f.z = nz; f.spin += dt * 12; f.m.position.set(f.x, f.y, f.z); f.m.rotation.set(f.spin, 0, f.spin * 0.6);
    if (f.y <= 0.04) { f.m.position.y = 0.035; f.m.rotation.set(0, f.spin, Math.PI / 2); flying.splice(i, 1); noise(f.x, f.z, 11, true); clink(f.x, f.z); } } }
function clink(x, z) { if (!AC) return; const d = Math.hypot(x - P.x, z - P.z); const v = Math.max(0.015, 0.07 * (1 - d / 25)); blip(2300, 0.35, v, 'triangle', 0.01); setTimeout(() => blip(3100, 0.25, v * 0.6, 'sine', 0.01), 70); }



// ================= SCARES (no flashes: sound, sudden movement, dark figures only) =================
const scareAnims = []; let scareState = [], ambT = 60;
const scareMat = new THREE.MeshStandardMaterial({ map: sheetMap, color: '#4d524b', roughness: 0.95, side: THREE.DoubleSide });
function darkFigure() { const m = carsafliMesh(false); m.traverse(o => { if (o.isMesh && o.material === MAT.sheet) o.material = scareMat; }); world.add(m); return m; }
function sting(vol = 0.36) { if (!AC || cfg.js === 0) return; const t = AC.currentTime; const v = vol * (cfg.js === 1 ? 0.45 : 1);
  const s = AC.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 6; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(500, t + 0.7); f.Q.value = 0.7; const g = AC.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 1.0); s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + 1.1);
  for (const fr of [233, 247, 370, 523, 554]) { const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(fr, t); o.frequency.linearRampToValueAtTime(fr * 0.94, t + 1.2); const og = AC.createGain(); og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(v * 0.09, t + 0.012); og.gain.exponentialRampToValueAtTime(0.001, t + 1.4); o.connect(og).connect(master); o.start(t); o.stop(t + 1.5); }
  blip(50, 0.6, v * 0.9, 'sine', 0.006); }
function panAt(x, z) { const p = AC.createStereoPanner ? AC.createStereoPanner() : null; if (p) { const ang = Math.atan2(x - P.x, z - P.z) - P.yaw; p.pan.value = Math.max(-1, Math.min(1, -Math.sin(ang))); } return p; }
function whoosh(x, z, v = 0.12) { if (!AC) return; const t = AC.currentTime; const s = AC.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 3; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(1800, t + 0.5); f.frequency.exponentialRampToValueAtTime(300, t + 1.0); const g = AC.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.25); g.gain.exponentialRampToValueAtTime(0.001, t + 1.1); const p = panAt(x, z); s.connect(f).connect(g); if (p) g.connect(p).connect(master); else g.connect(master); s.start(t); s.stop(t + 1.2); }
function bang(x, z, v = 0.1) { if (!AC) return; const t = AC.currentTime; const s = AC.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 2; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; const g = AC.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5); const p = panAt(x, z); s.connect(f).connect(g); if (p) g.connect(p).connect(master); else g.connect(master); s.start(t, Math.random()); s.stop(t + 0.6);
  const o = AC.createOscillator(); o.type = 'triangle'; o.frequency.value = 180 + Math.random() * 60; const og = AC.createGain(); og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(v * 0.4, t + 0.01); og.gain.exponentialRampToValueAtTime(0.001, t + 0.9); if (p) { og.connect(p); } else og.connect(master); o.connect(og); o.start(t); o.stop(t + 1); }
function breathLoop(x, z) { if (!AC) return { stop() {} }; const s = AC.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = 1.2; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 650; f.Q.value = 1.2; const g = AC.createGain(); g.gain.value = 0; const lfo = AC.createOscillator(); lfo.frequency.value = 0.45; const lg = AC.createGain(); lg.gain.value = 0.06; lfo.connect(lg).connect(g.gain); const p = panAt(x, z); s.connect(f).connect(g); if (p) g.connect(p).connect(master); else g.connect(master); s.start(); lfo.start();
  return { p, stop() { try { g.gain.cancelScheduledValues(AC.currentTime); lg.gain.setTargetAtTime(0, AC.currentTime, 0.2); setTimeout(() => { s.stop(); lfo.stop(); }, 800); } catch (e) {} } }; }
function containerScare(c) { c.burst = true; c.anim = 0.0001; sting(0.38); bang(c.x, c.z, 0.12);
  if (c.kind === 'drawer') { // the covered body sits up toward you, then slowly lies back down
    let t = 0; scareAnims.push(dt => { t += dt; if (!c.piv) return true; const up = t < 0.45 ? t / 0.45 : t < 1.6 ? 1 : Math.max(0, 1 - (t - 1.6) / 2.2); c.piv.rotation.x = -0.95 * (up * up * (3 - 2 * up)) * (cfg.js === 1 ? 0.6 : 1); return t > 4; });
    setTimeout(() => say('...', 2), 1200); return; }
  // cabinet: a dark sheet bursts out at you, then collapses into an empty sheet on the floor
  const m = darkFigure(); const bx = c.cxw + c.rx * 0.25, bz = c.czw + c.rz * 0.25; m.position.set(bx, 0, bz); m.rotation.y = Math.atan2(-c.rz, c.rx) ; m.scale.setScalar(0.92);
  const pd = Math.hypot(P.x - bx, P.z - bz); const lunge = Math.max(0, Math.min(cfg.js === 1 ? 0.25 : 0.6, pd - 1.1)); let t = 0;
  scareAnims.push(dt => { t += dt; const k = Math.min(1, t / 0.3); const e = 1 - Math.pow(1 - k, 3); m.position.set(bx + c.rx * lunge * e, 0, bz + c.rz * lunge * e);
    if (t > 0.9) { const d = Math.min(1, (t - 0.9) / 0.9); m.scale.set(0.92 + d * 0.25, 0.92 * (1 - d * 0.9), 0.92 + d * 0.25); }
    return t > 1.9; });
  setTimeout(() => say('Sadece bir çarşaf. Şimdi sadece bir çarşaf.', 3.5), 1900); }
function initScares() { scareState = (lv.scares || []).map(s => ({ type: s[0], cx: s[1], cz: s[2], done: false, active: null })); ambT = 50 + rnd() * 40; }
function fwdVec() { return [-Math.sin(P.yaw), -Math.cos(P.yaw)]; }
function updScares(dt) {
  // ambient: distant drawers and doors, sound only
  ambT -= dt; if (ambT <= 0) { ambT = 55 + rnd() * 60; const a = rnd() * 6.28, r = 12 + rnd() * 10; bang(P.x + Math.cos(a) * r, P.z + Math.sin(a) * r, 0.05); }
  if (cfg.js === 0 || caughtT > 0) return; const pcx = W2C(P.x), pcz = W2C(P.z);
  for (const s of scareState) { if (s.done) continue;
    if (!s.active) { if (Math.abs(pcx - s.cx) + Math.abs(pcz - s.cz) <= 1 && !P.hidden) { s.active = { t: 0 }; if (s.type === 'slam') { bang(P.x - fwdVec()[0] * 3, P.z - fwdVec()[1] * 3, 0.16); sting(0.22); s.done = true; } } continue; }
    const A = s.active; A.t += dt; const [fx, fz] = fwdVec();
    if (s.type === 'cross') { if (!A.m) { let pt = null; for (let d = 10; d >= 4; d--) { const x = P.x + fx * d, z = P.z + fz * d; if (passable(W2C(x), W2C(z)) && los(P.x, P.z, x, z)) { pt = [x, z]; break; } } if (!pt) { if (A.t > 5) s.done = true; continue; }
        A.m = darkFigure(); A.px = -fz; A.pz = fx; A.x0 = pt[0] - A.px * 2.6; A.z0 = pt[1] - A.pz * 2.6; A.m.rotation.y = Math.atan2(-A.pz, A.px); A.k = 0; whoosh(pt[0], pt[1], 0.14); sting(0.2); }
      A.k += dt / 0.85; const x = A.x0 + A.px * 5.2 * A.k, z = A.z0 + A.pz * 5.2 * A.k; A.m.position.set(x, Math.abs(Math.sin(A.k * 12)) * 0.02, z); if (A.k >= 1) { world.remove(A.m); s.done = true; } continue; }
    if (s.type === 'behind') { if (!A.m) { let pos = null; for (const d of [1.6, 1.2]) { const x = P.x - fx * d, z = P.z - fz * d; if (passable(W2C(x), W2C(z))) { pos = [x, z]; break; } } if (!pos) { if (A.t > 5) s.done = true; continue; }
        A.m = darkFigure(); A.m.position.set(pos[0], 0, pos[1]); A.br = breathLoop(pos[0], pos[1]); A.t = 0; A.look = false; }
      const dx = P.x - A.m.position.x, dz = P.z - A.m.position.z, d = Math.hypot(dx, dz); A.m.rotation.y = Math.atan2(-dz, dx); if (A.br && A.br.p) { const ang = Math.atan2(-dx, -dz) - P.yaw; A.br.p.pan.value = Math.max(-1, Math.min(1, -Math.sin(ang))); }
      if (!A.look) { const dot = (-dx * fx + -dz * fz) / (d || 1); if (dot > 0.78) { A.look = true; A.lt = 0; A.br.stop(); sting(0.4); A.sx = A.m.position.x; A.sz = A.m.position.z; } else if (A.t > 9 || d > 6) { A.br.stop(); world.remove(A.m); s.done = true; } continue; }
      A.lt += dt; const k = Math.min(1, A.lt / 0.16), lunge = cfg.js === 1 ? 0.15 : Math.max(0, Math.min(0.6, d - 0.95)); A.m.position.set(A.sx + dx / d * lunge * k, 0, A.sz + dz / d * lunge * k);
      if (A.lt > 0.6) { world.remove(A.m); s.done = true; setTimeout(() => say('...kimse yok.', 2.5), 300); } }
  } }

// ================= SEARCHING =================
function openContainer(c, silent) { c.opened = true; c.anim = 0.0001; if (silent) { c.anim = 1; poseContainer(c, 1); if (c.cm) c.cm.visible = false; return; }
  noise(c.x, c.z, 3.5, true); blip(c.kind === 'drawer' ? 140 : 210, 0.35, 0.05, 'triangle', 0.02); step(0.06);
  const t = c.content.t, n = lv.need;
  if (t === 'scare' && cfg.js > 0) { containerScare(c); return; }
  setTimeout(() => { if (c.cm) c.cm.visible = false;
    if (t === 'key') { P.keys++; updHud(); say(n.n > 1 ? `${n.got} (${P.keys}/${n.n})` : (n.got || n.pick), 5); lv.onKey && lv.onKey(GAPI, P.keys); blip(90, 2.2, 0.1, 'sine', 0.8); blip(700, 0.6, 0.05, 'sine', 0.12); }
    else if (t === 'bat') { P.bat = Math.min(100, P.bat + (c.content.big ? 60 : 35)); say(c.content.big ? 'Powerbank. Fenerin doldu.' : 'Yarım dolu bir pil. Fenere takıldı.', 3); blip(700, 0.5, 0.04, 'sine', 0.12); }
    else if (t === 'bottle') { if (P.bottles < 3) { P.bottles++; updHud(); say('Boş bir ilaç şişesi. Fırlatılabilir.', 3); } else say('Bir şişe daha. Elin dolu.', 3); }
    else if (t === 'kunye') { const k = c.content.k; if (!k.got) { k.got = true; SAVE.kunye[k.id] = 1; writeSave(); showCard('Künye · ' + k.data[0], k.data[1]); updHud(); blip(660, 0.9, 0.06, 'sine', 0.15); } else say('Boş.', 2); }
    else if (t === 'body') say('Çarşafla örtülü biri. Künyesi yok.', 3);
    else if (t === 'scare') say('Boş... değil miydi?', 3);
    else say(FLAVOR[c.content.f || 0], 3);
  }, 650); }
function poseContainer(c, k) { const e = k * k * (3 - 2 * k);
  if (c.kind === 'cab') for (const d of c.doors) d.pv.rotation.y = d.s * e * (c.burst ? 2.2 : 1.85);
  else if (c.kind === 'desk') c.dr.position.z = e * 0.32;
  else c.box.position.z = e * 0.95; }
function updContainers(dt) { for (const c of containers) { if (c.anim > 0 && c.anim < 1) { c.anim = Math.min(1, c.anim + dt / (c.burst ? 0.18 : 0.6)); poseContainer(c, c.anim); } }
  for (let i = scareAnims.length - 1; i >= 0; i--) if (scareAnims[i](dt)) scareAnims.splice(i, 1); }

// ================= INTERACTION =================
let focus = null;
function findFocus() {
  if (P.hidden) return { kind: 'unhide', label: 'Dolaptan çık' };
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw); let best = null, bd = 1e9;
  const consider = (kind, x, z, label, ref, maxD = 1.6) => { const dx = x - P.x, dz = z - P.z, d = Math.hypot(dx, dz); if (d > maxD) return; const dot = (dx * fx + dz * fz) / (d || 1); if (dot < 0.35 && d > 0.6) return; if (d < bd) { bd = d; best = { kind, label, ref }; } };
  const n = lv.need;
  for (const ph of phones) consider('phone', ph.wx, ph.wz, ph.used ? 'Telefonu tekrar dinle' : 'Ahizeyi kaldır', ph);
  for (const k of kunyeler) if (!k.got && !k.inBox) consider('kunye', k.x, k.z, 'Künyeyi al', k, 1.4);
  for (const p of pickups) if (!p.got || p.type === 'N') consider('pick', p.x, p.z, p.type === 'C' || p.type === 'F' ? n.pick : p.type === 'B' ? 'Powerbank al' : 'Notu oku', p, 1.5);
  for (const c of containers) if (!c.opened) consider('search', c.x, c.z, c.kind === 'cab' ? 'Dolabı ara' : c.kind === 'desk' ? 'Çekmeceyi aç' : 'Morg çekmecesini aç', c, 1.5);
  for (const v of valves) if (!v.turned) consider('valve', v.x, v.z, n.pick, v, 1.6);
  for (const s of switches) consider('switch', s.x, s.z, s.grp.some(L => L.want) ? 'Lambaları söndür' : 'Lambaları yak', s, 1.6);
  for (const b of bottlesW) if (!b.got) consider('bottle', b.x, b.z, P.bottles >= 3 ? 'Elin dolu (en fazla 3 şişe)' : 'Şişeyi al', b, 1.3);
  const cx = W2C(P.x), cz = W2C(P.z);
  for (const [dx, dz] of DIRS) if (at(cx + dx, cz + dz) === 'H') consider('hide', C2W(cx) + dx * CS / 2, C2W(cz) + dz * CS / 2, 'Dolaba saklan', [cx + dx, cz + dz, dx, dz], 1.5);
  if (!door.unlocked) consider('door', door.x, door.z, P.keys >= n.n ? n.use : (n.n > 1 ? `${n.lock} (${P.keys}/${n.n})` : n.lock), null, 2.0);
  return best; }
function interact() {
  audioInit(); const f = focus; if (!f || caughtT > 0) return; const n = lv.need;
  if (f.kind === 'unhide') { const h = P.hidden; P.hidden = null; P.x = C2W(h.cx); P.z = C2W(h.cz); slats.visible = false; handsRoot.visible = true; blip(220, 0.25, 0.08, 'triangle', 0.05); return; }
  if (f.kind === 'phone') { const ph = f.ref; say('Nuri Abi: ' + lv.nuri[ph.idx % lv.nuri.length], 10); ph.used = true; P.cp = { x: ph.x, z: ph.z, yaw: ph.yaw, ph: ph.idx }; checkpointSave(); savedEl.style.opacity = 1; savedT = 2.5; blip(520, 0.6, 0.05, 'sine', 0.2); return; }
  if (f.kind === 'kunye') { const k = f.ref; k.got = true; k.g.visible = false; SAVE.kunye[k.id] = 1; writeSave(); showCard('Künye · ' + k.data[0], k.data[1]); updHud(); blip(660, 0.9, 0.06, 'sine', 0.15); return; }
  if (f.kind === 'bottle') { const b = f.ref; if (P.bottles >= 3) return; b.got = true; b.m.visible = false; P.bottles++; updHud(); blip(1200, 0.2, 0.03, 'triangle', 0.02); if (!SAVE.bottleTip) { SAVE.bottleTip = 1; writeSave(); say(isTouch ? 'ŞİŞE düğmesiyle fırlat. Düştüğü yerde ses çıkar.' : 'Q ile fırlat. Düştüğü yerde ses çıkar.', 5); } return; }
  if (f.kind === 'switch') { const s = f.ref; const on = !s.grp.some(L => L.want); for (const L of s.grp) L.want = on; s.lever.rotation.x = on ? 0.6 : -0.6; s.led.material.color.setScalar(on ? 0.3 : 2).multiply(new THREE.Color('#ffb36a')); blip(on ? 160 : 120, 0.3, 0.06, 'triangle', 0.02); if (on && AC) blip(100, 1.6, 0.04, 'sine', 0.6); return; }
  if (f.kind === 'search') { openContainer(f.ref, false); return; }
  if (f.kind === 'valve') { const v = f.ref; v.turned = true; v.spin = 1.6; P.keys++; updHud(); say(n.got + ` (${P.keys}/${n.n})`, 4); if (AC) { steamG.gain.setTargetAtTime(0.1, AC.currentTime, 0.25); setTimeout(() => steamG.gain.setTargetAtTime(0, AC.currentTime, 0.6), 1400); } lv.onKey && lv.onKey(GAPI, P.keys); return; }
  if (f.kind === 'pick') { const p = f.ref;
    if (p.type === 'N') { const t = lv.notes ? lv.notes[p.ni % lv.notes.length] : ''; showCard('Not', t, 9); p.got = true; blip(500, 0.4, 0.03, 'sine', 0.15); return; }
    p.got = true; p.vis.forEach(c => c.visible = false);
    if (p.type === 'B') { P.bat = Math.min(100, P.bat + 60); say('Powerbank. Fenerin doldu.', 3); }
    else { P.keys++; updHud(); if (n.got) say(n.n > 1 ? `${n.got} (${P.keys}/${n.n})` : n.got, 5); lv.onKey && lv.onKey(GAPI, P.keys); blip(90, 2.2, 0.1, 'sine', 0.8); }
    blip(700, 0.6, 0.05, 'sine', 0.12); return; }
  if (f.kind === 'hide') { const [hx, hz, dx, dz] = f.ref; P.hidden = { cx: W2C(P.x), cz: W2C(P.z) }; P.hx = C2W(W2C(P.x)) + dx * (CS / 2 - 0.25); P.hz = C2W(W2C(P.z)) + dz * (CS / 2 - 0.25); P.yaw = Math.atan2(dx, dz); P.pitch = -0.05; slats.visible = true; handsRoot.visible = false; P.torch = false; $('tF').classList.remove('on');
    for (const e of enemies) e.sawHide = (e.state === 'hunt' && e.kind === 'E' && Math.hypot(e.x - P.x, e.z - P.z) < 3 && los(e.x, e.z, P.x, P.z));
    blip(180, 0.3, 0.08, 'triangle', 0.05); return; }
  if (f.kind === 'door') { if (P.keys >= n.n) { door.unlocked = true; door.pm.color.setRGB(0.4, 2.2, 0.8); blip(880, 0.4, 0.05, 'sine', 0.05); say(n.open, 4); } else say(n.n > 1 ? `${n.lock} (${P.keys}/${n.n})` : n.lock, 3); }
}
// scripted hooks callable from chapter data
const GAPI = {
  lampsOffWhere(fn) { for (const L of lamps) if (fn(L)) lampsOff.add(L); },
  alarm() { for (const e of enemies) { if (e.kind === 'E') { e.state = 'hunt'; e.target = [W2C(P.x), W2C(P.z)]; e.path = []; } } },
  defter() { const n = totalKunye(); setTimeout(() => showCard('Nuri\'nin defteri', `Sayfalar dolusu ad. Her birinin yanında bir tarih ve küçük bir not. Senin bulduğun künyeler de burada yazılı: ${n} ad. Son sayfada titrek bir yazı: "Sabri, oku."`, 10), 600); },
};


// torch auto-dims when the beam hits something close, so nearby walls never blow out to white
const _tv = new THREE.Vector3();
function torchNear() { _tv.set(0, 0, -1).applyEuler(cam.rotation); const ox = cam.position.x, oy = cam.position.y, oz = cam.position.z; let t = 0.15;
  for (; t < 5; t += 0.12) { const x = ox + _tv.x * t, y = oy + _tv.y * t, z = oz + _tv.z * t; if (y < 0.02 || y > H - 0.05 || !passable(W2C(x), W2C(z))) break;
    let hit = false; for (const s of solids) if (y < 1.9 && (x - s.x) ** 2 + (z - s.z) ** 2 < s.r * s.r) { hit = true; break; } if (hit) break;
    for (const e of enemies) if (y < 2.1 && (x - e.x) ** 2 + (z - e.z) ** 2 < 0.16) { hit = true; break; } if (hit) break;
    for (const s of scareState) { const m = s.active && s.active.m; if (m && m.parent && y < 2.1 && (x - m.position.x) ** 2 + (z - m.position.z) ** 2 < 0.2) { hit = true; break; } } if (hit) break; }
  return Math.max(0.05, Math.min(1, (t / 4.5) ** 2.3)); }

// ================= GAME LOOP =================
let last = performance.now();
function circleCollide(x, z, r) { const cx = W2C(x), cz = W2C(z); for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const gx = cx + dx, gz = cz + dz; if (passable(gx, gz)) continue;
    const minX = gx * CS, maxX = minX + CS, minZ = gz * CS, maxZ = minZ + CS; const nx = Math.max(minX, Math.min(x, maxX)), nz = Math.max(minZ, Math.min(z, maxZ)); const ddx = x - nx, ddz = z - nz, d = Math.hypot(ddx, ddz); if (d < r && d > 1e-6) { x = nx + ddx / d * r; z = nz + ddz / d * r; } }
  for (const s of solids) { const ddx = x - s.x, ddz = z - s.z, d = Math.hypot(ddx, ddz), rr = r + s.r; if (d < rr && d > 1e-6) { x = s.x + ddx / d * rr; z = s.z + ddz / d * rr; } }
  return [x, z]; }
let caughtT = 0, swayT = 0, steamT = 0, steamLev = 0;
function update(dt) {
  P.time += dt; const night = cfg.d === 'X', diff = cfg.d === 'H' ? 0.78 : night ? 1.12 : 1;
  const sens = isTouch ? 0.0042 : 0.0022; P.yaw -= look.dx * sens; P.pitch -= look.dy * sens; look.dx = look.dy = 0; P.pitch = Math.max(-1.2, Math.min(1.2, P.pitch));
  // steam cycle (Kazan Dairesi): 11 s period, ~4 s of hiss; envelope eases over ~1 s, so no sudden change
  if (lv.steam) { steamT = (steamT + dt) % 11; const want = steamT < 4 ? 1 : 0; steamLev += (want - steamLev) * Math.min(1, dt * 1.6); } else steamLev = 0;
  // move
  let mx = 0, mz = 0; if (!P.hidden && caughtT <= 0) { if (keys.KeyW || keys.ArrowUp) mz -= 1; if (keys.KeyS || keys.ArrowDown) mz += 1; if (keys.KeyA || keys.ArrowLeft) mx -= 1; if (keys.KeyD || keys.ArrowRight) mx += 1; mx += touchMove.x; mz += touchMove.y; }
  const mm = Math.hypot(mx, mz); if (mm > 1) { mx /= mm; mz /= mm; }
  const crouch = P.crouchToggle || keys.ControlLeft; P.crouch += ((crouch ? 1 : 0) - P.crouch) * Math.min(1, dt * 8);
  if (P.stam === undefined) P.stam = 1; if (P.stam <= 0.02) P.tired = true; else if (P.stam > 0.35) P.tired = false;
  P.run = !crouch && !P.tired && (keys.ShiftLeft || keys.ShiftRight || P.touchRun || (isTouch && Math.hypot(touchMove.x, touchMove.y) > 0.95)) && mm > 0.3;
  if (P.run) { P.stam = Math.max(0, P.stam - dt / (cfg.d === 'H' ? 8 : 6)); P.stamWait = 0.9; } else { P.stamWait = Math.max(0, (P.stamWait || 0) - dt); if (P.stamWait <= 0) P.stam = Math.min(1, P.stam + dt / 4); }
  if (P.tired && AC && (P.pant = (P.pant || 0) - dt) <= 0) { P.pant = 0.75; blip(180, 0.35, 0.025, 'sine', 0.12); }
  const spd = crouch ? 1.15 : P.run ? 3.9 : 2.1; const cy = Math.cos(P.yaw), sy = Math.sin(P.yaw);
  const vx = (mx * cy + mz * sy) * spd, vz = (-mx * sy + mz * cy) * spd;
  if (!P.hidden) { [P.x, P.z] = circleCollide(P.x + vx * dt, P.z + vz * dt, 0.3); }
  const moving = Math.hypot(vx, vz) > 0.3 && !P.hidden; const masked = steamLev > 0.5;
  if (moving) { P.steps += dt * (P.run ? 3.1 : crouch ? 1.2 : 1.8); if (P.steps > 1) { P.steps -= 1; step(P.run ? 0.08 : crouch ? 0.015 : 0.035); if (!masked) { if (P.run) noise(P.x, P.z, 9, false); else if (!crouch) noise(P.x, P.z, 3.2, true); } } }
  if (P.torch) { P.bat = Math.max(0, P.bat - dt * ((night ? 1.3 : 0.9) + enemies.filter(e => e.beamed).length * 1.4)); if (P.bat <= 0) { P.torch = false; $('tF').classList.remove('on'); say('Fenerin pili bitti.', 3); } }
  const torchLevel = P.torch ? Math.min(1, 0.35 + P.bat / 40) * torchNear() : 0; { const tgt = torchLevel * 120; torchLight.intensity += (tgt * 0.8 - torchLight.intensity) * Math.min(1, dt * (tgt < torchLight.intensity ? 22 : 3)); } // dim instantly near surfaces, brighten slowly
  handsRoot.userData.bounce.intensity = torchLight.intensity / 120 * 0.5; ledMesh.material.color.setScalar(P.torch ? 6 : 0.2);
  $('bat').firstElementChild.style.width = P.bat + '%';
  // lamps: smooth fade (>= 1.5 s), never flicker
  for (const L of lamps) { const tgt = (L.want && !lampsOff.has(L)) ? 1 : 0; if (L.level !== tgt) setLamp(L, tgt > L.level ? Math.min(1, L.level + dt / 1.5) : Math.max(0, L.level - dt / (lv.final && lampsOff.size ? 2.2 : 1.5))); }
  if (door.unlocked && door.open < 1) { door.open = Math.min(1, door.open + dt * 0.6); door.l.position.z = -0.4 - door.open * 0.75; door.r.position.z = 0.4 + door.open * 0.75; }
  for (const v of valves) if (v.spin > 0) { v.spin -= dt; v.wheel.rotation.z += dt * 3.2; }
  // steam visuals
  if (lv.steam) { S.fog.density = lv.env.fogD + steamLev * 0.012; for (const vt of vents) for (const s of vt.sp) { const u = s.userData; u.ph = (u.ph + dt * 0.35) % 1; s.position.set(vt.x + u.ox * (1 + u.ph), 0.2 + u.ph * 2.6, vt.z + u.oz * (1 + u.ph)); const sc = 0.5 + u.ph * 1.6; s.scale.set(sc, sc, 1); s.material.opacity = steamLev * 0.32 * Math.sin(u.ph * Math.PI); } if (AC) steamG.gain.value += (steamLev * 0.09 - steamG.gain.value) * Math.min(1, dt * 2); }
  // camera
  const eye = 1.62 - P.crouch * 0.55; swayT += dt * (moving ? (P.run ? 9 : 6) : 1.2);
  if (P.hidden) cam.position.set(P.hx, 1.58, P.hz); else cam.position.set(P.x, eye, P.z);
  cam.rotation.set(P.pitch, P.yaw, 0);
  handsRoot.position.set(Math.sin(swayT * 0.5) * 0.004, Math.abs(Math.sin(swayT * 0.5)) * -0.006 + (P.torch ? 0 : -0.035), 0);
  { let hl = 0; for (const L of lamps) { if (L.level <= 0) continue; const d = Math.hypot(L.x - P.x, L.z - P.z); hl += L.level * (L.I / 240) / (1 + (d / 1.6) ** 2); } const k = 1 / (1 + hl * 4 + torchLight.intensity / 120 * 0.8); P.handK = (P.handK || 1) + (k - (P.handK || 1)) * Math.min(1, dt * 4); for (const [m, c0] of handMats) m.color.copy(c0).multiplyScalar(P.handK); }
  // phone: raise to read (Tab / TEL), auto-raise briefly when a message arrives
  { const Ph = handsRoot.userData.phone; P.phoneAuto = Math.max(0, (P.phoneAuto || 0) - dt); const want = (P.phoneHold || P.phoneAuto > 0) && !P.hidden ? 1 : 0; P.phoneUp = (P.phoneUp || 0) + (want - (P.phoneUp || 0)) * Math.min(1, dt * 5);
    const u = P.phoneUp * P.phoneUp * (3 - 2 * P.phoneUp); Ph.position.set(Ph.userData.p0.x + (0.03 - Ph.userData.p0.x) * u, Ph.userData.p0.y + (-0.045 - Ph.userData.p0.y) * u + (P.torch ? 0 : 0), Ph.userData.p0.z + (-0.27 - Ph.userData.p0.z) * u);
    Ph.rotation.set(Ph.userData.r0.x * (1 - u) - 0.04 * u, Ph.userData.r0.y * (1 - u), Ph.userData.r0.z * (1 - u)); handsRoot.userData.tost.visible = !!lv.prologue && P.keys < 1;
    phoneT -= dt; if (phoneT <= 0) { phoneT = 2; phoneDirty = true; } if (phoneDirty) drawPhone(); }
  updSms(dt);
  // breath while hidden
  const holding = keys.Space || P.touchHold; let near = 99; for (const e of enemies) near = Math.min(near, Math.hypot(e.x - P.x, e.z - P.z));
  const needBreath = P.hidden && near < 3.4; $('breath').style.opacity = P.hidden ? 1 : P.stam < 0.98 ? 0.65 : 0; $('tB').style.display = P.hidden ? 'flex' : 'none';
  if (P.hidden && holding) P.breath = Math.max(0, P.breath - dt / (cfg.d === 'H' ? 7 : 5)); else P.breath = Math.min(1, P.breath + dt * 0.12);
  $('breath').firstElementChild.style.width = ((P.hidden ? P.breath : P.stam) * 100) + '%';
  if (needBreath && (!holding || P.breath <= 0)) P.detectT += dt; else P.detectT = Math.max(0, P.detectT - dt);
  for (const e of enemies) (e.kind === 'A' ? listenerUpdate : enemyUpdate)(e, dt * diff);
  for (const s of sedyes) sedyeUpdate(s, dt);
  updFlying(dt); updContainers(dt); updScares(dt);
  // audio mix
  if (AC) { const lit = litAt(P.x, P.z); humG.gain.value += (lit * 0.05 - humG.gain.value) * Math.min(1, dt * 3);
    for (const c of chans) { const w = c.who; if (!w) continue; const d = Math.hypot(w.x - P.x, w.z - P.z); const mv = w.g ? (w.wait > 0 ? 0.05 : 0.7) : (w.moving ? 1 : w.state === 'alert' ? 0.6 : 0.05); const v = Math.max(0, 1 - d / 14) * 0.45 * mv * (masked ? 0.4 : 1); c.g.gain.value += (v - c.g.gain.value) * Math.min(1, dt * 4); if (c.pan) { const ang = Math.atan2(w.x - P.x, w.z - P.z) - P.yaw; c.pan.pan.value = Math.max(-1, Math.min(1, -Math.sin(ang))); } }
    let threat = 0; for (const e of enemies) if (e.state === 'hunt' || e.state === 'rush') threat = Math.max(threat, 1 - Math.hypot(e.x - P.x, e.z - P.z) / 12);
    heartT -= dt; if (threat > 0 && heartT <= 0) { heartT = 1.1 - threat * 0.55; blip(52, 0.18, 0.12 * threat + 0.03, 'sine', 0.03); setTimeout(() => blip(48, 0.2, 0.09 * threat + 0.02, 'sine', 0.03), 220); } }
  // capture
  if (caughtT > 0) { caughtT -= dt; if (caughtT <= 0) { respawn(); fadeTo(0); say(P.cp ? 'Çekmecede uyandın. Son telefonun yanındasın.' : 'Çekmecede uyandın. Baştasın.', 4); } }
  else { for (const e of enemies) { const d = Math.hypot(e.x - P.x, e.z - P.z); if ((!P.hidden && d < 0.85 && e.state !== 'frozen') || (P.hidden && (e.sawHide && d < 1.1 || P.detectT > 1.3) && d < 1.6)) { caught(); break; } }
    if (caughtT <= 0 && !P.hidden) for (const s of sedyes) { const along = Math.abs((P.x - s.x) * s.ax + (P.z - s.z) * s.az), across = Math.abs((P.x - s.x) * s.az + (P.z - s.z) * s.ax); if (along < 1.25 && across < 0.75 && s.wait <= 0) { caught(); break; } } }
  // exit
  if (door.open > 0.6 && !ended && caughtT <= 0 && Math.hypot(P.x - C2W(exitIt.cx), P.z - C2W(exitIt.cz)) < 2.3) finishChapter();
  focus = caughtT > 0 ? null : findFocus(); if (focus) { promptEl.hidden = false; promptEl.textContent = (isTouch ? '' : '[E] ') + focus.label; } else promptEl.hidden = true;
  if (subT > 0) { subT -= dt; if (subT <= 0) { if (subQ.length) say(...subQ.shift()); else subEl.style.opacity = 0; } } if (cardT > 0) { cardT -= dt; if (cardT <= 0) cardEl.style.opacity = 0; } if (savedT > 0) { savedT -= dt; if (savedT <= 0) savedEl.style.opacity = 0; }
}
function noise(x, z, r, quiet) { for (const e of enemies) { if (e.state === 'frozen') continue; const d = Math.hypot(e.x - x, e.z - z);
    if (e.kind === 'A') { if (d < r * 1.3) { e.state = 'rush'; e.target = [W2C(x), W2C(z)]; e.path = []; } }
    else if (d < r && (!quiet || r > 8) && e.state !== 'hunt') { e.state = 'hunt'; e.hs = 1.5; e.sus = 0.6; e.target = [W2C(x), W2C(z)]; e.path = []; } } }
function caught() { caughtT = cfg.flash ? 2.2 : 1.8; fadeTo(1); P.torch = false; $('tF').classList.remove('on'); if (P.hidden) { P.hidden = null; slats.visible = false; handsRoot.visible = true; } blip(60, 1.6, 0.14, 'sine', 0.6); }
function goAlong(e, goal, speed, dt) { const cx = W2C(e.x), cz = W2C(e.z); if (!e.path.length || e.pathGoal !== goal + '') { e.path = path(cx, cz, goal[0], goal[1]); e.pathGoal = goal + ''; }
  while (e.path.length && e.path[0][0] === cx && e.path[0][1] === cz) e.path.shift(); const nxt = e.path[0]; if (!nxt) { e.moving = false; return false; } moveTo(e, C2W(nxt[0]), C2W(nxt[1]), speed, dt); return true; }
function inBeam(e) { if (!P.torch || torchLight.intensity < 15) return false; const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz); if (d > 9 || d < 0.2) return false; if (P.pitch < -0.75 || P.pitch > 0.6) return false;
  const dot = (dx * -Math.sin(P.yaw) + dz * -Math.cos(P.yaw)) / d; return dot > 0.92 && los(P.x, P.z, e.x, e.z); }
function enemyUpdate(e, dt) {
  const lit = litAt(e.x, e.z), beam = inBeam(e);
  if (beam && !e.beamed && AC) blip(130, 0.6, 0.03, 'sine', 0.2); e.beamed = beam;
  if (lit > 0.5 || beam) { if (beam && e.state !== 'frozen') e.wasBeamed = true; e.state = 'frozen'; e.moving = false; return; }
  if (e.state === 'frozen') { if (e.wasBeamed && !e.small) { e.state = 'hunt'; e.hs = 2.2; e.target = [W2C(P.x), W2C(P.z)]; e.path = []; e.sus = 1; } else { e.state = 'patrol'; e.wait = 0.4; } e.wasBeamed = false; }
  const d = Math.hypot(P.x - e.x, P.z - e.z);
  const sightR = P.hidden ? 0 : (P.torch ? 15 : (P.crouch > 0.5 ? 3.5 : 6.5)) * (litAt(P.x, P.z) > 0.4 ? 1.3 : 1);
  let seen = false; if (d < sightR && los(e.x, e.z, P.x, P.z)) { const fx = Math.cos(e.yaw), fz = -Math.sin(e.yaw); const dot = ((P.x - e.x) * fx + (P.z - e.z) * fz) / (d || 1); seen = dot > -0.2 || d < 2.2 || P.torch; }
  // suspicion: stop and look first, then hunt. Gives the player a moment to hide or back off.
  if (e.state !== 'hunt') { if (seen) { const gain = (P.torch ? 1.5 : 0.85) * (1 + Math.max(0, 6 - d) / 3) * (cfg.d === 'H' ? 0.7 : cfg.d === 'X' ? 1.3 : 1); if (e.state !== 'alert' && AC) blip(95, 0.5, 0.035, 'sine', 0.15); e.state = 'alert'; e.sus = Math.min(1, e.sus + dt * gain);
      e.moving = false; const want = Math.atan2(-(P.z - e.z), P.x - e.x); let dy = want - e.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; e.yaw += dy * Math.min(1, dt * 3); e.m.rotation.y = e.yaw;
      if (e.sus >= 1) { e.state = 'hunt'; e.hs = 2.5; e.target = [W2C(P.x), W2C(P.z)]; e.path = []; } return; }
    else if (e.state === 'alert') { e.sus = Math.max(0, e.sus - dt * 0.4); e.moving = false; if (e.sus <= 0) { e.state = 'patrol'; e.wait = 0.5; } return; } }
  else if (seen) e.hs = 2.5;
  const cx = W2C(e.x), cz = W2C(e.z);
  if (e.state === 'hunt') { const speed = e.hs || 2.5; let goal = e.target; if (!P.hidden && d < sightR * 1.2 && los(e.x, e.z, P.x, P.z)) { goal = [W2C(P.x), W2C(P.z)]; e.target = goal; }
    if (cx === goal[0] && cz === goal[1]) { if (!P.hidden && d < 2.5) { moveTo(e, P.x, P.z, speed, dt); return; } e.state = 'search'; e.wait = 3.5; e.sus = 0.4; } else if (!goAlong(e, goal, speed, dt)) { e.state = 'search'; e.wait = 2; e.sus = 0.4; } return; }
  if (e.state === 'search') { e.wait -= dt; e.moving = false; e.yaw += dt * 0.8; e.m.rotation.y = e.yaw; if (e.wait <= 0) e.state = 'patrol'; return; }
  if (e.wait > 0) { e.wait -= dt; e.moving = false; return; } const goal = e.patrol[e.pi % e.patrol.length]; if (!goal || (cx === goal[0] && cz === goal[1])) { e.pi++; e.wait = 1.5 + rnd() * 2; return; } if (!goAlong(e, goal, 1.0, dt)) { e.pi++; e.wait = 1; }
}
// Dinleyen: blind, ignores light and the torch, rushes to sound
function listenerUpdate(e, dt) {
  const d = Math.hypot(P.x - e.x, P.z - e.z); const cx = W2C(e.x), cz = W2C(e.z);
  if (!P.hidden && d < 1.5 && P.crouch < 0.5 && Math.hypot(keys.KeyW || keys.KeyS || keys.KeyA || keys.KeyD ? 1 : 0, touchMove.x) > 0) { e.state = 'rush'; e.target = [W2C(P.x), W2C(P.z)]; }
  if (e.state === 'rush') { const goal = e.target; if (cx === goal[0] && cz === goal[1]) { if (!P.hidden && d < 1.6) { moveTo(e, P.x, P.z, 3.0, dt); return; } e.state = 'search'; e.wait = 3.2; } else if (!goAlong(e, goal, 3.3, dt)) { e.state = 'search'; e.wait = 2; } return; }
  if (e.state === 'search') { e.wait -= dt; e.moving = false; e.yaw += Math.sin(e.wait * 1.7) * dt * 1.2; e.m.rotation.y = e.yaw; if (e.wait <= 0) e.state = 'patrol'; return; }
  if (e.wait > 0) { e.wait -= dt; e.moving = false; return; } const goal = e.patrol[e.pi % e.patrol.length]; if (!goal || (cx === goal[0] && cz === goal[1])) { e.pi++; e.wait = 2 + rnd() * 3; return; } if (!goAlong(e, goal, 0.7, dt)) { e.pi++; e.wait = 1; }
}
function sedyeUpdate(s, dt) { if (s.wait > 0) { s.wait -= dt; return; } const len = Math.hypot(s.x1 - s.x0, s.z1 - s.z0) || 1; s.t += s.dir * dt * 2.3 / len; if (s.t >= 1 || s.t <= 0) { s.t = Math.max(0, Math.min(1, s.t)); s.dir *= -1; s.wait = 1.4; }
  const e = s.t * s.t * (3 - 2 * s.t) * 0.15 + s.t * 0.85; s.x = s.x0 + (s.x1 - s.x0) * e; s.z = s.z0 + (s.z1 - s.z0) * e; s.g.position.set(s.x, 0, s.z); }
function moveTo(e, tx, tz, speed, dt) { const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz); if (d < 0.02) return; const s = Math.min(d, speed * dt); e.x += dx / d * s; e.z += dz / d * s; [e.x, e.z] = circleCollide(e.x, e.z, 0.32);
  const want = Math.atan2(-dz, dx); let dy = want - e.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; e.yaw += dy * Math.min(1, dt * 4);
  e.moving = true; e.sway += dt * speed * 2.2; e.m.position.set(e.x, Math.abs(Math.sin(e.sway)) * 0.015, e.z); e.m.rotation.set(Math.sin(e.sway) * 0.015, e.yaw, Math.sin(e.sway * 0.5) * 0.02); }

// ================= NURI'S MESSAGES =================
let smsQ = [], smsGap = 0, smsSent = new Set(), lastRoom = -2;
function smsReset(silentStart) { smsQ = []; smsGap = 2.5; smsSent = new Set(); phoneMsgs.length = 0; lastRoom = -2; phoneDirty = true;
  (lv.sms || []).forEach((m, i) => { if (m[0] === 'start') { if (silentStart) { smsSent.add(i); phoneMsgs.push(m[1]); } else { smsSent.add(i); smsQ.push(m[1]); } } }); }
function smsTrigger(kind) { (lv.sms || []).forEach((m, i) => { if (!smsSent.has(i) && m[0] === kind) { smsSent.add(i); smsQ.push(m[1]); } }); }
function updSms(dt) { const r = roomOf(W2C(P.x), W2C(P.z)); if (r !== lastRoom) { lastRoom = r; if (r >= 0 && lv.rooms[r][5]) smsTrigger('room:' + lv.rooms[r][5]); }
  if (P.keys >= 1 && !P.keySms) { P.keySms = true; smsTrigger('key'); phoneDirty = true; }
  smsGap -= dt; if (smsGap <= 0 && smsQ.length && caughtT <= 0) { const t = smsQ.shift(); phoneMsgs.push(t); phoneDirty = true; smsGap = 3.2; if (!P.hidden) P.phoneAuto = 3.8; say('Nuri Abi: ' + t, 5);
    if (AC) { blip(150, 0.12, 0.05, 'square', 0.005); setTimeout(() => blip(150, 0.12, 0.05, 'square', 0.005), 180); } } }
// ================= FLOW: chapters, save, story =================
function checkpointSave() { SAVE.cur = { lv: LVI, ph: P.cp ? P.cp.ph : -1, keys: P.keys, taken: pickups.filter(p => p.got && p.type !== 'N').map(p => p.idx), valves: valves.filter(v => v.turned).map(v => v.idx), opened: containers.filter(c => c.opened).map(c => c.idx), bottles: P.bottles, bat: P.bat, time: P.time }; writeSave(); }
function loadChapter(i, resume, preview) {
  buildLevel(i); P.keys = 0; P.bottles = 0; P.bat = 100; P.torch = false; P.time = 0; P.cp = null; ended = false; caughtT = 0; flying.length = 0; door.unlocked = false; door.open = 0; steamT = 0;
  if (resume && SAVE.cur && SAVE.cur.lv === i) { const c = SAVE.cur; P.keys = c.keys || 0; P.bottles = c.bottles || 0; P.bat = c.bat ?? 100; P.time = c.time || 0;
    for (const k of c.taken || []) { const p = pickups[k]; if (p) { p.got = true; p.vis.forEach(m => m.visible = false); } } for (const k of c.opened || []) { const ct = containers[k]; if (ct) openContainer(ct, true); }
    for (const k of c.valves || []) { const v = valves[k]; if (v) { v.turned = true; v.wheel.rotation.z = 4; } }
    const ph = phones[c.ph]; if (ph) { ph.used = true; P.cp = { x: ph.x, z: ph.z, yaw: ph.yaw, ph: ph.idx }; }
    if (lv.onKey && P.keys >= lv.need.n && LVI === 1) lv.onKey(GAPI, P.keys);
    if (lv.final && P.keys >= 1) GAPI.lampsOffWhere(() => true); }
  else if (!preview) { SAVE.cur = { lv: i, ph: -1, keys: 0, taken: [], valves: [], bottles: 0, bat: 100, time: 0 }; writeSave(); }
  P.keySms = P.keys >= 1; P.stam = 1; P.tired = false; P.phoneHold = false; P.phoneAuto = 0; smsReset(!!resume || !!preview); if (resume && P.keySms) (lv.sms || []).forEach((m, i) => { if (m[0] === 'key') { smsSent.add(i); phoneMsgs.push(m[1]); } });
  initScares(); respawn(); cam.position.set(P.x, 1.62, P.z); cam.rotation.set(0, P.yaw, 0); updHud(); }
function startChapter(i, resume) {
  $('start').hidden = true; $('end').hidden = true; $('pause').hidden = true; fadeTo(1, 0.6);
  setTimeout(() => { loadChapter(i, resume); $('hud').hidden = false; if (isTouch) $('touch').hidden = false; applyQuality(); audioInit(); running = true; paused = false; fadeTo(0, 2.5);
    subQ.length = 0; const intro = lv.intro.map(t => t[0] === '@' ? [isTouch ? t.slice(1).replace(/F ile/g, 'FENER ile').replace(/E ile/g, 'ETKİLEŞ ile').replace(/Space ile/g, 'NEFES ile').replace(/Q ile/g, 'ŞİŞE ile') : t.slice(1), 6] : [t, 7]);
    setTimeout(() => { if (resume && P.cp) say('Son telefonun yanındasın.', 4); else { say(...intro[0]); intro.slice(1).forEach(x => subQ.push(x)); } }, 1200);
    lockPointer(); if (isTouch) { try { document.documentElement.requestFullscreen?.().catch(() => {}); screen.orientation?.lock?.('landscape').catch(() => {}); } catch (e) {} } }, 700); }
function finishChapter() { ended = true; fadeTo(1, 1.5); try { document.exitPointerLock(); } catch (e) {}
  const t = P.time, n = kunyeler.filter(k => k.got).length;
  SAVE.unlocked = Math.max(SAVE.unlocked, Math.min(LV.length - 1, LVI + 1)); SAVE.best[LVI] = Math.min(SAVE.best[LVI] || 1e9, t); SAVE.cur = LVI + 1 < LV.length ? { lv: LVI + 1, ph: -1, keys: 0, taken: [], valves: [], bottles: 0, bat: 100, time: 0 } : null; writeSave();
  setTimeout(() => { running = false; $('hud').hidden = true; $('touch').hidden = true;
    if (lv.final) { SAVE.done = true; writeSave(); playEnding(); return; }
    if (lv.prologue) { playStory(LIGHTS_OUT, () => startChapter(1, false)); return; }
    $('endH').textContent = `${LVI}. ${lv.name}`; $('endk').textContent = `Süre ${fmt(t)} · Künye ${n}/${kunyeler.length} · Toplam ${totalKunye()}/40`; phoneMsgs.length = 0; $('endp').textContent = lv.end; $('next').textContent = 'Sonraki: ' + LV[LVI + 1].name; $('end').hidden = false; }, 1700); }
const fmt = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
let storyCancel = null;
function playStory(lines, done) { const el = $('story'), tx = $('storyT'); el.hidden = false; tx.style.opacity = 0; let i = 0, alive = true, timer = 0;
  const nextLine = () => { if (!alive) return; if (i >= lines.length) { finish(); return; } const L = lines[i++]; tx.style.opacity = 0;
    timer = setTimeout(() => { if (!alive) return; if (L === '#NAMES') { tx.className = 'names'; tx.textContent = ''; LV.forEach(l => l.kunye.forEach(k => { const d = document.createElement('div'); d.textContent = k[0]; tx.appendChild(d); })); } else { tx.className = ''; tx.textContent = L; }
      tx.style.opacity = 1; timer = setTimeout(nextLine, L === '#NAMES' ? 9000 : 2600 + L.length * 45); }, 1100); };
  const finish = () => { if (!alive) return; alive = false; clearTimeout(timer); tx.style.opacity = 0; setTimeout(() => { el.hidden = true; done(); }, 900); };
  storyCancel = finish; $('skip').onclick = finish; nextLine(); }
function playEnding() { const full = totalKunye() >= 40; fadeTo(1, 0.6);
  playStory(full ? END_REMEMBER : END_ESCAPE, () => { $('endH').textContent = full ? 'Hatırlama' : 'Kaçış'; $('endk').textContent = `Künye ${totalKunye()}/40`;
    $('endp').textContent = full ? 'Gerçek son. Ödül: Bekçi Kasketi. "Gece Vardiyası" zorluğu açıldı.' : `Kaçtın. Ama ${40 - totalKunye()} ad hâlâ okunmadı. Bölüm seçerek eksik künyeleri bulabilirsin. "Gece Vardiyası" zorluğu açıldı.`;
    $('next').textContent = 'Ana menü'; $('end').hidden = false; }); }
function setPause(v) { paused = v; $('pause').hidden = !v; $('pauseK').textContent = `${LVI ? LVI + '. ' : ''}${lv.name} · Künye ${totalKunye()}/40` + (lv.obj ? ' · Görev: ' + lv.obj[P.keys >= lv.need.n ? 1 : 0] : ''); if (AC) master.gain.setTargetAtTime(v ? 0 : 0.7, AC.currentTime, 0.2); }
$('resume').onclick = () => { setPause(false); lockPointer(); };
$('toMenu').onclick = () => { setPause(false); running = false; $('hud').hidden = true; $('touch').hidden = true; showMenu(); };
addEventListener('keydown', e => { if (e.code === 'Escape' && running && isTouch) setPause(!paused); });
$('next').onclick = () => { if (!LV[LVI + 1] || lv.final) { $('end').hidden = true; showMenu(); return; } startChapter(LVI + 1, false); };
$('rest').onclick = () => { $('end').hidden = true; showMenu(); };

function frame(now) { if (typeof __dead !== 'undefined' && __dead) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; if (running && !paused) update(dt); grade.uniforms.uT.value = (grade.uniforms.uT.value + 1) % 64; grade.uniforms.uDark.value = P.hidden ? 0.35 : 0; comp.render(); requestAnimationFrame(frame); }

// ================= MENU =================

function syncOpts() { $('qA').setAttribute('aria-pressed', cfg.q === 'A'); $('qS').setAttribute('aria-pressed', cfg.q === 'S'); $('dH').setAttribute('aria-pressed', cfg.d === 'H'); $('dN').setAttribute('aria-pressed', cfg.d === 'N'); $('dX').setAttribute('aria-pressed', cfg.d === 'X'); $('dX').hidden = !SAVE.done; $('fl').setAttribute('aria-pressed', cfg.flash); ['j0', 'j1', 'j2'].forEach((id, i) => $(id).setAttribute('aria-pressed', cfg.js === i)); $('fl').textContent = cfg.flash ? 'Açık' : 'Kapalı'; }
$('qA').onclick = () => { cfg.q = 'A'; syncOpts(); saveCfg(); }; $('qS').onclick = () => { cfg.q = 'S'; syncOpts(); saveCfg(); };
$('dH').onclick = () => { cfg.d = 'H'; syncOpts(); saveCfg(); }; $('dN').onclick = () => { cfg.d = 'N'; syncOpts(); saveCfg(); }; $('dX').onclick = () => { cfg.d = 'X'; syncOpts(); saveCfg(); };
$('fl').onclick = () => { cfg.flash = !cfg.flash; syncOpts(); saveCfg(); };
['j0', 'j1', 'j2'].forEach((id, i) => { $(id).onclick = () => { cfg.js = i; syncOpts(); saveCfg(); }; });
if (isTouch) $('keys').innerHTML = 'Sol tarafı sürükle: yürü (sona kadar it: koş) · Sağ tarafı sürükle: bak · Telefonu yatay tut. Kulaklık önerilir. Ani korkutmalar sesle ve hareketle yapılır; flaş ve beyaz ekran yoktur.';
function showMenu() { const c = $('chaps'); c.innerHTML = ''; LV.forEach((l, i) => { const b = document.createElement('button'); b.className = 'opt'; const got = l.kunye.filter((_, k) => SAVE.kunye[i + '-' + k]).length; b.innerHTML = `${i ? i + '. ' : ''}${l.name}<small>${i > SAVE.unlocked ? 'kilitli' : i ? `künye ${got}/5` : 'giriş'}</small>`; b.disabled = i > SAVE.unlocked; b.onclick = () => startChapter(i, false); c.appendChild(b); });
  const cur = SAVE.cur; $('cont').hidden = !cur; $('go').className = cur ? 'go ghost' : 'go'; if (cur) $('cont').textContent = `Devam et · ${cur.lv ? cur.lv + '. ' : ''}${LV[cur.lv].name}`; $('startK').textContent = `Sabri'nin Büfesi · Gece hikâyesi · Künye ${totalKunye()}/40`; syncOpts(); $('start').hidden = false; fadeTo(0.35, 0.6); }
if (typeof __embedded !== 'undefined' && __embedded) { $('quit').hidden = false; $('quit2').hidden = false; $('quit').onclick = () => __exit(); $('quit2').onclick = () => __exit(); }
$('cont').onclick = () => { const c = SAVE.cur; if (c) startChapter(c.lv, true); };
$('go').onclick = () => { $('start').hidden = true; audioInit(); SAVE.cur = null; writeSave(); playStory(INTRO, () => startChapter(0, false)); };
if (!SAVE.unlocked) SAVE.unlocked = 0;
loadChapter(SAVE.cur ? SAVE.cur.lv : 0, false, true);
showMenu(); requestAnimationFrame(frame);
window.__morg = { P, get enemies() { return enemies; }, get lamps() { return lamps; }, get lv() { return LVI; }, startChapter, loadChapter, interact: () => interact(), getFocus: () => focus, teleport: (cx, cz, yaw) => { P.x = C2W(cx); P.z = C2W(cz); if (yaw !== undefined) P.yaw = yaw; }, state: () => ({ lv: LVI, ended, caughtT, keys: P.keys, hidden: !!P.hidden, unlocked: door.unlocked, running }), save: () => SAVE, finish: () => finishChapter(), get map() { return MAP; }, get door() { return door; }, get exit() { return exitIt; }, get pickups() { return pickups; }, get valves() { return valves; }, get switches() { return switches; }, get bottles() { return bottlesW; }, get sedyes() { return sedyes; }, get containers() { return containers; }, get rooms() { return lv.rooms || []; }, spawnFig: (l, x, z, yaw) => { const m = carsafliMesh(l); m.position.set(x, 0, z); m.rotation.y = yaw; world.add(m); return 1; }, get scares() { return scareState; }, openContainer, throwBottle: () => throwBottle(), litAt, tick: n => { for (let i = 0; i < n; i++) update(0.05); } };

}
