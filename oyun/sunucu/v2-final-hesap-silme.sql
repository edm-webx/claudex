-- v2.0 FINAL: TÜM HESAPLARI VE KAYITLARI SİLER (2026-11-21 hazırlandı). GERİ ALINAMAZ.
-- SADECE kullanıcı (Mr) v2.0 yayını sırasında bu thread'de açıkça "evet" dedikten sonra çalıştırılır.
-- Yedek: veritabanında `yedek` şemasında (API'ye kapalı) duruyor:
--   yedek.hesaplar_20261121 (id, e-posta, tarihler), yedek.oyuncular_20261121, yedek.kayitlar_20261121 (tam kayıtlar),
--   yedek.oturum_log_20261121. Özet: proje dosyaları sosisci-oyun/sunucu/yedek-2026-11-21/YEDEK-OZETI.md
-- Test hesapları testv2deneme ve testkilit (2026-11-21 canlı testler) de bu silmeyle gider.
-- Yönetici kodları (admin_kodlar) ve tablo yapısı KALIR. admin/xynena yeniden kayıt olunca admin_otomatik
-- tetikleyicisi yönetici satırını kendisi açar; panele yine gizli anahtar kodla girilir.
begin;

-- Silmeden hemen önce son durumun yedeği (aynı gün ikinci kez çalışırsa üzerine yazmaz, hata verip durur)
create table yedek.kayitlar_final    as select * from public.kayitlar;
create table yedek.oyuncular_final   as select * from public.oyuncular;
create table yedek.hesaplar_final    as select id, email, created_at, last_sign_in_at from auth.users;
create table yedek.oturum_log_final  as select * from public.oturum_log;

delete from public.admin_komut;
delete from public.oturum_log;
delete from public.yasaklar;
delete from public.susturmalar;
delete from public.kayitlar;
delete from public.oyuncular;
delete from public.adminler;
delete from auth.users;            -- oturumlar/kimlikler auth tarafında zincirle silinir
update public.admin_deneme set hatali = 0, son_hata = null;

commit;

select (select count(*) from auth.users) hesap, (select count(*) from public.oyuncular) profil,
       (select count(*) from public.kayitlar) kayit;   -- üçü de 0 olmalı

-- İsteğe bağlı, oyun oturduktan sonra: eski yedekleri tamamen kaldırmak için
--   drop schema yedek cascade;
