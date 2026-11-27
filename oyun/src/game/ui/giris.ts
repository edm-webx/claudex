// Giriş ekranı = MARTI KİMLİK (oyunun hesap sistemi, 2026-11-23). (2026-10-24 13:05 user: "username ve password girişi olsun"). Opens after the title: Giriş yap /
// Kayıt ol / Misafir oyna. Accounts live on Supabase (net/supa.ts); a remembered session skips the form.
// After a login the boot merges the cloud save (afterLogin) and then the game starts.
import { supaReady, girisYap, kayitOl, cikisYap, GIRIS_TUTMADI, PROFIL_YAZILAMADI, zamanAsimi, ISTEK_ZAMAN_ASIMI_MS, SUNUCU_YAVAS } from '../net/supa';
import { girisSonrasi, adminAdiMi, adminDogrula } from '../net/admin';
import { girisLogu } from '../net/log';
import { slotlariYukle, slotListesi, slotSec, aktifSlot, slotSil, slotsHazir } from '../net/slots';
import { SINIFLAR } from '../sim/esnafim';
import { menuStilKur, sahneKatmani, logoHtml, MARTI_SVG } from './menu-stil';

export interface GirisView { show(go: () => void): void }

// 2026-11-25 "Altın Saat" (menu-stil.ts): kart sağda cam panel, solda logo, arkada canlı 3B menü sahnesi. Akış ve mantık aynı.
const CSS = `
.gr-bg{position:fixed;inset:0;pointer-events:auto;z-index:70;font-family:'SB Govde',system-ui,sans-serif;animation:mn-in .5s ease both}
.gr-host{position:absolute;inset:0;pointer-events:none}.gr-host>*{pointer-events:auto}
.gr-card .gr-h{font:800 32px/1.05 'SB Baslik','SB Govde',system-ui,sans-serif;color:#fff3dc;margin:0 0 6px;text-align:left}
.gr-sub{font:500 14px/1.45 'SB Govde',system-ui,sans-serif;color:rgba(255,232,205,.68);margin:0 0 18px;text-align:left}
.gr-tabs{display:grid;grid-template-columns:1fr 1fr;padding:4px;gap:4px;border-radius:12px;background:rgba(0,0,0,.35);margin-bottom:6px}
.gr-t{all:unset;text-align:center;min-height:40px;border-radius:9px;font:700 14px/40px 'SB Govde',system-ui,sans-serif;color:rgba(255,230,200,.62);letter-spacing:.04em;cursor:pointer;transition:background .2s,color .2s}
.gr-t:hover{color:#ffe1a8}.gr-t.on{background:linear-gradient(180deg,#ffd98c,#f0a443);color:#3a1a08;box-shadow:0 4px 14px rgba(255,160,60,.35)}
.gr-l{font:700 11.5px/1 'SB Govde',system-ui,sans-serif;letter-spacing:.2em;color:rgba(255,220,170,.72);text-transform:uppercase;margin:16px 0 8px}
.gr-in{width:100%;box-sizing:border-box;min-height:50px;border-radius:12px;padding:0 16px;font:500 16px 'SB Govde',system-ui,sans-serif;color:#fff1dc;background:rgba(255,245,230,.07);border:1px solid rgba(255,214,160,.24);outline:none;transition:border-color .2s,box-shadow .2s,background .2s}
.gr-in::placeholder{color:rgba(255,236,214,.36)}.gr-in:focus{border-color:#ffc66d;box-shadow:0 0 0 4px rgba(255,190,90,.14);background:rgba(255,245,230,.1)}
.gr-hint{font:500 12.5px/1.4 'SB Govde',system-ui,sans-serif;color:rgba(255,226,190,.55);margin-top:7px}
.gr-go{display:grid;place-items:center;width:100%;min-height:56px;margin-top:22px;border:0;border-radius:14px;cursor:pointer;font:800 17px/1.1 'SB Govde',system-ui,sans-serif;letter-spacing:.06em;color:#3a1806;position:relative;overflow:hidden;
 background:linear-gradient(180deg,#ffe3a0,#f6a640 60%,#e3862a);box-shadow:0 10px 30px rgba(255,150,50,.4),inset 0 1px 0 rgba(255,255,255,.6);transition:transform .15s,filter .2s,box-shadow .2s;text-transform:uppercase}
.gr-go:after{content:"";position:absolute;top:0;bottom:0;left:-30%;width:60px;background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);transform:skewX(-20deg);transition:left .6s}
.gr-go:hover{filter:brightness(1.06);box-shadow:0 12px 36px rgba(255,150,50,.55),inset 0 1px 0 rgba(255,255,255,.6)}.gr-go:hover:after{left:120%}
.gr-go:active{transform:translateY(2px) scale(.99)}.gr-go:disabled{opacity:.65;cursor:wait}
.gr-guest{all:unset;box-sizing:border-box;display:block;width:100%;margin-top:16px;padding:14px 0 2px;border-top:1px solid rgba(255,214,160,.14);text-align:center;cursor:pointer;font:600 14.5px/1.3 'SB Govde',system-ui,sans-serif;color:#ffdca0}
.gr-guest:hover{color:#fff1dc}.gr-guest small{display:block;font:500 12px/1.3 'SB Govde',system-ui,sans-serif;color:rgba(255,226,190,.5);margin-top:3px}
.gr-adm{all:unset;display:inline-block;margin-top:14px;font:500 13.5px/1.2 'SB Govde',system-ui,sans-serif;color:rgba(255,226,190,.75);border-bottom:1px solid rgba(255,206,140,.4);cursor:pointer}.gr-adm:hover{color:#ffe1a8}
.gr-err{min-height:18px;margin-top:10px;font:600 13.5px/1.35 'SB Govde',system-ui,sans-serif;color:#ff9b8a;text-align:left}
.gr-err:not(:empty){padding:9px 12px;border-radius:10px;background:rgba(255,90,60,.12);border:1px solid rgba(255,120,90,.3)}
.gr-note{font:500 12.5px/1.45 'SB Govde',system-ui,sans-serif;color:rgba(255,226,190,.5);margin-top:12px;text-align:left}
.gr-unut{margin-top:14px;border-radius:12px;background:rgba(255,245,230,.06);border:1px dashed rgba(255,206,140,.4);padding:12px 14px;font:500 13px/1.5 'SB Govde',system-ui,sans-serif;color:rgba(255,236,214,.82)}.gr-unut b{color:#ffe1a8;font-weight:700}
.gr-slots{display:grid;gap:10px;margin-top:4px}
.gr-sl{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:14px;min-height:68px;padding:8px 14px;border-radius:14px;cursor:pointer;background:rgba(255,245,230,.06);border:1px solid rgba(255,214,160,.2);font:700 17px/1.2 'SB Govde',system-ui,sans-serif;color:#fff1dc;text-align:left;transition:background .2s,border-color .2s,transform .2s}
.gr-sl:hover{background:rgba(255,214,160,.12);border-color:rgba(255,206,140,.5);transform:translateX(3px)}
.gr-sl i{flex:none;font-style:normal;font-size:26px;width:46px;height:46px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 35% 30%,rgba(255,231,168,.3),rgba(232,154,53,.18));box-shadow:inset 0 0 0 1px rgba(255,214,160,.3)}
.gr-sl small{display:block;font:500 12.5px/1.35 'SB Govde',system-ui,sans-serif;color:rgba(255,226,190,.6);margin-top:3px}
.gr-sl.on{border-color:#ffc66d;box-shadow:0 0 0 3px rgba(255,190,90,.14)}
.gr-sl.empty{background:transparent;border-style:dashed;color:rgba(255,226,190,.75)}.gr-sl.empty i{background:none;color:#ffcf7a}
.gr-row{display:flex;gap:8px;align-items:stretch}.gr-row .gr-sl{flex:1;min-width:0}
.gr-del{all:unset;flex:none;width:52px;border-radius:14px;display:grid;place-items:center;font-size:19px;cursor:pointer;background:rgba(255,245,230,.04);border:1px solid rgba(255,214,160,.16);filter:grayscale(.4);transition:background .2s,border-color .2s}
.gr-del:hover{background:rgba(255,90,60,.16);border-color:rgba(255,120,90,.45);filter:none}
.gr-warn{font:500 14.5px/1.5 'SB Govde',system-ui,sans-serif;margin:6px 0 4px;color:rgba(255,236,214,.85);text-align:left}.gr-warn b{color:#ffe1a8}
.gr-btns{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}
.gr-btns button{min-height:52px;border:0;border-radius:14px;font:800 15px/1.1 'SB Govde',system-ui,sans-serif;letter-spacing:.05em;cursor:pointer}
.gr-no{background:rgba(255,245,230,.08);color:#ffe1a8;box-shadow:inset 0 0 0 1px rgba(255,214,160,.3)}
.gr-red{background:linear-gradient(180deg,#ff7b5f,#d9412c);color:#fff!important;box-shadow:0 8px 24px rgba(220,60,40,.35)}.gr-red:disabled{opacity:.4;cursor:not-allowed;box-shadow:none}
.gr-kim{display:flex;align-items:center;gap:12px;margin:0 0 18px}
.gr-seal{flex:none;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 35% 30%,#ffe7a8,#e89a35);box-shadow:0 0 0 3px rgba(255,210,130,.25),0 0 22px rgba(255,170,70,.5)}.gr-seal svg{width:26px;height:10px}
.gr-kim b{display:block;font:800 14px/1.1 'SB Govde',system-ui,sans-serif;letter-spacing:.32em;color:#ffe2ac}.gr-kim small{display:block;font:500 12.5px/1.3 'SB Govde',system-ui,sans-serif;color:rgba(255,230,200,.62);margin-top:2px;letter-spacing:.03em}
.gr-ic{font-size:26px;line-height:1;margin-right:4px;vertical-align:-2px}
@media (max-height:760px){.gr-kim{margin-bottom:12px}.gr-card .gr-h{font-size:27px}.gr-sub{margin-bottom:12px}.gr-l{margin:11px 0 6px}.gr-in{min-height:46px}.gr-go{min-height:50px;margin-top:16px}.gr-guest{margin-top:10px;padding-top:10px}.gr-note{margin-top:8px}}
@media (max-height:480px) and (min-aspect-ratio:1/1){.gr-kim{display:none}.gr-card .gr-h{font-size:22px}.gr-sub{display:none}.gr-card .gr-h{margin-bottom:8px}.gr-l{margin:7px 0 3px}.gr-in{min-height:38px}.gr-go{min-height:42px;margin-top:8px}.gr-guest{margin-top:6px;padding-top:6px}.gr-guest small{display:none}.gr-tabs{margin-bottom:2px}.gr-t{min-height:34px;line-height:34px}.gr-err{margin-top:6px;min-height:0}.gr-adm{margin-top:8px}.gr-note{margin-top:6px}}
`;

export function createGiris(deps: { root: HTMLElement; afterLogin: (isNew: boolean) => Promise<void>; sfx?: (id: string) => void }): GirisView {
  const st = document.createElement('style'); st.textContent = CSS; deps.root.appendChild(st);
  return {
    show(go) {
      let done = false, isNew = false, logged = false, inServers = false;
      // 2026-11-09: no public servers; after the account step comes the character slot, then the game (and the kulis for a new esnaf)
      // after any login: ban check (and the admin role check); a banned or non-admin account is signed out again
      const finish = async (login: boolean): Promise<void> => {
        if (done) return;
        if (!login) { logged = false; void enter(); return; }
        const r = await girisSonrasi();
        if (r.yasak) { await cikisYap(); paint(r.yasak); return; }
        logged = true; void girisLogu(isNew);
        // KAYIT-GUV: a failed read is not "4 empty slots": nothing opens (and nothing is written) until the record was read
        if (await slotlariYukle()) slotsScreen(); else okumaHatasi();
      };
      const enter = async () => {
        if (done) return; done = true;
        if (logged) { try { await deps.afterLogin(isNew); } catch { /* the local save still plays */ } }
        bg.remove(); go();
      };
      // Metin2 style: 4 character slots per account (karar paketi C). The slot picked here is the cloud save that loads.
      const slotsScreen = () => {
        inServers = false;
        if (!slotsHazir()) { okumaHatasi(); return; }
        const list = slotListesi(), cur = aktifSlot(), pt = (s: number) => s >= 3600 ? Math.floor(s / 3600) + ' sa ' + Math.floor(s % 3600 / 60) + ' dk' : Math.max(1, Math.floor(s / 60)) + ' dk';
        host.innerHTML = `<div class="gr-card mn-panel"><div class="gr-h">Karakterini seç</div><div class="gr-sub">Hesabında 4 yuva var. Banka hepsinin ortak. Adı bir kez seçersin, sonra değişmez.</div>
<div class="gr-slots">${list.map((s, i) => s ? `<div class="gr-row"><button class="gr-sl${i === cur ? ' on' : ''}" data-slot="${i}"><i>${SINIFLAR.find(x => x.id === s.sinif)?.icon || '🧑'}</i><span>${s.ad.replace(/[<>&]/g, '')}<small>${s.level}. seviye · ${SINIFLAR.find(x => x.id === s.sinif)?.ad || ''} · ${pt(s.playT)} oynandı</small></span></button><button class="gr-del" data-del="${i}" aria-label="${s.ad.replace(/[<>&"]/g, '')} karakterini sil" title="Karakteri sil">🗑</button></div>` : `<button class="gr-sl empty" data-slot="${i}"><i>＋</i><span>Yeni karakter<small>Boş yuva ${i + 1}</small></span></button>`).join('')}</div></div>`;
      };
      const okumaHatasi = () => {
        inServers = false;
        host.innerHTML = `<div class="gr-card mn-panel"><div class="gr-h">Kayıtların okunamadı</div><div class="gr-warn">Sunucuya şu an ulaşılamıyor. Karakterlerin ve bankan güvende, hiçbir şey silinmedi ya da üzerine yazılmadı.</div>
<button class="gr-go" data-retry="1">Tekrar dene</button><div class="gr-note">İnternetini kontrol edip tekrar dene.</div></div>`;
      };
      // Karakter silme: iki onay. 1) "emin misin" 2) karakterin adını yaz, kırmızı düğme ancak ad eşleşince açılır. Yalnız o yuva silinir, banka ve diğer yuvalar kalır.
      const delScreen = (i: number, step: 1 | 2, err = '') => {
        const s = slotListesi()[i]; if (!s) { slotsScreen(); return; }
        const ad = s.ad.replace(/[<>&]/g, '');
        host.innerHTML = step === 1
          ? `<div class="gr-card mn-panel"><div class="gr-h">Karakteri sil?</div><div class="gr-warn"><b>${ad}</b> (${s.level}. seviye) silinecek: dükkanı, ilerlemesi, her şeyi. Geri alınmaz. Ortak banka ve diğer karakterlerin durur.</div>
<div class="gr-btns"><button class="gr-no" data-no="1">Vazgeç</button><button class="gr-red" data-d1="${i}">Devam</button></div></div>`
          : `<div class="gr-card mn-panel"><div class="gr-h">Son onay</div><div class="gr-warn">Silmek için karakterin adını aynen yaz: <b>${ad}</b></div>
<input class="gr-in" name="onay" maxlength="32" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${ad}"><div class="gr-err">${err}</div>
<div class="gr-btns"><button class="gr-no" data-no="1">Vazgeç</button><button class="gr-red" data-d2="${i}" disabled>Sil</button></div></div>`;
        if (step === 2) (bg.querySelector('input[name="onay"]') as HTMLInputElement).focus();
      };
      const delMatch = (i: number) => { const s = slotListesi()[i], t = (bg.querySelector('input[name="onay"]') as HTMLInputElement | null)?.value || ''; return !!s && t.trim().toLocaleLowerCase('tr') === s.ad.replace(/[<>&]/g, '').trim().toLocaleLowerCase('tr'); };
      // Altın Saat: sabit katmanlar (sahne + logo) bir kez, değişen kart .gr-host içinde. Başlıktan gelindiyse logo zaten
      // ekranda: animasyonsuz ve şeritler açık başlar, dikiş görünmez.
      menuStilKur();
      const bastan = !document.querySelector('.mn-title');
      const bg = document.createElement('div'); bg.className = 'gr-bg' + (bastan ? ' mn-anim' : ' mn-acik');
      bg.innerHTML = sahneKatmani() + logoHtml() + '<div class="gr-host"></div>';
      const host = bg.querySelector('.gr-host') as HTMLElement;
      if (bastan) requestAnimationFrame(() => requestAnimationFrame(() => bg.classList.add('mn-acik')));
      setTimeout(() => host.classList.add('gr-tekrar'), 700);   // kart yalnız ilk açılışta kayarak gelir, sekme değişince zıplamaz
      let mode: 'giris' | 'kayit' = 'giris', tutmadi = 0, unut = false;
      // Martı Kimlik: oyunun hesap sistemi. E-posta yok, sıfırlama bağlantısı da yok: şifreyi unutan admine yazar.
      const unutKutu = () => `<div class="gr-unut"><b>🔐 Şifreni mi unuttun?</b><br>Martı Kimlik e-posta istemediği için sıfırlama bağlantısı gönderemiyoruz. Oyunu oynadığın sayfadaki iletişim yolundan <b>admine yaz</b>, kullanıcı adını söyle. Hesabın doğrulanınca yeni şifre verilir; karakterlerin ve bankan bu sırada güvende.</div>`;
      const paint = (err = '') => {
        host.innerHTML = `<div class="gr-card mn-panel"><div class="gr-kim"><span class="gr-seal">${MARTI_SVG}</span><div><b>MARTI KİMLİK</b><small>Martıköy'ün tek hesabı</small></div></div><div class="gr-h">Martıköy'e hoş geldin</div><div class="gr-sub">Tek kimlik, her cihazda aynı dükkan ve aynı esnaf.</div>
<div class="gr-tabs"><button class="gr-t${mode === 'giris' ? ' on' : ''}" data-m="giris">Giriş yap</button><button class="gr-t${mode === 'kayit' ? ' on' : ''}" data-m="kayit">Kayıt ol</button></div>
<div class="gr-l">Kullanıcı adı</div><input class="gr-in" name="ad" maxlength="16" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="ör. simitci_ali">${mode === 'kayit' ? '<div class="gr-hint">3-16 karakter: küçük harf, rakam ya da _. Sonradan değişmez, herkes seni bu adla görür.</div>' : ''}
<div class="gr-l">Şifre</div><input class="gr-in" name="sifre" type="password" maxlength="64" autocomplete="${mode === 'kayit' ? 'new-password' : 'current-password'}" placeholder="en az 6 karakter">
<div class="gr-key" style="display:none"><div class="gr-l">🔑 Anahtar kod</div><input class="gr-in" name="kod" type="password" maxlength="64" autocomplete="off" placeholder="sadece sende olan kod"></div>
<button class="gr-go" data-go="1">${mode === 'giris' ? 'Martı Kimlik ile gir' : 'Martı Kimliğimi aç'}</button>
${mode === 'giris' ? (unut ? unutKutu() : '<button class="gr-adm" data-unut="1">Şifremi unuttum</button>') : ''}
<button class="gr-guest" data-guest="1">Misafir oyna →<small>Hesapsız, ilerleme kaydedilmez</small></button>
<div class="gr-err">${err}</div>
<div class="gr-note">${supaReady() ? 'Martı Kimlik e-posta istemez. Şifren yalnız sende, kimse göremez; unutma.' : 'Hesap sunucusu birazdan bağlanacak, biraz sonra tekrar dene.'}</div></div>`;
      };
      const showKey = () => { const k = bg.querySelector('.gr-key') as HTMLElement | null; if (k) k.style.display = ''; };
      // QA 2026-11-27: bir tık + iki Enter = üç ayrı giriş isteği gidiyordu. İstek sürerken yeni gönderim yok
      let mesgul = false;
      const submit = async () => {
        if (mesgul) return;
        mesgul = true;
        try { await submit1(); } finally { mesgul = false; }
      };
      const submit1 = async () => {
        if (!bg.querySelector('input[name="ad"]')) return;   // karakter / hata ekranında Enter giriş formu aramasın
        const ad = (bg.querySelector('input[name="ad"]') as HTMLInputElement).value;
        const sifre = (bg.querySelector('input[name="sifre"]') as HTMLInputElement).value;
        const kod = (bg.querySelector('input[name="kod"]') as HTMLInputElement).value;
        const adm = mode === 'giris' && adminAdiMi(ad);
        if (adm && !kod) { showKey(); (bg.querySelector('input[name="kod"]') as HTMLInputElement).focus(); (bg.querySelector('.gr-err') as HTMLElement).textContent = 'Bu hesap için anahtar kod gerekli.'; return; }
        const b = bg.querySelector('.gr-go') as HTMLButtonElement; b.disabled = true; b.textContent = 'Bekle...';
        const yavas = setTimeout(() => { if (b.isConnected) b.textContent = 'Ağ yavaş, bekliyoruz...'; }, 6000);
        // fetch'in kendi zaman aşımı var (net/supa.ts); bu ikinci emniyet: ne olursa olsun düğme en geç ~25 sn'de geri gelir
        let err = await zamanAsimi(mode === 'giris' ? girisYap(ad, sifre) : kayitOl(ad, sifre), ISTEK_ZAMAN_ASIMI_MS + 5000, SUNUCU_YAVAS);
        clearTimeout(yavas);
        // admin / xynena: the key code is checked on the server (hash in the DB); without it the account never opens
        if (!err && adm) { const k = await adminDogrula(kod); if (k === 'yanlis') { await cikisYap(); err = 'Anahtar kod yanlış.'; } }
        isNew = !err && mode === 'kayit';
        // üst üste 2 "tutmadı" = büyük ihtimalle unutulmuş şifre: yol gösteren kutu kendiliğinden açılır
        if (err === GIRIS_TUTMADI) { if (++tutmadi >= 2) unut = true; } else if (!err) tutmadi = 0;
        if (err === PROFIL_YAZILAMADI) mode = 'giris';
        if (err) { const keepAd = ad; paint(err); (bg.querySelector('input[name="ad"]') as HTMLInputElement).value = keepAd; try { deps.sfx?.('error'); } catch { /* */ } return; }
        try { deps.sfx?.('ok'); } catch { /* */ }
        await finish(true);
      };
      bg.addEventListener('click', e => {
        const el = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null; if (!el) return;
        if (el.dataset.retry) { el.disabled = true; el.textContent = 'Bekle...'; void slotlariYukle().then(ok => { if (ok) slotsScreen(); else { try { deps.sfx?.('error'); } catch { /* */ } okumaHatasi(); } }); return; }
        if (el.dataset.no) { try { deps.sfx?.('tik'); } catch { /* */ } slotsScreen(); return; }
        if (el.dataset.del) { delScreen(Number(el.dataset.del), 1); return; }
        if (el.dataset.d1) { delScreen(Number(el.dataset.d1), 2); return; }
        if (el.dataset.d2) {
          const i = Number(el.dataset.d2); if (!delMatch(i)) return;
          el.disabled = true; el.textContent = 'Siliniyor...';
          void slotSil(i).then(ok => { if (ok) { try { deps.sfx?.('ok'); } catch { /* */ } slotsScreen(); } else { try { deps.sfx?.('error'); } catch { /* */ } delScreen(i, 2, 'Silinemedi, bağlantını kontrol edip tekrar dene. Hiçbir şey silinmedi.'); } });
          return;
        }
        if (el.dataset.slot) { slotSec(Number(el.dataset.slot)); try { deps.sfx?.('tik'); } catch { /* */ } void enter(); return; }
        if (el.dataset.enter) { void enter(); return; }
        if (el.dataset.unut) { unut = true; const keepAd = (bg.querySelector('input[name="ad"]') as HTMLInputElement).value; paint(); (bg.querySelector('input[name="ad"]') as HTMLInputElement).value = keepAd; return; }
        if (el.dataset.m) { mode = el.dataset.m as 'giris' | 'kayit'; paint(); return; }
        if (el.dataset.go) { void submit(); return; }
        if (el.dataset.guest) void finish(false);
      });
      bg.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { if ((e.target as HTMLInputElement).name === 'onay') { (bg.querySelector('[data-d2]') as HTMLButtonElement | null)?.click(); return; } if (inServers) void enter(); else void submit(); } });
      bg.addEventListener('keyup', e => e.stopPropagation());
      bg.addEventListener('input', e => { const t = e.target as HTMLInputElement; if (t.name === 'onay') { const b = bg.querySelector('[data-d2]') as HTMLButtonElement | null; if (b) b.disabled = !delMatch(Number(b.dataset.d2)); return; } if (t.name === 'ad' && mode === 'giris' && adminAdiMi(t.value)) showKey(); });
      // 2026-10-25 user: no "continue as ..." screen; everyone types their own username and password
      paint(); deps.root.appendChild(bg);
    },
  };
}
