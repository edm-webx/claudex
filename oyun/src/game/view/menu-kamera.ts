// Ana menü sinematiği (2026-11-25 "Altın Saat"): başlık ve Martı Kimlik ekranının arkasında kamera iskelenin üstünde
// gün batımında yavaşça süzülür. Saf fonksiyon: zaman + ekran oranı -> birinci şahıs kamera pozu (cam.fp).
// Kadraj: büfe ve iskele önde, karşı yaka siluetleri ufukta. Masaüstünde logo/menü solda olduğu için büfe sağa,
// dar (telefon) ekranda ortaya alınır.

/** Menüde gösterilen saat (yalnız ışık; oyunun saati değişmez). */
export const MENU_SAAT = 18.3;

export interface MenuPoz { x: number; y: number; z: number; yaw: number; pitch: number }

const ODAK = { x: -2, z: -1.6 };   // büfe önü

export function menuPoz(t: number, aspect: number): MenuPoz {
  const dar = aspect < 1;
  // yörünge: ~90 sn'lik yumuşak gidiş-dönüş, uzaklık ve yükseklik ayrı ritimlerde nefes alır
  const a = 0.5 + 0.2 * Math.sin(t * (2 * Math.PI / 90));
  const r = (dar ? 54 : 44) + 3 * Math.sin(t * 0.043 + 1);
  const y = 13.2 + 1.4 * Math.sin(t * 0.061);
  const x = ODAK.x + Math.sin(a) * r, z = ODAK.z + Math.cos(a) * r;
  const tx = ODAK.x, tz = ODAK.z, ty = 0.6;
  let yaw = Math.atan2(tx - x, tz - z);
  if (!dar) yaw += 0.13;   // büfe kadrajın sağ yarısına
  const pitch = Math.atan2(ty - y, Math.hypot(tx - x, tz - z)) + (dar ? 0.06 : 0.03);
  return { x, y, z, yaw, pitch };
}
