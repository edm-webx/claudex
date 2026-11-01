// Gulag Kaçışı 3D: prosedürel ses (WebAudio, dosya yok)
'use strict';
const Ses = (() => {
  let A = null, ana, muzG, efG, yank, gurultu, ruzgarG, kalpT = 0, muzAcik = false, gerilim = 0, ic = false;
  const ayar = { ana: 0.8, muzik: 0.6, efekt: 0.9 };
  try { Object.assign(ayar, JSON.parse(localStorage.getItem('gk3-ses') || '{}')); } catch (e) {}

  function baslat() {
    if (A) { if (A.state === 'suspended') A.resume(); return; }
    try { A = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    ana = A.createGain(); muzG = A.createGain(); efG = A.createGain();
    const komp = A.createDynamicsCompressor(); komp.threshold.value = -14; komp.ratio.value = 4;
    muzG.connect(ana); efG.connect(ana); ana.connect(komp); komp.connect(A.destination);
    // yankı
    yank = A.createConvolver();
    const n = A.sampleRate * 2.6 | 0, b = A.createBuffer(2, n, A.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3); }
    yank.buffer = b; const yg = A.createGain(); yg.gain.value = 0.35; yank.connect(yg); yg.connect(ana);
    gurultu = A.createBuffer(1, A.sampleRate * 2, A.sampleRate);
    const gd = gurultu.getChannelData(0); for (let i = 0; i < gd.length; i++) gd[i] = Math.random() * 2 - 1;
    uygula(); ruzgar(); muzik();
  }
  function uygula() { if (!A) return; ana.gain.value = ayar.ana; muzG.gain.value = ayar.muzik * 0.55; efG.gain.value = ayar.efekt; }
  function kaydet() { try { localStorage.setItem('gk3-ses', JSON.stringify(ayar)); } catch (e) {} uygula(); }
  const hazir = () => A && A.state === 'running';

  function bagla(g, yan, hedef) { g.connect(hedef || efG); if (yan) { const s = A.createGain(); s.gain.value = yan; g.connect(s); s.connect(yank); } }
  // filtreli gürültü patlaması
  function G(t, sure, ses, tip, f0, f1, q, yan, hedef) {
    const s = A.createBufferSource(); s.buffer = gurultu;
    const f = A.createBiquadFilter(); f.type = tip; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + sure); f.Q.value = q || 1;
    const g = A.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(ses, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
    s.connect(f); f.connect(g); bagla(g, yan, hedef); s.start(t, Math.random()); s.stop(t + sure + 0.05);
  }
  function O(t, sure, ses, tip, f0, f1, yan, atak, hedef) {
    const o = A.createOscillator(), g = A.createGain(); o.type = tip; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + sure);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(ses, t + (atak || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
    o.connect(g); bagla(g, yan, hedef); o.start(t); o.stop(t + sure + 0.05);
  }
  function can(f, t, sure, ses, yan, hedef) { [[1, 1], [2.76, 0.35], [5.4, 0.15]].forEach(([r, a], i) => O(t, sure / (1 + i * 0.8), ses * a, 'sine', f * r, 0, yan, 0.003, hedef)); }

  function ruzgar() {
    const s = A.createBufferSource(); s.buffer = gurultu; s.loop = true;
    const f = A.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.6;
    ruzgarG = A.createGain(); ruzgarG.gain.value = 0.06;
    const l = A.createOscillator(), lg = A.createGain(); l.frequency.value = 0.09; lg.gain.value = 0.04; l.connect(lg); lg.connect(ruzgarG.gain);
    const l2 = A.createOscillator(), l2g = A.createGain(); l2.frequency.value = 0.05; l2g.gain.value = 180; l2.connect(l2g); l2g.connect(f.frequency);
    s.connect(f); f.connect(ruzgarG); ruzgarG.connect(efG); s.start(); l.start(); l2.start();
  }

  // Müzik: Dorian minör, yavaş çan + derin bas + gerilimde nabız
  const KOK = 110, OLC = [0, 2, 3, 5, 7, 9, 10, 12, 14, 15];
  const AKOR = [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-5, -1, 2]];
  function muzik() {
    if (muzAcik) return; muzAcik = true;
    let sonraki = A.currentTime + 0.5, olcu = 0;
    const TEMPO = 2.4;
    setInterval(() => {
      if (!hazir()) return;
      if (sonraki < A.currentTime - 1) sonraki = A.currentTime + 0.1;
      while (sonraki < A.currentTime + 0.8) { olcuCal(olcu++, sonraki, TEMPO); sonraki += TEMPO; }
    }, 200);
  }
  function hz(y) { return KOK * Math.pow(2, y / 12); }
  function olcuCal(i, t, T) {
    const ak = AKOR[(i >> 1) % 4];
    // pad
    ak.forEach(y => [-7, 7].forEach(dt => {
      const o = A.createOscillator(), f = A.createBiquadFilter(), g = A.createGain();
      o.type = 'sawtooth'; o.frequency.value = hz(y); o.detune.value = dt; f.type = 'lowpass';
      f.frequency.setValueAtTime(ic ? 300 : 420, t); f.frequency.linearRampToValueAtTime(ic ? 600 : 900, t + T * 0.6);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.018, t + T * 0.45); g.gain.linearRampToValueAtTime(0, t + T * 1.05);
      o.connect(f); f.connect(g); bagla(g, 0.6, muzG); o.start(t); o.stop(t + T * 1.1);
    }));
    // bas
    O(t, T * 0.9, 0.09, 'triangle', hz(ak[0] - 12), 0, 0.1, 0.05, muzG);
    // çan melodisi (seyrek)
    for (let k = 0; k < 4; k++) if (Math.random() < 0.38) can(hz(OLC[(Math.random() * OLC.length) | 0] + 12), t + k * T / 4, 2.2, 0.035, 0.7, muzG);
    // gerilim nabzı
    if (gerilim > 0.15) for (let k = 0; k < 8; k++) O(t + k * T / 8, 0.12, 0.05 * gerilim, 'square', hz(ak[0] - 12), 0, 0, 0.003, muzG);
  }

  const ef = {
    adim(kar) { if (!hazir()) return; const t = A.currentTime; if (kar) { G(t, 0.09, 0.12, 'bandpass', 2600, 900, 0.9); G(t + 0.02, 0.06, 0.05, 'highpass', 5000, 0, 0.7); } else { G(t, 0.07, 0.16, 'lowpass', 500, 120, 1, 0.15); } },
    zipla() { if (!hazir()) return; const t = A.currentTime; G(t, 0.12, 0.08, 'bandpass', 900, 2200, 1); O(t, 0.1, 0.03, 'sine', 220, 330); },
    dus(kar) { if (!hazir()) return; const t = A.currentTime; G(t, 0.18, kar ? 0.18 : 0.22, kar ? 'bandpass' : 'lowpass', kar ? 1800 : 400, 300, 1, 0.1); O(t, 0.15, 0.08, 'sine', 90, 45); },
    al() { if (!hazir()) return; const t = A.currentTime; [0, 4, 7, 12].forEach((y, i) => can(hz(y + 24), t + i * 0.07, 0.9, 0.06, 0.5)); },
    ordek() { if (!hazir()) return; const t = A.currentTime; [0, 0.13].forEach(d => { O(t + d, 0.12, 0.12, 'square', 900, 500, 0.2); G(t + d, 0.1, 0.06, 'bandpass', 1400, 700, 3); }); },
    not() { if (!hazir()) return; const t = A.currentTime; G(t, 0.25, 0.1, 'highpass', 3000, 6000, 0.5, 0.2); },
    salter() { if (!hazir()) return; const t = A.currentTime; G(t, 0.05, 0.4, 'bandpass', 2500, 0, 4, 0.3); O(t, 0.4, 0.15, 'sawtooth', 120, 40, 0.3); G(t + 0.05, 0.5, 0.2, 'highpass', 4000, 0, 1, 0.3); },
    vin() { if (!hazir()) return; const t = A.currentTime; O(t, 0.6, 0.12, 'sawtooth', 60, 30, 0.3); G(t, 0.3, 0.12, 'lowpass', 300, 80); },
    kapi() { if (!hazir()) return; const t = A.currentTime; for (let i = 0; i < 6; i++) G(t + i * 0.09, 0.08, 0.14, 'bandpass', 1200 + Math.random() * 800, 0, 6, 0.3); O(t, 1.1, 0.12, 'sawtooth', 70, 50, 0.3, 0.1); },
    kilit() { if (!hazir()) return; const t = A.currentTime; G(t, 0.04, 0.4, 'bandpass', 3200, 0, 8, 0.3); G(t + 0.12, 0.06, 0.4, 'bandpass', 1800, 0, 8, 0.3); can(660, t + 0.15, 1.2, 0.05, 0.4); },
    makas() { if (!hazir()) return; const t = A.currentTime; G(t, 0.05, 0.4, 'bandpass', 4200, 0, 10, 0.2); can(1900, t, 0.5, 0.04, 0.3); G(t + 0.08, 0.3, 0.1, 'highpass', 3000, 0, 1); },
    sandik() { if (!hazir()) return; const t = A.currentTime; G(t, 0.22, 0.12, 'lowpass', 260, 120, 1.5); },
    plaka(on) { if (!hazir()) return; const t = A.currentTime; G(t, 0.05, 0.3, 'bandpass', 900, 0, 5, 0.2); O(t, 0.2, 0.06, 'sine', on ? 440 : 330, on ? 660 : 220, 0.2); },
    firlat() { if (!hazir()) return; const t = A.currentTime; G(t, 0.25, 0.1, 'bandpass', 600, 2400, 2); },
    havla(r) { if (!hazir()) return; const t = A.currentTime + (r || 0); [0, 0.22].forEach(d => { O(t + d, 0.16, 0.22, 'sawtooth', 360, 190, 0.25); G(t + d, 0.12, 0.12, 'bandpass', 1300, 500, 1.2, 0.2); }); },
    hapur() { if (!hazir()) return; const t = A.currentTime; for (let i = 0; i < 4; i++) G(t + i * 0.18, 0.1, 0.06, 'bandpass', 500, 300, 2); },
    supheli() { if (!hazir()) return; const t = A.currentTime; O(t, 0.35, 0.1, 'triangle', 330, 520, 0.4); },
    farketti() { if (!hazir()) return; const t = A.currentTime; O(t, 0.25, 0.14, 'square', 660, 0, 0.3); O(t + 0.12, 0.35, 0.14, 'square', 880, 0, 0.3); },
    yakalandi() {
      if (!hazir()) return; const t = A.currentTime;
      for (let i = 0; i < 4; i++) { O(t + i * 0.5, 0.25, 0.12, 'sawtooth', 620, 0, 0.3, 0.02); O(t + i * 0.5 + 0.25, 0.25, 0.12, 'sawtooth', 460, 0, 0.3, 0.02); }
      G(t, 0.6, 0.2, 'lowpass', 600, 80, 1, 0.3);
    },
    kontrol() { if (!hazir()) return; const t = A.currentTime; G(t, 0.6, 0.15, 'bandpass', 700, 2000, 1, 0.3); [0, 7, 12].forEach((y, i) => can(hz(y + 12), t + i * 0.12, 1.4, 0.05, 0.6)); },
    bitti() { if (!hazir()) return; const t = A.currentTime; [0, 3, 7, 10, 12, 15].forEach((y, i) => can(hz(y + 12), t + i * 0.14, 2.4, 0.06, 0.8)); },
    yazi() { if (!hazir()) return; const t = A.currentTime; G(t, 0.025, 0.05, 'bandpass', 2400 + Math.random() * 900, 0, 6); },
    tik() { if (!hazir()) return; const t = A.currentTime; O(t, 0.05, 0.05, 'square', 880, 0); },
    sigorta() { if (!hazir()) return; const t = A.currentTime; G(t, 0.06, 0.3, 'bandpass', 2800, 0, 6, 0.3); O(t + 0.05, 0.5, 0.08, 'sine', 120, 240, 0.3); },
    karartma() { if (!hazir()) return; const t = A.currentTime; O(t, 2.2, 0.2, 'sawtooth', 120, 25, 0.5, 0.01); G(t, 1.6, 0.15, 'lowpass', 800, 60, 1, 0.5); },
  };

  function kalp(dt, seviye) {
    gerilim += (seviye - gerilim) * Math.min(1, dt * 2);
    if (!hazir() || seviye < 0.25) return;
    kalpT -= dt; if (kalpT > 0) return;
    kalpT = 0.95 - seviye * 0.45; const t = A.currentTime;
    O(t, 0.12, 0.25 * seviye, 'sine', 62, 40); O(t + 0.16, 0.1, 0.18 * seviye, 'sine', 58, 38);
  }
  function ortam(icMekan) { ic = icMekan; if (ruzgarG && A) ruzgarG.gain.setTargetAtTime(icMekan ? 0.015 : 0.06, A.currentTime, 0.8); }

  return { baslat, ayar, kaydet, ef, kalp, ortam };
})();
