/**
 * M1 command union: every UI/bot/hook action that changes sim state goes through `sim.command(cmd)`.
 * Owner: Builder A. Pure types, no runtime imports of three/DOM. Published first so B, C, D code against it.
 *
 * Conventions:
 * - Commands never throw; a refused command emits a 'toast' event ({ text, kind: 'bad' | 'info' | 'good' }) and changes nothing.
 * - Ids are v2 ids (pad keys, product ids, panel ids, decor ids, worker ids as numbers, candidate ids as strings).
 * - Movement is NOT a command: `sim.input({x, z})` (stick vector) as in M0.
 * - `play` = the v2 title "Oyna" + portrait pick in one command: sets hero, starts the session clock (`start` + `heroPick` events).
 *   Until `play` ran, the sim world is alive but frozen (no customers, no day clock), like v2 behind the title card.
 */
import type { HeroId, ProductId } from './schema';

export type PanelId = 'isciler' | 'menu' | 'dekor' | 'gorevler' | 'kedi' | 'karne' | 'tadilat' | 'ayarlar';
/** Overlay models that are not tab panels (same ids as panelModel()). */
export type OverlayId = 'jobBoard' | 'welcomeBack' | 'dayCard' | 'kasaSayimi' | 'solution';
export type ModelId = PanelId | OverlayId;

export type SettingKey = 'muted' | 'quality' | 'music' | 'sfx' | 'voice' | 'textScale' | 'hand' | 'colorBlindIcons' | 'haptics' | 'batterySaver' | 'perfMeter' | 'ownMusic';

export type ForceKind = 'unlock' | 'ferry' | 'gull' | 'kapkac' | 'regular' | 'vip' | 'endDay' | 'money' | 'gold' | 'stars' | 'sleep' | 'offline';

export type SimCmd =
  // ── M0 (kept) ──
  | { kind: 'setTime'; hour: number; freeze?: boolean }
  | { kind: 'freezeTime'; on: boolean }
  | { kind: 'setStage'; stage: number }
  | { kind: 'teleport'; x: number; z: number }
  // ── session ──
  | { kind: 'play'; hero?: HeroId }
  | { kind: 'setHero'; hero: HeroId }
  | { kind: 'resetSave' }
  // ── panels (UI state lives in sim so bots and hooks see it) ──
  | { kind: 'openPanel'; id: PanelId }
  | { kind: 'closePanel' }
  | { kind: 'openJobBoard' }
  | { kind: 'closeJobBoard' }
  // ── economy / progression ──
  | { kind: 'upgradeTier'; id: ProductId | 'miknatis' }
  | { kind: 'invest'; id: string }
  | { kind: 'kiyafet'; op: 'buy' | 'wear' | 'take'; id: string }
  | { kind: 'yetenek'; op: 'use' }   // 2026-10-24 sınıf yetenekleri (sim/yetenek.ts)
  | { kind: 'tabela'; op: 'buy' | 'renk'; value?: string }   // 2026-10-24 tabela seviyesi (sim/tabela.ts)
  | { kind: 'gizem'; op: string }   // 2026-10-30 ana hikaye (sim/gizem.ts)
  | { kind: 'mulk'; op: string; id?: string; n?: number; tur?: string; tip?: string; name?: string; renk?: string; renk2?: string; arma?: string }   // 2026-10-27 envanter, banka, arsa, sandık (sim/mulk.ts)
  | { kind: 'esnafim'; op: 'set' | 'done' | 'open'; data?: Record<string, unknown> }   // 2026-10-24 kendi esnafın (sim/esnafim.ts)
  | { kind: 'halisaha'; op: 'kabul' | 'red' | 'sonuc' | 'teklif'; biz?: number; onlar?: number; ist?: unknown }   // maç günü + halı saha (sim/halisaha.ts)
  | { kind: 'zemin'; op: 'temizle' | 'desen'; value?: string }   // survey 2026-10-24: zemin (sim/zemin.ts)   // survey 2026-10-24: kıyafet dolabı (sim/kiyafet.ts)
  | { kind: 'startTadilat' }
  | { kind: 'startTadilatSelf' }
  | { kind: 'skipTadilat' }
  | { kind: 'claimOrder'; id: string }               // task id, or 'all'
  | { kind: 'ordersRefresh' }
  // ── crew ──
  | { kind: 'hireCandidate'; id: string; free?: boolean }
  | { kind: 'refreshBoard' }                         // paid unless the timer ran out
  | { kind: 'fire'; id: number }
  | { kind: 'train'; id: number }
  // ── decor / sign ──
  | { kind: 'decorBuy'; id: string }
  | { kind: 'decorPlace'; id: string }
  | { kind: 'decorRemove'; slot: number }
  | { kind: 'decorRotate'; slot: number }   // survey 2026-10-24: quarter turn
  | { kind: 'saveSign'; text: string; font?: string }
  // ── slow icon, ceremonies ──
  | { kind: 'tapSlow' }                              // opens the 'solution' model (and emits 'slowTap')
  | { kind: 'acceptSolution' }
  | { kind: 'collectWelcome'; doubled?: boolean }
  | { kind: 'yeniGun' }                              // closes the gün sonu card (survey 2026-10-24)
  | { kind: 'skipCeremony' }                         // closes kasaSayimi / dayCard pause
  // ── settings ──
  | { kind: 'setSetting'; key: SettingKey; value: unknown }
  // ── komşu esnaf (sim/esnaf.ts): op = open | sel | talk | gift | buy | accept | drop | claim | pick | hakem ──
  | { kind: 'esnaf'; op: string; id?: string; arg?: number }
  // ── Dekor 2.0 + Sabri'nin Evi (sim/dekor-ev.ts): arg = 'op|a|b|c' ──
  | { kind: 'dekor2'; arg: string }
  // ── mini oyunlar (sim/mini.ts): op = open | play | practice | result | quit | ad | microStart | micro | microSkip ──
  | { kind: 'mini'; op: string; id?: string; arg?: number }
  // ── hava, takvim, şemsiye, Gece Pazarı (sim/hava.ts): op = open | umb | stock ──
  | { kind: 'hava'; op: string; id?: string }
  // ── yiyecek / tarifler / markalar (sim/yiyecek.ts): arg = 'op:id' (tab, st, sel, ing, mix, clear, deal, learn) ──
  | { kind: 'yiyecek'; arg: string }
  // ── kuryeler (sim/kurye.ts): op = open | accept | decline | self | selfResult | selfQuit | hire | veh | buyVeh | upg | sus | seen ──
  | { kind: 'kurye'; op: string; id?: string; arg?: number }
  // ── koleksiyonlar + Altın Fırın (sim/koleksiyon.ts): op = open | tab | pack | cast | buy | ad | vitrin | close ──
  | { kind: 'koleksiyon'; op: string; id?: string; arg?: number }
  // ── hikaye, rakipler, öğreticiler (sim/hikaye.ts): op = open | tab | sceneDone | replay | rival | araDone | resultDone ──
  | { kind: 'hikaye'; op: string; id?: string; arg?: number }
  // ── çalışanlar 2.0 (sim/calisan.ts): op = tab | sel | close | kurs | bank | call | pasta | hali | cay | piknik ──
  | { kind: 'calisan'; op: string; id?: string }
  // ── deniz, tekneler, güverte koşusu, iskele büyümesi (sim/deniz.ts): op = open | ext | seatBuy | seatSet | tez | pier | bufe | photo | boat | board | deck | serve | unboard ──
  | { kind: 'deniz'; op: string; id?: string }
  // ── test hooks (v2 __bufe.force.*) ──
  | { kind: 'force'; what: ForceKind; value?: number | string };

export type SimCmdKind = SimCmd['kind'];

/** Narrowing helper used by the dispatcher. */
export function isCmd(c: { kind: string }): c is SimCmd { return typeof c.kind === 'string'; }

/** panelActions(id) -> the commands a panel/overlay may issue (D builds buttons from this list). */
export type PanelAction = { label?: string; cmd: SimCmd };
