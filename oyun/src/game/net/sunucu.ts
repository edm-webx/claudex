/**
 * Sunucular (2026-10-24 14:38 user: "10 oda kuralım, ana menüde sunucular kısmından girilsin, gerçek mmorpg arayüzü gibi").
 * Ten fixed public worlds, each one realtime channel `sunucu-N`. Private code rooms (online.ts) stay for playing in a
 * friend's büfe. The pick is a per-device convenience (localStorage), the giriş screen asks every time.
 */
export const SUNUCULAR = [
  { id: 1, ad: 'Kadıköy', renk: '#e0533c' }, { id: 2, ad: 'Beşiktaş', renk: '#2b2b33' }, { id: 3, ad: 'Üsküdar', renk: '#3fa35a' },
  { id: 4, ad: 'Eminönü', renk: '#d9822b' }, { id: 5, ad: 'Sarıyer', renk: '#2f6f9a' }, { id: 6, ad: 'Balat', renk: '#7d3c98' },
  { id: 7, ad: 'Moda', renk: '#3fb5b0' }, { id: 8, ad: 'Bebek', renk: '#e85a9a' }, { id: 9, ad: 'Fener', renk: '#f2c230' },
  { id: 10, ad: 'Adalar', renk: '#6f9bc8' },
];
const KEY = 'martikoy-sunucu';
export function sunucu(): number { try { const n = Number(localStorage.getItem(KEY)); return n >= 1 && n <= 10 ? n : 1; } catch { return 1; } }
export function setSunucu(n: number) { try { localStorage.setItem(KEY, String(n)); } catch { /* per session only */ } window.dispatchEvent(new CustomEvent('martikoy:sunucu', { detail: n })); }
export const sunucuAd = (n: number) => SUNUCULAR.find(s => s.id === n)?.ad || 'Kadıköy';
