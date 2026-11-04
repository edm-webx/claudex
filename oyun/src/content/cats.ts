/**
 * Cats and Karamel (v2 D.CATS, D.DOG).
 * Ported 1:1 from v2 data.js (numbers and Turkish text kept). Owner: Builder C (M1). Pure data, no imports of sim code.
 */

export interface CatDef { id: string; name: string; coat: string; at: number; trait: string; pose: string; job: string; }
export const CATS: CatDef[] = [
  {
    "id": "pamuk",
    "name": "Pamuk",
    "coat": "white",
    "at": 0,
    "trait": "Uykucu, büfenin asıl sahibi olduğuna inanır.",
    "pose": "Lavaş Yatağı: lavaş sepetine kıvrılmış uyur.",
    "job": "Sevilince 1 saat bahşiş biraz artar."
  },
  {
    "id": "tarcin",
    "name": "Fındık",
    "coat": "ginger",
    "at": 0,
    "trait": "Obur, kırıntı avcısı.",
    "pose": "Kasa Bekçisi: kasanın üstünde, patisi paraların üstünde.",
    "job": "Masalardaki kırıntıyı temizler."
  },
  {
    "id": "boncuk",
    "name": "Kuki",
    "coat": "calico",
    "at": 0,
    "trait": "Anaç; ara sıra iki yavruyla gelir.",
    "pose": "Kolaz Kutusu: boş gazoz kolisinde.",
    "job": "Çocuk müşterilerin sabrı artar."
  },
  {
    "id": "muhtar",
    "name": "Kedi Muhtar",
    "coat": "grey",
    "at": 50,
    "trait": "Ciddi, mahallenin başı.",
    "pose": "Ferman: iki ayak üstünde tabelayı okur.",
    "job": "Her gün mahalleye bir ferman."
  },
  {
    "id": "komur",
    "name": "Venüs",
    "coat": "black",
    "at": 0,
    "trait": "Gizemli, sadece akşam ve gece görünür.",
    "pose": "Gece Nöbeti: bankın altında iki göz.",
    "job": "Kapkaççı yaklaşınca miyavlayıp uyarır."
  },
  {
    "id": "pasa",
    "name": "Paşa",
    "coat": "grey",
    "at": 100,
    "trait": "Kibirli, en güzel sandalyeyi kapar.",
    "pose": "Paşa Tahtı.",
    "job": "Oturduğu masanın müşterisi daha çok bahşiş bırakır."
  }
];
export const DOG: { id: string; name: string; story: string } = {
  "id": "karamel",
  "name": "Torbacı",
  "story": "İri, kumral, yumuşak bakışlı sokak köpeği. Çöp torbalarını sürüklemeye bayılır, bu yüzden adı Torbacı. Kulağında sarı belediye küpesi. Para yığınının yanında yatar; o yakındayken kapkaççı yaklaşmaz."
};
