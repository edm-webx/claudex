// QA 2026-11-27 teknik rapor YÜKSEK bulguları: yönetici paneli XSS, giriş zaman aşımı, piksel tavanı, itch index.html
import { describe, it, expect } from 'vitest';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { esc } from '../../src/game/ui/admin-panel';
import { uidTemiz } from '../../src/game/online';
import { zamanAsimi, zamanliFetch } from '../../src/game/net/supa';
import { pikselOrani, PIKSEL_TAVAN, TIER_TABLE, renderScale } from '../../src/engine/quality';
// @ts-expect-error: .mjs araç modülü (tip yok)
import { itchSarmala } from '../../tools/itch-html.mjs';

describe('yönetici paneli: başka oyuncudan gelen id HTML olamaz', () => {
  it('esc tırnağı ve etiketi kaçırır, uid yalnız uuid karakterleri', () => {
    const kotu = '"><img src=x onerror=alert(1)>';
    expect(esc(kotu)).not.toMatch(/[<>"]/);
    expect(uidTemiz(kotu)).toBe('');
    expect(uidTemiz('3f2a9c1e-0b7d-4e55-9a1c-2d3e4f5a6b7c')).toBe('3f2a9c1e-0b7d-4e55-9a1c-2d3e4f5a6b7c');
    expect(uidTemiz(42)).toBe(''); expect(uidTemiz('a'.repeat(41))).toBe('');
  });
  it('panelde HTML özniteliğine giren her ${...} esc ya da sayı', () => {
    const src = readFileSync('src/game/ui/admin-panel.ts', 'utf8');
    const ham = [...src.matchAll(/data-[a-z]+="\$\{([^}]*)\}"/g)].map(m => m[1]).filter(x => !/^esc\(/.test(x));
    // kalanlar yalnız sayı / sabit içerik (döngü sayacı, koordinat, sekme anahtarı)
    for (const x of ham) expect(x).toMatch(/^(i \+ 1|l|k|r\.stop\.[xz]|x|z|n|h|focus|f)$/);
  });
});

describe('giriş: istek zaman aşımı', () => {
  it('zamanAsimi asılı sözde yedeği döndürür, hızlı sözü bozmaz', async () => {
    expect(await zamanAsimi(new Promise<string>(() => {}), 20, 'yavas')).toBe('yavas');
    expect(await zamanAsimi(Promise.resolve('ok'), 1000, 'yavas')).toBe('ok');
  });
  it('zamanliFetch yanıtsız isteği keser', async () => {
    const asili: typeof fetch = (_i, init) => new Promise((_res, rej) => { init?.signal?.addEventListener('abort', () => rej(init.signal!.reason)); });
    await expect(zamanliFetch(20, asili)('https://x')).rejects.toThrow(/timeout/);
    const hizli: typeof fetch = async () => new Response('ok');
    expect(await (await zamanliFetch(1000, hizli)('https://x')).text()).toBe('ok');
  });
  it('giriş formu: istek sürerken ikinci gönderim yok, düğme zaman aşımıyla geri gelir', () => {
    const src = readFileSync('src/game/ui/giris.ts', 'utf8');
    expect(src).toMatch(/if \(mesgul\) return;/);
    expect(src).toMatch(/zamanAsimi\(mode === 'giris' \? girisYap/);
    expect(readFileSync('src/game/net/supa.ts', 'utf8')).toMatch(/global: \{ fetch: zamanliFetch\(\) \}/);
  });
});

describe('piksel tavanı', () => {
  it('1080p görüntüsü değişmez, 4K / Retina tavana iner', () => {
    for (const t of Object.values(TIER_TABLE)) expect(pikselOrani(t, 1, 1920, 1080)).toBe(renderScale(t, 1));
    const s = TIER_TABLE.sahane;
    const pr4k = pikselOrani(s, 1.5, 2560, 1440);
    expect(pr4k).toBeLessThan(renderScale(s, 1.5));
    expect(pr4k * pr4k * 2560 * 1440).toBeLessThanOrEqual(PIKSEL_TAVAN.sahane);
    const pr5k = pikselOrani(s, 2, 2560, 1440);                     // Retina 5K
    expect(pr5k * pr5k * 2560 * 1440).toBeLessThanOrEqual(PIKSEL_TAVAN.sahane);
    expect(pikselOrani(TIER_TABLE.akici, 3, 400, 850)).toBe(0.85);   // telefon: tavanın altında, aynı
    expect(pikselOrani(s, 2, 20000, 20000)).toBe(0.5);               // taban
  });
});

describe('itch paketi index.html', () => {
  it('doctype + head/body; parça içeriği aynen korunur', () => {
    const parca = `<title>Sabri'nin Büfesi</title>\n<meta charset="utf-8">\n<style>#a{}</style>\n<div id="app"><canvas id="c"></canvas></div>\n<script src="game.js"></script>\n`;
    const h = itchSarmala(parca);
    expect(h).toMatch(/^<!DOCTYPE html>\n<html lang="tr">\n<head>\n<meta charset="utf-8">\n<title>/);
    expect(h).toMatch(/<\/style>\n<\/head>\n<body>\n<div id="app">/);
    expect(h).toMatch(/<script src="game\.js"><\/script>\n<\/body>\n<\/html>\n$/);
    expect(itchSarmala(h)).toBe(h);
  });
  it('build-artifact: sözleşme bozulmaz, yükleme bekçisi var (game.js inmezse "Tekrar dene")', () => {
    const d = mkdtempSync(join(tmpdir(), 'marti-ba-'));
    try {
      writeFileSync(join(d, 'game.js'), 'window.__martiBasladi=true;');
      execFileSync('node', ['tools/build-artifact.mjs'], { env: { ...process.env, MARTI_DIST: d }, stdio: 'ignore' });
      const h = readFileSync(join(d, 'index.html'), 'utf8');
      expect(h).not.toMatch(/<!doctype/i);
      expect(h).toMatch(/<script src="game\.js"><\/script>/);
      expect(h).toMatch(/__martiBasladi/); expect(h).toMatch(/Tekrar dene/); expect(h).toMatch(/45000/);
      expect(h).toMatch(/\/game\\\.js\//);   // düzenli ifade HTML'de doğru kaçışla
      expect(h.indexOf('__martiBasladi')).toBeLessThan(h.indexOf('<script src="game.js">'));
      // bekçi betiği tarayıcı olmadan da sözdizimsel geçerli
      const bekci = h.match(/<script>([\s\S]*?)<\/script>/)![1];
      expect(() => new Function(bekci)).not.toThrow();
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
  it('main.ts bekçiye başladığını bildirir', () => {
    expect(readFileSync('src/main.ts', 'utf8')).toMatch(/__martiBasladi = true/);
  });
});
