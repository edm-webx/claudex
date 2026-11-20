// BUF-09/10 test yardımcıları (test dosyası değil): kontrollü masa müşterisi, rastgele müşteri akışını kapatma, garson ekleme.
import { played } from './m1-helpers';
import { restoranApi, type RestoranApi } from '../../src/game/sim/restoran';
import { CITIZENS } from '../../src/content/citizens';

export interface Kurulum {
  sim: any; api: RestoranApi; r: any; S: any; test: Set<number>;
  /** 0.1 sn adımlarla `sec` saniye; her adımdan sonra `her` çağrılır (true dönerse durur) */
  step(sec: number, her?: (i: number) => boolean | void): void;
  musteri(table: number, order: Record<string, number>, n?: number): any;
  garson(id: number, xp?: number): any;
  garsonRow(id: number): { id: number; state: string; x: number; z: number } | undefined;
  kurulu(): number[];
}

let seq = 9000;
export function kur(seed = 4): Kurulum {
  const sim: any = played(seed);
  for (let i = 0; i < 60; i++) sim.step(0.1);
  sim.command({ kind: 'force', what: 'money', value: 2_000_000 });
  for (const k of ['cay', 'ayran', 'simit', 'tabure1', 'tabure2', 'masa1', 'gazoz', 'masa2', 'tost']) sim.command({ kind: 'force', what: 'unlock', value: k });
  sim.command({ kind: 'force', what: 'stage', value: 3 });
  sim.command({ kind: 'teleport', x: 4.5, z: -2.5 });   // oyuncu masalardan uzakta dursun (masa silme / servis dwell'i tetiklemesin)
  const api = restoranApi(sim.rules)!;
  api.wantMasa = () => false;   // masa müşterilerini test koyar
  const r = sim.rules.rt, S = sim.state, test = new Set<number>();
  for (const p of Object.keys(r.counter)) r.counter[p] = [];
  // rastgele sıra müşterileri tezgâhı / masaları karıştırmasın: doğar doğmaz gönderilir (bedenleri düzgün bırakılır)
  const temizle = () => {
    for (const c of r.customers) {
      if (test.has(c.id) || c.state === 'leave') continue;
      for (const q of [r.queue, r.winq]) { const i = q.indexOf(c); if (i >= 0) q.splice(i, 1); }
      if (c.seat) { for (const s of r.tables[c.seat.table].seats) if (s.occ === c.id) s.occ = 0; c.seat = null; }
      c.items = []; c.state = 'leave'; c.path = [];
    }
  };
  temizle();
  const k: Kurulum = {
    sim, api, r, S, test,
    step(sec, her) {
      const n = Math.round(sec / 0.1);
      for (let i = 0; i < n; i++) {
        temizle(); sim.step(0.1);
        if (r.paused) { r.paused = false; r.pauseWhy = ''; }
        if (her && her(i)) return;
      }
    },
    musteri(table, order, n = 1) {
      const tb = r.layout.tables[table], id = seq++;
      const ti = CITIZENS.findIndex(t => t.id === 'emekli');
      const c = {
        id, typeId: 'emekli', typeIdx: ti, kind: 'masa', n, order: { ...order }, got: {}, set: null, value: 0, state: 'wait',
        t: 0, takeT: 0, eatT: 0, patience: 100, patMax: 100, sit: true, mood: 'ok', x: tb.x, z: tb.z, rot: 0, speed: 0, path: [],
        agent: -1, members: [], items: [], seat: { table, seat: 0 }, say: '', sayT: 0, calm: false, follower: false, tag: null, qi: -1,
      };
      r.tables[table].seats.forEach((s: { occ: number }, i: number) => { if (i < Math.max(1, n)) s.occ = id; });
      r.customers.push(c); test.add(id);
      return c;
    },
    garson(id, xp = 0) { const w = { id, name: 'Garson' + id, role: 'garson', xp, rank: 0, morale: 70, traits: ['hamarat'], trait: 'hamarat' }; S.workers.push(w); return w; },
    garsonRow: id => r.agents.workers.rows().find((w: { id: number }) => w.id === id),
    kurulu: () => r.tables.map((t: { built: boolean }, i: number) => (t.built ? i : -1)).filter((i: number) => i >= 0),
  };
  return k;
}
export const evs = (sim: any, name: string) => sim.events(0).filter((e: { name: string }) => e.name === name);
