// Yönetici paneli (2026-10-25). Sadece `adminler` tablosundaki hesaba görünür (net/admin.ts); oyuncular düğmeyi bile görmez.
// Bu modül ayrıca her oyuncuda gelen komutları (kick/ışınlan/para/altın/mesaj) birkaç saniyede bir çekip uygular.
import { hesap, cikisYap } from '../net/supa';
import { REGIONS } from '../../content/disari/martikoy';
import { logOku, type LogSatir } from '../net/log';
import { adminMi, hesapSifirla, komutGonder, yasakla, yasakKaldir, sustur, susturKaldir, listeler, oyuncuAra, adlar, komutlariCek, susturmalariYenile, type Komut, type Satir } from '../net/admin';

export interface AdminPeer { peer: string; uid: string; hn: string; ad: string; x: number; z: number }
export interface AdminPanelView { update(dt: number): void }
interface Deps {
  root: HTMLElement; peers: () => AdminPeer[]; teleport: (x: number, z: number) => void; myPos: () => { x: number; z: number };
  addMoney: (n: number) => void; addGold: (n: number) => void; toast: (t: string) => void; sfx?: (id: string) => void;
  /** sim command (setTime, freezeTime, force ...) and a few direct state edits for the admin's own game */
  setMoney: (n: number) => void; setGold: (n: number) => void; resetMe: () => void; editor: () => void; izgara: () => boolean; stands: () => { id: string; name: string; owned: boolean; x: number; z: number }[];
  command: (c: Record<string, unknown>) => void; setLevel: (n: number) => void; setMuted: (m: boolean) => void; allPadKeys: () => string[];
  /** 2026-11-08 İşletme sekmesi: büfe aşaması, tadilat, kafeler, kulüp, mevsim süsü */
  isletme?: () => { stage: number; tadilat: { to: number; left: number } | null; money: number; gold: number; level: number; stars: number; kafeler: { id: string; ad: string; lv: number; isci: number }[]; takim: string | null; mevsim: string };
  setMevsim?: (k: string) => void;
}

const CSS = `
.ad-fab{position:fixed;right:10px;top:calc(env(safe-area-inset-top,0px) + 74px);z-index:60;pointer-events:auto;width:48px;height:48px;border-radius:50%;border:3px solid #3b2a20;background:#ffd23f;box-shadow:0 4px 0 #3b2a20;font-size:22px;cursor:pointer}
.ad-p{position:fixed;right:66px;top:calc(env(safe-area-inset-top,0px) + 74px);z-index:61;pointer-events:auto;width:min(380px,calc(100vw - 80px));max-height:calc(100vh - 100px);overflow:auto;background:#fdf3e1;color:#3b2a20;border:4px solid #3b2a20;border-radius:18px;box-shadow:0 6px 0 #3b2a20;padding:10px;font:700 14px/1.3 var(--body);display:none}
.ad-p.on{display:block}
.ad-h{font:900 18px var(--disp);margin:0 0 6px}
.ad-top{position:sticky;top:-12px;z-index:2;background:#fdf3e1;margin:-12px -12px 6px;padding:10px 12px 4px;border-bottom:3px solid #3b2a20}
.ad-top .ad-x{float:right;min-height:30px;min-width:30px}
.ad-stat{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:8px}.ad-stat div{border:2px solid #3b2a20;border-radius:9px;background:#fff;padding:3px 6px;font:800 12px var(--body)}.ad-stat b{display:block;font:900 14px var(--disp)}
.ad-b.cur{background:#ffd23f;outline:3px solid #e0533c}
@media (min-width:900px){.ad-p{width:440px;max-height:calc(100vh - 110px)}}
.ad-tabs{display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap}
.ad-t{flex:1;min-height:38px;border:3px solid #3b2a20;border-radius:10px;background:#fff6e6;font:900 13px var(--disp);color:#3b2a20;cursor:pointer;padding:0 4px}.ad-t.on{background:#ffd23f}
.ad-row{display:flex;align-items:center;gap:6px;border:2px solid #3b2a20;border-radius:10px;background:#fff;padding:5px 8px;margin-bottom:5px}
.ad-row b{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ad-row small{opacity:.65;font-weight:700}
.ad-b{min-height:34px;min-width:34px;border:3px solid #3b2a20;border-radius:9px;background:#fff6e6;font:900 13px var(--disp);color:#3b2a20;cursor:pointer;padding:0 8px}
.ad-b.red{background:#ff8b7a}.ad-b.arm{background:#b3261e;color:#fff}.ad-b.grn{background:#8fd06b}
.ad-in{box-sizing:border-box;width:100%;min-height:40px;border:3px solid #3b2a20;border-radius:10px;padding:4px 10px;font:800 15px var(--body);background:#fff;color:#3b2a20;margin-bottom:6px}
.ad-msg{min-height:18px;font:800 13px var(--body);margin-top:4px}
.ad-log{display:flex;align-items:center;gap:8px;width:100%;text-align:left;border:2px solid #3b2a20;border-radius:10px;background:#fff;padding:6px 8px;margin-bottom:5px;font:700 13px/1.25 var(--body);color:#3b2a20;cursor:pointer}
.ad-log:hover{background:#fff6d8}.ad-log i{font-style:normal;font-size:18px}.ad-log span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ad-log small{opacity:.6;white-space:nowrap}
.ad-log.yeni{border-color:#e0533c;box-shadow:inset 4px 0 0 #e0533c}.ad-new{background:#e0533c;color:#fff;border-radius:6px;padding:0 5px;font:900 11px var(--disp)}
.ad-det{border:3px solid #3b2a20;border-radius:12px;background:#fff;padding:10px;margin:6px 0;font:700 14px/1.4 var(--body);white-space:pre-wrap;word-break:break-word}
.ad-sel{border:3px solid #ffd23f;border-radius:12px;padding:8px;margin:6px 0;background:#fffbe8}
`;

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export function createAdminPanel(d: Deps): AdminPanelView {
  const st = document.createElement('style'); st.textContent = CSS; d.root.appendChild(st);
  let fab: HTMLButtonElement | null = null, panel: HTMLDivElement | null = null;
  let stSel = '';
  let tab: 'oy' | 'ara' | 'isl' | 'ben' | 'arac' | 'dunya' | 'duyuru' | 'liste' | 'log' = ((): 'oy' => { try { return (localStorage.getItem('ad-tab') as 'oy') || 'oy'; } catch { return 'oy'; } })(), sel: { id: string; ad: string; peer?: AdminPeer } | null = null, found: { id: string; ad: string }[] = [], msg = '', arm = '', names = new Map<string, string>();
  // oturum logu (2026-10-27): kişi listesi > kişinin kayıtları > tek kayıt
  let logs: LogSatir[] | null = [], logT = 0, logUid = '', logId = 0, logTur = '', logAdminToo = false;
  let frozen = false, pollT = 3, susT = 1, namesT = 0, listT = 0, lists: { yasaklar: Satir[]; susturmalar: Satir[] } = { yasaklar: [], susturmalar: [] };

  const say = (t: string) => { msg = t; paint(); };
  const run = async (f: () => Promise<string | null>, okText: string) => { const e = await f(); say(e ? '⚠ ' + e : '✓ ' + okText); try { d.sfx?.(e ? 'error' : 'buy'); } catch { /* */ } listT = 0; };
  const armed = (k: string) => arm === k;

  function ensureUi() {
    if (fab || !adminMi()) return;
    fab = document.createElement('button'); fab.className = 'ad-fab'; fab.textContent = '🛠'; fab.title = 'Yönetici paneli';
    panel = document.createElement('div'); panel.className = 'ad-p';
    d.root.appendChild(fab); d.root.appendChild(panel);
    fab.onclick = () => { panel!.classList.toggle('on'); namesT = 0; listT = 0; paint(); };
    for (const ev of ['pointerdown', 'wheel', 'keydown', 'keyup'] as const) panel.addEventListener(ev, e => e.stopPropagation(), { passive: true } as never);
    panel.addEventListener('click', onClick);
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && panel?.classList.contains('on')) { panel.classList.remove('on'); } });
    paint();
  }

  const selBlock = () => !sel ? '' : `<div class="ad-sel"><b>${esc(sel.ad)}</b>${sel.peer ? ' <small>(oyunda)</small>' : ' <small>(çevrimdışı)</small>'}
<div class="ad-tabs" style="margin:6px 0 0">
${sel.peer ? `<button class="ad-b" data-a="tp-to">Yanına git</button><button class="ad-b" data-a="tp-me">Yanıma çek</button><button class="ad-b red${armed('kick') ? ' arm' : ''}" data-a="kick">${armed('kick') ? 'Emin misin?' : 'Kickle'}</button>` : ''}
<button class="ad-b red${armed('ban') ? ' arm' : ''}" data-a="ban">${armed('ban') ? 'Emin misin?' : 'Banla'}</button>
<button class="ad-b${armed('mute') ? ' arm' : ''}" data-a="mute">${armed('mute') ? 'Emin misin?' : 'Sustur (30dk)'}</button>
<button class="ad-b" data-a="unban">Banı kaldır</button><button class="ad-b" data-a="unmute2">Susturmayı kaldır</button><button class="ad-b grn" data-a="m1">+10K ₺</button><button class="ad-b grn" data-a="m2">+100K ₺</button><button class="ad-b grn" data-a="g1">+50 🥨</button><button class="ad-b red" data-a="mm">-10K ₺</button><button class="ad-b red" data-a="gm">-50 🥨</button></div>
<input class="ad-in" data-f="neden" placeholder="Ban nedeni (isteğe bağlı)" style="margin-top:6px">
<input class="ad-in" data-f="deger" inputmode="numeric" placeholder="Değer (ayarlamak için)">
<div class="ad-tabs"><button class="ad-b" data-a="p-para">Parasını şuna ayarla</button><button class="ad-b" data-a="p-altin">Altınını ayarla</button><button class="ad-b" data-a="p-sev">Seviyesini ayarla</button><button class="ad-b red${armed('wipe') ? ' arm' : ''}" data-a="wipe">${armed('wipe') ? 'Emin misin? HER ŞEY SİLİNİR' : 'Tüm bilgilerini sil'}</button></div></div>`;

  const rowOf = (id: string, ad: string, small: string, peer?: AdminPeer) => `<div class="ad-row"><b>${esc(ad)}</b><small>${esc(small)}</small><button class="ad-b" data-sel="${id}" data-ad="${esc(ad)}"${peer ? ` data-peer="${esc(peer.peer)}"` : ''}>Seç</button></div>`;

  function body(): string {
    const ps = d.peers();
    if (tab === 'oy') return (ps.length ? ps.map(p => rowOf(p.uid, names.get(p.uid) || p.hn || p.ad, p.ad, p)).join('') : '<div class="ad-row"><b>Şu an başka oyuncu yok.</b></div>') + selBlock();
    if (tab === 'ara') return `<input class="ad-in" data-f="ara" placeholder="Kullanıcı adı ara (çevrimdışı da bulur)"><button class="ad-b" data-a="ara">Ara</button><div style="margin-top:6px">${found.map(f => rowOf(f.id, f.ad, '')).join('')}</div>` + selBlock();
    if (tab === 'isl') {
      const m = d.isletme?.(); if (!m) return '<small>Oyun yüklenmedi.</small>';
      const NAMES = ['Seyyar', 'Büfe', 'Çay bahçesi', 'Lokanta', 'Zincir şube', 'Deniz platformu', 'Balık restoranı', 'Boğaz restoranı', 'Şef mutfağı', 'Fine dining'];
      const KA = ['Yok', 'Köşe kafe', 'Kafe', 'Bistro', 'Teraslı bistro', 'Gurme bistro'];
      return `<div class="ad-stat"><div>Para<b>${Math.round(m.money).toLocaleString('tr')} ₺</b></div><div>Altın<b>${m.gold}</b></div><div>Seviye<b>${m.level} · ${m.stars}★</b></div></div>
<div class="ad-h">Büfe aşaması <small>(şu an ${m.stage}: ${NAMES[m.stage - 1] || ''})</small></div><div class="ad-tabs">${NAMES.map((n, i) => `<button class="ad-b${m.stage === i + 1 ? ' cur' : ''}" data-a="stage" data-n="${i + 1}" title="${n}">${i + 1}. ${n}</button>`).join('')}</div>
<div class="ad-tabs">${m.tadilat ? `<button class="ad-b grn" data-a="tadBitir">🔨 Tadilatı bitir (${m.tadilat.to}. aşama, ${Math.ceil(m.tadilat.left)} sn kaldı)</button>` : `<button class="ad-b" data-a="tadBaslat">🔨 Sonraki tadilatı başlat (bedava)</button>`}<button class="ad-b" data-a="git" data-n="-31" data-z="-4">🍽 Restorana git</button></div>
<div class="ad-h" style="margin-top:8px">Karşı yaka kafeleri</div>${m.kafeler.map(k => `<div class="ad-row"><b>${esc(k.ad)}</b><small>${KA[k.lv] || ''}${k.isci ? ' · 👷' + k.isci : ''}</small></div><div class="ad-tabs">${[0, 1, 2, 3, 4, 5].map(l => `<button class="ad-b${k.lv === l ? ' cur' : ''}" data-a="kafeLv" data-id="${k.id}" data-n="${l}">${l ? l : 'Sat'}</button>`).join('')}<button class="ad-b" data-a="kafeIsci" data-id="${k.id}">👷 +1 işçi</button></div>`).join('')}
<div class="ad-h" style="margin-top:8px">Kulüp</div><div class="ad-row"><b>${m.takim ? esc(m.takim) : 'Kulüp yok'}</b><small>${m.takim && m.stage >= 3 ? 'sponsor afişleri açık' : m.takim ? 'sponsorluk 3. aşamada' : ''}</small></div>${m.takim ? '' : '<input class="ad-in" data-f="takim" maxlength="16" placeholder="Kulüp adı"><button class="ad-b grn" data-a="takimKur">⚽ Kulüp kur (bedava)</button>'}
<div class="ad-h" style="margin-top:8px">Süsleme önizleme <small>(şu an: ${esc(m.mevsim || 'takvim')})</small></div><div class="ad-tabs">${[['', 'Takvime göre'], ['bayrak', '🇹🇷 Bayram'], ['lale', '🌷 Lale'], ['yilbasi', '🎄 Yılbaşı'], ['yok', 'Kapalı']].map(([k, l]) => `<button class="ad-b${(m.mevsim || '') === k ? ' cur' : ''}" data-a="mevsim" data-n="${k}">${l}</button>`).join('')}</div>`;
    }
    if (tab === 'ben') return `<div class="ad-h">Para (kendine)</div><div class="ad-tabs"><button class="ad-b grn" data-a="sm" data-n="10000">+10K</button><button class="ad-b grn" data-a="sm" data-n="1000000">+1M</button><button class="ad-b grn" data-a="sm" data-n="1000000000">+1B</button><button class="ad-b red" data-a="sm" data-n="-10000">-10K</button><button class="ad-b red" data-a="sm0">Parayı sıfırla</button></div>
<input class="ad-in" data-f="tam" inputmode="numeric" placeholder="Tam değer (ayarlamak için)"><div class="ad-tabs"><button class="ad-b" data-a="set-para">Parayı şuna ayarla</button><button class="ad-b" data-a="set-altin">Altını şuna ayarla</button><button class="ad-b red${armed('resetMe') ? ' arm' : ''}" data-a="resetMe">${armed('resetMe') ? 'Emin misin? Kendi ilerlemen silinir' : 'Kendi ilerlemeni sil'}</button></div>
<input class="ad-in" data-f="miktar" inputmode="numeric" placeholder="Özel miktar (eksi yazarsan siler)"><button class="ad-b grn" data-a="sm-x">₺ ekle / sil</button>
<div class="ad-h" style="margin-top:8px">Altın simit</div><div class="ad-tabs"><button class="ad-b grn" data-a="sg" data-n="100">+100</button><button class="ad-b grn" data-a="sg" data-n="10000">+10K</button><button class="ad-b red" data-a="sg" data-n="-100">-100</button></div>
<div class="ad-h" style="margin-top:8px">Seviye</div><input class="ad-in" data-f="seviye" inputmode="numeric" placeholder="Seviye (1-99)"><button class="ad-b" data-a="lvl">Seviyeyi ayarla</button>`;
    if (tab === 'arac') return `<div class="ad-h">Işınlan</div><div class="ad-tabs">${REGIONS.filter(r => !r.island).map(r => `<button class="ad-b" data-a="git" data-n="${r.stop.x}" data-z="${r.stop.z}">${esc(r.short)}</button>`).join('')}</div>
<div class="ad-tabs">${([['🏪 Büfe', 0, -2], ['🍽 Salon', -17.5, -8.8], ['🌉 Üst geçit', 24, 7.6], ['☕ Meydan Kafe', -11.8, 37.9], ['⚓ Sahil Kafe', -11.8, 51.5], ['⚽ Halı saha', -25.2, 45], ['🏦 Banka', 11.7, 42], ['🛍 AVM', 20.15, 45.5], ['Ⓜ Metro', 8.5, 58], ['🏥 Hastane', 46.95, 47.5], ['🏫 Okul', 45, 46.5]] as [string, number, number][]).map(([l, x, z]) => `<button class="ad-b" data-a="git" data-n="${x}" data-z="${z}">${l}</button>`).join('')}</div>
<div class="ad-h" style="margin-top:8px">Kendi oyunun (sadece sende değişir)</div><div class="ad-tabs">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button class="ad-b" data-a="stage" data-n="${n}">Aşama ${n}</button>`).join('')}<button class="ad-b grn" data-a="hepsiniAc">Bütün kareleri aç</button><button class="ad-b" data-a="yildiz">5 yıldız</button><button class="ad-b" data-a="gunbitir">Günü bitir</button><button class="ad-b" data-a="hepsiLvl">Seviye 99</button></div>
<div class="ad-h" style="margin-top:8px">Standları taşı (kalıcı)</div><div class="ad-tabs">${d.stands().map(t => `<button class="ad-b${stSel === t.id ? ' grn' : ''}" data-a="stSec" data-id="${t.id}">${esc(t.name)}</button>`).join('')}</div>${stSel ? `<div class="ad-tabs"><button class="ad-b" data-a="stGit" data-dx="-0.5" data-dz="0">◀</button><button class="ad-b" data-a="stGit" data-dx="0" data-dz="-0.5">▲</button><button class="ad-b" data-a="stGit" data-dx="0" data-dz="0.5">▼</button><button class="ad-b" data-a="stGit" data-dx="0.5" data-dz="0">▶</button><button class="ad-b" data-a="stGit" data-dry="-1.5708">⟲</button><button class="ad-b" data-a="stGit" data-dry="1.5708">⟳</button></div>` : '<small>Önce bir stand seç, sonra oklarla taşı.</small>'}
<div class="ad-h" style="margin-top:8px">Olay çağır</div><div class="ad-tabs"><button class="ad-b" data-a="olay" data-n="ferry">Vapur</button><button class="ad-b" data-a="olay" data-n="gull">Martı</button><button class="ad-b" data-a="olay" data-n="vip">Gurme VIP</button><button class="ad-b" data-a="olay" data-n="kapkac">Kapkaççı</button><button class="ad-b" data-a="olay" data-n="sleep">Uyuyan işçi</button></div>
<div class="ad-h" style="margin-top:8px">Herkes (oyundaki herkes)</div><div class="ad-tabs"><button class="ad-b grn" data-a="herkesAltin">Herkese +50 altın</button><button class="ad-b" data-a="herkesPara2">Herkese +1M ₺</button><button class="ad-b red${armed('herkesAt') ? ' arm' : ''}" data-a="herkesAt">${armed('herkesAt') ? 'Emin misin?' : 'Herkesi at'}</button></div>`;
    if (tab === 'dunya') return `<div class="ad-h">Zaman</div><div class="ad-tabs">${[8, 12, 17, 19, 21, 23].map(h => `<button class="ad-b" data-a="saat" data-n="${h}">${h}:00</button>`).join('')}<button class="ad-b" data-a="dondur">Zamanı dondur/aç</button></div>
<div class="ad-h" style="margin-top:8px">Oyun</div><div class="ad-tabs"><button class="ad-b" data-a="sesKapat">Sesi kapat</button><button class="ad-b" data-a="sesAc">Sesi aç</button></div>
<div class="ad-h" style="margin-top:8px">Nesneleri taşı</div><div class="ad-tabs"><button class="ad-b grn" data-a="editorAc">🧱 Düzenleyiciyi aç/kapat</button><button class="ad-b" data-a="izgaraAc">🔲 Izgarayı aç/kapat</button></div>
<div class="ad-h" style="margin-top:8px">Herkese (oyundaki herkes)</div><div class="ad-tabs"><button class="ad-b grn" data-a="herkesPara">Herkese +10K ₺</button><button class="ad-b" data-a="herkesCek">Herkesi yanıma çek</button></div>`;
    if (tab === 'log') return logBody();
    if (tab === 'duyuru') return `<div class="ad-h">Herkese duyuru</div><input class="ad-in" data-f="duyuru" maxlength="100" placeholder="Mesaj"><button class="ad-b grn" data-a="duyuru">Gönder</button>`;
    return `<div class="ad-h">Yasaklılar</div>${lists.yasaklar.map(r => `<div class="ad-row"><b>${esc(r.ad)}</b><small>${esc(r.neden || '')}</small><button class="ad-b" data-a="unban" data-id="${r.id}">Kaldır</button></div>`).join('') || '<small>Yok</small>'}
<div class="ad-h" style="margin-top:8px">Susturulanlar</div>${lists.susturmalar.map(r => `<div class="ad-row"><b>${esc(r.ad)}</b><button class="ad-b" data-a="unmute" data-id="${r.id}">Kaldır</button></div>`).join('') || '<small>Yok</small>'}`;
  }

  const IC: Record<string, string> = { giris: '🚪', cikis: '👋', sohbet: '💬', pm: '🔒', karakter: '🧑' };
  const zm = (z: string) => { const t = new Date(z); return t.toLocaleDateString('tr', { day: '2-digit', month: '2-digit' }) + ' ' + t.toLocaleTimeString('tr', { hour: '2-digit', minute: '2-digit' }); };
  function logBody(): string {
    if (logs === null) return '<div class="ad-row"><b>Log tablosu yok. supabase-log.sql bir kez çalıştırılmalı.</b></div>';
    const me = hesap()?.id || '';
    // "ben yokken": everything after my previous login is marked new
    const myIn = logs.filter(r => r.uid === me && r.tur === 'giris'), since = myIn[1] ? new Date(myIn[1].zaman).getTime() : 0;
    const yeni = (r: LogSatir) => r.uid !== me && new Date(r.zaman).getTime() > since;
    const rows = logs.filter(r => (logAdminToo || r.uid !== me) && (!logTur || (logTur === 'yazi' ? r.tur === 'sohbet' || r.tur === 'pm' : r.tur === logTur)));
    const head = `<div class="ad-tabs"><button class="ad-b${!logTur ? ' grn' : ''}" data-a="logTur" data-n="">Hepsi</button><button class="ad-b${logTur === 'giris' ? ' grn' : ''}" data-a="logTur" data-n="giris">🚪 Girişler</button><button class="ad-b${logTur === 'yazi' ? ' grn' : ''}" data-a="logTur" data-n="yazi">💬 Yazılanlar</button><button class="ad-b" data-a="logYenile">↻</button><button class="ad-b${logAdminToo ? ' grn' : ''}" data-a="logBen">Ben de</button></div>`;
    const one = logId ? logs.find(r => r.id === logId) : null;
    if (one) {
      const v = one.veri || {};
      const extra = [v.kime ? 'Kime: ' + v.kime : '', v.cihaz ? 'Cihaz: ' + v.cihaz : '', v.esnaf ? 'Esnaf adı: ' + v.esnaf : '', v.cevrimdisi ? 'Çevrimdışıyken yazdı (kimse görmedi)' : '', one.sunucu ? 'Sunucu: ' + one.sunucu : ''].filter(Boolean).join('\n');
      return `<button class="ad-b" data-a="logGeri">◀ ${esc(one.ad)}</button><div class="ad-det"><b>${IC[one.tur] || '•'} ${esc(one.ad)}</b> · ${esc(zm(one.zaman))}\n\n${esc(one.metin || '(boş)')}${extra ? '\n\n<small>' + esc(extra) + '</small>' : ''}</div>`;
    }
    if (logUid) {
      const mine = rows.filter(r => r.uid === logUid), ad = mine[0]?.ad || logs.find(r => r.uid === logUid)?.ad || '?';
      return head + `<button class="ad-b" data-a="logKisiler">◀ Herkes</button> <b>${esc(ad)}</b> <small>${mine.length} kayıt</small><div style="margin-top:6px">` +
        (mine.map(r => `<button class="ad-log${yeni(r) ? ' yeni' : ''}" data-a="logAc" data-n="${r.id}"><i>${IC[r.tur] || '•'}</i><span>${esc(r.metin || r.tur)}</span><small>${esc(zm(r.zaman))}</small></button>`).join('') || '<small>Bu filtrede kayıt yok.</small>') + '</div>';
    }
    const kisi = new Map<string, { ad: string; son: string; n: number; yazi: number; yeni: number }>();
    for (const r of rows) { const k = kisi.get(r.uid) || { ad: r.ad, son: r.zaman, n: 0, yazi: 0, yeni: 0 }; k.n++; if (r.tur === 'sohbet' || r.tur === 'pm') k.yazi++; if (yeni(r)) k.yeni++; kisi.set(r.uid, k); }
    return head + (since ? `<small>Kırmızı = senin son girişinden sonra (${esc(zm(new Date(since).toISOString()))})</small>` : '') + '<div style="margin-top:6px">' +
      ([...kisi].map(([uid, k]) => `<button class="ad-log${k.yeni ? ' yeni' : ''}" data-a="logKisi" data-id="${uid}"><i>🧑</i><span><b>${esc(k.ad)}</b> ${k.yeni ? `<em class="ad-new">${k.yeni} yeni</em>` : ''}<br><small>${k.n} kayıt · ${k.yazi} mesaj</small></span><small>${esc(zm(k.son))}</small></button>`).join('') || '<small>Henüz kimse girmemiş.</small>') + '</div>';
  }

  function paint() {
    if (!panel || !panel.classList.contains('on')) return;
    const keep: Record<string, string> = {}; panel.querySelectorAll<HTMLInputElement>('input[data-f]').forEach(i => { keep[i.dataset.f!] = i.value; });
    const act = document.activeElement as HTMLInputElement | null, focus = act?.dataset?.f;
    const T = (k: typeof tab, l: string) => `<button class="ad-t${tab === k ? ' on' : ''}" data-tab="${k}">${l}</button>`;
    panel.innerHTML = `<div class="ad-top"><button class="ad-b ad-x" data-a="kapat" title="Kapat (Esc)">✕</button><div class="ad-h">🛠 Yönetici</div><div class="ad-tabs">${T('oy', '👥 Oyuncular')}${T('ara', '🔎 Ara')}${T('isl', '🏪 İşletme')}${T('ben', '💰 Ben')}${T('arac', '🧰 Araçlar')}${T('dunya', '🌍 Dünya')}${T('duyuru', '📢 Duyuru')}${T('liste', '⛔ Ban/Sus')}${T('log', '📜 Log')}</div></div>${body()}<div class="ad-msg">${esc(msg)}</div>`;
    panel.querySelectorAll<HTMLInputElement>('input[data-f]').forEach(i => { if (keep[i.dataset.f!] !== undefined) i.value = keep[i.dataset.f!]; });
    if (focus) { const i = panel.querySelector<HTMLInputElement>(`input[data-f="${focus}"]`); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
  }

  const val = (f: string) => (panel!.querySelector(`input[data-f="${f}"]`) as HTMLInputElement | null)?.value.trim() || '';

  function onClick(e: Event) {
    const el = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null; if (!el) return;
    if (el.dataset.tab) { tab = el.dataset.tab as typeof tab; try { localStorage.setItem('ad-tab', tab); } catch { /* */ } arm = ''; msg = ''; paint(); return; }
    if (el.dataset.sel) { sel = { id: el.dataset.sel, ad: el.dataset.ad || '?', peer: d.peers().find(p => p.uid === el.dataset.sel) }; arm = ''; msg = ''; paint(); return; }
    const a = el.dataset.a; if (!a) return;
    if (a === 'kapat') { panel!.classList.remove('on'); return; }
    if (a === 'tadBitir') { d.command({ kind: 'force', what: 'tadilatBitir' }); say('✓ Tadilat bitiyor.'); return; }
    if (a === 'tadBaslat') { d.command({ kind: 'force', what: 'stars', value: 5 }); const m = d.isletme?.(); if (m) d.addMoney(1e10); d.command({ kind: 'startTadilat' }); say('✓ Tadilat başladı (vinç ve işçiler restoran alanında).'); return; }
    if (a === 'kafeLv') { d.command({ kind: 'mulk', op: 'adminKafe', id: el.dataset.id, n: Number(el.dataset.n) }); say('✓ Kafe ayarlandı.'); setTimeout(paint, 50); return; }
    if (a === 'kafeIsci') { d.command({ kind: 'mulk', op: 'adminIsci', id: el.dataset.id }); say('✓ İşçi eklendi.'); setTimeout(paint, 50); return; }
    if (a === 'takimKur') { const t = val('takim'); if (t.length < 3) { say('⚠ En az 3 harf.'); return; } d.command({ kind: 'mulk', op: 'adminTakim', name: t }); say('✓ Kulüp kuruldu.'); setTimeout(paint, 50); return; }
    if (a === 'mevsim') { d.setMevsim?.(el.dataset.n || ''); say('✓ Süsleme değişti.'); setTimeout(paint, 50); return; }
    if (a === 'logTur') { logTur = el.dataset.n || ''; logId = 0; paint(); return; }
    if (a === 'logYenile') { logT = 0; say('Yenileniyor...'); return; }
    if (a === 'logBen') { logAdminToo = !logAdminToo; paint(); return; }
    if (a === 'logKisi') { logUid = el.dataset.id || ''; logId = 0; paint(); return; }
    if (a === 'logKisiler') { logUid = ''; logId = 0; paint(); return; }
    if (a === 'logAc') { logId = Number(el.dataset.n) || 0; paint(); return; }
    if (a === 'logGeri') { logId = 0; paint(); return; }
    if (a === 'ara') { void oyuncuAra(val('ara')).then(r => { found = r; say(r.length ? '' : 'Bulunamadı.'); }); return; }
    if (a === 'sm') { d.addMoney(Number(el.dataset.n)); say('✓ Para değişti.'); return; }
    if (a === 'set-para' || a === 'set-altin') { const n = Math.floor(Number(val('tam'))); if (!Number.isFinite(n) || n < 0 || n > 1e15) { say('⚠ Geçerli bir değer yaz.'); return; } if (a === 'set-para') d.setMoney(n); else d.setGold(n); say('✓ Ayarlandı.'); return; }
    if (a === 'resetMe') { if (!armed('resetMe')) { arm = 'resetMe'; paint(); setTimeout(() => { if (arm === 'resetMe') { arm = ''; paint(); } }, 3500); return; } arm = ''; d.resetMe(); return; }
    if (a === 'izgaraAc') { say(d.izgara() ? '✓ Izgara açık' : '✓ Izgara kapalı'); return; }
    if (a === 'editorAc') { d.editor(); say('✓ Düzenleyici: bir nesneye dokun, sürükle. Kaydet ile kalır.'); return; }
    if (a === 'stSec') { stSel = el.dataset.id || ''; paint(); return; }
    if (a === 'stGit') { if (stSel) { d.command({ kind: 'restoran', op: 'stantMove', id: stSel, dx: Number(el.dataset.dx) || 0, dz: Number(el.dataset.dz) || 0, dry: Number(el.dataset.dry) || 0 }); say('✓ Stand taşındı.'); } return; }
    if (a === 'git') { d.teleport(Number(el.dataset.n), Number(el.dataset.z)); say('✓ Işınlandın.'); return; }
    if (a === 'hepsiLvl') { d.setLevel(99); say('✓ Seviye 99.'); return; }
    if (a === 'olay') { d.command({ kind: 'force', what: el.dataset.n, value: 1 }); say('✓ Olay çağrıldı.'); return; }
    if (a === 'herkesAltin') { void run(() => komutGonder(null, 'altin', { n: 50 }), 'Herkese altın gitti.'); return; }
    if (a === 'herkesPara2') { void run(() => komutGonder(null, 'para', { n: 1000000 }), 'Herkese para gitti.'); return; }
    if (a === 'herkesAt') { if (!armed(a)) { arm = a; paint(); setTimeout(() => { if (arm === a) { arm = ''; paint(); } }, 3500); return; } arm = ''; void run(() => komutGonder(null, 'kick', { neden: 'Sunucu yeniden başlıyor.' }), 'Herkes atıldı.'); return; }
    if (a === 'sm0') { d.addMoney(-1e15); say('✓ Para sıfırlandı.'); return; }
    if (a === 'sg') { d.addGold(Number(el.dataset.n)); say('✓ Altın simit değişti.'); return; }
    if (a === 'sm-x') { const n = Math.floor(Number(val('miktar'))); if (Number.isFinite(n) && n !== 0 && Math.abs(n) <= 1e12) { d.addMoney(n); say('✓ Para değişti.'); } else say('⚠ Geçerli bir sayı yaz.'); return; }
    if (a === 'lvl') { const n = Math.floor(Number(val('seviye'))); if (n >= 1 && n <= 99) { d.setLevel(n); say('✓ Seviye ' + n + '.'); } else say('⚠ 1-99 arası yaz.'); return; }
    if (a === 'stage') { d.command({ kind: 'force', what: 'stage', value: Number(el.dataset.n) }); say('✓ Aşama ' + el.dataset.n + '.'); setTimeout(paint, 50); return; }
    if (a === 'saat') { d.command({ kind: 'setTime', hour: Number(el.dataset.n) }); say('✓ Saat ' + el.dataset.n + ':00.'); return; }
    if (a === 'dondur') { frozen = !frozen; d.command({ kind: 'freezeTime', on: frozen }); say(frozen ? '✓ Zaman donduruldu.' : '✓ Zaman akıyor.'); return; }
    if (a === 'gunbitir') { d.command({ kind: 'force', what: 'endDay' }); say('✓ Gün bitiyor.'); return; }
    if (a === 'hepsiniAc') { for (const k of d.allPadKeys()) d.command({ kind: 'force', what: 'unlock', value: k }); say('✓ Bütün kareler açıldı.'); return; }
    if (a === 'yildiz') { d.command({ kind: 'force', what: 'stars', value: 5 }); say('✓ 5 yıldız.'); return; }
    if (a === 'sesKapat') { d.setMuted(true); say('✓ Ses kapandı.'); return; }
    if (a === 'sesAc') { d.setMuted(false); say('✓ Ses açıldı.'); return; }
    if (a === 'herkesPara') { void run(() => komutGonder(null, 'para', { n: 10000 }), 'Herkese para gitti.'); return; }
    if (a === 'herkesCek') { const p = d.myPos(); void run(() => komutGonder(null, 'isinla', { x: p.x + 1.5, z: p.z }), 'Herkes yanına çekildi.'); return; }
    if (a === 'duyuru') { const t = val('duyuru'); if (t) void run(() => komutGonder(null, 'mesaj', { text: t.slice(0, 100) }), 'Duyuru gönderildi.'); return; }
    if (a === 'unban') { const id = el.dataset.id || sel?.id; if (id) void run(() => yasakKaldir(id), 'Ban kalktı.'); return; }
    if (a === 'unmute2' && sel) { const id = sel.id; void run(() => susturKaldir(id), 'Susturma kalktı.'); return; }
    if (a === 'unmute') { void run(() => susturKaldir(el.dataset.id!), 'Susturma kalktı.'); return; }
    if (!sel) return;
    const t = sel;
    if (a === 'tp-to' && t.peer) { d.teleport(t.peer.x, t.peer.z); say('✓ Yanındasın.'); return; }
    if (a === 'tp-me') { const p = d.myPos(); void run(() => komutGonder(t.id, 'isinla', { x: p.x + 1.5, z: p.z }), 'Yanına çekildi.'); return; }
    if (a === 'm1' || a === 'm2') { void run(() => komutGonder(t.id, 'para', { n: a === 'm1' ? 10000 : 100000 }), 'Para yollandı.'); return; }
    if (a === 'p-para' || a === 'p-altin' || a === 'p-sev') { const n = Math.floor(Number(val('deger'))); if (!Number.isFinite(n) || n < 0 || n > 1e12) { say('⚠ Geçerli bir değer yaz.'); return; } void run(() => komutGonder(t.id, 'ayarla', { what: a === 'p-para' ? 'para' : a === 'p-altin' ? 'altin' : 'seviye', n }), 'Değer ayarlandı.'); return; }
    if (a === 'mm') { void run(() => komutGonder(t.id, 'para', { n: -10000 }), 'Para silindi.'); return; }
    if (a === 'gm') { void run(() => komutGonder(t.id, 'altin', { n: -50 }), 'Altın silindi.'); return; }
    if (a === 'g1') { void run(() => komutGonder(t.id, 'altin', { n: 50 }), 'Altın yollandı.'); return; }
    // destructive: first tap arms the button, the second does it
    if (!armed(a)) { arm = a; paint(); setTimeout(() => { if (arm === a) { arm = ''; paint(); } }, 3500); return; }
    arm = '';
    if (a === 'kick') void run(() => komutGonder(t.id, 'kick', { neden: 'Yönetici seni oyundan attı.' }), 'Kicklendi.');
    if (a === 'wipe') void run(() => hesapSifirla(t.id), 'Oyuncunun bilgileri silindi.');
    if (a === 'ban') void run(() => yasakla(t.id, null, val('neden')), 'Banlandı.');
    if (a === 'mute') void run(() => sustur(t.id, 30), 'Susturuldu.');
  }

  function uygula(k: Komut) {
    const v = k.veri || {}, n = Math.max(-1e9, Math.min(1e9, Number(v.n) || 0));
    if (k.tur === 'kick') { d.toast('🚪 ' + String(v.neden || 'Oyundan atıldın.')); setTimeout(() => { void cikisYap().finally(() => location.reload()); }, 1800); }
    else if (k.tur === 'isinla') { const x = Number(v.x), z = Number(v.z); if (Number.isFinite(x) && Number.isFinite(z)) { d.teleport(x, z); d.toast('✨ Yönetici seni ışınladı.'); } }
    else if (k.tur === 'para' && n) { d.addMoney(n); d.toast('💰 Yönetici ' + (n > 0 ? 'sana ' + Math.round(n).toLocaleString('tr') + ' ₺ yolladı.' : Math.round(-n).toLocaleString('tr') + ' ₺ sildi.')); }
    else if (k.tur === 'altin' && n) { d.addGold(n); d.toast('🥨 Yönetici ' + (n > 0 ? 'sana ' + Math.round(n) + ' altın simit yolladı.' : Math.round(-n) + ' altın simit sildi.')); }
    else if (k.tur === 'ayarla') { const w = String(v.what), x = Math.max(0, Math.min(1e12, Number(v.n) || 0)); if (w === 'para') d.setMoney(x); else if (w === 'altin') d.setGold(x); else if (w === 'seviye') d.setLevel(Math.max(1, Math.min(99, Math.round(x)))); d.toast('🛠 Yönetici değerini ayarladı.'); }
    else if (k.tur === 'sifirla') { d.toast('🛠 Hesabın sıfırlanıyor...'); setTimeout(() => d.resetMe(), 1500); }
    else if (k.tur === 'mesaj') d.toast('📢 ' + String(v.text || '').replace(/[<>\u0000-\u001f]/g, '').slice(0, 100));
  }

  return {
    update(dt: number) {
      if (!hesap()) return;
      ensureUi();
      if ((susT -= dt) <= 0) { susT = 20; void susturmalariYenile(); }
      if ((pollT -= dt) <= 0) { pollT = 4; void komutlariCek().then(ks => ks.forEach(uygula)); }
      if (panel?.classList.contains('on')) {
        if ((namesT -= dt) <= 0) { namesT = 6; const ids = d.peers().map(p => p.uid).filter(Boolean); void adlar(ids).then(m => { names = m; paint(); }); }
        if (tab === 'log' && (logT -= dt) <= 0) { logT = 20; void logOku().then(l => { logs = l; if (tab === 'log') { msg = ''; paint(); } }); }
        if ((listT -= dt) <= 0) { listT = 15; void listeler().then(l => { lists = l; if (tab === 'liste') paint(); }); }
      }
    },
  };
}
