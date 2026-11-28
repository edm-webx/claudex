// SNT-10 / SNT-16: müzik yer eşlemesi, çanta, sessiz mekanlar, kalabalık histerezisi, yeni parçaların döngü dikişi.
import { describe, it, expect } from 'vitest';
import { pickTrack, trackAdaylari, canlilik, canlilikKatman, renderTrack, type MusicDb } from '../../../src/engine/audio/msynth/music';
import { Canta } from '../../../src/content/ses/ambiyans';
import DB from '../../../src/content/ses/ses-db.json';

const music = (DB as unknown as { music: MusicDb }).music;
const PHASES = ['morning', 'noon', 'sunset', 'night'];
const PLACES = ['iskele', 'karsi', 'karsi.meydan', 'karsi.okul', 'karsi.halisaha', 'orman', 'stadyum', 'halisaha', 'ic.kafe', 'ic.bistro', 'ic.mutfak', 'carsi', 'sahil', 'gece', 'metro', 'ev'];

describe('müzik yer eşlemesi', () => {
  it('her yer x evre x hava için tanımlı bir parça', () => {
    for (const pl of PLACES) for (const ph of PHASES) for (const w of ['acik', 'saganak', 'kar', 'sis']) {
      const k = pickTrack(music, ph, w, pl, null);
      expect(music.tracks[k], `${pl}/${ph}/${w} -> ${k}`).toBeTruthy();
    }
  });
  it('iskele gündüz ve gece farklı parçalar; stadyum boşta sakin, maç ayrı', () => {
    const g = trackAdaylari(music, 'noon', 'acik', 'iskele', null), n = trackAdaylari(music, 'night', 'acik', 'iskele', null);
    expect(g.some(k => n.includes(k))).toBe(false);
    const st = pickTrack(music, 'noon', 'acik', 'stadyum', null), mac = trackAdaylari(music, 'noon', 'acik', 'halisaha', null);
    expect(mac).toContain('mac'); expect(mac).not.toContain(st);
    expect(music.tracks[st].bpm).toBeLessThan(music.tracks.mac.bpm);
  });
  it('banka / hastane / morg müziksiz (yağmurda da)', () => {
    for (const pl of ['ic.banka', 'ic.hastane', 'ic.acil', 'ic.morg']) for (const w of ['acik', 'saganak']) expect(pickTrack(music, 'noon', w, pl, null)).toBe('');
  });
  it('kafe ve bistro kendi parçası; karşı yaka alt bölgeleri ana bölgeye düşer', () => {
    expect(pickTrack(music, 'noon', 'acik', 'ic.kafe', null)).toBe('kafe');
    expect(pickTrack(music, 'night', 'acik', 'ic.bistro', null)).toBe('bistro');
    expect(trackAdaylari(music, 'night', 'acik', 'karsi.okul', null)).toEqual(trackAdaylari(music, 'night', 'acik', 'karsi', null));
  });
  it('çanta 200 seçimde ardışık tekrar yok', () => {
    let s = 3; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const l = trackAdaylari(music, 'morning', 'acik', 'iskele', null); expect(l.length).toBeGreaterThan(1);
    const c = new Canta(l.map(v => ({ v, w: 1 })), rnd); let prev = '';
    for (let i = 0; i < 200; i++) { const v = c.next()!; expect(v).not.toBe(prev); prev = v; }
  });
});

describe('SNT-16 kalabalık', () => {
  it('histerezis: eşik çevresinde titremez', () => {
    let s: 0 | 1 = 0, flips = 0;
    for (let i = 0; i < 100; i++) { const n = canlilik(s, 0.5 + 0.08 * Math.sin(i)); if (n !== s) flips++; s = n; }
    expect(flips).toBe(0);
    expect(canlilik(0, 0.7)).toBe(1); expect(canlilik(1, 0.45)).toBe(1); expect(canlilik(1, 0.3)).toBe(0);
  });
  it('katman kazancı ve filtre kalabalığa göre monoton', () => {
    let pl = -1, pg = -1;
    for (let k = 0; k <= 1.0001; k += 0.1) { const c = canlilikKatman(k); expect(c.lpf).toBeGreaterThanOrEqual(pl); expect(c.gain).toBeGreaterThanOrEqual(pg); pl = c.lpf; pg = c.gain; }
  });
});

describe('yeni parçalar', () => {
  it('canlı saz ve maç: tam döngü uzunluğu, dikişsiz, tepe sınırlı', () => {
    for (const id of ['canli_saz', 'mac']) {
      const T = music.tracks[id], b = renderTrack(id, T, 12000);
      expect(Math.abs(b.length - Math.round((T.bars ?? 16) * 4 * 60 / T.bpm * 12000))).toBeLessThanOrEqual(1);
      let mx = 0, pk = 0; for (let i = 1; i < b.length; i++) { mx = Math.max(mx, Math.abs(b[i] - b[i - 1])); pk = Math.max(pk, Math.abs(b[i])); }
      expect(Math.abs(b[b.length - 1] - b[0])).toBeLessThanOrEqual(mx + 1e-6);
      expect(pk).toBeLessThanOrEqual(1);
    }
    expect(music.tracks.canli_saz.pad).toBe(0); expect(music.tracks.canli_saz.perc).toBe('none');
  });
});

describe('MUZ-ic: iç mekan müziği ve oda tonları', () => {
  it('AVM mağazaları kendi parçası; okul ve kırtasiye sessiz; gece iskele havuzunda 3 parça', () => {
    for (const t of ['giyim', 'elektronik', 'oyuncak']) expect(pickTrack(music, 'noon', 'acik', 'ic.' + t, null)).toBe('avm');
    for (const t of ['okul', 'kirtasiye']) expect(pickTrack(music, 'noon', 'acik', 'ic.' + t, null)).toBe('');
    expect(trackAdaylari(music, 'night', 'acik', 'iskele', null)).toEqual(['gece', 'gece2', 'gece3']);
  });
  it('yeni parçalar (avm, gece3) tam döngü, dikişsiz, sonlu ve tepe sınırlı', () => {
    for (const id of ['avm', 'gece3']) {
      const T = music.tracks[id], b = renderTrack(id, T);
      expect(Math.abs(b.length / 24000 - T.bars! * 240 / T.bpm)).toBeLessThan(0.05);
      let mx = 0, pk = 0; for (let i = 1; i < b.length; i++) { mx = Math.max(mx, Math.abs(b[i] - b[i - 1])); pk = Math.max(pk, Math.abs(b[i])); }
      expect(b.some(v => !Number.isFinite(v))).toBe(false);
      expect(pk).toBeLessThanOrEqual(0.62);
      expect(Math.abs(b[b.length - 1] - b[0])).toBeLessThanOrEqual(mx + 1e-6);
      expect(b.length * 4).toBeLessThan(5 * 1024 * 1024);   // tek parça bellek tavanı (12 MB bütçe içinde 2 parça + döngü)
    }
  });
});
