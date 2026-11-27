/**
 * "Flaşı azalt" anahtarı (2026-11-27, ışığa duyarlılık / epilepsi güvenliği). Tek kaynak: ayar kaydı settings.flasAzalt
 * (varsayılan AÇIK; kayıtla ve bulutla gider). Kapalıyken bile şimşek tek, nadir ve yumuşak kalır; açıkken şimşek,
 * kamera flaşı, geçiş flaşı ve ekran sarsıntısı tamamen yumuşar ya da kapanır. Saf, bağımlılıksız.
 */
let azalt = true;
const abone = new Set<(v: boolean) => void>();

/** Ayar kaydındaki değer: boş/bilinmiyorsa AÇIK (tarayıcı prefers-reduced-motion da zaten açık anlamına gelir). */
export function flasVarsayilan(kayit: unknown): boolean { return kayit === false ? false : true; }
export function flasAzalt(): boolean { return azalt; }
export function setFlasAzalt(v: boolean): void { const n = !!v; if (n === azalt) return; azalt = n; for (const f of abone) { try { f(n); } catch { /* */ } } }
export function flasAbone(f: (v: boolean) => void): () => void { abone.add(f); return () => { abone.delete(f); }; }
