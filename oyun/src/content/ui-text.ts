// UI text table (Builder D, M1): Turkish player-facing strings shared by the panels, menu bar and overlays.
// Rules: no price-hike word, no em-dash (tools/content-lint.mjs). The v2 panel bodies keep their inline copy in game/ui/v2ui.ts.
export interface PanelMeta { title: string; sub: string; icon: string; acc: string; }
export const PANEL_META: Record<string, PanelMeta> = {
  isciler: { title: 'Ekip', sub: 'İşçiler, rütbeler ve keyifler', icon: 'people', acc: 'var(--blue)' },
  menu: { title: 'Menü', sub: 'Ürün kademeleri ve fiyatlar', icon: 'menu', acc: 'var(--red)' },
  dekor: { title: 'Dekor', sub: 'Büfeni güzelleştir', icon: 'dekor', acc: 'var(--tile)' },
  gorevler: { title: 'Görevler', sub: 'Sipariş Panosu ve başarımlar', icon: 'gorev', acc: 'var(--tea)' },
  kedi: { title: 'Kedi Defteri', sub: 'Mahallenin kedileri', icon: 'cat', acc: 'var(--pink)' },
  karne: { title: 'Karne', sub: 'Notlar ve yıldızlar', icon: 'karne', acc: 'var(--olive)' },
  tadilat: { title: 'Tadilat', sub: 'Büfeni büyüt', icon: 'hammer', acc: 'var(--wood)' },
  ayarlar: { title: 'Ayarlar', sub: 'Ses, görüntü ve kayıt', icon: 'gear', acc: 'var(--blue)' },
  isbul: { title: 'İş ve İşçi Bulma', sub: 'Panodaki adaylar', icon: 'newspaper', acc: 'var(--wood)' },
};
export const MENU_BAR: Record<string, string> = { menu: 'Menü', isciler: 'Ekip', karne: 'Karne', dekor: 'Dekor', gorevler: 'Görevler', kedi: 'Kediler', tadilat: 'Tadilat' };
export const UI_TEXT = {
  needMoney: 'Biraz daha para lazım.',
  noSlot: 'Boş dekor yeri yok. Önce birini kaldır.',
  orderReady: 'Sipariş hazır: Görevler\'den ödülünü al!',
  tutorialWalk: 'Sürükleyerek yürü.',
  adNote: 'Bu bir deneme reklamı. Gerçek reklam gösterilmez, sadece süre dolar.',
  loading: 'Yükleniyor',
} as const;
