/**
 * "Gece Vitrini" HUD (2026-11-02, user: "arayüz hiç değiştirilmemiş"). Real layout change, not a recolour:
 * the top-left is one dark glass ledger (level ring + bakiye / simit / gün-saat with a day-arc), the dock at the bottom is
 * a floating glass rail with underline-active tiles and small-caps labels, the goals card on the right is a slim glass
 * tab with an amber rule. Loaded after every other sheet so it wins; panels keep the porcelain look (skin.ts).
 */
export const YENI_CSS = `
#sbui{--glass:rgba(11,19,38,.6);--glass2:rgba(11,19,38,.88);--hair:rgba(255,255,255,.13);--amb:#ffb627;--mint:#6ef2ab}
#sbui .sb-hud{align-items:flex-start;gap:10px}
#sbui .sb-lvl{width:66px!important;height:66px!important;border:0!important;box-shadow:0 10px 26px rgba(4,10,24,.5),0 0 0 5px var(--glass)!important;background:conic-gradient(var(--amb) calc(var(--p,0)*1turn),rgba(255,255,255,.16) 0)!important}
#sbui .sb-lvl-in{width:52px!important;height:52px!important;border:0!important;background:radial-gradient(circle at 30% 22%,#4a6fb8,#12214a)!important;font:900 24px/1 var(--disp)!important;text-shadow:none!important;letter-spacing:-.02em}
#sbui .sb-lvl small{background:var(--amb)!important;color:#14213d!important;border:0!important;font-size:9px!important;letter-spacing:.14em!important;bottom:-8px!important;padding:3px 7px 2px!important;border-radius:6px!important}
#sbui .sb-hmid{flex:none!important;gap:0!important;padding:8px 14px 9px!important;border-radius:18px;background:var(--glass);border:1px solid var(--hair);backdrop-filter:blur(16px) saturate(1.3);-webkit-backdrop-filter:blur(16px) saturate(1.3);box-shadow:0 12px 30px rgba(4,10,24,.42);min-width:176px;position:relative}
#sbui .sb-hl{gap:14px!important}
#sbui .sb-hl+.sb-hl{margin-top:7px;padding-top:7px;border-top:1px solid var(--hair)}
#sbui .sb-pill{background:none!important;border:0!important;box-shadow:none!important;height:auto!important;padding:0!important;color:#fff!important;gap:6px!important;font:800 21px/1 var(--disp)!important;letter-spacing:-.01em}
#sbui .sb-pill svg{width:26px!important;height:26px!important;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))}
#sbui .sb-money b{color:var(--mint)!important}
#sbui .sb-gold b{color:#ffd166!important;font-size:19px}
#sbui .sb-day{font:800 12.5px/1 var(--body)!important;letter-spacing:.08em;overflow:visible!important;padding-bottom:6px!important;color:rgba(255,255,255,.8)!important}
#sbui .sb-day svg{width:22px!important;height:22px!important}
#sbui .sb-day b{color:#ff8f80!important;font-family:var(--disp)}
#sbui .sb-day .clk{color:#fff;font-weight:900;font-size:15px;letter-spacing:.02em;margin-left:auto}
#sbui .sb-day .sb-dbar{height:3px!important;bottom:0!important;border-radius:3px!important;box-shadow:0 0 8px rgba(255,182,39,.6)}
#sbui .sb-day::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,.12);border-radius:3px;z-index:-1}
#sbui .sb-stars{background:none!important;border:0!important;box-shadow:none!important;height:auto!important;padding:0!important}
#sbui .sb-hbtns{flex-direction:row!important;margin-left:auto;gap:8px!important}
#sbui .sb-ib{width:44px!important;height:44px!important;border-radius:14px!important;background:var(--glass)!important;border:1px solid var(--hair)!important;box-shadow:0 8px 20px rgba(4,10,24,.4)!important;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
#sbui .sb-ib svg{filter:brightness(0) invert(1);opacity:.92}
#sbui .sb-streak{background:linear-gradient(90deg,#ff5a4e,#ff8a3d)!important;border:0!important;box-shadow:0 8px 20px rgba(255,90,78,.4)!important}
/* dock */
#sbui .sb-bar{background:var(--glass2)!important;border:1px solid var(--hair)!important;border-radius:22px!important;box-shadow:0 18px 40px rgba(4,10,24,.55),inset 0 1px 0 rgba(255,255,255,.08)!important;backdrop-filter:blur(18px) saturate(1.3);-webkit-backdrop-filter:blur(18px) saturate(1.3);padding:6px!important;gap:2px!important;max-width:600px!important}
#sbui .sb-bi{height:60px!important;border-radius:16px!important;color:rgba(255,255,255,.72)!important;font:800 9.5px/1 var(--body)!important;letter-spacing:.12em!important;text-transform:uppercase;gap:5px!important;transition:background .18s,color .18s,transform .18s}
#sbui .sb-bi span{opacity:.9}
#sbui .sb-bi svg{width:30px!important;height:30px!important;filter:drop-shadow(0 3px 4px rgba(0,0,0,.5))}
#sbui .sb-bi:hover{background:rgba(255,255,255,.07)!important;color:#fff!important}
#sbui .sb-bi.on{background:linear-gradient(180deg,rgba(255,182,39,.0),rgba(255,182,39,.22))!important;box-shadow:inset 0 -3px 0 var(--amb)!important;color:#fff!important}
#sbui .sb-badge{background:#ff5a4e!important;border:2px solid var(--glass2)!important;font-family:var(--disp)}
/* goals tab */
body .hd-card{background:var(--glass,rgba(11,19,38,.74))!important;border:1px solid rgba(255,255,255,.13)!important;border-left:3px solid #ffb627!important;border-radius:14px 0 0 14px!important;right:0!important;width:min(232px,58vw)!important;box-shadow:0 14px 32px rgba(4,10,24,.45)!important;color:#fff!important;backdrop-filter:blur(16px) saturate(1.3);-webkit-backdrop-filter:blur(16px) saturate(1.3)}
body .hd-hd{background:transparent!important;border:0!important;padding:9px 12px 4px!important}
body .hd-hd b{font:800 10px/1 var(--body)!important;letter-spacing:.22em!important;color:rgba(255,255,255,.62)}
body .hd-hd i{background:#ffb627!important;color:#14213d!important;border:0!important;border-radius:7px!important}
body .hd-main{border-bottom:1px solid rgba(255,255,255,.1)!important}
body .hd-main .lb{color:#fff;font-size:15px}
body .hd-main .sb,body .hd-sm .n{color:rgba(255,255,255,.6)!important}
body .hd-bar{background:rgba(255,255,255,.12)!important;border:0!important;height:6px!important;border-radius:4px!important}
body .hd-bar u{background:linear-gradient(90deg,#2fbf71,#6ef2ab)!important}
body .hd-amt,body .hd-sm .rw{color:#6ef2ab!important}
body .hd-pin{background:rgba(255,255,255,.1)!important;border:0!important}
body .hd-pin.on{background:#ffb627!important}
body .hd-sm{color:rgba(255,255,255,.88)}
body .hd-sm .ck{background:transparent!important;border-color:rgba(255,255,255,.4)!important;color:#fff}
body .hd-sm.done .ck{background:#2fbf71!important;border-color:#2fbf71!important}
/* online strip, chat, skill button */
body .on-pill{top:12px!important;min-width:0!important;background:rgba(11,19,38,.74)!important;border:1px solid rgba(255,255,255,.13)!important;color:rgba(255,255,255,.78)!important;font:800 11px/1.3 var(--body)!important;letter-spacing:.12em;text-transform:uppercase;padding:5px 14px!important;box-shadow:0 8px 20px rgba(4,10,24,.4)!important;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
body .on-oda{top:44px!important;min-width:0!important;min-height:30px!important;background:rgba(255,182,39,.95)!important;color:#14213d!important;border:0!important;box-shadow:0 8px 20px rgba(255,182,39,.28)!important;font:900 12px/1 var(--body)!important;letter-spacing:.06em;padding:0 16px!important}
body .on-log{background:transparent!important;border:0!important;height:auto!important;max-height:84px;justify-content:flex-end;overflow:hidden!important;-webkit-mask-image:linear-gradient(to top,#000 70%,transparent);mask-image:linear-gradient(to top,#000 70%,transparent)}
body .on-chat{bottom:84px!important;width:min(280px,calc(100vw - 20px))!important}
body .on-log div{background:rgba(11,19,38,.55)!important;border:0!important;color:#fff!important;font-size:12px!important;padding:2px 8px!important}
body .on-log div.pm{background:rgba(255,120,190,.28)!important}body .on-log div.sys{background:rgba(67,179,217,.26)!important}
body .on-top button{background:rgba(11,19,38,.74)!important;color:#fff!important;border:1px solid rgba(255,255,255,.13)!important}
body .on-in{background:rgba(11,19,38,.74)!important;color:#fff!important;border:1px solid rgba(255,255,255,.18)!important}
body .on-in::placeholder{color:rgba(255,255,255,.5)}
body .on-send{background:#ffb627!important;color:#14213d!important;border:0!important;box-shadow:none!important}
body .yt-b{background:rgba(11,19,38,.82)!important;border:2px solid #ffb627!important;box-shadow:0 10px 26px rgba(4,10,24,.5),0 0 18px rgba(255,182,39,.35)!important}
body .yt-b.cd{filter:saturate(.3) brightness(.8)}
body .yt-b span{background:#ffb627!important;color:#14213d!important}
`;
