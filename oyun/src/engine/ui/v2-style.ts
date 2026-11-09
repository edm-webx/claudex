// Port of v2 js/ui.js icons (inline SVG) and the full CSS block, kept 1:1 (generated from v2 ui.js lines 65-149 and 404-1056,
// then typed). Do not restyle here: the parity test compares against v2 screenshots. Owner: Builder D.
/* eslint-disable */
/* ---------- icons (inline SVG, no emoji) ---------- */
export const INK = '#3b2a20';
const K = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const K2 = `stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;
const svg = (body: string, vb?: string): string => `<svg viewBox="${vb || '0 0 48 48'}" aria-hidden="true" focusable="false">${body}</svg>`;
const LIRA = (c: string): string => `<path d="M21 12v21c6.5 0 10.5-3.5 11.5-9" fill="none" stroke="${c}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.5 21.5l12-4.2M15.5 27.2l12-4.2" stroke="${c}" stroke-width="3.2" stroke-linecap="round"/>`;
const SIMIT_PATH = 'M3 24a21 21 0 1 0 42 0a21 21 0 1 0-42 0zM16 24a8 8 0 1 0 16 0a8 8 0 1 0-16 0z';
const SESAME = '<g fill="#fff6e6"><ellipse cx="13" cy="15" rx="1.6" ry="1" transform="rotate(-40 13 15)"/><ellipse cx="24" cy="9" rx="1.6" ry="1"/><ellipse cx="35" cy="14" rx="1.6" ry="1" transform="rotate(40 35 14)"/><ellipse cx="39" cy="27" rx="1.6" ry="1" transform="rotate(80 39 27)"/><ellipse cx="31" cy="37" rx="1.6" ry="1" transform="rotate(-30 31 37)"/><ellipse cx="17" cy="37" rx="1.6" ry="1" transform="rotate(30 17 37)"/><ellipse cx="9" cy="27" rx="1.6" ry="1" transform="rotate(-80 9 27)"/></g>';
export const ICONS: Record<string, string> = {
  coin: svg(`<circle cx="24" cy="24" r="20" fill="#ffd23f" ${K}/><circle cx="24" cy="24" r="14.5" fill="none" stroke="#e8a91c" stroke-width="2.4"/>${LIRA('#8a5a00')}`),
  gold: svg(`<path fill-rule="evenodd" d="${SIMIT_PATH}" fill="#f6bd3a" ${K}/><path d="M10 17a16 16 0 0 1 12-9" fill="none" stroke="#fff3c4" stroke-width="3" stroke-linecap="round"/>${SESAME}<path d="M40 4l1.4 3.6L45 9l-3.6 1.4L40 14l-1.4-3.6L35 9l3.6-1.4z" fill="#fff" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`),
  doner: svg(`<g transform="rotate(-32 24 24)"><rect x="5" y="15" width="38" height="18" rx="9" fill="#f2dcae" ${K}/><ellipse cx="38.5" cy="24" rx="4.6" ry="8.4" fill="#a55a2a" ${K2}/><circle cx="37.5" cy="20" r="2" fill="#6fb54a"/><circle cx="39.5" cy="26.5" r="1.9" fill="#e0533c"/><path d="M5 24a9 9 0 0 1 9-9h10v18H14a9 9 0 0 1-9-9z" fill="#fffaf1" ${K}/><path d="M18 15.5v17" stroke="#e0533c" stroke-width="2.6"/></g>`),
  cay: svg(`<ellipse cx="24" cy="40" rx="16" ry="4.5" fill="#f4efe6" ${K2}/><path d="M15 7Q11 17 19 23Q13 30 17 38L31 38Q35 30 29 23Q37 17 33 7Z" fill="#c2401f" ${K}/><path d="M17.5 10.5h13" stroke="#fff" stroke-opacity=".7" stroke-width="2.4" stroke-linecap="round"/><path d="M20 27q-2 4 0 8" stroke="#fff" stroke-opacity=".45" stroke-width="2" fill="none" stroke-linecap="round"/>`),
  ayran: svg(`<path d="M11 10h26l-3.4 31H14.4z" fill="#fbfdff" ${K}/><path d="M12.4 21h23.2l-1 9H13.4z" fill="#2f6fdb"/><ellipse cx="24" cy="10" rx="13" ry="3.4" fill="#e3edf6" ${K2}/><path d="M29 10l5-8" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`),
  simit: svg(`<path fill-rule="evenodd" d="${SIMIT_PATH}" fill="#cf8238" ${K}/><path d="M10 17a16 16 0 0 1 12-9" fill="none" stroke="#f0b26a" stroke-width="3" stroke-linecap="round"/>${SESAME}`),
  tost: svg(`<rect x="6" y="11" width="36" height="25" rx="7" fill="#e9b36a" ${K}/><path d="M13 17l9 13M21 15l11 15M30 15l7 10" stroke="#a8642a" stroke-width="2.6" stroke-linecap="round"/><path d="M11 36c1 6 6 6 6 0M28 36c0 4 5 4 5 0" fill="#ffd23f" ${K2}/>`),
  gazoz: svg(`<path d="M20 9h8v5l4 7v20a4 4 0 0 1-4 4h-8a4 4 0 0 1-4-4V21l4-7z" fill="#86d6cc" ${K}/><rect x="16.5" y="26" width="15" height="9" fill="#e0533c" stroke="${INK}" stroke-width="2.2"/><rect x="18.5" y="3.5" width="11" height="6" rx="2" fill="#f2b632" ${K2}/><path d="M21 21v17" stroke="#fff" stroke-opacity=".6" stroke-width="2.4" stroke-linecap="round"/>`),
  chair: svg(`<path d="M15 5v22M33 5v22M15 9.5h18M15 16h18" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/><rect x="10.5" y="25" width="27" height="7" rx="2.5" fill="#b98a5e" ${K}/><path d="M14 32l-2 11M34 32l2 11" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/>`),
  umbrella: svg(`<path d="M4 24a20 16 0 0 1 40 0z" fill="#e0533c" ${K}/><path d="M17.3 24a6.7 13 0 0 1 13.4 0" fill="#fff6e6" stroke="${INK}" stroke-width="2.4"/><path d="M24 24v14a4 4 0 0 1-8 0" fill="none" ${K}/>`),
  clock: svg(`<circle cx="24" cy="25" r="17" fill="#fff6e6" ${K}/><path d="M24 15v10l7 5" fill="none" ${K}/><path d="M12 6l-5 4M36 6l5 4" ${K}/>`),
  stopwatch: svg(`<circle cx="24" cy="27" r="16" fill="#fff6e6" ${K}/><path d="M24 18v9l6 4" fill="none" ${K}/><rect x="20" y="4" width="8" height="5" rx="1.5" fill="#e0533c" ${K2}/><path d="M37 13l3-3" ${K}/>`),
  note: svg(`<path d="M18 35V11l20-5v24" fill="none" ${K}/><ellipse cx="13" cy="35.5" rx="6" ry="5" fill="${INK}"/><ellipse cx="33" cy="30.5" rx="6" ry="5" fill="${INK}"/><path d="M18 17l20-5" ${K}/>`),
  heart: svg(`<path d="M24 41S6 30 6 17.5a9 9 0 0 1 18-3a9 9 0 0 1 18 3C42 30 24 41 24 41z" fill="#ef5b6e" ${K}/><path d="M12 15a4 4 0 0 1 5-4" stroke="#fff" stroke-opacity=".7" stroke-width="2.6" fill="none" stroke-linecap="round"/>`),
  star: svg(`<path d="M24 4.5l5.8 12.2 13.2 1.8-9.7 9.2 2.4 13.2L24 34.5l-11.7 6.4 2.4-13.2L5 18.5l13.2-1.8z" fill="#ffd23f" ${K}/>`),
  starOff: svg(`<path d="M24 4.5l5.8 12.2 13.2 1.8-9.7 9.2 2.4 13.2L24 34.5l-11.7 6.4 2.4-13.2L5 18.5l13.2-1.8z" fill="#e9dfcf" stroke="#b9ab98" stroke-width="3" stroke-linejoin="round"/>`),
  cat: svg(`<path d="M9 21L8 6l11 8h10l11-8-1 15c3 4 3 16-15 20C6 37 6 25 9 21z" fill="#f4f1ea" ${K}/><circle cx="18" cy="24" r="2.2" fill="${INK}"/><circle cx="30" cy="24" r="2.2" fill="${INK}"/><path d="M22 29h4l-2 2.4z" fill="#ef7d8d" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><path d="M24 31.5q-2 3-5 1.5M24 31.5q2 3 5 1.5" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`),
  camera: svg(`<rect x="5" y="14" width="38" height="26" rx="6" fill="#5aa9d6" ${K}/><path d="M16 14l3-6h10l3 6" fill="#5aa9d6" ${K}/><circle cx="24" cy="27" r="8" fill="#fff6e6" ${K}/><circle cx="24" cy="27" r="3.5" fill="${INK}"/>`),
  ferry: svg(`<path d="M3 29h42l-5 10H8z" fill="#fff" ${K}/><rect x="11" y="19" width="26" height="10" rx="2" fill="#fff6e6" ${K}/><rect x="21" y="9" width="6" height="10" fill="#e0533c" ${K2}/><path d="M15 24h3M21 24h3M27 24h3M33 24h1" stroke="#2f7fb3" stroke-width="3" stroke-linecap="round"/><path d="M3 44q5-3 10 0t10 0 10 0 10 0" fill="none" stroke="#5aa9d6" stroke-width="2.6" stroke-linecap="round"/>`),
  map: svg(`<path d="M5 11l12-4 14 4 12-4v30l-12 4-14-4-12 4z" fill="#f6ead2" ${K}/><path d="M17 7v30M31 11v30" stroke="${INK}" stroke-width="2.4"/><path d="M9 26q5-6 10-1t12-4" fill="none" stroke="#e0533c" stroke-width="2.6" stroke-dasharray="3 3" stroke-linecap="round"/>`),
  taxi: svg(`<path d="M7 27l4-10h26l4 10v9H7z" fill="#ffd23f" ${K}/><path d="M14 17l2-6h16l2 6" fill="#ffd23f" ${K2}/><circle cx="15" cy="37" r="4.5" fill="${INK}"/><circle cx="33" cy="37" r="4.5" fill="${INK}"/><rect x="19" y="24" width="10" height="4" fill="${INK}"/>`),
  scarf: svg(`<path d="M8 12q16 8 32 0l-3 9q-13 6-26 0z" fill="#3fb5b0" ${K}/><path d="M28 19l4 22-7-2-3-19" fill="#e9853b" ${K}/><path d="M28 30l5-1M29.5 36l4.5-1" stroke="${INK}" stroke-width="2"/>`),
  ring: svg(`<circle cx="24" cy="30" r="12" fill="none" stroke="#f2b632" stroke-width="5"/><circle cx="24" cy="30" r="12" fill="none" stroke="${INK}" stroke-width="1.6" stroke-opacity=".6"/><path d="M18 8h12l3 6-9 8-9-8z" fill="#bfe6e9" ${K2}/>`),
  cart: svg(`<path d="M13 7l4 25h20l3-15H15" fill="#d76a8a" ${K}/><circle cx="19" cy="39" r="4" fill="${INK}"/><circle cx="34" cy="39" r="4" fill="${INK}"/><path d="M5 7h8" ${K}/>`),
  zz: svg(`<path d="M8 22h12L8 36h12M26 8h10l-10 12h10" fill="none" stroke="#2f7fb3" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`),
  warn: svg(`<path d="M24 4L45 41H3z" fill="#e63946" stroke="#fff" stroke-width="3.2" stroke-linejoin="round"/><path d="M24 4L45 41H3z" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round" transform="translate(0 0)"/><path d="M24 16v12" stroke="#fff" stroke-width="5" stroke-linecap="round"/><circle cx="24" cy="34.5" r="3" fill="#fff"/>`),
  broom: svg(`<path d="M33 4L21 26" ${K}/><path d="M19 23l9 5-6 15c-6 1-12-2-15-7z" fill="#ebc07a" ${K}/><path d="M13 35l9-4M15 40l8-5" stroke="${INK}" stroke-width="2"/>`),
  tray: svg(`<ellipse cx="24" cy="34" rx="20" ry="6" fill="#cfc8be" ${K}/><path d="M12 31l2-14h7l2 14M28 31l1-11h6l1 11" fill="#c2401f" ${K2}/>`),
  people: svg(`<circle cx="17" cy="16" r="7" fill="#f2c9a5" ${K}/><path d="M5 40c0-9 5-14 12-14s12 5 12 14z" fill="#5aa9d6" ${K}/><circle cx="33" cy="18" r="6" fill="#f2c9a5" ${K}/><path d="M26 40c0-8 3-12 9-12s9 4 9 12z" fill="#e0533c" ${K}/>`),
  gear: svg(`<circle cx="24" cy="24" r="14.5" fill="none" stroke="${INK}" stroke-width="8.5" stroke-dasharray="5.2 4.2"/><circle cx="24" cy="24" r="13" fill="#cfc8be" ${K}/><circle cx="24" cy="24" r="5" fill="#fff6e6" ${K}/>`),
  sound: svg(`<path d="M6 18v12h8l10 8V10l-10 8z" fill="#fff6e6" ${K}/><path d="M31 17a9 9 0 0 1 0 14M36 12a16 16 0 0 1 0 24" fill="none" ${K}/>`),
  mute: svg(`<path d="M6 18v12h8l10 8V10l-10 8z" fill="#e9dfcf" ${K}/><path d="M31 18l11 12M42 18L31 30" ${K}/>`),
  close: svg(`<path d="M13 13l22 22M35 13L13 35" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`),
  check: svg(`<path d="M9 25l10 10 20-22" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`),
  checkInk: svg(`<path d="M9 25l10 10 20-22" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`),
  lock: svg(`<rect x="10" y="21" width="28" height="22" rx="5" fill="#cfc8be" ${K}/><path d="M16 21v-6a8 8 0 0 1 16 0v6" fill="none" ${K}/><circle cx="24" cy="31" r="3" fill="${INK}"/>`),
  play: svg(`<circle cx="24" cy="24" r="19" fill="#fff" ${K}/><path d="M20 15l13 9-13 9z" fill="#2f7fb3" ${K2}/>`),
  hammer: svg(`<path d="M22 20l-12 21" stroke="#b98a5e" stroke-width="6" stroke-linecap="round"/><path d="M22 20l-12 21" stroke="${INK}" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M14 13l8-7 14 6-3 5-8-2-4 5z" fill="#a3acb5" ${K}/>`),
  dekor: svg(`<rect x="7" y="6" width="28" height="13" rx="4" fill="#3fb5b0" ${K}/><path d="M35 12h5v11H22v6" fill="none" ${K}/><rect x="18" y="29" width="8" height="14" rx="3" fill="#b98a5e" ${K}/>`),
  gorev: svg(`<rect x="8" y="8" width="32" height="36" rx="5" fill="#f6ead2" ${K}/><rect x="17" y="4" width="14" height="8" rx="3" fill="#d9822b" ${K2}/><path d="M14 22l3 3 5-6M14 33l3 3 5-6" fill="none" stroke="#49b96a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M26 23h9M26 34h9" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`),
  karne: svg(`<path d="M9 5h22l8 8v30H9z" fill="#fffaf1" ${K}/><path d="M31 5v8h8" fill="none" ${K2}/><path d="M24 17l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" fill="#ffd23f" ${K2}/><path d="M15 39h18" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`),
  menu: svg(`<path d="M24 3v42" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><path d="M14 10h20l-3 26H17z" fill="#b5652f" ${K}/><path d="M16 17h16M15.5 24h17M16.5 31h15" stroke="#7a3d1a" stroke-width="2.2"/><ellipse cx="24" cy="41" rx="10" ry="3" fill="#cfc8be" ${K2}/>`),
  isbul: svg(`<rect x="5" y="9" width="32" height="32" rx="3" fill="#fffaf1" ${K}/><path d="M37 16h6v21a4 4 0 0 1-4 4h-2" fill="#f6ead2" ${K}/><rect x="10" y="14" width="12" height="10" fill="#5aa9d6" ${K2}/><path d="M26 15h6M26 21h6M10 29h22M10 35h22" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`),
  sun: svg(`<circle cx="24" cy="24" r="10" fill="#ffd23f" ${K}/><path d="M24 3v6M24 39v6M3 24h6M39 24h6M9 9l4 4M35 35l4 4M39 9l-4 4M13 35l-4 4" stroke="#e8a91c" stroke-width="3.4" stroke-linecap="round"/>`),
  moon: svg(`<path d="M30 6a18 18 0 1 0 12 26A15 15 0 0 1 30 6z" fill="#fff0b8" ${K}/><circle cx="20" cy="22" r="2.4" fill="#e8d590"/><circle cx="25" cy="33" r="1.8" fill="#e8d590"/>`),
  flame: svg(`<path d="M24 44c-9 0-15-6-15-14 0-9 8-13 8-22 6 3 9 8 9 13 2-2 3-5 3-7 5 4 10 10 10 16 0 8-6 14-15 14z" fill="#ff8a3c" ${K}/><path d="M24 44c-4 0-7-3-7-7 0-5 5-7 6-12 4 3 8 7 8 12 0 4-3 7-7 7z" fill="#ffd23f"/>`),
  medal: svg(`<path d="M14 4h8l4 14h-8zM34 4h-8l-4 14h8z" fill="#e0533c" ${K2}/><circle cx="24" cy="30" r="13" fill="#f6bd3a" ${K}/><path d="M24 22l2.4 5 5.4.7-4 3.8 1 5.4-4.8-2.6-4.8 2.6 1-5.4-4-3.8 5.4-.7z" fill="#fff3c4" stroke="#b7811a" stroke-width="1.4" stroke-linejoin="round"/>`),
  plus: svg(`<path d="M24 10v28M10 24h28" stroke="#fff" stroke-width="6" stroke-linecap="round"/>`),
  arrowR: svg(`<path d="M8 24h28M26 13l11 11-11 11" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`),
  skip: svg(`<path d="M8 12l14 12-14 12zM24 12l14 12-14 12z" fill="${INK}"/>`),
  sign: svg(`<rect x="4" y="12" width="40" height="20" rx="5" fill="#e0533c" ${K}/><path d="M11 22h26" stroke="#fff6e6" stroke-width="3.4" stroke-linecap="round"/><path d="M14 32v10M34 32v10" ${K}/>`),
  kepenk: svg(`<rect x="6" y="6" width="36" height="36" rx="3" fill="#cfc8be" ${K}/><path d="M6 13h36M6 19h36M6 25h36M6 31h36" stroke="#8d857b" stroke-width="2.4"/><rect x="19" y="35" width="10" height="4" rx="1.5" fill="${INK}"/>`),
  newspaper: svg(`<rect x="5" y="9" width="32" height="32" rx="3" fill="#fffaf1" ${K}/><path d="M37 16h6v21a4 4 0 0 1-4 4h-2" fill="#f6ead2" ${K}/><path d="M10 15h22" stroke="#e0533c" stroke-width="4" stroke-linecap="round"/><path d="M10 23h10M10 29h10M10 35h22M24 23h8M24 29h8" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`),
  sparkle: svg(`<path d="M24 3l4.5 16.5L45 24l-16.5 4.5L24 45l-4.5-16.5L3 24l16.5-4.5z" fill="#ffd23f" ${K2}/>`),
  trophy: svg(`<path d="M15 6h18v10a9 9 0 0 1-18 0z" fill="#f6bd3a" ${K}/><path d="M15 9H8c0 6 3 9 8 10M33 9h7c0 6-3 9-8 10" fill="none" ${K2}/><path d="M21 25h6v7h-6z" fill="#f6bd3a" ${K2}/><rect x="13" y="32" width="22" height="9" rx="2" fill="#7d5638" ${K}/>`),
  shop: svg(`<path d="M6 18h36v24H6z" fill="#fff6e6" ${K}/><path d="M4 18l4-12h32l4 12z" fill="#e0533c" ${K}/><path d="M14 6l-2 12M24 6v12M34 6l2 12" stroke="#fff6e6" stroke-width="3"/><rect x="11" y="24" width="12" height="10" fill="#bfe6e9" ${K2}/><rect x="28" y="24" width="9" height="18" fill="#b98a5e" ${K2}/>`),
  cart1: svg(`<rect x="9" y="12" width="30" height="20" rx="3" fill="#b98a5e" ${K}/><path d="M7 12l5-6h24l5 6" fill="#e0533c" ${K}/><circle cx="16" cy="38" r="5" fill="#cfc8be" ${K}/><circle cx="32" cy="38" r="5" fill="#cfc8be" ${K}/><path d="M39 22h6" ${K}/>`),
  garden: svg(`<path d="M4 20a20 13 0 0 1 40 0z" fill="#3fb5b0" ${K}/><path d="M24 20v20" ${K}/><rect x="10" y="32" width="28" height="5" rx="2" fill="#b98a5e" ${K2}/><path d="M13 37v7M35 37v7" ${K}/>`),
  lokanta: svg(`<rect x="6" y="14" width="36" height="28" fill="#f6ead2" ${K}/><path d="M4 14l20-9 20 9z" fill="#7d5638" ${K}/><rect x="11" y="21" width="9" height="9" fill="#bfe6e9" ${K2}/><rect x="28" y="21" width="9" height="9" fill="#bfe6e9" ${K2}/><rect x="20" y="31" width="8" height="11" fill="#e0533c" ${K2}/>`),
  zincir: svg(`<rect x="3" y="20" width="18" height="20" fill="#fff6e6" ${K2}/><path d="M2 20l3-6h14l3 6z" fill="#e0533c" ${K2}/><rect x="27" y="14" width="18" height="26" fill="#fff6e6" ${K2}/><path d="M26 14l3-6h14l3 6z" fill="#e0533c" ${K2}/><rect x="8" y="28" width="7" height="12" fill="#b98a5e"/><rect x="33" y="27" width="7" height="13" fill="#b98a5e"/>`),
  quality: svg(`<rect x="5" y="9" width="38" height="26" rx="4" fill="#bfe6e9" ${K}/><path d="M9 31l9-10 7 7 5-5 9 8" fill="#8daa5b" ${K2}/><circle cx="33" cy="16" r="3.4" fill="#ffd23f"/><path d="M17 41h14" ${K}/>`),
  hand: svg(`<path d="M9 30c-2-3 2-7 5-4l3 3V9a3.5 3.5 0 0 1 7 0v12a3.5 3.5 0 0 1 7 0v2a3.5 3.5 0 0 1 7 0v2a3.5 3.5 0 0 1 6 2v7c0 7-5 12-12 12h-6c-5 0-8-3-11-7z" fill="#fff6e6" ${K}/>`),
  vibrate: svg(`<rect x="15" y="6" width="18" height="36" rx="4" fill="#fff6e6" ${K}/><path d="M7 16v16M41 16v16M3 20v8M45 20v8" ${K}/>`),
  trash: svg(`<path d="M10 14h28l-3 28H13z" fill="#cfc8be" ${K}/><path d="M7 14h34M19 14V8h10v6" fill="none" ${K}/>`),
  gull: svg(`<path d="M3 22q10-10 21 2 11-12 21-2-11-3-21 9C14 19 3 22 3 22z" fill="#f4f2ec" ${K}/><path d="M3 22l5-1M45 22l-5-1" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`),
  phone: svg(`<rect x="14" y="5" width="20" height="38" rx="4" fill="#5aa9d6" ${K}/><rect x="17" y="10" width="14" height="24" fill="#bfe6e9"/><circle cx="24" cy="38.5" r="1.8" fill="${INK}"/>`),
  bolt: svg(`<path d="M27 3L9 27h13l-3 18 20-26H26z" fill="#ffd23f" ${K}/>`),
  smile: svg(`<circle cx="24" cy="24" r="19" fill="#ffd23f" ${K}/><circle cx="17" cy="20" r="2.6" fill="${INK}"/><circle cx="31" cy="20" r="2.6" fill="${INK}"/><path d="M14 28q10 10 20 0" fill="none" ${K}/>`)
};
ICONS.ekip = ICONS.people; ICONS.isciler = ICONS.people; ICONS.gorevler = ICONS.gorev; ICONS.kedi = ICONS.cat;
ICONS.tadilat = ICONS.hammer; ICONS.ayarlar = ICONS.gear; ICONS.ayar = ICONS.gear; ICONS.istasyon = ICONS.menu;
ICONS.garson = ICONS.tray; ICONS.temizlik = ICONS.broom; ICONS.kurye = ICONS.stopwatch; ICONS.para = ICONS.coin;
ICONS.sandalye = ICONS.chair; ICONS.saat = ICONS.clock; ICONS.kalp = ICONS.heart; ICONS.yildiz = ICONS.star; ICONS.vapur = ICONS.ferry;
ICONS.harita = ICONS.map; ICONS.taksi = ICONS.taxi; ICONS.atki = ICONS.scarf; ICONS.yuzuk = ICONS.ring; ICONS.kamera = ICONS.camera;
ICONS.nota = ICONS.note; ICONS.semsiye = ICONS.umbrella; ICONS.kronometre = ICONS.stopwatch; ICONS.dekorlar = ICONS.dekor;
ICONS.durum = ICONS.doner; ICONS.dürüm = ICONS.doner; ICONS['döner'] = ICONS.doner; ICONS['çay'] = ICONS.cay; ICONS.marti = ICONS.gull;

/* ---------- CSS ---------- */
export const CSS = `
#sbui{--ink:#3b2a20;--ink2:#6b4a33;--cream:#fff6e6;--cream2:#f6ead2;--paper:#fffaf1;--red:#e0533c;--red2:#b8392a;--blue:#5aa9d6;--blue2:#2f7fb3;--navy:#2e2a5a;--tea:#d9822b;--sesame:#ebc07a;--wood:#b98a5e;--wood2:#7d5638;--stone:#cfc8be;--foam:#bfe6e9;--tile:#3fb5b0;--pink:#f2a2b3;--olive:#8daa5b;--yellow:#ffd23f;--money:#49b96a;--money2:#2f8f4c;--warn:#e63946;--gold:#f2b632;
--r-gri:#9aa1a8;--r-yesil:#49b96a;--r-mavi:#3f8fc9;--r-mor:#8e5bd6;--r-altin:#f2b632;
--disp:"Baloo 2","Nunito",ui-rounded,"SF Pro Rounded","Arial Rounded MT Bold","Varela Round","Trebuchet MS",system-ui,sans-serif;
--body:"Nunito",ui-rounded,"SF Pro Rounded",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
--st:env(safe-area-inset-top,0px);--sr:env(safe-area-inset-right,0px);--sbm:env(safe-area-inset-bottom,0px);--sl:env(safe-area-inset-left,0px);
--hudb:100px;--barh:0px;--shadow:0 3px 0 rgba(59,42,32,.35);
position:fixed;inset:0;pointer-events:none;z-index:10;overflow:hidden;font-family:var(--body);color:var(--ink);font-size:15px;line-height:1.25;
-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;text-size-adjust:100%;-webkit-text-size-adjust:100%}
:where(#sbui) *,:where(#sbui) *::before,:where(#sbui) *::after{box-sizing:border-box}
#sbui [hidden]{display:none!important}
:where(#sbui) svg{display:block;overflow:visible}
:where(#sbui) button{font:inherit;color:inherit;-webkit-appearance:none;appearance:none;touch-action:manipulation}
:where(#sbui) button:focus-visible{outline:3px solid var(--blue2);outline-offset:2px}
:where(#sbui) h2,:where(#sbui) h3,:where(#sbui) p{margin:0}
.sb-auto{pointer-events:auto}

/* buttons */
.sb-btn{pointer-events:auto;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:46px;padding:7px 16px 9px;border:2.5px solid var(--ink);border-radius:16px;background:var(--yellow);color:var(--ink);font:900 14px/1.05 var(--disp);letter-spacing:.01em;box-shadow:0 4px 0 var(--ink);transition:transform .07s,box-shadow .07s,filter .15s;text-align:center;position:relative}
.sb-btn:active{transform:translateY(3px);box-shadow:0 1px 0 var(--ink)}
.sb-btn svg{width:22px;height:22px;flex:none}
.sb-btn .sb-bl{display:flex;flex-direction:column;align-items:center;gap:2px}
.sb-btn small{font:800 11px/1.1 var(--body);opacity:.92;letter-spacing:0}
.sb-btn.red{background:var(--red);color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.18)}
.sb-btn.blue{background:var(--blue2);color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.18)}
.sb-btn.green{background:var(--money);color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.2)}
.sb-btn.cream{background:var(--cream)}
.sb-btn.navy{background:var(--navy);color:#fff}
.sb-btn.big{min-height:62px;font-size:27px;border-width:3px;border-radius:24px;padding:10px 34px 13px;box-shadow:0 6px 0 var(--ink)}
.sb-btn.big:active{box-shadow:0 2px 0 var(--ink);transform:translateY(4px)}
.sb-btn.wide{width:100%}
.sb-btn.sm{min-height:44px;font-size:14px;padding:5px 12px 7px;border-radius:14px}
.sb-btn.off,.sb-btn:disabled{background:#ece4d6;color:#9b8b7b;border-color:#b9ab98;box-shadow:0 4px 0 #b9ab98;text-shadow:none;cursor:default;transform:none}
.sb-btn.off svg,.sb-btn:disabled svg{opacity:.55;filter:grayscale(1)}
.sb-btn.glow{animation:sb-glow 1.4s ease-in-out infinite}
@keyframes sb-glow{50%{filter:brightness(1.12);box-shadow:0 4px 0 var(--ink),0 0 0 5px rgba(255,210,63,.55)}}
.sb-x{pointer-events:auto;cursor:pointer;width:46px;height:46px;flex:none;border-radius:50%;border:2.5px solid var(--ink);background:var(--cream);display:grid;place-items:center;padding:0;box-shadow:0 3px 0 var(--ink)}
.sb-x svg{width:20px;height:20px}
.sb-x:active{transform:translateY(2px);box-shadow:0 1px 0 var(--ink)}
.sb-chip{display:inline-flex;align-items:center;gap:4px;padding:3px 8px 4px;border-radius:999px;background:var(--cream2);border:2px solid var(--ink);font:800 11px/1.1 var(--body);white-space:nowrap}
.sb-chip svg{width:16px;height:16px}
.sb-chip.ok{background:var(--money);color:#fff}
.sb-chip.gold{background:var(--yellow)}
.sb-chip.soon{background:var(--navy);color:#fff;border-color:var(--navy)}

/* HUD */
.sb-hud{position:absolute;left:0;right:0;top:0;padding:calc(var(--st) + 8px) calc(var(--sr) + 10px) 0 calc(var(--sl) + 10px);display:flex;align-items:flex-start;gap:8px;z-index:30;transition:opacity .3s,transform .3s}
.sb-hud.off{opacity:0;transform:translateY(-20px)}
.sb-hud button{pointer-events:auto;cursor:pointer}
.sb-lvl{position:relative;width:60px;height:60px;flex:none;border-radius:50%;border:2.5px solid var(--ink);padding:0;background:conic-gradient(var(--yellow) calc(var(--p,0) * 1turn),#fff6e6 0);display:grid;place-items:center;box-shadow:var(--shadow)}
.sb-lvl-in{width:44px;height:44px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#8fd0f2,var(--blue2));border:2.5px solid var(--ink);display:grid;place-items:center;color:#fff;font:900 18px/1 var(--disp);text-shadow:0 2px 0 rgba(0,0,0,.28)}
.sb-lvl small{position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);background:var(--red);color:#fff;font:900 9.5px/1 var(--disp);padding:3px 6px 2px;border-radius:7px;border:2px solid var(--ink);letter-spacing:.06em}
.sb-hmid{flex:1;min-width:0;display:flex;flex-direction:column;gap:7px;align-items:flex-start}
.sb-hl{display:flex;gap:6px;align-items:center;min-width:0;max-width:100%}
.sb-pill{display:inline-flex;align-items:center;gap:5px;height:38px;padding:0 13px 0 4px;background:var(--cream);border:2.5px solid var(--ink);border-radius:999px;box-shadow:var(--shadow);font:900 17px/1 var(--disp);font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--ink);min-width:0}
.sb-pill svg{width:30px;height:30px;flex:none}
.sb-pill b{font-weight:900}
.sb-money b{color:#226b3a}
.sb-bump{animation:sb-bump .32s ease-out}
@keyframes sb-bump{40%{transform:scale(1.14)}}
.sb-gold svg{width:28px;height:28px}
.sb-gold b{color:#9a6400}
.sb-day{height:30px;font-size:14.5px;padding:0 10px 0 3px;position:relative;overflow:hidden;gap:6px}
.sb-day svg{width:24px;height:24px}
.sb-day b{color:var(--red2);letter-spacing:.03em}
.sb-day .sb-dbar{position:absolute;left:0;bottom:0;height:4px;width:0;background:linear-gradient(90deg,#5aa9d6,#ffd23f 40%,#ff8a3c 75%,#2e2a5a);border-radius:0 3px 3px 0}
.sb-stars{display:inline-flex;align-items:center;gap:1px;height:30px;padding:0 7px;background:var(--cream);border:2.5px solid var(--ink);border-radius:999px;box-shadow:var(--shadow)}
.sb-stars svg{width:16px;height:16px}
.sb-hbtns{display:flex;flex-direction:column;gap:8px;flex:none}
.sb-ib{width:46px;height:46px;border-radius:50%;border:2.5px solid var(--ink);background:var(--cream);display:grid;place-items:center;padding:0;box-shadow:var(--shadow)}
.sb-ib svg{width:28px;height:28px}
.sb-ib:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(59,42,32,.35)}
.sb-streak{position:absolute;left:calc(var(--sl) + 8px);top:calc(100% + 6px);display:inline-flex;align-items:center;gap:4px;height:30px;padding:0 11px 0 4px;border-radius:999px;background:var(--red);color:#fff;border:2.5px solid var(--ink);font:900 13px/1 var(--disp);box-shadow:var(--shadow);letter-spacing:.03em;text-shadow:0 2px 0 rgba(0,0,0,.2);transform-origin:20% 50%}
.sb-streak svg{width:24px;height:24px}
.sb-streak.pop{animation:sb-pop .35s cubic-bezier(.3,1.8,.5,1)}
@keyframes sb-pop{0%{transform:scale(.6)}100%{transform:scale(1)}}

/* world labels */
.sb-labels{position:absolute;inset:0;z-index:5;overflow:hidden}
.sb-lab{position:absolute;left:0;top:0;will-change:transform;pointer-events:none;contain:layout style}
.sb-lab.tap{pointer-events:auto;cursor:pointer}
.sb-lab>div{position:absolute;left:0;top:0;transform:translate(calc(-50% + var(--dx,0px)),-100%)}
.sb-lab>.slow,.sb-lab>.icon,.sb-lab>.ring,.sb-lab>.hearts{transform:translate(-50%,-50%)}
.sb-lab .bubble{background:var(--paper);border:2.5px solid var(--ink);border-radius:16px;padding:4px 8px 5px;box-shadow:var(--shadow);display:flex;flex-direction:column;align-items:center;gap:2px;margin-bottom:18px;width:max-content;max-width:150px;font:800 13px/1.15 var(--body);text-align:center;color:var(--ink);animation:sb-in .22s cubic-bezier(.3,1.6,.5,1)}
.sb-lab .bubble::before,.sb-lab .bubble::after{content:"";position:absolute;border:2.5px solid var(--ink);background:var(--paper);border-radius:50%}
.sb-lab .bubble::before{width:12px;height:12px;left:calc(50% - 9px - var(--dx,0px));bottom:-13px}
.sb-lab .bubble::after{width:7px;height:7px;left:calc(50% - 13px - var(--dx,0px));bottom:-21px}
.sb-lab .bubble .bi{display:flex;align-items:center;gap:4px}
.sb-lab .bubble .bi svg{width:26px;height:26px}
.sb-lab .bubble .bi .n{font:900 12px/1 var(--disp);margin-left:-2px}
.sb-lab .bubble .bi .d{opacity:.3}
.sb-lab .bubble .bt{max-width:134px;text-wrap:balance}
.sb-lab .bubble .bp{width:100%;min-width:46px;height:7px;border-radius:4px;background:#e8dccb;overflow:hidden;border:1.5px solid rgba(59,42,32,.5);position:relative}
.sb-lab .bubble .bp i{display:block;height:100%;background:var(--money);border-radius:3px}
.sb-lab .bubble .bp::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 calc(25% - 1.5px),rgba(59,42,32,.55) calc(25% - 1.5px) 25%)}
.sb-lab .bubble.mini{padding:4px 7px;border-radius:14px}
.sb-lab .bubble.mini .bi svg{width:24px;height:24px}
.sb-lab .bubble.praise,.sb-lab .bubble.praise::before,.sb-lab .bubble.praise::after{background:#fff0f3}
.sb-lab .bubble.angry{border-color:var(--warn);animation:sb-shake .4s}
.sb-lab .bubble.angry::before,.sb-lab .bubble.angry::after{border-color:var(--warn)}
.sb-lab .bubble.vip{border-color:#b7811a;box-shadow:0 0 0 3px var(--yellow),var(--shadow)}
.sb-lab .bubble.vip::before,.sb-lab .bubble.vip::after{border-color:#b7811a}
.sb-lab .bubble.far{opacity:.82;transform:translate(calc(-50% + var(--dx,0px)),-100%) scale(.85);transform-origin:calc(50% - var(--dx,0px)) 100%}
@keyframes sb-in{0%{opacity:0;scale:.6}100%{opacity:1;scale:1}}
@keyframes sb-shake{25%{translate:-3px 0}50%{translate:3px 0}75%{translate:-2px 0}}
.sb-lab .say{margin-bottom:12px;background:var(--ink);color:var(--cream);border-radius:14px;padding:6px 11px 7px;font:800 12px/1.15 var(--body);width:max-content;max-width:190px;text-align:center;box-shadow:0 3px 0 rgba(0,0,0,.25);animation:sb-in .2s ease-out}
.sb-lab .say::after{content:"";position:absolute;left:calc(50% - var(--dx,0px));bottom:-7px;width:12px;height:12px;background:var(--ink);transform:translateX(-50%) rotate(45deg);border-radius:2px}
.sb-lab .say b{color:var(--yellow)}
.sb-lab .tag{white-space:nowrap;text-align:center;font:800 13px/1.1 var(--body);color:#fff;text-shadow:0 1px 0 var(--ink),1px 0 0 var(--ink),-1px 0 0 var(--ink),0 -1px 0 var(--ink),0 2px 3px rgba(0,0,0,.6)}
.sb-lab .tag b{display:block;font:900 12px/1.05 var(--disp);color:var(--yellow)}
.sb-lab .price{display:flex;flex-direction:column;align-items:center;gap:2px;margin-bottom:4px}
.sb-lab .price .pt{font:900 13px/1 var(--disp);color:#fff;background:var(--ink);padding:3px 7px 2px;border-radius:7px;letter-spacing:.03em;white-space:nowrap}
.sb-lab .price .pv{display:flex;align-items:center;gap:3px;background:var(--yellow);border:2.5px solid var(--ink);border-radius:12px;padding:2px 9px 2px 3px;font:900 14px/1 var(--disp);box-shadow:var(--shadow);white-space:nowrap;font-variant-numeric:tabular-nums}
.sb-lab .price .pv svg{width:22px;height:22px}
.sb-lab .price.cant .pv{background:#efe6d6;color:#8a7a6a}
.sb-lab .slow{width:50px;height:50px;display:grid;place-items:center;filter:drop-shadow(0 3px 0 rgba(59,42,32,.4))}
.sb-lab .slow svg{width:46px;height:46px;animation:sb-pulse 1s ease-in-out infinite}
@keyframes sb-pulse{50%{transform:scale(1.15)}}
.sb-lab .icon{width:40px;height:40px;border-radius:50%;background:var(--paper);border:2.5px solid var(--ink);display:grid;place-items:center;box-shadow:var(--shadow);animation:sb-bob 1.6s ease-in-out infinite}
.sb-lab .icon svg{width:26px;height:26px}
@keyframes sb-bob{50%{translate:0 -4px}}
.sb-lab .ring{width:40px;height:40px;border-radius:50%;background:conic-gradient(var(--yellow) calc(var(--p,0) * 1turn),rgba(59,42,32,.4) 0);-webkit-mask:radial-gradient(circle,transparent 11px,#000 12px);mask:radial-gradient(circle,transparent 11px,#000 12px)}
.sb-lab .full{font:900 13px/1 var(--disp);color:var(--ink);padding:4px 8px 3px;border-radius:8px;border:2.5px solid var(--ink);letter-spacing:.06em;background:repeating-linear-gradient(-45deg,var(--yellow) 0 6px,#ffe78a 6px 12px);white-space:nowrap;margin-bottom:4px}
.sb-lab .zz{font:900 19px/1 var(--disp);color:#2f7fb3;text-shadow:0 2px 0 #fff,0 0 3px #fff;white-space:nowrap;animation:sb-zz 1.6s ease-in-out infinite;margin-bottom:4px}
@keyframes sb-zz{0%{opacity:.4;translate:-4px 4px}50%{opacity:1}100%{opacity:.4;translate:6px -6px}}
.sb-lab .hearts{width:60px;height:60px}
.sb-lab .hearts i{position:absolute;left:50%;top:50%;width:22px;height:22px;margin:-11px;animation:sb-heart 1.4s ease-out infinite}
.sb-lab .hearts i:nth-child(2){animation-delay:.45s;margin-left:-22px}
.sb-lab .hearts i:nth-child(3){animation-delay:.9s;margin-left:2px}
@keyframes sb-heart{0%{opacity:0;transform:translateY(10px) scale(.5)}20%{opacity:1}100%{opacity:0;transform:translateY(-34px) scale(1.1)}}

/* floats and coins */
.sb-floats{position:absolute;inset:0;z-index:8;overflow:hidden}
.sb-float{position:absolute;left:0;top:0;font:900 20px/1 var(--disp);color:#fff;white-space:nowrap;text-shadow:0 2px 0 var(--ink),2px 0 0 var(--ink),-2px 0 0 var(--ink),0 -2px 0 var(--ink),2px 2px 0 var(--ink),-2px 2px 0 var(--ink),2px -2px 0 var(--ink),-2px -2px 0 var(--ink),0 4px 0 var(--ink);pointer-events:none;will-change:transform,opacity}
.sb-float.money{color:#8af0a8}
.sb-float.gold{color:#ffd65a}
.sb-float.bad{color:#ff9a9a}
.sb-float.info{color:var(--cream)}
.sb-float.tip{color:#ffb3c4}
.sb-float.streak{color:var(--yellow);font-size:30px}
.sb-coin{position:absolute;left:0;top:0;width:30px;height:30px;margin:-15px;pointer-events:none;will-change:transform}
.sb-coin svg{width:100%;height:100%}

/* tutorial hand */
.sb-hand{position:absolute;left:0;top:0;width:0;height:0;z-index:9;pointer-events:none}
.sb-hand .hm{position:absolute;left:-14px;top:-6px;width:70px;height:70px;animation:sb-drag 2.2s ease-in-out infinite;filter:drop-shadow(0 4px 0 rgba(59,42,32,.35))}
.sb-hand .hm svg{width:100%;height:100%}
.sb-hand .hr{position:absolute;left:-22px;top:-22px;width:44px;height:44px;border-radius:50%;border:4px solid var(--yellow);box-shadow:0 0 0 2px var(--ink);animation:sb-dragring 2.2s ease-in-out infinite}
@keyframes sb-drag{0%,10%{transform:translate(0,0) scale(1)}15%{transform:translate(0,0) scale(.9)}55%{transform:translate(70px,-36px) scale(.9)}65%,100%{transform:translate(70px,-36px) scale(1);opacity:0}}
@keyframes sb-dragring{0%,10%{transform:translate(0,0) scale(.6);opacity:0}15%{opacity:1;transform:translate(0,0) scale(1)}55%{transform:translate(70px,-36px) scale(1);opacity:1}65%,100%{opacity:0;transform:translate(70px,-36px) scale(1.3)}}

/* toasts */
.sb-toasts{position:absolute;left:50%;top:calc(var(--hudb) + 44px);transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px;z-index:40;width:min(calc(100% - 24px),420px)}
.sb-toast{display:flex;align-items:center;gap:8px;background:var(--paper);border:2.5px solid var(--ink);border-radius:16px;padding:6px 14px 7px 6px;font:800 11px/1.2 var(--body);box-shadow:var(--shadow);max-width:100%;animation:sb-tin .28s cubic-bezier(.3,1.6,.5,1);transition:opacity .3s,transform .3s}
.sb-toast.out{opacity:0;transform:translateY(-10px)}
.sb-toast>i{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;flex:none;border:2px solid var(--ink);background:var(--blue)}
.sb-toast>i svg{width:18px;height:18px}
.sb-toast.good>i{background:var(--money)}
.sb-toast.bad>i{background:var(--warn)}
@keyframes sb-tin{0%{opacity:0;transform:translateY(-14px) scale(.9)}100%{opacity:1;transform:none}}

/* day card */
.sb-dayc{position:absolute;right:calc(var(--sr) + 10px);top:calc(var(--hudb) + 52px);width:min(310px,calc(100% - 20px));background:var(--paper);border:3px solid var(--ink);border-radius:20px;box-shadow:0 5px 0 var(--ink);z-index:25;pointer-events:auto;overflow:hidden;transform:translateX(calc(100% + 30px));transition:transform .45s cubic-bezier(.25,1.3,.5,1)}
.sb-dayc.in{transform:none}
.sb-dayc .dh{display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--navy);color:#fff;font:900 17px/1 var(--disp);letter-spacing:.02em}
.sb-dayc .dh svg{width:26px;height:26px}
.sb-dayc .ds{display:flex;gap:8px;padding:10px 12px 4px}
.sb-dayc .ds>span{flex:1;min-width:0;display:flex;align-items:center;gap:6px;background:var(--cream2);border-radius:12px;padding:6px 8px;font:800 11px/1.1 var(--body);color:var(--ink2)}
.sb-dayc .ds>span>span{min-width:0;display:flex;flex-direction:column;gap:2px}
.sb-dayc .ds b{display:block;font:900 16px/1 var(--disp);color:var(--ink);white-space:nowrap;font-variant-numeric:tabular-nums}
.sb-dayc .ds .g{color:#226b3a}
.sb-dayc .ds svg{width:28px;height:28px;flex:none}
.sb-dayc .dc{display:flex;align-items:center;gap:8px;padding:6px 12px 2px;font:800 12px/1.25 var(--body)}
.sb-dayc .dc svg{width:30px;height:30px;flex:none}
.sb-dayc .df{padding:8px 12px 12px}
.sb-dayc .dt{display:block;height:5px;background:var(--tea);transform-origin:0 50%}

/* solution card */
.sb-sol{position:absolute;left:50%;bottom:calc(var(--sbm) + var(--barh) + 22px);transform:translateX(-50%);width:min(360px,calc(100% - 24px));background:var(--paper);border:3px solid var(--ink);border-radius:20px;box-shadow:0 5px 0 var(--ink);z-index:26;pointer-events:auto;padding:12px;display:grid;grid-template-columns:auto 1fr;gap:4px 10px;animation:sb-up .3s cubic-bezier(.3,1.5,.5,1)}
.sb-sol .si{grid-row:span 2;width:52px;height:52px}
.sb-sol .si svg{width:52px;height:52px}
.sb-sol h3{font:900 16px/1.1 var(--disp);align-self:end}
.sb-sol p{font:700 12px/1.3 var(--body);color:var(--ink2)}
.sb-sol .sr{grid-column:1/-1;display:flex;gap:8px;margin-top:8px}
.sb-sol .sr .sb-btn{flex:1}
@keyframes sb-up{0%{opacity:0;transform:translate(-50%,30px)}100%{opacity:1;transform:translate(-50%,0)}}

/* achievement */
.sb-ach{position:absolute;left:50%;top:calc(var(--hudb) + 10px);transform:translate(-50%,-30px);opacity:0;width:min(360px,calc(100% - 24px));background:linear-gradient(180deg,#fff7d6,var(--paper));border:3px solid var(--ink);border-radius:20px;box-shadow:0 5px 0 var(--ink);z-index:45;pointer-events:auto;padding:10px 12px;display:flex;gap:10px;align-items:center;transition:transform .4s cubic-bezier(.3,1.5,.5,1),opacity .3s}
.sb-ach.in{transform:translate(-50%,0);opacity:1}
.sb-ach .am{width:58px;height:58px;flex:none;animation:sb-spin 1.2s ease-out}
.sb-ach .am svg{width:58px;height:58px}
@keyframes sb-spin{0%{transform:rotateY(0) scale(.5)}60%{transform:rotateY(540deg) scale(1.1)}100%{transform:rotateY(720deg) scale(1)}}
.sb-ach .ak{font:900 11px/1 var(--disp);color:var(--red2);letter-spacing:.08em}
.sb-ach h3{font:900 16px/1.1 var(--disp);margin:2px 0}
.sb-ach p{font:700 11px/1.25 var(--body);color:var(--ink2)}
.sb-ach .ar{margin-top:5px}

/* menu bar */
.sb-bar{position:absolute;left:calc(var(--sl) + 6px);right:calc(var(--sr) + 6px);bottom:calc(var(--sbm) + 6px);margin:0 auto;max-width:560px;display:flex;justify-content:space-around;gap:0;padding:4px;background:linear-gradient(180deg,#fffaf1,#f6ead2);border:3px solid var(--ink);border-radius:24px;box-shadow:0 4px 0 var(--ink);z-index:35;pointer-events:auto}
.sb-bi{flex:1 1 0;min-width:0;max-width:86px;height:58px;border:0;background:none;border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;position:relative;cursor:pointer;color:var(--ink);font:800 11px/1 var(--body);letter-spacing:-.01em;padding:0 1px;transition:background .15s}
.sb-bi svg{width:32px;height:32px;transition:transform .15s}
.sb-bi span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.sb-bi:active svg{transform:scale(.88)}
.sb-bi.on{background:var(--yellow);box-shadow:inset 0 0 0 2.5px var(--ink),inset 0 -4px 0 rgba(59,42,32,.18)}
.sb-badge{position:absolute;top:1px;left:calc(50% + 6px);min-width:21px;height:21px;padding:0 5px;border-radius:11px;background:var(--red);color:#fff;border:2px solid var(--ink);font:900 11px/17px var(--disp);text-align:center;animation:sb-pop .3s}
.sb-badge.dot{min-width:15px;width:15px;height:15px;padding:0;top:4px;left:calc(50% + 9px)}

/* sheet panels */
.sb-sheet{position:absolute;left:calc(var(--sl) + 6px);right:calc(var(--sr) + 6px);bottom:calc(var(--sbm) + var(--barh) + 12px);max-height:64vh;max-height:min(66dvh,calc(100dvh - var(--hudb) - var(--barh) - var(--sbm) - 30px));max-width:620px;margin:0 auto;display:flex;flex-direction:column;background:var(--paper);border:3px solid var(--ink);border-radius:24px;box-shadow:0 6px 0 var(--ink),0 18px 40px rgba(30,15,0,.28);pointer-events:auto;z-index:32;overflow:hidden;transform-origin:50% 100%;animation:sb-sheetin .3s cubic-bezier(.25,1.3,.45,1)}
/* 2026-10-24 user: panels that open from the bottom must be fully readable: on roomy screens the sheet uses the whole height between the HUD and the bar */
@media (min-width:700px) and (min-height:560px){.sb-sheet{top:calc(var(--hudb) + 8px);max-height:none;max-width:680px}.sb-shb{font-size:16px}}
.sb-sheet.out{animation:sb-sheetout .2s ease-in forwards}
@keyframes sb-sheetin{0%{transform:translateY(40px) scale(.96);opacity:0}100%{transform:none;opacity:1}}
@keyframes sb-sheetout{100%{transform:translateY(40px) scale(.96);opacity:0}}
.sb-awn{height:18px;flex:none;background:repeating-linear-gradient(90deg,var(--acc,var(--red)) 0 22px,#fff6e6 22px 44px);-webkit-mask:linear-gradient(#000,#000) 0 0/100% 7px no-repeat,radial-gradient(circle at 11px 7px,#000 10.5px,transparent 11px) 0 0/22px 18px repeat-x;mask:linear-gradient(#000,#000) 0 0/100% 7px no-repeat,radial-gradient(circle at 11px 7px,#000 10.5px,transparent 11px) 0 0/22px 18px repeat-x}
.sb-shh{display:flex;align-items:center;gap:10px;padding:2px 10px 10px 12px;border-bottom:2.5px dashed rgba(59,42,32,.22);flex:none}
.sb-shh .hi{width:42px;height:42px;border-radius:14px;background:var(--acc,var(--red));border:2.5px solid var(--ink);display:grid;place-items:center;flex:none;box-shadow:0 3px 0 rgba(59,42,32,.3)}
.sb-shh .hi svg{width:30px;height:30px}
.sb-shh h2{font:900 20px/1.05 var(--disp);flex:1;min-width:0}
.sb-shh h2 small{display:block;font:800 12.5px/1.2 var(--body);color:var(--ink2);margin-top:1px}
.sb-shb{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding:12px 12px 20px;display:flex;flex-direction:column;gap:10px}
.sb-shb>*{flex-shrink:0}
.sb-shf{flex:none;padding:10px 12px calc(10px);border-top:2.5px dashed rgba(59,42,32,.22);display:flex;gap:8px;align-items:center;background:var(--cream)}
.sb-card{background:#fff;border:2.5px solid var(--ink);border-radius:18px;padding:10px;box-shadow:0 3px 0 rgba(59,42,32,.22)}
.sb-sec{font:900 13px/1.1 var(--disp);color:var(--ink2);display:flex;align-items:center;gap:6px;margin:6px 2px -2px;letter-spacing:.02em}
.sb-sec svg{width:22px;height:22px}
.sb-sec span{margin-left:auto;font:800 12.5px/1 var(--body)}
.sb-empty{text-align:center;padding:22px 12px;font:800 13px/1.4 var(--body);color:var(--ink2);display:flex;flex-direction:column;align-items:center;gap:10px}
.sb-empty svg{width:64px;height:64px;opacity:.85}
.sb-meter{height:12px;border-radius:7px;background:#eadfcd;border:2px solid var(--ink);overflow:hidden;position:relative}
.sb-meter i{display:block;height:100%;background:var(--money);border-radius:0 5px 5px 0;transition:width .4s}
.sb-meter.notch::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 calc(20% - 2px),rgba(59,42,32,.4) calc(20% - 2px) 20%)}
.sb-row{display:flex;gap:8px;align-items:center}
.sb-grow{flex:1;min-width:0}
.sb-muted{color:var(--ink2);font:700 11px/1.3 var(--body)}

/* workers */
.sb-wk{display:grid;grid-template-columns:68px 1fr;gap:6px 10px}
.sb-wk .sb-por{border-radius:16px;border:2.5px solid var(--ink);background:var(--foam)}
.sb-wk h3{font:900 16px/1.1 var(--disp);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.sb-pips{display:inline-flex;gap:3px;align-items:center}
.sb-pips i{width:11px;height:11px;border-radius:3px;border:2px solid var(--ink);background:#fff;transform:rotate(45deg)}
.sb-pips i.on{background:var(--yellow)}
.sb-wk .rk{display:flex;align-items:center;gap:7px;font:800 11px/1 var(--body);margin-top:5px}
.sb-trait{font:700 11px/1.3 var(--body);color:var(--ink2);margin-top:5px}
.sb-trait b{color:var(--ink);font-weight:900}
.sb-mood{display:flex;align-items:center;gap:6px;margin-top:6px;font:800 12.5px/1 var(--body)}
.sb-mood svg{width:24px;height:24px;flex:none}
.sb-mood .sb-meter{flex:1;height:10px}
.sb-wk .wb{grid-column:1/-1;display:flex;gap:8px;align-items:center;margin-top:4px}
.sb-wk .wb .sb-muted{flex:1}

/* products */
.sb-prod{display:grid;grid-template-columns:54px 1fr;gap:6px 10px;align-items:center}
.sb-prod .pi{width:54px;height:54px;border-radius:16px;background:var(--cream2);border:2.5px solid var(--ink);display:grid;place-items:center}
.sb-prod .pi svg{width:40px;height:40px}
.sb-prod h3{font:900 16px/1.1 var(--disp);display:flex;gap:6px;align-items:baseline;flex-wrap:wrap}
.sb-prod h3 small{font:900 13px/1 var(--disp);color:#226b3a}
.sb-tiers{display:flex;gap:4px;margin-top:5px}
.sb-tiers span{flex:1;text-align:center;padding:3px 0 2px;border-radius:8px;border:2px solid var(--ink);font:900 11.5px/1.1 var(--disp);background:#fff}
.sb-tiers span.on{background:var(--yellow)}
.sb-tiers span.done{background:var(--money);color:#fff}
.sb-prod .pb{grid-column:1/-1}
.sb-prod.locked{opacity:.7;background:#f3ede3}

/* decor */
.sb-style{display:flex;align-items:center;gap:10px}
.sb-style .sv{font:900 24px/1 var(--disp);color:var(--tile);min-width:58px;text-align:center}
.sb-style .sv small{display:block;font:800 11px/1 var(--body);color:var(--ink2)}
.sb-slots{display:flex;flex-wrap:wrap;gap:6px}
.sb-slot{width:48px;height:48px;border-radius:14px;border:2.5px dashed rgba(59,42,32,.4);display:grid;place-items:center;background:var(--cream);position:relative;padding:0}
.sb-slot svg{width:34px;height:34px}
.sb-slot.full{border-style:solid;border-color:var(--ink);background:#fff;cursor:pointer;pointer-events:auto}
.sb-slot.full::after{content:"";position:absolute;top:-7px;right:-7px;width:20px;height:20px;border-radius:50%;background:var(--red) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='M6 6l8 8M14 6l-8 8' stroke='white' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E") center/100%;border:2px solid var(--ink)}
.sb-slot b{font:900 11px/1 var(--disp);color:rgba(59,42,32,.4)}
.sb-dgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.sb-ditem{display:flex;flex-direction:column;gap:5px;align-items:stretch;padding:8px}
.sb-ditem .dtop{display:flex;gap:8px;align-items:center}
.sb-ditem .dic{width:52px;height:52px;flex:none;border-radius:14px;background:var(--foam);border:2.5px solid var(--ink);display:grid;place-items:center}
.sb-ditem .dic svg{width:40px;height:40px}
.sb-ditem h3{font:900 13px/1.1 var(--disp)}
.sb-ditem .db{font:800 11px/1.2 var(--body);color:#2a8a7d}
.sb-ditem .sb-btn{width:100%}
.sb-ditem.owned .dic{background:#d9f3dc}

/* tasks */
.sb-task{display:grid;grid-template-columns:1fr auto;gap:6px 10px;align-items:center}
.sb-task p{font:800 13px/1.25 var(--body)}
.sb-task .tr{font:800 12.5px/1.2 var(--body);color:#9a6400;display:flex;align-items:center;gap:4px;margin-top:3px}
.sb-task .tr svg{width:18px;height:18px}
.sb-task .tp{grid-column:1/-1;display:flex;align-items:center;gap:8px;font:900 11px/1 var(--disp)}
.sb-task .tp .sb-meter{flex:1}
.sb-task.claimed{opacity:.6}
.sb-agrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.sb-achi{display:flex;gap:8px;align-items:flex-start;padding:8px}
.sb-achi svg{width:38px;height:38px;flex:none}
.sb-achi h3{font:900 12px/1.1 var(--disp)}
.sb-achi p{font:700 11px/1.25 var(--body);color:var(--ink2);margin-top:2px}
.sb-achi.no{background:#f3ede3;box-shadow:none;border-color:#b9ab98}
.sb-achi.no svg{filter:grayscale(1);opacity:.45}

/* cats */
.sb-cgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.sb-cat{display:flex;flex-direction:column;align-items:center;text-align:center;gap:4px;padding:10px 8px;background:#fff7f8}
.sb-cat svg{width:76px;height:76px}
.sb-cat h3{font:900 15px/1.1 var(--disp)}
.sb-cat p{font:700 12.5px/1.3 var(--body);color:var(--ink2)}
.sb-cat.no{background:#f3ede3;border-style:dashed;box-shadow:none}

/* karne */
.sb-karne{background:#fffdf6;background-image:repeating-linear-gradient(180deg,transparent 0 27px,rgba(90,169,214,.22) 27px 28px);border:2.5px solid var(--ink);border-radius:16px;padding:12px;position:relative}
.sb-karne .kh{display:flex;align-items:center;gap:10px;border-bottom:3px double var(--ink);padding-bottom:8px;margin-bottom:6px}
.sb-karne .kh h3{font:900 17px/1 var(--disp);letter-spacing:.04em}
.sb-karne .kh p{font:800 11px/1.2 var(--body);color:var(--ink2)}
.sb-bigstars{display:flex;gap:4px;justify-content:center;padding:4px 0}
.sb-bigstars svg{width:40px;height:40px}
.sb-grade{display:grid;grid-template-columns:34px 1fr auto;gap:2px 10px;align-items:center;padding:7px 0;border-bottom:1.5px dashed rgba(59,42,32,.25)}
.sb-grade:last-child{border-bottom:0}
.sb-grade svg{width:32px;height:32px;grid-row:span 2}
.sb-grade h3{font:900 14px/1 var(--disp)}
.sb-grade .gw{font:900 14px/1 var(--disp);padding:4px 9px 3px;border-radius:9px;border:2px solid var(--ink);grid-row:span 2;min-width:74px;text-align:center}
.sb-grade .sb-meter{height:10px}
.sb-stamp{position:absolute;right:10px;top:8px;transform:rotate(9deg);border:3px solid var(--red);color:var(--red);border-radius:10px;padding:3px 7px 2px;font:900 11px/1.1 var(--disp);letter-spacing:.06em;text-align:center;opacity:.85;background:rgba(255,253,246,.7)}
.sb-next li{display:flex;gap:8px;align-items:center;font:800 12px/1.3 var(--body);padding:4px 0}
.sb-next ul{list-style:none;margin:6px 0 0;padding:0}
.sb-next .ck{width:24px;height:24px;border-radius:7px;border:2.5px solid var(--ink);flex:none;display:grid;place-items:center;background:#fff}
.sb-next .ck.on{background:var(--money)}
.sb-next .ck svg{width:16px;height:16px}

/* tadilat */
.sb-ladder{display:flex;align-items:flex-start;justify-content:space-between;gap:2px;padding:4px 0 2px;position:relative}
.sb-ladder::before{content:"";position:absolute;left:8%;right:8%;top:28px;height:5px;background:repeating-linear-gradient(90deg,var(--ink) 0 8px,transparent 8px 13px);opacity:.35}
.sb-st{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;font:800 11.5px/1.15 var(--body);position:relative;min-width:0}
.sb-st .sc{width:56px;height:56px;border-radius:50%;border:2.5px solid var(--ink);background:#fff;display:grid;place-items:center;box-shadow:0 3px 0 rgba(59,42,32,.25)}
.sb-st .sc svg{width:38px;height:38px}
.sb-st.done .sc{background:#d9f3dc}
.sb-st.cur .sc{background:var(--yellow);box-shadow:0 0 0 4px rgba(255,210,63,.5),0 3px 0 rgba(59,42,32,.25)}
.sb-st>span:not(.sb-chip){min-height:2.3em}
.sb-st .sb-chip{font-size:10.5px;padding:3px 7px;max-width:100%;letter-spacing:0}
.sb-st.soon{opacity:.55}
.sb-st.soon .sc{background:#efe8dc}
.sb-tad{display:flex;flex-direction:column;gap:10px}
.sb-tad .tn{display:flex;align-items:center;gap:8px;justify-content:center;font:900 17px/1.1 var(--disp);text-align:center;flex-wrap:wrap}
.sb-tad .tn svg{width:26px;height:26px}
.sb-work{display:flex;align-items:center;gap:10px}
.sb-work svg{width:44px;height:44px;animation:sb-hammer .6s ease-in-out infinite;transform-origin:30% 80%}
@keyframes sb-hammer{50%{transform:rotate(-25deg)}}
.sb-work b{font:900 23px/1 var(--disp);font-variant-numeric:tabular-nums}

/* settings */
.sb-set{display:flex;align-items:center;gap:10px;min-height:52px}
.sb-set>svg{width:34px;height:34px;flex:none}
.sb-set h3{font:900 15px/1.1 var(--disp)}
.sb-set p{font:700 12.5px/1.25 var(--body);color:var(--ink2)}
.sb-tog{width:72px;height:42px;flex:none;border-radius:21px;border:2.5px solid var(--ink);background:#e2d8c8;position:relative;cursor:pointer;padding:0;box-shadow:inset 0 2px 0 rgba(0,0,0,.08);pointer-events:auto;transition:background .2s}
.sb-tog::after{content:"";position:absolute;top:3px;left:3px;width:31px;height:31px;border-radius:50%;background:#fff;border:2.5px solid var(--ink);transition:left .2s;box-shadow:0 2px 0 rgba(0,0,0,.15)}
.sb-tog.on{background:var(--money)}
.sb-tog.on::after{left:33px}
.sb-seg{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;background:var(--cream2);border:2.5px solid var(--ink);border-radius:16px;padding:4px}
.sb-seg.two{grid-template-columns:repeat(2,1fr)}
.sb-seg button{min-height:44px;border:0;border-radius:12px;background:none;font:900 12px/1.05 var(--disp);cursor:pointer;padding:4px 2px;pointer-events:auto;display:flex;align-items:center;justify-content:center;gap:6px}
.sb-seg button.on{background:var(--yellow);box-shadow:inset 0 0 0 2.5px var(--ink)}
.sb-seg button .sb-por{border-radius:50%;border:2px solid var(--ink)}
.sb-heros{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.sb-heros button{display:flex;align-items:center;gap:8px;padding:6px 10px 6px 6px;border:2.5px solid var(--ink);border-radius:18px;background:#fff;font:900 14px/1 var(--disp);cursor:pointer;pointer-events:auto;min-height:56px}
.sb-heros button.on{background:var(--yellow);box-shadow:0 3px 0 var(--ink)}
.sb-heros .sb-por{border-radius:50%;border:2px solid var(--ink);background:var(--foam)}
.sb-foot{text-align:center;font:700 11px/1.4 var(--body);color:var(--ink2);padding:6px}

/* job board */
.sb-sheet.jb .sb-shb{background:#d8b48a;background-image:radial-gradient(rgba(125,86,56,.35) 1.2px,transparent 1.6px),radial-gradient(rgba(255,246,230,.35) 1px,transparent 1.5px);background-size:14px 14px,19px 19px;gap:16px;padding-top:18px}
.sb-cand{position:relative;background:#fff;border:3px solid var(--ink);border-radius:18px;box-shadow:0 5px 0 rgba(59,42,32,.4);--rc:var(--r-gri);overflow:hidden}
.sb-cand.r-yesil{--rc:var(--r-yesil)}.sb-cand.r-mavi{--rc:var(--r-mavi)}.sb-cand.r-mor{--rc:var(--r-mor)}.sb-cand.r-altin{--rc:var(--r-altin)}
.sb-cand .rib{display:flex;align-items:center;gap:6px;background:var(--rc);color:#fff;padding:5px 10px 5px 12px;font:900 11px/1 var(--disp);letter-spacing:.05em;text-shadow:0 1.5px 0 rgba(0,0,0,.25);border-bottom:2.5px solid var(--ink)}
.sb-cand.r-altin .rib{color:var(--ink);text-shadow:none;background:linear-gradient(100deg,#f2b632 30%,#fff1b0 45%,#f2b632 60%) 0 0/300% 100%;animation:sb-shine 2.4s linear infinite}
@keyframes sb-shine{0%{background-position:100% 0}100%{background-position:-50% 0}}
.sb-cand .rib .sb-pips{margin-left:auto}
.sb-cand .rib .sb-pips i{border-color:rgba(0,0,0,.5);background:rgba(0,0,0,.12)}
.sb-cand .rib .sb-pips i.on{background:#fff}
.sb-cand .pin{position:absolute;left:50%;top:-1px;width:18px;height:18px;margin-left:-9px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#ff9a8a,var(--red2));border:2px solid var(--ink);z-index:2;display:none}
.sb-cand .cb{padding:10px;display:grid;grid-template-columns:76px 1fr;gap:8px 10px}
.sb-cand .sb-por{border-radius:16px;border:2.5px solid var(--ink);max-width:100%;height:auto!important;aspect-ratio:1;box-sizing:border-box}
.sb-cand h3{font:900 17px/1.05 var(--disp)}
.sb-cand .role{display:inline-flex;align-items:center;gap:4px;margin-top:4px;font:800 11px/1 var(--body);background:var(--cream2);border:2px solid var(--ink);border-radius:999px;padding:3px 9px 3px 3px}
.sb-cand .role svg{width:22px;height:22px}
.sb-cand .tn{display:inline-block;margin-top:6px;font:900 11px/1 var(--disp);letter-spacing:.05em;color:var(--rc);filter:brightness(.8)}
.sb-cand.r-gri .tn{color:#6b7178;filter:none}
.sb-cand.r-altin .tn{color:#a8700c;filter:none}
.sb-tl{grid-column:1/-1;display:flex;flex-direction:column;gap:5px}
.sb-tl p{display:flex;gap:7px;font:700 13.5px/1.3 var(--body);align-items:flex-start}
.sb-tl p i{flex:none;font:900 10.5px/1 var(--disp);letter-spacing:.05em;padding:3px 6px 2px;border-radius:6px;color:#fff;margin-top:1px;font-style:normal}
.sb-tl p .gd{background:var(--money2)}
.sb-tl p .fl{background:var(--tea)}
.sb-tl .ln{font:italic 700 13.5px/1.3 var(--body);color:var(--ink2);background:var(--cream);border-radius:10px;padding:6px 9px;border-left:4px solid var(--rc)}
.sb-cf{grid-column:1/-1;display:flex;align-items:center;gap:10px;border-top:2px dashed rgba(59,42,32,.25);padding-top:8px}
.sb-cf .cv{font:800 11.5px/1.1 var(--body);color:var(--ink2)}
.sb-cf .cv b{display:block;font:900 15px/1.1 var(--disp);color:var(--ink);white-space:nowrap}
.sb-cf .sb-btn{margin-left:auto;min-width:112px}
.sb-cand.hired::after{content:"İŞE ALINDI";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-12deg);border:4px solid var(--money2);color:var(--money2);font:900 26px/1 var(--disp);padding:6px 12px 3px;border-radius:12px;background:rgba(255,255,255,.85);animation:sb-stamp .3s cubic-bezier(.3,1.6,.5,1)}
@keyframes sb-stamp{0%{transform:translate(-50%,-50%) rotate(-12deg) scale(2);opacity:0}100%{transform:translate(-50%,-50%) rotate(-12deg) scale(1);opacity:1}}
.sb-jf{flex:1;font:800 11px/1.25 var(--body);color:var(--ink2)}
.sb-jf b{display:block;font:900 15px/1.1 var(--disp);color:var(--ink);font-variant-numeric:tabular-nums}

/* modals */
.sb-modal{position:absolute;inset:0;pointer-events:auto;z-index:60;display:flex;align-items:center;justify-content:center;padding:calc(var(--st) + 16px) calc(var(--sr) + 14px) calc(var(--sbm) + 16px) calc(var(--sl) + 14px);background:rgba(36,24,44,.55);overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;animation:sb-fade .2s ease-out}
.sb-modal.out{animation:sb-fadeout .2s ease-in forwards}
@keyframes sb-fade{0%{opacity:0}}
@keyframes sb-fadeout{100%{opacity:0}}
.sb-mcard{width:min(100%,400px);margin:auto;background:var(--paper);border:3px solid var(--ink);border-radius:26px;box-shadow:0 8px 0 var(--ink);padding:18px;display:flex;flex-direction:column;gap:12px;text-align:center;animation:sb-cardin .35s cubic-bezier(.3,1.5,.5,1);position:relative}
@keyframes sb-cardin{0%{transform:translateY(30px) scale(.9);opacity:0}100%{transform:none;opacity:1}}
.sb-mcard h2{font:900 24px/1 var(--disp)}
.sb-mcard p{font:700 13px/1.4 var(--body);color:var(--ink2)}
.sb-mrow{display:flex;gap:10px}
.sb-mrow .sb-btn{flex:1}
.sb-confirm{z-index:80}
.sb-confirm .sb-mcard{width:min(100%,340px)}
.sb-confirm .ci{width:60px;height:60px;margin:0 auto}
.sb-confirm .ci svg{width:60px;height:60px}

/* hand-made art: title and pick backdrop (fades in over the drawn scene), sticker icons */
.sb-art{position:absolute;inset:0;opacity:0;transition:opacity .9s ease;overflow:hidden;pointer-events:none}
.sb-art.on{opacity:1}
.sb-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:42% 50%;user-select:none;-webkit-user-select:none;-webkit-user-drag:none}
.sb-art::after{content:"";position:absolute;inset:0}
.sb-title .sb-art::after{background:radial-gradient(ellipse 95% 34% at 50% 22%,rgba(34,20,8,.5),rgba(34,20,8,0) 72%),linear-gradient(180deg,rgba(34,20,8,.34),rgba(34,20,8,0) 34%,rgba(34,20,8,0) 64%,rgba(34,20,8,.55))}
.sb-full.has-art .sb-scene{visibility:hidden;transition:visibility 0s .9s}
@media (orientation:portrait){.sb-title .sb-art img{animation:sb-pan 32s ease-in-out infinite alternate}}
@keyframes sb-pan{0%{object-position:30% 50%}100%{object-position:70% 50%}}
.sb-pickhero .sb-art img{filter:blur(5px) saturate(1.1);transform:scale(1.08)}
.sb-pickhero .sb-art::after{background:linear-gradient(180deg,rgba(34,20,8,.18),rgba(34,20,8,.38))}
.sb-aic image{image-rendering:auto}

/* scene (title, pick) */
.sb-full{position:absolute;inset:0;pointer-events:auto;z-index:70;overflow:hidden;background:#9fd3f5;animation:sb-fade .3s}
.sb-full.out{animation:sb-fadeout .35s ease-in forwards}
.sb-scene{position:absolute;inset:0;width:100%;height:100%}
.sb-scene .fer{animation:sb-ferry 26s linear infinite}
@keyframes sb-ferry{0%{transform:translateX(-200px)}100%{transform:translateX(560px)}}
.sb-scene .gl{animation:sb-glide 5s ease-in-out infinite}
.sb-scene .gl2{animation:sb-glide 6.5s ease-in-out -2s infinite}
@keyframes sb-glide{50%{transform:translate(14px,-10px)}}
.sb-scene .wv{animation:sb-wave 4s ease-in-out infinite}
@keyframes sb-wave{50%{transform:translateX(-14px)}}
.sb-tl-wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:calc(var(--st) + 7vh) calc(var(--sr) + 20px) calc(var(--sbm) + 9vh) calc(var(--sl) + 20px)}
.sb-logo{width:min(100%,360px);display:flex;flex-direction:column;align-items:stretch;transform:rotate(-2.5deg);animation:sb-logoin .7s cubic-bezier(.3,1.5,.5,1);filter:drop-shadow(0 8px 0 rgba(59,42,32,.45))}
@keyframes sb-logoin{0%{transform:translateY(-60px) rotate(-8deg);opacity:0}100%{transform:rotate(-2.5deg);opacity:1}}
.sb-pamuk{position:absolute;right:16%;top:-34px;width:78px;height:57px;z-index:3;transform:rotate(2deg);animation:sb-breath2 3s ease-in-out infinite;transform-origin:50% 100%}
.sb-pamuk svg{width:100%;height:100%}
@keyframes sb-breath2{50%{transform:rotate(2deg) scaleY(1.05)}}
.sb-logo{position:relative}
.sb-logo .sb-awn{height:34px;--acc:var(--red);-webkit-mask:linear-gradient(#000,#000) 0 0/100% 14px no-repeat,radial-gradient(circle at 18px 14px,#000 17.5px,transparent 18px) 0 0/36px 34px repeat-x;mask:linear-gradient(#000,#000) 0 0/100% 14px no-repeat,radial-gradient(circle at 18px 14px,#000 17.5px,transparent 18px) 0 0/36px 34px repeat-x;background:repeating-linear-gradient(90deg,var(--red) 0 36px,#fff6e6 36px 72px);margin:0 -8px -6px;position:relative;z-index:2}
.sb-signb{background:linear-gradient(180deg,#e8634a,var(--red) 60%,#c8452f);border:4px solid var(--ink);border-radius:22px;padding:18px 14px 16px;text-align:center;position:relative;outline:3px dotted #ffe08a;outline-offset:-11px}
.sb-signb .l1{display:block;font:italic 900 clamp(26px,8vw,36px)/1 var(--disp);color:#fff6e6;text-shadow:0 3px 0 rgba(59,42,32,.6);letter-spacing:.01em}
.sb-signb .l2{display:block;font:900 clamp(56px,18vw,84px)/.92 var(--disp);color:var(--yellow);text-shadow:0 5px 0 var(--ink),3px 0 0 var(--ink),-3px 0 0 var(--ink),0 -3px 0 var(--ink),3px 5px 0 var(--ink),-3px 5px 0 var(--ink);letter-spacing:.01em;margin-top:4px}
.sb-sub{margin-top:18px;display:inline-flex;align-items:center;gap:8px;background:var(--navy);color:#fff;border:3px solid var(--ink);border-radius:999px;padding:6px 16px 7px 8px;font:900 14px/1 var(--disp);letter-spacing:.03em;box-shadow:0 4px 0 var(--ink);transform:rotate(1.5deg)}
.sb-sub svg{width:30px;height:30px}
.sb-tl-top{display:flex;flex-direction:column;align-items:center;width:100%}
.sb-tl-bot{display:flex;flex-direction:column;align-items:center;gap:12px}
.sb-tl-bot .sb-btn.big{min-width:220px;animation:sb-breath 1.8s ease-in-out infinite}
.sb-tl-bot .sb-btn.big svg{width:30px;height:30px}
@keyframes sb-breath{50%{transform:scale(1.05)}}
.sb-tl-note{font:800 11px/1.3 var(--body);color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.5)}
.sb-pick{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:clamp(12px,5vw,36px);padding:calc(var(--st) + 20px) 16px calc(var(--sbm) + 20px)}
.sb-pc{position:relative;width:min(42vw,220px);aspect-ratio:3/4;border:4px solid var(--ink);border-radius:30px;background:var(--cream);box-shadow:0 8px 0 var(--ink);padding:0;cursor:pointer;overflow:hidden;transition:transform .25s,opacity .25s;animation:sb-pcin .5s cubic-bezier(.3,1.5,.5,1) both}
.sb-pc:nth-child(2){animation-delay:.12s}
@keyframes sb-pcin{0%{transform:translateY(40px) scale(.8);opacity:0}100%{transform:none;opacity:1}}
.sb-pc .sb-por{position:absolute;left:0;right:0;bottom:14%;width:100%!important;height:auto!important;aspect-ratio:1}
.sb-pc::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,#bfe6e9 0 62%,#fff6e6 62%)}
.sb-pc::after{content:"";position:absolute;left:0;right:0;bottom:0;height:14%;background:repeating-linear-gradient(90deg,var(--red) 0 16px,#fff6e6 16px 32px);border-top:3px solid var(--ink)}
.sb-pc:nth-child(2)::before{background:linear-gradient(180deg,#f9d9b8 0 62%,#fff6e6 62%)}
.sb-pc .bob{position:absolute;inset:0;animation:sb-bob2 2.4s ease-in-out infinite}
.sb-pc:nth-child(2) .bob{animation-delay:-1.2s}
@keyframes sb-bob2{50%{transform:translateY(-6px) rotate(1deg)}}
.sb-pc:active{transform:scale(.96)}
.sb-pc.sel{transform:scale(1.08);box-shadow:0 8px 0 var(--ink),0 0 0 8px var(--yellow)}
.sb-pc.dim{opacity:.25;transform:scale(.9)}
.sb-pick-hint{position:absolute;left:50%;top:calc(50% + min(28vw,147px) + 22px);width:64px;height:64px;margin-left:-32px;animation:sb-tap 1.6s ease-in-out infinite;pointer-events:none;filter:drop-shadow(0 4px 0 rgba(59,42,32,.35))}
.sb-pick-hint svg{width:100%;height:100%}
@keyframes sb-tap{0%,100%{transform:translate(-60px,0)}25%{transform:translate(-60px,-12px)}50%{transform:translate(60px,0)}75%{transform:translate(60px,-12px)}}

/* welcome back */
.sb-wb .art{height:120px;margin:-6px -6px 0;border-radius:18px;background:linear-gradient(180deg,#2e2a5a,#5a4f8f 70%,#e8b07a);position:relative;overflow:hidden;border:2.5px solid var(--ink)}
.sb-wb .art .sh{position:absolute;left:50%;bottom:0;width:170px;margin-left:-85px;height:86px;background:#fff6e6;border:3px solid var(--ink);border-bottom:0;border-radius:8px 8px 0 0;overflow:hidden}
.sb-wb .art .sh::before{content:"";position:absolute;left:12px;right:12px;bottom:0;height:56px;background:linear-gradient(#ffe8a0,#ffd23f);border:2.5px solid var(--ink);border-bottom:0}
.sb-wb .art .ka{position:absolute;left:12px;right:12px;top:28px;height:56px;background:repeating-linear-gradient(180deg,#bdb5aa 0 6px,#8d857b 6px 8px);border:2.5px solid var(--ink);animation:sb-kepenk 1.4s .3s cubic-bezier(.5,0,.3,1) forwards}
@keyframes sb-kepenk{100%{transform:translateY(-58px)}}
.sb-wb .art .aw{position:absolute;left:50%;top:14px;width:190px;margin-left:-95px;height:22px;background:repeating-linear-gradient(90deg,var(--red) 0 19px,#fff6e6 19px 38px);border:3px solid var(--ink);border-radius:6px;z-index:2}
.sb-wb .art .moon{position:absolute;right:18px;top:12px;width:30px;height:30px}
.sb-wb .art .cat{position:absolute;left:24px;bottom:4px;width:46px;height:46px}
.sb-wb .amt{display:flex;align-items:center;justify-content:center;gap:8px;font:900 35px/1 var(--disp);color:#226b3a;font-variant-numeric:tabular-nums}
.sb-wb .amt svg{width:44px;height:44px}
.sb-wb .sb-mrow .sb-btn{min-height:58px}

/* ad */
.sb-ad{z-index:90;background:#1d1a33;flex-direction:column;justify-content:center;gap:16px;text-align:center;color:#fff}
.sb-ad .at{position:absolute;left:calc(var(--sl) + 14px);top:calc(var(--st) + 14px);background:var(--yellow);color:var(--ink);border:2.5px solid var(--ink);border-radius:10px;padding:5px 10px 4px;font:900 12px/1 var(--disp);letter-spacing:.06em}
.sb-ad .ac{position:absolute;right:calc(var(--sr) + 14px);top:calc(var(--st) + 10px);width:52px;height:52px;border-radius:50%;display:grid;place-items:center;font:900 19px/1 var(--disp);color:#fff;background:conic-gradient(var(--yellow) calc(var(--p,0) * 1turn),rgba(255,255,255,.18) 0);padding:0;border:0}
.sb-ad .ac span{width:40px;height:40px;border-radius:50%;background:#1d1a33;display:grid;place-items:center}
.sb-ad .ac.done{background:var(--cream);cursor:pointer}
.sb-ad .ac.done span{background:var(--cream)}
.sb-ad .ac svg{width:22px;height:22px}
.sb-ad .stage{width:min(86vw,340px);aspect-ratio:1;border-radius:30px;display:grid;place-items:center;position:relative;overflow:hidden;border:3px solid rgba(255,255,255,.25);margin:0 auto}
.sb-ad .stage svg{width:62%;height:62%;animation:sb-adbob 1.4s ease-in-out infinite;filter:drop-shadow(0 10px 0 rgba(0,0,0,.25))}
@keyframes sb-adbob{50%{transform:translateY(-12px) rotate(4deg)}}
.sb-ad .stage i{position:absolute;bottom:-20px;width:14px;height:14px;border-radius:50%;background:rgba(255,255,255,.55);animation:sb-bub 2.4s linear infinite}
@keyframes sb-bub{100%{transform:translateY(-360px);opacity:0}}
.sb-ad .brand{font:900 clamp(32px,10vw,44px)/1 var(--disp);letter-spacing:.01em;text-shadow:0 4px 0 rgba(0,0,0,.35)}
.sb-ad .slogan{font:800 16px/1.3 var(--body);opacity:.92}
.sb-ad .fine{position:absolute;left:0;right:0;bottom:calc(var(--sbm) + 16px);font:700 11px/1.3 var(--body);opacity:.65}
.sb-ad .sb-btn{margin:0 auto}

/* kasa sayımı */
.sb-kasa{z-index:75;background:radial-gradient(ellipse at 50% 42%,#5a4f8f 0,#2e2a5a 55%,#1b1838 100%);flex-direction:column;justify-content:center;gap:10px;color:#fff;text-align:center;padding-top:calc(var(--st) + 64px)}
.sb-kasa .rays{position:absolute;left:50%;top:44%;width:900px;height:900px;margin:-450px;background:repeating-conic-gradient(rgba(255,210,63,.13) 0 10deg,transparent 10deg 20deg);border-radius:50%;animation:sb-rot 18s linear infinite;pointer-events:none;-webkit-mask:radial-gradient(circle,#000 0,transparent 65%);mask:radial-gradient(circle,#000 0,transparent 65%)}
@keyframes sb-rot{100%{transform:rotate(360deg)}}
.sb-kasa .skip{position:absolute;right:calc(var(--sr) + 14px);top:calc(var(--st) + 12px);background:rgba(255,255,255,.14);border:2.5px solid rgba(255,255,255,.55);color:#fff;border-radius:999px;min-height:44px;padding:0 14px 0 16px;display:flex;align-items:center;gap:6px;font:900 14px/1 var(--disp);cursor:pointer}
.sb-kasa .skip svg{width:18px;height:18px}
.sb-kasa .skip svg path{fill:#fff}
.sb-kasa .kh small{display:inline-block;background:var(--yellow);color:var(--ink);border:2.5px solid var(--ink);border-radius:9px;padding:4px 10px 3px;font:900 11px/1 var(--disp);letter-spacing:.08em}
.sb-kasa .kh h2{font:900 clamp(34px,10vw,46px)/1 var(--disp);margin-top:8px;text-shadow:0 4px 0 rgba(0,0,0,.35)}
.sb-kasa .kc{display:inline-flex;flex-direction:column;align-items:center;gap:2px;margin:6px auto 0;background:var(--paper);color:var(--ink);border:3px solid var(--ink);border-radius:18px;padding:8px 22px 9px;box-shadow:0 5px 0 rgba(0,0,0,.4);min-width:220px}
.sb-kasa .kc span{font:800 12.5px/1 var(--body);color:var(--ink2);letter-spacing:.04em}
.sb-kasa .kc b{font:900 31px/1.05 var(--disp);color:#226b3a;font-variant-numeric:tabular-nums}
.sb-kasa .kn{font:800 11px/1 var(--body);opacity:.8;margin-top:4px}
.sb-kasa .stack{position:relative;width:250px;height:200px;margin:8px auto 0;touch-action:none;cursor:grab}
.sb-note{position:absolute;left:50%;top:50%;width:230px;height:108px;margin:-54px 0 0 -115px;border-radius:12px;border:3px solid var(--ink);background:linear-gradient(135deg,#a8e0c0,#6cc79a);box-shadow:0 3px 0 rgba(0,0,0,.35);overflow:hidden;color:#1f4d36;pointer-events:none}
.sb-note::before{content:"";position:absolute;inset:7px;border:2px dashed rgba(31,77,54,.45);border-radius:7px}
.sb-note .nv{position:absolute;right:14px;top:10px;font:900 26px/1 var(--disp)}
.sb-note .nm{position:absolute;left:14px;bottom:12px;font:900 11px/1 var(--disp);letter-spacing:.14em}
.sb-note .ne{position:absolute;left:16px;top:14px;width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,.45);border:2px solid rgba(31,77,54,.5);display:grid;place-items:center}
.sb-note .ne svg{width:40px;height:40px}
.sb-note .nl{position:absolute;right:16px;bottom:8px;width:34px;height:34px;opacity:.7}
.sb-note.b{background:linear-gradient(135deg,#b6d8f2,#7fb4e0);color:#1d4466}
.sb-note.c{background:linear-gradient(135deg,#f6cfa9,#eaa36a);color:#6b3b14}
.sb-kasa .hint{display:flex;align-items:center;justify-content:center;gap:8px;font:900 14px/1 var(--disp);opacity:.95}
.sb-kasa .hint svg{width:34px;height:34px;animation:sb-swipe 1.3s ease-in-out infinite}
@keyframes sb-swipe{0%{transform:translateY(8px)}60%{transform:translateY(-12px)}100%{transform:translateY(8px)}}
.sb-kasa .bonus{display:inline-flex;align-items:center;gap:8px;margin:0 auto;background:var(--money);color:#fff;border:3px solid var(--ink);border-radius:16px;padding:8px 16px;font:900 19px/1 var(--disp);box-shadow:0 5px 0 rgba(0,0,0,.4);animation:sb-pop .45s cubic-bezier(.3,1.8,.5,1);text-shadow:0 2px 0 rgba(0,0,0,.25)}
.sb-kasa .bonus svg{width:30px;height:30px}
.sb-kasa .tro{display:flex;flex-direction:column;align-items:center;gap:8px;animation:sb-cardin .6s cubic-bezier(.3,1.6,.5,1)}
.sb-kasa .tro svg{width:150px;height:150px;filter:drop-shadow(0 8px 0 rgba(0,0,0,.35))}
.sb-kasa .tro small{font:900 11px/1 var(--disp);letter-spacing:.1em;color:var(--yellow)}
.sb-kasa .tro h3{font:900 24px/1.05 var(--disp)}
.sb-kasa .tro .sb-btn{margin-top:8px}

/* sign editor */
.sb-sign{text-align:left}
.sb-sign h2{text-align:center}
.sb-sprev{position:relative;border-radius:18px;padding:0 0 14px;background:linear-gradient(180deg,#9fd3f5,#cfeaf7);border:2.5px solid var(--ink);overflow:hidden;transition:background .3s}
.sb-sprev.night{background:linear-gradient(180deg,#1d1a33,#2e2a5a)}
.sb-sprev .sb-awn{--acc:var(--red);height:20px}
.sb-sprev .bd{margin:6px 12px 0;background:linear-gradient(180deg,#56402f,#3b2a20);border:3px solid var(--ink);border-radius:12px;height:76px;display:flex;align-items:center;justify-content:center;padding:0 10px;overflow:hidden;transition:background .3s;box-shadow:inset 0 2px 0 rgba(255,255,255,.12)}
.sb-sprev.night .bd{background:#1a1730}
.sb-sprev .tx{display:inline-block;white-space:nowrap;color:var(--sc,#fff6e6);font-size:34px;line-height:1.08;padding:0 .08em;text-shadow:0 3px 0 rgba(0,0,0,.45);transition:color .3s,text-shadow .3s}
.sb-sprev.night .tx{color:#fff;text-shadow:0 0 3px var(--sc,#ff5fa2),0 0 10px var(--sc,#ff5fa2),0 0 22px var(--sc,#ff5fa2)}
/* six sign styles: each one reads differently even when the named font is missing on the phone */
.sb-sign .f-yesil{transform:skewX(-7deg)}
.sb-sprev .tx.f-yesil{text-shadow:2px 2px 0 var(--red),4px 4px 0 rgba(0,0,0,.4)}
.sb-sign .f-vapur,.sb-sign .f-uzay{text-transform:uppercase}
.sb-sign .f-vapur{letter-spacing:.08em;color:transparent!important;background:linear-gradient(180deg,var(--sc,var(--ink)) 0 46%,transparent 46% 58%,var(--sc,var(--ink)) 58%);-webkit-background-clip:text;background-clip:text;text-shadow:none!important;filter:drop-shadow(0 2px 0 rgba(0,0,0,.35))}
.sb-sprev.night .tx.f-vapur{background-image:linear-gradient(180deg,#fff 0 46%,transparent 46% 58%,#fff 58%);filter:drop-shadow(0 0 4px var(--sc)) drop-shadow(0 0 10px var(--sc))}
.sb-sprev .tx.f-neon{color:#fff;letter-spacing:.04em;text-shadow:0 0 2px var(--sc),0 0 8px var(--sc),0 0 16px var(--sc)}
.sb-sign .f-lale::before,.sb-sign .f-lale::after{content:"";display:inline-block;width:.24em;height:.24em;background:currentColor;transform:rotate(45deg);margin:0 .24em;vertical-align:.22em;border-radius:1px}
.sb-sign .f-plaza{letter-spacing:.02em}
.sb-sprev .tx.f-plaza{text-shadow:none}
.sb-sign .f-uzay{letter-spacing:.12em}
.sb-sprev .tx.f-uzay{text-shadow:2px 0 0 rgba(255,95,162,.55),-2px 0 0 rgba(255,255,255,.35)}
.sb-sprev.night .tx.f-uzay{text-shadow:0 0 3px var(--sc),0 0 10px var(--sc),0 0 22px var(--sc)}
.sb-fonts .fa{display:inline-block;color:var(--ink)}
.sb-fonts .fa.f-yesil{color:var(--red);text-shadow:1.5px 1.5px 0 var(--yellow)}
.sb-fonts .fa.f-neon{color:#e0457f;text-shadow:0 0 6px rgba(255,95,162,.75)}
.sb-fonts .fa.f-lale{color:#c2416b}
.sb-fonts .fa.f-plaza{color:var(--ink2)}
.sb-fonts .fa.f-uzay{color:#1f8f86}
.sb-srow{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:-4px}
.sb-sign label{font:900 12px/1 var(--disp);color:var(--ink2)}
.sb-nt{min-height:44px;display:inline-flex;align-items:center;gap:6px;padding:0 13px 0 8px;border:2.5px solid var(--ink);border-radius:22px;background:var(--cream);font:800 11px/1 var(--body);color:var(--ink);cursor:pointer;pointer-events:auto;box-shadow:0 3px 0 var(--ink)}
.sb-nt svg{width:24px;height:24px}
.sb-nt.on{background:#2e2a5a;color:#fff}
.sb-nt:active{transform:translateY(2px);box-shadow:0 1px 0 var(--ink)}
.sb-sin{position:relative}
.sb-sin .cnt{position:absolute;right:12px;top:50%;transform:translateY(-50%);font:800 11px/1 var(--body);color:var(--ink2);pointer-events:none}
.sb-sign input{padding-right:58px!important}
.sb-sign input{width:100%;min-height:50px;border:2.5px solid var(--ink);border-radius:14px;padding:8px 12px;font:800 17px/1.2 var(--body);color:var(--ink);background:#fff;user-select:text;-webkit-user-select:text;pointer-events:auto;touch-action:manipulation;outline:none}
.sb-sign input:focus{box-shadow:0 0 0 4px rgba(90,169,214,.45)}
.sb-fonts{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.sb-fonts button{min-height:52px;border:2.5px solid var(--ink);border-radius:14px;background:#fff;cursor:pointer;padding:4px 6px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;pointer-events:auto}
.sb-fonts button .fa{font-size:22px;line-height:1.05}
.sb-fonts button small{font:800 11px/1.1 var(--body);color:var(--ink2)}
.sb-fonts button.on{background:var(--yellow);box-shadow:0 3px 0 var(--ink)}
.sb-smsg{min-height:20px;font:800 13.5px/1.3 var(--body);text-align:center;color:var(--ink2)}
.sb-smsg.bad{color:var(--warn)}

/* landscape phones */
@media (orientation:landscape) and (max-height:540px){
  .sb-hud{padding-top:calc(var(--st) + 6px)}
  .sb-hmid{flex-direction:row;align-items:center;gap:6px}
  .sb-lvl{width:52px;height:52px}.sb-lvl-in{width:38px;height:38px;font-size:18px}
  .sb-hbtns{flex-direction:row}
  .sb-ib{width:44px;height:44px}
  .sb-streak{left:calc(var(--sl) + 70px);top:calc(100% + 4px)}
  .sb-sheet{left:auto;right:calc(var(--sr) + 8px);top:calc(var(--hudb) + 6px);bottom:calc(var(--sbm) + 8px);height:auto;max-height:none;width:min(480px,58vw);margin:0;border-radius:20px}
  .sb-shh{padding:0 8px 6px 10px;gap:8px}.sb-shh .hi{width:34px;height:34px;border-radius:11px}.sb-shh .hi svg{width:24px;height:24px}
  .sb-shh h2{font-size:19px}.sb-shh h2 small{display:none}
  .sb-shb{padding:10px 10px 14px}.sb-sheet.jb .sb-shb{padding-top:12px;gap:12px}
  .sb-shf{padding:6px 10px}
  .sb-bar{left:calc(var(--sl) + 8px);right:auto;max-width:calc(42vw - 16px);padding:4px}
  .sb-bi{height:48px;max-width:56px;min-width:44px}
  .sb-bi span{display:none}
  .sb-bi svg{width:30px;height:30px}
  .sb-badge{left:calc(50% + 4px)}
  .sb-sol{left:calc(var(--sl) + 12px);transform:none;bottom:calc(var(--sbm) + var(--barh) + 16px);animation:none}
  .sb-tl-wrap{flex-direction:row;justify-content:space-around;align-items:center;padding:calc(var(--st) + 14px) calc(var(--sr) + 24px) calc(var(--sbm) + 14px) calc(var(--sl) + 24px)}
  .sb-logo{width:min(46vw,340px)}
  .sb-signb .l2{font-size:clamp(44px,9vw,66px)}
  .sb-sub{margin-top:12px}
  .sb-pc{width:min(26vw,190px)}
  .sb-pick-hint{display:none}
  .sb-title .sb-art::after{background:radial-gradient(ellipse 48% 75% at 27% 50%,rgba(34,20,8,.5),rgba(34,20,8,0) 75%),linear-gradient(180deg,rgba(34,20,8,.2),rgba(34,20,8,0) 40%,rgba(34,20,8,0) 70%,rgba(34,20,8,.4))}
  .sb-art img{object-position:50% 60%}
  .sb-kasa{padding-top:calc(var(--st) + 12px);display:grid;grid-template-columns:1fr 1fr;align-content:center;align-items:center;column-gap:10px}
  .sb-kasa .rays{top:50%}
  .sb-kasa .kh,.sb-kasa .kc,.sb-kasa .kn,.sb-kasa .hint,.sb-kasa .bonus{grid-column:1}
  .sb-kasa .stack,.sb-kasa .tro{grid-column:2;grid-row:1/span 5}
  .sb-kasa .kh h2{font-size:34px}
  .sb-ad .stage{width:min(40vh,240px)}
  .sb-mcard{padding:14px;gap:9px}
  .sb-wb .art{height:90px}
  .sb-dayc{top:calc(var(--hudb) + 8px)}
  .sb-toasts{top:calc(var(--hudb) + 8px)}
  .sb-ach{top:calc(var(--hudb) + 6px)}
}
@media (max-width:370px){
  .sb-pill{font-size:18px;height:36px;padding-right:10px}
  .sb-pill svg{width:28px;height:28px}
  .sb-day{font-size:13px;height:30px;padding-right:8px;gap:4px;letter-spacing:-.01em}
  .sb-day b{letter-spacing:0}
  .sb-day svg{width:22px;height:22px}
  .sb-stars{padding:0 5px}.sb-stars svg{width:14px;height:14px}
  .sb-hl{gap:5px}
  .sb-lvl{width:56px;height:56px}.sb-lvl-in{width:41px;height:41px}
  .sb-cand .cb{grid-template-columns:64px 1fr}
  .sb-bi{font-size:10px;letter-spacing:-.02em}
  .sb-dgrid,.sb-agrid,.sb-cgrid{grid-template-columns:repeat(auto-fill,minmax(140px,1fr))}
}
@media (prefers-reduced-motion:reduce){
  #sbui *,#sbui *::before,#sbui *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
}

/* survey: always-on HUD = money, day/time, weather only */
.sb-stars,.sb-streak{display:none!important}
`;

/* ---------- root and layers ---------- */
let root = null, L = {};
let hudState = {}, hudShown = false;
