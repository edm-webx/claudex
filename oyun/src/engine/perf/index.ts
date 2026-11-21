/**
 * engine/perf: "Hız ölçer" perf meter. Owner: Builder A.
 * time/begin/end/count/frame are allocation-free after the first call per name (Map updates in place).
 * Decisions:
 * - Timers keep the last value and an exponential average (k=0.1); snapshot().timers reports the average.
 * - Frame ring of 120 samples for fps / p50 / p95. simMs = timer 'sim', renderMs = timer 'render', buildMs = 'zones.build'.
 * - Overlay is plain DOM (top-left, monospace), refreshed twice a second while visible; no-op without a document.
 */
import type { PerfDeps, PerfDump, PerfMeter, PerfSnapshot, TierName } from '../api';

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

  // PRF-01 recorder: nothing below runs per frame unless recording is on.
  const REC_MAX_MS = 60000, REC_FRAMES = 7200, HITCH_KEEP = 30, EVENT_KEEP = 200;
  const recFrames = new Float32Array(REC_FRAMES);
  let recOn = false, recN = 0, recMs = 0, recHeapAt = 0, recGc = 0, recLastHeap = -1;
  let recStamp = '';
  let rec33 = 0, rec50 = 0, rec100 = 0;
  let hitches: PerfDump['takilmalar'] = [];
  let longtasks: PerfDump['longtask'] = [];
  let events: PerfDump['olaylar'] = [];
  let heaps: number[] = [];
  let gpuSamples: number[] = [];
  let observer: any = null;
  let ctxFn: (() => Record<string, string | number>) | null = null;
  const metaMap = new Map<string, string | number>();
  const heapNow = (): number => { const h = g.performance?.memory?.usedJSHeapSize; return typeof h === 'number' ? h / 1048576 : -1; };
  const stopRec = () => {
    recOn = false;
    try { observer?.disconnect(); } catch { /* ignore */ }
    observer = null;
  };
  const sec = () => +(recMs / 1000).toFixed(2);

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
    frame(ms) {
      ring[ringI] = ms; ringI = (ringI + 1) % ring.length; if (ringN < ring.length) ringN++;
      if (!recOn) return;
      if (recN < REC_FRAMES) recFrames[recN++] = ms;
      recMs += ms;
      if (ms > 33) rec33++;
      if (ms > 50) rec50++;
      if (ms > 100) rec100++;
      if (ms > 33) {
        const en = Array.from(last.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => [k, +v.toFixed(2)] as [string, number]);
        let ctx: Record<string, string | number> = {};
        try { ctx = ctxFn ? ctxFn() : {}; } catch { /* ignore */ }
        hitches.push({ t: sec(), ms: +ms.toFixed(1), ctx, en });
        if (hitches.length > HITCH_KEEP) hitches.shift();
      }
      if (recMs - recHeapAt >= 1000) {
        recHeapAt = recMs;
        const h = heapNow();
        if (h >= 0) {
          heaps.push(+h.toFixed(1));
          if (recLastHeap >= 0 && recLastHeap - h > 2) recGc++;
          recLastHeap = h;
        }
      }
      if (recMs >= REC_MAX_MS || recN >= REC_FRAMES) stopRec();
    },
    record(on) {
      if (on === recOn) return;
      if (!on) { stopRec(); return; }
      recN = 0; recMs = 0; recHeapAt = 0; recGc = 0; recLastHeap = -1; rec33 = rec50 = rec100 = 0;
      hitches = []; longtasks = []; events = []; heaps = []; gpuSamples = [];
      recStamp = g.Date ? new g.Date().toISOString() : '';
      recOn = true;
      const PO = g.PerformanceObserver;
      if (PO) {
        try {
          observer = new PO((list: any) => {
            for (const e of list.getEntries()) { if (longtasks.length < 100) longtasks.push({ t: sec(), ms: +e.duration.toFixed(1) }); }
          });
          observer.observe({ entryTypes: ['longtask'] });
        } catch { observer = null; }
      }
    },
    get recording() { return recOn; },
    mark(kind, detail = '') {
      if (!recOn) return;
      events.push({ t: sec(), tur: kind, detay: detail });
      if (events.length > EVENT_KEEP) events.shift();
    },
    meta(key, value) { metaMap.set(key, value); },
    context(fn) { ctxFn = fn; },
    gpu(ms) { if (recOn && gpuSamples.length < REC_FRAMES) gpuSamples.push(ms); },
    dump() {
      const s = Array.from(recFrames.subarray(0, recN)).sort((a, b) => a - b);
      const q = (p: number) => (s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0);
      const mean = s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0;
      const gs = [...gpuSamples].sort((a, b) => a - b);
      const gmean = gs.length ? gs.reduce((a, b) => a + b, 0) / gs.length : 0;
      const snap = meter.snapshot();
      const cihaz: Record<string, string | number> = { tarayici: g.navigator?.userAgent ?? 'node' };
      metaMap.forEach((v, k) => { cihaz[k] = v; });
      return {
        schema: 1, kayit: recN > 0, kayitSn: +(recMs / 1000).toFixed(1), zaman: recStamp, cihaz,
        kare: {
          n: recN, fps: mean > 0 ? +(1000 / mean).toFixed(1) : 0, p50: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2),
          p99: +q(0.99).toFixed(2), max: +(s.length ? s[s.length - 1] : 0).toFixed(2), esik33: rec33, esik50: rec50, esik100: rec100,
        },
        takilmalar: hitches.map(h => ({ ...h })), longtask: longtasks.map(l => ({ ...l })), olaylar: events.map(e => ({ ...e })),
        bellek: { ornekMB: [...heaps], gcDususu: recGc },
        gpu: { olculdu: gs.length > 0, ortMs: +gmean.toFixed(2), p95Ms: +(gs.length ? gs[Math.min(gs.length - 1, Math.floor(0.95 * gs.length))] : 0).toFixed(2) },
        sayaclar: { ...snap.counters }, zamanlayicilar: { ...snap.timers },
        enYavaslar: snap.slowest.map(x => ({ ...x })), uyarilar: [...snap.warnings],
      };
    },
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
        const rb = doc.createElement('button');
        rb.textContent = 'Kayıt (60 sn)';
        rb.style.cssText = btn.style.cssText + ';margin-left:6px;background:#9be3a8';
        rb.onclick = () => { meter.record(!meter.recording); rb.textContent = meter.recording ? 'Kayıt sürüyor…' : 'Kayıt (60 sn)'; };
        const jb = doc.createElement('button');
        jb.textContent = 'JSON kopyala';
        jb.style.cssText = rb.style.cssText;
        jb.onclick = () => {
          const txt = JSON.stringify(meter.dump());
          const done = (ok: boolean) => { jb.textContent = ok ? 'Kopyalandı' : 'Kopyalanamadı'; setTimeout(() => { jb.textContent = 'JSON kopyala'; }, 1500); };
          if (deps.platform) deps.platform.copyText(txt).then(done); else done(false);
        };
        el.append(pre, btn, rb, jb);
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
