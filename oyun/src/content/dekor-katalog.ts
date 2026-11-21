/**
 * Dekor 2.0 catalogue + Sabri'nin Evi data (survey dekor-1..14, ev-1..9). Pure data, no three/DOM.
 * - DECOR_EXTRA: ~104 new decor items merged into economy.DECOR (total ~120). Each item names a code-made model `shape`
 *   (built in prefabs/iskele/decor-extra.ts) and up to 3 colours. Flags: light, photo spot, gold (Altın Simit vitrini),
 *   workshop (Usta Atölyesi, built from parça), gift (only from set-lover regulars).
 * - THEME_SETS: set bonus + the set-lover regular ("set sever müdavim") with lines.
 * - PAINT: 3 layers (malzeme + renk + desen), applied per placed slot.
 * - SIGN_EXTRA: slogans, emblems, frame styles, text/background colours.
 * - SEASONS: calendar-driven decoration layer (view draws it, toggle in the panel).
 * - HOME: Sabri's attic home, 5 areas, furniture with comfort ("dinlenme") points; capped morning speed bonus.
 * All names invented. Player text casual Turkish, no em-dashes.
 */
import type { DecorDef2 } from './economy';

export type DekorCat = 'isik' | 'zemin' | 'duvar' | 'biblo' | 'su' | 'masa' | 'bitki' | 'tema';
export interface DecorX extends DecorDef2 {
  cat: DekorCat; shape: string; cols: [string, string, string];
  light?: boolean; photo?: boolean; gold?: number; workshop?: number; gift?: boolean; line?: string;
}

export const DEKOR_CATS: { id: DekorCat | 'hepsi'; name: string }[] = [
  { id: 'hepsi', name: 'Hepsi' }, { id: 'isik', name: 'Işık ve fener' }, { id: 'zemin', name: 'Yer döşemesi' }, { id: 'duvar', name: 'Duvar süsü' },
  { id: 'biblo', name: 'Biblolar' }, { id: 'su', name: 'Su ve akvaryum' }, { id: 'masa', name: 'Masa ve tabure' }, { id: 'bitki', name: 'Bitkiler' }, { id: 'tema', name: 'Tema eşyası' },
];

/** Category of the 16 original items (they keep their v2 models). */
export const BASE_CAT: Record<string, DekorCat> = {
  nostalji_radyo: 'biblo', nostalji_gazetelik: 'tema', nostalji_afis: 'duvar', nostalji_sandalye: 'masa', denizci_can_simidi: 'duvar', denizci_halat: 'tema',
  denizci_fener: 'isik', denizci_martiheykel: 'biblo', lale_cini_pano: 'duvar', lale_saksi: 'bitki', lale_semaver: 'tema', lale_minder: 'masa',
  saksi_sardunya: 'bitki', kedi_evi: 'tema', sokak_lambasi: 'isik', tavla_masasi: 'masa',
};
export const PHOTO_BASE = ['denizci_martiheykel', 'denizci_fener', 'lale_cini_pano'];
export const LIGHT_BASE = ['denizci_fener', 'sokak_lambasi'];

type Row = [string, string, string, DekorCat, string, number, number, number, 's' | 'm' | 'l', string, string, string, string?, string?];
// id, name, set, cat, shape, price, keyif, points, size, c1, c2, c3, flags (L light, F photo, G gold, U workshop, H gift, C cats), favourite line
const R: Row[] = [
  // ── Işık zinciri ve fenerler ──
  ['isik_zincir_sari', 'Sarı ampul zinciri', 'genel', 'isik', 'zincir', 1400, 2, 2, 'm', '#ffd23f', '#5a4632', '#ffffff', 'L', 'Akşam olunca bu ampuller tek tek yanıyor, bayıldım!'],
  ['isik_zincir_renkli', 'Rengarenk düğün ampulleri', 'lunapark', 'isik', 'zincir', 1900, 2, 3, 'm', '#ff5fa2', '#3c4146', '#49e6d8', 'L'],
  ['isik_fener_bakir', 'Bakır sokak feneri', 'nostalji', 'isik', 'fener', 2200, 2, 3, 'm', '#b8733d', '#3c4146', '#ffe6a0', 'L'],
  ['isik_fener_gemi', 'Gemi borda feneri', 'denizci', 'isik', 'fener', 2400, 2, 3, 'm', '#e0533c', '#2b3a55', '#fff0c8', 'LF'],
  ['isik_kagit_fener', 'Kağıt fener üçlüsü', 'tropik', 'isik', 'kagit', 1300, 2, 2, 's', '#f08a3c', '#ffd23f', '#e0533c', 'L'],
  ['isik_gaz_lambasi', 'Dedemin gaz lambası', 'barinak', 'isik', 'gaz', 900, 1, 2, 's', '#3fb5b0', '#7d5638', '#ffe6a0', 'L', 'Gaz lambası mı o? Babam da böyle yakardı.'],
  ['isik_mum_masa', 'Masa mumu ve kavanoz', 'genel', 'isik', 'mum', 600, 1, 1, 's', '#fbfaf6', '#bfe6e9', '#ffd23f', 'L'],
  ['isik_lale_fener', 'Lale desenli fener', 'lale', 'isik', 'fener', 2600, 3, 3, 'm', '#3fb5b0', '#f2b632', '#ffe6a0', 'L'],
  ['isik_neon_marti', 'Neon martı tabelası', 'lunapark', 'isik', 'neon', 3400, 3, 4, 'm', '#ff5fa2', '#20232a', '#49e6d8', 'LF', 'Neon martı bana göz kırptı, yemin ederim.'],
  ['isik_ay_lambasi', 'Dolunay lambası', 'ayussu', 'isik', 'kure', 2800, 2, 3, 's', '#f6ead2', '#8c969e', '#fff6d8', 'L'],
  ['isik_plak_lamba', 'Plak abajur', 'plak', 'isik', 'abajur', 1700, 2, 2, 's', '#20232a', '#e0533c', '#ffe6a0', 'L'],
  ['isik_sera_fener', 'Yapraklı bahçe feneri', 'sera', 'isik', 'fener', 2000, 2, 3, 'm', '#5d8f45', '#2f3a2a', '#e8ffd0', 'L'],
  ['isik_bal_fener', 'Ağ sarılı balıkçı feneri', 'barinak', 'isik', 'fener', 2100, 2, 3, 'm', '#d8c39a', '#33373b', '#ffe6a0', 'L'],
  // ── Yer döşemesi ──
  ['zemin_kilim_kirmizi', 'Kırmızı göbekli kilim', 'lale', 'zemin', 'kilim', 1500, 2, 2, 'm', '#c23e2c', '#f2b632', '#2f6fb0'],
  ['zemin_kilim_mavi', 'Mavi yolluk kilim', 'denizci', 'zemin', 'kilim', 1300, 1, 2, 'm', '#2f6fb0', '#fbfaf6', '#e0533c'],
  ['zemin_karo_siyahbeyaz', 'Siyah beyaz karo', 'plak', 'zemin', 'karo', 1600, 1, 3, 'm', '#20232a', '#f4f1ea', '#20232a'],
  ['zemin_karo_cini', 'Çini karo parçası', 'lale', 'zemin', 'karo', 2200, 2, 3, 'm', '#3fb5b0', '#f4f8fb', '#2f6fb0'],
  ['zemin_karo_hidrolik', 'Hidrolik karo', 'nostalji', 'zemin', 'karo', 1900, 2, 3, 'm', '#c98a52', '#f6ead2', '#6b4a2e'],
  ['zemin_tahta_boyali', 'Boyalı tahta döşeme', 'barinak', 'zemin', 'tahta', 1100, 1, 2, 'm', '#3fb5b0', '#c9955c', '#fbfaf6'],
  ['zemin_tahta_iskele', 'Eski iskele tahtası', 'denizci', 'zemin', 'tahta', 900, 1, 2, 'm', '#9c6c46', '#7d5638', '#d8c39a'],
  ['zemin_hasir', 'Hasır paspas', 'tropik', 'zemin', 'kilim', 800, 1, 1, 's', '#e8c27a', '#c9955c', '#5d8f45'],
  ['zemin_krater', 'Krater desenli halı', 'ayussu', 'zemin', 'kilim', 1700, 1, 2, 'm', '#8c969e', '#5d6670', '#bfc6cc'],
  ['zemin_yosun', 'Yosunlu taş döşeme', 'sera', 'zemin', 'karo', 1400, 2, 2, 'm', '#6f9e4f', '#a7a69c', '#5d8f45'],
  ['zemin_lunapark', 'Damalı lunapark zemini', 'lunapark', 'zemin', 'karo', 1500, 1, 2, 'm', '#e0533c', '#ffd23f', '#e0533c'],
  // ── Duvar süsü ──
  ['duvar_cerceve_aile', 'Aile fotoğrafı çerçevesi', 'nostalji', 'duvar', 'cerceve', 900, 1, 2, 's', '#7d5638', '#f6ead2', '#9c6c46', '', 'Bu fotoğraftaki bıyık kimin? Efsane.'],
  ['duvar_afis_vapur', 'Eski vapur afişi', 'denizci', 'duvar', 'afis', 1200, 1, 2, 's', '#1d3d6b', '#f6ead2', '#e0533c', 'F'],
  ['duvar_afis_film', 'Yeşilçam film afişi: Martı Kalbim', 'nostalji', 'duvar', 'afis', 1400, 2, 3, 's', '#c23e2c', '#f6ead2', '#3a2a20', 'F', 'Martı Kalbim! Bu filmde ağlamayan yoktu.'],
  ['duvar_takvim', 'Yapraklı duvar takvimi', 'nostalji', 'duvar', 'takvim', 600, 1, 1, 's', '#fbfaf6', '#e0533c', '#3a2a20'],
  ['duvar_takvim_balik', 'Balıkçı takvimi: Hamsi Ayları', 'barinak', 'duvar', 'takvim', 700, 1, 1, 's', '#bfe6e9', '#2f6fb0', '#3a2a20'],
  ['duvar_plak_pano', 'Altın plak panosu', 'plak', 'duvar', 'cerceve', 2600, 2, 3, 's', '#20232a', '#f2b632', '#3c4146', 'F'],
  ['duvar_lale_tabak', 'Lale desenli duvar tabağı', 'lale', 'duvar', 'tabak', 1100, 1, 2, 's', '#f4f8fb', '#2f6fb0', '#e0533c'],
  ['duvar_dumen', 'Duvar dümeni', 'denizci', 'duvar', 'dumen', 1800, 2, 3, 's', '#8a5d3b', '#d8c39a', '#7d5638', 'F'],
  ['duvar_tropik_maske', 'Gülümseyen tiki maskesi', 'tropik', 'duvar', 'maske', 1500, 2, 2, 's', '#c98a52', '#5d8f45', '#e0533c'],
  ['duvar_ay_haritasi', 'Ay haritası posteri', 'ayussu', 'duvar', 'afis', 1300, 1, 2, 's', '#20232a', '#bfc6cc', '#49e6d8'],
  ['duvar_herbaryum', 'Kurutulmuş yaprak çerçevesi', 'sera', 'duvar', 'cerceve', 1000, 1, 2, 's', '#f6ead2', '#5d8f45', '#7d5638'],
  ['duvar_lunapark_bilet', 'Dev lunapark bileti', 'lunapark', 'duvar', 'afis', 1100, 1, 2, 's', '#ffd23f', '#e0533c', '#20232a'],
  // ── Heykelcik ve biblolar ──
  ['biblo_kedi_porselen', 'Porselen kedi biblosu', 'nostalji', 'biblo', 'biblo', 800, 1, 2, 's', '#fbfaf6', '#f2a2b3', '#3a2a20', 'C', 'Porselen kedi bana baktı, gerçek kedi kıskandı.'],
  ['biblo_marti_ahsap', 'Ahşap martı oyması', 'denizci', 'biblo', 'biblo', 900, 1, 2, 's', '#c9955c', '#fbfaf6', '#33373b'],
  ['biblo_balik_cam', 'Cam balık biblosu', 'barinak', 'biblo', 'biblo', 1000, 1, 2, 's', '#3fb5b0', '#bfe6e9', '#2f6fb0'],
  ['biblo_lale_vazo', 'Çini lale vazosu', 'lale', 'biblo', 'vazo', 1300, 2, 2, 's', '#2f6fb0', '#f4f8fb', '#e0533c'],
  ['biblo_gramofon', 'Kollu gramofon', 'plak', 'biblo', 'gramofon', 3200, 3, 4, 'm', '#b8733d', '#20232a', '#f2b632', 'F', 'Gramofon çalışıyor mu? Bir Zeki Plakçı şarkısı koy!'],
  ['biblo_astronot', 'Martı astronot heykeli', 'ayussu', 'biblo', 'astronot', 3800, 3, 4, 'm', '#fbfaf6', '#8c969e', '#49e6d8', 'F', 'Martı astronot! Ay\'a ilk simit atan martı bu mu?'],
  ['biblo_flamingo', 'Plastik flamingo', 'tropik', 'biblo', 'flamingo', 1100, 2, 2, 's', '#f2a2b3', '#e0533c', '#33373b', 'F'],
  ['biblo_kaktus_bebek', 'Şapkalı kaktüs biblosu', 'sera', 'biblo', 'kaktus', 700, 1, 1, 's', '#5d8f45', '#c98a52', '#e0533c'],
  ['biblo_atli', 'Atlıkarınca atı', 'lunapark', 'biblo', 'atli', 3600, 3, 4, 'm', '#fbfaf6', '#f2b632', '#e0533c', 'F', 'Atlıkarınca atına binebilir miyim? Bir dakikacık?'],
  ['biblo_raf_karisik', 'Biblo rafı', 'genel', 'biblo', 'raf', 1600, 2, 3, 'm', '#9c6c46', '#fbfaf6', '#3fb5b0'],
  ['biblo_semaver_minik', 'Minik bakır semaver', 'lale', 'biblo', 'vazo', 1500, 2, 2, 's', '#b8733d', '#9a5426', '#f2b632'],
  ['biblo_kupa_simit', 'Altın Simit kupası', 'genel', 'biblo', 'kupa', 0, 3, 4, 's', '#f2b632', '#b8862e', '#fbfaf6', 'GF', 'Bu kupa gerçek altın mı? Değil mi? Yine de parlıyor!'],
  ['biblo_radyo_transistor', 'Transistörlü cep radyosu', 'plak', 'biblo', 'radyo', 1200, 1, 2, 's', '#e0533c', '#fbfaf6', '#20232a'],
  // ── Akvaryum ve fanus ──
  ['su_akvaryum_kucuk', 'Minik akvaryum', 'barinak', 'su', 'akvaryum', 2400, 3, 3, 's', '#bfe6e9', '#2f6fb0', '#f08a3c', 'F', 'Akvaryumdaki balığın adı ne? Bence Hamsi Bey.'],
  ['su_akvaryum_buyuk', 'Kocaman akvaryum', 'barinak', 'su', 'akvaryum', 5200, 4, 5, 'm', '#bfe6e9', '#1d3d6b', '#ffd23f', 'F'],
  ['su_fanus', 'Japon balıklı fanus', 'nostalji', 'su', 'fanus', 1200, 2, 2, 's', '#d8f2f4', '#f08a3c', '#9c6c46'],
  ['su_ay_fanus', 'Ay tozu fanusu', 'ayussu', 'su', 'fanus', 1900, 2, 3, 's', '#d8e0ff', '#bfc6cc', '#49e6d8'],
  ['su_tropik_akvaryum', 'Mercanlı akvaryum', 'tropik', 'su', 'akvaryum', 3600, 3, 4, 'm', '#bfe6e9', '#f2a2b3', '#f08a3c', 'F'],
  // ── Minik çeşme, havuz ──
  ['su_cesme_mermer', 'Minik mermer çeşme', 'lale', 'su', 'cesme', 4200, 3, 4, 'm', '#f2efe8', '#3fb5b0', '#bfe6e9', 'F', 'Çeşmenin şırıltısı insanın içini serinletiyor.'],
  ['su_cesme_tas', 'Taş kurna', 'nostalji', 'su', 'cesme', 3000, 2, 3, 'm', '#a7a69c', '#7d7a70', '#bfe6e9'],
  ['su_havuz_nilufer', 'Nilüferli minik havuz', 'sera', 'su', 'havuz', 3800, 3, 4, 'l', '#5d8f45', '#bfe6e9', '#f2a2b3', 'F'],
  ['su_havuz_ordek', 'Lastik ördekli leğen havuz', 'lunapark', 'su', 'havuz', 1500, 2, 2, 'm', '#2f6fb0', '#bfe6e9', '#ffd23f'],
  ['su_cesme_istiridye', 'İstiridye çeşmesi', 'tropik', 'su', 'cesme', 3400, 3, 3, 'm', '#f2a2b3', '#fbfaf6', '#bfe6e9'],
  // ── Masa ve tabure çeşitleri ──
  ['masa_hasir_cay', 'Hasır sandalyeli çay masası', 'nostalji', 'masa', 'caymasa', 2400, 3, 3, 'l', '#9c6c46', '#e8c27a', '#c23e2c', '', 'Hasır sandalyede çay içmek başka ya!'],
  ['masa_kolaz_kasa', 'Kolaz kasasından tabure takımı', 'genel', 'masa', 'kasatabure', 1200, 2, 2, 'm', '#e0533c', '#fbfaf6', '#c9955c', '', 'Kolaz kasasında oturmak beni çocukluğuma götürdü.'],
  ['masa_can_simidi', 'Can simidi masa', 'denizci', 'masa', 'simidmasa', 2600, 3, 3, 'l', '#e0533c', '#fbfaf6', '#8a5d3b', 'F'],
  ['masa_halat_makarasi', 'Halat makarası masa', 'barinak', 'masa', 'makaramasa', 2200, 3, 3, 'l', '#9c6c46', '#d8c39a', '#7d5638'],
  ['masa_cini_sehpa', 'Çini sehpa ve minder', 'lale', 'masa', 'caymasa', 3200, 3, 3, 'l', '#3fb5b0', '#c23e2c', '#f2b632'],
  ['masa_plak_bar', 'Plak dolabı bar masası', 'plak', 'masa', 'plak', 3000, 3, 3, 'm', '#20232a', '#e0533c', '#f2b632'],
  ['masa_bambu', 'Bambu masa ve şezlong', 'tropik', 'masa', 'sezlong', 2800, 3, 3, 'l', '#e8c27a', '#3fb5b0', '#f08a3c'],
  ['masa_uzay_kapsul', 'Uzay kapsülü masa', 'ayussu', 'masa', 'kapsul', 4000, 3, 4, 'l', '#fbfaf6', '#8c969e', '#49e6d8', 'F'],
  ['masa_lunapark_fincan', 'Dönen fincan masası', 'lunapark', 'masa', 'fincan', 3400, 3, 4, 'l', '#f2a2b3', '#fbfaf6', '#ffd23f', 'F'],
  ['masa_sera_bank', 'Saksılı bahçe bankı', 'sera', 'masa', 'bank', 2000, 2, 3, 'l', '#5d8f45', '#9c6c46', '#e0533c'],
  ['masa_katlanir', 'Katlanır tahta tabure', 'genel', 'masa', 'kasatabure', 500, 1, 1, 's', '#c9955c', '#9c6c46', '#c9955c'],
  // ── Bitkiler ──
  ['bitki_palmiye', 'Saksıda minik palmiye', 'tropik', 'bitki', 'palmiye', 1800, 2, 3, 'm', '#5d8f45', '#c98a52', '#8a5d3b'],
  ['bitki_muz', 'Muz yapraklı bitki', 'tropik', 'bitki', 'saksi', 1400, 2, 2, 's', '#6aa84f', '#f08a3c', '#3fb5b0'],
  ['bitki_kaktus', 'Dikenli ama tatlı kaktüs', 'sera', 'bitki', 'kaktus', 600, 1, 1, 's', '#5d8f45', '#c98a52', '#ffd23f'],
  ['bitki_sarmasik', 'Sarmaşıklı kafes', 'sera', 'bitki', 'sarmasik', 1700, 2, 3, 'm', '#5d8f45', '#9c6c46', '#f2a2b3'],
  ['bitki_feslegen', 'Fesleğen saksısı', 'genel', 'bitki', 'saksi', 500, 1, 1, 's', '#6aa84f', '#c98a52', '#5d8f45', '', 'Fesleğen kokusu mu bu? Annemin balkonu gibi.'],
  ['bitki_begonvil', 'Begonvil saksısı', 'genel', 'bitki', 'saksi', 1200, 2, 2, 's', '#d8418a', '#c98a52', '#5d8f45'],
  ['bitki_lale_tarhi', 'Lale tarhı', 'lale', 'bitki', 'tarh', 2000, 2, 3, 'm', '#e0533c', '#7d5638', '#ffd23f', 'F'],
  ['bitki_ay_cicegi', 'Parlayan ay çiçeği', 'ayussu', 'bitki', 'saksi', 1600, 2, 2, 's', '#49e6d8', '#8c969e', '#d8e0ff', 'L'],
  ['bitki_bonsai', 'Sabırlı bonsai', 'sera', 'bitki', 'bonsai', 2600, 2, 3, 's', '#5d8f45', '#3c4146', '#7d5638'],
  ['bitki_yosun_top', 'Asılı yosun topları', 'sera', 'bitki', 'kagit', 1100, 1, 2, 's', '#6f9e4f', '#5d8f45', '#3a2a20'],
  // ── Tema eşyaları ──
  ['tema_pikap', 'Pikap ve plak yığını', 'plak', 'tema', 'plak', 2800, 3, 3, 'm', '#20232a', '#e0533c', '#f2b632', 'F', 'O pikapta 45\'lik var mı? Var mı?!'],
  ['tema_jukebox', 'Martıbox müzik dolabı', 'plak', 'tema', 'jukebox', 5600, 4, 5, 'm', '#e0533c', '#f2b632', '#49e6d8', 'LF', 'Martıbox! Bir jeton atsam çalar mı?'],
  ['tema_oyun_makinesi', 'Arcade oyun makinesi', 'lunapark', 'tema', 'oyun', 4200, 4, 5, 'm', '#3c4146', '#e0533c', '#49e6d8', 'LF', 'Bir jeton daha! Tek bir tur, sonra gidiyorum, söz.'],
  ['tema_kus_kafesi', 'Kuş kafesi', 'nostalji', 'tema', 'kafes', 2600, 3, 3, 'm', '#c9b59a', '#f2b632', '#e0533c', '', 'Cik cik, ötüyor işte.'],
  ['tema_kitaplik', 'Eski kitaplık', 'nostalji', 'tema', 'kitaplik', 2400, 2, 3, 'm', '#9c6c46', '#e0533c', '#3fb5b0', '', 'Her rafta bir roman, hepsi okunmuş gibi duruyor.'],
  ['tema_vapur_maketi', 'Vapur maketi', 'denizci', 'tema', 'vapur', 3400, 3, 4, 'm', '#33526e', '#fbfaf6', '#e0533c', 'F', 'Kadıköy\'den Eminönü\'ye, cebimde.'],
  ['tema_kaset_kule', 'Kaset kulesi', 'plak', 'tema', 'raf', 1500, 1, 2, 's', '#3c4146', '#f2b632', '#e0533c'],
  ['tema_semsiye_tropik', 'Saçaklı plaj şemsiyesi', 'tropik', 'tema', 'semsiye', 2200, 2, 3, 'l', '#f08a3c', '#fbfaf6', '#e8c27a'],
  ['tema_roket', 'Karton roket', 'ayussu', 'tema', 'roket', 4600, 4, 5, 'm', '#fbfaf6', '#e0533c', '#8c969e', 'F', 'Roket kalkarken simidimi bitirebilir miyim?'],
  ['tema_uydu', 'Çanak uydu', 'ayussu', 'tema', 'uydu', 2200, 2, 3, 'm', '#bfc6cc', '#3c4146', '#49e6d8'],
  ['tema_balik_agi', 'Mantar şamandıralı ağ', 'barinak', 'tema', 'ag', 1600, 2, 2, 'm', '#d8c39a', '#e0533c', '#7d5638'],
  ['tema_sandal', 'Minik ahşap sandal', 'barinak', 'tema', 'sandal', 4200, 3, 4, 'l', '#3fb5b0', '#fbfaf6', '#9c6c46', 'F', 'Bu sandalla Kınalı Martı Adası\'na gidilir mi?'],
  ['tema_olta_seti', 'Olta ve kova takımı', 'barinak', 'tema', 'olta', 1000, 1, 2, 's', '#2f6fb0', '#7d5638', '#e0533c'],
  ['tema_atlikarinca', 'Mini atlıkarınca', 'lunapark', 'tema', 'karinca', 6000, 4, 5, 'l', '#e0533c', '#fbfaf6', '#f2b632', 'LF', 'Mini atlıkarınca dönüyor! Bütün iskele bakıyor!'],
  ['tema_pamuk_seker', 'Pamuk şeker arabası', 'lunapark', 'tema', 'araba', 2600, 3, 3, 'm', '#f2a2b3', '#fbfaf6', '#49e6d8'],
  ['tema_sera_kulube', 'Cam sera kulübesi', 'sera', 'tema', 'sera', 5000, 3, 5, 'l', '#bfe6e9', '#5d8f45', '#fbfaf6', 'F'],
  ['tema_bavul_yigini', 'Eski bavul yığını', 'nostalji', 'tema', 'sandik', 1400, 1, 2, 's', '#9c6c46', '#c23e2c', '#d8c39a'],
  ['tema_sandik_hazine', 'Korsan martı sandığı', 'denizci', 'tema', 'sandik', 1700, 2, 2, 's', '#7d5638', '#f2b632', '#3a2a20'],
  ['tema_bayrak_dizisi', 'Flama dizisi', 'denizci', 'tema', 'bayrak', 900, 1, 2, 'm', '#e0533c', '#fbfaf6', '#2f6fb0'],
  ['tema_lale_kafes', 'Kafesli lale köşkü', 'lale', 'tema', 'sera', 4800, 3, 4, 'l', '#f2efe8', '#e0533c', '#3fb5b0', 'F'],
  // ── Usta Atölyesi (parça ile yapılır) ──
  ['atolye_marti_robot', 'Teneke martı robot', 'ayussu', 'biblo', 'astronot', 0, 3, 4, 's', '#bfc6cc', '#e0533c', '#49e6d8', 'UF', 'Bu robotu sen mi yaptın? Usta adamsın abi!'],
  ['atolye_simit_saat', 'Simit duvar saati', 'genel', 'duvar', 'tabak', 0, 2, 3, 's', '#d8a25a', '#3a2a20', '#fbfaf6', 'U'],
  ['atolye_cay_kulesi', 'Çay bardağı kulesi', 'nostalji', 'biblo', 'kule', 0, 3, 4, 's', '#c23e2c', '#f0e8e0', '#b8862e', 'UF'],
  ['atolye_sise_gemi', 'Şişede vapur', 'denizci', 'biblo', 'sise', 0, 3, 4, 's', '#bfe6e9', '#fbfaf6', '#9c6c46', 'U'],
  // ── Müdavim hediyeleri (sadece set sever müdavimden) ──
  ['hediye_plak_imzali', 'İmzalı Zeki Plakçı plağı', 'plak', 'duvar', 'cerceve', 0, 3, 4, 's', '#20232a', '#f2b632', '#e0533c', 'HF'],
  ['hediye_deniz_kabugu', 'Kocaman deniz kabuğu', 'tropik', 'biblo', 'kabuk', 0, 2, 3, 's', '#f2a2b3', '#fbfaf6', '#f08a3c', 'H'],
  ['hediye_ay_tasi', 'Ay taşı (bence kaldırım taşı)', 'ayussu', 'biblo', 'tas', 0, 2, 3, 's', '#8c969e', '#5d6670', '#49e6d8', 'H'],
  ['hediye_altin_olta', 'Altın olta makarası', 'barinak', 'biblo', 'kupa', 0, 3, 3, 's', '#f2b632', '#3c4146', '#fbfaf6', 'H'],
  ['hediye_lunapark_kupa', 'Halka atma şampiyonluk kupası', 'lunapark', 'biblo', 'kupa', 0, 3, 3, 's', '#f2b632', '#e0533c', '#fbfaf6', 'H'],
  ['hediye_sera_tohum', 'Nadir orkide', 'sera', 'bitki', 'saksi', 0, 3, 3, 's', '#b07ad8', '#fbfaf6', '#5d8f45', 'H'],
];

const familyOf: Record<string, string> = { nostalji: 'sepya', denizci: 'deniz', lale: 'cini', plak: 'plak', tropik: 'tropik', ayussu: 'uzay', barinak: 'deniz', lunapark: 'neon', sera: 'yesil', genel: 'yesil' };
const GOLD_PRICE: Record<string, number> = { biblo_kupa_simit: 25 };
const WORKSHOP: Record<string, number> = { atolye_marti_robot: 8, atolye_simit_saat: 5, atolye_cay_kulesi: 6, atolye_sise_gemi: 7 };

export const DECOR_EXTRA: DecorX[] = R.map(([id, name, set, cat, shape, price, keyif, points, size, c1, c2, c3, flags = '', line]) => ({
  id, name, set, cat, shape, price: /[GUH]/.test(flags) ? 999999 : price, keyif, points, size, color: familyOf[set] || 'yesil', cols: [c1, c2, c3] as [string, string, string],
  light: flags.includes('L') || undefined, photo: flags.includes('F') || undefined, cats: flags.includes('C') || undefined,
  gold: flags.includes('G') ? GOLD_PRICE[id] || 20 : undefined, workshop: flags.includes('U') ? WORKSHOP[id] || 6 : undefined,
  gift: flags.includes('H') || undefined, line,
}));
export const EXTRA_SIZE: Record<string, string> = Object.fromEntries(DECOR_EXTRA.map(d => [d.id, d.size]));
export const extraById = (id: string): DecorX | undefined => DECOR_EXTRA.find(d => d.id === id);

export const DECOR_SETS_EXTRA: Record<string, string> = {
  plak: 'Retro Plak Köşesi', tropik: 'Tropik Martıköy', ayussu: 'Ay Üssü', barinak: 'Balıkçı Barınağı', lunapark: 'Lunapark Gecesi', sera: 'Botanik Sera',
};

/** Theme sets: 4 placed items of the set = set tamam (bonus + set lover). */
export interface ThemeSet { id: string; name: string; need: number; bonusTip: number; lover: { name: string; job: string; lines: string[]; gift: string } }
export const SET_NEED = 4;
export const THEME_SETS: ThemeSet[] = [
  { id: 'nostalji', name: 'Nostalji / Yeşilçam', need: SET_NEED, bonusTip: 0.03, lover: { name: 'Emekli Suflör Nebahat Hanım', job: 'Yeşilçam hayranı', gift: 'atolye_cay_kulesi',
    lines: ['Ahh bu köşe tam 1967! Kalbim pır pır.', 'Bu radyoda eskiden arkasından sufle verirdim, şaka şaka.', 'Bir çay ver evladım, filmin en güzel sahnesi burası.'] } },
  { id: 'denizci', name: 'Martı / Denizci', need: SET_NEED, bonusTip: 0.03, lover: { name: 'Kaptan Rıfat Dümenci', job: 'emekli vapur kaptanı', gift: 'atolye_sise_gemi',
    lines: ['Pruva iskeleye! Bu büfe tam bir liman.', 'Kırk yıl vapur sürdüm, böyle can simidi görmedim.', 'Martılar bile selam duruyor, aferin sana.'] } },
  { id: 'lale', name: 'Lale Devri', need: SET_NEED, bonusTip: 0.03, lover: { name: 'Hattat Lütfiye Abla', job: 'çini ustası', gift: 'biblo_lale_vazo',
    lines: ['Şu çinilerin mavisi var ya, içime işledi.', 'Lale lale lale! Bahar sende başlamış.', 'Semaver kokusu, lale deseni... Bugün buradayım.'] } },
  { id: 'plak', name: 'Retro Plak Köşesi', need: SET_NEED, bonusTip: 0.04, lover: { name: 'Plakçı Zeki Abi', job: 'plak koleksiyoncusu', gift: 'hediye_plak_imzali',
    lines: ['Bu pikap orijinal mi? Ağlayacağım.', '45\'lik dinlerken ayran içmek, hayatın anlamı.', 'Martıbox\'a bir şarkı daha koy usta!'] } },
  { id: 'tropik', name: 'Tropik Martıköy', need: SET_NEED, bonusTip: 0.04, lover: { name: 'Sörfçü Tanju', job: 'rüzgar sörfçüsü', gift: 'hediye_deniz_kabugu',
    lines: ['Aloha Martıköy! Flamingo bana el salladı.', 'Bu şemsiyenin altında lodos bile tatlı esiyor.', 'Bir buzlu gazoz, bir palmiye, tamamdır.'] } },
  { id: 'ayussu', name: 'Ay Üssü', need: SET_NEED, bonusTip: 0.05, lover: { name: 'Astronom Doç. Yıldız Kuyruk', job: 'gökbilimci', gift: 'hediye_ay_tasi',
    lines: ['Roket hazır mı? Ben simidimi aldım.', 'Ay\'dan bakınca bu büfe parlıyor, ölçtüm.', 'Martı astronotun kaskı bana uyar mı?'] } },
  { id: 'barinak', name: 'Balıkçı Barınağı', need: SET_NEED, bonusTip: 0.04, lover: { name: 'Balıkçı Hamsi Necmi', job: 'gırgır reisi', gift: 'hediye_altin_olta',
    lines: ['Ağın kokusu, sandalın rengi... Evime geldim.', 'Bugün rastgele! Sana bir çay ısmarlıyorum.', 'Bu akvaryumdaki balık benden kaçtı, eminim.'] } },
  { id: 'lunapark', name: 'Lunapark Gecesi', need: SET_NEED, bonusTip: 0.04, lover: { name: 'Halka Atma Şampiyonu Cemile', job: 'lunapark ustası', gift: 'hediye_lunapark_kupa',
    lines: ['Işıklar, atlar, pamuk şeker! Burası benim yerim.', 'Halka atsam şu tabureye geçer mi? Geçer.', 'Bu neon martı geceyi kurtardı.'] } },
  { id: 'sera', name: 'Botanik Sera', need: SET_NEED, bonusTip: 0.04, lover: { name: 'Botanikçi Fesleğen Hoca', job: 'bitki doktoru', gift: 'hediye_sera_tohum',
    lines: ['Bu bonsaiye sabırla bakmışsın, belli.', 'Yapraklar sağlıklı, büfe sağlıklı, ben mutluyum.', 'Nilüferler açmış! Şiir yazacağım.'] } },
];

/** Paint: 3 layers. Material = base tint, colour = main hue, pattern = vertex modulation. */
export const PAINT_MATERIALS: { id: string; name: string; tint: string; k: number }[] = [
  { id: 'dogal', name: 'Doğal', tint: '#ffffff', k: 0 }, { id: 'ahsap', name: 'Ahşap', tint: '#c9955c', k: 0.35 }, { id: 'metal', name: 'Metal', tint: '#aab4bc', k: 0.4 },
  { id: 'hasir', name: 'Hasır', tint: '#e8c27a', k: 0.35 }, { id: 'seramik', name: 'Seramik', tint: '#f4f8fb', k: 0.3 }, { id: 'altin', name: 'Yaldız', tint: '#f2b632', k: 0.45 },
];
export const PAINT_COLORS: { id: string; name: string; hex: string }[] = [
  { id: 'yok', name: 'Kendi rengi', hex: '' }, { id: 'kirmizi', name: 'Simit kırmızısı', hex: '#e0533c' }, { id: 'sari', name: 'Limon sarısı', hex: '#ffd23f' },
  { id: 'turkuaz', name: 'Boğaz turkuazı', hex: '#3fb5b0' }, { id: 'lacivert', name: 'Vapur laciverti', hex: '#2b3a55' }, { id: 'pembe', name: 'Pamuk şeker', hex: '#f2a2b3' },
  { id: 'yesil', name: 'Fesleğen yeşili', hex: '#5d8f45' }, { id: 'krem', name: 'Ayran kremi', hex: '#f6ead2' }, { id: 'mor', name: 'Lavanta', hex: '#8a6bbf' },
];
export const PAINT_PATTERNS: { id: string; name: string }[] = [
  { id: 'duz', name: 'Düz' }, { id: 'cizgili', name: 'Çizgili' }, { id: 'puantiye', name: 'Puantiyeli' }, { id: 'damali', name: 'Damalı' }, { id: 'dalga', name: 'Dalgalı' },
];
/** Şekil (shape): the same item in three proportions. k = x, y, z scale applied to its built geometry. */
export const PAINT_SHAPES: { id: string; name: string; k: [number, number, number] }[] = [
  { id: 'orijinal', name: 'Olduğu gibi', k: [1, 1, 1] }, { id: 'uzun', name: 'Uzun', k: [0.85, 1.35, 0.85] },
  { id: 'genis', name: 'Geniş', k: [1.3, 0.8, 1.3] }, { id: 'kucuk', name: 'Küçük', k: [0.7, 0.7, 0.7] },
];
export const paintKey = (p?: { material?: string; color?: string; pattern?: string; shape?: string } | null): string => {
  if (!p) return '';
  const m = p.material || 'dogal', c = p.color || 'yok', t = p.pattern || 'duz', s = p.shape && p.shape !== 'orijinal' ? p.shape : '';
  if (m === 'dogal' && c === 'yok' && t === 'duz' && !s) return '';
  return m + '.' + c + '.' + t + (s ? '.' + s : '');
};

/** Sign designer extras (dekor-11). */
export const SIGN_SLOGANS: string[] = [
  '', 'Çayımız tavşan kanı, martımız uslu', 'Simit sıcak, kalp sıcak', 'Ayranın köpüğü bizden', 'Boğaz manzaralı lezzet durağı', 'Vapuru kaçıran buraya uğrar',
  'Martılar bile sıraya girer', '1 çay = 1 gülümseme', 'Tostun hası, sohbetin tası', 'Lodosta da açığız', 'Kediler ücretsiz, insanlar da güler',
];
export const SIGN_EMBLEMS: { id: string; name: string }[] = [
  { id: 'yok', name: 'Yok' }, { id: 'marti', name: 'Martı' }, { id: 'cay', name: 'Çay bardağı' }, { id: 'simit', name: 'Simit' }, { id: 'vapur', name: 'Vapur' }, { id: 'lale', name: 'Lale' },
];
export const SIGN_FRAMES: { id: string; name: string }[] = [
  { id: 'yok', name: 'Sade' }, { id: 'ahsap', name: 'Ahşap' }, { id: 'ampul', name: 'Ampullü' }, { id: 'cini', name: 'Çinili' }, { id: 'neon', name: 'Neon' },
];
export const SIGN_TEXT_COLORS: { id: string; hex: string }[] = [
  { id: 'kendi', hex: '' }, { id: 'sari', hex: '#ffd23f' }, { id: 'beyaz', hex: '#fffaf0' }, { id: 'kirmizi', hex: '#ff6a55' }, { id: 'turkuaz', hex: '#49e6d8' }, { id: 'pembe', hex: '#ff8fc0' },
];
export const SIGN_BG_COLORS: { id: string; hex: string }[] = [
  { id: 'kendi', hex: '' }, { id: 'lacivert', hex: '#16325c' }, { id: 'kirmizi', hex: '#9c2a1e' }, { id: 'yesil', hex: '#2f5a2a' }, { id: 'siyah', hex: '#1c1c22' }, { id: 'krem', hex: '#e8d9b8' },
];

/** Seasonal / calendar decoration layer (dekor-9). Month 1..12 (+ day for short events). */
export interface SeasonDef { id: string; name: string; from: [number, number]; to: [number, number]; line: string; colors: string[] }
export const SEASONS: SeasonDef[] = [
  { id: 'yilbasi', name: 'Yılbaşı Süsleri', from: [12, 15], to: [1, 6], line: 'Büfeye yılbaşı süsü geldi, martılar şapka taktı!', colors: ['#e0533c', '#5d8f45', '#ffd23f', '#fbfaf6'] },
  { id: 'kis', name: 'Kış Süsleri', from: [1, 7], to: [2, 28], line: 'Kar taneleri asıldı, salep havası!', colors: ['#fbfaf6', '#bfe6e9', '#8fd0f2'] },
  { id: 'lale', name: 'Lale Zamanı', from: [3, 20], to: [5, 10], line: 'Lale zamanı! Büfe çiçek açtı.', colors: ['#e0533c', '#ffd23f', '#f2a2b3', '#8a6bbf'] },
  { id: 'yaz', name: 'Yaz Flamaları', from: [5, 11], to: [8, 31], line: 'Yaz flamaları asıldı, deniz kokusu her yerde!', colors: ['#3fb5b0', '#ffd23f', '#e0533c', '#fbfaf6'] },
  { id: 'sonbahar', name: 'Sonbahar Yaprakları', from: [9, 1], to: [12, 14], line: 'Sarı yapraklar ve kestane kokusu geldi.', colors: ['#d9822b', '#c23e2c', '#f2b632', '#8a5d3b'] },
];
export function seasonFor(calendar: string): SeasonDef | null {
  const m = Number(String(calendar || '').slice(5, 7)) || 0, d = Number(String(calendar || '').slice(8, 10)) || 1;
  if (!m) return null;
  const v = m * 100 + d;
  for (const s of SEASONS) {
    const a = s.from[0] * 100 + s.from[1], b = s.to[0] * 100 + s.to[1];
    if (a <= b ? v >= a && v <= b : v >= a || v <= b) return s;
  }
  return null;
}

/** Moments driven by decor (dekor-8). */
export const PHOTO_LINES: string[] = [
  'Bir turist {item} önünde poz verdi, Martıgram\'a gitti bile!', 'Bir çift {item} önünde selfie çekti, "büfe aşkı" yazmışlar.',
  'Okul gezisi {item} önünde toplu fotoğraf çekti. Herkes "simiiit" dedi.', 'Bir martı {item} önünde fotoğrafa girdi, en çok o beğeni aldı.',
];
export const LIGHT_LINES: string[] = [
  'Yoldan geçen biri ışıklara bakıp "burası ne şirin" diye büfeye yöneldi.', 'Işıklar denizde titreşiyor, karşı kıyıdan bile görünüyormuş.',
  'Akşam yürüyüşündeki teyzeler ışıklı büfeyi görünce çay molası verdi.',
];

// ───────────────────────── Sabri'nin Evi (ev-1..9) ─────────────────────────
export interface HomeArea { id: string; name: string; price: number; slots: number; floor: string; wall: string; desc: string }
export const HOME_AREAS: HomeArea[] = [
  { id: 'oda', name: 'Çatı katı odası', price: 0, slots: 5, floor: '#c9955c', wall: '#f3e2c4', desc: 'Büfenin tepesinde, eğik tavanlı, minicik ama senin.' },
  { id: 'mutfak', name: 'Minik mutfak', price: 6000, slots: 4, floor: '#e8e2d4', wall: '#d8efe9', desc: 'Bir ocak, bir demlik, bir de koca bir iştah.' },
  { id: 'balkon', name: 'Boğaz balkonu', price: 12000, slots: 4, floor: '#b98a5e', wall: '#bfe6f2', desc: 'Martılar sabah buradan günaydın der.' },
  { id: 'teras', name: 'Çatı terası', price: 25000, slots: 5, floor: '#a7a69c', wall: '#cfe3f5', desc: 'Yıldızlar, çay ve uzaktan vapur düdüğü.' },
  { id: 'kedi', name: 'Kedi odası', price: 18000, slots: 4, floor: '#f2d0b8', wall: '#fbe3ec', desc: 'Mahallenin kedileri burayı gizli karargah ilan etti.' },
];
export interface HomeItem { id: string; name: string; area: string | '*'; price: number; gold?: number; rest: number; shape: string; cols: [string, string, string]; desc: string }
export const HOME_ITEMS: HomeItem[] = [
  { id: 'ev_kanepe', name: 'Dantelli Babaanne Kanepesi', area: '*', price: 2400, rest: 3, shape: 'kanepe', cols: ['#b85c6e', '#fbfaf6', '#7d5638'], desc: 'Dantelleri kutsal, oturan bir daha kalkamaz.' },
  { id: 'ev_tv', name: 'Tüplü Boğaz Haber televizyonu', area: '*', price: 1800, rest: 2, shape: 'tv', cols: ['#7d5638', '#3a4a5a', '#49e6d8'], desc: 'Antenini oynatınca Boğaz Haber çekiyor, bazen de yan kanal.' },
  { id: 'ev_semaver', name: 'Semaverli çay köşesi', area: '*', price: 3200, rest: 3, shape: 'semaver', cols: ['#b8733d', '#c23e2c', '#3fb5b0'], desc: 'Sabah çayı burada demlenir, Sabri burada uyanır.' },
  { id: 'ev_tunek', name: 'Balkonda martı tüneği', area: 'balkon', price: 1500, rest: 2, shape: 'tunek', cols: ['#8a5d3b', '#fbfaf6', '#ffd23f'], desc: 'Sabahları bir martı gelip haberleri anlatıyor.' },
  { id: 'ev_kedi_kulesi', name: 'Kedi tırmanma kulesi "Muhtarlık"', area: 'kedi', price: 2800, rest: 2, shape: 'kedikule', cols: ['#d8c39a', '#c23e2c', '#7d5638'], desc: 'Mahalle kedilerinin resmi muhtarlık binası.' },
  { id: 'ev_lav', name: 'Ay\'dan gelen lav lambası', area: '*', price: 0, gold: 15, rest: 2, shape: 'lav', cols: ['#8a6bbf', '#ff5fa2', '#bfc6cc'], desc: 'Kargo kutusunda "Ay Üssü" yazıyordu. Kimse sorgulamadı.' },
  { id: 'ev_yatak', name: 'Pofuduk yer yatağı', area: 'oda', price: 1200, rest: 4, shape: 'yatak', cols: ['#f6ead2', '#2f6fb0', '#e0533c'], desc: 'İyi uyku, iyi tost demek.' },
  { id: 'ev_kilim', name: 'Babaanne kilimi', area: '*', price: 900, rest: 1, shape: 'kilim', cols: ['#c23e2c', '#f2b632', '#2f6fb0'], desc: 'Üstüne basmadan önce terlik çıkarılır.' },
  { id: 'ev_dolap', name: 'Kapağı gıcırdayan dolap', area: '*', price: 1100, rest: 1, shape: 'dolap', cols: ['#9c6c46', '#7d5638', '#f2b632'], desc: 'Gece gıcırdıyor, Sabri buna ninni diyor.' },
  { id: 'ev_ocak', name: 'İki gözlü tüp ocak', area: 'mutfak', price: 1400, rest: 2, shape: 'ocak', cols: ['#e8e2d4', '#3c4146', '#e0533c'], desc: 'Menemen burada efsane olur.' },
  { id: 'ev_buzdolabi', name: 'Mırıldayan buzdolabı', area: 'mutfak', price: 2000, rest: 1, shape: 'buzdolabi', cols: ['#bfe6e9', '#fbfaf6', '#3c4146'], desc: 'Gece mırıldar. Kediler onu da kedi sanıyor.' },
  { id: 'ev_saksi', name: 'Balkon sardunyası', area: '*', price: 500, rest: 1, shape: 'saksi', cols: ['#e0533c', '#5d8f45', '#c98a52'], desc: 'Her sabah sulanır, her sabah teşekkür eder.' },
  { id: 'ev_hamak', name: 'Teras hamağı', area: 'teras', price: 2600, rest: 4, shape: 'hamak', cols: ['#f08a3c', '#fbfaf6', '#9c6c46'], desc: 'Bir sallanırsın, iki uyursun.' },
  { id: 'ev_teleskop', name: 'Yıldız dürbünü', area: 'teras', price: 3000, rest: 2, shape: 'teleskop', cols: ['#2b3a55', '#bfc6cc', '#f2b632'], desc: 'Ay Üssü\'ne el sallamak için ideal.' },
  { id: 'ev_kedi_yatak', name: 'Yuvarlak kedi yatağı', area: 'kedi', price: 800, rest: 1, shape: 'kediyatak', cols: ['#f2a2b3', '#fbfaf6', '#9c6c46'], desc: 'Kedi girer, dünya durur.' },
  { id: 'ev_kupa_rafi', name: 'Kupa ve hatıra rafı', area: '*', price: 2200, rest: 2, shape: 'raf', cols: ['#9c6c46', '#f2b632', '#fbfaf6'], desc: 'Kazandığın her şey burada parlıyor.' },
  { id: 'ev_pikap', name: 'Ev pikabı', area: '*', price: 2400, rest: 2, shape: 'pikap', cols: ['#20232a', '#e0533c', '#f2b632'], desc: 'Akşamları hafif bir şarkı, hafif bir tost.' },
  { id: 'ev_akvaryum', name: 'Ev akvaryumu', area: '*', price: 3400, rest: 3, shape: 'akvaryum', cols: ['#bfe6e9', '#2f6fb0', '#f08a3c'], desc: 'Balıklar Sabri\'yi izliyor, Sabri balıkları.' },
];
/** Theme rooms (ev-9): the attic room can be dressed as one of these (cosmetic + small rest bonus when its key item is placed). */
export const HOME_THEMES: { id: string; name: string; key: string; wall: string }[] = [
  { id: 'yok', name: 'Sade oda', key: '', wall: '' },
  { id: 'kupa', name: 'Kupa ve Hatıra Odası', key: 'ev_kupa_rafi', wall: '#f2e2b0' },
  { id: 'plak', name: 'Plak Odası', key: 'ev_pikap', wall: '#2f2a3a' },
  { id: 'kedi', name: 'Kedi Odası', key: 'ev_kedi_yatak', wall: '#fbe3ec' },
  { id: 'akvaryum', name: 'Akvaryum Odası', key: 'ev_akvaryum', wall: '#cfeef5' },
];
/** Rested Sabri: +speed in the morning, capped small (ev-8). */
export const HOME_REST = { PER_POINT: 0.01, CAP: 0.08, MORNING_FROM_H: 8, MORNING_TO_H: 11 };
export const homeItemById = (id: string): HomeItem | undefined => HOME_ITEMS.find(h => h.id === id);
export const HOME_LINES = {
  enter: ['Sabri merdivenleri çıktı. Burası çatı katı, burası huzur.', 'Eve hoş geldin! Terlikler kapının yanında.'],
  morning: 'Dinlenen Sabri sabah biraz daha hızlı!',
  buyArea: '{area} açıldı! Ev büyüyor, gönül büyüyor.',
};
