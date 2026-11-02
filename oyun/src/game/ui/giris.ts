// Giriş ekranı (2026-10-24 13:05 user: "username ve password girişi olsun"). Opens after the title: Giriş yap /
// Kayıt ol / Misafir oyna. Accounts live on Supabase (net/supa.ts); a remembered session skips the form.
// After a login the boot merges the cloud save (afterLogin) and then the game starts.
import { supaReady, girisYap, kayitOl, cikisYap } from '../net/supa';
import { girisSonrasi, adminAdiMi, adminDogrula } from '../net/admin';
import { girisLogu } from '../net/log';
import { SUNUCULAR, sunucu, setSunucu } from '../net/sunucu';
import { slotlariYukle, slotListesi, slotSec, aktifSlot } from '../net/slots';
import { SINIFLAR } from '../sim/esnafim';

export interface GirisView { show(go: () => void): void }

const CSS = `
.gr-bg{position:fixed;inset:0;pointer-events:auto;z-index:70;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 30%,rgba(255,226,160,.55),rgba(40,22,18,.82));padding:16px;font-family:var(--body)}
.gr-card{width:min(400px,100%);background:#fdf3e1;color:#3b2a20;border:4px solid #3b2a20;border-radius:22px;box-shadow:0 8px 0 #3b2a20;padding:18px 18px 16px}
.gr-h{font:900 26px/1.1 var(--disp);margin:0;text-align:center}.gr-sub{font:700 14px/1.35 var(--body);opacity:.75;text-align:center;margin:4px 0 12px}
.gr-tabs{display:flex;gap:6px;margin-bottom:10px}
.gr-t{flex:1;min-height:44px;border:3px solid #3b2a20;border-radius:12px;background:#fff6e6;font:900 16px var(--disp);color:#3b2a20;cursor:pointer}
.gr-t.on{background:#ffd23f}
.gr-l{font:900 14px var(--disp);margin:8px 0 4px}
.gr-in{width:100%;box-sizing:border-box;min-height:48px;border:3px solid #3b2a20;border-radius:12px;padding:6px 12px;font:800 17px var(--body);background:#fff;color:#3b2a20}
.gr-go{margin-top:14px;width:100%;min-height:56px;border-radius:16px;border:4px solid #3b2a20;background:#8fd06b;box-shadow:0 5px 0 #3b2a20;font:900 20px/1 var(--disp);color:#3b2a20;cursor:pointer}
.gr-go:disabled{opacity:.6;cursor:wait}
.gr-guest{margin-top:12px;width:100%;min-height:46px;border-radius:14px;border:3px dashed #3b2a20;background:transparent;font:900 16px var(--disp);color:#3b2a20;cursor:pointer}
.gr-slots{display:grid;gap:8px;margin-top:6px}.gr-sl{display:flex;align-items:center;gap:10px;min-height:64px;border:3px solid #3b2a20;border-radius:14px;background:#fff6e6;font:900 17px var(--disp);color:#3b2a20;cursor:pointer;padding:4px 12px;text-align:left;box-shadow:0 3px 0 #3b2a20}.gr-sl:hover{background:#ffeab0}.gr-sl i{font-style:normal;font-size:30px;width:40px;text-align:center}.gr-sl small{display:block;font:700 12px var(--body);opacity:.7}.gr-sl.empty{border-style:dashed;background:transparent;box-shadow:none}.gr-sl.on{background:#ffd23f}
.gr-err{min-height:20px;margin-top:8px;font:800 14px/1.3 var(--body);color:#b3261e;text-align:center}
.gr-srv{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:6px}.gr-s{min-height:50px;border:3px solid #3b2a20;border-radius:12px;background:#fff6e6;font:900 16px var(--disp);color:#3b2a20;cursor:pointer;display:flex;align-items:center;gap:8px;padding:2px 10px;text-align:left;box-shadow:0 3px 0 #3b2a20}.gr-s.on{background:#ffd23f}.gr-s i{width:16px;height:16px;border-radius:50%;border:2px solid #3b2a20;flex:none}.gr-s small{display:block;font:700 11px var(--body);opacity:.7}
.gr-card{max-height:calc(100vh - 32px);overflow:auto}
.gr-adm{display:block;margin:10px auto 0;background:none;border:0;font:800 12px var(--body);color:#3b2a20;opacity:.55;text-decoration:underline;cursor:pointer}
.gr-note{font:700 12px/1.35 var(--body);opacity:.7;text-align:center;margin-top:10px}
`;

export function createGiris(deps: { root: HTMLElement; afterLogin: (isNew: boolean) => Promise<void>; sfx?: (id: string) => void }): GirisView {
  const st = document.createElement('style'); st.textContent = CSS; deps.root.appendChild(st);
  return {
    show(go) {
      let done = false, isNew = false, logged = false, inServers = false;
      // after the account step comes the MMORPG style server pick, then the game (and the kulis for a new esnaf)
      // after any login: ban check (and the admin role check); a banned or non-admin account is signed out again
      const finish = (login: boolean) => {
        if (done) return;
        if (!login) { logged = false; inServers = true; servers(); return; }
        void girisSonrasi().then(async r => {
          if (r.yasak) { await cikisYap(); paint(r.yasak); return; }
          logged = true; void girisLogu(isNew);
          await slotlariYukle();
          slotsScreen();
        });
      };
      const enter = async () => {
        if (done) return; done = true;
        if (logged) { try { await deps.afterLogin(isNew); } catch { /* the local save still plays */ } }
        bg.remove(); go();
      };
      // Metin2 style: 4 character slots per account (karar paketi C). The slot picked here is the cloud save that loads.
      const slotsScreen = () => {
        inServers = false;
        const list = slotListesi(), cur = aktifSlot(), pt = (s: number) => s >= 3600 ? Math.floor(s / 3600) + ' sa ' + Math.floor(s % 3600 / 60) + ' dk' : Math.max(1, Math.floor(s / 60)) + ' dk';
        bg.innerHTML = `<div class="gr-card"><div class="gr-h">🧑 Karakterini seç</div><div class="gr-sub">Hesabında 4 yuva var. Banka hepsinin ortak. Adı bir kez seçersin, sonra değişmez.</div>
<div class="gr-slots">${list.map((s, i) => s ? `<button class="gr-sl${i === cur ? ' on' : ''}" data-slot="${i}"><i>${SINIFLAR.find(x => x.id === s.sinif)?.icon || '🧑'}</i><span>${s.ad.replace(/[<>&]/g, '')}<small>${s.level}. seviye · ${SINIFLAR.find(x => x.id === s.sinif)?.ad || ''} · ${pt(s.playT)} oynandı</small></span></button>` : `<button class="gr-sl empty" data-slot="${i}"><i>＋</i><span>Yeni karakter<small>Boş yuva ${i + 1}</small></span></button>`).join('')}</div></div>`;
      };
      const servers = () => {
        const cur = sunucu();
        bg.innerHTML = `<div class="gr-card"><div class="gr-h">🌐 Sunucu seç</div><div class="gr-sub">Arkadaşınla aynı sunucuyu seç, aynı Martıköy'de buluşun.</div>
<div class="gr-srv">${SUNUCULAR.map(x => `<button class="gr-s${x.id === cur ? ' on' : ''}" data-srv="${x.id}"><i style="background:${x.renk}"></i><span>${x.id}. ${x.ad}<small>${x.id === cur ? 'son girdiğin' : 'açık'}</small></span></button>`).join('')}</div>
<button class="gr-go" data-enter="1">Oyuna gir ▶</button></div>`;
      };
      const bg = document.createElement('div'); bg.className = 'gr-bg';
      let mode: 'giris' | 'kayit' = 'giris';
      const paint = (err = '') => {
        bg.innerHTML = `<div class="gr-card"><div class="gr-h">🐦 Martıköy'e hoş geldin</div><div class="gr-sub">Hesabınla gir, dükkanın ve esnafın her cihazda seninle olsun.</div>
<div class="gr-tabs"><button class="gr-t${mode === 'giris' ? ' on' : ''}" data-m="giris">Giriş yap</button><button class="gr-t${mode === 'kayit' ? ' on' : ''}" data-m="kayit">Kayıt ol</button></div>
<div class="gr-l">Kullanıcı adı</div><input class="gr-in" name="ad" maxlength="16" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="ör. simitci_ali">
<div class="gr-l">Şifre</div><input class="gr-in" name="sifre" type="password" maxlength="64" autocomplete="${mode === 'kayit' ? 'new-password' : 'current-password'}" placeholder="en az 6 karakter">
<div class="gr-key" style="display:none"><div class="gr-l">🔑 Anahtar kod</div><input class="gr-in" name="kod" type="password" maxlength="64" autocomplete="off" placeholder="sadece sende olan kod"></div>
<button class="gr-go" data-go="1">${mode === 'giris' ? 'Giriş yap' : 'Hesabı aç'}</button>
<div class="gr-err">${err}</div>
<div class="gr-note">${supaReady() ? 'E-posta istemiyoruz. Şifreni unutma, kimse göremez.' : 'Hesap sunucusu birazdan bağlanacak, biraz sonra tekrar dene.'}</div></div>`;
      };
      const showKey = () => { const k = bg.querySelector('.gr-key') as HTMLElement | null; if (k) k.style.display = ''; };
      const submit = async () => {
        const ad = (bg.querySelector('input[name="ad"]') as HTMLInputElement).value;
        const sifre = (bg.querySelector('input[name="sifre"]') as HTMLInputElement).value;
        const kod = (bg.querySelector('input[name="kod"]') as HTMLInputElement).value;
        const adm = mode === 'giris' && adminAdiMi(ad);
        if (adm && !kod) { showKey(); (bg.querySelector('input[name="kod"]') as HTMLInputElement).focus(); (bg.querySelector('.gr-err') as HTMLElement).textContent = 'Bu hesap için anahtar kod gerekli.'; return; }
        const b = bg.querySelector('.gr-go') as HTMLButtonElement; b.disabled = true; b.textContent = 'Bekle...';
        let err = mode === 'giris' ? await girisYap(ad, sifre) : await kayitOl(ad, sifre);
        // admin / xynena: the key code is checked on the server (hash in the DB); without it the account never opens
        if (!err && adm) { const k = await adminDogrula(kod); if (k === 'yanlis') { await cikisYap(); err = 'Anahtar kod yanlış.'; } }
        isNew = !err && mode === 'kayit';
        if (err) { const keepAd = ad; paint(err); (bg.querySelector('input[name="ad"]') as HTMLInputElement).value = keepAd; try { deps.sfx?.('error'); } catch { /* */ } return; }
        try { deps.sfx?.('buy'); } catch { /* */ }
        finish(true);
      };
      bg.addEventListener('click', e => {
        const el = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null; if (!el) return;
        if (el.dataset.slot) { slotSec(Number(el.dataset.slot)); try { deps.sfx?.('pick'); } catch { /* */ } inServers = true; servers(); return; }
        if (el.dataset.srv) { setSunucu(Number(el.dataset.srv)); servers(); return; }
        if (el.dataset.enter) { void enter(); return; }
        if (el.dataset.m) { mode = el.dataset.m as 'giris' | 'kayit'; paint(); return; }
        if (el.dataset.go) { void submit(); return; }
        if (el.dataset.guest) finish(false);
      });
      bg.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { if (inServers) void enter(); else void submit(); } });
      bg.addEventListener('keyup', e => e.stopPropagation());
      bg.addEventListener('input', e => { const t = e.target as HTMLInputElement; if (t.name === 'ad' && mode === 'giris' && adminAdiMi(t.value)) showKey(); });
      // 2026-10-25 user: no "continue as ..." screen; everyone types their own username and password
      paint(); deps.root.appendChild(bg);
    },
  };
}
