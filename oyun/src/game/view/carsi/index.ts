/**
 * Çarşı Sokağı view: the four neighbour esnaf (v2-style rigs at their stalls), their speech bubbles and the shop name
 * tags. Never writes sim state. Reads the zone state (shown only while the street is warm or hot) and the game hour
 * (esnaf stand at their stall from OPEN_H to CLOSE_H and walk home after).
 * - Bubbles: each esnaf cycles their open lines (4.5 s on, 4.5 s off). Tapping a bubble shows one of their selam
 *   lines for 3.5 s. Closed shops show the closing line.
 * - Labels use the HTML label layer (screen space, projected each frame).
 */
import type * as T from 'three';
import type { ZoneManager, Vec3, ScreenPt, HeroHandle } from '../../../engine/api';
import type { MotorChars } from '../chars';
import type { HtmlLabels, HtmlLabel } from '../../ui/labels';
import { ESNAF, OPEN_H, CLOSE_H, STREET_ZONE, placeFronts, type Esnaf } from '../../../content/carsi/street';
import { resolveLook } from '../chars/agents-view';
import { ESNAF_DOST, DOST_LEVELS, MORNING_H, EVENING_H, CAY_SPOT, TAVLA_LINES, MORNING_REPLY } from '../../../content/carsi/esnaf-dostluk';
import type { EsnafView } from '../../sim/esnaf';
import { createEsnafExtras, type EsnafExtras } from './esnaf-extras';

export interface CarsiViewDeps {
  scene: T.Scene; chars: MotorChars; zones: ZoneManager; labels: HtmlLabels;
  project(p: Vec3, out: ScreenPt): boolean; hour(): number;
  /** Esnaf friendship read model (rt.esnaf.view()); optional. */
  esnaf?: () => EsnafView | null;
  /** Tap on an esnaf (bubble or name tag): opens the Komşu Defteri via a sim command. */
  onEsnafTap?: (id: string) => void;
}
export interface CarsiView { update(dt: number): void; dispose(): void; }

interface Row { e: Esnaf; h: HeroHandle | null; x: number; z: number; rotY: number; label: HtmlLabel; clock: number; selamUntil: number; selam: number; line: string; lineAt?: number; lastLine?: string }
const SHOW = 4.5, GAP_T = 4.5, SELAM_T = 3.5;
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);

export function createCarsiView(d: CarsiViewDeps): CarsiView {
  const placed = placeFronts();
  const rows: Row[] = [];
  for (const e of ESNAF) {
    const p = placed.find(q => q.id === e.shop)!;
    const n = p.side === 'n';
    const x = p.cx, z = n ? p.frontZ - 0.7 : p.frontZ + 0.85;
    let h: HeroHandle | null = null;
    try { h = d.chars.makeHero({ kind: 'regular', seed: e.seed, look: resolveLook(d.chars, { lookType: e.type, lookSeed: e.seed }) } as never); }
    catch (err) { console.warn('[carsi] esnaf rig', e.id, err); }
    if (h) { h.object.visible = false; h.setPose({ x, z }, n ? 0 : Math.PI); }
    const row: Row = { e, h, x, z, rotY: n ? 0 : Math.PI, label: d.labels.label(), clock: 0, selamUntil: 0, selam: 0, line: '' };
    row.label.onTap = () => { row.selam = (row.selam + 1) % e.selam.length; row.selamUntil = row.clock + SELAM_T; try { d.onEsnafTap?.(e.id); } catch (err) { console.warn('[carsi] tap', err); } };
    rows.push(row);
  }
  const tags = placed.filter(p => p.kind !== 'filler').map(p => ({ p, label: d.labels.label() }));
  const headAt: Vec3 = { x: 0, y: 0, z: 0 };
  const tmp: ScreenPt = { x: 0, y: 0 };

  function open(): boolean { const h = d.hour(); return h >= OPEN_H && h < CLOSE_H; }
  let extras: EsnafExtras | null = null;
  if (d.esnaf) { try { extras = createEsnafExtras({ scene: d.scene, chars: d.chars, zones: d.zones, labels: d.labels, project: d.project, hour: d.hour, info: d.esnaf }); } catch (err) { console.warn('[carsi] extras', err); } }
  /** Friendship lines: favour ask, rivalry, morning shutter greeting, evening çay; '' = none. */
  function friendLine(r: Row, info: EsnafView | null, h: number, i: number): string {
    if (!info) return '';
    const D = ESNAF_DOST[r.e.id]; if (!D) return '';
    const ln = info.lines[r.e.id] || '';
    if (ln !== (r.lastLine || '')) { r.lastLine = ln; r.lineAt = r.clock; }
    if (ln && r.clock < 6 + (r.lineAt || 0)) return ln;
    if (h >= EVENING_H[0] && h < EVENING_H[1]) { const k = Math.floor(r.clock / 5 + i) % 3; return k === 0 ? D.evening : k === 1 ? TAVLA_LINES[(i + Math.floor(r.clock / 15)) % TAVLA_LINES.length] : ''; }
    if (h >= MORNING_H[0] && h < MORNING_H[0] + 0.6) return i % 2 ? MORNING_REPLY : D.morning;
    if (info.favFrom === r.e.id && (info.favAsk || info.favDone)) return info.favDone ? 'Hallettin mi? Gel, teşekkür edeyim!' : 'Komşu! Bir ricam var, dokun bana.';
    const rv = info.rival;
    if (rv && (rv.a === r.e.id || rv.b === r.e.id)) { const cyc = Math.floor(r.clock / 9) % 4; if (cyc === 1) return rv.a === r.e.id ? rv.lineA : ''; if (cyc === 2) return rv.b === r.e.id ? rv.lineB : ''; }
    return '';
  }

  return {
    update(dt: number) {
      const st = d.zones.state(STREET_ZONE);
      const live = st === 'warm' || st === 'hot';
      const isOpen = open();
      const info = live && d.esnaf ? d.esnaf() : null;
      const hr = d.hour();
      const evening = hr >= EVENING_H[0] && hr < EVENING_H[1];
      let ri = -1;
      for (const r of rows) {
        r.clock += dt; ri++;
        if (!r.h) continue;
        const shown = live && (isOpen || (evening && !!info));
        // evening esnaf çayı: everyone sits around the tea table in the middle of the street
        const ang = (ri / rows.length) * Math.PI * 2;
        const px = evening && info ? CAY_SPOT.x + Math.cos(ang) * 1.35 : r.x, pz = evening && info ? CAY_SPOT.z + Math.sin(ang) * 1.05 : r.z;
        const prot = evening && info ? Math.atan2(CAY_SPOT.x - px, CAY_SPOT.z - pz) : r.rotY;
        if (!live) { r.h.object.visible = false; r.label.hide(); continue; }
        // esnaf stands at the stall while open, goes home (rig hidden) when closed
        r.h.object.visible = shown;
        if (shown) {
          r.h.setPose({ x: px, z: pz }, prot);
          r.h.setInput({ speed: 0, act: 'idle', mood: 'happy' } as never);
          r.h.setExpr('smile');
          r.h.update(dt, 1);
        }
        const selam = r.clock < r.selamUntil;
        const cyc = r.clock % (SHOW + GAP_T);
        const idx = Math.floor(r.clock / (SHOW + GAP_T)) % r.e.openLines.length;
        const fl = friendLine(r, info, hr, ri);
        const talk = selam ? r.e.selam[r.selam % r.e.selam.length] : fl && info && info.favFrom === r.e.id ? fl : '';
        headAt.x = px; headAt.y = 2.25; headAt.z = pz;
        const ok = d.project(headAt, tmp);
        if (!ok) { r.label.hide(); continue; }
        if (!talk) {
          // always-tappable name tag with friendship hearts (opens the Komşu Defteri)
          if (!info || !shown) { r.label.hide(); continue; }
          const lv = info.levels[r.e.id] || 1, D = ESNAF_DOST[r.e.id];
          const mark = info.favFrom === r.e.id && (info.favAsk || info.favDone) ? ' !' : '';
          r.label.set(tmp.x, tmp.y, `<div class="tag"><b>${esc((D ? D.short : r.e.name) + mark)}</b>${'\u2665'.repeat(lv)}</div>`, 'tag tap');
          continue;
        }
        r.label.set(tmp.x, tmp.y, `<div class="say">${esc(talk)}</div>`, 'say tap');
      }
      if (extras) extras.update(dt);
      for (const t of tags) {
        if (!live) { t.label.hide(); continue; }
        headAt.x = t.p.cx; headAt.y = 4.9; headAt.z = t.p.cz;
        if (!d.project(headAt, tmp)) { t.label.hide(); continue; }
        t.label.set(tmp.x, tmp.y, `<div class="tag">${esc(t.p.name)}</div>`, 'tag');
      }
    },
    dispose() {
      if (extras) { extras.dispose(); extras = null; }
      for (const r of rows) { if (r.h) { r.h.dispose(); r.h = null; } r.label.free(); }
      for (const t of tags) t.label.free();
    },
  };
}
