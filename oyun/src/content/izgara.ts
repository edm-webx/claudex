/**
 * Harita koordinat ızgarası (owner request 2026-10-24): "A4 koordinatında şunu yap".
 * Sabit ve belgelenmiş: DEĞİŞTİRİRSEN eski komutlar kayar, DEVAM-ET.md'deki tabloyu da güncelle.
 *   - Kare boyu 2 m. Sütun harfi A..Z soldan sağa (x: -26 .. +26), satır numarası 1..14 arkadan öne (z: -14 .. +14).
 *   - Satır 1 = denize bakan arka kenar (z -14..-12), satır 14 = kaldırım/yol tarafı (z +12..+14).
 *   - Büfe (BUFE x -4.2..4.2, z -10.6..-4.4) = sütun K..O, satır 2..6. Merkez (0,0) = N8 sol-üst köşesi.
 */
export const IZGARA = { x0: -26, x1: 26, z0: -14, z1: 14, cell: 2 } as const;
export const IZGARA_COLS = (IZGARA.x1 - IZGARA.x0) / IZGARA.cell;   // 26 -> A..Z
export const IZGARA_ROWS = (IZGARA.z1 - IZGARA.z0) / IZGARA.cell;   // 14 -> 1..14

export const colLetter = (c: number): string => String.fromCharCode(65 + c);

/** x,z (metre) -> "A1" biçiminde kare adı, alan dışıysa null. */
export function cellOf(x: number, z: number): string | null {
  const c = Math.floor((x - IZGARA.x0) / IZGARA.cell), r = Math.floor((z - IZGARA.z0) / IZGARA.cell);
  if (c < 0 || c >= IZGARA_COLS || r < 0 || r >= IZGARA_ROWS) return null;
  return colLetter(c) + (r + 1);
}

/** "A4" (büyük/küçük harf fark etmez) -> karenin sınırları ve merkezi, geçersizse null. */
export function cellRect(name: string): { x0: number; x1: number; z0: number; z1: number; cx: number; cz: number } | null {
  const m = /^([A-Za-z])\s*(\d{1,2})$/.exec(String(name).trim());
  if (!m) return null;
  const c = m[1].toUpperCase().charCodeAt(0) - 65, r = Number(m[2]) - 1;
  if (c < 0 || c >= IZGARA_COLS || r < 0 || r >= IZGARA_ROWS) return null;
  const x0 = IZGARA.x0 + c * IZGARA.cell, z0 = IZGARA.z0 + r * IZGARA.cell;
  return { x0, x1: x0 + IZGARA.cell, z0, z1: z0 + IZGARA.cell, cx: x0 + IZGARA.cell / 2, cz: z0 + IZGARA.cell / 2 };
}
