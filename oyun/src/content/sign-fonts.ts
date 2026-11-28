/** Sign fonts, default sign text and the swear filter (v2 data.js). Owner: Builder A. Pure. */
import type { HeroId } from '../game/sim/schema';
export interface SignFont { id: string; name: string; family: string; weight: number; style: string; color: string; neon?: boolean; }
export const SIGN_FONTS: SignFont[] = [
  { id: 'yesilcam', name: 'Yeşilçam El Yazısı', family: '"Brush Script MT", "Segoe Script", cursive', weight: 700, style: 'italic', color: '#f6ead2' },
  { id: 'vapur', name: 'Vapur Şablonu', family: '"Arial Black", Impact, sans-serif', weight: 900, style: 'normal', color: '#f2b632' },
  { id: 'neon', name: 'Neon', family: '"Trebuchet MS", "Segoe UI", sans-serif', weight: 800, style: 'normal', color: '#ff5fa2', neon: true },
  { id: 'lale', name: 'Lale Süslü', family: 'Georgia, "Times New Roman", serif', weight: 700, style: 'italic', color: '#f2a2b3' },
  { id: 'plaza', name: 'Plaza Düz', family: 'Helvetica, Arial, sans-serif', weight: 600, style: 'normal', color: '#ffffff' },
  { id: 'uzay', name: 'Uzay Mono', family: '"Courier New", Consolas, monospace', weight: 700, style: 'normal', color: '#49e6d8' }
];
export const signFontCss = (id: string, px: number): string => { const f = SIGN_FONTS.find(x => x.id === id) || SIGN_FONTS[1]; return `${f.style} ${f.weight} ${px}px ${f.family}`; };
export const defaultSign = (hero: HeroId | null): string => hero === 'sabriye' ? 'Sabriye\'nin Büfesi' : 'Sabri\'nin Büfesi';
const FOLD = (s: string) => s.toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ç/g, 'c').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/â/g, 'a')
  .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't').replace(/8/g, 'b').replace(/@/g, 'a').replace(/\$/g, 's').replace(/!/g, 'i');
const dec = (b: string): string[] => { try { return atob(b).split(','); } catch { return []; } };
const BAD_ANY = dec('c2lrdGlyLG9yb3NwdSxvcm9zYnUseWFycmFrLGFtY2lrLHBlemV2ZW5rLGthaHBlLHlhdnNhayxzZXJlZnNpeixpYm5lLGdhdmF0LHB1c3QsZnVjayxzaGl0LGJpdGNoLGN1bnQsYW1pbmEsYW5hbmksc2lrZXIsc2lraW0sc2lrdGlnaW0sZ290dmVyZW4sYXB0YWwsZ2VyaXpla2FsaQ==');
const BAD_WORD = dec('YW1rLGFxLHNpayxnb3QscGljLG9jLG1rLGFzcyxkaWNrLHNleCxwb3JuLGFtLHRhc2FrLHNhbGFr');
export function cleanSign(text: string, hero: HeroId | null): { ok: boolean; text: string; reason?: string } {
  // eslint-disable-next-line no-control-regex
  const t = String(text || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
  if (t.length < 3) return { ok: false, text: defaultSign(hero), reason: 'En az 3 harf olsun abi.' };
  const folded = FOLD(t), squashed = folded.replace(/[^a-z]/g, '');
  const words = folded.split(/[^a-z]+/).filter(Boolean);
  const bad = BAD_ANY.some(w => w && squashed.includes(w)) || BAD_WORD.some(w => w && words.includes(w));
  if (bad) return { ok: false, text: defaultSign(hero), reason: 'Bu ad tabelaya yakışmaz abi, başka bir şey dene.' };
  return { ok: true, text: t };
}
