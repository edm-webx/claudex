/**
 * Ekip tahtası (BUF-27): yalnız görünürlük, yeni mekanik yok. Pure okuma: çalışanların anlık durumu (agents.workers.rows) ve
 * darboğaz ipucu cümleleri (restoranApi.view + bulaşık yığını). Panel (ui/calisan-panel.ts) `ekipTahta(rules)` çağırır:
 *   satirlar: her çalışan için { id, ad, rol, rolAd, durum (okunur Türkçe), yer (istasyon / bölge / null) }
 *   ipuclari: önem sırasıyla darboğaz cümleleri (boşsa 'tıkanma yok'); ipucu: ilk cümle ya da null.
 */
import { ROLES } from '../../content/ranks';
import { PASS_KAP, BULASIK, MUTFAK_IST_BY_ID, URUN_ISTASYON, calismaIstasyonuOf } from '../../content/mutfak';
import { DISH_BY_ID } from '../../content/yemek-menu';
import type { RestoranView } from './restoran';

export interface EkipSatir { id: number; ad: string; rol: string; rolAd: string; durum: string; yer: string | null }
export interface EkipTahtasi { satirlar: EkipSatir[]; ipuclari: string[]; ipucu: string | null }
interface Row { id: number; name: string; role: string; state: string; ist?: string }
interface Girdi { rows: Row[]; view: RestoranView | null; bulasik: number; stage: number; bolge?: (wid: number) => string | null }

const DURUM: Record<string, string> = {
  kCook: 'Pişiriyor', kGoCook: 'İstasyona gidiyor', kTasiAl: 'Hazır tabağı alıyor', kPass: 'Pass rafına bırakıyor', kArrive: 'İşe geliyor', kBack: 'Yerine dönüyor', kIdle: 'Boşta, sipariş bekliyor',
  kWash: 'Bulaşık yıkıyor', toPass: 'Pass rafına gidiyor', toSrc: 'Tabak almaya gidiyor', toCounter: 'Tezgâha gidiyor', toMasa: 'Masaya gidiyor', toTable: 'Masaya gidiyor', toGeri: 'Tabağı geri götürüyor',
  serve: 'Servis yapıyor', tabak: 'Tabak taşıyor', carry: 'Tabak taşıyor', menu: 'Menü götürüyor', hesap: 'Hesap alıyor', masaAct: 'Masayla ilgileniyor', sil: 'Masa siliyor', wipe: 'Masa siliyor', toClean: 'Masaya temizliğe gidiyor',
  mop: 'Paspas yapıyor', mopK: 'Mutfağı paspaslıyor', sleep: 'Uyuyor', asleep: 'Uyuyor', watch: 'Dinleniyor', selfie: 'Selfie çekiyor', walk: 'Yürüyor', work: 'Çalışıyor', idle: 'Boşta', pickJob: 'İş arıyor', load: 'Yükleniyor', unload: 'Boşaltıyor', ok: 'Boşta',
};
export const durumAd = (s: string): string => DURUM[s] || 'Çalışıyor';

function istasyonAd(id: string): string { return MUTFAK_IST_BY_ID[id]?.ad.replace(/ \(.*\)$/, '').replace(/, .*$/, '') || id; }

/** Saf çekirdek (testler bunu doğrudan çağırır). */
export function tahtaOf(g: Girdi): EkipTahtasi {
  const satirlar = g.rows.map(r => {
    const yer = r.ist ? istasyonAd(r.ist) : r.role === 'garson' ? (g.bolge?.(r.id) ?? null) : null;
    return { id: r.id, ad: r.name, rol: r.role, rolAd: ROLES[r.role]?.label || r.role, durum: durumAd(r.state), yer: yer && /^b\d/.test(yer) ? 'Bölge ' + yer.slice(1) : yer };
  });
  const ipuclari: string[] = [];
  const v = g.view, uyanik = (rol: string) => g.rows.filter(r => r.role === rol && r.state !== 'sleep' && r.state !== 'asleep').length;
  const garson = uyanik('garson');
  const tabakVar = !!v && (v.pass.length > 0 || v.masalar.some(m => m.durum === 'tabak' || m.durum === 'siparis' || m.durum === 'hesap' || m.durum === 'menu'));
  if (v && v.pass.length >= PASS_KAP) ipuclari.push(garson ? 'Pass dolu, garson ekle' : 'Pass dolu, garson yok: garson ekle');
  else if (v && tabakVar && !garson) ipuclari.push('Garson yok, masalar bekliyor');
  if (g.bulasik >= BULASIK.soft) ipuclari.push(uyanik('bulasikci') ? `Bulaşık yığını ${g.bulasik} tabak, bulaşıkçı yetişemiyor` : `Bulaşık yığını ${g.bulasik} tabak, bulaşıkçı ekle`);
  if (v) {
    const bek: Record<string, number> = {};
    for (const t of v.tickets) {
      const ist = new Set<string>();
      for (const it of t.items) if (it.left > 0) ist.add(calismaIstasyonuOf((it.dish && DISH_BY_ID[it.dish]?.istasyon) || URUN_ISTASYON[it.p] || 'ocak', g.stage));
      for (const i of ist) bek[i] = (bek[i] || 0) + 1;
    }
    const [en, n] = Object.entries(bek).sort((a, b) => b[1] - a[1])[0] || ['', 0];
    if (n >= 3) ipuclari.push(`${istasyonAd(en)} hattında ${n} fiş bekliyor`);
  }
  return { satirlar, ipuclari, ipucu: ipuclari[0] ?? null };
}

/** Rules'tan oku: `ekipTahta(rules)` (rt.agents.workers.rows + rt.restoran.view + rt.dirtyDishes). Sistemler yoksa boş tahta. */
export function ekipTahta(r: { rt: unknown; state: { stage?: number } }): EkipTahtasi {
  const rt = r.rt as { agents?: { workers?: { rows(): Row[] } }; restoran?: { view(): RestoranView; bolgeOf?(wid: number): string | null }; dirtyDishes?: number };
  return tahtaOf({ rows: rt.agents?.workers?.rows() || [], view: rt.restoran?.view() ?? null, bulasik: rt.dirtyDishes || 0, stage: r.state.stage || 1, bolge: rt.restoran?.bolgeOf?.bind(rt.restoran) });
}
