/**
 * engine/perf: "Hız ölçer" perf meter. Owner: Builder A.
 * time/begin/end/count/frame are allocation-free after the first call per name (Map updates in place).
 * Decisions:
 * - Timers keep the last value and an exponential average (k=0.1); snapshot().timers reports the average.
 * - Frame ring of 120 samples for fps / p50 / p95. simMs = timer 'sim', renderMs = timer 'render', buildMs = 'zones.build'.
 * - Overlay is plain DOM (top-left, monospace), refreshed twice a second while visible; no-op without a document.
 */
import type { PerfDeps, PerfMeter, PerfSnapshot, TierName } from '../api';

const HINTS: [RegExp, string][] = [
  [/crowd|chars|kalabal/i, 'Kalabalık çizimi yavaşlatıyor'],
  [/zone|build/i, 'Bölge kurulumu yavaşlatıyor'],
  [/fx|particle/i, 'Efektler yavaşlatıyor'],
  [/render|frame|draw/i, 'Çizim yavaşlatıyor'],
  [/nav|path|ambient/i, 'Yol bulma yavaşlatıyor'],
  [/ui|hud|label/i, 'Arayüz yavaşlatıyor'],
  [/sim|walk|step/i, 'Simülasyon yavaşlatıyor'],
];
const hintFor = (id: string) => (HINTS.find(([r]) => r.test(id))?.[1]) ?? 'Bu sistem yavaşlatıyor';

export function createPerf(deps: PerfDeps = {}): PerfMeter {
  const g = globalThis as any;
  const now: () => number = deps.platform ? () => deps.platform!.clock.now() : () => (g.performance?.now ? g.performance.now() : 0);
  const last = new Map<string, number>();
  const avg = new Map<string, number>();
  const started = new Map<string, number>();
  const counters = new Map<string, number>();
  const sources = new Map<string, () => Partial<PerfSnapshot>>();
  const warnings: string[] = [];
  const ring = new Float32Array(120);
  let ringN = 0, ringI = 0;
  let visible = false, el: HTMLElement | null = null, timer: any = 0;

  const record = (name: string, ms: number) => {
    last.set(name, ms);
    const a = avg.get(name);
    avg.set(name, a === undefined ? ms : a + (ms - a) * 0.1);
  };

  const meter: PerfMeter = {
    time(name, fn) {
      const t0 = now();
      try { return fn(); } finally { record(name, now() - t0); }
    },
    begin(name) { started.set(name, now()); },
    end(name) {
      const t0 = started.get(name);
      if (t0 === undefined) return 0;
      const ms = now() - t0; record(name, ms); started.delete(name);
      return ms;
    },
    count(name, n) { counters.set(name, n); },
    frame(ms) { ring[ringI] = ms; ringI = (ringI + 1) % ring.length; if (ringN < ring.length) ringN++; },
    warn(msg) { if (!warnings.includes(msg)) { warnings.push(msg); if (warnings.length > 30) warnings.shift(); } },
    source(name, fn) { sources.set(name, fn); },
    snapshot() {
      const s = Array.from(ring.subarray(0, ringN)).sort((a, b) => a - b);
      const q = (p: number) => (s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0);
      const mean = s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0;
      const timers: Record<string, number> = {};
      avg.forEach((v, k) => { timers[k] = +v.toFixed(3); });
      const cnt: Record<string, number> = {};
      counters.forEach((v, k) => { cnt[k] = v; });
      const snap: PerfSnapshot = {
        fps: mean > 0 ? +(1000 / mean).toFixed(1) : 0, frameP50: +q(0.5).toFixed(2), frameP95: +q(0.95).toFixed(2),
        simMs: timers.sim ?? 0, renderMs: timers.render ?? 0,
        calls: 0, tris: 0, geos: 0, texs: 0, particles: 0, agentsByLod: [0, 0, 0], zones: {}, buildMs: last.get('zones.build') ?? 0,
        timers, counters: cnt, slowest: [], warnings: [...warnings], tier: 'dengeli' as TierName,
      };
      const heap = g.performance?.memory?.usedJSHeapSize;
      if (typeof heap === 'number') snap.heapMB = +(heap / 1048576).toFixed(1);
      sources.forEach((fn, name) => {
        try {
          const part = fn();
          for (const [k, v] of Object.entries(part)) {
            if (k === 'warnings' && Array.isArray(v)) snap.warnings.push(...(v as string[]));
            else if ((k === 'timers' || k === 'counters' || k === 'zones') && v && typeof v === 'object') Object.assign((snap as any)[k], v);
            else (snap as any)[k] = v;
          }
        } catch (e) { snap.warnings.push(`kaynak ${name}: ${(e as Error).message}`); }
      });
      snap.slowest = Object.entries(timers).filter(([k]) => k !== 'frame' && k !== 'sim' && k !== 'render')
        .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, ms]) => ({ id, ms, hint: hintFor(id) }));
      return snap;
    },
    report() {
      const s = meter.snapshot();
      const lines = [
        `Hız ölçer raporu`,
        `Kalite: ${s.tier}  FPS: ${s.fps}  Kare p50/p95: ${s.frameP50}/${s.frameP95} ms`,
        `Sim: ${s.simMs.toFixed(2)} ms  Çizim: ${s.renderMs.toFixed(2)} ms  Kurulum: ${s.buildMs.toFixed(2)} ms`,
        `Çizim çağrısı: ${s.calls}  Üçgen: ${s.tris}  Geometri: ${s.geos}  Doku: ${s.texs}  Parçacık: ${s.particles}`,
        `Bellek: ${s.heapMB ?? '?'} MB  Ajan LOD: ${s.agentsByLod.join('/')}`,
        `Bölgeler: ${Object.entries(s.zones).map(([k, v]) => `${k}=${v}`).join(' ') || '-'}`,
        `En yavaşlar: ${s.slowest.map(x => `${x.id} ${x.ms.toFixed(2)}ms (${x.hint})`).join('; ') || '-'}`,
        `Uyarılar: ${s.warnings.join('; ') || '-'}`,
        `Tarayıcı: ${g.navigator?.userAgent ?? 'node'}`,
      ];
      return lines.join('\n');
    },
    show(on) {
      visible = on;
      const doc = (deps.root?.ownerDocument ?? g.document) as Document | undefined;
      if (!doc) return;
      if (on && !el) {
        el = doc.createElement('div');
        el.className = 'mm-perf';
        el.style.cssText = 'position:fixed;left:6px;top:calc(env(safe-area-inset-top,0px) + 64px);z-index:40;background:rgba(20,24,30,.78);color:#e8f0ea;font:11px/1.35 ui-monospace,Menlo,monospace;padding:6px 8px;border-radius:8px;max-width:72vw;white-space:pre-wrap;pointer-events:auto';
        const pre = doc.createElement('div');
        const btn = doc.createElement('button');
        btn.textContent = 'Raporu kopyala';
        btn.style.cssText = 'margin-top:4px;font:inherit;font-weight:700;border:0;border-radius:6px;padding:4px 8px;background:#ffd34d;color:#3a2a10';
        btn.onclick = () => {
          const txt = meter.report();
          const done = (ok: boolean) => { btn.textContent = ok ? 'Kopyalandı' : 'Kopyalanamadı'; setTimeout(() => { btn.textContent = 'Raporu kopyala'; }, 1500); };
          if (deps.platform) deps.platform.copyText(txt).then(done); else done(false);
        };
        el.append(pre, btn);
        (deps.root ?? doc.body).appendChild(el);
        const upd = () => {
          const s = meter.snapshot();
          pre.textContent = `Hız ölçer  ${s.tier}\nFPS ${s.fps}  p95 ${s.frameP95}ms\nsim ${s.simMs.toFixed(2)}  çizim ${s.renderMs.toFixed(2)}  kurulum ${s.buildMs.toFixed(2)}\nçağrı ${s.calls}  üçgen ${s.tris}\ngeo ${s.geos}  doku ${s.texs}  parç ${s.particles}` +
            (s.slowest[0] ? `\n${s.slowest[0].hint}` : '') + (s.warnings.length ? `\n! ${s.warnings[s.warnings.length - 1]}` : '');
        };
        upd(); timer = setInterval(upd, 500);
      } else if (!on && el) { clearInterval(timer); el.remove(); el = null; }
    },
    get visible() { return visible; },
  };
  return meter;
}
