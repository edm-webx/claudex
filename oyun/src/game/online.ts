/**
 * Online ilk deneme (2026-10-24 açık dünya anketi: online ilk sürümde; başka oyuncuları görmek, selamlaşmak, sohbet).
 * Transport (13:05 user: "kahoot gibi, koda özel girilsin"): Supabase Realtime channels (net/supa.ts) wherever the
 * page can reach supabase.co (itch.io, own site); inside claude.ai the artifact `room` capability as a fallback.
 * Rooms: "Genel meydan" (everyone) or a private room with a 6-letter code (Oda kur / Odaya katıl).
 * Decisions:
 * - Presence only (no event topics): Viewers may set presence but not send on topics, so chat rides in presence too
 *   as `say: { t, text }`. Presence is ~4 KiB max; we send a few hundred bytes, at most ~8 times a second, on change.
 * - Every other open document is drawn as a full hero rig (the same esnaf look builder as the own hero) with a name
 *   tag and speech bubbles; positions are smoothed. Players further than 70 m are hidden (the world is one strip).
 * - Chat text is filtered (survey: "serbest yazı, filtreli"): a small Turkish/English swear list becomes ***.
 * - Names travel as typed nicknames in presence (display data, untrusted), set with textContent only.
 */
import { hesap } from './net/supa';
import { susturuldu, benSusturuldum } from './net/admin';
import { logYaz } from './net/log';
import type { Object3D, Scene } from 'three';
import type { Chars, HeroHandle, Vec2, Vec3, ScreenPt } from '../engine/api';
import { esnafHeroOpts, SINIFLAR, type EsnafimSave } from './sim/esnafim';
import { supa, supaReady } from './net/supa';

type Json = unknown;
interface Peer { peer: string; isMe: boolean; sameTab: boolean; kind: string; presence: Readonly<Record<string, Json>>; updatedAt: number }
interface RoomNs {
  presence(p: Record<string, Json | null>): Promise<void>;
  onPeers(h: (c: { peers: readonly Peer[] }) => void, e?: (x: { code: string }) => void): () => void;
  join?(name: string): RoomNs;
  leave?(): void;
}
/** One room on either backend: send my state, hear everyone else's (already without me). */
interface Link {
  send(msg: Record<string, Json>): void; leave(): void; id?: string;
  /** room-wide events beside the per-player state (Supabase only: the shared büfe world) */
  emit?(ev: string, payload: Record<string, Json>): void; on?(ev: string, fn: (payload: Record<string, Json>) => void): void;
}
type PeersCb = (peers: { peer: string; presence: Record<string, Json> }[]) => void;

function artifactLink(ns: RoomNs, name: string, cb: PeersCb, onErr: () => void): Link {
  const r = name !== 'sunucu-1' && ns.join ? ns.join(name) : ns;
  const off = r.onPeers(c => cb(c.peers.filter(p => !p.sameTab && p.kind === 'viewer' && p.presence && typeof p.presence.x === 'number').map(p => ({ peer: p.peer, presence: p.presence as Record<string, Json> }))), onErr);
  return { send: m => { r.presence(m).catch(() => { /* dropped */ }); }, leave: () => { try { off(); } catch { /* */ } if (r !== ns) try { r.leave?.(); } catch { /* */ } } };
}
function supaLink(name: string, cb: PeersCb, onErr: () => void, onOk: () => void): Link | null {
  const c = supa(); if (!c) return null;
  const me = Math.random().toString(36).slice(2, 10);
  const peers = new Map<string, { presence: Record<string, Json>; at: number }>();
  const ch = c.channel(name, { config: { broadcast: { self: false } } });
  const emit = () => { const now = Date.now(); for (const [k, p] of peers) if (now - p.at > 8000) peers.delete(k); cb([...peers].map(([peer, p]) => ({ peer, presence: p.presence }))); };
  ch.on('broadcast', { event: 'p' }, ({ payload }) => {
    const pl = payload as { id?: string; m?: Record<string, Json>; bye?: boolean };
    if (!pl || typeof pl.id !== 'string' || pl.id === me) return;
    if (pl.bye) peers.delete(pl.id); else if (pl.m && typeof pl.m.x === 'number') peers.set(pl.id, { presence: pl.m, at: Date.now() });
    emit();
  });
  const handlers = new Map<string, (p: Record<string, Json>) => void>();
  for (const ev of ['dunya', 'iste', 'kasa', 'para', 'pm']) ch.on('broadcast', { event: ev }, ({ payload }) => { const pl = payload as Record<string, Json>; if (pl && pl.id !== me) handlers.get(ev)?.(pl); });
  let last: Record<string, Json> | null = null, lastAt = 0, ok = false;
  ch.subscribe(st => { if (st === 'SUBSCRIBED') { ok = true; onOk(); handlers.get('_ok')?.({}); if (last) void ch.send({ type: 'broadcast', event: 'p', payload: { id: me, m: last } }); } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') { if (!ok) onErr(); } });
  const beat = setInterval(() => { emit(); if (ok && last && Date.now() - lastAt > 2500) { lastAt = Date.now(); void ch.send({ type: 'broadcast', event: 'p', payload: { id: me, m: last } }); } }, 1000);
  return {
    id: me,
    emit: (ev, payload) => { if (ok) void ch.send({ type: 'broadcast', event: ev, payload: { ...payload, id: me } }); },
    on: (ev, fn) => { handlers.set(ev, fn); },
    send: m => { last = m; if (!ok) return; lastAt = Date.now(); void ch.send({ type: 'broadcast', event: 'p', payload: { id: me, m } }); },
    leave: () => { clearInterval(beat); try { void ch.send({ type: 'broadcast', event: 'p', payload: { id: me, bye: true } }); } catch { /* */ } setTimeout(() => { void c.removeChannel(ch); }, 200); },
  };
}
const CODE_ABC = 'ABCDEFGHJKLMNPRSTUVYZ23456789';
export const yeniKod = () => Array.from({ length: 6 }, () => CODE_ABC[Math.floor(Math.random() * CODE_ABC.length)]).join('');
export const kodTemiz = (s: string) => s.toLocaleUpperCase('en').replace(/[^A-Z0-9]/g, '').slice(0, 6);
export interface OnlineView { update(dt: number): void; peers(): { peer: string; uid: string; hn: string; ad: string; x: number; z: number }[] }
export interface OnlineDeps {
  scene: Scene; chars: Chars | null; root: HTMLElement;
  project(p: Vec3, out: ScreenPt): boolean;
  me(): { pos: Vec2; rot: number; speed: number; esnaf: EsnafimSave; region: string; act?: string };
  /** Kahoot-like shared world: the room's host sends its büfe, guests play inside it until they leave */
  world?: { get(): string; sig(): string; apply(json: string, host: string): void; leave(): void; earned(): number; addKasa(n: number, from: string): void; money(): number; setMoney(n: number): void };
  toast(text: string): void;
}

const BAD = ['amk', 'aq', 'orospu', 'piç', 'pic', 'siktir', 'sik', 'yarrak', 'göt', 'got', 'ibne', 'pezevenk', 'kahpe', 'fuck', 'shit', 'bitch', 'mal'];
const badRe = new RegExp('(^|[^a-zçğıöşü])(' + BAD.join('|') + ')(?=$|[^a-zçğıöşü])', 'giu');
export const filterChat = (s: string) => s.replace(/[\u0000-\u001f<>]/g, '').slice(0, 120).replace(badRe, (_m, a: string, w: string) => a + '*'.repeat(w.length));

const CSS = `
.on-pill{position:absolute;left:50%;top:10px;transform:translateX(-50%);z-index:40;min-width:230px;text-align:center;white-space:nowrap;box-sizing:border-box;background:#fff6e6;border:3px solid #3b2a20;border-radius:999px;padding:3px 12px;font:900 14px/1.3 var(--disp);color:#3b2a20;box-shadow:0 3px 0 #3b2a20;pointer-events:none}
.on-chat{position:absolute;left:10px;bottom:96px;width:min(320px,calc(100vw - 20px));z-index:40;font-family:var(--body);pointer-events:auto}
.on-log{height:170px;overflow-y:auto;display:flex;flex-direction:column;gap:3px;margin-bottom:6px;padding:6px;background:rgba(40,22,18,.55);border-radius:12px;overscroll-behavior:contain}
.on-chat.min .on-log{display:none}
.on-log div{align-self:flex-start;background:rgba(253,243,225,.95);border:2px solid #3b2a20;border-radius:12px;padding:2px 9px;font:700 14px/1.3 var(--body);color:#3b2a20;max-width:100%;word-wrap:break-word;flex:none}
.on-log div.pm{background:#ffd6ea}.on-log div.sys{background:#e8f4ff}
.on-log b{font-weight:900;cursor:pointer}.on-log i{font-style:normal;font-size:11px;opacity:.6;margin-right:4px}
.on-top{display:flex;gap:6px;align-items:center;margin-bottom:4px}
.on-top button{min-height:30px;border:2px solid #3b2a20;border-radius:10px;background:#fff6e6;font:900 13px var(--disp);color:#3b2a20;cursor:pointer;padding:0 10px}
.on-pmto{display:none;align-items:center;gap:4px;background:#ffd6ea;border:2px solid #3b2a20;border-radius:10px;padding:0 8px;font:900 13px var(--disp);color:#3b2a20;min-height:30px}
.on-pmto.on{display:flex}
.on-row{display:flex;gap:6px}
.on-in{flex:1;min-height:42px;border:3px solid #3b2a20;border-radius:12px;padding:4px 10px;font:800 15px var(--body);background:#fff;color:#3b2a20}
.on-send{min-width:58px;border:3px solid #3b2a20;border-radius:12px;background:#ffd23f;font:900 15px var(--disp);color:#3b2a20;box-shadow:0 3px 0 #3b2a20;cursor:pointer}
.on-tag{position:absolute;z-index:30;transform:translate(-50%,-100%);pointer-events:none;text-align:center;white-space:nowrap}
.on-tag .n{display:inline-block;background:#3b2a20;color:#fff6e6;border-radius:999px;padding:1px 9px;font:900 13px/1.4 var(--disp)}
.on-tag .d{display:block;font:800 11px/1.2 var(--body);color:#fff6e6;text-shadow:0 1px 2px #000}
.on-tag .s{display:block;margin:0 auto 4px;max-width:220px;white-space:normal;background:#fff;border:2px solid #3b2a20;border-radius:12px;padding:3px 9px;font:800 14px/1.25 var(--body);color:#3b2a20}
.on-oda{position:absolute;left:50%;top:44px;transform:translateX(-50%);z-index:41;min-width:230px;white-space:nowrap;min-height:40px;padding:2px 14px;border-radius:999px;border:3px solid #3b2a20;background:#ffd23f;box-shadow:0 3px 0 #3b2a20;font:900 14px var(--disp);color:#3b2a20;cursor:pointer;pointer-events:auto}
.on-bg{position:fixed;inset:0;pointer-events:auto;z-index:72;display:flex;align-items:center;justify-content:center;background:rgba(40,22,18,.6);padding:16px;font-family:var(--body)}
.on-card{width:min(380px,100%);background:#fdf3e1;color:#3b2a20;border:4px solid #3b2a20;border-radius:22px;box-shadow:0 8px 0 #3b2a20;padding:16px}
.on-card h3{font:900 24px/1.1 var(--disp);margin:0 0 4px;text-align:center}.on-card p{font:700 14px/1.35 var(--body);opacity:.78;margin:4px 0 10px;text-align:center}
.on-big{font:900 44px/1 var(--disp);letter-spacing:6px;text-align:center;background:#fff;border:4px dashed #3b2a20;border-radius:16px;padding:10px 4px;margin:8px 0}
.on-b{width:100%;min-height:52px;margin-top:8px;border-radius:14px;border:4px solid #3b2a20;background:#fff6e6;box-shadow:0 4px 0 #3b2a20;font:900 18px var(--disp);color:#3b2a20;cursor:pointer}
.on-b.g{background:#8fd06b}.on-b.y{background:#ffd23f}
.on-code{width:100%;box-sizing:border-box;min-height:56px;border:4px solid #3b2a20;border-radius:14px;text-align:center;font:900 30px var(--disp);letter-spacing:5px;text-transform:uppercase;background:#fff;color:#3b2a20}
.on-srv{display:grid;grid-template-columns:1fr 1fr;gap:6px}.on-s{min-height:42px;border:3px solid #3b2a20;border-radius:12px;background:#fff6e6;font:900 15px var(--disp);color:#3b2a20;cursor:pointer;text-align:left;padding:2px 8px;display:flex;align-items:center;gap:6px}.on-s.on{background:#ffd23f}.on-s i{width:14px;height:14px;border-radius:50%;border:2px solid #3b2a20;flex:none}
.on-card{max-height:calc(100vh - 32px);overflow:auto}
.on-err{min-height:18px;color:#b3261e;font:800 13px var(--body);text-align:center;margin-top:6px}
`;

interface Remote { peer: string; hero: HeroHandle | null; lookKey: string; x: number; z: number; rot: number; tx: number; tz: number; trot: number; speed: number; act: string; tag: HTMLDivElement; sayT: number; sayAt: number; seen: number; uid: string; hn: string; ad: string }

/** what other players need to draw my esnaf (kept small: presence is ~4 KiB on claude.ai) */
const LOOK_KEYS: (keyof EsnafimSave)[] = ['ad', 'sinif', 'tip', 'vucut', 'boy', 'ten', 'goz', 'gozRenk', 'kas', 'allik', 'cil', 'gamze', 'ruj', 'sac', 'sacRenk', 'biyik', 'sakal',
  'ustStil', 'ust', 'aksan', 'desen', 'altStil', 'alt', 'ayakkabi', 'onluk', 'sapka', 'sapkaRenk', 'gozluk', 'papyon', 'kravat', 'kupe', 'sakalStil', 'ifade', 'gozAra', 'gozY', 'burun', 'agiz', 'kulak'];

export function createOnline(d: OnlineDeps): OnlineView {
  let ns: RoomNs | null = null, link: Link | null = null, via: 'supa' | 'room' | '' = '', code = '';
  const remotes = new Map<string, Remote>();
  let sendT = 0, lastSent = '', pill: HTMLDivElement | null = null, chat: HTMLDivElement | null = null, log: HTMLDivElement | null = null, odaBtn: HTMLButtonElement | null = null;
  const st = document.createElement('style'); st.textContent = CSS;
  const tmp: ScreenPt = { x: 0, y: 0 };
  let mySay: { t: number; text: string } | null = null;
  // declared before the first connect() below: v38 had them after it and the whole online module died (TDZ), so chat never sent
  let pmTo: { peer: string; ad: string } | null = null;
  const hist: { who: string; text: string; kind: string; peer: string; t: number }[] = [];
  let hostMissing = 0;
  let retryT = 20, host = false, guestOf = '', guestSig = '', worldT = 0, worldWant = false, worldSig = '', kasaBase = -1, askT = 3, sheetT = 0;
  try { const q = new URLSearchParams(location.search).get('oda'); if (q) code = kodTemiz(q); } catch { /* */ }

  const w = window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } };
  // 17:24 user: "sohbet çalışmıyor". window.claude can appear after this module runs: wait for it (10 s) instead of
  // deciding "no room" at once, so the claude.ai room fallback really comes up when Supabase is blocked.
  const roomP: Promise<RoomNs | null> = new Promise(res => {
    let n = 0;
    const tryUse = () => {
      if (w.claude && typeof w.claude.use === 'function') { w.claude.use('room').then(r => res((r as RoomNs) || null)).catch(() => res(null)); return; }
      if (++n > 40) { res(null); return; }
      setTimeout(tryUse, 250);
    };
    tryUse();
  });
  void roomP.then(r => { ns = r; if (!link && r) connect(code); });
  if (supaReady()) connect(code);

  function connect(c: string, asHost = false) {
    if (link) { link.leave(); link = null; }
    if (guestOf) { guestOf = ''; guestSig = ''; try { d.world?.leave(); } catch { /* */ } }
    host = !!c && asHost; worldSig = ''; worldWant = host;
    for (const rm of remotes.values()) drop(rm); remotes.clear();
    code = c; lastSent = '';
    // 2026-11-09 user: no public servers, every game is the player's own; a friend joins with the game code
    if (!c) { via = ''; ui(); setPill('⚪ Tek başına · kodla arkadaşını çağır'); return; }
    const useRoom = () => { if (!ns) { setPill('⚪ Çevrimdışı'); return; } via = 'room'; link = artifactLink(ns, chan(), sync, () => setPill('⚪ Çevrimdışı')); ui(); };
    if (supaReady()) {
      via = 'supa';
      link = supaLink(chan(), sync, () => { if (via === 'supa') { link?.leave(); link = null; useRoom(); } }, () => ui());
      if (link) { wireWorld(link); ui(); return; }
    }
    useRoom();
  }
  function chan() { return 'oda-' + code; }
  function wireWorld(l: Link) {
    if (!d.world || !l.on) return;
    l.on('iste', () => { if (host) worldWant = true; });
    l.on('pm', pl => { if (pl.to !== l.id || typeof pl.text !== 'string') return; const ad = String(pl.ad || 'Esnaf').slice(0, 14); addLog('🔒 ' + ad + ' → sen', filterChat(pl.text), 'pm', String(pl.id || '')); d.toast('🔒 ' + ad + ' sana yazdı'); });
    l.on('para', pl => { const n = Number(pl.n); if (!host && guestOf && Number.isFinite(n) && n >= 0) { d.world!.setMoney(n); } });
    l.on('kasa', pl => { const n = Number(pl.n); if (host && n > 0 && n < 1e7) d.world!.addKasa(Math.floor(n), String(pl.ad || 'Bir esnaf').slice(0, 14)); });
    l.on('_ok', () => { if (!host && code) l.emit?.('iste', {}); });
    l.on('dunya', pl => {
      if (host || !code || typeof pl.w !== 'string' || typeof pl.sig !== 'string') return;
      const ad = String(pl.ad || 'Ev sahibi').slice(0, 14);
      if (pl.sig === guestSig) return;
      const first = !guestOf;
      guestSig = pl.sig; guestOf = ad;
      try { d.world!.apply(pl.w, ad); kasaBase = d.world!.earned(); } catch { /* bad world: keep own */ }
      if (first) { d.toast('Ev sahibi ' + ad + '. Onun büfesindesin, beraber çalışın!'); addLog('Martıköy', 'Ev sahibi ' + ad + '. Sattıkların onun kasasına gider. Odadan çıkınca kendi dükkanına dönersin.'); }
      ui();
    });
  }
  function setPill(t: string) { if (pill) pill.textContent = t; }
  function addLog(who: string, text: string, kind = '', peer = '') {
    hist.push({ who, text, kind, peer, t: Date.now() }); if (hist.length > 150) hist.shift();
    if (!log) return;
    const stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 30;
    const el = document.createElement('div'); if (kind) el.className = kind;
    const tm = document.createElement('i'); const dt = new Date(); tm.textContent = String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
    const b = document.createElement('b'); b.textContent = who + ': '; if (peer) { b.dataset.peer = peer; b.dataset.ad = who.replace(/^🔒 /, '').replace(/ → sen$/, ''); b.title = 'Özel mesaj at'; }
    el.appendChild(tm); el.appendChild(b); el.appendChild(document.createTextNode(text));
    log.appendChild(el); while (log.children.length > 150) log.firstElementChild?.remove();
    if (stick) log.scrollTop = log.scrollHeight;
  }
  function setPm(p: { peer: string; ad: string } | null) {
    pmTo = p; if (!chat) return;
    const box = chat.querySelector('.on-pmto') as HTMLElement, inp = chat.querySelector('.on-in') as HTMLInputElement;
    box.classList.toggle('on', !!p); (box.querySelector('span') as HTMLElement).textContent = p ? '🔒 ' + p.ad + '\'e özel' : '';
    inp.placeholder = p ? p.ad + '\'e özel mesaj...' : 'Selam ver, sohbet et...'; if (p) inp.focus();
  }
  function ui() {
    if (!pill) {
      d.root.appendChild(st);
      pill = document.createElement('div'); pill.className = 'on-pill'; d.root.appendChild(pill);
      odaBtn = document.createElement('button'); odaBtn.className = 'on-oda'; d.root.appendChild(odaBtn);
      odaBtn.onclick = odaPanel;
      chat = document.createElement('div'); chat.className = 'on-chat';
      chat.innerHTML = '<div class="on-top"><button class="on-min">💬 Sohbet</button><div class="on-pmto"><span></span><button class="on-pmx" style="min-height:22px;padding:0 6px">✕</button></div></div><div class="on-log"></div><div class="on-row"><input class="on-in" maxlength="120" placeholder="Selam ver, sohbet et..."><button class="on-send">Yolla</button></div>';
      d.root.appendChild(chat);
      log = chat.querySelector('.on-log');
      for (const h of hist.splice(0)) addLog(h.who, h.text, h.kind, h.peer);
      (chat.querySelector('.on-min') as HTMLButtonElement).onclick = () => chat!.classList.toggle('min');
      (chat.querySelector('.on-pmx') as HTMLButtonElement).onclick = () => setPm(null);
      // tap a name in the log to whisper to that player
      log!.addEventListener('click', e => { const b = (e.target as HTMLElement).closest('b') as HTMLElement | null; if (b?.dataset.peer && remotes.has(b.dataset.peer)) setPm({ peer: b.dataset.peer, ad: b.dataset.ad || 'Esnaf' }); });
      log!.addEventListener('wheel', e => e.stopPropagation(), { passive: true });
      log!.addEventListener('pointerdown', e => e.stopPropagation());
      const input = chat.querySelector('.on-in') as HTMLInputElement;
      const send = () => {
        const t = filterChat(input.value.trim()); if (!t) return;
        input.value = '';
        if (benSusturuldum()) { addLog('Martıköy', 'Susturuldun, mesajın kimseye gitmedi.', 'sys'); return; }
        if (!link) { void logYaz('sohbet', t, { cevrimdisi: true }); addLog(d.me().esnaf.ad || 'Sen', t); addLog('Martıköy', 'Şu an çevrimdışısın, mesajın sadece sende göründü. Bağlanmayı deniyorum...', 'sys'); retryT = 0; return; }
        if (pmTo) {
          if (!link.emit || !remotes.has(pmTo.peer)) { addLog('Martıköy', pmTo.ad + ' artık burada değil.', 'sys'); setPm(null); return; }
          link.emit('pm', { to: pmTo.peer, text: t, ad: d.me().esnaf.ad });
          void logYaz('pm', t, { kime: pmTo.ad });
          addLog('🔒 sen → ' + pmTo.ad, t, 'pm', pmTo.peer); return;
        }
        mySay = { t: Date.now(), text: t }; lastSent = '';
        void logYaz('sohbet', t, { esnaf: d.me().esnaf.ad || '' });
        addLog(d.me().esnaf.ad || 'Sen', t);
      };
      (chat.querySelector('.on-send') as HTMLButtonElement).addEventListener('click', send);
      input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') send(); });
      input.addEventListener('keyup', e => e.stopPropagation());
      addLog('Martıköy', 'Online dünyaya hoş geldin! Bir oyuncunun adına dokun, ona özel mesaj at.', 'sys');
    }
    setPill('🟢 ' + (code ? 'Özel oda ' + code + (host ? ' · 🏠 ev sahibi' : guestOf ? ' · ev sahibi: ' + guestOf : '') : '') + ' · ' + (remotes.size + 1) + ' kişi');
    if (odaBtn) odaBtn.textContent = code ? '🔑 Oyun kodu: ' + code : '🔑 Arkadaşını çağır';
  }
  function odaPanel() {
    const bg = document.createElement('div'); bg.className = 'on-bg';
    const close = () => bg.remove();
    const main = (err = '') => {
      bg.innerHTML = `<div class="on-card"><h3>🔑 Oyun kodu</h3><p>Oyunun sadece senin. Arkadaşın gelsin istersen kod oluştur, kodu ona söyle. O da "Katıl"a yazsın, aynı Martıköy'de buluşun.</p>
${code ? `<div class="on-big">${code}</div><p>Şu an bu odadasın.</p>` : ''}
<button class="on-b g" data-a="kur">Yeni oda kur</button><p style="margin:6px 0 0;font-size:12px">Odayı kuran ev sahibi olur: girenler senin büfeni görür, beraber çalışırsınız.</p>
<div style="margin-top:12px;font:900 15px var(--disp)">Odaya katıl</div>
<input class="on-code" maxlength="6" placeholder="KOD" autocomplete="off" spellcheck="false">
<button class="on-b y" data-a="katil">Katıl</button><div class="on-err">${err}</div>

<button class="on-b" data-a="kapat">Kapat</button></div>`;
    };
    bg.addEventListener('click', e => {
      if (e.target === bg) { close(); return; }
      const btn = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
      const a = btn?.dataset.a; if (!a) return;
      if (a === 'kur') { const c = yeniKod(); connect(c, true); main(); d.toast('Oda kuruldu: ' + c + '. Kodu arkadaşına söyle!'); return; }
      if (a === 'katil') { const c = kodTemiz((bg.querySelector('.on-code') as HTMLInputElement).value); if (c.length !== 6) { main('Kod 6 harf olmalı.'); return; } connect(c); close(); d.toast(c + ' odasına girdin.'); return; }
      if (a === 'genel') { connect(''); close(); return; }
      close();
    });
    bg.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') ((bg.querySelector('[data-a="katil"]') as HTMLButtonElement | null)?.click()); });
    bg.addEventListener('keyup', e => e.stopPropagation());
    main(); d.root.appendChild(bg);
  }

  function sync(peers: { peer: string; presence: Record<string, Json> }[]) {
    const now = performance.now();
    for (const p of peers) {
      const pr = p.presence as Record<string, unknown>;
      let rm = remotes.get(p.peer);
      if (!rm) {
        const tag = document.createElement('div'); tag.className = 'on-tag'; tag.innerHTML = '<span class="s" style="display:none"></span><span class="n"></span><span class="d"></span>'; d.root.appendChild(tag);
        rm = { peer: p.peer, hero: null, lookKey: '', x: Number(pr.x) || 0, z: Number(pr.z) || 0, rot: Number(pr.rot) || 0, tx: 0, tz: 0, trot: 0, speed: 0, act: 'idle', tag, sayT: 0, sayAt: 0, seen: now, uid: '', hn: '', ad: '' };
        remotes.set(p.peer, rm);
        d.toast((String(pr.ad || 'Bir esnaf')).slice(0, 14) + ' Martıköy\'e geldi!');
      }
      rm.seen = now; rm.uid = String(pr.uid || '').slice(0, 40); rm.hn = String(pr.hn || '').slice(0, 20); rm.ad = String(pr.ad || 'Esnaf').slice(0, 14);
      rm.tx = Number(pr.x) || 0; rm.tz = Number(pr.z) || 0; rm.trot = Number(pr.rot) || 0; rm.speed = Number(pr.sp) || 0; rm.act = typeof pr.act === 'string' ? String(pr.act).slice(0, 12) : 'idle';
      const sn = SINIFLAR.find(s => s.id === (pr.look as { sinif?: string } | undefined)?.sinif);
      (rm.tag.querySelector('.n') as HTMLElement).textContent = (pr.ev ? '🏠 ' : '') + (sn ? sn.icon + ' ' : '') + String(pr.ad || 'Esnaf').slice(0, 14);
      (rm.tag.querySelector('.d') as HTMLElement).textContent = String(pr.dukkan || '').slice(0, 22);
      const lk = JSON.stringify(pr.look || null);
      if (lk !== rm.lookKey && d.chars) {
        rm.lookKey = lk;
        try { rm.hero?.dispose(); } catch { /* */ }
        try { rm.hero = d.chars.makeHero(esnafHeroOpts((pr.look || {}) as Partial<EsnafimSave>) as never); (rm.hero.object as Object3D).visible = true; } catch { rm.hero = null; }
      }
      const say = pr.say as { t?: number; text?: string } | undefined;
      if (say && typeof say.t === 'number' && say.t !== rm.sayT) {
        const first = rm.sayT === 0; rm.sayT = say.t;
        if (rm.uid && susturuldu(rm.uid)) continue;   // muted by an admin
        const text = filterChat(String(say.text || ''));
        if (!first || Date.now() - say.t < 15000) { rm.sayAt = now; const s = rm.tag.querySelector('.s') as HTMLElement; s.textContent = text; s.style.display = text ? 'block' : 'none'; addLog(String(pr.ad || 'Esnaf').slice(0, 14), text, '', p.peer); }
      }
    }
    for (const [k, rm] of remotes) if (!peers.some(p => p.peer === k)) { drop(rm); remotes.delete(k); }
    // host left the room: after 12 s the guest returns to their own büfe instead of staying frozen in a dead world
    if (guestOf) {
      if (peers.some(p => (p.presence as Record<string, unknown>).ev === true)) hostMissing = 0;
      else if (!hostMissing) hostMissing = now;
      else if (now - hostMissing > 12000) { hostMissing = 0; guestOf = ''; guestSig = ''; try { d.world?.leave(); } catch { /* */ } d.toast('Ev sahibi ayrıldı. Kendi büfene döndün.'); }
    } else hostMissing = 0;
    ui();
  }
  function drop(rm: Remote) { try { rm.hero?.dispose(); } catch { /* */ } rm.tag.remove(); }

  return {
    peers: () => [...remotes.values()].map(r => ({ peer: r.peer, uid: r.uid, hn: r.hn, ad: r.ad, x: r.x, z: r.z })),
    update(dt: number) {
      // an open panel sheet takes the screen: chat and the server button step aside so nothing covers its text
      if (chat && (sheetT -= dt) <= 0) { sheetT = 0.25; const open = !!document.querySelector('.sb-sheet, .kl-p, .gr-bg'); chat.style.display = open || !code ? 'none' : ''; if (odaBtn) odaBtn.style.display = open ? 'none' : ''; if (pill) pill.style.display = open ? 'none' : ''; }
      if (!link) { if (code && (retryT -= dt) <= 0) { retryT = 20; connect(code); } return; }
      const me = d.me();
      sendT -= dt;
      if (sendT <= 0) {
        sendT = via === 'supa' ? 0.15 : 0.12;
        const e = me.esnaf;
        const look: Record<string, unknown> = {}; for (const k of LOOK_KEYS) look[k] = e[k];
        const msg: Record<string, Json> = { v: 2, ev: host, x: +me.pos.x.toFixed(2), z: +me.pos.z.toFixed(2), rot: +me.rot.toFixed(2), sp: +me.speed.toFixed(1), act: me.act || 'idle', ad: e.ad, dukkan: e.dukkan, bolge: me.region, look };
        const hh = hesap(); if (hh) { msg.uid = hh.id; msg.hn = hh.ad; }
        if (mySay && Date.now() - mySay.t < 20000) msg.say = mySay;
        const key = JSON.stringify(msg);
        if (key !== lastSent) { lastSent = key; link.send(msg); }
      }
      // a guest who has no world yet keeps asking (the host may have joined later or a message dropped)
      if (!host && code && !guestOf && d.world && link.emit && (askT -= dt) <= 0) { askT = 4; link.emit('iste', {}); }
      // a guest's sales go to the host's till (every 2 s)
      if (!host && guestOf && d.world && link.emit && (worldT -= dt) <= 0) {
        worldT = 2;
        const e = d.world.earned(), n = kasaBase >= 0 ? e - kasaBase : 0;
        if (n > 0) { kasaBase = e; link.emit('kasa', { n, ad: me.esnaf.ad }); }
      }
      if (host && d.world && link.emit) {
        worldT -= dt;
        if (worldT <= 0) {
          worldT = 2;
          const sg = d.world.sig();
          if (worldWant || sg !== worldSig) { worldWant = false; worldSig = sg; link.emit('dunya', { w: d.world.get(), sig: sg, ad: me.esnaf.ad }); }
          else if (remotes.size) link.emit('para', { n: Math.floor(d.world.money()) });
        }
      }
      const now = performance.now(), k = Math.min(1, dt * 10);
      for (const rm of remotes.values()) {
        rm.x += (rm.tx - rm.x) * k; rm.z += (rm.tz - rm.z) * k;
        let dr = rm.trot - rm.rot; while (dr > Math.PI) dr -= Math.PI * 2; while (dr < -Math.PI) dr += Math.PI * 2; rm.rot += dr * k;
        const far = Math.hypot(rm.x - me.pos.x, rm.z - me.pos.z) > 70;
        if (rm.hero) {
          (rm.hero.object as Object3D).visible = !far;
          rm.hero.setPose({ x: rm.x, z: rm.z }, rm.rot);
          rm.hero.setInput({ speed: rm.speed, act: rm.speed > 0.1 ? 'walk' : rm.act, mood: 'happy', carry: 0, t: now / 1000 } as never);
          rm.hero.update(dt, 1);
        }
        const on = !far && d.project({ x: rm.x, y: 2.15, z: rm.z }, tmp);
        rm.tag.style.display = on ? 'block' : 'none';
        if (on) { rm.tag.style.left = tmp.x + 'px'; rm.tag.style.top = tmp.y + 'px'; }
        if (rm.sayAt && now - rm.sayAt > 6000) { rm.sayAt = 0; (rm.tag.querySelector('.s') as HTMLElement).style.display = 'none'; }
      }
    },
  };
}
