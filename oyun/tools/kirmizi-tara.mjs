// KAL-15 kırmızı çizgi bekçisi: tests/kirmizi-cizgiler.json kurallarını src/ altında TypeScript ayrıştırıcısıyla tarar.
//  tur 'metin'  : kullanıcıya görünebilecek yazı sabitleri (string/şablon). Boşluk içermeyen sabitler (kimlikler) sayılmaz, 'bosluksuz': true ise sayılır.
//  tur 'kimlik' : kod içindeki tanımlayıcı adları (yorum ve string dışı).
//  tur 'dosya'  : var olmaması gereken dosya yolu (regex).
// 'istisna' [{dosya: regex, neden}] kural için taramayı atlar, 'sadece' regex yalnız eşleşen dosyaları tarar; 'bilinen' {dosya: adet} bilinen ihlaldir (yeni ihlal kırmızı, azalan liste uyarı).
// Kullanım: node tools/kirmizi-tara.mjs [--json]. Testten: import { tara } from '../../tools/kirmizi-tara.mjs'.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const KOK = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const yuru = d => (existsSync(d) ? readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? yuru(p) : /\.(ts|tsx)$/.test(f) && !/\.d\.ts$/.test(f) ? [p] : []; }) : []);

export function kurallar(kok = KOK) { return JSON.parse(readFileSync(join(kok, 'tests/kirmizi-cizgiler.json'), 'utf8')); }

/** @returns {{kural: any, hits: {dosya: string, satir: number, parca: string}[], sayim: Record<string, number>, yeni: string[], bayat: string[]}[]} */
export function tara(kok = KOK) {
  const src = join(kok, 'src');
  const dosyalar = yuru(src).map(f => relative(kok, f));
  const R = kurallar(kok).kurallar;
  const ayrisim = new Map();   // dosya -> { str: [{t, satir}], id: [{t, satir}] }
  const al = rel => {
    if (ayrisim.has(rel)) return ayrisim.get(rel);
    const sf = ts.createSourceFile(rel, readFileSync(join(kok, rel), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const str = [], id = [];
    const satir = n => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
    const gez = n => {
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
        // import/export yolları ve tür-sabitleri kullanıcıya görünmez
        if (!((ts.isImportDeclaration(n.parent) || ts.isExportDeclaration(n.parent)))) str.push({ t: n.text, satir: satir(n) });
      } else if (ts.isIdentifier(n)) id.push({ t: n.text, satir: satir(n) });
      ts.forEachChild(n, gez);
    };
    gez(sf);
    const o = { str, id }; ayrisim.set(rel, o); return o;
  };
  const cikti = [];
  for (const kural of R) {
    const hits = [];
    const re = kural.desen ? new RegExp(kural.desen, kural.bayrak ?? 'i') : null;
    const ist = (kural.istisna || []).map(i => new RegExp(i.dosya)), sadece = kural.sadece ? new RegExp(kural.sadece) : null;
    if (kural.tur === 'dosya') {
      for (const f of dosyalar) if (re.test(f)) hits.push({ dosya: f, satir: 0, parca: f });
    } else {
      for (const f of dosyalar) {
        if (ist.some(r => r.test(f)) || (sadece && !sadece.test(f))) continue;
        const o = al(f);
        if (kural.tur === 'metin') for (const s of o.str) { if (!kural.bosluksuz && !/\s/.test(s.t)) continue; const m = re.exec(s.t); if (m) hits.push({ dosya: f, satir: s.satir, parca: s.t.slice(Math.max(0, m.index - 20), m.index + 40) }); }
        else if (kural.tur === 'kimlik') for (const s of o.id) if (re.test(s.t)) hits.push({ dosya: f, satir: s.satir, parca: s.t });
      }
    }
    const sayim = {}; for (const h of hits) sayim[h.dosya] = (sayim[h.dosya] || 0) + 1;
    const bil = kural.bilinen || {};
    const yeni = Object.keys(sayim).filter(f => sayim[f] > (bil[f] || 0)).map(f => `${f}: ${sayim[f]} (bilinen ${bil[f] || 0})`);
    const bayat = Object.keys(bil).filter(f => (sayim[f] || 0) < bil[f]).map(f => `${f}: bilinen ${bil[f]}, şimdi ${sayim[f] || 0}`);
    cikti.push({ kural, hits, sayim, yeni, bayat });
  }
  return cikti;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = tara();
  if (process.argv.includes('--json')) console.log(JSON.stringify(r.map(x => ({ id: x.kural.id, hits: x.hits, yeni: x.yeni, bayat: x.bayat })), null, 1));
  else for (const x of r) {
    console.log(`\n[${x.kural.id}] ${x.kural.alinti} (${x.kural.tarih})  ->  ${x.hits.length} bulgu, yeni ${x.yeni.length}, bayat ${x.bayat.length}`);
    for (const h of x.hits) console.log(`   ${h.dosya}:${h.satir}  ${h.parca.replace(/\s+/g, ' ')}`);
  }
}
