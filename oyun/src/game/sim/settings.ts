/** Settings commands (clamped). Owner: Builder A. Pure. */
import type { SettingsSave } from './schema';
import type { SettingKey } from './commands';
import { clamp } from './util';

export function applySetting(s: SettingsSave, key: SettingKey, value: unknown): boolean {
  switch (key) {
    case 'muted': case 'colorBlindIcons': case 'haptics': case 'batterySaver': case 'perfMeter': case 'ownMusic': s[key] = !!value; return true;
    case 'quality': if (value === 'auto' || value === 'akici' || value === 'dengeli' || value === 'sahane') { s.quality = value; return true; } return false;
    case 'music': case 'sfx': case 'voice': s[key] = clamp(Number(value) || 0, 0, 1); return true;
    case 'textScale': s.textScale = clamp(Number(value) || 1, 0.8, 1.6); return true;
    case 'hand': if (value === 'left' || value === 'right') { s.hand = value; return true; } return false;
  }
  return false;
}
