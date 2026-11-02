// Tiny code-made SVG portraits for the story speakers (hikaye-5: portrait bubbles). No image files.
import { SPEAKERS, type SpeakerId } from '../../content/hikaye';

const INK = '#3a2a1e';
const HATS: Record<string, (c: string) => string> = {
  kasket: c => `<path d="M12 18q12-12 24 0z" fill="${c}" stroke="${INK}" stroke-width="2"/><path d="M30 17h9" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
  asci: () => `<path d="M14 16q-4-9 4-9q2-5 6-2q4-3 6 2q8 0 4 9z" fill="#fff" stroke="${INK}" stroke-width="2"/>`,
  esarp: c => `<path d="M11 24q13-22 26 0q-2-8-13-9q-11 1-13 9z" fill="${c}" stroke="${INK}" stroke-width="2"/>`,
  biyik: c => `<path d="M16 30q4-3 8 0q4-3 8 0" stroke="${c}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
  bere: c => `<ellipse cx="24" cy="13" rx="12" ry="5" fill="${c}" stroke="${INK}" stroke-width="2"/>`,
  yagmurluk: c => `<path d="M11 18h26l-4-8H15z" fill="${c}" stroke="${INK}" stroke-width="2"/>`,
  kask: c => `<path d="M12 19q12-16 24 0z" fill="${c}" stroke="${INK}" stroke-width="2"/><path d="M18 12v6M24 10v8M30 12v6" stroke="#fff" stroke-width="1.6"/>`,
  kaptan: c => `<path d="M11 17h26l-2-7H13z" fill="#22344f" stroke="${INK}" stroke-width="2"/><rect x="11" y="16" width="26" height="3" fill="${c}"/><circle cx="24" cy="13" r="2" fill="${c}"/>`,
  gozluk: () => `<g fill="none" stroke="${INK}" stroke-width="2"><circle cx="19" cy="24" r="4"/><circle cx="29" cy="24" r="4"/><path d="M23 24h2"/></g>`,
  radyo: c => `<rect x="12" y="8" width="24" height="9" rx="3" fill="${c}" stroke="${INK}" stroke-width="2"/><path d="M30 8l4-5" stroke="${INK}" stroke-width="2"/>`,
  kravat: c => `<path d="M22 37l2-2 2 2-2 9z" fill="${c}" stroke="${INK}" stroke-width="1.5"/><path d="M14 17q10-8 20 0" stroke="#4a3a2a" stroke-width="4" fill="none"/>`,
  robot: c => `<path d="M24 4v6" stroke="${INK}" stroke-width="2"/><circle cx="24" cy="4" r="2.5" fill="${c}"/><rect x="13" y="20" width="22" height="7" rx="3" fill="#2b2b38"/><path d="M15 23h18" stroke="${c}" stroke-width="2"/>`,
  ibik: c => `<path d="M18 12q2-8 6-2q2-7 6 1q3-5 4 3z" fill="${c}" stroke="${INK}" stroke-width="2"/>`,
  pervane: c => `<path d="M24 12V6M14 6h20" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/><circle cx="24" cy="6" r="2" fill="${c}"/>`,
  takke: () => `<path d="M14 15q10-8 20 0z" fill="#fff" stroke="${INK}" stroke-width="2"/><path d="M16 31q8 7 16 0" stroke="#ddd" stroke-width="5" fill="none"/>`,
  anten: c => `<path d="M18 12l-4-8M30 12l4-8" stroke="${INK}" stroke-width="2"/><circle cx="14" cy="4" r="2.5" fill="${c}"/><circle cx="34" cy="4" r="2.5" fill="${c}"/>`,
};

function cat(): string {
  return `<path d="M10 20l3-14 9 9zM38 20l-3-14-9 9z" fill="#f7f3ea" stroke="${INK}" stroke-width="2"/><circle cx="24" cy="26" r="14" fill="#f7f3ea" stroke="${INK}" stroke-width="2"/>
<path d="M17 25q2.5 2.5 5 0M26 25q2.5 2.5 5 0" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M22.5 30l1.5 1.5 1.5-1.5" fill="#ef7d8d" stroke="${INK}" stroke-width="1.3"/>
<path d="M8 29h7M8 32l7-1M40 29h-7M40 32l-7-1" stroke="${INK}" stroke-width="1"/>`;
}
function gulls(): string {
  // Vapur kaptanı: a coat with gull heads peeking out (hikaye-6)
  return `<path d="M10 48V30q14-8 28 0v18z" fill="#22344f" stroke="${INK}" stroke-width="2"/><circle cx="24" cy="23" r="9" fill="#fff" stroke="${INK}" stroke-width="2"/>
<path d="M30 24l7 2-7 2z" fill="#f2b632" stroke="${INK}" stroke-width="1.5"/><circle cx="26" cy="21" r="1.6" fill="${INK}"/><circle cx="15" cy="38" r="3.5" fill="#fff" stroke="${INK}" stroke-width="1.5"/><path d="M11 38l-3 1 3 1z" fill="#f2b632"/>`;
}

export function portrait(id: string, size = 56): string {
  const sp = SPEAKERS[id as SpeakerId] || SPEAKERS.sabri;
  let inner: string;
  if (id === 'pamuk') inner = cat();
  else if (id === 'kaptan') inner = gulls() + (HATS.kaptan(sp.accent));
  else {
    const robot = id === 'burgatron' || id === 'dron';
    const hat = HATS[sp.hat] ? HATS[sp.hat](sp.accent) : '';
    inner = `<rect x="11" y="36" width="26" height="12" rx="6" fill="${sp.shirt}" stroke="${INK}" stroke-width="2"/>
${robot ? `<rect x="12" y="12" width="24" height="24" rx="5" fill="${sp.skin}" stroke="${INK}" stroke-width="2"/>` : `<circle cx="24" cy="24" r="12" fill="${sp.skin}" stroke="${INK}" stroke-width="2"/>`}
<circle cx="19.5" cy="23" r="1.8" fill="${INK}"/><circle cx="28.5" cy="23" r="1.8" fill="${INK}"/><path d="M19 29q5 4 10 0" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>${hat}`;
  }
  return `<svg class="hk-face" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="${sp.accent}" opacity=".28"/>${inner}</svg>`;
}
