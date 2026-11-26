// Menü yazı tiplerini (OFL: Baloo 2, Rubik; Google Fonts) base64 olarak src/game/ui/menu-font.ts içine gömer.
// Çalıştır: node calisma/giris-aaa/font-uret.mjs   (oyun/ klasöründen)
import { readFileSync, writeFileSync } from 'node:fs';
const b = f => readFileSync('calisma/giris-aaa/font/' + f).toString('base64');
const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const EXT = 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF';
const face = (fam, f, r) => `@font-face{font-family:'${fam}';font-style:normal;font-weight:400 800;font-display:swap;src:url(data:font/woff2;base64,${b(f)}) format('woff2');unicode-range:${r}}`;
const css = [face('SB Baslik', 'baloo2-latin.woff2', LATIN), face('SB Baslik', 'baloo2-latin-ext.woff2', EXT), face('SB Govde', 'rubik-latin.woff2', LATIN), face('SB Govde', 'rubik-latin-ext.woff2', EXT)].join('\n');
writeFileSync('src/game/ui/menu-font.ts', `// ÜRETİLDİ: calisma/giris-aaa/font-uret.mjs. Elle düzenleme.\n// Baloo 2 + Rubik (SIL Open Font License 1.1). Özel adlarla ('SB Baslik', 'SB Govde') kaydedilir: oyun içi HUD yazısı değişmez.\nexport const MENU_FONT_CSS = ${JSON.stringify(css)};\n`);
console.log('menu-font.ts', css.length, 'bayt');
