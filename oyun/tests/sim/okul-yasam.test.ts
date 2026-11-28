// Martıköy İlkokulu yaşamı (sim/agents/okul-yasam.ts): okul diyarındayken öğrenciler, öğretmenler, müdür gerçek aktör; ders programına uyar.
import { it, expect } from 'vitest';
import { makeSandbox, type Sandbox } from './agents-harness';
import { OKUL_OX, OKUL_GIRIS_IC, okulProgram, dersOdasi, okulIcinde } from '../../src/content/okul-ic';
import { SINIF_MEVCUT } from '../../src/game/sim/agents/okul-yasam';

const gir = (sb: Sandbox) => { sb.player.x = OKUL_GIRIS_IC.x; sb.player.z = OKUL_GIRIS_IC.z + 2; };
const cik = (sb: Sandbox) => { sb.player.x = -200; sb.player.z = -200; };
const rows = (sb: Sandbox) => sb.h.okulYasam.rows();
const ogrenci = (sb: Sandbox) => rows(sb).filter(r => r.sinif);

it('okul diyarına girince okul dolu, çıkınca boşalır; gece boş', () => {
  const sb = makeSandbox(1); sb.host.hour_ = 9.5;
  cik(sb); sb.step(1); expect(sb.h.okulYasam.count()).toBe(0);
  gir(sb); sb.step(0.5);
  expect(ogrenci(sb).length).toBe(4 * SINIF_MEVCUT);
  expect(rows(sb).some(r => r.ad.startsWith('Müdür Nevzat'))).toBe(true);
  cik(sb); sb.step(0.5); expect(sb.h.okulYasam.count()).toBe(0);
  sb.host.hour_ = 22; gir(sb); sb.step(1); expect(sb.h.okulYasam.count()).toBe(0);
});

it('derste her öğrenci kendi dersliğinde oturur (fen / müzik dönüşü dahil), öğretmen tahtada', () => {
  const sb = makeSandbox(2); sb.host.hour_ = 11.3; gir(sb); sb.step(8);
  const ders = okulProgram(11.3).ders;
  for (const r of ogrenci(sb)) expect(r.oda, r.sinif + ' ' + r.act).toBe(dersOdasi(r.sinif!, ders));
  expect(ogrenci(sb).filter(r => r.act === 'sit' || r.act === 'wave' || r.act === 'serve' || r.act === 'talk').length).toBeGreaterThan(SINIF_MEVCUT * 3);
  const ogretmen = rows(sb).filter(r => r.ad.endsWith('Öğretmen') || r.ad.includes('Öğretmeni'));
  expect(ogretmen.length).toBe(6);
});

it('zil: ders başlarken okulZil olayı; öğle arasında çocuklar bahçeye çıkar ve dönerken yürür', () => {
  const sb = makeSandbox(3); sb.host.hour_ = 11.98; gir(sb); sb.step(1);
  sb.events.length = 0; sb.host.hour_ = 12.05; sb.step(1);
  expect(sb.events.filter(e => e === 'okulZil').length).toBe(1);
  for (let i = 0; i < 25; i++) { sb.host.hour_ += 0.04; sb.step(1); }
  const bahce = ogrenci(sb).filter(r => r.z > 60).length;
  expect(bahce, 'bahçede').toBeGreaterThan(5);
  // hepsi okul alanının içinde (duvar / çit dışına taşan yok)
  for (const r of rows(sb)) expect(okulIcinde(r, 0), r.ad + ' ' + r.x.toFixed(1) + ',' + r.z.toFixed(1)).toBe(true);
});

it('çıkış zilinden sonra öğrenciler kapıdan gider, öğretmenler sonra; ertesi sabah yeniden gelirler', () => {
  const sb = makeSandbox(4); sb.host.hour_ = 14.7; gir(sb); sb.step(1);
  for (let i = 0; i < 60 && ogrenci(sb).length; i++) { sb.host.hour_ += 0.02; sb.step(1); }
  expect(ogrenci(sb).length).toBe(0);
  for (let i = 0; i < 70; i++) { sb.host.hour_ += 0.05; sb.step(1); }
  expect(sb.h.okulYasam.count(), 'akşam ' + sb.host.hour_.toFixed(2) + JSON.stringify(rows(sb).map(r => [r.ad, r.st, r.act, +r.x.toFixed(1), +r.z.toFixed(1)]))).toBe(0);
  sb.host.hour_ = 6; sb.step(1); sb.host.hour_ = 8.6; sb.step(30);
  expect(ogrenci(sb).length).toBe(4 * SINIF_MEVCUT);
  expect(ogrenci(sb).filter(r => r.z < 40.5 && Math.abs(r.x - OKUL_OX) < 6).length, 'törende meydanda').toBeGreaterThan(SINIF_MEVCUT * 3);
});
