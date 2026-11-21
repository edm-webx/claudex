// KAL-15 kablolama (wired-ness) denetçisi. TypeScript derleyicisinin ayrıştırıcısıyla (tip denetimi yok, hızlı):
//  1) src/content/** içindeki her dışa aktarılan değerin (const/let/function/class/enum) başka dosyalarda kullanılıp kullanılmadığı,
//  2) hiçbir yerden içe aktarılmayan modüller,
//  3) ölü kod bayrakları (*_ON / *_KAPALI / *_OFF) ve değerleri.
// Kullanım: node tools/baglilik.mjs [--json]  (çıktı: tablo ya da JSON). Testten: import { analiz } from '../../tools/baglilik.mjs'.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ts = require('typescript');

const KOK = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function ts_dosyalari(d) {
  if (!existsSync(d)) return [];
  return readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? ts_dosyalari(p) : /\.(ts|tsx)$/.test(f) && !/\.d\.ts$/.test(f) ? [p] : []; });
}
const oku = p => ts.createSourceFile(p, readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

/** Dosyanın dışa aktardığı DEĞER adları (tip/arayüz hariç) ve içe aktarım yolları. */
function ozet(sf) {
  const disa = [], iceri = [], kullanilan = new Set();
  const dis = n => (ts.getCombinedModifierFlags?.(n) & ts.ModifierFlags.Export) !== 0 || n.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
  sf.forEachChild(n => {
    if (ts.isVariableStatement(n) && dis(n)) for (const d of n.declarationList.declarations) { if (ts.isIdentifier(d.name)) disa.push(d.name.text); else d.name.elements?.forEach(e => ts.isIdentifier(e.name) && disa.push(e.name.text)); }
    else if ((ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n) || ts.isEnumDeclaration(n)) && n.name && dis(n)) disa.push(n.name.text);
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) iceri.push(n.moduleSpecifier.text);
  });
  const gez = n => {
    if (ts.isIdentifier(n)) kullanilan.add(n.text);
    // import x from './m' satırlarındaki adlar "kullanım" sayılmaz; gerçek kullanım gövdede görünür
    if (ts.isImportDeclaration(n)) return;
    ts.forEachChild(n, gez);
  };
  gez(sf);
  // dinamik import('./x') yolları
  const dyn = n => { if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) iceri.push(n.arguments[0].text); ts.forEachChild(n, dyn); };
  dyn(sf);
  return { disa, iceri, kullanilan };
}

function cozumle(kaynak, spec, tum) {
  if (!spec.startsWith('.')) return null;
  const b = resolve(dirname(kaynak), spec);
  for (const c of [b + '.ts', b + '.tsx', join(b, 'index.ts'), b]) if (tum.has(c)) return c;
  return null;
}

/** @param {{kok?: string}} [o] */
export function analiz(o = {}) {
  const kok = o.kok || KOK, src = join(kok, 'src');
  const dosyalar = ts_dosyalari(src);
  const veri = new Map(dosyalar.map(f => [f, ozet(oku(f))]));
  const tum = new Set(dosyalar);
  // test ve araçlar da "tüketici" sayılır ayrı bir kümede: yalnız testte kullanılan içerik "tüketicisiz" kalır
  const testler = [...ts_dosyalari(join(kok, 'tests')), ...ts_dosyalari(join(kok, 'tools'))];
  const testKullanim = new Set(); for (const f of testler) for (const k of ozet(oku(f)).kullanilan) testKullanim.add(k);

  const importEden = new Map(); // dosya -> [kimler]
  for (const [f, v] of veri) for (const s of v.iceri) { const h = cozumle(f, s, tum); if (h) (importEden.get(h) || importEden.set(h, []).get(h)).push(f); }

  const tuketicisiz = [], yalnizIcerikte = [], modulYetim = [];
  const icerik = dosyalar.filter(f => relative(src, f).startsWith('content'));
  for (const f of icerik) {
    const rel = relative(kok, f);
    for (const ad of veri.get(f).disa) {
      let dis = 0, icerikIci = 0;
      for (const [g, v] of veri) { if (g === f || !v.kullanilan.has(ad)) continue; if (relative(src, g).startsWith('content')) icerikIci++; else dis++; }
      if (!dis && !icerikIci) tuketicisiz.push({ dosya: rel, ad, testteVar: testKullanim.has(ad) });
      else if (!dis) yalnizIcerikte.push({ dosya: rel, ad, icerikIci });
    }
    if (!(importEden.get(f) || []).length && !/index\.ts$/.test(f)) modulYetim.push(rel);
  }
  // src dışındaki giriş noktaları (main/boot) zaten src içinde; yine de tüm src modüllerini tara
  const yetimTum = dosyalar.filter(f => !(importEden.get(f) || []).length && !/(^|\/)(main|boot|index)\.ts$/.test(f) && !/\/(worker|entry)/.test(f)).map(f => relative(kok, f));

  const bayraklar = [];
  for (const f of dosyalar) {
    const t = readFileSync(f, 'utf8');
    for (const m of t.matchAll(/^[ \t]*(?:export\s+)?(?:const|let)\s+([A-Z][A-Z0-9_]*_(?:ON|OFF|KAPALI|ACIK))\s*(?::\s*boolean\s*)?=\s*(true|false)\b/gm)) {
      const satir = t.slice(0, m.index).split('\n').length;
      bayraklar.push({ dosya: relative(kok, f), satir, ad: m[1], deger: m[2], aktif: (/_(ON|ACIK)$/.test(m[1])) === (m[2] === 'true') });
    }
  }
  return { tuketicisiz, yalnizIcerikte, modulYetim, yetimTum, bayraklar, dosyaSayisi: dosyalar.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = analiz();
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 1));
  else {
    console.log(`tarandı: ${r.dosyaSayisi} dosya\n\n== İçerik dışa aktarımları, hiçbir yerde kullanılmayan (${r.tuketicisiz.length})`);
    for (const x of r.tuketicisiz) console.log(`  ${x.dosya}  ${x.ad}${x.testteVar ? '  (yalnız testte)' : ''}`);
    console.log(`\n== Yalnız başka içerik dosyalarında kullanılan (oyun koduna bağlı değil) (${r.yalnizIcerikte.length})`);
    for (const x of r.yalnizIcerikte) console.log(`  ${x.dosya}  ${x.ad}`);
    console.log(`\n== Hiçbir yerden içe aktarılmayan içerik modülleri (${r.modulYetim.length})`); for (const x of r.modulYetim) console.log('  ' + x);
    console.log(`\n== Ölü kod bayrakları (${r.bayraklar.length})`); for (const b of r.bayraklar) console.log(`  ${b.dosya}:${b.satir}  ${b.ad} = ${b.deger}  ${b.aktif ? '(AÇIK)' : '(KAPALI)'}`);
  }
}
