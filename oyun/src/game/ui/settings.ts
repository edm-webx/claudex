// Settings sheet (Builder D), v2 'ayarlar' look (sb-card / sb-set / sb-tog / sb-seg classes from the ported CSS).
// M0 rows: Ses (mute), three bus sliders (Müzik / Efekt / Ses), Görüntü kalitesi (Otomatik / Düşük / Orta / Yüksek,
// MOTOR §19), Pil tasarrufu (30 fps), Titreşim, Hız ölçer (A's perf.show overlay, which has "Raporu kopyala").
// Opens on ui.root 'ui:open' with detail 'ayarlar' (HUD gear). Decision: values persist through the optional
// `onChange(settingsPatch)` callback (boot writes them into GameState.settings); quality persists through quality.set().
import type { Ui, Quality, Audio, PerfMeter, Platform, QualitySetting } from '../../engine/api';
import { ICONS } from '../../engine/ui/v2-style';

export interface SettingsPanel { open(): void; close(): void; }
export interface SettingsDeps {
  ui: Ui; quality: Quality; audio: Audio; perf: PerfMeter;
  platform?: Pick<Platform, 'copyText'>;
  onChange?(patch: Record<string, unknown>): void;
}

const QUAL: [QualitySetting, string][] = [['auto', 'Otomatik'], ['akici', 'Düşük'], ['dengeli', 'Orta'], ['sahane', 'Yüksek']];

export function createSettings(deps: SettingsDeps): SettingsPanel {
  const { ui, quality, audio, perf } = deps;
  let isOpen = false;
  const tog = (on: boolean, a: string, label: string) =>
    `<button class="sb-tog${on ? ' on' : ''}" data-a="${a}" data-v="${on ? 0 : 1}" aria-label="${label}" aria-pressed="${on}"></button>`;
  const slider = (bus: 'music' | 'sfx' | 'voice', label: string) =>
    `<div class="sb-set" style="min-height:0;gap:8px"><span style="flex:0 0 64px;font-weight:800">${label}</span><input type="range" min="0" max="100" step="5" value="${Math.round(audio.buses[bus].volume * 100)}" data-a="vol" data-id="${bus}" style="flex:1;pointer-events:auto"></div>`;
  function html(): string {
    const muted = audio.buses.sfx.muted && audio.buses.music.muted;
    const q = quality.setting();
    const st = ui.settings;
    let s = `<div class="sb-card sb-set">${muted ? ICONS.mute : ICONS.sound}<div class="sb-grow"><h3>Ses</h3><p>Müzik, cızırtı ve martı çığlıkları</p></div>${tog(!muted, 'setMuted', 'Ses')}</div>`;
    s += `<div class="sb-card">${slider('music', 'Müzik')}${slider('sfx', 'Efekt')}${slider('voice', 'Konuşma')}</div>`;
    s += `<div class="sb-card sb-set">${ICONS.vibrate}<div class="sb-grow"><h3>Titreşim</h3><p>Para toplarken kısa titreşim</p></div>${tog(st.haptics, 'setHaptic', 'Titreşim')}</div>`;
    s += `<div class="sb-card"><div class="sb-set" style="min-height:0;margin-bottom:8px">${ICONS.quality}<div class="sb-grow"><h3>Görüntü kalitesi</h3><p>Otomatik, telefonuna göre ayarlar.</p></div></div><div class="sb-seg">${QUAL.map(x => `<button class="${q === x[0] ? 'on' : ''}" data-a="setQuality" data-v="${x[0]}">${x[1]}</button>`).join('')}</div></div>`;
    s += `<div class="sb-card sb-set">${ICONS.bolt}<div class="sb-grow"><h3>Pil tasarrufu</h3><p>Saniyede 30 kare, telefon daha az ısınır.</p></div>${tog(st.batterySaver, 'setBattery', 'Pil tasarrufu')}</div>`;
    s += `<div class="sb-card sb-set">${ICONS.stopwatch}<div class="sb-grow"><h3>Hız ölçer</h3><p>Kare hızı ve en yavaş parçalar. Raporu kopyalayıp gönderebilirsin.</p></div>${tog(!!perf.visible, 'setPerf', 'Hız ölçer')}</div>`;
    s += `<div class="sb-foot">Sabri'nin Büfesi · Martıköy İskelesi<br>Oyundaki bütün markalar ve kişiler uydurmadır.</div>`;
    return s;
  }
  const render = () => ui.sheet('ayarlar', { title: 'Ayarlar', sub: 'Ses, görüntü ve kayıt', icon: 'gear', acc: 'var(--blue)', html: html() }, actions);
  const changed = (patch: Record<string, unknown>) => { try { deps.onChange?.(patch); } catch (e) { console.error(e); } };
  const actions: Record<string, (id?: string, v?: string) => void> = {
    setMuted(_id, v) { const m = v !== '1'; audio.buses.sfx.muted = m; audio.buses.music.muted = m; audio.buses.voice.muted = m; if (!m) audio.unlock(); ui.hud({ muted: m }); changed({ muted: m }); render(); },
    vol(id, v) { const bus = id as 'music' | 'sfx' | 'voice'; if (!audio.buses[bus]) return; audio.buses[bus].volume = (+(v ?? 0)) / 100; changed({ [bus]: audio.buses[bus].volume }); },
    setHaptic(_id, v) { ui.settings.haptics = v === '1'; changed({ haptics: ui.settings.haptics }); render(); },
    setQuality(_id, v) { quality.set(v as QualitySetting); changed({ quality: v }); render(); },
    setBattery(_id, v) { ui.settings.batterySaver = v === '1'; quality.batterySaver(ui.settings.batterySaver); changed({ batterySaver: ui.settings.batterySaver }); render(); },
    setPerf(_id, v) { const on = v === '1'; try { perf.show(on); } catch { /* headless */ } changed({ perfMeter: on }); render(); },
    __close() { isOpen = false; },
  };
  ui.root.addEventListener('ui:open', e => { if ((e as CustomEvent).detail === 'ayarlar') { if (isOpen) { ui.close(); isOpen = false; } else api.open(); } });
  ui.root.addEventListener('ui:mute', e => { changed({ muted: !!(e as CustomEvent).detail }); if (isOpen) render(); });
  const api: SettingsPanel = {
    open() { isOpen = true; render(); },
    close() { isOpen = false; ui.close(); },
  };
  return api;
}
