// Panels controller (Builder D, M1). Bridges A's sim UI state (rules.rt.panel / boardOpen / uiLast overlays) to the ported
// v2 DOM screens (v2ui.ts). Pure view: reads sim state, sends `sim.command(...)`; never writes sim state.
// Decisions:
// - Models come from A's `panelModel(id, rules)` / `panelActions(id)` injected as `models` (no import cycle, testable).
// - Overlays are shown once per model object identity found in `rt.uiLast[id]` (the sim replaces the object to re-show).
// - Menu bar items follow v2 menuBarSync() unlock rules, computed from GameState.
// - Ayarlar actions that are pure view/engine settings (volume, quality, perf) are handled here, the rest become setSetting.
import { egiticiApi } from './egitici';
import { TABELA, TABELA_RENK, tabelaSave } from '../sim/tabela';
import type { Ui, Audio } from '../../engine/api';
import { createV2Ui, type V2UiApi } from './v2ui';

type Cmd = { kind: string; [k: string]: unknown };
export interface PanelSim { command(c: Cmd): unknown; rules: { state: any; rt: any }; }
export interface PanelModels {
  panelModel(id: string, rules: any): Record<string, any>;
  panelActions(id: string): Record<string, (arg?: any) => Cmd>;
}
export interface PanelsDeps {
  ui: Ui; sim: PanelSim; models: PanelModels; audio?: Audio;
  /** Extra ayarlar actions (quality, perf meter...) wired by boot. */
  extraSettings?: (key: string, value: unknown) => void;
  /** M0 perf meter ("Hız ölçer" + "Raporu kopyala"), shown in the ayarlar panel when given (integrator). */
  perf?: { visible(): boolean; show(on: boolean): void; copy(): void };
  fonts?: unknown[];
  /** GRS-17: current tier for the 'Otomatik: Şu an ...' line */
  quality?: { current(): { label: string } };
}
export interface Panels { update(): void; v2: V2UiApi; open(id: string): void; dispose(): void; /** ana menü ayarları (menu-stil): ayarlar panelinin eylemleri */ ayarEylem(): Record<string, (a?: any, b?: any) => void>; }

const PANEL_IDS = ['isciler', 'menu', 'dekor', 'gorevler', 'kedi', 'karne', 'tadilat', 'ayarlar'];

// PRF-05: menuItems() + JSON.stringify used to run every frame (dozens of objects and a string per frame). The bar only depends on a few
// small facts of the state; they are folded into one integer here (no allocation) and the list is rebuilt only when it changes.
export function barSignature(s: any): number {
  let hasAch = 0; if (s.ach) { for (const _k in s.ach) { hasAch = 1; break; } }
  let badge = 0; const l = s.orders && s.orders.list; if (l) for (let i = 0; i < l.length; i++) if (l[i].done && !l[i].claimed) badge++;
  const lv = Math.min(s.level | 0, 4);
  return lv | (((s.workers && s.workers.length) ? 1 : 0) << 3) | ((s.day >= 2 ? 1 : 0) << 4) | (hasAch << 5) | (((s.cats && s.cats.length) ? 1 : 0) << 6)
    | ((s.stars >= 1 ? 1 : 0) << 7) | ((s.stage > 1 ? 1 : 0) << 8) | ((s.tadilat ? 1 : 0) << 9) | (Math.min(badge, 255) << 10);
}

export function menuItems(s: any): any[] {
  // 2026-11-26 owner picked the "Esnaf telefonu" HUD: the bar holds only Çanta and Telefon. Harita = mini map (ui/telefon.ts),
  // Ajanda / Karne / Karakter / Ayarlar / Mülklerim / Martı Kasa = phone apps, Menü / Ekip / Tadilat = the "Büfem" context pill.
  const orders = s.orders && s.orders.list ? s.orders.list : [];
  const badge = orders.filter((o: any) => o.done && !o.claimed).length || 0;
  return [{ id: 'envanter', label: 'Çanta', icon: 'tray' }, { id: 'telefon', label: 'Telefon', icon: 'phone', badge }];
}

export function createPanels(deps: PanelsDeps): Panels {
  const { ui, sim, models } = deps;
  const v2 = createV2Ui(ui, {
    sfx: id => { try { deps.audio?.sfx(id); } catch { /* optional */ } },
    buzz: ms => { try { if (ui.settings.haptics && (navigator as any).userActivation?.hasBeenActive) navigator.vibrate?.(ms); } catch { /* optional */ } },
    unlock: () => { try { deps.audio?.unlock(); } catch { /* optional */ } },
  });
  const rules = () => sim.rules;
  const S = () => rules().state;
  const rt = () => rules().rt;
  const send = (c: Cmd) => { try { sim.command(c); } catch (e) { console.error('[panels] command', c.kind, e); } };

  /** v2 UI actions object for a panel id: every panelActions factory becomes a function that sends its command. */
  function actionsFor(id: string): Record<string, (a?: any) => void> {
    const acts = models.panelActions(id) || {};
    const out: Record<string, (a?: any) => void> = {};
    for (const k of Object.keys(acts)) out[k] = (a?: any) => send(acts[k](a));
    if (id === 'ayarlar') {
      const set = (key: string, value: unknown) => { send({ kind: 'setSetting', key, value }); deps.extraSettings?.(key, value); };
      out.setMuted = b => { const muted = !b; set('muted', muted); if (deps.audio) for (const bus of Object.values(deps.audio.buses)) bus.muted = muted; if (!muted) deps.audio?.unlock(); ui.hud({ muted }); };
      out.setHaptic = b => { ui.settings.haptics = !!b; set('haptics', !!b); };
      // ses-5: music / sfx / voice sliders (live, no re-render while dragging) + own music mode
      out.setVol = (bus?: any, v?: any) => { const a = deps.audio; const k = String(bus) as 'music' | 'sfx' | 'voice'; if (!a || !a.buses[k]) return; a.buses[k].volume = +v || 0; send({ kind: 'setSetting', key: k, value: a.buses[k].volume }); };
      out.setOwnMusic = b => { const on = !!b; deps.audio?.ownMusicMode(on); set('ownMusic', on); setTimeout(() => { if (rt().panel === 'ayarlar') renderPanel('ayarlar'); }, 0); };
      out.setQuality = q => set('quality', q);
      out.setHand = h => { set('hand', h === 'sol' ? 'left' : 'right'); };
      out.setTextScale = v => { set('textScale', +v || 1); };
      out.setFlas = b => { set('flasAzalt', !!b); setTimeout(() => { if (rt().panel === 'ayarlar') renderPanel('ayarlar'); }, 0); };
      out.setCb = b => { set('colorBlindIcons', !!b); setTimeout(() => { if (rt().panel === 'ayarlar') renderPanel('ayarlar'); }, 0); };
      out.setHero = h => send({ kind: 'setHero', hero: h });
      out.reset = () => send({ kind: 'resetSave' });
      { const eg = egiticiApi(); const again = () => setTimeout(() => { if (rt().panel === 'ayarlar') renderPanel('ayarlar'); }, 0);
        if (eg) { out.setEgt = b => { eg.setAcik(!!b); again(); }; out.egtSifirla = () => { eg.sifirla(); ui.toast('Eğitici kartları baştan gösterilecek.', 'info'); again(); }; out.egtTekrar = k => eg.tekrar(String(k)); } }
      out.karakterDegis = () => { window.dispatchEvent(new CustomEvent('martikoy:karakter')); };
      if (deps.perf) {
        const pf = deps.perf;
        out.setPerf = b => { pf.show(!!b); set('perfMeter', !!b); setTimeout(() => { if (rt().panel === 'ayarlar') renderPanel('ayarlar'); }, 0); };
        out.copyReport = () => pf.copy();
      }
    }
    if (id === 'dekor') {
      out.buy = a => send({ kind: 'decorBuy', id: a });
      out.place = a => send({ kind: 'decorPlace', id: a });
      out.remove = slot => send({ kind: 'decorRemove', slot });
      out.rot = slot => send({ kind: 'decorRotate', slot });
      out.sign = () => openSign();
      out.d2 = a => { send({ kind: 'dekor2', arg: String(a ?? '') }); setTimeout(() => { if (rt().panel === 'dekor') renderPanel('dekor'); }, 0); }; // Dekor 2.0 (dekor-panel.ts)
    }
    if (id === 'isciler') out.board = () => send({ kind: 'openJobBoard' });
    if (id === 'menu') out.yy = a => { send({ kind: 'yiyecek', arg: String(a ?? '') } as Cmd); setTimeout(() => { if (rt().panel === 'menu') renderPanel('menu'); }, 0); }; // yiyecek tabs (yiyecek-panel.ts)
    if (id === 'koleksiyon') for (const k of Object.keys(out)) { const f = out[k]; out[k] = a => { f(a); setTimeout(() => { if (rt().panel === 'koleksiyon') renderPanel('koleksiyon'); }, 0); }; } // instant re-render (koleksiyon-panel.ts)
    if (id === 'isciler') for (const k of Object.keys(out)) if (k === 'train' || /^c[A-Z]/.test(k)) { const f = out[k]; out[k] = a => { f(a); setTimeout(() => { if (rt().panel === 'isciler') renderPanel('isciler'); }, 0); }; } // instant re-render (calisan-panel.ts)
    if (id === 'hikaye' && out.hkTab) { const f = out.hkTab; out.hkTab = a => { f(a); setTimeout(() => { if (rt().panel === 'hikaye') renderPanel('hikaye'); }, 0); }; } // instant tab switch (hikaye-panel.ts)
    return out;
  }

  function openSign() {
    const st = S();
    v2.signEditor({
      text: st.sign?.text, font: st.sign?.font, fonts: deps.fonts,
      onSave: (text: string, font: string) => send({ kind: 'saveSign', text, font }),
      tabela: () => ({ ...tabelaSave(st as never), money: S().money }), tiers: TABELA, renkler: TABELA_RENK,
      onBuy: () => send({ kind: 'tabela', op: 'buy' } as Cmd), onRenk: (r: string) => send({ kind: 'tabela', op: 'renk', value: r } as Cmd),
    });
  }

  let shownPanel: string | null = null;
  let shownBoard = false;
  const lastOverlay: Record<string, unknown> = {};
  let barKey = '';
  let barSig = -1;
  let lastRender = 0;

  function renderPanel(id: string) {
    let model = models.panelModel(id, rules());
    if (id === 'ayarlar') {
      const st = S().settings || {};
      model = { ...model, vol: deps.audio ? { music: deps.audio.buses.music.volume, sfx: deps.audio.buses.sfx.volume, voice: deps.audio.buses.voice.volume } : null, ownMusic: !!st.ownMusic, haptic: ui.settings.haptics !== false, hand: (st.hand || ui.settings.hand) === 'left' ? 'sol' : 'sag', textScale: st.textScale || 1, cb: !!st.colorBlindIcons, flas: st.flasAzalt !== false, perf: deps.perf ? deps.perf.visible() : undefined, tierNow: deps.quality?.current().label ?? null };
    }
    if (id === 'ayarlar') { const eg = egiticiApi(); if (eg) model = { ...model, egt: { acik: eg.acik(), gorulen: eg.gorulenler() } }; }
    v2.open(id, model, actionsFor(id));
  }

  // a panel's own UI state changed (e.g. the harita district card): redraw it now
  window.addEventListener('ui:rerender', (e: Event) => { const id = (e as CustomEvent).detail as string; if (rt().panel === id) renderPanel(id); });
  ui.root.addEventListener('ui:open', (e: Event) => {
    const id = (e as CustomEvent).detail as string;
    // 14:38 user: a Karakter tab to step back in front of the mirror and change the esnaf (kulis.ts)
    if (id === 'karakter') { send({ kind: 'esnafim', op: 'open' } as Cmd); return; }
    // 17:24 user: "alttaki harita hâlâ işlevsiz": the bar's Harita button was never routed
    if (id === 'harita') { if (rt().panel === 'harita') send({ kind: 'closePanel' }); else send({ kind: 'disari', op: 'open' } as Cmd); return; }
    if (!PANEL_IDS.includes(id)) return;
    if (rt().panel === id) send({ kind: 'closePanel' }); else send({ kind: 'openPanel', id });
  });
  ui.root.addEventListener('ui:close', (e: Event) => {
    const id = (e as CustomEvent).detail as string;
    if (id === 'isbul') return;
    if (rt().panel) send({ kind: 'closePanel' });
  });

  function overlays() {
    const ul = rt().uiLast as Record<string, any>;
    const fresh = (id: string) => { const m = ul[id]; if (m && m !== lastOverlay[id]) { lastOverlay[id] = m; return m; } if (!m) lastOverlay[id] = undefined; return null; };
    let m: any;
    if ((m = fresh('dayCard'))) {
      v2.dayCard({ ...m, fix: m.fix ? { ...m.fix, onClick: () => send({ kind: 'acceptSolution' }) } : undefined });
    }
    if ((m = fresh('solution'))) v2.solution({ ...m, onAccept: () => send({ kind: 'acceptSolution' }), onLater: () => send({ kind: 'dismissSolution' }) });
    if ((m = fresh('welcomeBack'))) v2.welcomeBack({ ...m, onCollect: (doubled: boolean) => send({ kind: 'collectWelcome', doubled }) });
    if ((m = fresh('kasaSayimi'))) v2.kasaSayimi(m).then(() => send({ kind: 'skipCeremony' }));
  }

  return {
    v2,
    ayarEylem: () => actionsFor('ayarlar'),
    open(id) { send({ kind: 'openPanel', id } as Cmd); },
    update() {
      const r = rt();
      if (!r) return;
      // menu bar
      const sig = barSignature(S());
      if (sig !== barSig) {
        barSig = sig;
        const items = menuItems(S());
        const key = JSON.stringify(items);
        if (key !== barKey) { barKey = key; v2.menuBar(items); }
      }
      // tab panels
      const p: string | null = r.panel;
      if (p !== shownPanel) {
        shownPanel = p;
        if (p) renderPanel(p); else if (v2.openId && v2.openId !== 'isbul') v2.close();
      } else if (p && ++lastRender % 15 === 0) renderPanel(p);   // keep numbers live (twice a second)
      // job board
      if (r.boardOpen && !shownBoard) {
        shownBoard = true;
        const refresh = () => { const m = models.panelModel('jobBoard', rules()); v2.jobBoard({ ...m, onHire: (id: string) => { send({ kind: 'hireCandidate', id }); setTimeout(refresh, 0); }, onRefresh: () => { send({ kind: 'refreshBoard' }); setTimeout(refresh, 0); }, onClose: () => { send({ kind: 'closeJobBoard' }); } }); };
        refresh();
      } else if (!r.boardOpen && shownBoard) { shownBoard = false; if (v2.openId === 'isbul') v2.close(); }
      overlays();
    },
    dispose() { /* DOM lives with ui.root */ },
  };
}
