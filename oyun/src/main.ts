// Lead-owned entry (Vite input). Everything else happens in game/boot.ts (Builder A).
import { boot } from './game/boot';
import { installSkin } from './engine/ui/skin';
installSkin();

// 2026-10-25 user: the game restarts as a brand new world. Change this tag to wipe every device's local save,
// remembered login and settings once on the next load (the server side is wiped with supabase-herkesi-sil.sql).
const WORLD_EPOCH = 'mahalle-online-yeni-dunya-1';

async function freshWorld(): Promise<void> {
  try {
    if (localStorage.getItem('martikoy-epoch') === WORLD_EPOCH) return;
    localStorage.clear();
    sessionStorage.clear();
    await new Promise<void>(res => {
      try {
        const to = setTimeout(res, 2500), r = indexedDB.deleteDatabase('marti');
        r.onsuccess = r.onerror = r.onblocked = () => { clearTimeout(to); res(); };
      } catch { res(); }
    });
    localStorage.setItem('martikoy-epoch', WORLD_EPOCH);
  } catch { /* storage blocked: the game still starts */ }
}

freshWorld().then(() => boot(document.getElementById('c') as HTMLCanvasElement | null)).catch(err => {
  console.error('[marti] boot failed', err);
  const fail = document.getElementById('fail');
  if (fail) fail.style.display = 'flex';
});
